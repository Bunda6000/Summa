import { useState } from 'react';
import { MONTHS, getCY, getCM, mk, parseMk, MIN_YEAR } from '../../utils/dates';
import styles from './VarIncomeModal.module.css';
import type { VariableIncome } from '../../types';

interface VarIncomeModalProps {
  item: VariableIncome | null | undefined;
  onSave: (item: Omit<VariableIncome, 'id'>) => void;
  onClose: () => void;
}

export default function VarIncomeModal({ item, onSave, onClose }: VarIncomeModalProps) {
  const [name, setName] = useState(item?.name || "");
  const [amount, setAmount] = useState<string | number>(item?.amount ?? "");
  const defMonth = item?.month || mk(getCY(), getCM());
  const { y: iy, m: im } = parseMk(defMonth);
  const [month, setMonth] = useState(im);
  const [year, setYear] = useState(iy);
  const years = Array.from({ length: getCY() - MIN_YEAR + 6 }, (_, i) => MIN_YEAR + i);

  return (
    <div className={styles.modalContent}>
      <h2 className={styles.modalTitle}>{item ? "Edit" : "Add"} Variable Income</h2>
      <label className={styles.label}>Description *</label>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Freelance project" style={{ width: "100%", marginBottom: 14 }} autoFocus />
      <label className={styles.label}>Amount *</label>
      <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" style={{ width: "100%", marginBottom: 14 }} />
      <label className={styles.label}>For Month</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <select value={month} onChange={e => setMonth(+e.target.value)} style={{ flex: 1 }}>
          {MONTHS.map((mn, mi) => <option key={mi} value={mi}>{mn}</option>)}
        </select>
        <select value={year} onChange={e => setYear(+e.target.value)} style={{ flex: 1 }}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button onClick={onClose} className={styles.btnGhostModal}>Cancel</button>
        <button onClick={() => {
          if (!name.trim() || amount === "" || isNaN(+amount)) return;
          onSave({ name: name.trim(), amount: +amount, month: mk(year, month) });
        }} className={`btn-hover ${styles.btnPrimary}`} style={{ flex: 1 }}>Save</button>
      </div>
    </div>
  );
}
