import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, Legend,
  LineChart, Line, RadialBarChart, RadialBar, Treemap
} from "recharts";
import { mk, parseMk, uid, today, fmtDate, parseEuDate, todayEu, getCY, getCM, MIN_YEAR, MONTHS } from './utils/dates';
import { fmt } from './utils/formatters';
import { reorder, evalExpr, clamp01, _lerp, easeOut3, easeInOut2 } from './utils/expressions';
import { CHART_COLORS } from './constants';
import useBudgetStore from './store/useBudgetStore';
import useUIStore from './store/useUIStore';

/* 3D active bar shape — lifts, scales, adds top highlight & glow */
function Bar3D(props) {
  const { x, y, width, height, fill, radius, isActive, glowColor } = props;
  if (!height || height <= 0) return null;
  const r = radius || 0;
  const topR = Array.isArray(r) ? r[0] : r;
  /* inactive — plain rounded rect */
  if (!isActive) {
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} fill={fill} rx={topR} ry={topR} />
      </g>
    );
  }
  /* active — 3D pop */
  const lift = 6;
  const grow = 3;
  const ax = x - grow;
  const ay = y - lift;
  const aw = width + grow * 2;
  const ah = height + lift;
  const gc = glowColor || fill;
  return (
    <g style={{transition:"all .35s cubic-bezier(.22,1,.36,1)"}}>
      {/* glow shadow */}
      <rect x={ax - 4} y={ay + 8} width={aw + 8} height={ah} rx={topR + 2} ry={topR + 2}
        fill={gc} opacity={0.25} filter="url(#bar3dBlur)" />
      {/* main bar */}
      <rect x={ax} y={ay} width={aw} height={ah} fill={fill} rx={topR} ry={topR} />
      {/* top highlight streak */}
      <rect x={ax + 2} y={ay} width={aw - 4} height={Math.min(6, ah)} rx={topR} ry={topR}
        fill="rgba(255,255,255,0.25)" />
      {/* left edge highlight */}
      <rect x={ax} y={ay + topR} width={2} height={Math.max(0, ah - topR * 2)}
        fill="rgba(255,255,255,0.12)" rx={1} ry={1} />
    </g>
  );
}

