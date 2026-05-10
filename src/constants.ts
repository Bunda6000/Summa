import type { AppData, Category } from './types';

export const CHART_COLORS: readonly string[] = ["#68C0A4","#F06B5E","#6B8FD4","#F5C542","#9B7EBD","#D4453A","#4ABAB5","#D49BC4","#7B9EC4","#E8A87C","#1A9E76","#B8706B"];

export const LEGAL_URLS = {
  privacy: 'https://summaapp.com/privacy',
  terms: 'https://summaapp.com/terms',
} as const;

export const DEFAULT_CATS: Category[] = [
  { id: "rent", name: "Rent / Mortgage", maxYears: 5, fields: [], subcategories: [], colOrder: [] },
  { id: "utilities", name: "Utilities", maxYears: 5, fields: [{ id: "f1", name: "Provider", type: "text" }], subcategories: [], colOrder: [] },
  { id: "subscriptions", name: "Subscriptions", maxYears: 5, fields: [{ id: "f1", name: "Service", type: "text" }], subcategories: [], colOrder: [] },
  { id: "insurance", name: "Insurance", maxYears: 5, fields: [], subcategories: [], colOrder: [] },
  { id: "loans", name: "Loans", maxYears: 35, protected: true, fields: [], subcategories: [], colOrder: [] },
  { id: "transport", name: "Transport", maxYears: 5, fields: [], subcategories: [], colOrder: [] },
];

export const defaultData = (): AppData => ({
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
