import { useState } from 'react';
import DatePicker from '../DatePicker';
import { today, fmtDate, parseMk } from '../../utils/dates';
import { fmt } from '../../utils/formatters';
import { evalExpr, reorder } from '../../utils/expressions';
import S from '../../styles/shared';

export default function ExpenseModal({ catObj, monthKey, monthLabel, entry, catMaxYear, suggestedDay, onSave, onDelete, onReorderSubs, onClose }) {
  const [subOrder, setSubOrder] = useState(catObj.subcategories || []);
  const hasSubs = subOrder.length > 0;
  const [amount, setAmount] = useState(entry?.amount ?? "");
  const [subAmounts, setSubAmounts] = useState(entry?.subAmounts || {});
  const [subPaid, setSubPaid] = useState(entry?.subPaid || {});
  const [fields, setFields] = useState(entry?.fields || {});
  const [extras, setExtras] = useState(entry?.extras || []);
  const [paid, setPaid] = useState(entry?.paid || false);
  const [paidDate, setPaidDate] = useState(entry?.paidDate || "");
  const [applyEnabled, setApplyEnabled] = useState(false);
  const [applyCount, setApplyCount] = useState(1);
  const [applyUnit, setApplyUnit] = useState("months");
  const [subDragIdx, setSubDragIdx] = useState(null);
  const setField = (fid, val) => setFields(prev => ({ ...prev, [fid]: val }));
  const setSubAmt = (sid, val) => setSubAmounts(prev => ({ ...prev, [sid]: val }));
  const toggleSubPaid = (sid, checked) => {
    setSubPaid(prev => ({ ...prev, [sid]: { paid: checked, paidDate: checked ? (prev[sid]?.paidDate || today()) : "" } }));
  };
  const setSubPaidDate = (sid, date) => {
    setSubPaid(prev => ({ ...prev, [sid]: { ...prev[sid], paid: true, paidDate: date } }));
  };

  const handleSubReorder = (from, to) => {
    const newOrder = reorder(subOrder, from, to);
    setSubOrder(newOrder);
    if (onReorderSubs) onReorderSubs(newOrder);
  };

  const addExtra = () => setExtras(prev => [...prev, { name: "", value: "" }]);
  const updateExtra = (i, key, val) => setExtras(prev => prev.map((e, ei) => ei === i ? { ...e, [key]: val } : e));
  const removeExtra = (i) => setExtras(prev => prev.filter((_, ei) => ei !== i));

  const computedTotal = hasSubs
    ? subOrder.reduce((s, sc) => s + (evalExpr(subAmounts[sc.id]) || 0), 0)
    : evalExpr(amount) || 0;

  /* Derive overall paid status from subcategories */
  const allSubsPaid = hasSubs && subOrder.every(sc => subPaid[sc.id]?.paid && (evalExpr(subAmounts[sc.id]) || 0) > 0);
  const someSubsPaid = hasSubs && subOrder.some(sc => subPaid[sc.id]?.paid);
  const paidSubTotal = hasSubs ? subOrder.reduce((s, sc) => s + (subPaid[sc.id]?.paid ? (evalExpr(subAmounts[sc.id]) || 0) : 0), 0) : 0;

  const handleSave = () => {
    if (hasSubs) {
      if (computedTotal <= 0) return;
      const cleanSub = {};
      subOrder.forEach(sc => { const v = evalExpr(subAmounts[sc.id]); if (v > 0) cleanSub[sc.id] = v; });
      const cleanSubPaid = {};
      subOrder.forEach(sc => { if (subPaid[sc.id]?.paid) cleanSubPaid[sc.id] = { paid: true, paidDate: subPaid[sc.id].paidDate || today() }; });
      const derivedPaid = allSubsPaid;
      const derivedDate = derivedPaid ? Object.values(cleanSubPaid).reduce((latest, sp) => sp.paidDate > latest ? sp.paidDate : latest, "") : "";
      const applyMonths = applyEnabled ? (applyUnit === "years" ? applyCount * 12 : applyCount) : 0;
      const cleanExtras = extras.filter(e => e.name.trim() || e.value.trim());
      onSave({ amount: computedTotal, subAmounts: cleanSub, subPaid: cleanSubPaid, fields, extras: cleanExtras, paid: derivedPaid, paidDate: derivedDate }, applyMonths);
    } else {
      const a = evalExpr(amount);
      if (isNaN(a) || a < 0) return;
      const applyMonths = applyEnabled ? (applyUnit === "years" ? applyCount * 12 : applyCount) : 0;
      const cleanExtras = extras.filter(e => e.name.trim() || e.value.trim());
      onSave({ amount: a, subAmounts: {}, subPaid: {}, fields, extras: cleanExtras, paid, paidDate: paid ? (paidDate || today()) : "" }, applyMonths);
    }
  };

  const {y,m} = parseMk(monthKey);
  let maxMonths = 0;
  let cy = y, cm = m + 1;
  while (true) {
    if (cm > 11) { cm = 0; cy++; }
    if (cy >= catMaxYear) break;
    maxMonths++; cm++;
  }

  const appliedMonths = applyUnit === "years" ? applyCount * 12 : applyCount;
  const overMax = appliedMonths > maxMonths;

  return (
    <div style={S.modalContent}>
      <h2 style={S.modalTitle}>{entry ? "Edit" : "Add"} Expense</h2>
      <p style={{color:"var(--muted)",fontSize:13,marginBottom:20}}>{catObj.name} — {monthLabel}</p>

      {hasSubs ? (
        <div style={{marginBottom:14}}>
          <label style={S.label}>Subcategories</label>
          <div style={{background:"var(--chip2)",borderRadius:10,padding:12}}>
            {subOrder.map((sc, si) => {
              const sp = subPaid[sc.id];
              const hasAmt = (evalExpr(subAmounts[sc.id]) || 0) > 0;
              return (
                <div key={sc.id} draggable
                  onDragStart={e=>{setSubDragIdx(si);e.dataTransfer.effectAllowed="move";e.currentTarget.classList.add("dragging");}}
                  onDragEnd={e=>{setSubDragIdx(null);e.currentTarget.classList.remove("dragging");}}
                  onDragOver={e=>{e.preventDefault();e.currentTarget.classList.add("drag-over");}}
                  onDragLeave={e=>e.currentTarget.classList.remove("drag-over")}
                  onDrop={e=>{e.preventDefault();e.currentTarget.classList.remove("drag-over");if(subDragIdx!==null&&subDragIdx!==si)handleSubReorder(subDragIdx,si);setSubDragIdx(null);}}
                  style={{display:"grid",gridTemplateColumns:"16px 1fr 90px 70px 90px",alignItems:"center",gap:8,paddingBottom:8,marginBottom:8,borderBottom:"1px solid var(--border)"}}>
                  <span style={{fontSize:11,color:"var(--faint)",cursor:"grab"}}>⠿</span>
                  <span style={{fontSize:13,fontWeight:500,color:"var(--text2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sc.name}</span>
                  <input type="text" inputMode="decimal" value={subAmounts[sc.id]??""} onChange={e=>setSubAmt(sc.id,e.target.value)}
                    onBlur={e=>{const v=evalExpr(e.target.value);if(!isNaN(v)&&v>=0)setSubAmt(sc.id,v);}}
                    onKeyDown={e=>{if(e.key==="Enter"){const v=evalExpr(e.target.value);if(!isNaN(v)&&v>=0)setSubAmt(sc.id,v);}}}
                    placeholder="0.00" style={{width:"100%",textAlign:"right",fontSize:13}} />
                  <label style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:hasAmt?(sp?.paid?"var(--accent)":"var(--faint)"):"transparent",cursor:hasAmt?"pointer":"default",whiteSpace:"nowrap",justifySelf:"center"}}>
                    {hasAmt && <input type="checkbox" checked={sp?.paid||false} onChange={e=>toggleSubPaid(sc.id,e.target.checked)}
                      style={{accentColor:"var(--accent)"}} />}
                    {hasAmt && (sp?.paid ? "Paid" : "Unpaid")}
                  </label>
                  <div>
                    {hasAmt && sp?.paid ? (
                      <DatePicker value={sp.paidDate||today()} onChange={d=>setSubPaidDate(sc.id,d)}
                        compact monthKey={monthKey} suggestedDay={suggestedDay}
                        style={{border:"1px solid var(--border-input)",fontSize:11,padding:"3px 6px",width:"100%"}} />
                    ) : null}
                  </div>
                </div>
              );
            })}
            <div style={{display:"grid",gridTemplateColumns:"16px 1fr 90px 70px 90px",alignItems:"center",gap:8,paddingTop:6}}>
              <span />
              <span style={{fontSize:13,fontWeight:700,color:"var(--text)"}}>Total</span>
              <span style={{textAlign:"right",fontSize:18,fontWeight:700,color:"var(--text)"}}>{fmt(computedTotal)}</span>
              <span />
              <span />
            </div>
            {computedTotal > 0 && (
              <div style={{fontSize:11,color:allSubsPaid?"var(--accent)":"var(--muted)",marginTop:4,marginLeft:24}}>
                {allSubsPaid ? "✓ All paid" : `${fmt(paidSubTotal)} of ${fmt(computedTotal)} paid`}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <label style={S.label}>Amount *</label>
          <input type="text" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}
            onBlur={e=>{const v=evalExpr(e.target.value);if(!isNaN(v)&&v>=0)setAmount(v);}}
            onKeyDown={e=>{if(e.key==="Enter"){const v=evalExpr(e.target.value);if(!isNaN(v)&&v>=0)setAmount(v);}}}
            placeholder="0.00" style={{width:"100%",marginBottom:14}} autoFocus />
        </>
      )}
      {catObj.fields.map(f => (
        <div key={f.id} style={{marginBottom:14}}>
          <label style={S.label}>{f.name}</label>
          {f.type === "select" ? (
            <select value={fields[f.id]||""} onChange={e=>setField(f.id,e.target.value)} style={{width:"100%"}}>
              <option value="">— Select —</option>
              {(f.options||[]).map(o=><option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input type={f.type==="number"?"number":"text"} value={fields[f.id]||""} onChange={e=>setField(f.id,e.target.value)} style={{width:"100%"}} />
          )}
        </div>
      ))}

      {/* Extra fields */}
      <div style={{marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
          <label style={{...S.label,marginBottom:0}}>Additional Info</label>
          <button onClick={addExtra} style={{...S.btnSmall,fontSize:11,padding:"3px 8px"}}>+ Add Field</button>
        </div>
        {extras.length === 0 && (
          <p style={{fontSize:12,color:"var(--faintest)",fontStyle:"italic"}}>None. Add fields like Invoice, Note, Reference, etc.</p>
        )}
        {extras.map((ex, i) => (
          <div key={i} style={{display:"flex",gap:6,alignItems:"center",marginBottom:6}}>
            <input value={ex.name} onChange={e=>updateExtra(i,"name",e.target.value)} placeholder="Name (e.g. Invoice)"
              style={{width:120,fontSize:13,padding:"7px 10px"}} />
            <input value={ex.value} onChange={e=>updateExtra(i,"value",e.target.value)} placeholder="Value (e.g. INV-0042)"
              style={{flex:1,fontSize:13,padding:"7px 10px"}} />
            <button onClick={()=>removeExtra(i)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--red)",fontSize:13}}>✕</button>
          </div>
        ))}
      </div>

      {/* Payment status — only for categories without subcategories */}
      {!hasSubs && (
        <div style={{marginBottom:14}}>
          <label style={S.checkLabel}>
            <input type="checkbox" checked={paid} onChange={e=>{setPaid(e.target.checked); if(e.target.checked && !paidDate) setPaidDate(today());}} style={{marginRight:8,accentColor:"var(--accent)"}} />
            Marked as paid
          </label>
          {paid && (
            <div style={{marginTop:8,padding:"0 4px"}}>
              <label style={S.label}>Payment Date</label>
              <DatePicker value={paidDate} onChange={d=>setPaidDate(d)}
                monthKey={monthKey} suggestedDay={suggestedDay}
                style={{width:"100%",border:"1.5px solid var(--border-input)",fontSize:14,padding:"9px 12px",textAlign:"left"}} />
            </div>
          )}
        </div>
      )}

      {maxMonths > 0 && (
        <div style={{marginTop:4}}>
          <label style={S.checkLabel}>
            <input type="checkbox" checked={applyEnabled} onChange={e=>setApplyEnabled(e.target.checked)} style={{marginRight:8,accentColor:"var(--accent)"}} />
            Also apply to the next...
          </label>
          {applyEnabled && (
            <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8,padding:"0 4px"}}>
              <input type="number" min={1} value={applyCount} onChange={e=>setApplyCount(Math.max(1,+e.target.value||1))}
                style={{width:70,textAlign:"center"}} />
              <select value={applyUnit} onChange={e=>setApplyUnit(e.target.value)} style={{width:100}}>
                <option value="months">month{applyCount!==1?"s":""}</option>
                <option value="years">year{applyCount!==1?"s":""}</option>
              </select>
              <span style={{fontSize:12,color:"var(--muted)"}}>({Math.min(appliedMonths,maxMonths)} month{Math.min(appliedMonths,maxMonths)!==1?"s":""})</span>
            </div>
          )}
          {applyEnabled && overMax && (
            <p style={{fontSize:11,color:"var(--red)",marginTop:6,padding:"0 4px"}}>
              Capped to {maxMonths} months (category limit: {catMaxYear - 1})
            </p>
          )}
        </div>
      )}
      <div style={{display:"flex",gap:8,marginTop:20}}>
        <button onClick={onClose} style={S.btnGhostModal}>Cancel</button>
        <button onClick={handleSave} className="btn-hover" style={{...S.btnPrimary,flex:1}}>Save</button>
      </div>
      {entry && <button onClick={onDelete} style={S.deleteLink}>Delete this entry</button>}
    </div>
  );
}
