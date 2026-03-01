
import { Client, Competence, Group, DBState } from './types';
import { getToday } from './utils';

export const generatePendingCompetences = (db: any) => {
  const { clients, competences, groups } = db;
  const newCompetences: Competence[] = [...competences];
  let changed = false;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  clients.forEach((client: Client) => {
    if (client.status !== 'ACTIVE') return;

    const group = groups.find((g: Group) => g.id === client.groupId);
    const rate = group ? group.interestRate : 0;
    const expectedInterest = Math.max(0, client.currentCapital * (rate / 100));

    // Get all competences for this client, sorted by date
    let clientComps = newCompetences
      .filter(c => c.clientId === client.id)
      .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));

    if (clientComps.length === 0) {
      // Only create first competence if there is capital
      if (client.currentCapital > 0) {
        const start = new Date(client.createdAt);
        let m = start.getMonth();
        let y = start.getFullYear();
        
        const firstId = `comp-${client.id}-${m}-${y}`;
        if (!newCompetences.find(c => c.id === firstId)) {
          newCompetences.push({
            id: firstId,
            clientId: client.id,
            month: m,
            year: y,
            originalValue: expectedInterest,
            paidAmount: 0,
            capitalAtTime: client.currentCapital,
            lastUpdated: Date.now()
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
        const actualExpected = client.currentCapital <= 0 ? 0 : expectedInterest;
        if (Math.abs(latest.originalValue - actualExpected) > 0.01 || Math.abs((latest.capitalAtTime || 0) - client.currentCapital) > 0.01) {
          const idx = newCompetences.findIndex(c => c.id === latest.id);
          if (idx !== -1) {
            newCompetences[idx] = { 
              ...latest, 
              originalValue: actualExpected, 
              capitalAtTime: client.currentCapital, 
              lastUpdated: Date.now() 
            };
            latest = newCompetences[idx];
            changed = true;
          }
        }
      }

      // 2. Generate next ones ONLY if the latest is fully paid AND there is still capital
      // OR if the latest is in the past (to catch up with debt)
      while (client.currentCapital > 0 && (latest.paidAmount >= latest.originalValue - 0.01 || (latest.year < currentYear || (latest.year === currentYear && latest.month < currentMonth)))) {
        let nextMonth = latest.month + 1;
        let nextYear = latest.year;
        if (nextMonth > 11) {
          nextMonth = 0;
          nextYear++;
        }
        
        // Stop if we reach the future (beyond current month)
        if (nextYear > currentYear || (nextYear === currentYear && nextMonth > currentMonth)) {
          break;
        }

        const nextId = `comp-${client.id}-${nextMonth}-${nextYear}`;
        const existing = newCompetences.find(c => c.id === nextId);
        if (!existing) {
          const nextComp = {
            id: nextId,
            clientId: client.id,
            month: nextMonth,
            year: nextYear,
            originalValue: expectedInterest,
            paidAmount: 0,
            capitalAtTime: client.currentCapital,
            lastUpdated: Date.now()
          };
          newCompetences.push(nextComp);
          latest = nextComp;
          changed = true;
        } else {
          latest = existing;
          // If it's not paid, we stop generating further months (incremental debt generation)
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
