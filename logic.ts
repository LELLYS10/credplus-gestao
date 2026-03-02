
import { Client, Competence, Group, DBState } from './types';
import { getToday, getEffectiveDueDay } from './utils';

export const generatePendingCompetences = (db: any) => {
  const { clients, competences, groups } = db;
  const newCompetences: Competence[] = [...competences];
  let changed = false;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  clients.forEach((client: Client) => {
    if (!client || client.status !== 'ACTIVE') return;

    const group = groups.find((g: Group) => g.id === client.groupId);
    const rate = group ? group.interestRate : 0;
    const currentCap = client.currentCapital || 0;
    const expectedInterest = Math.max(0, currentCap * (rate / 100));

    // Get all competences for this client, sorted by date
    let clientComps = newCompetences
      .filter(c => c.clientId === client.id)
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });

    if (clientComps.length === 0) {
      // Only create first competence if there is capital
      if (currentCap > 0) {
        let m: number;
        let y: number;
        let dDate: number | undefined = undefined;

        if (client.firstDueDate) {
          const firstDue = new Date(client.firstDueDate);
          m = firstDue.getMonth();
          y = firstDue.getFullYear();
          dDate = client.firstDueDate;
        } else {
          const start = new Date(client.createdAt);
          if (isNaN(start.getTime())) return; // Safety check

          m = start.getMonth();
          y = start.getFullYear();
          
          // Se o empréstimo começou NO dia ou DEPOIS do dia de vencimento deste mês,
          // a primeira competência deve ser a do mês seguinte.
          const dueDayInStartMonth = getEffectiveDueDay(client.dueDay || 1, m, y);
          if (start.getDate() >= dueDayInStartMonth) {
            m++;
            if (m > 11) {
              m = 0;
              y++;
            }
          }
        }
        
        const firstId = `comp-${client.id}-${m}-${y}`;
        if (!newCompetences.find(c => c.id === firstId)) {
          newCompetences.push({
            id: firstId,
            clientId: client.id,
            month: m,
            year: y,
            originalValue: expectedInterest,
            paidAmount: 0,
            capitalAtTime: currentCap,
            lastUpdated: Date.now(),
            dueDate: dDate
          });
          changed = true;
          // Update clientComps for the loop below
          clientComps = [newCompetences[newCompetences.length - 1]];
        }
      }
    }

    if (clientComps.length > 0) {
      let latest = clientComps[clientComps.length - 1];
      
      // 1. Update the latest one if it's not paid
      if (latest.paidAmount === 0) {
        const actualExpected = currentCap <= 0 ? 0 : expectedInterest;
        if (Math.abs(latest.originalValue - actualExpected) > 0.01 || Math.abs((latest.capitalAtTime || 0) - currentCap) > 0.01) {
          const idx = newCompetences.findIndex(c => c.id === latest.id);
          if (idx !== -1) {
            newCompetences[idx] = { 
              ...latest, 
              originalValue: actualExpected, 
              capitalAtTime: currentCap, 
              lastUpdated: Date.now() 
            };
            latest = newCompetences[idx];
            changed = true;
          }
        }
      }

      // 2. Generate next ones
      // We only generate the next competence if the current one is fully paid.
      while (currentCap > 0) {
        const isPaid = latest.paidAmount >= latest.originalValue - 0.01;
        
        if (!isPaid) {
          break;
        }

        let nextMonth = latest.month + 1;
        let nextYear = latest.year;
        if (nextMonth > 11) {
          nextMonth = 0;
          nextYear++;
        }
        
        // Stop if we reach too far into the future (beyond next month)
        const limitDate = new Date(currentYear, currentMonth + 1, 1);
        const nextDate = new Date(nextYear, nextMonth, 1);
        if (nextDate > limitDate) {
          break;
        }

        const nextId = `comp-${client.id}-${nextMonth}-${nextYear}`;
        const existing = newCompetences.find(c => c.id === nextId);
        if (!existing) {
          let nextDueDate: number | undefined = undefined;
          if (latest.dueDate) {
            const currentDue = new Date(latest.dueDate);
            const nextDue = new Date(currentDue.getFullYear(), currentDue.getMonth() + 1, currentDue.getDate());
            // Se o dia mudou (ex: 31 de janeiro para 3 de março), ajustamos para o último dia do mês correto
            if (nextDue.getDate() !== currentDue.getDate()) {
              nextDue.setDate(0); // Último dia do mês anterior ao que virou (que seria o mês correto)
            }
            nextDueDate = nextDue.getTime();
          }

          const nextComp = {
            id: nextId,
            clientId: client.id,
            month: nextMonth,
            year: nextYear,
            originalValue: expectedInterest,
            paidAmount: 0,
            capitalAtTime: currentCap,
            lastUpdated: Date.now(),
            dueDate: nextDueDate
          };
          newCompetences.push(nextComp);
          latest = nextComp;
          changed = true;
        } else {
          latest = existing;
          // If the one we just found/generated is unpaid, we stop here.
          if (latest.paidAmount < latest.originalValue - 0.01) {
            break;
          }
        }
      }
    }
  });

  return { newCompetences, changed };
};

export const applyFIFOPayment = (competences: Competence[], clientId: string, amount: number, discount: number = 0): Competence[] => {
  let remainingAmount = amount;
  let remainingDiscount = discount;
  
  const sorted = [...competences].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  return sorted.map(comp => {
    if (comp.clientId !== clientId) return comp;
    
    let updatedComp = { ...comp };

    // 1. Apply discount first to reduce originalValue (forgive debt)
    if (remainingDiscount > 0) {
      const owed = updatedComp.originalValue - updatedComp.paidAmount;
      if (owed > 0) {
        const toDiscount = Math.min(owed, remainingDiscount);
        updatedComp.originalValue -= toDiscount;
        remainingDiscount -= toDiscount;
        updatedComp.lastUpdated = Date.now();
      }
    }

    // 2. Apply payment to paidAmount
    if (remainingAmount > 0) {
      const owed = updatedComp.originalValue - updatedComp.paidAmount;
      if (owed > 0) {
        const toPay = Math.min(owed, remainingAmount);
        updatedComp.paidAmount += toPay;
        remainingAmount -= toPay;
        updatedComp.lastUpdated = Date.now();
      }
    }

    return updatedComp;
  });
};
