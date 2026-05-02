import { useState } from 'react';
import DatePicker from '../DatePicker';
import { today, fmtDate, mk, parseMk, MONTHS, getCY, getCM, MIN_YEAR } from '../../utils/dates';
import { fmt } from '../../utils/formatters';
import S from '../../styles/shared';
import type { LoanType, LoanPaid } from '../../types';
import type { PaidPickerState } from '../../store/useUIStore';

interface LoansViewProps {
  loanTypes: LoanType[];
  getLoanAmountForMonth: (lt: LoanType, monthKey: string) => number;
  expYear: number;
  setExpYear: (y: number) => void;
  onAdd: (data: Omit<LoanType, 'id'>) => void;
  onUpdate: (ltId: string, data: Partial<LoanType>) => void;
  onDelete: (ltId: string) => void;
  loanPaid: LoanPaid;
  toggleLoanPaid: (ltId: string, monthKey: string) => void;
  setLoanPaidDate: (ltId: string, monthKey: string, date: string) => void;
  toggleAllLoansPaid: (ltIds: string[], monthKey: string) => void;
  paidPicker: PaidPickerState | null;
  setPaidPicker: (state: PaidPickerState | null) => void;
}

interface EditLoanState {
  isNew: boolean;
  id?: string;
  name: string;
  loanNumber: string;
  amount: string | number;
  startFrom: string;
  endAt: string;
}

