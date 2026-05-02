import { useState } from 'react';
import { MONTHS, getCY, getCM, mk, parseMk, MIN_YEAR } from '../../utils/dates';
import S from '../../styles/shared';
import type { FixedIncome, IncomeRecord } from '../../types';

interface FixedIncomeModalProps {
  src: FixedIncome | null | undefined;
  onSave: (src: Omit<FixedIncome, 'id'>) => void;
  onClose: () => void;
}

interface RecordDraft {
  amount: string | number;
  effectiveFrom: string;
}

export default function FixedIncomeModal({ src, onSave, onClose }: FixedIncomeModalProps) {
  const [name, setName] = useState(src?.name || "");
  const [records, setRecords] = useState<RecordDraft[]>(
    src?.records ? src.records.map(r => ({ ...r })) : [{ amount: "", effectiveFrom: mk(getCY(), getCM()) }]
  );
  const addRecord = () => setRecords(p => [...p, { amount: "", effectiveFrom: mk(getCY(), getCM()) }]);
  const updateRec = (i: number, key: keyof RecordDraft, val: string | number) => setRecords(p => p.map((r, ri) => ri === i ? { ...r, [key]: val } : r));
  const removeRec = (i: number) => setRecords(p => p.filter((_, ri) => ri !== i));
  const years = Array.from({ length: getCY() - MIN_YEAR + 11 }, (_, i) => MIN_YEAR + i);

  const handleSave = () => {
    if (!name.trim()) return;
    const clean: IncomeRecord[] = records
      .filter(r => r.amount !== "" && !isNaN(+r.amount))
      .map(r => ({ ...r, amount: +r.amount }));
    if (clean.length === 0) return;
    onSave({ name: name.trim(), records: clean });
  };

  return (
    <div style={S.modalContent}>
      <h2 style={S.modalTitle}>{src ? "Edit" : "Add"} Fixed Income</h2>
      <label style={S.label}>Income Source Name *</label>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Salary" style={{ width: "100%", marginBottom: 16 }} autoFocus />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <label style={{ ...S.label, marginBottom: 0 }}>Amount Records</label>
        <button onClick={addRecord} style={{ ...S.btnSmall, fontSize: 12 }}>+ Add Change</button>
      </div>
      <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>Add multiple records to schedule raises. Each takes effect from the month you choose.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {records.map((r, i) => {
          const { y, m } = parseMk(r.effectiveFrom);
          return (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", background: "var(--chip2)", padding: 10, borderRadius: 10, flexWrap: "wrap" }}>
              <input type="number" value={r.amount} onChange={e => updateRec(i, "amount", e.target.value)} placeholder="Amount" style={{ flex: 1, minWidth: 80 }} />
              <span style={{ fontSize: 12, color: "var(--muted)" }}>from</span>
              <select value={m} onChange={e => updateRec(i, "effectiveFrom", mk(y, +e.target.value))} style={{ width: 75 }}>
                {MONTHS.map((mn, mi) => <option key={mi} value={mi}>{mn}</option>)}
              </select>
              <select value={y} onChange={e => updateRec(i, "effectiveFrom", mk(+e.target.value, m))} style={{ width: 75 }}>
                {years.map(yr => <option key={yr} value={yr}>{yr}</option>)}
              </select>
              {records.length > 1 && <button onClick={() => removeRec(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)" }}>✕</button>}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <button onClick={onClose} style={S.btnGhostModal}>Cancel</button>
        <button onClick={handleSave} className="btn-hover" style={{ ...S.btnPrimary, flex: 1 }}>Save</button>
      </div>
    </div>
  );
}
