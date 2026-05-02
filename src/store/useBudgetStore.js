import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { loadStore, saveStore } from '../storage';
import { defaultData } from '../constants';
import { uid, today, mk, parseMk, getCY } from '../utils/dates';
import { reorder } from '../utils/expressions';

const useBudgetStore = create(
  subscribeWithSelector((set, get) => ({
    // ── State ──
    appData: null,       // AppData object (null while loading)
    dark: false,
    initialized: false,
    _initializing: false,

    // ── Init ──
    initStore: async () => {
      if (get().initialized || get()._initializing) return;
      set({ _initializing: true });
      const [storedDark, loaded] = await Promise.all([
        loadStore('budget-dark-mode', false),
        loadStore('budget-app-v2', defaultData()),
      ]);
      if (loaded._schemaVersion >= 2) {
        // already migrated — skip
      } else {
        // Migration: ensure protected Loans category exists
        const hasLoans = loaded.categories?.some(c => c.id === 'loans');
        if (!hasLoans) {
          loaded.categories = [...(loaded.categories || []), { id: 'loans', name: 'Loans', maxYears: 35, protected: true, fields: [] }];
        } else {
          loaded.categories = loaded.categories.map(c =>
            c.id === 'loans' ? { ...c, protected: true, fields: [] } : c
          );
        }
        if (!loaded.loanTypes) loaded.loanTypes = [];
        if (!loaded.loanPaid) loaded.loanPaid = {};
        // Migration: ensure all categories have subcategories + colOrder arrays
        loaded.categories = loaded.categories.map(c => ({
          ...c, subcategories: c.subcategories || [], colOrder: c.colOrder || []
        }));
        loaded._schemaVersion = 2;
      }
      saveStore('budget-app-v2', loaded);
      set({ appData: loaded, dark: storedDark, initialized: true });
      // Sync initial theme classes (one-time side-effect; subscriber wired in Phase 1c)
      document.documentElement.classList.toggle('theme-dark', storedDark);
      document.documentElement.classList.toggle('theme-light', !storedDark);
    },

    // ── Persistence helper ──
    _save: (nextData) => {
      set({ appData: nextData });
      saveStore('budget-app-v2', nextData);
    },

    // ── Theme ──
    toggleDark: () => {
      const next = !get().dark;
      set({ dark: next });
      saveStore('budget-dark-mode', next);
    },

    // ── Expense actions ──
    setExp: (catId, key, entry, applyMonths) => {
      const { appData, _save } = get();
      const next = { ...appData, expenses: { ...appData.expenses } };
      if (!next.expenses[catId]) next.expenses[catId] = {};
      next.expenses[catId] = { ...next.expenses[catId] };
      next.expenses[catId][key] = entry;
      if (applyMonths > 0) {
        const { y, m } = parseMk(key);
        const maxY = getCY() + (appData.categories.find(c => c.id === catId)?.maxYears || 5);
        let cy = y, cm = m + 1, count = 0;
        while (count < applyMonths) {
          if (cm > 11) { cm = 0; cy++; }
          if (cy >= maxY) break;
          next.expenses[catId][mk(cy, cm)] = { ...entry, paid: false, paidDate: '', subPaid: {} };
          cm++; count++;
        }
      }
      _save(next);
    },

    delExp: (catId, key) => {
      const { appData, _save } = get();
      const next = { ...appData, expenses: { ...appData.expenses } };
      if (next.expenses[catId]) {
        next.expenses[catId] = { ...next.expenses[catId] };
        delete next.expenses[catId][key];
      }
      _save(next);
    },

    setExpPaid: (catId, key, paid, paidDate) => {
      const { appData, _save } = get();
      if (!appData.expenses[catId]?.[key]) return;
      const next = { ...appData, expenses: { ...appData.expenses } };
      next.expenses[catId] = { ...next.expenses[catId] };
      next.expenses[catId][key] = { ...next.expenses[catId][key], paid: !!paid, paidDate: paid ? (paidDate || today()) : '' };
      _save(next);
    },

    setAllSubsPaid: (catId, key, paid, paidDate) => {
      const { appData, _save } = get();
      if (!appData.expenses[catId]?.[key]) return;
      const next = { ...appData, expenses: { ...appData.expenses } };
      next.expenses[catId] = { ...next.expenses[catId] };
      const entry = { ...next.expenses[catId][key] };
      const subAmounts = entry.subAmounts || {};
      const newSubPaid = {};
      if (paid) {
        Object.entries(subAmounts).forEach(([scId, amt]) => {
          if (amt > 0) newSubPaid[scId] = { paid: true, paidDate: paidDate || today() };
        });
      }
      const allPd = paid && Object.keys(subAmounts).filter(id => subAmounts[id] > 0).every(id => newSubPaid[id]?.paid);
      const latestDate = allPd ? Object.values(newSubPaid).reduce((l, sp) => sp.paidDate > l ? sp.paidDate : l, '') : '';
      entry.subPaid = newSubPaid;
      entry.paid = allPd;
      entry.paidDate = latestDate;
      next.expenses[catId][key] = entry;
      _save(next);
    },

    bulkDelExp: (catId, keys) => {
      const { appData, _save } = get();
      const next = { ...appData, expenses: { ...appData.expenses } };
      if (!next.expenses[catId]) return;
      next.expenses[catId] = { ...next.expenses[catId] };
      keys.forEach(k => delete next.expenses[catId][k]);
      _save(next);
      // Note: setExpSel(new Set()) is UI state — handled by useUIStore
    },

    // ── Category actions ──
    addCategory: (catData) => {
      const { appData, _save } = get();
      const next = { ...appData, categories: [...appData.categories, { ...catData, id: uid() }] };
      _save(next);
      // Note: setCatIdx(...) is UI state — handled by useUIStore
    },

    updateCategory: (idx, catData) => {
      const { appData, _save } = get();
      const next = { ...appData, categories: appData.categories.map((c, i) => i === idx ? { ...c, ...catData } : c) };
      _save(next);
      // Note: flash() is UI state — handled by useUIStore
    },

    deleteCategory: (idx) => {
      const { appData, _save } = get();
      const c = appData.categories[idx];
      if (c?.protected) return;
      const cid = c?.id;
      const next = { ...appData, categories: appData.categories.filter((_, i) => i !== idx), expenses: { ...appData.expenses } };
      if (cid && next.expenses[cid]) delete next.expenses[cid];
      _save(next);
      // Note: setCatIdx(...) and flash() are UI state — handled by useUIStore
    },

    reorderCategories: (from, to) => {
      const { appData, _save } = get();
      const next = { ...appData, categories: reorder(appData.categories, from, to) };
      _save(next);
      // Note: setCatIdx(...) calls are UI state — handled by useUIStore
    },

    updateCatColOrder: (catId, colOrder) => {
      const { appData, _save } = get();
      const next = { ...appData, categories: appData.categories.map(c => c.id === catId ? { ...c, colOrder } : c) };
      _save(next);
    },

    cleanCategoryUpdate: (idx, catData, removedSubIds) => {
      const { appData, _save } = get();
      const catId = appData.categories[idx].id;
      const nextExp = { ...appData.expenses };
      if (nextExp[catId]) {
        const cleanedEntries = {};
        Object.entries(nextExp[catId]).forEach(([key, entry]) => {
          if (!entry) return;
          const newSubAmounts = { ...(entry.subAmounts || {}) };
          const newSubPaid = { ...(entry.subPaid || {}) };
          removedSubIds.forEach(rid => { delete newSubAmounts[rid]; delete newSubPaid[rid]; });
          const newTotal = Object.values(newSubAmounts).reduce((s, v) => s + (v || 0), 0);
          const subIdsLeft = Object.keys(newSubAmounts).filter(id => (newSubAmounts[id] || 0) > 0);
          const allPaid = subIdsLeft.length > 0 && subIdsLeft.every(id => newSubPaid[id]?.paid);
          const paidDate = allPaid
            ? (Object.values(newSubPaid).filter(sp => sp?.paid && sp?.paidDate).map(sp => sp.paidDate).sort().pop() || '')
            : (entry.paid && !allPaid ? '' : entry.paidDate);
          cleanedEntries[key] = {
            ...entry,
            subAmounts: newSubAmounts,
            subPaid: newSubPaid,
            amount: newTotal,
            paid: allPaid,
            paidDate: allPaid ? paidDate : '',
          };
        });
        nextExp[catId] = cleanedEntries;
      }
      const nextCats = appData.categories.map((c, i) => i === idx ? { ...c, ...catData } : c);
      _save({ ...appData, categories: nextCats, expenses: nextExp });
    },

    // ── Loan actions ──
    addLoanType: (lt) => {
      const { appData, _save } = get();
      const next = { ...appData, loanTypes: [...(appData.loanTypes || []), { ...lt, id: uid() }] };
      _save(next);
      // Note: flash() is UI state — handled by useUIStore
    },

    updateLoanType: (ltId, data) => {
      const { appData, _save } = get();
      const next = { ...appData, loanTypes: (appData.loanTypes || []).map(lt => lt.id === ltId ? { ...lt, ...data } : lt) };
      _save(next);
      // Note: flash() is UI state — handled by useUIStore
    },

    deleteLoanType: (ltId) => {
      const { appData, _save } = get();
      const loanPaid = appData.loanPaid || {};
      const nextLP = { ...loanPaid };
      delete nextLP[ltId];
      const next = { ...appData, loanTypes: (appData.loanTypes || []).filter(lt => lt.id !== ltId), loanPaid: nextLP };
      _save(next);
      // Note: flash() is UI state — handled by useUIStore
    },

    toggleLoanPaid: (ltId, monthKey) => {
      const { appData, _save } = get();
      const loanPaid = appData.loanPaid || {};
      const nextLP = { ...loanPaid };
      if (!nextLP[ltId]) nextLP[ltId] = {};
      nextLP[ltId] = { ...nextLP[ltId] };
      const cur = nextLP[ltId][monthKey];
      if (cur?.paid) {
        delete nextLP[ltId][monthKey];
      } else {
        nextLP[ltId][monthKey] = { paid: true, paidDate: today() };
      }
      _save({ ...appData, loanPaid: nextLP });
    },

    setLoanPaidDate: (ltId, monthKey, date) => {
      const { appData, _save } = get();
      const loanPaid = appData.loanPaid || {};
      const nextLP = { ...loanPaid };
      if (!nextLP[ltId]) nextLP[ltId] = {};
      nextLP[ltId] = { ...nextLP[ltId] };
      nextLP[ltId][monthKey] = { ...nextLP[ltId][monthKey], paid: true, paidDate: date };
      _save({ ...appData, loanPaid: nextLP });
    },

    toggleAllLoansPaid: (ltIds, monthKey) => {
      const { appData, _save } = get();
      const loanPaid = appData.loanPaid || {};
      const nextLP = { ...loanPaid };
      const allPaid = ltIds.every(id => nextLP[id]?.[monthKey]?.paid);
      ltIds.forEach(id => {
        if (!nextLP[id]) nextLP[id] = {};
        nextLP[id] = { ...nextLP[id] };
        if (allPaid) delete nextLP[id][monthKey];
        else nextLP[id][monthKey] = { paid: true, paidDate: today() };
      });
      _save({ ...appData, loanPaid: nextLP });
    },

    // ── Fixed income actions ──
    addFixedIncome: (fi) => {
      const { appData, _save } = get();
      const next = { ...appData, fixedIncomes: [...(appData.fixedIncomes || []), { ...fi, id: uid() }] };
      _save(next);
    },

    updateFixedIncome: (idx, fi) => {
      const { appData, _save } = get();
      const next = { ...appData, fixedIncomes: (appData.fixedIncomes || []).map((s, i) => i === idx ? { ...s, ...fi } : s) };
      _save(next);
    },

    deleteFixedIncome: (idx) => {
      const { appData, _save } = get();
      const next = { ...appData, fixedIncomes: (appData.fixedIncomes || []).filter((_, i) => i !== idx) };
      _save(next);
    },

    // ── Variable income actions ──
    addVarIncome: (vi) => {
      const { appData, _save } = get();
      const next = { ...appData, variableIncomes: [...(appData.variableIncomes || []), { ...vi, id: uid() }] };
      _save(next);
    },

    updateVarIncome: (idx, vi) => {
      const { appData, _save } = get();
      const next = { ...appData, variableIncomes: (appData.variableIncomes || []).map((v, i) => i === idx ? { ...v, ...vi } : v) };
      _save(next);
    },

    deleteVarIncome: (idx) => {
      const { appData, _save } = get();
      const next = { ...appData, variableIncomes: (appData.variableIncomes || []).filter((_, i) => i !== idx) };
      _save(next);
    },

    bulkDelVarInc: (ids) => {
      // ids is a Set of IDs
      const { appData, _save } = get();
      const next = { ...appData, variableIncomes: (appData.variableIncomes || []).filter(v => !ids.has(v.id)) };
      _save(next);
    },

    // ── Selectors (read from state) ──
    getLoanAmountForMonth: (lt, monthKey) =>
      (lt.startFrom && lt.endAt && monthKey >= lt.startFrom && monthKey <= lt.endAt) ? (lt.amount || 0) : 0,

    getLoansTotalForMonth: (monthKey) => {
      const { appData, getLoanAmountForMonth } = get();
      const loanTypes = appData?.loanTypes || [];
      return loanTypes.reduce((s, lt) => s + getLoanAmountForMonth(lt, monthKey), 0);
    },

    getExp: (catId, key) => {
      const { appData, getLoansTotalForMonth } = get();
      if (catId === 'loans') {
        const total = getLoansTotalForMonth(key);
        return total > 0 ? { amount: total } : null;
      }
      return appData?.expenses?.[catId]?.[key] || null;
    },

    getFixedIncomeForMonth: (monthKey) => {
      const { appData } = get();
      const fixedIncomes = appData?.fixedIncomes || [];
      let total = 0;
      fixedIncomes.forEach(src => {
        let applicable = null;
        (src.records || []).forEach(r => {
          if (r.effectiveFrom <= monthKey && (!applicable || r.effectiveFrom > applicable.effectiveFrom)) applicable = r;
        });
        if (applicable) total += applicable.amount;
      });
      return total;
    },

    getVarIncomeForMonth: (monthKey) => {
      const { appData } = get();
      const variableIncomes = appData?.variableIncomes || [];
      return variableIncomes.filter(v => v.month === monthKey).reduce((s, v) => s + v.amount, 0);
    },

    getTotalExpensesForMonth: (monthKey) => {
      const { getPaidExpForMonth, getAnticipatedExpForMonth } = get();
      return getPaidExpForMonth(monthKey) + getAnticipatedExpForMonth(monthKey);
    },

    getPaidExpForMonth: (monthKey) => {
      const { appData, getLoanAmountForMonth } = get();
      const { categories, expenses, loanTypes = [], loanPaid = {} } = appData || {};
      let total = 0;
      (categories || []).forEach(c => {
        if (c.id === 'loans') {
          (loanTypes || []).forEach(lt => {
            Object.entries(loanPaid[lt.id] || {}).forEach(([entryKey, pd]) => {
              if (pd?.paid && pd.paidDate && pd.paidDate.slice(0, 7) === monthKey) {
                total += getLoanAmountForMonth(lt, entryKey);
              }
            });
          });
        } else {
          Object.entries(expenses?.[c.id] || {}).forEach(([, e]) => {
            if (e?.subPaid && Object.keys(e.subPaid).length > 0) {
              Object.entries(e.subPaid).forEach(([scId, sp]) => {
                if (sp?.paid && sp.paidDate && sp.paidDate.slice(0, 7) === monthKey) {
                  total += e.subAmounts?.[scId] || 0;
                }
              });
            } else if (e?.paid && e.paidDate && e.paidDate.slice(0, 7) === monthKey) {
              total += e.amount || 0;
            }
          });
        }
      });
      return total;
    },

    getAnticipatedExpForMonth: (monthKey) => {
      const { appData, getLoanAmountForMonth } = get();
      const { categories, expenses, loanTypes = [], loanPaid = {} } = appData || {};
      let total = 0;
      (categories || []).forEach(c => {
        if (c.id === 'loans') {
          (loanTypes || []).forEach(lt => {
            const amt = getLoanAmountForMonth(lt, monthKey);
            if (amt > 0 && !loanPaid[lt.id]?.[monthKey]?.paid) total += amt;
          });
        } else {
          const e = expenses?.[c.id]?.[monthKey];
          if (!e) return;
          if (e.subPaid && Object.keys(e.subPaid).length > 0) {
            Object.entries(e.subAmounts || {}).forEach(([scId, amt]) => {
              if (!e.subPaid[scId]?.paid) total += amt;
            });
          } else if (!e.paid) {
            total += e.amount || 0;
          }
        }
      });
      return total;
    },

    getCatPaidForMonth: (catId, monthKey) => {
      const { appData, getLoanAmountForMonth } = get();
      const { expenses, loanTypes = [], loanPaid = {} } = appData || {};
      if (catId === 'loans') {
        let total = 0;
        (loanTypes || []).forEach(lt => {
          Object.entries(loanPaid[lt.id] || {}).forEach(([entryKey, pd]) => {
            if (pd?.paid && pd.paidDate && pd.paidDate.slice(0, 7) === monthKey) {
              total += getLoanAmountForMonth(lt, entryKey);
            }
          });
        });
        return total;
      }
      let total = 0;
      Object.entries(expenses?.[catId] || {}).forEach(([, e]) => {
        if (e?.subPaid && Object.keys(e.subPaid).length > 0) {
          Object.entries(e.subPaid).forEach(([scId, sp]) => {
            if (sp?.paid && sp.paidDate && sp.paidDate.slice(0, 7) === monthKey) {
              total += e.subAmounts?.[scId] || 0;
            }
          });
        } else if (e?.paid && e.paidDate && e.paidDate.slice(0, 7) === monthKey) {
          total += e.amount || 0;
        }
      });
      return total;
    },

    getSuggestedDay: (catId) => {
      const { appData } = get();
      const expenses = appData?.expenses || {};
      const days = {};
      Object.entries(expenses?.[catId] || {}).forEach(([, e]) => {
        if (e?.subPaid && Object.keys(e.subPaid).length > 0) {
          Object.values(e.subPaid).forEach(sp => {
            if (sp?.paid && sp.paidDate) { const d = +sp.paidDate.split('-')[2]; days[d] = (days[d] || 0) + 1; }
          });
        } else if (e?.paid && e.paidDate) {
          const d = +e.paidDate.split('-')[2]; days[d] = (days[d] || 0) + 1;
        }
      });
      let best = 0, bestCount = 0;
      Object.entries(days).forEach(([d, c]) => { if (c > bestCount) { best = +d; bestCount = c; } });
      return bestCount >= 2 ? best : 0;
    },
  }))
);

export default useBudgetStore;
