import { useState } from 'react';
import { uid } from '../../utils/dates';
import { reorder } from '../../utils/expressions';
import S from '../../styles/shared';

export default function CategoryFormModal({ editing, category, onSave, onClose }) {
  const isNew = editing === -1;
  const [form, setForm] = useState(() => {
    if (isNew) return { name: "", maxYears: 5, fields: [], subcategories: [] };
    return { ...category, fields: category.fields.map(f=>({...f, options: f.options ? [...f.options] : undefined})), subcategories: category.subcategories ? category.subcategories.map(s=>({...s})) : [] };
  });

  const addField = () => setForm(p => ({ ...p, fields: [...p.fields, { id: uid(), name: "", type: "text", options: undefined }] }));
  const removeField = (fid) => setForm(p => ({ ...p, fields: p.fields.filter(f => f.id !== fid) }));
  const updateField = (fid, key, val) => setForm(p => ({ ...p, fields: p.fields.map(f => {
    if (f.id !== fid) return f;
    const updated = { ...f, [key]: val };
    if (key === "type" && val === "select" && !updated.options) updated.options = [""];
    if (key === "type" && val !== "select") updated.options = undefined;
    return updated;
  })}));

  const addSub = () => setForm(p => ({...p, subcategories: [...p.subcategories, {id: uid(), name: ""}]}));
  const removeSub = (sid) => setForm(p => ({...p, subcategories: p.subcategories.filter(s => s.id !== sid)}));
  const renameSub = (sid, name) => setForm(p => ({...p, subcategories: p.subcategories.map(s => s.id === sid ? {...s, name} : s)}));
  const [subDrag, setSubDrag] = useState(null);
  const reorderSubs = (from, to) => setForm(p => ({...p, subcategories: reorder(p.subcategories, from, to)}));

  const handleSave = () => {
    if (!form.name.trim()) return;
    const clean = { ...form,
      fields: form.fields.filter(f => f.name.trim()).map(f => {
        if (f.type === "select") return { ...f, options: (f.options||[]).filter(o => o.trim()) };
        const { options, ...rest } = f;
        return rest;
      }),
      subcategories: form.subcategories.filter(s => s.name.trim())
    };
    onSave(clean);
  };

  return (
    <div style={S.modalContent}>
      <h2 style={S.modalTitle}>{isNew ? "New Category" : "Edit Category"}</h2>
      <label style={S.label}>Category Name *</label>
      <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} style={{width:"100%",marginBottom:14}} autoFocus />
      <label style={S.label}>Max Years in Advance</label>
      <select value={form.maxYears} onChange={e=>setForm(p=>({...p,maxYears:+e.target.value}))} style={{width:"100%",marginBottom:18}}>
        {[1,2,3,4,5,10,15,20,25,30,35].map(n=><option key={n} value={n}>{n} year{n>1?"s":""}</option>)}
      </select>
      <div style={{marginBottom:8,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <label style={{...S.label,marginBottom:0}}>Custom Fields</label>
        <button onClick={addField} style={{...S.btnSmall,fontSize:12}}>+ Field</button>
      </div>
      <div style={{background:"var(--chip2)",borderRadius:10,padding:12,marginBottom:6}}>
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",opacity:.5}}>
          <span style={{flex:2,fontSize:12}}>Amount (default — cannot remove)</span>
          <span style={{flex:1,fontSize:12}}>number</span><span style={{width:28}}></span>
        </div>
        {form.fields.map(f => (
          <div key={f.id} style={{padding:"8px 0",borderTop:"1px solid var(--border)"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input value={f.name} onChange={e=>updateField(f.id,"name",e.target.value)} placeholder="Field name" style={{flex:2,fontSize:13,padding:"6px 10px"}} />
              <select value={f.type} onChange={e=>updateField(f.id,"type",e.target.value)} style={{flex:1,fontSize:13,padding:"6px 8px"}}>
                <option value="text">text</option><option value="number">number</option><option value="select">select</option>
              </select>
              <button onClick={()=>removeField(f.id)} style={{width:28,background:"none",border:"none",cursor:"pointer",color:"var(--red)",fontSize:14}}>✕</button>
            </div>
            {f.type === "select" && (
              <div style={{marginTop:6,marginLeft:4,paddingLeft:10,borderLeft:"2px solid var(--border)"}}>
                <span style={{fontSize:11,color:"var(--muted)",fontWeight:600}}>OPTIONS</span>
                {(f.options||[]).map((opt,oi) => (
                  <div key={oi} style={{display:"flex",gap:6,alignItems:"center",marginTop:4}}>
                    <input value={opt} onChange={e=>{
                      const newOpts = [...(f.options||[])];
                      newOpts[oi] = e.target.value;
                      updateField(f.id,"options",newOpts);
                    }} placeholder={`Option ${oi+1}`} style={{flex:1,fontSize:12,padding:"5px 8px"}} />
                    <button onClick={()=>updateField(f.id,"options",(f.options||[]).filter((_,i)=>i!==oi))}
                      style={{background:"none",border:"none",cursor:"pointer",color:"var(--red)",fontSize:12}}>✕</button>
                  </div>
                ))}
                <button onClick={()=>updateField(f.id,"options",[...(f.options||[]),""])}
                  style={{...S.btnSmall,fontSize:11,marginTop:6,padding:"3px 8px"}}>+ Option</button>
              </div>
            )}
          </div>
        ))}
        {form.fields.length === 0 && <p style={{fontSize:12,color:"var(--faintest)",paddingTop:4}}>No custom fields. Amount only.</p>}
      </div>

      {/* Subcategories */}
      <div style={{marginBottom:8,marginTop:14,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <label style={{...S.label,marginBottom:0}}>Subcategories</label>
        <button onClick={addSub} style={{...S.btnSmall,fontSize:12}}>+ Subcategory</button>
      </div>
      <div style={{background:"var(--chip2)",borderRadius:10,padding:12,marginBottom:6}}>
        {form.subcategories.map((s, si) => (
          <div key={s.id} draggable
            onDragStart={e=>{setSubDrag(si);e.dataTransfer.effectAllowed="move";e.currentTarget.classList.add("dragging");}}
            onDragEnd={e=>{setSubDrag(null);e.currentTarget.classList.remove("dragging");}}
            onDragOver={e=>{e.preventDefault();e.currentTarget.classList.add("drag-over");}}
            onDragLeave={e=>e.currentTarget.classList.remove("drag-over")}
            onDrop={e=>{e.preventDefault();e.currentTarget.classList.remove("drag-over");if(subDrag!==null&&subDrag!==si)reorderSubs(subDrag,si);setSubDrag(null);}}
            style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid var(--border)"}}>
            <span style={{fontSize:11,color:"var(--faint)",cursor:"grab"}}>⠿</span>
            <input value={s.name} onChange={e=>renameSub(s.id,e.target.value)} placeholder="Subcategory name"
              style={{flex:1,fontSize:13,padding:"6px 10px"}} />
            <button onClick={()=>removeSub(s.id)} style={{width:28,background:"none",border:"none",cursor:"pointer",color:"var(--red)",fontSize:14}}>✕</button>
          </div>
        ))}
        {form.subcategories.length === 0 && <p style={{fontSize:12,color:"var(--faintest)",paddingTop:4}}>No subcategories. Amount entered as a single value.</p>}
      </div>

      <div style={{display:"flex",gap:8,marginTop:18}}>
        <button onClick={onClose} style={S.btnGhostModal}>Cancel</button>
        <button onClick={handleSave} className="btn-hover" style={{...S.btnPrimary,flex:1}}>{isNew ? "Create Category" : "Save Changes"}</button>
      </div>
    </div>
  );
}
