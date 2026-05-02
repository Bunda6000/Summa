import { useState } from "react";
import { mk, parseMk, today, fmtDate, getCY, getCM, MIN_YEAR, MONTHS } from './utils/dates';
import { fmt } from './utils/formatters';
import { reorder } from './utils/expressions';
import { CHART_COLORS } from './constants';
import useBudgetStore from './store/useBudgetStore';
import useUIStore from './store/useUIStore';
import S from './styles/shared';

// Components
import Bar3D from './components/charts/Bar3D';
import IntroSequence from './components/IntroSequence';
import DatePicker from './components/DatePicker';
import LoansView from './components/views/LoansView';
import BudgetView from './components/views/BudgetView';
import ExpenseModal from './components/modals/ExpenseModal';
import CategoryFormModal from './components/modals/CategoryFormModal';
import FixedIncomeModal from './components/modals/FixedIncomeModal';
import VarIncomeModal from './components/modals/VarIncomeModal';

// Recharts — only what BudgetApp uses directly in the dashboard
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid
} from "recharts";

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
  const cleanCategoryUpdate = useBudgetStore(state => state.cleanCategoryUpdate);
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
  const {
    tab, catIdx, expYear, budgetYear, modal, toast, paidPicker, expSel, varSel, dragIdx, introDone,
    setTab, setCatIdx, setExpYear, setBudgetYear, setModal, setPaidPicker, setExpSel, setVarSel, setDragIdx, setIntroDone, flash
  } = useUIStore();

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
                              style={{...S.listRow,...(isCurrent?S.listRowCurrent:{}),...(isPast?{opacity:.5}:{}), ...(isSel?{background:"var(--accent-bg)"}:{}), animationDelay:`${mi*25}ms`}}>
                              <span style={{width:30}} onClick={e=>e.stopPropagation()}>
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
                            <span onClick={()=>{const n=new Set(varSel);n.has(v.id)?n.delete(v.id):n.add(v.id);setVarSel(n);}}
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
                    setCatIdx(categories.length);
                    flash("Category added!");
                  } else {
                    const oldSubIds = new Set((modal.cat.subcategories||[]).map(s=>s.id));
                    const newSubIds = new Set((catData.subcategories||[]).map(s=>s.id));
                    const removedIds = [...oldSubIds].filter(id=>!newSubIds.has(id));
                    if (removedIds.length > 0) {
                      cleanCategoryUpdate(modal.idx, catData, removedIds);
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
