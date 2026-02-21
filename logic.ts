
import { Client, Competence, Group, DBState } from './types';
import { getToday } from './utils';

export const generatePendingCompetences = (db: any) => {
  const { clients, competences, groups } = db;
  const newCompetences: Competence[] = [...competences];
  let changed = false;

  clients.forEach((client: Client) => {
    if (client.status !== 'ACTIVE') return;

    const group = groups.find((g: Group) => g.id === client.groupId);
    const rate = group ? group.interestRate : 0;
    const expectedInterest = Math.max(0, client.currentCapital * (rate / 100));

    // Get all competences for this client, sorted by date
    const clientComps = newCompetences
      .filter(c => c.clientId === client.id)
      .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));

    if (clientComps.length === 0) {
      // Only create first competence if there is capital
      if (client.currentCapital > 0) {
        const start = new Date(client.createdAt);
        const m = start.getMonth();
        const y = start.getFullYear();
        newCompetences.push({
          id: `comp-${client.id}-${m}-${y}`,
          clientId: client.id,
          month: m,
          year: y,
          originalValue: expectedInterest,
          paidAmount: 0,
          capitalAtTime: client.currentCapital,
          lastUpdated: Date.now()
        });
        changed = true;
      }
    } else {
      const latest = clientComps[clientComps.length - 1];
      
      // 1. Update the latest one if it's not paid
      // If capital is 0, interest MUST be 0
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
            changed = true;
          }
        }
      }

      // 2. Generate next one ONLY if the latest is fully paid AND there is still capital
      if (client.currentCapital > 0 && latest.paidAmount >= latest.originalValue - 0.01 && latest.originalValue > 0) {
        let nextMonth = latest.month + 1;
        let nextYear = latest.year;
        if (nextMonth > 11) {
          nextMonth = 0;
          nextYear++;
        }
        
        const nextId = `comp-${client.id}-${nextMonth}-${nextYear}`;
        if (!newCompetences.find(c => c.id === nextId)) {
          newCompetences.push({
            id: nextId,
            clientId: client.id,
            month: nextMonth,
            year: nextYear,
            originalValue: expectedInterest,
            paidAmount: 0,
            capitalAtTime: client.currentCapital,
            lastUpdated: Date.now()
          });
          changed = true;
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