/* ═══════════ MAIN APP ═══════════ */
export default function BudgetApp() {
  // Budget data from store
  const appData = useBudgetStore(state => state.appData);
  const dark = useBudgetStore(state => state.dark);
  const toggleDark = useBudgetStore(state => state.toggleDark);

  // Budget actions
  const setExp = useBudgetStore(state => state.setExp);
  const delExp = useBudgetStore(state => state.delExp);
  const setExpPaid = useBudgetStore(state => state.setExpPaid);
  const setAllSubsPaid = useBudgetStore(state => state.setAllSubsPaid);
  const bulkDelExp = useBudgetStore(state => state.bulkDelExp);
  const addCategory = useBudgetStore(state => state.addCategory);
  const updateCategory = useBudgetStore(state => state.updateCategory);
  const deleteCategory = useBudgetStore(state => state.deleteCategory);
  const reorderCategories = useBudgetStore(state => state.reorderCategories);
  const updateCatColOrder = useBudgetStore(state => state.updateCatColOrder);
  const addLoanType = useBudgetStore(state => state.addLoanType);
  const updateLoanType = useBudgetStore(state => state.updateLoanType);
  const deleteLoanType = useBudgetStore(state => state.deleteLoanType);
  const toggleLoanPaid = useBudgetStore(state => state.toggleLoanPaid);
  const setLoanPaidDate = useBudgetStore(state => state.setLoanPaidDate);
  const toggleAllLoansPaid = useBudgetStore(state => state.toggleAllLoansPaid);
  const addFixedIncome = useBudgetStore(state => state.addFixedIncome);
  const updateFixedIncome = useBudgetStore(state => state.updateFixedIncome);
  const deleteFixedIncome = useBudgetStore(state => state.deleteFixedIncome);
  const addVarIncome = useBudgetStore(state => state.addVarIncome);
  const updateVarIncome = useBudgetStore(state => state.updateVarIncome);
  const deleteVarIncome = useBudgetStore(state => state.deleteVarIncome);
  const bulkDelVarInc = useBudgetStore(state => state.bulkDelVarInc);

  // Selectors
  const getExp = useBudgetStore(state => state.getExp);
  const getLoanAmountForMonth = useBudgetStore(state => state.getLoanAmountForMonth);
  const getLoansTotalForMonth = useBudgetStore(state => state.getLoansTotalForMonth);
  const getFixedIncomeForMonth = useBudgetStore(state => state.getFixedIncomeForMonth);
  const getVarIncomeForMonth = useBudgetStore(state => state.getVarIncomeForMonth);
  const getTotalExpensesForMonth = useBudgetStore(state => state.getTotalExpensesForMonth);
  const getPaidExpForMonth = useBudgetStore(state => state.getPaidExpForMonth);
  const getAnticipatedExpForMonth = useBudgetStore(state => state.getAnticipatedExpForMonth);
  const getCatPaidForMonth = useBudgetStore(state => state.getCatPaidForMonth);
  const getSuggestedDay = useBudgetStore(state => state.getSuggestedDay);

  // UI state
  const { tab, catIdx, expYear, budgetYear, modal, toast, paidPicker, expSel, varSel, dragIdx, introDone } = useUIStore();
  const { setTab, setCatIdx, setExpYear, setBudgetYear, setModal, setPaidPicker, setExpSel, setVarSel, setDragIdx, setIntroDone, flash } = useUIStore();

  // Destructure appData for convenient access (guard against null)
  const { categories = [], expenses = {}, fixedIncomes = [], variableIncomes = [], loanTypes = [], loanPaid = {} } = appData || {};

  if (!introDone) return (
    <div style={{background:'#0A0A10',minHeight:'100vh',position:'relative',overflow:'hidden'}}>
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      <IntroSequence onComplete={() => setIntroDone(true)} />
    </div>
  );

  if (!appData) return (
    <div className={dark?"theme-dark":"theme-light"} style={S.loadWrap}>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:18,animation:"fadeIn .5s"}}>
        <div style={{width:44,height:44,border:"2px solid var(--border)",borderTopColor:"var(--accent)",borderRadius:"50%",animation:"spin .8s linear infinite",boxShadow:"0 0 20px var(--accent-glow)"}} />
        <span style={S.loadText}>Loading Summa...</span>
      </div>
    </div>
  );

  const cat = categories[catIdx] || categories[0];
  const catMaxYear = getCY() + (cat?.maxYears || 5);

  return (
    <div className={dark ? "theme-dark" : "theme-light"} style={S.root}>
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet"/>
      <style>{`
        :root, .theme-light {
          --bg:#F2F0EC; --card:rgba(255,255,255,0.72); --card-solid:#FFFFFF; --card-alt:rgba(248,246,243,0.8); --card-hover:rgba(240,238,234,0.9);
          --border:rgba(0,0,0,0.07); --border-light:rgba(0,0,0,0.035); --border-input:rgba(0,0,0,0.13);
          --text:#111114; --text2:#45454A; --muted:#77777E; --faint:#C4C4CA; --faintest:#9A9AA0;
          --accent:#1A9E76; --accent-bg:rgba(26,158,118,0.06); --accent-light:rgba(26,158,118,0.12); --accent-glow:rgba(26,158,118,0.18);
          --chip:rgba(0,0,0,0.04); --chip2:rgba(0,0,0,0.025); --red:#D4453A; --amber:#C8850A; --gold:#D4A030;
          --overlay:rgba(17,17,20,0.45); --toast-bg:#111114; --toast-fg:#F2F0EC;
          --input-bg:rgba(255,255,255,0.85); --modal-bg:rgba(255,255,255,0.92); --shadow:rgba(0,0,0,0.08); --shadow-lg:rgba(0,0,0,0.14);
          --upcoming-bg:#FFF8E1; --upcoming-fg:#C8850A; --upcoming-border:#F0E0A0;
          --built-in-bg:#E8E4DD; --header-bg:rgba(255,255,255,0.72); --header-shadow:0 1px 0 rgba(0,0,0,0.04), 0 4px 24px rgba(0,0,0,0.03);
          --dot-pattern:rgba(0,0,0,0.035); --tooltip-bg:rgba(255,255,255,0.95); --tooltip-text:#111114;
        }
        .theme-dark {
          --bg:#111827; --card:rgba(28,33,52,0.78); --card-solid:#1C2134; --card-alt:rgba(32,38,60,0.82); --card-hover:rgba(38,46,70,0.88);
          --border:rgba(255,255,255,0.09); --border-light:rgba(255,255,255,0.04); --border-input:rgba(255,255,255,0.13);
          --text:#E8E6E3; --text2:#A0A0A8; --muted:#6A6A72; --faint:#3A3A42; --faintest:#55555E;
          --accent:#68C0A4; --accent-bg:rgba(104,192,164,0.08); --accent-light:rgba(104,192,164,0.15); --accent-glow:rgba(104,192,164,0.18);
          --chip:rgba(255,255,255,0.05); --chip2:rgba(255,255,255,0.03); --red:#F06B5E; --amber:#F5C542; --gold:#F5C542;
          --overlay:rgba(0,0,0,0.6); --toast-bg:#E8E6E3; --toast-fg:#111827;
          --input-bg:rgba(28,33,52,0.92); --modal-bg:rgba(20,24,42,0.96); --shadow:rgba(0,0,0,0.28); --shadow-lg:rgba(0,0,0,0.42);
          --upcoming-bg:rgba(245,197,66,0.08); --upcoming-fg:#F5C542; --upcoming-border:rgba(245,197,66,0.15);
          --built-in-bg:rgba(255,255,255,0.06); --header-bg:rgba(17,24,39,0.88); --header-shadow:0 1px 0 rgba(255,255,255,0.05), 0 4px 24px rgba(0,0,0,0.18);
          --dot-pattern:rgba(255,255,255,0.03); --tooltip-bg:rgba(28,33,52,0.96); --tooltip-text:#E8E6E3;
        }
        @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeInStagger{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(24px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes slideUpMobile{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(16px) scale(.95)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes popIn{from{transform:scale(0)}to{transform:scale(1)}}
        @keyframes cardEntrance{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes glowPulse{0%,100%{box-shadow:0 0 16px var(--accent-glow)}50%{box-shadow:0 0 28px var(--accent-glow),0 0 56px rgba(104,192,164,0.04)}}
        @keyframes subtleFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
        .chart-3d{transition:transform .35s cubic-bezier(.22,1,.36,1),box-shadow .35s}
        .chart-3d:hover{transform:translateY(-4px) scale(1.012);box-shadow:0 20px 50px var(--shadow-lg),0 0 28px var(--accent-glow)}
        .chart-3d::after{content:'';position:absolute;inset:0;border-radius:inherit;opacity:0;transition:opacity .45s;background:linear-gradient(135deg,rgba(104,192,164,0.06) 0%,transparent 50%,rgba(245,197,66,0.04) 100%);pointer-events:none}
        .chart-3d:hover::after{opacity:1}
        .drag-over{outline:2px dashed var(--accent);outline-offset:-2px;border-radius:10px}
        .dragging{opacity:.4}
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{height:4px;width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:var(--faint);border-radius:4px}
        ::-webkit-scrollbar-thumb:hover{background:var(--muted)}
        input,select,textarea{font-family:'DM Sans',sans-serif;font-size:16px;border:1.5px solid var(--border-input);border-radius:10px;padding:10px 14px;outline:none;background:var(--input-bg);color:var(--text);transition:border-color .25s, box-shadow .25s;-webkit-appearance:none;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
        input:focus,select:focus,textarea:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-light),0 0 16px var(--accent-glow)}
        @media(hover:hover){
          .hov:hover{background:var(--card-hover) !important}
          .card-h:hover{border-color:var(--accent) !important;box-shadow:0 4px 20px var(--accent-glow) !important}
          [draggable]{cursor:grab}
          [draggable]:active{cursor:grabbing}
          .btn-hover:hover{transform:translateY(-2px);box-shadow:0 4px 16px var(--shadow-lg),0 0 20px var(--accent-glow)}
          .btn-hover:active{transform:translateY(0);box-shadow:0 0 8px var(--accent-glow)}
          .year-btn-h:hover{background:var(--card-hover);color:var(--text)}
          .summary-h:hover{transform:translateY(-3px) scale(1.01);box-shadow:0 12px 32px var(--shadow-lg),0 0 24px var(--accent-glow);border-color:var(--accent)}
        }
        @media(hover:none){
          .hov:active{background:var(--card-hover) !important}
          .btn-hover:active{opacity:.85}
        }
        .stagger-row{animation:fadeInStagger .35s backwards}
        .stagger-card{animation:cardEntrance .45s backwards}
        .check-pop{animation:popIn .2s}
        .glass-card{backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
        @media(max-width:768px){
          .exp-layout{flex-direction:column !important}
          .cat-sidebar{width:100% !important;position:static !important;padding:10px !important}
          .cat-sidebar-list{flex-direction:row !important;flex-wrap:wrap !important;gap:6px !important}
          .cat-sidebar-list button{padding:8px 14px !important;font-size:13px !important;min-height:40px !important}
          .budget-grid-3{grid-template-columns:1fr 1fr !important}
          .budget-grid-2{grid-template-columns:1fr !important}
          .main-area{padding:16px 12px 80px !important}
          .header-inner{padding:12px 14px !important}
        }
        @media(max-width:480px){
          .header-inner{flex-direction:column;align-items:stretch !important;gap:8px !important}
          .budget-grid-3{grid-template-columns:1fr !important}
          .modal-mobile>div{max-width:100vw !important;max-height:90vh !important;border-radius:20px 20px 0 0 !important;position:fixed !important;bottom:0 !important;left:0 !important;right:0 !important;animation:slideUpMobile .3s !important;padding:24px 20px 32px !important;overflow-y:auto !important}
          .overlay-mobile{align-items:flex-end !important;padding:0 !important}
        }
        .scroll-touch{-webkit-overflow-scrolling:touch;scroll-behavior:smooth}
        @keyframes dpIn{from{opacity:0;transform:scale(.93) translateY(-10px)}to{opacity:1;transform:scale(1) translateY(0)}}
        .dp-day{border:none;background:transparent;border-radius:8px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s cubic-bezier(.22,1,.36,1);width:100%;padding:6px 0;display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--text);font-weight:400}
        .dp-day:hover:not(:disabled){background:var(--chip);transform:scale(1.14);color:var(--accent)}
        .dp-day-today{border:1.5px solid var(--accent) !important;color:var(--accent) !important;font-weight:700 !important}
        .dp-day-sel{background:var(--accent) !important;color:#fff !important;box-shadow:0 2px 10px var(--accent-glow) !important;font-weight:700 !important}
        .dp-day-sel:hover:not(:disabled){background:var(--accent) !important;transform:scale(1.06) !important}
        .dp-chip{font-family:'DM Sans',sans-serif;font-size:12px;padding:5px 10px;border-radius:8px;border:1px solid var(--border-input);background:var(--chip);color:var(--text2);cursor:pointer;transition:all .2s cubic-bezier(.22,1,.36,1);white-space:nowrap;font-weight:500;line-height:1.4}
        .dp-chip:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-bg);transform:translateY(-1px)}
        .dp-chip-active{background:var(--accent) !important;color:#fff !important;border-color:var(--accent) !important;box-shadow:0 2px 8px var(--accent-glow) !important}
        .dp-chip-suggested{border-color:var(--accent) !important;color:var(--accent) !important;background:var(--accent-bg) !important}
        .dp-nav{background:none;border:none;cursor:pointer;color:var(--muted);padding:6px 8px;border-radius:8px;font-size:15px;transition:all .2s;line-height:1;min-width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center}
        .dp-nav:hover{color:var(--accent);background:var(--accent-bg)}
      `}</style>

      {toast && <div style={S.toast}>{toast}</div>}

      {/* HEADER */}
      <header style={{...S.header,boxShadow:"var(--header-shadow)"}}>
        <div className="header-inner" style={S.headerInner}>
          <div style={{display:"flex",alignItems:"baseline",gap:8}}>
            <h1 style={S.logo}>Summa</h1>
            <span style={S.logoSub}>personal finance, clearly</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <nav style={S.tabs}>
              {[["dashboard","Overview"],["expenses","Expenses"],["incomes","Incomes"],["budget","Budget"]].map(([k,label])=>(
                <button key={k} onClick={()=>setTab(k)} style={{...S.tab,...(tab===k?S.tabActive:{})}}>
                  {label}
                </button>
              ))}
            </nav>
            <button onClick={toggleDark} title={dark?"Light mode":"Dark mode"}
              style={{background:"var(--chip)",border:"1px solid var(--border)",borderRadius:12,padding:"9px 12px",cursor:"pointer",fontSize:18,lineHeight:1,transition:"all .35s cubic-bezier(.22,1,.36,1)",minWidth:42,minHeight:42,display:"flex",alignItems:"center",justifyContent:"center",transform:dark?"rotate(180deg)":"rotate(0deg)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)"}}>
              {dark ? "☀" : "☾"}
            </button>
          </div>
        </div>
      </header>

      <main className="main-area" style={S.main}>

        {/* ═══ DASHBOARD TAB ═══ */}
        {tab === "dashboard" && (() => {
          const curKey = mk(getCY(), getCM());
          const curIncome = getFixedIncomeForMonth(curKey) + getVarIncomeForMonth(curKey);
          const curPaid = getPaidExpForMonth(curKey);
          const curAnticipated = getAnticipatedExpForMonth(curKey);
          const curBalance = curIncome - curPaid;

          /* Last 6 months data for mini chart */
          const miniData = [];
          for (let i = 5; i >= 0; i--) {
            let mm = getCM() - i, yy = getCY();
            while (mm < 0) { mm += 12; yy--; }
            const k = mk(yy, mm);
            const inc = getFixedIncomeForMonth(k) + getVarIncomeForMonth(k);
            const pd = getPaidExpForMonth(k);
            miniData.push({ month: MONTHS[mm], income: inc, paid: pd, balance: inc - pd });
          }

          /* Upcoming unpaid expenses (this month + next 3) */
          const upcoming = [];
          for (let i = 0; i < 4; i++) {
            let mm = getCM() + i, yy = getCY();
            while (mm > 11) { mm -= 12; yy++; }
            const k = mk(yy, mm);
            categories.forEach(c => {
              if (c.id === "loans") {
                loanTypes.forEach(lt => {
                  const amt = getLoanAmountForMonth(lt, k);
                  if (amt > 0 && !loanPaid[lt.id]?.[k]?.paid)
                    upcoming.push({ cat: c.name, sub: lt.name, amount: amt, month: k, label: `${MONTHS[mm]} ${yy}` });
                });
              } else {
                const e = expenses?.[c.id]?.[k];
                if (!e) return;
                if (e.subPaid && Object.keys(e.subAmounts || {}).length > 0) {
                  Object.entries(e.subAmounts).forEach(([scId, amt]) => {
                    if (amt > 0 && !e.subPaid?.[scId]?.paid) {
                      const scName = (c.subcategories||[]).find(s=>s.id===scId)?.name || "Sub";
                      upcoming.push({ cat: c.name, sub: scName, amount: amt, month: k, label: `${MONTHS[mm]} ${yy}` });
                    }
                  });
                } else if (!e.paid) {
                  upcoming.push({ cat: c.name, sub: null, amount: e.amount, month: k, label: `${MONTHS[mm]} ${yy}` });
                }
              }
            });
          }

          /* Recent payments (last 10 paid items by paidDate) */
          const recent = [];
          categories.forEach(c => {
            if (c.id === "loans") {
              loanTypes.forEach(lt => {
                Object.entries(loanPaid[lt.id] || {}).forEach(([entryKey, pd]) => {
                  if (pd?.paid && pd.paidDate)
                    recent.push({ cat: c.name, sub: lt.name, amount: getLoanAmountForMonth(lt, entryKey), paidDate: pd.paidDate });
                });
              });
            } else {
              Object.entries(expenses?.[c.id] || {}).forEach(([, e]) => {
                if (e?.subPaid && Object.keys(e.subPaid).length > 0) {
                  Object.entries(e.subPaid).forEach(([scId, sp]) => {
                    if (sp?.paid && sp.paidDate) {
                      const scName = (c.subcategories||[]).find(s=>s.id===scId)?.name || "Sub";
                      recent.push({ cat: c.name, sub: scName, amount: e.subAmounts?.[scId] || 0, paidDate: sp.paidDate });
                    }
                  });
                } else if (e?.paid && e.paidDate) {
                  recent.push({ cat: c.name, sub: null, amount: e.amount, paidDate: e.paidDate });
                }
              });
            }
          });
          recent.sort((a, b) => b.paidDate.localeCompare(a.paidDate));
          const recentSlice = recent.slice(0, 10);

          return (
            <div style={{animation:"fadeIn .35s"}}>
              <h2 style={{...S.sectionTitle,marginBottom:22}}>{MONTHS[getCM()]} {getCY()} Overview</h2>

              {/* Summary cards */}
              <div className="budget-grid-3" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:14,marginBottom:28}}>
                {[
                  { label:"Income", value:curIncome, color:"var(--accent)", icon:"↑" },
                  { label:"Paid", value:curPaid, color:"var(--red)", icon:"↓" },
                  { label:"Anticipated", value:curAnticipated, color:"var(--amber)", icon:"◷" },
                  { label:"Balance", value:curBalance, color:curBalance>=0?"var(--accent)":"var(--red)", icon:"◎" },
                ].map((c,i)=>(
                  <div key={i} className="summary-h stagger-card glass-card chart-3d" style={{...S.summaryCard,animationDelay:`${i*80}ms`,position:"relative",transformStyle:"preserve-3d"}}>
                    <span style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1.2,fontWeight:600,fontFamily:"'Space Grotesk',sans-serif"}}>{c.icon} {c.label}</span>
                    <div style={{fontSize:26,fontWeight:700,color:c.color,marginTop:8,fontFamily:"'Space Grotesk',sans-serif",letterSpacing:"-0.5px"}}>{fmt(c.value)}</div>
                  </div>
                ))}
              </div>

              {/* Mini chart */}
              <div className="stagger-card glass-card chart-3d" style={{...S.chartCard,animationDelay:"150ms",position:"relative",transformStyle:"preserve-3d"}}>
                <h3 style={S.chartTitle}>Last 6 Months</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={miniData} barGap={2}>
                    <defs><filter id="bar3dBlur"><feGaussianBlur stdDeviation="6"/></filter></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.06)"} />
                    <XAxis dataKey="month" tick={{fontSize:11,fill:dark?"#6A6A72":"#9A9AA0"}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize:11,fill:dark?"#6A6A72":"#9A9AA0"}} axisLine={false} tickLine={false} tickFormatter={v=>v>=1000?(v/1000).toFixed(0)+"k":`${v}`} />
                    <Tooltip formatter={v=>fmt(v)} cursor={{fill:dark?"rgba(104,192,164,0.08)":"rgba(26,158,118,0.08)",radius:6}} contentStyle={{borderRadius:12,border:"1px solid var(--border)",boxShadow:"0 8px 32px var(--shadow-lg)",fontSize:13,background:"var(--tooltip-bg)",color:"var(--tooltip-text)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)"}} animationDuration={200} />
                    <Bar dataKey="income" name="Income" fill={dark?"#68C0A4":"#1A9E76"} radius={[5,5,0,0]} shape={p=><Bar3D {...p} isActive={false} radius={[5,5,0,0]}/>} activeBar={p=><Bar3D {...p} isActive={true} radius={[5,5,0,0]} glowColor={dark?"rgba(104,192,164,0.5)":"rgba(26,158,118,0.4)"}/>} />
                    <Bar dataKey="paid" name="Paid" fill={dark?"#F06B5E":"#D4453A"} radius={[5,5,0,0]} shape={p=><Bar3D {...p} isActive={false} radius={[5,5,0,0]}/>} activeBar={p=><Bar3D {...p} isActive={true} radius={[5,5,0,0]} glowColor={dark?"rgba(240,107,94,0.5)":"rgba(212,69,58,0.4)"}/>} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Two-column: Upcoming + Recent */}
              <div className="budget-grid-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                {/* Upcoming unpaid */}
                <div className="stagger-card glass-card chart-3d" style={{...S.chartCard,animationDelay:"250ms",position:"relative",transformStyle:"preserve-3d"}}>
                  <h3 style={S.chartTitle}>Upcoming Unpaid</h3>
                  {upcoming.length === 0 ? (
                    <p style={{fontSize:13,color:"var(--faintest)",fontStyle:"italic",padding:"12px 0"}}>All caught up — nothing unpaid.</p>
                  ) : (
                    <div style={{display:"flex",flexDirection:"column",gap:2}}>
                      {upcoming.slice(0, 12).map((u, i) => (
                        <div key={i} className="stagger-row" style={{display:"flex",alignItems:"center",gap:8,padding:"8px 4px",borderBottom:"1px solid var(--border-light)",animationDelay:`${i*30}ms`}}>
                          <div style={{flex:1,minWidth:0}}>
                            <span style={{fontSize:13,fontWeight:500}}>{u.cat}</span>
                            {u.sub && <span style={{fontSize:11,color:"var(--muted)",marginLeft:6}}>· {u.sub}</span>}
                          </div>
                          <span style={{fontSize:11,color:"var(--muted)",flexShrink:0}}>{u.label}</span>
                          <span style={{fontSize:14,fontWeight:600,color:"var(--amber)",flexShrink:0,minWidth:60,textAlign:"right"}}>{fmt(u.amount)}</span>
                        </div>
                      ))}
                      {upcoming.length > 12 && <p style={{fontSize:11,color:"var(--faintest)",marginTop:6}}>+{upcoming.length - 12} more</p>}
                    </div>
                  )}
                </div>

                {/* Recent payments */}
                <div className="stagger-card glass-card chart-3d" style={{...S.chartCard,animationDelay:"300ms",position:"relative",transformStyle:"preserve-3d"}}>
                  <h3 style={S.chartTitle}>Recent Payments</h3>
                  {recentSlice.length === 0 ? (
                    <p style={{fontSize:13,color:"var(--faintest)",fontStyle:"italic",padding:"12px 0"}}>No payments recorded yet.</p>
                  ) : (
                    <div style={{display:"flex",flexDirection:"column",gap:2}}>
                      {recentSlice.map((r, i) => (
                        <div key={i} className="stagger-row" style={{display:"flex",alignItems:"center",gap:8,padding:"8px 4px",borderBottom:"1px solid var(--border-light)",animationDelay:`${i*30}ms`}}>
                          <div style={{flex:1,minWidth:0}}>
                            <span style={{fontSize:13,fontWeight:500}}>{r.cat}</span>
                            {r.sub && <span style={{fontSize:11,color:"var(--muted)",marginLeft:6}}>· {r.sub}</span>}
                          </div>
                          <span style={{fontSize:11,color:"var(--accent)",flexShrink:0}}>{fmtDate(r.paidDate)}</span>
                          <span style={{fontSize:14,fontWeight:600,color:"var(--red)",flexShrink:0,minWidth:60,textAlign:"right"}}>{fmt(r.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ═══ EXPENSES TAB ═══ */}
        {tab === "expenses" && (
          <div className="exp-layout" style={{animation:"fadeIn .35s",display:"flex",gap:20,alignItems:"flex-start"}}>
            {/* Left sidebar — category nav */}
            <div className="cat-sidebar" style={S.catSidebar}>
              <div style={S.catSidebarHeader}>
                <span style={{fontSize:11,fontWeight:600,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1}}>Categories</span>
              </div>
              <div className="cat-sidebar-list" style={S.catSidebarList}>
                {categories.map((c, i) => (
                  <div key={c.id} draggable
                    onDragStart={e=>{setDragIdx(i);e.dataTransfer.effectAllowed="move";e.currentTarget.classList.add("dragging");}}
                    onDragEnd={e=>{setDragIdx(null);e.currentTarget.classList.remove("dragging");}}
                    onDragOver={e=>{e.preventDefault();e.currentTarget.classList.add("drag-over");}}
                    onDragLeave={e=>e.currentTarget.classList.remove("drag-over")}
                    onDrop={e=>{e.preventDefault();e.currentTarget.classList.remove("drag-over");if(dragIdx!==null&&dragIdx!==i){reorderCategories(dragIdx,i);if(catIdx===dragIdx)setCatIdx(i);else if(dragIdx<catIdx&&i>=catIdx)setCatIdx(catIdx-1);else if(dragIdx>catIdx&&i<=catIdx)setCatIdx(catIdx+1);}setDragIdx(null);}}
                    style={{...S.catSideItem,...(catIdx === i ? S.catSideItemActive : {}),justifyContent:"space-between"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,flex:1,minWidth:0,cursor:"pointer"}}
                      onClick={() => { setCatIdx(i); setExpYear(getCY()); setExpSel(new Set()); }}>
                      <span style={{fontSize:11,color:catIdx===i?"rgba(255,255,255,.5)":"var(--faint)",cursor:"grab"}}>⠿</span>
                      <span style={{flex:1,textAlign:"left",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</span>
                      {c.maxYears > 5 && <span style={{...S.loanBadgeSide,...(catIdx===i?{background:"rgba(255,255,255,.2)",color:"#fff"}:{})}} >long-term</span>}
                    </div>
                    {!c.protected && (
                      <div style={{display:"flex",gap:2,flexShrink:0,marginLeft:4}}>
                        <span onClick={e=>{e.stopPropagation();setModal({type:"editCat",idx:i,cat:c});}}
                          style={{cursor:"pointer",fontSize:11,padding:"2px 5px",borderRadius:4,opacity:catIdx===i?.8:.4,color:catIdx===i?"#fff":"var(--muted)",transition:"opacity .15s"}}
                          title="Edit">✎</span>
                        <span onClick={e=>{e.stopPropagation();setModal({type:"confirmDeleteCat",idx:i,catName:c.name});}}
                          style={{cursor:"pointer",fontSize:11,padding:"2px 5px",borderRadius:4,opacity:catIdx===i?.8:.4,color:catIdx===i?"#fff":"var(--red)",transition:"opacity .15s"}}
                          title="Delete">✕</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={() => setModal({type:"addCat"})} className="btn-hover" style={{...S.btnGhost,width:"100%",marginTop:8,fontSize:11,padding:"6px 10px"}}>+ Add Category</button>
            </div>

            {/* Right content */}
            <div style={{flex:1,minWidth:0}}>
              {cat && cat.id === "loans" ? (
                <LoansView
                  loanTypes={loanTypes}
                  getLoanAmountForMonth={getLoanAmountForMonth}
                  expYear={expYear} setExpYear={setExpYear}
                  onAdd={addLoanType} onUpdate={updateLoanType} onDelete={deleteLoanType}
                  loanPaid={loanPaid} toggleLoanPaid={toggleLoanPaid} setLoanPaidDate={setLoanPaidDate} toggleAllLoansPaid={toggleAllLoansPaid}
                  paidPicker={paidPicker} setPaidPicker={setPaidPicker}
                />
              ) : cat ? (
                <>
                  <div style={S.yearNav}>
                    <button onClick={() => { if(expYear > MIN_YEAR) { setExpYear(expYear - 1); setExpSel(new Set()); }}} className="year-btn-h" style={{...S.yearBtn,opacity:expYear>MIN_YEAR?1:.3}}>◂</button>
                    <span style={S.yearLabel}>{expYear}</span>
                    <button onClick={() => { if(expYear < catMaxYear-1) { setExpYear(expYear + 1); setExpSel(new Set()); }}} className="year-btn-h" style={{...S.yearBtn,opacity:expYear<catMaxYear-1?1:.3}}>▸</button>
                    <span style={S.yearRange}>range: {MIN_YEAR} – {catMaxYear - 1}</span>
                  </div>

                  {(() => {
                    const hasSubs = cat.subcategories?.length > 0;
                    const filledKeys = MONTHS.map((_, mi) => mk(expYear, mi)).filter(k => {
                      const e = expenses?.[cat.id]?.[k];
                      if (!e) return false;
                      if (hasSubs) return (cat.subcategories||[]).some(sc => e.subAmounts?.[sc.id] > 0) || e.amount > 0;
                      return true;
                    });
                    const allSelected = filledKeys.length > 0 && filledKeys.every(k => expSel.has(k));
                    const toggleSel = (k) => setExpSel(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
                    const toggleAll = () => { if (allSelected) setExpSel(new Set()); else setExpSel(new Set(filledKeys)); };

                    /* Build column definitions */
                    const allCols = [];
                    if (hasSubs) {
                      (cat.subcategories||[]).forEach(sc => allCols.push({
                        id:`sub:${sc.id}`, label:sc.name, w:100, align:"right",
                        cell:(entry)=>{ const sv=entry?.subAmounts?.[sc.id]; return <span style={{fontSize:15,fontWeight:sv?700:400,color:sv?"var(--text)":"var(--faint)"}}>{sv?fmt(sv):"—"}</span>; }
                      }));
                      allCols.push({ id:"total", label:"Total", w:90, align:"right", bold:true,
                        cell:(entry)=>{ const t=entry?(cat.subcategories||[]).reduce((s,sc)=>s+(entry.subAmounts?.[sc.id]||0),0)||entry.amount||0:0; return <span style={{fontSize:16,fontWeight:700,color:t>0?"var(--text)":"var(--faint)"}}>{t>0?fmt(t):"—"}</span>; }
                      });
                    } else {
                      allCols.push({ id:"amount", label:"Amount", w:110, align:"right",
                        cell:(entry)=> <span style={{fontSize:16,fontWeight:700,color:entry?"var(--text)":"var(--faint)"}}>{entry?fmt(entry.amount):"—"}</span>
                      });
                    }
                    (cat.fields||[]).forEach(f => allCols.push({
                      id:`field:${f.id}`, label:f.name, flex:1, minW:90,
                      cell:(entry)=> <span style={{fontSize:13,color:entry?.fields?.[f.id]?"var(--text2)":"var(--faint)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{entry?.fields?.[f.id]||"—"}</span>
                    }));
                    allCols.push({ id:"info", label:"Info", flex:1, minW:100,
                      cell:(entry)=>{ const ex=entry?.extras?.filter(e=>e.name||e.value)||[]; return ex.length>0? <span style={{display:"flex",flexWrap:"wrap",gap:4}}>{ex.map((x,i)=><span key={i} style={{fontSize:10,padding:"2px 7px",borderRadius:5,background:"var(--chip)",color:"var(--text2)",whiteSpace:"nowrap"}}>{x.name}{x.name&&x.value?": ":""}{x.value}</span>)}</span> : <span style={{color:"var(--faint)",fontSize:13}}>—</span>; }
                    });
                    allCols.push({ id:"paid", label:"Paid", w:160,
                      cell:(entry,key)=> {
                        if (!entry) return <span style={{color:"var(--faint)",fontSize:13}}>—</span>;
                        /* Subcategory mode */
                        const sp = entry.subPaid || {};
                        const subIds = Object.keys(entry.subAmounts || {}).filter(id => (entry.subAmounts[id] || 0) > 0);
                        if (subIds.length > 0 && hasSubs) {
                          const paidCount = subIds.filter(id => sp[id]?.paid).length;
                          const allPd = paidCount === subIds.length;
                          const picking = paidPicker?.catId===cat.id && paidPicker?.key===key;
                          return (
                            <span style={{display:"flex",alignItems:"center",gap:6}} onClick={e=>e.stopPropagation()}>
                              {picking ? (
                                  <DatePicker value={today()} autoFocus compact
                                    monthKey={key} suggestedDay={getSuggestedDay(cat.id)}
                                    onChange={d=>{setAllSubsPaid(cat.id,key,true,d);setPaidPicker(null);}}
                                    onBlur={()=>setTimeout(()=>setPaidPicker(null),200)}
                                    style={{border:"1.5px solid var(--accent)",color:"var(--text)"}} />
                              ) : allPd ? (
                                <>
                                  <span className="check-pop" onClick={()=>setAllSubsPaid(cat.id,key,false,"")}
                                    style={{width:20,height:20,borderRadius:6,background:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,transition:"transform .15s"}}>
                                    <span style={{color:"#fff",fontSize:12,lineHeight:1}}>✓</span>
                                  </span>
                                  <span style={{fontSize:11,color:"var(--accent)",fontWeight:500}}>All paid</span>
                                </>
                              ) : (
                                <span onClick={()=>setPaidPicker({catId:cat.id,key})} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                                  <span style={{width:20,height:20,borderRadius:6,border:"1.5px solid "+(paidCount>0?"var(--accent)":"var(--faint)"),background:paidCount>0?"var(--accent-light)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                                    {paidCount > 0 && <span style={{fontSize:9,color:"var(--accent)",fontWeight:700}}>{paidCount}</span>}
                                  </span>
                                  <span style={{fontSize:11,color:paidCount>0?"var(--text2)":"var(--faint)",fontWeight:500}}>
                                    {paidCount > 0 ? `${paidCount}/${subIds.length} paid` : "unpaid"}
                                  </span>
                                </span>
                              )}
                            </span>
                          );
                        }
                        /* Non-subcategory mode: existing behavior */
                        return (
                          <span style={{display:"flex",alignItems:"center",gap:6}} onClick={e=>e.stopPropagation()}>
                            {(paidPicker?.catId===cat.id&&paidPicker?.key===key) ? (
                              <DatePicker value={entry.paidDate||today()} autoFocus compact
                                monthKey={key} suggestedDay={getSuggestedDay(cat.id)}
                                onChange={d=>{setExpPaid(cat.id,key,true,d);setPaidPicker(null);}}
                                onBlur={()=>setTimeout(()=>setPaidPicker(null),200)}
                                style={{border:"1.5px solid var(--accent)",color:"var(--text)"}} />
                            ) : entry.paid ? (
                              <><span className="check-pop" onClick={()=>setExpPaid(cat.id,key,false,"")} style={{width:20,height:20,borderRadius:6,background:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,transition:"transform .15s"}}><span style={{color:"#fff",fontSize:12,lineHeight:1}}>✓</span></span><span onClick={()=>setPaidPicker({catId:cat.id,key})} style={{fontSize:11,color:"var(--accent)",fontWeight:500,cursor:"pointer",borderBottom:"1px dashed var(--accent)"}}>{fmtDate(entry.paidDate)}</span></>
                            ) : (
                              <span onClick={()=>setPaidPicker({catId:cat.id,key})} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}><span style={{width:20,height:20,borderRadius:6,border:"1.5px solid var(--faint)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"border-color .2s"}}/><span style={{fontSize:11,color:"var(--faint)"}}>unpaid</span></span>
                            )}
                          </span>
                        );
                      }
                    });

                    /* Apply stored column order */
                    const storedOrder = cat.colOrder || [];
                    const cols = storedOrder.length > 0
                      ? storedOrder.map(id => allCols.find(c => c.id === id)).filter(Boolean).concat(allCols.filter(c => !storedOrder.includes(c.id)))
                      : allCols;

                    let colDragFrom = null;
                    const colStyle = (c) => ({ width:c.w, flex:c.flex, minWidth:c.minW, textAlign:c.align, fontWeight:c.bold?700:undefined });

                    return <>
                      {expSel.size > 0 && (
                        <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",background:"var(--accent-bg)",borderRadius:10,marginBottom:10}}>
                          <span style={{fontSize:13,fontWeight:600,color:"var(--accent)",flex:1}}>{expSel.size} selected</span>
                          <button onClick={()=>setExpSel(new Set())} style={S.btnSmall}>Deselect</button>
                          <button onClick={()=>{bulkDelExp(cat.id,[...expSel]);setExpSel(new Set());flash(`Deleted ${expSel.size} entr${expSel.size===1?"y":"ies"}!`);}}
                            style={{...S.btnSmall,color:"var(--red)",borderColor:"var(--red)"}}>Delete Selected</button>
                        </div>
                      )}
                      <div style={{...S.listWrap,overflowX:"auto"}}>
                        <div style={S.listHeader}>
                          <span style={{width:30}} onClick={e=>e.stopPropagation()}>
                            {filledKeys.length > 0 && (
                              <span onClick={toggleAll}
                                style={{width:16,height:16,borderRadius:4,border:allSelected?"none":"1.5px solid var(--faint)",background:allSelected?"var(--accent)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                                {allSelected && <span style={{color:"#fff",fontSize:10,lineHeight:1}}>✓</span>}
                              </span>
                            )}
                          </span>
                          <span style={{width:70}}>Month</span>
                          {cols.map((c,ci) => (
                            <span key={c.id} draggable
                              onDragStart={e=>{colDragFrom=ci;e.dataTransfer.effectAllowed="move";e.currentTarget.classList.add("dragging");}}
                              onDragEnd={e=>{colDragFrom=null;e.currentTarget.classList.remove("dragging");}}
                              onDragOver={e=>{e.preventDefault();e.currentTarget.classList.add("drag-over");}}
                              onDragLeave={e=>e.currentTarget.classList.remove("drag-over")}
                              onDrop={e=>{e.preventDefault();e.currentTarget.classList.remove("drag-over");if(colDragFrom!==null&&colDragFrom!==ci){const newOrder=reorder(cols.map(x=>x.id),colDragFrom,ci);updateCatColOrder(cat.id,newOrder);}colDragFrom=null;}}
                              style={{...colStyle(c),overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",cursor:"grab"}}>
                              {c.label}
                            </span>
                          ))}
                          <span style={{width:50}}></span>
                        </div>
                        {MONTHS.map((mName, mi) => {
                          const key = mk(expYear, mi);
                          const entry = expenses?.[cat.id]?.[key] || null;
                          const hasData = hasSubs ? (entry && ((cat.subcategories||[]).some(sc=>entry.subAmounts?.[sc.id]>0)||entry.amount>0)) : !!entry;
                          const isPast = expYear < getCY() || (expYear === getCY() && mi < getCM());
                          const isCurrent = expYear === getCY() && mi === getCM();
                          const isSel = expSel.has(key);
                          return (
                            <div key={mi} className="hov stagger-row"
                              onClick={() => setModal({type:"editExp",catId:cat.id,catObj:cat,monthKey:key,monthLabel:`${mName} ${expYear}`,entry})}
                              style={{...S.listRow,...(isCurrent?S.listRowCurrent:{}),...(isPast?{opacity:.5}:{}), ...(isSel?{background:"var(--accent-bg)"}:{}), animationDelay:`${mi*25}ms`}}>                              <span style={{width:30}} onClick={e=>e.stopPropagation()}>
                                {hasData && (
                                  <span onClick={()=>toggleSel(key)}
                                    style={{width:16,height:16,borderRadius:4,border:isSel?"none":"1.5px solid var(--faint)",background:isSel?"var(--accent)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                                    {isSel && <span style={{color:"#fff",fontSize:10,lineHeight:1}}>✓</span>}
                                  </span>
                                )}
                              </span>
                              <span style={{width:70,fontWeight:600,fontSize:13,color:"var(--text2)",display:"flex",alignItems:"center",gap:6}}>
                                {mName}
                                {isCurrent && <span style={S.nowBadge}>now</span>}
                              </span>
                              {cols.map(c => <span key={c.id} style={colStyle(c)}>{c.cell(entry,key)}</span>)}
                              <span style={{width:50,textAlign:"right"}}>
                                {entry || hasData ? (
                                  <span style={{fontSize:11,color:"var(--accent)",fontWeight:500}}>✎ Edit</span>
                                ) : (
                                  <span style={{fontSize:11,color:"var(--faintest)"}}>+ Add</span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </>;
                  })()}

                  <div style={S.yearTotal}>
                    <span style={{color:"var(--muted)"}}>Total for {expYear}:</span>
                    <span style={{fontWeight:600,fontSize:18,color:"var(--text)"}}>
                      {fmt(MONTHS.reduce((s,_,mi) => s + (getExp(cat.id, mk(expYear,mi))?.amount||0), 0))}
                    </span>
                  </div>
                </>
              ) : null}
              {categories.length === 0 && (
                <div style={S.emptyState}>
                  <div style={{fontSize:32,marginBottom:8,opacity:.5}}>📂</div>
                  <p style={{fontWeight:500,marginBottom:4}}>No categories yet</p>
                  <p style={{fontSize:12,color:"var(--faintest)",marginBottom:12}}>Create your first category to start tracking expenses.</p>
                  <button onClick={()=>setModal({type:"addCat"})} className="btn-hover" style={{...S.btnPrimary,fontSize:13,padding:"10px 18px"}}>Create your first category</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ INCOMES TAB ═══ */}
        {tab === "incomes" && (
          <div style={{animation:"fadeIn .35s"}}>
            {/* Fixed */}
            <section>
              <div style={S.sectionHead}>
                <div>
                  <h2 style={S.sectionTitle}>Fixed Incomes</h2>
                  <p style={S.sectionSub}>Recurring monthly income. Schedule future raises by adding a new amount record with a future effective date.</p>
                </div>
                <button onClick={()=>setModal({type:"addFixedIncome"})} className="btn-hover" style={S.btnPrimary}>+ Add Source</button>
              </div>
              {fixedIncomes.length === 0 ? (
                <div style={S.emptyState}>
                  <div style={{fontSize:32,marginBottom:8,opacity:.5}}>💰</div>
                  <p style={{fontWeight:500,marginBottom:4}}>No fixed income sources yet</p>
                  <p style={{fontSize:12,color:"var(--faintest)"}}>Add your salary or other recurring income to get started.</p>
                </div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {fixedIncomes.map((src, si) => {
                    const sorted = [...(src.records||[])].sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom));
                    const current = sorted.filter(r=>r.effectiveFrom<=mk(getCY(),getCM())).pop();
                    return (
                      <div key={src.id} className="stagger-card card-h" style={{...S.incomeCard,animationDelay:`${si*80}ms`,transition:"border-color .2s, box-shadow .2s"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                          <div>
                            <h3 style={{fontSize:16,fontWeight:600,marginBottom:4}}>{src.name}</h3>
                            {current && (
                              <div style={{fontSize:24,fontWeight:700,color:"var(--accent)",fontFamily:"'Space Grotesk',sans-serif",letterSpacing:"-0.3px"}}>
                                {fmt(current.amount)}<span style={{fontSize:13,fontWeight:400,color:"var(--muted)",fontFamily:"'DM Sans',sans-serif"}}>/mo</span>
                              </div>
                            )}
                            {!current && <div style={{fontSize:13,color:"var(--faintest)",fontStyle:"italic"}}>Starts in the future</div>}
                          </div>
                          <div style={{display:"flex",gap:6}}>
                            <button onClick={()=>setModal({type:"editFixedIncome",idx:si,src})} style={S.btnSmall}>Edit</button>
                            <button onClick={()=>{deleteFixedIncome(si);flash("Deleted!");}} style={{...S.btnSmall,color:"var(--red)",borderColor:"var(--red)"}}>Delete</button>
                          </div>
                        </div>
                        {sorted.length > 0 && (
                          <div style={{marginTop:12,display:"flex",flexWrap:"wrap",gap:6}}>
                            {sorted.map((r,ri)=>{
                              const {y,m}=parseMk(r.effectiveFrom);
                              const isUpcoming = r.effectiveFrom > mk(getCY(),getCM());
                              return (
                                <span key={ri} style={{...S.timeChip,...(isUpcoming?{background:"var(--upcoming-bg)",color:"var(--amber)",border:"1px solid var(--upcoming-border)"}:{})}}>
                                  {fmt(r.amount)} from {MONTHS[m]} {y}{isUpcoming?" ⏳":""}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Variable */}
            <section style={{marginTop:32}}>
              <div style={S.sectionHead}>
                <div>
                  <h2 style={S.sectionTitle}>Variable Incomes</h2>
                  <p style={S.sectionSub}>One-time or irregular income assigned to a specific month.</p>
                </div>
                <button onClick={()=>setModal({type:"addVarIncome"})} className="btn-hover" style={S.btnPrimary}>+ Add Entry</button>
              </div>
              {variableIncomes.length === 0 ? (
                <div style={S.emptyState}>
                  <div style={{fontSize:32,marginBottom:8,opacity:.5}}>📋</div>
                  <p style={{fontWeight:500,marginBottom:4}}>No variable income recorded yet</p>
                  <p style={{fontSize:12,color:"var(--faintest)"}}>Add one-time or irregular income entries here.</p>
                </div>
              ) : (
                <>
                  {varSel.size > 0 && (
                    <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",background:"var(--accent-bg)",borderRadius:10,marginBottom:10}}>
                      <span style={{fontSize:13,fontWeight:600,color:"var(--accent)",flex:1}}>{varSel.size} selected</span>
                      <button onClick={()=>setVarSel(new Set())} style={S.btnSmall}>Deselect</button>
                      <button onClick={()=>{bulkDelVarInc(varSel);setVarSel(new Set());flash(`Deleted ${varSel.size} entr${varSel.size===1?"y":"ies"}!`);}}
                        style={{...S.btnSmall,color:"var(--red)",borderColor:"var(--red)"}}>Delete Selected</button>
                    </div>
                  )}
                  <div style={S.tableWrap}>
                    <div style={S.tableHeader}>
                      <span style={{width:30}}>
                        {variableIncomes.length > 0 && (
                          <span onClick={()=>{
                            const allIds = variableIncomes.map(v=>v.id);
                            const allSel = allIds.every(id=>varSel.has(id));
                            setVarSel(allSel ? new Set() : new Set(allIds));
                          }}
                            style={{width:16,height:16,borderRadius:4,border:variableIncomes.every(v=>varSel.has(v.id))?"none":"1.5px solid var(--faint)",background:variableIncomes.every(v=>varSel.has(v.id))?"var(--accent)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                            {variableIncomes.every(v=>varSel.has(v.id)) && <span style={{color:"#fff",fontSize:10,lineHeight:1}}>✓</span>}
                          </span>
                        )}
                      </span>
                      <span style={{flex:2}}>Description</span><span style={{flex:1}}>Month</span><span style={{flex:1,textAlign:"right"}}>Amount</span><span style={{width:50}}></span>
                    </div>
                    {[...variableIncomes].sort((a,b)=>b.month.localeCompare(a.month)).map(v=>{
                      const {y,m}=parseMk(v.month);
                      const isSel = varSel.has(v.id);
                      return (
                        <div key={v.id} className="hov" style={{...S.tableRow,...(isSel?{background:"var(--accent-bg)"}:{})}}>
                          <span style={{width:30}} onClick={e=>e.stopPropagation()}>
                            <span onClick={()=>setVarSel(prev=>{const n=new Set(prev);n.has(v.id)?n.delete(v.id):n.add(v.id);return n;})}
                              style={{width:16,height:16,borderRadius:4,border:isSel?"none":"1.5px solid var(--faint)",background:isSel?"var(--accent)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                              {isSel && <span style={{color:"#fff",fontSize:10,lineHeight:1}}>✓</span>}
                            </span>
                          </span>
                          <span style={{flex:2,fontWeight:500}}>{v.name}</span>
                          <span style={{flex:1,color:"var(--muted)"}}>{MONTHS[m]} {y}</span>
                          <span style={{flex:1,textAlign:"right",fontWeight:600,color:"var(--accent)"}}>{fmt(v.amount)}</span>
                          <span style={{width:50,display:"flex",gap:8,justifyContent:"flex-end"}}>
                            <span style={{cursor:"pointer",opacity:.4,fontSize:13}} onClick={()=>setModal({type:"editVarIncome",item:v})}>✎</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        {/* ═══ BUDGET TAB ═══ */}
        {tab === "budget" && (
          <BudgetView year={budgetYear} setYear={setBudgetYear} categories={categories} expenses={expenses}
            getFixedIncomeForMonth={getFixedIncomeForMonth} getVarIncomeForMonth={getVarIncomeForMonth}
            getTotalExpensesForMonth={getTotalExpensesForMonth} getPaidExpForMonth={getPaidExpForMonth}
            getAnticipatedExpForMonth={getAnticipatedExpForMonth} getCatPaidForMonth={getCatPaidForMonth}
            getExp={getExp} dark={dark} />
        )}
      </main>

      {/* ═══ MODALS ═══ */}
      {modal && (
        <div onClick={()=>setModal(null)} className="overlay-mobile" style={S.overlay}>
          <div onClick={e=>e.stopPropagation()} className="modal-mobile" style={{animation:"slideUp .25s"}}>
            {modal.type==="editExp" && (
              <ExpenseModal catObj={modal.catObj} monthKey={modal.monthKey} monthLabel={modal.monthLabel}
                entry={modal.entry} catMaxYear={getCY()+(modal.catObj.maxYears||5)}
                suggestedDay={getSuggestedDay(modal.catId)}
                onSave={(entry,applyMonths)=>{setExp(modal.catId,modal.monthKey,entry,applyMonths);flash(applyMonths>0?`Applied to ${applyMonths} more month${applyMonths!==1?"s":""}!`:"Saved!");setModal(null);}}
                onDelete={()=>{delExp(modal.catId,modal.monthKey);flash("Deleted!");setModal(null);}}
                onReorderSubs={(newSubs)=>{
                  const ci = categories.findIndex(c=>c.id===modal.catId);
                  if(ci>=0) updateCategory(ci,{subcategories:newSubs},true);
                }}
                onClose={()=>setModal(null)} />
            )}
            {(modal.type==="addCat"||modal.type==="editCat") && (
              <CategoryFormModal
                editing={modal.type==="editCat" ? modal.idx : -1}
                category={modal.type==="editCat" ? modal.cat : null}
                onSave={(catData)=>{
                  if(modal.type==="addCat") {
                    addCategory(catData);
                    setCatIdx(categories.length); // new category will be at end
                    flash("Category added!");
                  } else {
                    /* Detect removed subcategory IDs */
                    const oldSubIds = new Set((modal.cat.subcategories||[]).map(s=>s.id));
                    const newSubIds = new Set((catData.subcategories||[]).map(s=>s.id));
                    const removedIds = [...oldSubIds].filter(id=>!newSubIds.has(id));
                    if (removedIds.length > 0) {
                      /* Scrub deleted-subcategory data from every expense entry */
                      const catId = modal.cat.id;
                      const nextExp = { ...appData.expenses };
                      if (nextExp[catId]) {
                        const cleanedEntries = {};
                        Object.entries(nextExp[catId]).forEach(([key, entry]) => {
                          if (!entry) return;
                          const newSubAmounts = { ...(entry.subAmounts||{}) };
                          const newSubPaid    = { ...(entry.subPaid||{}) };
                          removedIds.forEach(rid => { delete newSubAmounts[rid]; delete newSubPaid[rid]; });
                          const newTotal = Object.values(newSubAmounts).reduce((s,v)=>s+(v||0), 0);
                          /* Re-derive paid status from remaining subcategories */
                          const subIdsLeft = Object.keys(newSubAmounts).filter(id=>(newSubAmounts[id]||0)>0);
                          const allPaid = subIdsLeft.length>0 && subIdsLeft.every(id=>newSubPaid[id]?.paid);
                          const paidDate = allPaid ? (Object.values(newSubPaid).filter(sp=>sp?.paid&&sp?.paidDate).map(sp=>sp.paidDate).sort().pop()||"") : (entry.paid&&!allPaid?"":entry.paidDate);
                          cleanedEntries[key] = { ...entry, subAmounts:newSubAmounts, subPaid:newSubPaid, amount:newTotal, paid:allPaid, paidDate:allPaid?paidDate:"" };
                        });
                        nextExp[catId] = cleanedEntries;
                      }
                      const nextCats = appData.categories.map((c,i)=>i===modal.idx?{...c,...catData}:c);
                      useBudgetStore.getState()._save({ ...appData, categories:nextCats, expenses:nextExp });
                      flash("Category updated!");
                    } else {
                      updateCategory(modal.idx, catData);
                      flash("Category updated!");
                    }
                  }
                  setModal(null);
                }}
                onClose={()=>setModal(null)} />
            )}
            {modal.type==="confirmDeleteCat" && (
              <div style={S.modalContent}>
                <h2 style={S.modalTitle}>Delete Category</h2>
                <p style={{color:"var(--text2)",fontSize:14,marginTop:8,marginBottom:20}}>
                  Are you sure you want to delete <strong>{modal.catName}</strong>? All expense data for this category will be permanently lost.
                </p>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>setModal(null)} style={S.btnGhostModal}>Cancel</button>
                  <button onClick={()=>{deleteCategory(modal.idx);if(catIdx>=categories.length-1)setCatIdx(Math.max(0,categories.length-2));flash("Category deleted!");setModal(null);}} className="btn-hover" style={{...S.btnPrimary,flex:1,background:"var(--red)"}}>Delete</button>
                </div>
              </div>
            )}
            {(modal.type==="addFixedIncome"||modal.type==="editFixedIncome") && (
              <FixedIncomeModal src={modal.src||null}
                onSave={(src)=>{
                  if(modal.type==="addFixedIncome") addFixedIncome(src);
                  else updateFixedIncome(modal.idx, src);
                  flash("Saved!");setModal(null);
                }} onClose={()=>setModal(null)} />
            )}
            {(modal.type==="addVarIncome"||modal.type==="editVarIncome") && (
              <VarIncomeModal item={modal.item||null}
                onSave={(item)=>{
                  if(modal.type==="addVarIncome") addVarIncome(item);
                  else updateVarIncome(variableIncomes.findIndex(v=>v.id===modal.item.id), item);
                  flash("Saved!");setModal(null);
                }} onClose={()=>setModal(null)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════ EXPENSE MODAL ═══════════ */
function ExpenseModal({ catObj, monthKey, monthLabel, entry, catMaxYear, suggestedDay, onSave, onDelete, onReorderSubs, onClose }) {
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

/* ═══════════ CATEGORY FORM MODAL ═══════════ */
function CategoryFormModal({ editing, category, onSave, onClose }) {
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

/* ═══════════ FIXED INCOME MODAL ═══════════ */
function FixedIncomeModal({ src, onSave, onClose }) {
  const [name, setName] = useState(src?.name || "");
  const [records, setRecords] = useState(src?.records ? src.records.map(r=>({...r})) : [{ amount: "", effectiveFrom: mk(getCY(), getCM()) }]);
  const addRecord = () => setRecords(p => [...p, { amount: "", effectiveFrom: mk(getCY(), getCM()) }]);
  const updateRec = (i, key, val) => setRecords(p => p.map((r, ri) => ri === i ? { ...r, [key]: val } : r));
  const removeRec = (i) => setRecords(p => p.filter((_, ri) => ri !== i));
  const years = Array.from({length:getCY()-MIN_YEAR+11},(_,i)=>MIN_YEAR+i);

  const handleSave = () => {
    if (!name.trim()) return;
    const clean = records.filter(r => r.amount !== "" && !isNaN(+r.amount)).map(r => ({ ...r, amount: +r.amount }));
    if (clean.length === 0) return;
    onSave({ name: name.trim(), records: clean });
  };

  return (
    <div style={S.modalContent}>
      <h2 style={S.modalTitle}>{src ? "Edit" : "Add"} Fixed Income</h2>
      <label style={S.label}>Income Source Name *</label>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Salary" style={{width:"100%",marginBottom:16}} autoFocus />
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <label style={{...S.label,marginBottom:0}}>Amount Records</label>
        <button onClick={addRecord} style={{...S.btnSmall,fontSize:12}}>+ Add Change</button>
      </div>
      <p style={{fontSize:12,color:"var(--muted)",marginBottom:10}}>Add multiple records to schedule raises. Each takes effect from the month you choose.</p>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {records.map((r,i)=>{
          const {y,m}=parseMk(r.effectiveFrom);
          return (
            <div key={i} style={{display:"flex",gap:8,alignItems:"center",background:"var(--chip2)",padding:10,borderRadius:10,flexWrap:"wrap"}}>
              <input type="number" value={r.amount} onChange={e=>updateRec(i,"amount",e.target.value)} placeholder="Amount" style={{flex:1,minWidth:80}} />
              <span style={{fontSize:12,color:"var(--muted)"}}>from</span>
              <select value={m} onChange={e=>updateRec(i,"effectiveFrom",mk(y,+e.target.value))} style={{width:75}}>
                {MONTHS.map((mn,mi)=><option key={mi} value={mi}>{mn}</option>)}
              </select>
              <select value={y} onChange={e=>updateRec(i,"effectiveFrom",mk(+e.target.value,m))} style={{width:75}}>
                {years.map(yr=><option key={yr} value={yr}>{yr}</option>)}
              </select>
              {records.length>1&&<button onClick={()=>removeRec(i)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--red)"}}>✕</button>}
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",gap:8,marginTop:20}}>
        <button onClick={onClose} style={S.btnGhostModal}>Cancel</button>
        <button onClick={handleSave} className="btn-hover" style={{...S.btnPrimary,flex:1}}>Save</button>
      </div>
    </div>
  );
}

/* ═══════════ VARIABLE INCOME MODAL ═══════════ */
function VarIncomeModal({ item, onSave, onClose }) {
  const [name, setName] = useState(item?.name || "");
  const [amount, setAmount] = useState(item?.amount ?? "");
  const defMonth = item?.month || mk(getCY(), getCM());
  const {y:iy,m:im} = parseMk(defMonth);
  const [month, setMonth] = useState(im);
  const [year, setYear] = useState(iy);
  const years = Array.from({length:getCY()-MIN_YEAR+6},(_,i)=>MIN_YEAR+i);

  return (
    <div style={S.modalContent}>
      <h2 style={S.modalTitle}>{item ? "Edit" : "Add"} Variable Income</h2>
      <label style={S.label}>Description *</label>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Freelance project" style={{width:"100%",marginBottom:14}} autoFocus />
      <label style={S.label}>Amount *</label>
      <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" style={{width:"100%",marginBottom:14}} />
      <label style={S.label}>For Month</label>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <select value={month} onChange={e=>setMonth(+e.target.value)} style={{flex:1}}>
          {MONTHS.map((mn,mi)=><option key={mi} value={mi}>{mn}</option>)}
        </select>
        <select value={year} onChange={e=>setYear(+e.target.value)} style={{flex:1}}>
          {years.map(y=><option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div style={{display:"flex",gap:8,marginTop:6}}>
        <button onClick={onClose} style={S.btnGhostModal}>Cancel</button>
        <button onClick={()=>{
          if(!name.trim()||amount===""||isNaN(+amount)) return;
          onSave({name:name.trim(),amount:+amount,month:mk(year,month)});
        }} className="btn-hover" style={{...S.btnPrimary,flex:1}}>Save</button>
      </div>
    </div>
  );
}

/* ═══════════ LOANS VIEW ═══════════ */
function LoansView({ loanTypes, getLoanAmountForMonth, expYear, setExpYear, onAdd, onUpdate, onDelete, loanPaid, toggleLoanPaid, setLoanPaidDate, toggleAllLoansPaid, paidPicker, setPaidPicker }) {
  const [editLoan, setEditLoan] = useState(null); // null | { isNew, id?, name, amount, startFrom, endAt }
  const catMaxYear = getCY() + 35;
  const years = Array.from({length:getCY()-MIN_YEAR+36},(_,i)=>MIN_YEAR+i);

  const openNew = () => setEditLoan({ isNew: true, name: "", loanNumber: "", amount: "", startFrom: mk(getCY(), getCM()), endAt: mk(getCY() + 1, getCM()) });
  const openEdit = (lt) => setEditLoan({ isNew: false, id: lt.id, name: lt.name, loanNumber: lt.loanNumber || "", amount: lt.amount ?? "", startFrom: lt.startFrom || mk(getCY(), getCM()), endAt: lt.endAt || mk(getCY() + 1, getCM()) });

  const handleSave = () => {
    if (!editLoan.name.trim() || editLoan.amount === "" || isNaN(+editLoan.amount)) return;
    if (editLoan.endAt < editLoan.startFrom) return;
    const data = { name: editLoan.name.trim(), loanNumber: editLoan.loanNumber.trim(), amount: +editLoan.amount, startFrom: editLoan.startFrom, endAt: editLoan.endAt };
    if (editLoan.isNew) onAdd(data);
    else onUpdate(editLoan.id, data);
    setEditLoan(null);
  };

  const setField = (key, val) => setEditLoan(prev => ({ ...prev, [key]: val }));

  const yearTotal = MONTHS.reduce((s, _, mi) => {
    const key = mk(expYear, mi);
    return s + loanTypes.reduce((ls, lt) => ls + getLoanAmountForMonth(lt, key), 0);
  }, 0);

  const fmtRange = (lt) => {
    if (!lt.startFrom || !lt.endAt) return "No dates set";
    const s = parseMk(lt.startFrom);
    const e = parseMk(lt.endAt);
    return `${MONTHS[s.m]} ${s.y} → ${MONTHS[e.m]} ${e.y}`;
  };

  return (
    <div>
      <div style={S.yearNav}>
        <button onClick={() => expYear > MIN_YEAR && setExpYear(y=>y-1)} className="year-btn-h" style={{...S.yearBtn,opacity:expYear>MIN_YEAR?1:.3}}>◂</button>
        <span style={S.yearLabel}>{expYear}</span>
        <button onClick={() => expYear < catMaxYear-1 && setExpYear(y=>y+1)} className="year-btn-h" style={{...S.yearBtn,opacity:expYear<catMaxYear-1?1:.3}}>▸</button>
        <span style={S.yearRange}>range: {MIN_YEAR} – {catMaxYear - 1}</span>
      </div>

      {/* Loan types cards */}
      <div style={{background:"var(--card)",borderRadius:14,border:"1.5px solid var(--border)",padding:16,marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <span style={{fontSize:12,fontWeight:600,color:"var(--muted)",textTransform:"uppercase",letterSpacing:.8}}>Your Loans</span>
          <button onClick={openNew} className="btn-hover" style={{...S.btnPrimary,fontSize:12,padding:"7px 14px"}}>+ Add Loan</button>
        </div>
        {loanTypes.length === 0 ? (
          <p style={{fontSize:13,color:"var(--faintest)",fontStyle:"italic",textAlign:"center",padding:"12px 0"}}>No loans added yet. Click "+ Add Loan" to get started.</p>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {loanTypes.map((lt, li) => (
              <div key={lt.id} className="hov stagger-card" onClick={()=>openEdit(lt)}
                style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:10,cursor:"pointer",border:"1px solid var(--border-light)",transition:"background .15s, border-color .2s, box-shadow .2s",animationDelay:`${li*60}ms`}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:14,marginBottom:2}}>{lt.name}</div>
                  <div style={{fontSize:12,color:"var(--muted)"}}>{fmtRange(lt)}{lt.loanNumber ? ` · #${lt.loanNumber}` : ""}</div>
                </div>
                <div style={{fontSize:18,fontWeight:700,color:"var(--red)",fontFamily:"'Space Grotesk',sans-serif"}}>{fmt(lt.amount || 0)}<span style={{fontSize:11,fontWeight:400,color:"var(--muted)",fontFamily:"'DM Sans',sans-serif"}}>/mo</span></div>
                <span onClick={(e)=>{e.stopPropagation();onDelete(lt.id);}} style={{cursor:"pointer",opacity:.35,fontSize:13,padding:4}} title="Delete">✕</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Monthly view */}
      {loanTypes.length > 0 && (
        <>
          <div style={{...S.listWrap,overflowX:"auto"}}>
            <div style={{...S.listHeader,minWidth:80+loanTypes.length*120+90+170}}>
              <span style={{width:80}}>Month</span>
              {loanTypes.map(lt => (
                <span key={lt.id} style={{width:120,textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lt.name}</span>
              ))}
              <span style={{width:90,textAlign:"right",fontWeight:700}}>Total</span>
              <span style={{width:170}}>Paid</span>
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
                <div key={mi} style={{...S.listRow,...(isCurrent?S.listRowCurrent:{}),...(isPast?{opacity:.5}:{}),minWidth:80+loanTypes.length*120+90+170}}>
                  <span style={{width:80,fontWeight:600,fontSize:13,color:"var(--text2)",display:"flex",alignItems:"center",gap:6}}>
                    {mName}
                    {isCurrent && <span style={S.nowBadge}>now</span>}
                  </span>
                  {loanTypes.map(lt => {
                    const val = getLoanAmountForMonth(lt, key);
                    const isPd = loanPaid[lt.id]?.[key]?.paid;
                    return (
                      <span key={lt.id} style={{width:120,textAlign:"right",fontSize:16,fontWeight:val?700:400,color:val?(isPd?"var(--accent)":"var(--text)"):"var(--faint)",display:"flex",alignItems:"center",justifyContent:"flex-end",gap:4}}>
                        {val ? fmt(val) : "—"}
                        {val > 0 && isPd && <span style={{fontSize:9,color:"var(--accent)"}}>✓</span>}
                      </span>
                    );
                  })}
                  <span style={{width:90,textAlign:"right",fontSize:16,fontWeight:700,color:rowTotal>0?"var(--red)":"var(--faint)"}}>
                    {rowTotal > 0 ? fmt(rowTotal) : "—"}
                  </span>
                  <span style={{width:170,display:"flex",alignItems:"center",gap:6}}>
                    {activeLTs.length > 0 ? (
                      paidPicker?.loanMonth===key ? (
                          <DatePicker value={anyPaidDate||today()} autoFocus compact
                            monthKey={key}
                            onChange={d=>{
                              const ids = activeLTs.filter(lt=>!loanPaid[lt.id]?.[key]?.paid).map(lt=>lt.id);
                              if (ids.length) ids.forEach(id=>setLoanPaidDate(id,key,d));
                              else activeLTs.forEach(lt=>setLoanPaidDate(lt.id,key,d));
                              setPaidPicker(null);
                            }}
                            onBlur={()=>setTimeout(()=>setPaidPicker(null),200)}
                            style={{border:"1.5px solid var(--accent)",color:"var(--text)"}} />
                      ) : allPaid ? (
                        <>
                          <span onClick={()=>toggleAllLoansPaid(activeLTs.map(lt=>lt.id),key)}
                            style={{width:18,height:18,borderRadius:5,background:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                            <span style={{color:"#fff",fontSize:11,lineHeight:1}}>✓</span>
                          </span>
                          <span onClick={()=>setPaidPicker({loanMonth:key})}
                            style={{fontSize:11,color:"var(--accent)",fontWeight:500,cursor:"pointer",borderBottom:"1px dashed var(--accent)"}}>
                            {fmtDate(anyPaidDate)}
                          </span>
                        </>
                      ) : (
                        <span onClick={()=>setPaidPicker({loanMonth:key})} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                          <span style={{width:18,height:18,borderRadius:5,border:"1.5px solid var(--faint)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}/>
                          {paidCount > 0 ? <span style={{fontSize:11,color:"var(--amber)"}}>{paidCount}/{activeLTs.length}</span> : <span style={{fontSize:11,color:"var(--faint)"}}>unpaid</span>}
                        </span>
                      )
                    ) : <span style={{color:"var(--faint)",fontSize:13}}>—</span>}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={S.yearTotal}>
            <span style={{color:"var(--muted)"}}>Total for {expYear}:</span>
            <span style={{fontWeight:600,fontSize:18,color:"var(--text)"}}>{fmt(yearTotal)}</span>
          </div>
        </>
      )}

      {/* Add / Edit Loan Modal */}
      {editLoan && (
        <div onClick={()=>setEditLoan(null)} className="overlay-mobile" style={S.overlay}>
          <div onClick={e=>e.stopPropagation()} className="modal-mobile" style={{animation:"slideUp .25s"}}>
            <div style={S.modalContent}>
              <h2 style={S.modalTitle}>{editLoan.isNew ? "Add" : "Edit"} Loan</h2>

              <label style={S.label}>Loan Name *</label>
              <input value={editLoan.name} onChange={e=>setField("name",e.target.value)} placeholder="e.g. Car Loan" style={{width:"100%",marginBottom:14}} autoFocus />

              <label style={S.label}>Loan Number</label>
              <input value={editLoan.loanNumber} onChange={e=>setField("loanNumber",e.target.value)} placeholder="e.g. LN-2026-00421" style={{width:"100%",marginBottom:14}} />

              <label style={S.label}>Monthly Amount *</label>
              <input type="number" value={editLoan.amount} onChange={e=>setField("amount",e.target.value)} placeholder="0.00" style={{width:"100%",marginBottom:14}} />

              <label style={S.label}>Start Date</label>
              <div style={{display:"flex",gap:8,marginBottom:14}}>
                <select value={parseMk(editLoan.startFrom).m} onChange={e=>setField("startFrom",mk(parseMk(editLoan.startFrom).y,+e.target.value))} style={{flex:1}}>
                  {MONTHS.map((mn,mi)=><option key={mi} value={mi}>{mn}</option>)}
                </select>
                <select value={parseMk(editLoan.startFrom).y} onChange={e=>setField("startFrom",mk(+e.target.value,parseMk(editLoan.startFrom).m))} style={{flex:1}}>
                  {years.map(y=><option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              <label style={S.label}>End Date</label>
              <div style={{display:"flex",gap:8,marginBottom:14}}>
                <select value={parseMk(editLoan.endAt).m} onChange={e=>setField("endAt",mk(parseMk(editLoan.endAt).y,+e.target.value))} style={{flex:1}}>
                  {MONTHS.map((mn,mi)=><option key={mi} value={mi}>{mn}</option>)}
                </select>
                <select value={parseMk(editLoan.endAt).y} onChange={e=>setField("endAt",mk(+e.target.value,parseMk(editLoan.endAt).m))} style={{flex:1}}>
                  {years.map(y=><option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              {editLoan.endAt < editLoan.startFrom && (
                <p style={{fontSize:12,color:"var(--red)",marginBottom:10}}>End date must be after start date.</p>
              )}

              <div style={{display:"flex",gap:8,marginTop:8}}>
                <button onClick={()=>setEditLoan(null)} style={S.btnGhostModal}>Cancel</button>
                <button onClick={handleSave} className="btn-hover" style={{...S.btnPrimary,flex:1}}>Save</button>
              </div>
              {!editLoan.isNew && (
                <button onClick={()=>{onDelete(editLoan.id);setEditLoan(null);}} style={S.deleteLink}>Delete this loan</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════ VIEW SELECT DROPDOWN ═══════════ */
function ViewSelect({ value, onChange, options, dark }) {
  const [open, setOpen] = useState(false);
  const [anim, setAnim] = useState(false);
  const ref = useRef(null);

  const openFn = () => {
    setOpen(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setAnim(true)));
  };
  const closeFn = () => {
    setAnim(false);
    setTimeout(() => setOpen(false), 150);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) closeFn(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = options.find(o => o.id === value);
  const accent = dark ? "#68C0A4" : "#1A9E76";
  const accentAlpha = dark ? "rgba(104,192,164," : "rgba(26,158,118,";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => open ? closeFn() : openFn()}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "5px 10px 5px 13px", borderRadius: 20,
          border: `1px solid ${open ? accent : "var(--border)"}`,
          background: open ? `${accentAlpha}0.1)` : (dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"),
          color: "var(--text)", fontSize: 12, cursor: "pointer",
          fontFamily: "inherit", fontWeight: 500, whiteSpace: "nowrap",
          transition: "border-color .15s, background .15s, box-shadow .15s",
          boxShadow: open ? `0 0 0 3px ${accentAlpha}0.15)` : "none",
          outline: "none",
        }}
      >
        {current?.label ?? "Select…"}
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none"
          style={{ transition: "transform .2s", transform: open ? "rotate(180deg)" : "rotate(0deg)", opacity: 0.5, flexShrink: 0 }}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 7px)", right: 0, minWidth: 196,
          background: dark ? "rgba(14,14,22,0.96)" : "rgba(255,255,255,0.97)",
          border: `1px solid ${dark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.07)"}`,
          borderRadius: 14,
          boxShadow: dark
            ? "0 20px 56px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)"
            : "0 12px 40px rgba(0,0,0,0.13), 0 2px 8px rgba(0,0,0,0.06)",
          backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
          zIndex: 400, overflow: "hidden",
          opacity: anim ? 1 : 0,
          transform: anim ? "translateY(0) scale(1)" : "translateY(-10px) scale(0.94)",
          transformOrigin: "top right",
          transition: "opacity 0.15s cubic-bezier(0.4,0,0.2,1), transform 0.15s cubic-bezier(0.4,0,0.2,1)",
          pointerEvents: anim ? "auto" : "none",
        }}>
          <div style={{ padding: "5px" }}>
            {options.map(o => {
              const active = o.id === value;
              return (
                <div
                  key={o.id}
                  onMouseDown={e => { e.preventDefault(); onChange(o.id); closeFn(); }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = active ? `${accentAlpha}0.14)` : "transparent"; }}
                  style={{
                    padding: "7px 10px", borderRadius: 9, fontSize: 12,
                    cursor: "pointer", display: "flex", alignItems: "center",
                    justifyContent: "space-between", gap: 8, userSelect: "none",
                    background: active ? `${accentAlpha}0.14)` : "transparent",
                    color: active ? accent : "var(--text)",
                    fontWeight: active ? 600 : 400,
                    transition: "background .1s",
                  }}
                >
                  {o.label}
                  {active && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════ BUDGET CHART CONSTANTS ═══════════ */
const BREAKDOWN_VIEWS = [
  {id:"pie",label:"Pie Chart"},{id:"concentric",label:"Concentric Diagram"},
  {id:"circular",label:"Circular Chart"},{id:"sunburst",label:"Sunburst Chart"},
  {id:"nightingale",label:"Nightingale Chart"},{id:"fan",label:"Fan Chart"},
  {id:"windrose",label:"Windrose Chart"},{id:"marimeko",label:"Marimeko Chart"},
  {id:"barcode",label:"Barcode Chart"},
];
const TREND_VIEWS = [
  {id:"line",label:"Line Chart"},{id:"spline",label:"Spline Chart"},
  {id:"step-line",label:"Step Line Chart"},{id:"stacked-area",label:"Stacked Area Chart"},
  {id:"stacked-bar",label:"Stacked Bar Chart"},{id:"stacked-column",label:"Stacked Column Chart"},
  {id:"treemap",label:"Treemap"},{id:"convex-treemap",label:"Convex Treemap"},
  {id:"stream",label:"Stream Graph"},{id:"bump-area",label:"Bump Area Chart"},
];

function NightingaleChart({ data, dark }) {
  const W=210,H=210,cx=105,cy=105,maxR=88;
  if(!data.length) return null;
  const n=data.length,maxV=Math.max(...data.map(d=>d.value),1),step=(2*Math.PI)/n;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
      {[.25,.5,.75,1].map(t=><circle key={t} cx={cx} cy={cy} r={maxR*t} fill="none" stroke={dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.05)"}/>)}
      {data.map((d,i)=>{
        const sa=i*step-Math.PI/2,ea=sa+step-0.04,r=Math.sqrt(d.value/maxV)*maxR;
        const x1=cx+Math.cos(sa)*r,y1=cy+Math.sin(sa)*r,x2=cx+Math.cos(ea)*r,y2=cy+Math.sin(ea)*r;
        return <path key={i} d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2} Z`} fill={d.color} fillOpacity={0.85} stroke={dark?"#1a1a2e":"#fff"} strokeWidth={1}/>;
      })}
    </svg>
  );
}

function SunburstChart({ catBreakdown, catTrendData, dark }) {
  const W=210,H=210,cx=105,cy=105;
  if(!catBreakdown.length) return null;
  const total=catBreakdown.reduce((s,d)=>s+d.value,0);
  if(!total) return null;
  const arc=(sa,ea,r1,r2)=>{
    const lg=ea-sa>Math.PI?1:0,c=Math.cos,s=Math.sin;
    return `M${cx+c(sa)*r1},${cy+s(sa)*r1} A${r1},${r1} 0 ${lg},1 ${cx+c(ea)*r1},${cy+s(ea)*r1} L${cx+c(ea)*r2},${cy+s(ea)*r2} A${r2},${r2} 0 ${lg},0 ${cx+c(sa)*r2},${cy+s(sa)*r2} Z`;
  };
  let a0=-Math.PI/2;
  const inner=[],outer=[];
  catBreakdown.forEach(cat=>{
    const span=(cat.value/total)*2*Math.PI,a1=a0+span;
    inner.push({sa:a0,ea:a1,color:cat.color});
    const mVals=catTrendData?catTrendData.map(r=>r[cat.name]||0):[];
    const mTot=mVals.reduce((s,v)=>s+v,0);
    let ma=a0;
    mVals.forEach((v,mi)=>{
      const ms=mTot>0?(v/mTot)*span:span/12;
      if(ms>0.005) outer.push({sa:ma,ea:ma+ms,color:cat.color,op:0.4+(mi/11)*0.5});
      ma+=ms;
    });
    a0=a1;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
      <circle cx={cx} cy={cy} r={33} fill={dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.02)"}/>
      {inner.map((a,i)=><path key={`i${i}`} d={arc(a.sa,a.ea,34,62)} fill={a.color} fillOpacity={0.9} stroke={dark?"#1a1a2e":"#fff"} strokeWidth={0.8}/>)}
      {outer.map((a,i)=><path key={`o${i}`} d={arc(a.sa,a.ea,64,90)} fill={a.color} fillOpacity={a.op} stroke={dark?"#1a1a2e":"#fff"} strokeWidth={0.5}/>)}
    </svg>
  );
}

function MarimekoChart({ data }) {
  const H=190,VW=500,total=data.reduce((s,d)=>s+d.value,0);
  if(!total) return null;
  let x=0;
  const bars=data.map(d=>{const w=(d.value/total)*VW,b={x,w,color:d.color,name:d.name,value:d.value};x+=w;return b;});
  return (
    <svg viewBox={`0 0 ${VW} ${H}`} width="100%" height={H} preserveAspectRatio="none">
      {bars.map((b,i)=>(
        <g key={i}>
          <rect x={b.x+1} y={0} width={b.w-2} height={H} fill={b.color} fillOpacity={0.85}/>
          {b.w>50&&<text x={b.x+b.w/2} y={H/2-7} textAnchor="middle" fontSize={12} fontWeight="600" fill="#fff">{b.name.length>8?b.name.slice(0,7)+'…':b.name}</text>}
          {b.w>50&&<text x={b.x+b.w/2} y={H/2+10} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.75)">{b.value>=1000?(b.value/1000).toFixed(1)+'k':b.value.toFixed(0)}</text>}
        </g>
      ))}
    </svg>
  );
}

function BarcodeChart({ data, dark }) {
  const H=190;
  if(!data.length) return null;
  const maxV=Math.max(...data.map(d=>d.value),1),n=data.length;
  const VW=Math.max(n*44,200),bw=Math.min(26,VW/n-10),gap=(VW-n*bw)/(n+1);
  return (
    <svg viewBox={`0 0 ${VW} ${H+22}`} width="100%" height={H+22}>
      {data.map((d,i)=>{
        const bh=(d.value/maxV)*(H-16),x=gap+i*(bw+gap);
        return (
          <g key={i}>
            <rect x={x} y={10} width={bw} height={H-16} fill={dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)"} rx={4}/>
            <rect x={x} y={H-6-bh} width={bw} height={bh} fill={d.color} rx={4}/>
            <text x={x+bw/2} y={H+14} textAnchor="middle" fontSize={9} fill={dark?"rgba(255,255,255,0.45)":"rgba(0,0,0,0.4)"}>{d.name.slice(0,6)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ═══════════ BUDGET VIEW ═══════════ */
function BudgetView({ year, setYear, categories, expenses, getFixedIncomeForMonth, getVarIncomeForMonth, getTotalExpensesForMonth, getPaidExpForMonth, getAnticipatedExpForMonth, getCatPaidForMonth, getExp, dark }) {
  const [breakdownView, setBreakdownView] = useState("circular");
  const [trendView, setTrendView] = useState("stacked-bar");
  const [selectedCats, setSelectedCats] = useState([]); // empty = all categories
  const [hiddenBkdCats, setHiddenBkdCats] = useState(new Set());
  const toggleCat = (name) => setSelectedCats(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  const toggleBkdCat = (name) => setHiddenBkdCats(prev => { const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next; });
  const cc = { accent: dark?"#68C0A4":"#1A9E76", red: dark?"#F06B5E":"#D4453A", amber: dark?"#F5C542":"#C8850A",
    grid: dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.06)", tick: dark?"#6A6A72":"#9A9AA0", anticipated: dark?"#C8850A":"#F2C8A0",
    green: dark?"#68C0A4":"#1A9E76" };

  const monthlyData = MONTHS.map((mName, mi) => {
    const key = mk(year, mi);
    const fixed = getFixedIncomeForMonth(key);
    const variable = getVarIncomeForMonth(key);
    const paid = getPaidExpForMonth(key);
    const anticipated = getAnticipatedExpForMonth(key);
    return { month: mName, fixedIncome: fixed, varIncome: variable, totalIncome: fixed + variable, paid, anticipated, balance: fixed + variable - paid };
  });

  const yearTotals = monthlyData.reduce((a, d) => ({
    income: a.income + d.totalIncome,
    paid: a.paid + d.paid, anticipated: a.anticipated + d.anticipated,
    balance: a.balance + d.balance,
  }), { income:0, paid:0, anticipated:0, balance:0 });

  /* Category breakdown — based on actual paid amounts (by paidDate) */
  const catBreakdown = categories.map((c, i) => {
    const total = MONTHS.reduce((s,_,mi) => s + getCatPaidForMonth(c.id, mk(year, mi)), 0);
    return { name: c.name, value: total, color: CHART_COLORS[i % CHART_COLORS.length] };
  }).filter(d => d.value > 0);
  const activeCatBreakdown = catBreakdown.filter(d => !hiddenBkdCats.has(d.name));

  const catTrendData = MONTHS.map((mName, mi) => {
    const row = { month: mName };
    categories.forEach(c => { row[c.name] = getCatPaidForMonth(c.id, mk(year, mi)); });
    return row;
  });

  const activeCats = selectedCats.length === 0 ? categories : categories.filter(c => selectedCats.includes(c.name));

  const tipCSS = {borderRadius:12,border:"1px solid var(--border)",boxShadow:"0 8px 32px var(--shadow-lg)",fontSize:13,background:"var(--tooltip-bg)",color:"var(--tooltip-text)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)"};
  const viewSelect = (val, set, views) => <ViewSelect value={val} onChange={set} options={views} dark={dark} />;

  const renderBreakdownChart = () => {
    const catBreakdown = activeCatBreakdown; // use filter-aware data
    if(!catBreakdown.length) return <div style={{color:"var(--text-muted,#888)",textAlign:"center",padding:"40px 0",fontSize:13}}>{hiddenBkdCats.size>0?"All categories hidden":"No paid expenses for "+year}</div>;
    const tip = <Tooltip cursor={false} animationDuration={200} formatter={v=>fmt(v)} contentStyle={tipCSS} itemStyle={{color:"var(--tooltip-text)"}} labelStyle={{color:"var(--tooltip-text)"}}/>;
    if(breakdownView==="pie")      return <ResponsiveContainer width="100%" height={210}><PieChart><Pie data={catBreakdown} cx="50%" cy="50%" outerRadius={85} paddingAngle={2} dataKey="value" stroke="none">{catBreakdown.map((d,i)=><Cell key={i} fill={d.color}/>)}</Pie>{tip}</PieChart></ResponsiveContainer>;
    if(breakdownView==="circular") return <ResponsiveContainer width="100%" height={210}><PieChart><Pie data={catBreakdown} cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={3} dataKey="value" stroke="none">{catBreakdown.map((d,i)=><Cell key={i} fill={d.color}/>)}</Pie>{tip}</PieChart></ResponsiveContainer>;
    if(breakdownView==="fan")      return <ResponsiveContainer width="100%" height={210}><PieChart><Pie data={catBreakdown} cx="50%" cy="76%" startAngle={180} endAngle={0} innerRadius={36} outerRadius={92} dataKey="value" stroke="none">{catBreakdown.map((d,i)=><Cell key={i} fill={d.color}/>)}</Pie>{tip}</PieChart></ResponsiveContainer>;
    if(breakdownView==="concentric") {
      const tot=catBreakdown.reduce((s,d)=>s+d.value,0),n=catBreakdown.length,rW=Math.min(20,72/Math.max(n,1));
      return (
        <ResponsiveContainer width="100%" height={210}>
          <PieChart>
            {catBreakdown.map((d,i)=>{
              const r1=14+i*(rW+3),r2=r1+rW,prop=d.value/tot;
              return <Pie key={d.name} data={[{v:prop},{v:1-prop}]} dataKey="v" cx="50%" cy="50%" innerRadius={r1} outerRadius={r2} startAngle={90} endAngle={-270} stroke="none" paddingAngle={0}><Cell fill={d.color}/><Cell fill={dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.06)"}/></Pie>;
            })}
            {tip}
          </PieChart>
        </ResponsiveContainer>
      );
    }
    if(breakdownView==="windrose") return (
      <ResponsiveContainer width="100%" height={210}>
        <RadialBarChart cx="50%" cy="50%" innerRadius="8%" outerRadius="88%" data={catBreakdown.map(d=>({...d,fill:d.color}))}>
          <RadialBar minAngle={15} background clockWise dataKey="value">{catBreakdown.map((d,i)=><Cell key={i} fill={d.color}/>)}</RadialBar>
          {tip}
        </RadialBarChart>
      </ResponsiveContainer>
    );
    if(breakdownView==="nightingale") return <NightingaleChart data={catBreakdown} dark={dark}/>;
    if(breakdownView==="sunburst")    return <SunburstChart catBreakdown={catBreakdown} catTrendData={catTrendData} dark={dark}/>;
    if(breakdownView==="marimeko")    return <MarimekoChart data={catBreakdown}/>;
    if(breakdownView==="barcode")     return <BarcodeChart data={catBreakdown} dark={dark}/>;
    return null;
  };

  const renderTrendChart = () => {
    const tipProps = {animationDuration:200,formatter:v=>fmt(v),contentStyle:tipCSS};
    const col = c => CHART_COLORS[categories.indexOf(c)%CHART_COLORS.length];
    const commonAxes = (vert=false) => vert
      ? <><CartesianGrid strokeDasharray="3 3" stroke={cc.grid} horizontal={false}/>
          <XAxis type="number" tick={{fontSize:11,fill:cc.tick}} axisLine={false} tickLine={false} tickFormatter={v=>v>=1000?(v/1000).toFixed(0)+"k":`${v}`}/>
          <YAxis type="category" dataKey="month" tick={{fontSize:11,fill:cc.tick}} axisLine={false} tickLine={false} width={30}/>
          <Tooltip {...tipProps} cursor={{fill:dark?"rgba(104,192,164,0.08)":"rgba(26,158,118,0.08)"}}/></>
      : <><CartesianGrid strokeDasharray="3 3" stroke={cc.grid}/>
          <XAxis dataKey="month" tick={{fontSize:11,fill:cc.tick}} axisLine={false} tickLine={false}/>
          <YAxis tick={{fontSize:11,fill:cc.tick}} axisLine={false} tickLine={false} tickFormatter={v=>v>=1000?(v/1000).toFixed(0)+"k":`${v}`}/>
          <Tooltip {...tipProps} cursor={{fill:dark?"rgba(104,192,164,0.08)":"rgba(26,158,118,0.08)",radius:6}}/></>;

    if(trendView==="line"||trendView==="spline"||trendView==="step-line") {
      const type=trendView==="spline"?"monotone":trendView==="step-line"?"step":"linear";
      return <ResponsiveContainer width="100%" height={210}><LineChart data={catTrendData}>{commonAxes()}<Legend wrapperStyle={{fontSize:11}}/>{activeCats.map(c=><Line key={c.id} type={type} dataKey={c.name} stroke={col(c)} strokeWidth={2} dot={false}/>)}</LineChart></ResponsiveContainer>;
    }
    if(trendView==="stacked-area"||trendView==="stream") {
      const offset=trendView==="stream"?"wiggle":"none";
      return (
        <ResponsiveContainer width="100%" height={210}>
          <AreaChart data={catTrendData} stackOffset={offset}>
            <defs>{activeCats.map(c=>{const cl=col(c);return <linearGradient key={c.id} id={`ag_${c.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={cl} stopOpacity={0.75}/><stop offset="95%" stopColor={cl} stopOpacity={0.12}/></linearGradient>;})}</defs>
            {commonAxes()}<Legend wrapperStyle={{fontSize:11}}/>
            {activeCats.map(c=><Area key={c.id} type="monotone" dataKey={c.name} stackId="a" stroke={col(c)} fill={`url(#ag_${c.id})`} strokeWidth={1.5}/>)}
          </AreaChart>
        </ResponsiveContainer>
      );
    }
    if(trendView==="stacked-bar") return (
      <ResponsiveContainer width="100%" height={210}>
        <BarChart data={catTrendData}>{commonAxes()}
          {activeCats.map(c=><Bar key={c.id} dataKey={c.name} stackId={selectedCats.length!==1?"a":undefined} fill={col(c)} radius={selectedCats.length===1?[4,4,0,0]:undefined}/>)}
        </BarChart>
      </ResponsiveContainer>
    );
    if(trendView==="stacked-column") return (
      <ResponsiveContainer width="100%" height={210}>
        <BarChart data={catTrendData} layout="vertical">{commonAxes(true)}
          {activeCats.map(c=><Bar key={c.id} dataKey={c.name} stackId="a" fill={col(c)}/>)}
        </BarChart>
      </ResponsiveContainer>
    );
    if(trendView==="treemap"||trendView==="convex-treemap") {
      const tmData=activeCats.map(c=>({name:c.name,size:MONTHS.reduce((s,_,mi)=>s+getCatPaidForMonth(c.id,mk(year,mi)),0),color:col(c)})).filter(d=>d.size>0);
      if(!tmData.length) return <div style={{padding:40,textAlign:"center",color:"var(--text-muted,#888)",fontSize:13}}>No paid expenses</div>;
      const isConvex=trendView==="convex-treemap";
      return (
        <ResponsiveContainer width="100%" height={210}>
          <Treemap data={tmData} dataKey="size" stroke="none" animationDuration={300}
            content={({x,y,width,height,name,color:clr,depth})=>{
              if(!width||!height||width<3||height<3||depth===0) return null;
              const rx=isConvex?10:2,pad=isConvex?3:1;
              return <g><rect x={x+pad} y={y+pad} width={width-pad*2} height={height-pad*2} rx={rx} ry={rx} fill={clr}/>{width>55&&height>28&&<text x={x+width/2} y={y+height/2} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight="600" fill="#fff">{name}</text>}</g>;
            }}
          />
        </ResponsiveContainer>
      );
    }
    if(trendView==="bump-area") {
      const n=activeCats.length;
      if(!n) return null;
      const rankData=MONTHS.map((mName,mi)=>{
        const row={month:mName};
        const vals=activeCats.map(c=>({name:c.name,v:catTrendData[mi]?.[c.name]||0})).sort((a,b)=>b.v-a.v);
        vals.forEach((v,ri)=>{row[v.name]=ri+1;});
        activeCats.forEach(c=>{if(row[c.name]===undefined) row[c.name]=n;});
        return row;
      });
      return (
        <ResponsiveContainer width="100%" height={210}>
          <LineChart data={rankData}>
            <CartesianGrid strokeDasharray="3 3" stroke={cc.grid}/>
            <XAxis dataKey="month" tick={{fontSize:11,fill:cc.tick}} axisLine={false} tickLine={false}/>
            <YAxis reversed domain={[1,n||1]} tickCount={n} tick={{fontSize:11,fill:cc.tick}} axisLine={false} tickLine={false} tickFormatter={v=>`#${v}`}/>
            <Tooltip {...tipProps} formatter={(v,name)=>[`Rank #${v}`,name]}/>
            <Legend wrapperStyle={{fontSize:11}}/>
            {activeCats.map(c=><Line key={c.id} type="monotone" dataKey={c.name} stroke={col(c)} strokeWidth={3} dot={{r:4,fill:col(c)}}/>)}
          </LineChart>
        </ResponsiveContainer>
      );
    }
    return null;
  };

  return (
    <div style={{animation:"fadeIn .35s"}}>
      <div style={{...S.yearNav,marginBottom:24}}>
        <button onClick={()=>setYear(y=>y-1)} className="year-btn-h" style={S.yearBtn}>◂</button>
        <span style={S.yearLabel}>{year}</span>
        <button onClick={()=>setYear(y=>y+1)} className="year-btn-h" style={S.yearBtn}>▸</button>
      </div>

      <div className="budget-grid-3" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:14,marginBottom:28}}>
        {[
          { label:"Total Income", value:yearTotals.income, color:"var(--accent)", icon:"↑", sub:null },
          { label:"Paid Expenses", value:yearTotals.paid, color:"var(--red)", icon:"↓", sub:null },
          { label:"Anticipated", value:yearTotals.anticipated, color:"var(--amber)", icon:"◷", sub:"unpaid entries" },
          { label:"Net Balance", value:yearTotals.balance, color:yearTotals.balance>=0?"var(--accent)":"var(--red)", icon:"◎", sub:"income − paid" },
        ].map((c,i)=>(
          <div key={i} className="summary-h stagger-card glass-card chart-3d" style={{...S.summaryCard,animationDelay:`${i*80}ms`,position:"relative",transformStyle:"preserve-3d"}}>
            <span style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1.2,fontWeight:600,fontFamily:"'Space Grotesk',sans-serif"}}>{c.icon} {c.label}</span>
            <div style={{fontSize:28,fontWeight:700,color:c.color,marginTop:8,fontFamily:"'Space Grotesk',sans-serif",letterSpacing:"-0.5px"}}>{fmt(c.value)}</div>
            {c.sub && <div style={{fontSize:11,color:"var(--muted)",marginTop:4}}>{c.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <div className="stagger-card glass-card chart-3d" style={{...S.chartCard,animationDelay:"100ms",position:"relative",transformStyle:"preserve-3d"}}>
          <h3 style={S.chartTitle}>Monthly Income vs Expenses</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} barGap={2}>
              <defs><filter id="bar3dBlur"><feGaussianBlur stdDeviation="6"/></filter></defs>
              <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} />
              <XAxis dataKey="month" tick={{fontSize:11,fill:cc.tick}} axisLine={false} tickLine={false} />
              <YAxis tick={{fontSize:11,fill:cc.tick}} axisLine={false} tickLine={false} tickFormatter={v=>v>=1000?(v/1000).toFixed(0)+"k":`${v}`} />
              <Tooltip cursor={{fill:dark?"rgba(104,192,164,0.08)":"rgba(26,158,118,0.08)",radius:6}} animationDuration={200} content={({active,payload,label})=>{
                if(!active||!payload?.length) return null;
                const d = monthlyData.find(x=>x.month===label);
                return (
                  <div style={{borderRadius:12,border:"1px solid var(--border)",boxShadow:"0 8px 32px var(--shadow-lg)",fontSize:13,background:"var(--tooltip-bg)",color:"var(--tooltip-text)",padding:"12px 16px",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)"}}>
                    <div style={{fontWeight:600,marginBottom:6}}>{label}</div>
                    {payload.map((p,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",gap:16,marginBottom:2}}>
                        <span style={{display:"flex",alignItems:"center",gap:6}}><span style={{width:8,height:8,borderRadius:2,background:p.fill}}/>{p.name}</span>
                        <span style={{fontWeight:600}}>{fmt(p.value)}</span>
                      </div>
                    ))}
                    {d && <div style={{borderTop:"1px solid var(--border)",marginTop:6,paddingTop:6,display:"flex",justifyContent:"space-between",gap:16}}>
                      <span style={{fontWeight:600}}>Balance</span>
                      <span style={{fontWeight:700,color:d.balance>=0?cc.accent:cc.red}}>{fmt(d.balance)}</span>
                    </div>}
                  </div>
                );
              }} />
              <Legend wrapperStyle={{fontSize:12}} />
              <Bar dataKey="totalIncome" name="Income" fill={cc.accent} radius={[5,5,0,0]} shape={p=><Bar3D {...p} isActive={false} radius={[5,5,0,0]}/>} activeBar={p=><Bar3D {...p} isActive={true} radius={[5,5,0,0]} glowColor={dark?"rgba(104,192,164,0.5)":"rgba(26,158,118,0.4)"}/>} />
              <Bar dataKey="paid" name="Paid" stackId="exp" fill={cc.red} shape={p=><Bar3D {...p} isActive={false} radius={[0,0,0,0]}/>} activeBar={p=><Bar3D {...p} isActive={true} radius={[0,0,0,0]} glowColor={dark?"rgba(240,107,94,0.5)":"rgba(212,69,58,0.4)"}/>} />
              <Bar dataKey="anticipated" name="Anticipated" stackId="exp" fill={cc.anticipated} radius={[5,5,0,0]} shape={p=><Bar3D {...p} isActive={false} radius={[5,5,0,0]}/>} activeBar={p=><Bar3D {...p} isActive={true} radius={[5,5,0,0]} glowColor={dark?"rgba(245,197,66,0.4)":"rgba(212,160,48,0.35)"}/>} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="stagger-card glass-card chart-3d" style={{...S.chartCard,animationDelay:"200ms",position:"relative",transformStyle:"preserve-3d"}}>
          <h3 style={S.chartTitle}>Monthly Balance</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="balG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={cc.accent} stopOpacity={.15}/><stop offset="95%" stopColor={cc.accent} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} />
              <XAxis dataKey="month" tick={{fontSize:11,fill:cc.tick}} axisLine={false} tickLine={false} />
              <YAxis tick={{fontSize:11,fill:cc.tick}} axisLine={false} tickLine={false} tickFormatter={v=>v>=1000?(v/1000).toFixed(0)+"k":`${v}`} />
              <Tooltip cursor={{stroke:dark?"rgba(104,192,164,0.3)":"rgba(26,158,118,0.3)",strokeWidth:1,strokeDasharray:"4 4"}} animationDuration={200} formatter={v=>fmt(v)} contentStyle={{borderRadius:12,border:"1px solid var(--border)",boxShadow:"0 8px 32px var(--shadow-lg)",fontSize:13,background:"var(--tooltip-bg)",color:"var(--tooltip-text)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)"}} />
              <Area type="monotone" dataKey="balance" stroke={cc.accent} strokeWidth={2} fill="url(#balG)" name="Balance" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="budget-grid-2" style={{display:"grid",gridTemplateColumns:catBreakdown.length>0?"1fr 1fr":"1fr",gap:14}}>
        {catBreakdown.length > 0 && (
          <div className="stagger-card glass-card chart-3d" style={{...S.chartCard,animationDelay:"300ms",position:"relative",transformStyle:"preserve-3d"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <h3 style={{...S.chartTitle,marginBottom:0}}>Expense Breakdown</h3>
              {viewSelect(breakdownView,setBreakdownView,BREAKDOWN_VIEWS)}
            </div>
            {renderBreakdownChart()}
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:10}}>
              {catBreakdown.map(d=>{
                const hidden=hiddenBkdCats.has(d.name);
                return (
                  <button key={d.name} onClick={()=>toggleBkdCat(d.name)} style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:20,border:`1.5px solid ${!hidden?d.color:"var(--border)"}`,background:!hidden?`${d.color}22`:"transparent",color:!hidden?"var(--text)":"var(--text-muted,#999)",fontSize:11,cursor:"pointer",transition:"all .15s",fontWeight:!hidden?500:400,opacity:!hidden?1:0.55,fontFamily:"inherit"}}>
                    <span style={{width:8,height:8,borderRadius:4,background:!hidden?d.color:"var(--border)",flexShrink:0,transition:"background .15s"}}/>
                    {d.name}: {fmt(d.value)}
                  </button>
                );
              })}
              {hiddenBkdCats.size>0&&<button onClick={()=>setHiddenBkdCats(new Set())} style={{padding:"4px 10px",borderRadius:20,border:"1px dashed var(--border)",background:"transparent",color:"var(--text-muted,#999)",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Show all</button>}
            </div>
          </div>
        )}
        <div className="stagger-card glass-card chart-3d" style={{...S.chartCard,animationDelay:"350ms",position:"relative",transformStyle:"preserve-3d"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <h3 style={{...S.chartTitle,marginBottom:0}}>Spending Trends</h3>
            {viewSelect(trendView,setTrendView,TREND_VIEWS)}
          </div>
          {renderTrendChart()}
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:10}}>
            {categories.map((c,i)=>{
              const active=selectedCats.length===0||selectedCats.includes(c.name);
              const color=CHART_COLORS[i%CHART_COLORS.length];
              return (
                <button key={c.id} onClick={()=>toggleCat(c.name)} style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:20,border:`1.5px solid ${active?color:"var(--border)"}`,background:active?`${color}22`:"transparent",color:active?"var(--text)":"var(--text-muted,#999)",fontSize:11,cursor:"pointer",transition:"all .15s",fontWeight:active?500:400,opacity:active?1:0.55,fontFamily:"inherit"}}>
                  <span style={{width:8,height:8,borderRadius:4,background:active?color:"var(--border)",flexShrink:0,transition:"background .15s"}}/>
                  {c.name}
                </button>
              );
            })}
            {selectedCats.length>0&&<button onClick={()=>setSelectedCats([])} style={{padding:"4px 10px",borderRadius:20,border:"1px dashed var(--border)",background:"transparent",color:"var(--text-muted,#999)",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Show all</button>}
          </div>
        </div>
      </div>

      <div className="stagger-card glass-card chart-3d" style={{...S.chartCard,marginTop:14,animationDelay:"400ms",position:"relative",transformStyle:"preserve-3d"}}>
        <h3 style={S.chartTitle}>Monthly Detail</h3>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead>
              <tr style={{borderBottom:"2px solid var(--border)"}}>
                {["Month","Fixed Inc.","Variable Inc.","Total Inc.","Paid","Anticipated","Balance"].map(h=>(
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((d,i)=>(
                <tr key={i} className="stagger-row" style={{borderBottom:"1px solid var(--border-light)",animationDelay:`${i*30}ms`}}>
                  <td style={S.td}>{d.month}</td>
                  <td style={S.td}>{fmt(d.fixedIncome)}</td>
                  <td style={S.td}>{fmt(d.varIncome)}</td>
                  <td style={{...S.td,fontWeight:600}}>{fmt(d.totalIncome)}</td>
                  <td style={{...S.td,color:"var(--red)",fontWeight:500}}>{fmt(d.paid)}</td>
                  <td style={{...S.td,color:"var(--amber)"}}>{fmt(d.anticipated)}</td>
                  <td style={{...S.td,fontWeight:600,color:d.balance>=0?"var(--accent)":"var(--red)"}}>{fmt(d.balance)}</td>
                </tr>
              ))}
              <tr style={{borderTop:"2px solid var(--border)",fontWeight:700}}>
                <td style={S.td}>Total</td>
                <td style={S.td}>{fmt(monthlyData.reduce((s,d)=>s+d.fixedIncome,0))}</td>
                <td style={S.td}>{fmt(monthlyData.reduce((s,d)=>s+d.varIncome,0))}</td>
                <td style={S.td}>{fmt(yearTotals.income)}</td>
                <td style={{...S.td,color:"var(--red)"}}>{fmt(yearTotals.paid)}</td>
                <td style={{...S.td,color:"var(--amber)"}}>{fmt(yearTotals.anticipated)}</td>
                <td style={{...S.td,color:yearTotals.balance>=0?"var(--accent)":"var(--red)"}}>{fmt(yearTotals.balance)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ═══════════ ENHANCED DATE PICKER ═══════════ */
function DatePicker({ value, onChange, onBlur, autoFocus, style, monthKey, suggestedDay, compact }) {
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

/* ═══════════ INTRO SEQUENCE ═══════════ */
function IntroSequence({ onComplete }) {
  const canvasRef = useRef(null);
  const [textPhase, setTextPhase] = useState(0);
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const finish = useCallback(() => {
    if (!doneRef.current) { doneRef.current = true; onCompleteRef.current(); }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = window.innerWidth, H = window.innerHeight;

    const resize = () => {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const t0 = performance.now();
    const DUR = 5400;
    const mob = W < 600;
    const N = mob ? 160 : 320;

    /* Particles */
    const particles = Array.from({ length: N }, (_, i) => {
      const ba = (i / N) * Math.PI * 2;
      const scatter = Math.max(W, H) * (0.38 + Math.random() * 0.5);
      return {
        x: 0, y: 0,
        sx: Math.cos(ba + (Math.random() - 0.5) * 0.9) * scatter,
        sy: Math.sin(ba + (Math.random() - 0.5) * 0.9) * scatter,
        da: ba, dr: 75 + Math.random() * 42,
        sz: Math.random() * 3.6 + 0.8,
        ma: Math.random() * 0.5 + 0.5,
        alpha: 0, gold: Math.random() > 0.9,
        trail: [],
        os: 0.0012 + Math.random() * 0.002,
        wb: Math.random() * Math.PI * 2,
      };
    });

    /* Grid */
    const GS = mob ? 30 : 22;
    const grid = [];
    for (let gx = GS / 2; gx < W + GS; gx += GS)
      for (let gy = GS / 2; gy < H + GS; gy += GS) {
        const dx = gx - W / 2, dy = gy - H / 2;
        grid.push({ x: gx, y: gy, d: Math.sqrt(dx * dx + dy * dy), a: 0 });
      }
    const maxGD = Math.sqrt((W / 2) ** 2 + (H / 2) ** 2);

    let raf, lp = 0;

    const frame = (now) => {
      const t = now - t0;
      if (t >= DUR) { finish(); return; }
      ctx.clearRect(0, 0, W, H);
      const CX = W / 2, CY = H / 2;

      /* ── Timing curves ── */
      const sparkT  = clamp01((t - 240) / 710);
      const ringT   = clamp01((t - 640) / 1270);
      const diamT   = clamp01((t - 1670) / 1190);
      const txtT    = clamp01((t - 2540) / 710);
      const burstT  = clamp01((t - 3650) / 710);
      const fadeT   = clamp01((t - 4450) / 950);

      /* ── Grid dots with shockwave ── */
      if (ringT > 0) {
        const rr = ringT * maxGD * 1.2;
        grid.forEach(g => {
          const rd = Math.abs(g.d - rr);
          const ra = rd < 90 ? (1 - rd / 90) * 0.28 * (1 - diamT * 0.4) : 0;
          const sa = g.d < rr ? 0.05 : 0;
          const ca = g.d < 200 ? (1 - g.d / 200) * diamT * 0.22 : 0;
          g.a = (sa + ra + ca) * (1 - fadeT);
          if (g.a > 0.005) {
            ctx.fillStyle = g.a > 0.1 ? `rgba(104,192,164,${g.a})` : `rgba(180,180,190,${g.a})`;
            ctx.fillRect(g.x - 0.7, g.y - 0.7, 1.4, 1.4);
          }
        });
      }

      /* ── Initial spark ── */
      if (sparkT > 0 && fadeT < 1) {
        const pulse = 1 + Math.sin(t * 0.009) * 0.15;
        const sr = 3.5 * sparkT * pulse * (1 - ringT * 0.6) * (1 - fadeT);
        if (sr > 0.3) {
          const sg = ctx.createRadialGradient(CX, CY, 0, CX, CY, sr * 55);
          sg.addColorStop(0, `rgba(104,192,164,${0.35 * sparkT * (1 - fadeT)})`);
          sg.addColorStop(1, 'rgba(104,192,164,0)');
          ctx.fillStyle = sg;
          ctx.beginPath(); ctx.arc(CX, CY, sr * 35, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = `rgba(200,255,230,${sparkT * (1 - fadeT)})`;
          ctx.beginPath(); ctx.arc(CX, CY, sr, 0, Math.PI * 2); ctx.fill();
        }
      }

      /* ── Ambient center glow ── */
      if (diamT > 0 && fadeT < 1) {
        const ag = ctx.createRadialGradient(CX, CY, 0, CX, CY, 260);
        const ai = diamT * 0.14 * (1 - burstT * 0.4) * (1 - fadeT);
        ag.addColorStop(0, `rgba(104,192,164,${ai})`);
        ag.addColorStop(0.5, `rgba(104,192,164,${ai * 0.25})`);
        ag.addColorStop(1, 'rgba(104,192,164,0)');
        ctx.fillStyle = ag;
        ctx.beginPath(); ctx.arc(CX, CY, 260, 0, Math.PI * 2); ctx.fill();
      }

      /* ── Horizontal light crack ── */
      if (txtT > 0 && fadeT < 1) {
        const lw = easeOut3(txtT) * Math.min(W * 0.48, 360);
        const la = Math.min(txtT * 2.5, 1) * (1 - fadeT);
        ctx.save();
        ctx.shadowColor = '#68C0A4'; ctx.shadowBlur = 30;
        ctx.strokeStyle = `rgba(104,192,164,${la * 0.75})`;
        ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(CX - lw, CY); ctx.lineTo(CX + lw, CY); ctx.stroke();
        /* second softer glow line */
        ctx.shadowBlur = 60;
        ctx.strokeStyle = `rgba(104,192,164,${la * 0.2})`;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(CX - lw * 0.8, CY); ctx.lineTo(CX + lw * 0.8, CY); ctx.stroke();
        ctx.restore();
      }

      /* ── Particles ── */
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      particles.forEach(p => {
        if (ringT <= 0) return;
        const angle = p.da + t * p.os;
        /* converge from scatter to orbit ring */
        const oR = 140 + Math.sin(p.wb + t * 0.002) * 18;
        const oX = CX + Math.cos(angle) * oR;
        const oY = CY + Math.sin(angle) * oR;
        const conv = easeInOut2(clamp01(ringT * 1.4));
        p.x = _lerp(CX + p.sx, oX, conv);
        p.y = _lerp(CY + p.sy, oY, conv);
        /* morph orbit into diamond shape */
        if (diamT > 0) {
          const dA = p.da + t * p.os * 0.25;
          const dR = p.dr / (Math.abs(Math.cos(dA * 2)) * 0.5 + 0.5);
          const dx = CX + Math.cos(dA) * dR;
          const dy = CY + Math.sin(dA) * dR;
          const de = easeInOut2(diamT);
          p.x = _lerp(p.x, dx, de * 0.85);
          p.y = _lerp(p.y, dy, de * 0.85);
        }
        /* burst scatter */
        if (burstT > 0) {
          const bx = p.x - CX, by = p.y - CY;
          const bd = Math.sqrt(bx * bx + by * by) || 1;
          const bf = easeOut3(burstT) * (320 + Math.random() * 200);
          p.x += (bx / bd) * bf; p.y += (by / bd) * bf;
        }
        p.alpha = clamp01(ringT * 2.5) * p.ma * (1 - fadeT) * (1 - burstT * 0.65);
        if (p.alpha > 0.008) {
          p.trail.push({ x: p.x, y: p.y });
          if (p.trail.length > 7) p.trail.shift();
          const rgb = p.gold ? '245,197,66' : '45,212,160';
          /* trail */
          for (let j = 0; j < p.trail.length - 1; j++) {
            const ta = (j / p.trail.length) * p.alpha * 0.12;
            ctx.strokeStyle = `rgba(${rgb},${ta})`; ctx.lineWidth = p.sz * 0.3;
            ctx.beginPath(); ctx.moveTo(p.trail[j].x, p.trail[j].y);
            ctx.lineTo(p.trail[j + 1].x, p.trail[j + 1].y); ctx.stroke();
          }
          /* body */
          ctx.fillStyle = `rgba(${rgb},${p.alpha})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.sz, 0, Math.PI * 2); ctx.fill();
          /* bright core */
          if (p.sz > 1.5) {
            ctx.fillStyle = `rgba(255,255,255,${p.alpha * 0.35})`;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.sz * 0.35, 0, Math.PI * 2); ctx.fill();
          }
        }
      });
      ctx.restore();

      /* ── Burst shockwave ring ── */
      if (burstT > 0 && burstT < 1) {
        const br = easeOut3(burstT) * Math.max(W, H) * 0.72;
        const ba = (1 - burstT * burstT) * 0.32;
        ctx.save();
        ctx.shadowColor = '#68C0A4'; ctx.shadowBlur = 18;
        ctx.strokeStyle = `rgba(104,192,164,${ba})`;
        ctx.lineWidth = 2.5 * (1 - burstT);
        ctx.beginPath(); ctx.arc(CX, CY, br, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        /* brief flash at burst start */
        if (burstT < 0.12) {
          ctx.fillStyle = `rgba(104,192,164,${(1 - burstT / 0.12) * 0.12})`;
          ctx.fillRect(0, 0, W, H);
        }
      }

      /* ── Second shockwave (delayed, softer) ── */
      const burst2T = clamp01((t - 3810) / 800);
      if (burst2T > 0 && burst2T < 1) {
        const br2 = easeOut3(burst2T) * Math.max(W, H) * 0.52;
        ctx.save();
        ctx.strokeStyle = `rgba(245,197,66,${(1 - burst2T) * 0.12})`;
        ctx.lineWidth = 1.5 * (1 - burst2T);
        ctx.beginPath(); ctx.arc(CX, CY, br2, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }

      /* React text phase triggers */
      if (t > 2540 && lp < 1) { lp = 1; setTextPhase(1); }
      if (t > 4210 && lp < 2) { lp = 2; setTextPhase(2); }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [finish]);

  const mob = typeof window !== 'undefined' && window.innerWidth < 600;

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:9999, background:'#0A0A10',
      display:'flex', alignItems:'center', justifyContent:'center',
      opacity: textPhase >= 2 ? 0 : 1,
      transition:'opacity 0.65s cubic-bezier(0.22,1,0.36,1)',
      pointerEvents: textPhase >= 2 ? 'none' : 'all', cursor:'pointer',
    }} onClick={() => { setTextPhase(2); setTimeout(finish, 650); }}>
      <canvas ref={canvasRef} style={{position:'absolute',inset:0,width:'100%',height:'100%'}} />

      {/* Logo text */}
      <div style={{
        position:'relative', zIndex:1,
        display:'flex', flexDirection:'column', alignItems:'center', gap:6,
        opacity: textPhase >= 1 ? (textPhase >= 2 ? 0 : 1) : 0,
        transform: textPhase >= 1 ? (textPhase >= 2 ? 'scale(1.1)' : 'translateY(0) scale(1)') : 'translateY(18px) scale(0.88)',
        transition:'all 0.8s cubic-bezier(0.22,1,0.36,1)',
      }}>
        <h1 style={{
          fontSize: mob ? 58 : 88, fontWeight:700, fontFamily:"'Space Grotesk',sans-serif",
          color:'#E8E6E3', letterSpacing:mob?'-1.5px':'-3px', margin:0, lineHeight:1,
          textShadow:'0 0 120px rgba(104,192,164,0.65), 0 0 240px rgba(104,192,164,0.18), 0 2px 32px rgba(0,0,0,0.7)',
        }}>Summa</h1>
        <span style={{
          fontSize: mob ? 15 : 19, fontWeight:400, fontFamily:"'DM Sans',sans-serif",
          color:'rgba(232,230,227,0.7)', letterSpacing: mob?'1px':'2px',
          opacity: textPhase >= 1 ? 1 : 0,
          transition:'opacity 0.5s ease 0.15s',
          marginTop: mob ? 6 : 8,
        }}>Personal Finance, Clearly</span>
        <span style={{
          fontSize: mob ? 13 : 16, fontWeight:500, fontFamily:"'Space Grotesk',sans-serif",
          color:'#68C0A4', letterSpacing: mob?'2px':'4px', textTransform:'uppercase',
          opacity: textPhase >= 1 ? 0.85 : 0,
          transition:'opacity 0.6s ease 0.4s',
          marginTop: mob ? 16 : 22,
          textShadow:'0 0 40px rgba(104,192,164,0.35)',
        }}>Clarity across every category</span>
      </div>

      {/* Skip hint */}
      <span style={{
        position:'absolute', bottom: mob ? 32 : 40, left:'50%', transform:'translateX(-50%)',
        fontSize:11, color:'rgba(255,255,255,0.15)', fontFamily:"'DM Sans',sans-serif",
        letterSpacing:'1px', textTransform:'uppercase',
        opacity: textPhase >= 1 && textPhase < 2 ? 1 : 0,
        transition:'opacity 0.4s ease 0.5s',
      }}>tap to skip</span>
    </div>
  );
}

/* ═══════════ STYLES ═══════════ */
const S = {
  root:{background:"var(--bg)",backgroundImage:"radial-gradient(ellipse at 50% 0%, var(--accent-glow) 0%, transparent 60%)",minHeight:"100vh",fontFamily:"'DM Sans',sans-serif",color:"var(--text)",WebkitTextSizeAdjust:"100%",position:"relative"},
  loadWrap:{background:"var(--bg)",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"},
  loadText:{fontSize:16,color:"var(--muted)",fontWeight:400,fontFamily:"'Space Grotesk',sans-serif",letterSpacing:"0.3px"},
  header:{background:"var(--header-bg)",borderBottom:"1px solid var(--border)",position:"sticky",top:0,zIndex:50,transition:"box-shadow .3s",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)"},
  headerInner:{margin:"0 auto",padding:"14px 28px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12},
  logo:{fontSize:24,fontWeight:700,letterSpacing:"-0.5px",color:"var(--text)",fontFamily:"'Space Grotesk',sans-serif"},
  logoSub:{fontSize:13,color:"var(--accent)",fontWeight:500,fontFamily:"'Space Grotesk',sans-serif",letterSpacing:"0.5px",opacity:.8},
  tabs:{display:"flex",gap:3,background:"var(--chip)",borderRadius:14,padding:3,backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)"},
  tab:{padding:"9px 20px",borderRadius:11,border:"none",cursor:"pointer",background:"transparent",color:"var(--muted)",fontWeight:500,fontSize:14,fontFamily:"'DM Sans',sans-serif",transition:"all .25s",minHeight:40},
  tabActive:{background:"var(--accent)",color:"#fff",boxShadow:"0 2px 12px var(--accent-glow)"},
  main:{margin:"0 auto",padding:"28px 28px 60px"},
  catSidebar:{background:"var(--card)",borderRadius:16,border:"1px solid var(--border)",padding:14,width:240,flexShrink:0,position:"sticky",top:80,transition:"border-color .25s",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)"},
  catSidebarHeader:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,paddingBottom:8,borderBottom:"1px solid var(--border)"},
  catSidebarList:{display:"flex",flexDirection:"column",gap:2},
  catSideItem:{display:"flex",alignItems:"center",gap:6,padding:"10px 12px",borderRadius:10,border:"none",cursor:"pointer",background:"transparent",color:"var(--muted)",fontWeight:500,fontSize:14,fontFamily:"'DM Sans',sans-serif",width:"100%",transition:"all .2s",textAlign:"left",minHeight:42},
  catSideItemActive:{background:"var(--accent)",color:"#fff",boxShadow:"0 4px 16px var(--accent-glow)"},
  loanBadgeSide:{fontSize:8,padding:"2px 6px",borderRadius:4,background:"var(--accent-light)",color:"var(--accent)",fontWeight:600,whiteSpace:"nowrap"},
  yearNav:{display:"flex",alignItems:"center",gap:12,marginBottom:18},
  yearBtn:{background:"none",border:"none",cursor:"pointer",fontSize:22,color:"var(--muted)",padding:10,borderRadius:10,minWidth:44,minHeight:44,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .25s"},
  yearLabel:{fontSize:24,fontWeight:700,minWidth:60,textAlign:"center",color:"var(--text)",fontFamily:"'Space Grotesk',sans-serif",letterSpacing:"-0.3px"},
  yearRange:{fontSize:11,color:"var(--faintest)",marginLeft:8},
  listWrap:{background:"var(--card)",borderRadius:16,border:"1px solid var(--border)",overflowX:"auto",marginBottom:16,WebkitOverflowScrolling:"touch",transition:"border-color .25s",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)"},
  listHeader:{display:"flex",alignItems:"center",gap:12,padding:"10px 18px",fontSize:11,fontWeight:600,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1,borderBottom:"1px solid var(--border)",background:"var(--card-alt)",minHeight:42,backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)"},
  listRow:{display:"flex",alignItems:"center",gap:12,padding:"14px 18px",borderBottom:"1px solid var(--border-light)",cursor:"pointer",transition:"background .2s, opacity .15s",minHeight:52},
  listRowCurrent:{background:"var(--accent-bg)"},
  nowBadge:{fontSize:9,padding:"2px 8px",borderRadius:5,background:"var(--accent)",color:"#fff",fontWeight:600,animation:"popIn .3s",boxShadow:"0 0 10px var(--accent-glow)"},
  yearTotal:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",background:"var(--card)",borderRadius:14,border:"1px solid var(--border)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)"},
  sectionHead:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18,flexWrap:"wrap",gap:12},
  sectionTitle:{fontSize:24,fontWeight:700,color:"var(--text)",fontFamily:"'Space Grotesk',sans-serif",letterSpacing:"-0.3px"},
  sectionSub:{color:"var(--muted)",fontSize:13,marginTop:4},
  incomeCard:{background:"var(--card)",borderRadius:16,padding:20,border:"1px solid var(--border)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)"},
  timeChip:{fontSize:12,padding:"6px 12px",borderRadius:8,background:"var(--chip)",color:"var(--text2)",transition:"all .2s",border:"1px solid var(--border-light)"},
  tableWrap:{background:"var(--card)",borderRadius:16,border:"1px solid var(--border)",overflow:"hidden",WebkitOverflowScrolling:"touch",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)"},
  tableHeader:{display:"flex",padding:"10px 16px",fontSize:11,fontWeight:600,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1,borderBottom:"1px solid var(--border)",minHeight:42},
  tableRow:{display:"flex",alignItems:"center",padding:"12px 16px",borderBottom:"1px solid var(--border-light)",transition:"background .2s",minHeight:48},
  btnPrimary:{background:"var(--accent)",color:"#fff",border:"none",padding:"12px 22px",borderRadius:12,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",transition:"all .25s",minHeight:44,boxShadow:"0 2px 8px var(--accent-glow)"},
  btnGhost:{background:"transparent",color:"var(--muted)",border:"1px solid var(--border-input)",padding:"9px 16px",borderRadius:10,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",minHeight:40,transition:"all .25s"},
  btnGhostModal:{background:"transparent",color:"var(--muted)",border:"1px solid var(--border-input)",padding:"12px 18px",borderRadius:12,fontSize:15,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",minHeight:44,transition:"all .25s"},
  btnSmall:{background:"none",border:"1px solid var(--border-input)",padding:"6px 12px",borderRadius:8,fontSize:13,cursor:"pointer",color:"var(--text2)",fontFamily:"'DM Sans',sans-serif",minHeight:34,transition:"all .2s"},
  deleteLink:{display:"block",width:"100%",textAlign:"center",marginTop:12,padding:12,background:"none",border:"none",color:"var(--red)",fontSize:14,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",opacity:.65,minHeight:44,transition:"opacity .25s"},
  overlay:{position:"fixed",inset:0,background:"var(--overlay)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,padding:20,animation:"fadeIn .2s"},
  modalContent:{background:"var(--modal-bg)",borderRadius:24,padding:30,width:"100%",maxWidth:620,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 24px 80px var(--shadow-lg), 0 0 1px rgba(255,255,255,0.05) inset",WebkitOverflowScrolling:"touch",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",border:"1px solid var(--border)"},
  modalTitle:{fontSize:24,fontWeight:700,marginBottom:4,color:"var(--text)",fontFamily:"'Space Grotesk',sans-serif",letterSpacing:"-0.3px"},
  label:{fontSize:11,fontWeight:600,color:"var(--muted)",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1,fontFamily:"'Space Grotesk',sans-serif"},
  checkLabel:{display:"flex",alignItems:"center",fontSize:14,color:"var(--text2)",padding:"12px 14px",background:"var(--chip2)",borderRadius:12,cursor:"pointer",marginTop:4,minHeight:44,transition:"background .2s",border:"1px solid var(--border-light)"},
  summaryCard:{background:"var(--card)",borderRadius:18,padding:"22px 24px",border:"1px solid var(--border)",transition:"transform .3s cubic-bezier(.22,1,.36,1), box-shadow .3s, border-color .3s",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)"},
  chartCard:{background:"var(--card)",borderRadius:18,padding:24,border:"1px solid var(--border)",marginBottom:14,backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)"},
  chartTitle:{fontSize:15,fontWeight:600,margin:"0 0 14px",color:"var(--text)",fontFamily:"'Space Grotesk',sans-serif"},
  th:{padding:"10px 12px",textAlign:"left",fontSize:11,fontWeight:600,color:"var(--muted)",textTransform:"uppercase",letterSpacing:.5,fontFamily:"'Space Grotesk',sans-serif"},
  td:{padding:"10px 12px",textAlign:"left",color:"var(--text)"},
  toast:{position:"fixed",bottom:28,left:"50%",transform:"translateX(-50%)",zIndex:1000,background:"var(--toast-bg)",color:"var(--toast-fg)",padding:"12px 28px",borderRadius:14,fontSize:14,fontWeight:500,animation:"toastIn .3s",boxShadow:"0 8px 32px var(--shadow-lg)",maxWidth:"calc(100vw - 40px)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",border:"1px solid var(--border)"},
  emptyState:{textAlign:"center",padding:"52px 28px",color:"var(--muted)",fontSize:14,background:"var(--card)",borderRadius:18,border:"1px dashed var(--border-input)",animation:"fadeIn .4s",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)"},
};
