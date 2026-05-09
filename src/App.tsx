import { useState } from "react";
import SyncStatusIndicator from './components/SyncStatusIndicator';
import { mk, parseMk, today, fmtDate, getCY, getCM, MIN_YEAR, MONTHS } from './utils/dates';
import { fmt } from './utils/formatters';
import { reorder } from './utils/expressions';
import { CHART_COLORS } from './constants';
import useBudgetStore from './store/useBudgetStore';
import useUIStore from './store/useUIStore';
import useAuthStore from './auth/useAuthStore';
import AccountModal from './components/account/AccountModal';
import BillingModal from './components/billing/BillingModal';
import styles from './App.module.css';
import type { Category, ExpenseEntry } from './types';

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
import LockedFeature from './components/subscription/LockedFeature';
import GracePeriodBanner from './components/billing/GracePeriodBanner';

// Recharts — only what BudgetApp uses directly in the dashboard
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid
} from "recharts";

// ── Modal payload types ──
type ModalState =
  | { type: "editExp"; catId: string; catObj: Category; monthKey: string; monthLabel: string; entry: ExpenseEntry | null }
  | { type: "addCat" }
  | { type: "editCat"; idx: number; cat: Category }
  | { type: "confirmDeleteCat"; idx: number; catName: string }
  | { type: "addFixedIncome" }
  | { type: "editFixedIncome"; idx: number; src: import('./types').FixedIncome }
  | { type: "addVarIncome" }
  | { type: "editVarIncome"; item: import('./types').VariableIncome }
  | null;

// Column definition type used in expenses tab
interface ColDef {
  id: string;
  label: string;
  w?: number;
  flex?: number;
  minW?: number;
  align?: string;
  bold?: boolean;
  cell: (entry: ExpenseEntry | null, key: string) => React.ReactNode;
}