export default function LoansView({ loanTypes, getLoanAmountForMonth, expYear, setExpYear, onAdd, onUpdate, onDelete, loanPaid, toggleLoanPaid, setLoanPaidDate, toggleAllLoansPaid, paidPicker, setPaidPicker }: LoansViewProps) {
  const [editLoan, setEditLoan] = useState<EditLoanState | null>(null);
  const catMaxYear = getCY() + 35;
  const years = Array.from({ length: getCY() - MIN_YEAR + 36 }, (_, i) => MIN_YEAR + i);

  const openNew = () => setEditLoan({ isNew: true, name: "", loanNumber: "", amount: "", startFrom: mk(getCY(), getCM()), endAt: mk(getCY() + 1, getCM()) });
  const openEdit = (lt: LoanType) => setEditLoan({ isNew: false, id: lt.id, name: lt.name, loanNumber: lt.loanNumber || "", amount: lt.amount ?? "", startFrom: lt.startFrom || mk(getCY(), getCM()), endAt: lt.endAt || mk(getCY() + 1, getCM()) });

  const handleSave = () => {
    if (!editLoan) return;
    if (!editLoan.name.trim() || editLoan.amount === "" || isNaN(+editLoan.amount)) return;
    if (editLoan.endAt < editLoan.startFrom) return;
    const data: Omit<LoanType, 'id'> = { name: editLoan.name.trim(), loanNumber: editLoan.loanNumber.trim(), amount: +editLoan.amount, startFrom: editLoan.startFrom, endAt: editLoan.endAt };
    if (editLoan.isNew) onAdd(data);
    else if (editLoan.id) onUpdate(editLoan.id, data);
    setEditLoan(null);
  };

  const setField = (key: keyof EditLoanState, val: string | number | boolean) => setEditLoan(prev => prev ? ({ ...prev, [key]: val }) : prev);

  const yearTotal = MONTHS.reduce((s, _, mi) => {
    const key = mk(expYear, mi);
    return s + loanTypes.reduce((ls, lt) => ls + getLoanAmountForMonth(lt, key), 0);
  }, 0);

  const fmtRange = (lt: LoanType) => {
    if (!lt.startFrom || !lt.endAt) return "No dates set";
    const s = parseMk(lt.startFrom);
    const e = parseMk(lt.endAt);
    return `${MONTHS[s.m]} ${s.y} → ${MONTHS[e.m]} ${e.y}`;
  };

  return (
    <div>
      <div style={S.yearNav}>
        <button onClick={() => expYear > MIN_YEAR && setExpYear(expYear - 1)} className="year-btn-h" style={{ ...S.yearBtn, opacity: expYear > MIN_YEAR ? 1 : .3 }}>◂</button>
        <span style={S.yearLabel}>{expYear}</span>
        <button onClick={() => expYear < catMaxYear - 1 && setExpYear(expYear + 1)} className="year-btn-h" style={{ ...S.yearBtn, opacity: expYear < catMaxYear - 1 ? 1 : .3 }}>▸</button>
        <span style={S.yearRange}>range: {MIN_YEAR} – {catMaxYear - 1}</span>
      </div>

      {/* Loan types cards */}
      <div style={{ background: "var(--card)", borderRadius: 14, border: "1.5px solid var(--border)", padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: .8 }}>Your Loans</span>
          <button onClick={openNew} className="btn-hover" style={{ ...S.btnPrimary, fontSize: 12, padding: "7px 14px" }}>+ Add Loan</button>
        </div>
        {loanTypes.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--faintest)", fontStyle: "italic", textAlign: "center", padding: "12px 0" }}>No loans added yet. Click "+ Add Loan" to get started.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {loanTypes.map((lt, li) => (
              <div key={lt.id} className="hov stagger-card" onClick={() => openEdit(lt)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, cursor: "pointer", border: "1px solid var(--border-light)", transition: "background .15s, border-color .2s, box-shadow .2s", animationDelay: `${li * 60}ms` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{lt.name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{fmtRange(lt)}{lt.loanNumber ? ` · #${lt.loanNumber}` : ""}</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--red)", fontFamily: "'Space Grotesk',sans-serif" }}>{fmt(lt.amount || 0)}<span style={{ fontSize: 11, fontWeight: 400, color: "var(--muted)", fontFamily: "'DM Sans',sans-serif" }}>/mo</span></div>
                <span onClick={e => { e.stopPropagation(); onDelete(lt.id); }} style={{ cursor: "pointer", opacity: .35, fontSize: 13, padding: 4 }} title="Delete">✕</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Monthly view */}
      {loanTypes.length > 0 && (
        <>
          <div style={{ ...S.listWrap, overflowX: "auto" }}>
            <div style={{ ...S.listHeader, minWidth: 80 + loanTypes.length * 120 + 90 + 170 }}>
              <span style={{ width: 80 }}>Month</span>
              {loanTypes.map(lt => (
                <span key={lt.id} style={{ width: 120, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lt.name}</span>
              ))}
              <span style={{ width: 90, textAlign: "right", fontWeight: 700 }}>Total</span>
              <span style={{ width: 170 }}>Paid</span>
            </div>
            {MONTHS.map((mName, mi) => {
              const key = mk(expYear, mi);
              const isPast = expYear < getCY() || (expYear === getCY() && mi < getCM());
              const isCurrent = expYear === getCY() && mi === getCM();
              const rowTotal = loanTypes.reduce((s, lt) => s + getLoanAmountForMonth(lt, key), 0);
              const activeLTs = loanTypes.filter(lt => getLoanAmountForMonth(lt, key) > 0);
              const paidCount = activeLTs.filter(lt => loanPaid[lt.id]?.[key]?.paid).length;
              const allPaid = activeLTs.length > 0 && paidCount === activeLTs.length;
              const anyPaidDate = activeLTs.map(lt => loanPaid[lt.id]?.[key]?.paidDate).find(d => d);
              return (
                <div key={mi} style={{ ...S.listRow, ...(isCurrent ? S.listRowCurrent : {}), ...(isPast ? { opacity: .5 } : {}), minWidth: 80 + loanTypes.length * 120 + 90 + 170 }}>
                  <span style={{ width: 80, fontWeight: 600, fontSize: 13, color: "var(--text2)", display: "flex", alignItems: "center", gap: 6 }}>
                    {mName}
                    {isCurrent && <span style={S.nowBadge}>now</span>}
                  </span>
                  {loanTypes.map(lt => {
                    const val = getLoanAmountForMonth(lt, key);
                    const isPd = loanPaid[lt.id]?.[key]?.paid;
                    return (
                      <span key={lt.id} style={{ width: 120, textAlign: "right", fontSize: 16, fontWeight: val ? 700 : 400, color: val ? (isPd ? "var(--accent)" : "var(--text)") : "var(--faint)", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                        {val ? fmt(val) : "—"}
                        {val > 0 && isPd && <span style={{ fontSize: 9, color: "var(--accent)" }}>✓</span>}
                      </span>
                    );
                  })}
                  <span style={{ width: 90, textAlign: "right", fontSize: 16, fontWeight: 700, color: rowTotal > 0 ? "var(--red)" : "var(--faint)" }}>
                    {rowTotal > 0 ? fmt(rowTotal) : "—"}
                  </span>
                  <span style={{ width: 170, display: "flex", alignItems: "center", gap: 6 }}>
                    {activeLTs.length > 0 ? (
                      paidPicker?.loanMonth === key ? (
                        <DatePicker value={anyPaidDate || today()} autoFocus compact
                          monthKey={key}
                          onChange={d => {
                            const ids = activeLTs.filter(lt => !loanPaid[lt.id]?.[key]?.paid).map(lt => lt.id);
                            if (ids.length) ids.forEach(id => setLoanPaidDate(id, key, d));
                            else activeLTs.forEach(lt => setLoanPaidDate(lt.id, key, d));
                            setPaidPicker(null);
                          }}
                          onBlur={() => setTimeout(() => setPaidPicker(null), 200)}
                          style={{ border: "1.5px solid var(--accent)", color: "var(--text)" }} />
                      ) : allPaid ? (
                        <>
                          <span onClick={() => toggleAllLoansPaid(activeLTs.map(lt => lt.id), key)}
                            style={{ width: 18, height: 18, borderRadius: 5, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                            <span style={{ color: "#fff", fontSize: 11, lineHeight: 1 }}>✓</span>
                          </span>
                          <span onClick={() => setPaidPicker({ loanMonth: key })}
                            style={{ fontSize: 11, color: "var(--accent)", fontWeight: 500, cursor: "pointer", borderBottom: "1px dashed var(--accent)" }}>
                            {fmtDate(anyPaidDate!)}
                          </span>
                        </>
                      ) : (
                        <span onClick={() => setPaidPicker({ loanMonth: key })} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                          <span style={{ width: 18, height: 18, borderRadius: 5, border: "1.5px solid var(--faint)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} />
                          {paidCount > 0 ? <span style={{ fontSize: 11, color: "var(--amber)" }}>{paidCount}/{activeLTs.length}</span> : <span style={{ fontSize: 11, color: "var(--faint)" }}>unpaid</span>}
                        </span>
                      )
                    ) : <span style={{ color: "var(--faint)", fontSize: 13 }}>—</span>}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={S.yearTotal}>
            <span style={{ color: "var(--muted)" }}>Total for {expYear}:</span>
            <span style={{ fontWeight: 600, fontSize: 18, color: "var(--text)" }}>{fmt(yearTotal)}</span>
          </div>
        </>
      )}

      {/* Add / Edit Loan Modal */}
      {editLoan && (
        <div onClick={() => setEditLoan(null)} className="overlay-mobile" style={S.overlay}>
          <div onClick={e => e.stopPropagation()} className="modal-mobile" style={{ animation: "slideUp .25s" }}>
            <div style={S.modalContent}>
              <h2 style={S.modalTitle}>{editLoan.isNew ? "Add" : "Edit"} Loan</h2>

              <label style={S.label}>Loan Name *</label>
              <input value={editLoan.name} onChange={e => setField("name", e.target.value)} placeholder="e.g. Car Loan" style={{ width: "100%", marginBottom: 14 }} autoFocus />

              <label style={S.label}>Loan Number</label>
              <input value={editLoan.loanNumber} onChange={e => setField("loanNumber", e.target.value)} placeholder="e.g. LN-2026-00421" style={{ width: "100%", marginBottom: 14 }} />

              <label style={S.label}>Monthly Amount *</label>
              <input type="number" value={editLoan.amount} onChange={e => setField("amount", e.target.value)} placeholder="0.00" style={{ width: "100%", marginBottom: 14 }} />

              <label style={S.label}>Start Date</label>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <select value={parseMk(editLoan.startFrom).m} onChange={e => setField("startFrom", mk(parseMk(editLoan.startFrom).y, +e.target.value))} style={{ flex: 1 }}>
                  {MONTHS.map((mn, mi) => <option key={mi} value={mi}>{mn}</option>)}
                </select>
                <select value={parseMk(editLoan.startFrom).y} onChange={e => setField("startFrom", mk(+e.target.value, parseMk(editLoan.startFrom).m))} style={{ flex: 1 }}>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              <label style={S.label}>End Date</label>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <select value={parseMk(editLoan.endAt).m} onChange={e => setField("endAt", mk(parseMk(editLoan.endAt).y, +e.target.value))} style={{ flex: 1 }}>
                  {MONTHS.map((mn, mi) => <option key={mi} value={mi}>{mn}</option>)}
                </select>
                <select value={parseMk(editLoan.endAt).y} onChange={e => setField("endAt", mk(+e.target.value, parseMk(editLoan.endAt).m))} style={{ flex: 1 }}>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              {editLoan.endAt < editLoan.startFrom && (
                <p style={{ fontSize: 12, color: "var(--red)", marginBottom: 10 }}>End date must be after start date.</p>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => setEditLoan(null)} style={S.btnGhostModal}>Cancel</button>
                <button onClick={handleSave} className="btn-hover" style={{ ...S.btnPrimary, flex: 1 }}>Save</button>
              </div>
              {!editLoan.isNew && (
                <button onClick={() => { if (editLoan.id) onDelete(editLoan.id); setEditLoan(null); }} style={S.deleteLink}>Delete this loan</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
