
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
