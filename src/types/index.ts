export interface CategoryField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'select';
  options?: string[];
}

export interface Subcategory {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  maxYears: number;
  protected?: boolean;
  fields: CategoryField[];
  subcategories: Subcategory[];
  colOrder: string[];
}

export interface SubPaidEntry {
  paid: boolean;
  paidDate: string;
}

export interface ExpenseEntry {
  amount: number;
  subAmounts: Record<string, number>;
  subPaid: Record<string, SubPaidEntry>;
  fields: Record<string, string>;
  extras: { name: string; value: string }[];
  paid: boolean;
  paidDate: string;
}

// expenses[catId][monthKey] = ExpenseEntry
export type Expenses = Record<string, Record<string, ExpenseEntry>>;

export interface LoanType {
  id: string;
  name: string;
  loanNumber?: string;
  amount: number;
  startFrom: string;
  endAt: string;
}

export type LoanPaid = Record<string, Record<string, SubPaidEntry>>;

export interface IncomeRecord {
  amount: number;
  effectiveFrom: string;
}

export interface FixedIncome {
  id: string;
  name: string;
  records: IncomeRecord[];
}

export interface VariableIncome {
  id: string;
  name: string;
  amount: number;
  month: string;
}

export interface AppData {
  categories: Category[];
  expenses: Expenses;
  loanTypes: LoanType[];
  loanPaid: LoanPaid;
  fixedIncomes: FixedIncome[];
  variableIncomes: VariableIncome[];
  _schemaVersion?: number;
  _updatedAt?: number;
}
