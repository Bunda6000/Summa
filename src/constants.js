export const CHART_COLORS = ["#68C0A4","#F06B5E","#6B8FD4","#F5C542","#9B7EBD","#D4453A","#4ABAB5","#D49BC4","#7B9EC4","#E8A87C","#1A9E76","#B8706B"];

export const DEFAULT_CATS = [
  { id: "rent", name: "Rent / Mortgage", maxYears: 5, fields: [] },
  { id: "utilities", name: "Utilities", maxYears: 5, fields: [{ id: "f1", name: "Provider", type: "text" }] },
  { id: "subscriptions", name: "Subscriptions", maxYears: 5, fields: [{ id: "f1", name: "Service", type: "text" }] },
  { id: "insurance", name: "Insurance", maxYears: 5, fields: [] },
  { id: "loans", name: "Loans", maxYears: 35, protected: true, fields: [] },
  { id: "transport", name: "Transport", maxYears: 5, fields: [] },
];

export const defaultData = () => ({
  categories: DEFAULT_CATS.map(c => ({
    ...c,
    fields: (c.fields || []).map(f => ({ ...f })),
  })),
  expenses: {},
  loanTypes: [],
  loanPaid: {},
  fixedIncomes: [],
  variableIncomes: [],
});
