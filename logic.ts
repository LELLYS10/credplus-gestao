
import { Client, Competence, Group, DBState } from './types';
import { getToday, getEffectiveDueDay } from './utils';

export const generatePendingCompetences = (db: any) => {
  const { clients, competences, groups } = db;
  if (!clients || !competences) return { newCompetences: competences, changed: false };

  const newCompetences: Competence[] = [...competences];
  let changed = false;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // 1. Index existing competences for fast lookup
  const compMap = new Map<string, Competence[]>();
  const compIdSet = new Set<string>();

  newCompetences.forEach(comp => {
    if (!compMap.has(comp.clientId)) {
      compMap.set(comp.clientId, []);
    }
    compMap.get(comp.clientId)!.push(comp);
    compIdSet.add(comp.id);
  });

  clients.forEach((client: Client) => {
    if (!client || client.status !== 'ACTIVE') return;

    const group = groups.find((g: Group) => g.id === client.groupId);
    const rate = (client.contractRate && client.contractRate > 0) ? client.contractRate : (group ? group.interestRate : 0);
    const currentCap = client.currentCapital || 0;
    const expectedInterest = Math.max(0, currentCap * (rate / 100));

    // Get client competences and sort them
    let clientComps = (compMap.get(client.id) || [])
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });

    if (clientComps.length === 0) {
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
          if (isNaN(start.getTime())) return;

          m = start.getMonth();
          y = start.getFullYear();
          
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
        if (!compIdSet.has(firstId)) {
          const firstComp: Competence = {
            id: firstId,
            clientId: client.id,
            month: m,
            year: y,
            originalValue: expectedInterest,
            paidAmount: 0,
            capitalAtTime: currentCap,
            lastUpdated: Date.now(),
            dueDate: dDate
          };
          newCompetences.push(firstComp);
          compIdSet.add(firstId);
          changed = true;
          clientComps = [firstComp];
        }
      }
    }

    if (clientComps.length > 0) {
      let latest = clientComps[clientComps.length - 1];
      
      // Update latest if unpaid and values changed
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

      // Generate next ones
      while (currentCap > 0) {
        const isPaid = latest.paidAmount >= latest.originalValue - 0.01;
        if (!isPaid) break;

        let nextMonth = latest.month + 1;
        let nextYear = latest.year;
        if (nextMonth > 11) {
          nextMonth = 0;
          nextYear++;
        }
        
        const limitDate = new Date(currentYear, currentMonth + 1, 1);
        const nextDate = new Date(nextYear, nextMonth, 1);
        if (nextDate > limitDate) break;

        const nextId = `comp-${client.id}-${nextMonth}-${nextYear}`;
        if (!compIdSet.has(nextId)) {
          let nextDueDate: number | undefined = undefined;
          if (latest.dueDate) {
            const currentDue = new Date(latest.dueDate);
            const nextDue = new Date(currentDue.getFullYear(), currentDue.getMonth() + 1, currentDue.getDate());
            if (nextDue.getDate() !== currentDue.getDate()) {
              nextDue.setDate(0);
            }
            nextDueDate = nextDue.getTime();
          } else {
            // Fallback to dueDay if no dueDate was set
            const nextDue = new Date(nextYear, nextMonth, getEffectiveDueDay(client.dueDay || 1, nextMonth, nextYear));
            nextDueDate = nextDue.getTime();
          }

          const nextComp: Competence = {
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
          compIdSet.add(nextId);
          latest = nextComp;
          changed = true;
        } else {
          // If it exists, we just move to it and check if we should continue
          const existing = newCompetences.find(c => c.id === nextId);
          if (existing) {
            latest = existing;
            if (latest.paidAmount < latest.originalValue - 0.01) break;
          } else {
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
