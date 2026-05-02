import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { today, fmtDate, parseEuDate, todayEu, parseMk, getCY, getCM, MONTHS } from '../utils/dates';

export default function DatePicker({ value, onChange, onBlur, autoFocus, style, monthKey, suggestedDay, compact }) {
  const [text, setText] = useState(value ? fmtDate(value) : todayEu());
  const [open, setOpen] = useState(!!autoFocus);
  const [calMonth, setCalMonth] = useState(() => {
    if (value) { const [y,m] = value.split("-"); return { y:+y, m:+m-1 }; }
    if (monthKey) { const p = parseMk(monthKey); return { y:p.y, m:p.m }; }
    return { y:getCY(), m:getCM() };
  });
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const [panelPos, setPanelPos] = useState(null);

  /* Walk up DOM to find the nearest modal/scroll container */
  const findModalEl = (el) => {
    let cur = el?.parentElement;
    while (cur && cur !== document.body) {
      const s = window.getComputedStyle(cur);
      if (s.maxWidth && parseFloat(s.maxWidth) >= 400 && s.overflowY !== "visible") return cur;
      cur = cur.parentElement;
    }
    return null;
  };

  /* Compute position: prefer right side of modal, fall back to left, then overlap */
  const computePos = useCallback(() => {
    if (!wrapRef.current) return;
    const inputRect = wrapRef.current.getBoundingClientRect();
    const PANEL_W = 288;
    const PANEL_H = 380;
    const MARGIN = 16;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const modalEl = findModalEl(wrapRef.current);
    let left;
    if (modalEl) {
      const mr = modalEl.getBoundingClientRect();
      if (mr.right + MARGIN + PANEL_W <= vw - MARGIN) {
        /* right of modal — preferred */
        left = mr.right + MARGIN;
      } else if (mr.left - PANEL_W - MARGIN >= MARGIN) {
        /* left of modal */
        left = mr.left - PANEL_W - MARGIN;
      } else {
        /* not enough room either side — clamp to viewport right */
        left = Math.max(MARGIN, vw - PANEL_W - MARGIN);
      }
    } else {
      left = inputRect.left;
      if (left + PANEL_W > vw - MARGIN) left = vw - PANEL_W - MARGIN;
      if (left < MARGIN) left = MARGIN;
    }

    /* Vertically: align top to input, push up if it would overflow */
    let top = inputRect.top;
    if (top + PANEL_H > vh - MARGIN) top = vh - PANEL_H - MARGIN;
    if (top < MARGIN) top = MARGIN;

    setPanelPos({ top, left });
  }, []);

  useEffect(() => {
    if (open) computePos();
    else setPanelPos(null);
  }, [open, computePos]);

  const commit = (iso) => { if (iso) { onChange(iso); setText(fmtDate(iso)); setOpen(false); } };
  const commitEu = (v) => { const iso = parseEuDate(v); if (iso) commit(iso); };

  const pickDay = (day) => {
    const mk2 = monthKey ? parseMk(monthKey) : calMonth;
    const iso = `${mk2.y}-${String(mk2.m+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    commit(iso);
  };

  const pickCalDay = (y, m, d) => {
    const iso = `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    commit(iso);
  };

  const lastDay = (y, m) => new Date(y, m + 1, 0).getDate();
  const firstDow = (y, m) => new Date(y, m, 1).getDay();

  const ctxY = monthKey ? parseMk(monthKey).y : calMonth.y;
  const ctxM = monthKey ? parseMk(monthKey).m : calMonth.m;
  const daysInCtx = lastDay(ctxY, ctxM);

  const todayIso = today();
  const yesterdayIso = (() => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().split("T")[0]; })();
  const endOfMonthIso = `${ctxY}-${String(ctxM+1).padStart(2,"0")}-${String(daysInCtx).padStart(2,"0")}`;

  const chipDays = [1,5,10,15,20,25];
  const selectedDay = value ? +value.split("-")[2] : null;

  /* Close on outside click — check both the input wrapper and the fixed panel */
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      const insideWrap = wrapRef.current && wrapRef.current.contains(e.target);
      const insidePanel = panelRef.current && panelRef.current.contains(e.target);
      if (!insideWrap && !insidePanel) { setOpen(false); if (onBlur) onBlur(e); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onBlur]);

  /* Calendar grid */
  const calDays = lastDay(calMonth.y, calMonth.m);
  const calStart = firstDow(calMonth.y, calMonth.m);
  const calWeeks = [];
  let week = new Array(calStart).fill(null);
  for (let d = 1; d <= calDays; d++) {
    week.push(d);
    if (week.length === 7) { calWeeks.push(week); week = []; }
  }
  if (week.length) { while (week.length < 7) week.push(null); calWeeks.push(week); }

  const isToday = (d) => {
    const iso = `${calMonth.y}-${String(calMonth.m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    return iso === todayIso;
  };
  const isSelected = (d) => {
    const iso = `${calMonth.y}-${String(calMonth.m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    return iso === value;
  };

  return (
    <div ref={el => wrapRef.current = el} style={{position:"relative",display:"inline-block"}}>
      <input
        value={text}
        onClick={() => { computePos(); setOpen(true); }}
        onFocus={() => { computePos(); setOpen(true); }}
        onChange={e => {
          let v = e.target.value.replace(/[^0-9/]/g, "");
          const digits = v.replace(/\//g, "");
          if (digits.length <= 8) {
            let auto = "";
            for (let i = 0; i < digits.length; i++) {
              auto += digits[i];
              if ((i === 1 || i === 3) && i < digits.length - 1) auto += "/";
            }
            v = auto;
          }
          setText(v);
          if (v.length === 10) commitEu(v);
        }}
        onKeyDown={e => { if (e.key === "Enter") { commitEu(text); setOpen(false); } if (e.key === "Escape") setOpen(false); }}
        autoFocus={autoFocus}
        placeholder="DD/MM/YYYY"
        maxLength={10}
        style={{ fontSize:compact?11:13, padding:compact?"2px 4px":"6px 10px", borderRadius:compact?4:6, width:compact?85:120, fontFamily:"'DM Sans',sans-serif", textAlign:"center", cursor:"pointer", ...style }}
      />
      {open && panelPos && createPortal(
        <div ref={panelRef} style={{
          position:"fixed", top:panelPos.top, left:panelPos.left,
          zIndex:9999,
          background:"var(--modal-bg)",
          borderRadius:18,
          border:"1.5px solid var(--border)",
          boxShadow:"0 24px 80px var(--shadow-lg), 0 0 1px rgba(255,255,255,0.06) inset",
          backdropFilter:"blur(24px)",
          WebkitBackdropFilter:"blur(24px)",
          padding:16,
          width:288,
          animation:"dpIn .2s cubic-bezier(.22,1,.36,1)",
        }}>

          {/* ── Header ── */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <span style={{fontSize:10,fontWeight:600,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1.2,fontFamily:"'Space Grotesk',sans-serif"}}>
              Select date
            </span>
            {value && (
              <span style={{fontSize:12,fontWeight:600,color:"var(--accent)",fontFamily:"'Space Grotesk',sans-serif",letterSpacing:"-0.2px"}}>
                ✓ {fmtDate(value)}
              </span>
            )}
          </div>

          {/* ── Quick picks ── */}
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:14}}>
            <button className={`dp-chip${value===todayIso?" dp-chip-active":""}`} onClick={()=>commit(todayIso)}>Today</button>
            <button className={`dp-chip${value===yesterdayIso?" dp-chip-active":""}`} onClick={()=>commit(yesterdayIso)}>Yesterday</button>
            <button className={`dp-chip${value===endOfMonthIso?" dp-chip-active":""}`} onClick={()=>commit(endOfMonthIso)}>End of month</button>
            {suggestedDay && suggestedDay > 0 && suggestedDay <= daysInCtx && (
              <button
                className={`dp-chip dp-chip-suggested${selectedDay===suggestedDay?" dp-chip-active":""}`}
                onClick={()=>pickDay(suggestedDay)}
                title="Your usual payment day">
                {suggestedDay}{suggestedDay===1?"st":suggestedDay===2?"nd":suggestedDay===3?"rd":"th"} ★
              </button>
            )}
          </div>

          {/* ── Divider ── */}
          <div style={{height:"1px",background:"var(--border)",marginBottom:14}} />

          {/* ── Month navigation ── */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <button className="dp-nav"
              onClick={()=>setCalMonth(p=>{let nm=p.m-1,ny=p.y;if(nm<0){nm=11;ny--;}return{y:ny,m:nm};})}>
              ◂
            </button>
            <span style={{fontSize:13,fontWeight:700,color:"var(--text)",fontFamily:"'Space Grotesk',sans-serif",letterSpacing:"-0.2px"}}>
              {MONTHS[calMonth.m]} {calMonth.y}
            </span>
            <button className="dp-nav"
              onClick={()=>setCalMonth(p=>{let nm=p.m+1,ny=p.y;if(nm>11){nm=0;ny++;}return{y:ny,m:nm};})}>
              ▸
            </button>
          </div>

          {/* ── Calendar grid ── */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
            {["M","T","W","T","F","S","S"].map((d,i)=>(
              <span key={i} style={{textAlign:"center",fontSize:9,fontWeight:600,color:"var(--faintest)",fontFamily:"'Space Grotesk',sans-serif",padding:"3px 0",letterSpacing:0.5}}>
                {d}
              </span>
            ))}
            {calWeeks.flat().map((d,i)=>{
              const cls = d
                ? isSelected(d)
                  ? "dp-day dp-day-sel"
                  : isToday(d)
                    ? "dp-day dp-day-today"
                    : "dp-day"
                : "";
              return (
                <button key={i}
                  className={cls}
                  onClick={d?()=>pickCalDay(calMonth.y,calMonth.m,d):undefined}
                  disabled={!d}
                  style={{opacity:d?1:0,pointerEvents:d?"auto":"none"}}>
                  {d||""}
                </button>
              );
            })}
          </div>

          {/* ── Quick day chips ── */}
          <div style={{height:"1px",background:"var(--border)",margin:"12px 0 10px"}} />
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {[...chipDays.filter(d=>d<=daysInCtx&&d!==daysInCtx), daysInCtx].map(d=>(
              <button key={d}
                className={`dp-chip${selectedDay===d?" dp-chip-active":""}`}
                onClick={()=>pickDay(d)}
                style={{fontSize:11,padding:"4px 8px",borderRadius:7,minWidth:30,textAlign:"center"}}>
                {d}
              </button>
            ))}
          </div>

        </div>,
        document.body
      )}
    </div>
  );
}
