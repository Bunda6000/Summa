import { create } from 'zustand';

const useUIStore = create((set) => ({
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

  // Flash a toast message for 2 seconds
  flash: (msg) => {
    set({ toast: msg });
    setTimeout(() => set({ toast: null }), 2000);
  },
}));

export default useUIStore;
