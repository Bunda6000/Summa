import { create } from 'zustand';

export type Tab = 'dashboard' | 'expenses' | 'incomes' | 'budget';

export interface PaidPickerState {
  catId?: string;
  key?: string;
  loanMonth?: string;
}

interface UIState {
  tab: Tab;
  catIdx: number;
  expYear: number;
  budgetYear: number;
  modal: null | { type: string; payload?: unknown };
  toast: string | null;
  paidPicker: PaidPickerState | null;
  expSel: Set<string>;
  varSel: Set<string>;
  dragIdx: number | null;
  introDone: boolean;

  setTab: (tab: UIState['tab']) => void;
  setCatIdx: (catIdx: number) => void;
  setExpYear: (expYear: number) => void;
  setBudgetYear: (budgetYear: number) => void;
  setModal: (modal: UIState['modal']) => void;
  setToast: (toast: string | null) => void;
  setPaidPicker: (paidPicker: PaidPickerState | null) => void;
  setExpSel: (expSel: Set<string>) => void;
  setVarSel: (varSel: Set<string>) => void;
  setDragIdx: (dragIdx: number | null) => void;
  setIntroDone: (introDone: boolean) => void;

  // Flash a toast message for 2 seconds
  flash: (msg: string) => void;
}

let _flashTimer: ReturnType<typeof setTimeout> | null = null;

const useUIStore = create<UIState>((set) => ({
  tab: 'dashboard',
  catIdx: 0,
  expYear: new Date().getFullYear(),
  budgetYear: new Date().getFullYear(),
  modal: null,
  toast: null,
  paidPicker: null,
  expSel: new Set(),
  varSel: new Set(),
  dragIdx: null,
  introDone: false,

  setTab: (tab) => set({ tab }),
  setCatIdx: (catIdx) => set({ catIdx }),
  setExpYear: (expYear) => set({ expYear }),
  setBudgetYear: (budgetYear) => set({ budgetYear }),
  setModal: (modal) => set({ modal }),
  setToast: (toast) => set({ toast }),
  setPaidPicker: (paidPicker) => set({ paidPicker }),
  setExpSel: (expSel) => set({ expSel }),
  setVarSel: (varSel) => set({ varSel }),
  setDragIdx: (dragIdx) => set({ dragIdx }),
  setIntroDone: (introDone) => set({ introDone }),

  flash: (msg) => {
    if (_flashTimer !== null) clearTimeout(_flashTimer);
    set({ toast: msg });
    _flashTimer = setTimeout(() => set({ toast: null }), 2000);
  },
}));

export default useUIStore;
