
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const getMonthName = (month: number): string => {
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return months[month];
};

export const getEffectiveDueDay = (day: number, month: number, year: number): number => {
  // February Rule
  if (month === 1) { // February is month 1
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    const maxDay = isLeap ? 29 : 28;
    return Math.min(day, maxDay);
  }
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Math.min(day, daysInMonth);
};

export const getToday = () => {
  const now = new Date();
  return {
    day: now.getDate(),
    month: now.getMonth(),
    year: now.getFullYear()
  };
};

export const toTitleCase = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const getCompetenceStatus = (dueDate: number, paidAmount: number, originalValue: number) => {
  if (paidAmount >= originalValue - 0.01) {
    return { label: 'LIQUIDADO', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: 'ATRASADO', color: 'bg-red-100 text-red-700 border-red-200' };
  if (diffDays === 0) return { label: 'VENCE HOJE', color: 'bg-amber-100 text-amber-700 border-amber-200' };
  if (diffDays === 1) return { label: 'VENCE AMANHÃ', color: 'bg-blue-100 text-blue-700 border-blue-200' };
  
  return { label: 'MÊS À FRENTE', color: 'bg-slate-100 text-slate-700 border-slate-200' };
};
