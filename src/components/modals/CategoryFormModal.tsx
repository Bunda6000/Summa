import { useState } from 'react';
import { uid } from '../../utils/dates';
import { reorder } from '../../utils/expressions';
import styles from './CategoryFormModal.module.css';
import type { Category, CategoryField, Subcategory } from '../../types';

interface CategoryFormModalProps {
  editing: number;
  category: Category | null | undefined;
  onSave: (catData: Omit<Category, 'id'> & { id?: string }) => void;
  onClose: () => void;
}

interface FormState {
  name: string;
  maxYears: number;
  fields: CategoryField[];
  subcategories: Subcategory[];
  id?: string;
  protected?: boolean;
  colOrder: string[];
}

export default function CategoryFormModal({ editing, category, onSave, onClose }: CategoryFormModalProps) {
  const isNew = editing === -1;
  const [form, setForm] = useState<FormState>(() => {
    if (isNew) return { name: "", maxYears: 5, fields: [], subcategories: [], colOrder: [] };
    return {
      ...category!,
      fields: category!.fields.map(f => ({ ...f, options: f.options ? [...f.options] : undefined })),
      subcategories: category!.subcategories ? category!.subcategories.map(s => ({ ...s })) : [],
      colOrder: category!.colOrder || [],
    };
  });

  const addField = () => setForm(p => ({ ...p, fields: [...p.fields, { id: uid(), name: "", type: "text" as const, options: undefined }] }));
  const removeField = (fid: string) => setForm(p => ({ ...p, fields: p.fields.filter(f => f.id !== fid) }));
  const updateField = (fid: string, key: string, val: unknown) => setForm(p => ({
    ...p, fields: p.fields.map(f => {
      if (f.id !== fid) return f;
      const updated = { ...f, [key]: val };
      if (key === "type" && val === "select" && !updated.options) updated.options = [""];
      if (key === "type" && val !== "select") updated.options = undefined;
      return updated;
    })
  }));

  const addSub = () => setForm(p => ({ ...p, subcategories: [...p.subcategories, { id: uid(), name: "" }] }));
  const removeSub = (sid: string) => setForm(p => ({ ...p, subcategories: p.subcategories.filter(s => s.id !== sid) }));
  const renameSub = (sid: string, name: string) => setForm(p => ({ ...p, subcategories: p.subcategories.map(s => s.id === sid ? { ...s, name } : s) }));
  const [subDrag, setSubDrag] = useState<number | null>(null);
  const reorderSubs = (from: number, to: number) => setForm(p => ({ ...p, subcategories: reorder(p.subcategories, from, to) }));

  const handleSave = () => {
    if (!form.name.trim()) return;
    const clean = {
      ...form,
      fields: form.fields.filter(f => f.name.trim()).map(f => {
        if (f.type === "select") return { ...f, options: (f.options || []).filter(o => o.trim()) };
        const { options, ...rest } = f;
        return rest;
      }),
      subcategories: form.subcategories.filter(s => s.name.trim())
    };
    onSave(clean);
  };

  return (
    <div className={styles.modalContent}>
      <h2 className={styles.modalTitle}>{isNew ? "New Category" : "Edit Category"}</h2>
      <label className={styles.label}>Category Name *</label>
      <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={{ width: "100%", marginBottom: 14 }} autoFocus />
      <label className={styles.label}>Max Years in Advance</label>
      <select value={form.maxYears} onChange={e => setForm(p => ({ ...p, maxYears: +e.target.value }))} style={{ width: "100%", marginBottom: 18 }}>
        {[1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 35].map(n => <option key={n} value={n}>{n} year{n > 1 ? "s" : ""}</option>)}
      </select>
      <div style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <label className={styles.label} style={{ marginBottom: 0 }}>Custom Fields</label>
        <button onClick={addField} className={styles.btnSmall} style={{ fontSize: 12 }}>+ Field</button>
      </div>
      <div style={{ background: "var(--chip2)", borderRadius: 10, padding: 12, marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", opacity: .5 }}>
          <span style={{ flex: 2, fontSize: 12 }}>Amount (default — cannot remove)</span>
          <span style={{ flex: 1, fontSize: 12 }}>number</span><span style={{ width: 28 }}></span>
        </div>
        {form.fields.map(f => (
          <div key={f.id} style={{ padding: "8px 0", borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input value={f.name} onChange={e => updateField(f.id, "name", e.target.value)} placeholder="Field name" style={{ flex: 2, fontSize: 13, padding: "6px 10px" }} />
              <select value={f.type} onChange={e => updateField(f.id, "type", e.target.value)} style={{ flex: 1, fontSize: 13, padding: "6px 8px" }}>
                <option value="text">text</option><option value="number">number</option><option value="select">select</option>
              </select>
              <button onClick={() => removeField(f.id)} style={{ width: 28, background: "none", border: "none", cursor: "pointer", color: "var(--red)", fontSize: 14 }}>✕</button>
            </div>
            {f.type === "select" && (
              <div style={{ marginTop: 6, marginLeft: 4, paddingLeft: 10, borderLeft: "2px solid var(--border)" }}>
                <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>OPTIONS</span>
                {(f.options || []).map((opt, oi) => (
                  <div key={oi} style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                    <input value={opt} onChange={e => {
                      const newOpts = [...(f.options || [])];
                      newOpts[oi] = e.target.value;
                      updateField(f.id, "options", newOpts);
                    }} placeholder={`Option ${oi + 1}`} style={{ flex: 1, fontSize: 12, padding: "5px 8px" }} />
                    <button onClick={() => updateField(f.id, "options", (f.options || []).filter((_, i) => i !== oi))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", fontSize: 12 }}>✕</button>
                  </div>
                ))}
                <button onClick={() => updateField(f.id, "options", [...(f.options || []), ""])}
                  className={styles.btnSmall} style={{ fontSize: 11, marginTop: 6, padding: "3px 8px" }}>+ Option</button>
              </div>
            )}
          </div>
        ))}
        {form.fields.length === 0 && <p style={{ fontSize: 12, color: "var(--faintest)", paddingTop: 4 }}>No custom fields. Amount only.</p>}
      </div>

      {/* Subcategories */}
      <div style={{ marginBottom: 8, marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <label className={styles.label} style={{ marginBottom: 0 }}>Subcategories</label>
        <button onClick={addSub} className={styles.btnSmall} style={{ fontSize: 12 }}>+ Subcategory</button>
      </div>
      <div style={{ background: "var(--chip2)", borderRadius: 10, padding: 12, marginBottom: 6 }}>
        {form.subcategories.map((s, si) => (
          <div key={s.id} draggable
            onDragStart={e => { setSubDrag(si); e.dataTransfer.effectAllowed = "move"; e.currentTarget.classList.add("dragging"); }}
            onDragEnd={e => { setSubDrag(null); e.currentTarget.classList.remove("dragging"); }}
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("drag-over"); }}
            onDragLeave={e => e.currentTarget.classList.remove("drag-over")}
            onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove("drag-over"); if (subDrag !== null && subDrag !== si) reorderSubs(subDrag, si); setSubDrag(null); }}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 11, color: "var(--faint)", cursor: "grab" }}>⠿</span>
            <input value={s.name} onChange={e => renameSub(s.id, e.target.value)} placeholder="Subcategory name"
              style={{ flex: 1, fontSize: 13, padding: "6px 10px" }} />
            <button onClick={() => removeSub(s.id)} style={{ width: 28, background: "none", border: "none", cursor: "pointer", color: "var(--red)", fontSize: 14 }}>✕</button>
          </div>
        ))}
        {form.subcategories.length === 0 && <p style={{ fontSize: 12, color: "var(--faintest)", paddingTop: 4 }}>No subcategories. Amount entered as a single value.</p>}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
        <button onClick={onClose} className={styles.btnGhostModal}>Cancel</button>
        <button onClick={handleSave} className={`btn-hover ${styles.btnPrimary}`} style={{ flex: 1 }}>{isNew ? "Create Category" : "Save Changes"}</button>
      </div>
    </div>
  );
}
