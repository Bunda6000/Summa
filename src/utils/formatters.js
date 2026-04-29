export const fmt = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
};