/* ═══════════ MAIN APP ═══════════ */
export default function BudgetApp() {
  // Auth
  const signOut = useAuthStore(state => state.signOut);
  const [showAccount, setShowAccount] = useState(false);
  const [showBilling, setShowBilling] = useState(false);

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
    tab, catIdx, expYear, budgetYear, modal: rawModal, toast, paidPicker, expSel, varSel, dragIdx, introDone,
    setTab, setCatIdx, setExpYear, setBudgetYear, setModal: setRawModal, setPaidPicker, setExpSel, setVarSel, setDragIdx, setIntroDone, flash
  } = useUIStore();

  // Typed modal helpers
  const modal = rawModal as ModalState;
  const setModal = (m: ModalState) => setRawModal(m as { type: string } | null);

  // Destructure appData for convenient access (guard against null)
  const { categories = [], expenses = {}, fixedIncomes = [], variableIncomes = [], loanTypes = [], loanPaid = {} } = appData || {};

  if (!introDone) return (
    <div style={{background:'#0A0A10',minHeight:'100dvh',position:'relative',overflow:'hidden'}}>
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      <IntroSequence onComplete={() => setIntroDone(true)} />
    </div>
  );

  if (!appData) return (
    <div className={`${dark?"theme-dark":"theme-light"} ${styles.loadWrap}`}>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:18,animation:"fadeIn .5s"}}>
        <div style={{width:44,height:44,border:"2px solid var(--border)",borderTopColor:"var(--accent)",borderRadius:"50%",animation:"spin .8s linear infinite",boxShadow:"0 0 20px var(--accent-glow)"}} />
        <span className={styles.loadText}>Loading Summa...</span>
      </div>
    </div>
  );

  const cat = categories[catIdx] || categories[0];
  const catMaxYear = getCY() + (cat?.maxYears || 5);

  return (
    <div className={styles.root}>

      {toast && <div className={styles.toast}>{toast}</div>}

      {showAccount && (
        <AccountModal
          onClose={() => setShowAccount(false)}
          onOpenBilling={() => { setShowAccount(false); setShowBilling(true); }}
        />
      )}
      {showBilling && <BillingModal onClose={() => setShowBilling(false)} />}

      {/* HEADER */}
      <header className={styles.header} style={{boxShadow:"var(--header-shadow)"}}>
        <div className={`header-inner ${styles.headerInner}`}>
          {/* Logo — row 1 col 1 on mobile */}
          <div className={styles.headerLogo}>
            <h1 className={styles.logo}>Summa</h1>
            <span className={styles.logoSub}>personal finance, clearly</span>
          </div>

          {/* Nav tabs — row 2 on mobile (full-width), inline on desktop */}
          <nav className={styles.tabs}>
            {([ ["dashboard","Overview"],["expenses","Expenses"],["incomes","Incomes"],["budget","Budget"] ] as [string,string][]).map(([k,label])=>(
              <button key={k} onClick={()=>setTab(k as "dashboard"|"expenses"|"incomes"|"budget")} className={`tab-btn ${styles.tab} ${tab===k ? styles.tabActive : ''}`} style={{touchAction:"manipulation"}}>
                {label}
              </button>
            ))}
          </nav>

          {/* Utility buttons — row 1 col 2 on mobile */}
          <div className={styles.headerUtils}>
            <button onClick={toggleDark} title={dark?"Light mode":"Dark mode"}
              style={{background:"var(--chip)",border:"1px solid var(--border)",borderRadius:12,padding:"9px 12px",cursor:"pointer",fontSize:18,lineHeight:1,transition:"all .35s cubic-bezier(.22,1,.36,1)",minWidth:44,minHeight:44,display:"flex",alignItems:"center",justifyContent:"center",transform:dark?"rotate(180deg)":"rotate(0deg)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",touchAction:"manipulation"}}>
              {dark ? "☀" : "☾"}
            </button>
            <button onClick={() => setShowAccount(true)} title="Account"
              style={{background:"var(--chip)",border:"1px solid var(--border)",borderRadius:12,padding:"9px 14px",cursor:"pointer",fontSize:13,fontWeight:600,color:"var(--muted)",lineHeight:1,transition:"all .2s",minHeight:44,display:"flex",alignItems:"center",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",touchAction:"manipulation"}}>
              Account
            </button>
            <button onClick={signOut} title="Logout"
              style={{background:"var(--chip)",border:"1px solid var(--border)",borderRadius:12,padding:"9px 14px",cursor:"pointer",fontSize:13,fontWeight:600,color:"var(--muted)",lineHeight:1,transition:"all .2s",minHeight:44,display:"flex",alignItems:"center",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",touchAction:"manipulation"}}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <GracePeriodBanner />

      <main className={`main-area ${styles.main}`}>

        {/* ═══ DASHBOARD TAB ═══ */}
        {tab === "dashboard" && (() => {
          const curKey = mk(getCY(), getCM());
          const curIncome = getFixedIncomeForMonth(curKey) + getVarIncomeForMonth(curKey);
          const curPaid = getPaidExpForMonth(curKey);
          const curAnticipated = getAnticipatedExpForMonth(curKey);
          const curBalance = curIncome - curPaid;

          /* Last 6 months data for mini chart */
          const miniData: {month:string;income:number;paid:number;balance:number}[] = [];
          for (let i = 5; i >= 0; i--) {
            let mm = getCM() - i, yy = getCY();
            while (mm < 0) { mm += 12; yy--; }
            const k = mk(yy, mm);
            const inc = getFixedIncomeForMonth(k) + getVarIncomeForMonth(k);
            const pd = getPaidExpForMonth(k);
            miniData.push({ month: MONTHS[mm], income: inc, paid: pd, balance: inc - pd });
          }

          /* Upcoming unpaid expenses (this month + next 3) */
          const upcoming: {cat:string;sub:string|null;amount:number;month:string;label:string}[] = [];
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
          const recent: {cat:string;sub:string|null;amount:number;paidDate:string}[] = [];
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
              <h2 className={styles.sectionTitle} style={{marginBottom:22}}>{MONTHS[getCM()]} {getCY()} Overview</h2>

              {/* Summary cards */}
              <div className="budget-grid-3" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:14,marginBottom:28}}>
                {[
                  { label:"Income", value:curIncome, color:"var(--accent)", icon:"↑" },
                  { label:"Paid", value:curPaid, color:"var(--red)", icon:"↓" },
                  { label:"Anticipated", value:curAnticipated, color:"var(--amber)", icon:"◷" },
                  { label:"Balance", value:curBalance, color:curBalance>=0?"var(--accent)":"var(--red)", icon:"◎" },
                ].map((c,i)=>(
                  <div key={i} className={`summary-h stagger-card glass-card chart-3d ${styles.summaryCard}`} style={{animationDelay:`${i*80}ms`,position:"relative",transformStyle:"preserve-3d"}}>
                    <span style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1.2,fontWeight:600,fontFamily:"'Space Grotesk',sans-serif"}}>{c.icon} {c.label}</span>
                    <div style={{fontSize:26,fontWeight:700,color:c.color,marginTop:8,fontFamily:"'Space Grotesk',sans-serif",letterSpacing:"-0.5px"}}>{fmt(c.value)}</div>
                  </div>
                ))}
              </div>

              {/* Mini chart */}
              <div className={`stagger-card glass-card chart-3d ${styles.chartCard}`} style={{animationDelay:"150ms",position:"relative",transformStyle:"preserve-3d"}}>
                <h3 className={styles.chartTitle}>Last 6 Months</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={miniData} barGap={2}>
                    <defs><filter id="bar3dBlur"><feGaussianBlur stdDeviation="6"/></filter></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.06)"} />
                    <XAxis dataKey="month" tick={{fontSize:11,fill:dark?"#6A6A72":"#9A9AA0"}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize:11,fill:dark?"#6A6A72":"#9A9AA0"}} axisLine={false} tickLine={false} tickFormatter={(v: number)=>v>=1000?(v/1000).toFixed(0)+"k":`${v}`} />
                    <Tooltip formatter={(v: number)=>fmt(v)} cursor={{fill:dark?"rgba(104,192,164,0.08)":"rgba(26,158,118,0.08)",radius:6}} contentStyle={{borderRadius:12,border:"1px solid var(--border)",boxShadow:"0 8px 32px var(--shadow-lg)",fontSize:13,background:"var(--tooltip-bg)",color:"var(--tooltip-text)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)"}} animationDuration={200} />
                    <Bar dataKey="income" name="Income" fill={dark?"#68C0A4":"#1A9E76"} radius={[5,5,0,0]} shape={(p: any)=><Bar3D {...p} isActive={false} radius={[5,5,0,0]}/>} activeBar={(p: any)=><Bar3D {...p} isActive={true} radius={[5,5,0,0]} glowColor={dark?"rgba(104,192,164,0.5)":"rgba(26,158,118,0.4)"}/>} />
                    <Bar dataKey="paid" name="Paid" fill={dark?"#F06B5E":"#D4453A"} radius={[5,5,0,0]} shape={(p: any)=><Bar3D {...p} isActive={false} radius={[5,5,0,0]}/>} activeBar={(p: any)=><Bar3D {...p} isActive={true} radius={[5,5,0,0]} glowColor={dark?"rgba(240,107,94,0.5)":"rgba(212,69,58,0.4)"}/>} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Two-column: Upcoming + Recent */}
              <div className="budget-grid-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                {/* Upcoming unpaid */}
                <div className={`stagger-card glass-card chart-3d ${styles.chartCard}`} style={{animationDelay:"250ms",position:"relative",transformStyle:"preserve-3d"}}>
                  <h3 className={styles.chartTitle}>Upcoming Unpaid</h3>
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
                <div className={`stagger-card glass-card chart-3d ${styles.chartCard}`} style={{animationDelay:"300ms",position:"relative",transformStyle:"preserve-3d"}}>
                  <h3 className={styles.chartTitle}>Recent Payments</h3>
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
            <div className={`cat-sidebar ${styles.catSidebar}`}>
              <div className={styles.catSidebarHeader}>
                <span style={{fontSize:11,fontWeight:600,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1}}>Categories</span>
              </div>
              <div className={`cat-sidebar-list ${styles.catSidebarList}`}>
                {categories.map((c, i) => (
                  <div key={c.id} draggable
                    onDragStart={e=>{setDragIdx(i);e.dataTransfer.effectAllowed="move";e.currentTarget.classList.add("dragging");}}
                    onDragEnd={e=>{setDragIdx(null);e.currentTarget.classList.remove("dragging");}}
                    onDragOver={e=>{e.preventDefault();e.currentTarget.classList.add("drag-over");}}
                    onDragLeave={e=>e.currentTarget.classList.remove("drag-over")}
                    onDrop={e=>{e.preventDefault();e.currentTarget.classList.remove("drag-over");if(dragIdx!==null&&dragIdx!==i){reorderCategories(dragIdx,i);if(catIdx===dragIdx)setCatIdx(i);else if(dragIdx<catIdx&&i>=catIdx)setCatIdx(catIdx-1);else if(dragIdx>catIdx&&i<=catIdx)setCatIdx(catIdx+1);}setDragIdx(null);}}
                    className={`${styles.catSideItem} ${catIdx === i ? styles.catSideItemActive : ''}`} style={{justifyContent:"space-between"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,flex:1,minWidth:0,cursor:"pointer"}}
                      onClick={() => { setCatIdx(i); setExpYear(getCY()); setExpSel(new Set()); }}>
                      <span style={{fontSize:11,color:catIdx===i?"rgba(255,255,255,.5)":"var(--faint)",cursor:"grab"}}>⠿</span>
                      <span style={{flex:1,textAlign:"left",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</span>
                      {c.maxYears > 5 && <span className={styles.loanBadgeSide} style={catIdx===i?{background:"rgba(255,255,255,.2)",color:"#fff"}:{}} >long-term</span>}
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
              <button onClick={() => setModal({type:"addCat"})} className={`btn-hover ${styles.btnGhost} ${styles.hideOnMobile}`} style={{width:"100%",marginTop:8,fontSize:11,padding:"6px 10px"}}>+ Add Category</button>
            </div>

            {/* Right content */}
            <div style={{flex:1,minWidth:0}}>
              {cat && cat.id === "loans" ? (
                <LockedFeature featureKey="loans_view">
                  <LoansView
                    loanTypes={loanTypes}
                    getLoanAmountForMonth={getLoanAmountForMonth}
                    expYear={expYear} setExpYear={setExpYear}
                    onAdd={addLoanType} onUpdate={updateLoanType} onDelete={deleteLoanType}
                    loanPaid={loanPaid} toggleLoanPaid={toggleLoanPaid} setLoanPaidDate={setLoanPaidDate} toggleAllLoansPaid={toggleAllLoansPaid}
                    paidPicker={paidPicker} setPaidPicker={setPaidPicker}
                  />
                </LockedFeature>
              ) : cat ? (
                <>
                  <div className={styles.yearNav}>
                    <button onClick={() => { if(expYear > MIN_YEAR) { setExpYear(expYear - 1); setExpSel(new Set()); }}} className={`year-btn-h ${styles.yearBtn}`} style={{opacity:expYear>MIN_YEAR?1:.3}}>◂</button>
                    <span className={styles.yearLabel}>{expYear}</span>
                    <button onClick={() => { if(expYear < catMaxYear-1) { setExpYear(expYear + 1); setExpSel(new Set()); }}} className={`year-btn-h ${styles.yearBtn}`} style={{opacity:expYear<catMaxYear-1?1:.3}}>▸</button>
                    <span className={styles.yearRange}>range: {MIN_YEAR} – {catMaxYear - 1}</span>
                  </div>

                  {(() => {
                    const hasSubs = (cat.subcategories?.length ?? 0) > 0;
                    const filledKeys = MONTHS.map((_, mi) => mk(expYear, mi)).filter(k => {
                      const e = expenses?.[cat.id]?.[k];
                      if (!e) return false;
                      if (hasSubs) return (cat.subcategories||[]).some(sc => (e.subAmounts?.[sc.id] ?? 0) > 0) || e.amount > 0;
                      return true;
                    });
                    const allSelected = filledKeys.length > 0 && filledKeys.every(k => expSel.has(k));
                    const toggleSel = (k: string) => { const n = new Set(expSel); n.has(k) ? n.delete(k) : n.add(k); setExpSel(n); };
                    const toggleAll = () => { if (allSelected) setExpSel(new Set()); else setExpSel(new Set(filledKeys)); };

                    /* Build column definitions */
                    const allCols: ColDef[] = [];
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
                    const cols: ColDef[] = storedOrder.length > 0
                      ? storedOrder.map(id => allCols.find(c => c.id === id)).filter((c): c is ColDef => !!c).concat(allCols.filter(c => !storedOrder.includes(c.id)))
                      : allCols;

                    let colDragFrom: number | null = null;
                    const colStyle = (c: ColDef): React.CSSProperties => ({ width:c.w, flex:c.flex, minWidth:c.minW, textAlign: c.align as React.CSSProperties['textAlign'], fontWeight:c.bold?700:undefined });

                    return <>
                      {expSel.size > 0 && (
                        <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",background:"var(--accent-bg)",borderRadius:10,marginBottom:10}}>
                          <span style={{fontSize:13,fontWeight:600,color:"var(--accent)",flex:1}}>{expSel.size} selected</span>
                          <button onClick={()=>setExpSel(new Set())} className={styles.btnSmall}>Deselect</button>
                          <button onClick={()=>{bulkDelExp(cat.id,[...expSel]);setExpSel(new Set());flash(`Deleted ${expSel.size} entr${expSel.size===1?"y":"ies"}!`);}}
                            className={styles.btnSmall} style={{color:"var(--red)",borderColor:"var(--red)"}}>Delete Selected</button>
                        </div>
                      )}
                      <div className={styles.listWrap} style={{overflowX:"auto"}}>
                        <div className={styles.listHeader}>
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
                          const hasData = hasSubs ? (entry && ((cat.subcategories||[]).some(sc=>(entry.subAmounts?.[sc.id]??0)>0)||entry.amount>0)) : !!entry;
                          const isPast = expYear < getCY() || (expYear === getCY() && mi < getCM());
                          const isCurrent = expYear === getCY() && mi === getCM();
                          const isSel = expSel.has(key);
                          return (
                            <div key={mi} className={`hov stagger-row ${styles.listRow} ${isCurrent ? styles.listRowCurrent : ''}`}
                              onClick={() => setModal({type:"editExp",catId:cat.id,catObj:cat,monthKey:key,monthLabel:`${mName} ${expYear}`,entry})}
                              style={{...(isPast?{opacity:.5}:{}), ...(isSel?{background:"var(--accent-bg)"}:{}), animationDelay:`${mi*25}ms`}}>
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
                                {isCurrent && <span className={styles.nowBadge}>now</span>}
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

                  <div className={styles.yearTotal}>
                    <span style={{color:"var(--muted)"}}>Total for {expYear}:</span>
                    <span style={{fontWeight:600,fontSize:18,color:"var(--text)"}}>
                      {fmt(MONTHS.reduce((s,_,mi) => s + (getExp(cat.id, mk(expYear,mi))?.amount||0), 0))}
                    </span>
                  </div>
                </>
              ) : null}
              {categories.length === 0 && (
                <div className={styles.emptyState}>
                  <div style={{fontSize:32,marginBottom:8,opacity:.5}}>📂</div>
                  <p style={{fontWeight:500,marginBottom:4}}>No categories yet</p>
                  <p style={{fontSize:12,color:"var(--faintest)",marginBottom:12}}>Create your first category to start tracking expenses.</p>
                  <button onClick={()=>setModal({type:"addCat"})} className={`btn-hover ${styles.btnPrimary}`} style={{fontSize:13,padding:"10px 18px"}}>Create your first category</button>
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
              <div className={styles.sectionHead}>
                <div>
                  <h2 className={styles.sectionTitle}>Fixed Incomes</h2>
                  <p className={styles.sectionSub}>Recurring monthly income. Schedule future raises by adding a new amount record with a future effective date.</p>
                </div>
                <button onClick={()=>setModal({type:"addFixedIncome"})} className={`btn-hover ${styles.btnPrimary} ${styles.hideOnMobile}`}>+ Add Source</button>
              </div>
              {fixedIncomes.length === 0 ? (
                <div className={styles.emptyState}>
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
                      <div key={src.id} className={`stagger-card card-h ${styles.incomeCard}`} style={{animationDelay:`${si*80}ms`,transition:"border-color .2s, box-shadow .2s"}}>
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
                            <button onClick={()=>setModal({type:"editFixedIncome",idx:si,src})} className={styles.btnSmall}>Edit</button>
                            <button onClick={()=>{deleteFixedIncome(si);flash("Deleted!");}} className={styles.btnSmall} style={{color:"var(--red)",borderColor:"var(--red)"}}>Delete</button>
                          </div>
                        </div>
                        {sorted.length > 0 && (
                          <div style={{marginTop:12,display:"flex",flexWrap:"wrap",gap:6}}>
                            {sorted.map((r,ri)=>{
                              const {y,m}=parseMk(r.effectiveFrom);
                              const isUpcoming = r.effectiveFrom > mk(getCY(),getCM());
                              return (
                                <span key={ri} className={styles.timeChip} style={isUpcoming?{background:"var(--upcoming-bg)",color:"var(--amber)",border:"1px solid var(--upcoming-border)"}:{}}>
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
              <div className={styles.sectionHead}>
                <div>
                  <h2 className={styles.sectionTitle}>Variable Incomes</h2>
                  <p className={styles.sectionSub}>One-time or irregular income assigned to a specific month.</p>
                </div>
                <button onClick={()=>setModal({type:"addVarIncome"})} className={`btn-hover ${styles.btnPrimary} ${styles.hideOnMobile}`}>+ Add Entry</button>
              </div>
              {variableIncomes.length === 0 ? (
                <div className={styles.emptyState}>
                  <div style={{fontSize:32,marginBottom:8,opacity:.5}}>📋</div>
                  <p style={{fontWeight:500,marginBottom:4}}>No variable income recorded yet</p>
                  <p style={{fontSize:12,color:"var(--faintest)"}}>Add one-time or irregular income entries here.</p>
                </div>
              ) : (
                <>
                  {varSel.size > 0 && (
                    <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",background:"var(--accent-bg)",borderRadius:10,marginBottom:10}}>
                      <span style={{fontSize:13,fontWeight:600,color:"var(--accent)",flex:1}}>{varSel.size} selected</span>
                      <button onClick={()=>setVarSel(new Set())} className={styles.btnSmall}>Deselect</button>
                      <button onClick={()=>{bulkDelVarInc(varSel);setVarSel(new Set());flash(`Deleted ${varSel.size} entr${varSel.size===1?"y":"ies"}!`);}}
                        className={styles.btnSmall} style={{color:"var(--red)",borderColor:"var(--red)"}}>Delete Selected</button>
                    </div>
                  )}
                  <div className={styles.tableWrap}>
                    <div className={styles.tableHeader}>
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
                        <div key={v.id} className={`hov ${styles.tableRow}`} style={{...(isSel?{background:"var(--accent-bg)"}:{})}}>
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
          <LockedFeature featureKey="budget_view">
            <BudgetView year={budgetYear} setYear={setBudgetYear} categories={categories} expenses={expenses}
              getFixedIncomeForMonth={getFixedIncomeForMonth} getVarIncomeForMonth={getVarIncomeForMonth}
              getTotalExpensesForMonth={getTotalExpensesForMonth} getPaidExpForMonth={getPaidExpForMonth}
              getAnticipatedExpForMonth={getAnticipatedExpForMonth} getCatPaidForMonth={getCatPaidForMonth}
              getExp={getExp} dark={dark} />
          </LockedFeature>
        )}
      </main>

      {/* ═══ MODALS ═══ */}
      {modal && (
        <div onClick={()=>setModal(null)} className={`overlay-mobile ${styles.overlay}`}>
          <div onClick={e=>e.stopPropagation()} className="modal-mobile" style={{animation:"slideUp .25s"}}>
            {modal.type==="editExp" && (
              <ExpenseModal catObj={modal.catObj} monthKey={modal.monthKey} monthLabel={modal.monthLabel}
                entry={modal.entry} catMaxYear={getCY()+(modal.catObj.maxYears||5)}
                suggestedDay={getSuggestedDay(modal.catId)}
                onSave={(entry,applyMonths)=>{setExp(modal.catId,modal.monthKey,entry,applyMonths);flash(applyMonths>0?`Applied to ${applyMonths} more month${applyMonths!==1?"s":""}!`:"Saved!");setModal(null);}}
                onDelete={()=>{delExp(modal.catId,modal.monthKey);flash("Deleted!");setModal(null);}}
                onReorderSubs={(newSubs)=>{
                  const ci = categories.findIndex(c=>c.id===modal.catId);
                  if(ci>=0) updateCategory(ci,{subcategories:newSubs});
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
                  } else if (modal.type==="editCat") {
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
              <div className={styles.modalContent}>
                <h2 className={styles.modalTitle}>Delete Category</h2>
                <p style={{color:"var(--text2)",fontSize:14,marginTop:8,marginBottom:20}}>
                  Are you sure you want to delete <strong>{modal.catName}</strong>? All expense data for this category will be permanently lost.
                </p>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>setModal(null)} className={styles.btnGhostModal}>Cancel</button>
                  <button onClick={()=>{deleteCategory(modal.idx);if(catIdx>=categories.length-1)setCatIdx(Math.max(0,categories.length-2));flash("Category deleted!");setModal(null);}} className={`btn-hover ${styles.btnPrimary}`} style={{flex:1,background:"var(--red)"}}>Delete</button>
                </div>
              </div>
            )}
            {(modal.type==="addFixedIncome"||modal.type==="editFixedIncome") && (
              <FixedIncomeModal src={modal.type==="editFixedIncome"?modal.src:null}
                onSave={(src)=>{
                  if(modal.type==="addFixedIncome") addFixedIncome(src);
                  else if(modal.type==="editFixedIncome") updateFixedIncome(modal.idx, src);
                  flash("Saved!");setModal(null);
                }} onClose={()=>setModal(null)} />
            )}
            {(modal.type==="addVarIncome"||modal.type==="editVarIncome") && (
              <VarIncomeModal item={modal.type==="editVarIncome"?modal.item:null}
                onSave={(item)=>{
                  if(modal.type==="addVarIncome") addVarIncome(item);
                  else if(modal.type==="editVarIncome") updateVarIncome(variableIncomes.findIndex(v=>v.id===modal.item.id), item);
                  flash("Saved!");setModal(null);
                }} onClose={()=>setModal(null)} />
            )}
          </div>
        </div>
      )}
      {/* Mobile thumb-zone action bar — only shown on small screens for tabs with add actions */}
      {(tab === "incomes" || tab === "expenses") && (
        <div className={styles.mobileActionBar}>
          {tab === "incomes" && (
            <>
              <button onClick={()=>setModal({type:"addFixedIncome"})} className={`btn-hover ${styles.btnPrimary}`} style={{flex:1,touchAction:"manipulation"}}>+ Fixed</button>
              <button onClick={()=>setModal({type:"addVarIncome"})} className={`btn-hover ${styles.btnPrimary}`} style={{flex:1,touchAction:"manipulation"}}>+ Variable</button>
            </>
          )}
          {tab === "expenses" && (
            <button onClick={()=>setModal({type:"addCat"})} className={`btn-hover ${styles.btnPrimary}`} style={{flex:1,touchAction:"manipulation"}}>+ Add Category</button>
          )}
        </div>
      )}

      <SyncStatusIndicator />
    </div>
  );
}
