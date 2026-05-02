import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, Legend,
  LineChart, Line, RadialBarChart, RadialBar, Treemap
} from 'recharts';
import ViewSelect from '../ViewSelect';
import NightingaleChart from '../charts/NightingaleChart';
import SunburstChart from '../charts/SunburstChart';
import MarimekoChart from '../charts/MarimekoChart';
import BarcodeChart from '../charts/BarcodeChart';
import Bar3D from '../charts/Bar3D';
import { mk, MONTHS } from '../../utils/dates';
import { fmt } from '../../utils/formatters';
import { CHART_COLORS } from '../../constants';
import styles from './BudgetView.module.css';
import type { Category, Expenses } from '../../types';

interface BudgetViewProps {
  year: number;
  setYear: (y: number) => void;
  categories: Category[];
  expenses: Expenses;
  getFixedIncomeForMonth: (monthKey: string) => number;
  getVarIncomeForMonth: (monthKey: string) => number;
  getTotalExpensesForMonth: (monthKey: string) => number;
  getPaidExpForMonth: (monthKey: string) => number;
  getAnticipatedExpForMonth: (monthKey: string) => number;
  getCatPaidForMonth: (catId: string, monthKey: string) => number;
  getExp: (catId: string, key: string) => { amount: number } | null;
  dark: boolean;
}

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

export default function BudgetView({ year, setYear, categories, expenses, getFixedIncomeForMonth, getVarIncomeForMonth, getTotalExpensesForMonth, getPaidExpForMonth, getAnticipatedExpForMonth, getCatPaidForMonth, getExp, dark }: BudgetViewProps) {
  const [breakdownView, setBreakdownView] = useState("circular");
  const [trendView, setTrendView] = useState("stacked-bar");
  const [selectedCats, setSelectedCats] = useState<string[]>([]); // empty = all categories
  const [hiddenBkdCats, setHiddenBkdCats] = useState<Set<string>>(new Set());
  const toggleCat = (name: string) => setSelectedCats(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  const toggleBkdCat = (name: string) => setHiddenBkdCats(prev => { const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next; });
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

  const catTrendData: Record<string, number | string>[] = MONTHS.map((mName, mi) => {
    const row: Record<string, number | string> = { month: mName };
    categories.forEach(c => { row[c.name] = getCatPaidForMonth(c.id, mk(year, mi)); });
    return row;
  });

  const activeCats = selectedCats.length === 0 ? categories : categories.filter(c => selectedCats.includes(c.name));

  const tipCSS = {borderRadius:12,border:"1px solid var(--border)",boxShadow:"0 8px 32px var(--shadow-lg)",fontSize:13,background:"var(--tooltip-bg)",color:"var(--tooltip-text)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)"};
  const viewSelect = (val: string, set: (v: string) => void, views: {id: string; label: string}[]) => <ViewSelect value={val} onChange={set} options={views} dark={dark} />;

  const renderBreakdownChart = () => {
    const visibleCatBreakdown = activeCatBreakdown; // use filter-aware data
    if(!visibleCatBreakdown.length) return <div style={{color:"var(--text-muted,#888)",textAlign:"center",padding:"40px 0",fontSize:13}}>{hiddenBkdCats.size>0?"All categories hidden":"No paid expenses for "+year}</div>;
    const tip = <Tooltip cursor={false} animationDuration={200} formatter={(v: number) => fmt(v)} contentStyle={tipCSS} itemStyle={{color:"var(--tooltip-text)"}} labelStyle={{color:"var(--tooltip-text)"}}/>;
    if(breakdownView==="pie")      return <ResponsiveContainer width="100%" height={210}><PieChart><Pie data={visibleCatBreakdown} cx="50%" cy="50%" outerRadius={85} paddingAngle={2} dataKey="value" stroke="none">{visibleCatBreakdown.map((d,i)=><Cell key={i} fill={d.color}/>)}</Pie>{tip}</PieChart></ResponsiveContainer>;
    if(breakdownView==="circular") return <ResponsiveContainer width="100%" height={210}><PieChart><Pie data={visibleCatBreakdown} cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={3} dataKey="value" stroke="none">{visibleCatBreakdown.map((d,i)=><Cell key={i} fill={d.color}/>)}</Pie>{tip}</PieChart></ResponsiveContainer>;
    if(breakdownView==="fan")      return <ResponsiveContainer width="100%" height={210}><PieChart><Pie data={visibleCatBreakdown} cx="50%" cy="76%" startAngle={180} endAngle={0} innerRadius={36} outerRadius={92} dataKey="value" stroke="none">{visibleCatBreakdown.map((d,i)=><Cell key={i} fill={d.color}/>)}</Pie>{tip}</PieChart></ResponsiveContainer>;
    if(breakdownView==="concentric") {
      const tot=visibleCatBreakdown.reduce((s,d)=>s+d.value,0),n=visibleCatBreakdown.length,rW=Math.min(20,72/Math.max(n,1));
      return (
        <ResponsiveContainer width="100%" height={210}>
          <PieChart>
            {visibleCatBreakdown.map((d,i)=>{
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
        <RadialBarChart cx="50%" cy="50%" innerRadius="8%" outerRadius="88%" data={visibleCatBreakdown.map(d=>({...d,fill:d.color}))}>
          <RadialBar {...{minAngle:15} as any} background clockWise dataKey="value">{visibleCatBreakdown.map((d,i)=><Cell key={i} fill={d.color}/>)}</RadialBar>
          {tip}
        </RadialBarChart>
      </ResponsiveContainer>
    );
    if(breakdownView==="nightingale") return <NightingaleChart data={visibleCatBreakdown} dark={dark}/>;
    if(breakdownView==="sunburst")    return <SunburstChart catBreakdown={visibleCatBreakdown} catTrendData={catTrendData} dark={dark}/>;
    if(breakdownView==="marimeko")    return <MarimekoChart data={visibleCatBreakdown}/>;
    if(breakdownView==="barcode")     return <BarcodeChart data={visibleCatBreakdown} dark={dark}/>;
    return null;
  };

  const renderTrendChart = () => {
    const tipProps = {animationDuration:200,formatter:(v: number) => fmt(v),contentStyle:tipCSS};
    const col = (c: Category) => CHART_COLORS[categories.indexOf(c)%CHART_COLORS.length];
    const commonAxes = (vert=false) => vert
      ? <><CartesianGrid strokeDasharray="3 3" stroke={cc.grid} horizontal={false}/>
          <XAxis type="number" tick={{fontSize:11,fill:cc.tick}} axisLine={false} tickLine={false} tickFormatter={(v: number)=>v>=1000?(v/1000).toFixed(0)+"k":`${v}`}/>
          <YAxis type="category" dataKey="month" tick={{fontSize:11,fill:cc.tick}} axisLine={false} tickLine={false} width={30}/>
          <Tooltip {...tipProps} cursor={{fill:dark?"rgba(104,192,164,0.08)":"rgba(26,158,118,0.08)"}}/></>
      : <><CartesianGrid strokeDasharray="3 3" stroke={cc.grid}/>
          <XAxis dataKey="month" tick={{fontSize:11,fill:cc.tick}} axisLine={false} tickLine={false}/>
          <YAxis tick={{fontSize:11,fill:cc.tick}} axisLine={false} tickLine={false} tickFormatter={(v: number)=>v>=1000?(v/1000).toFixed(0)+"k":`${v}`}/>
          <Tooltip {...tipProps} cursor={{fill:dark?"rgba(104,192,164,0.08)":"rgba(26,158,118,0.08)",radius:6}}/></>;

    if(trendView==="line"||trendView==="spline"||trendView==="step-line") {
      const type=trendView==="spline"?"monotone":trendView==="step-line"?"step":"linear";
      return <ResponsiveContainer width="100%" height={210}><LineChart data={catTrendData}>{commonAxes()}<Legend wrapperStyle={{fontSize:11}}/>{activeCats.map(c=><Line key={c.id} type={type} dataKey={c.name} stroke={col(c)} strokeWidth={2} dot={false}/>)}</LineChart></ResponsiveContainer>;
    }
    if(trendView==="stacked-area"||trendView==="stream") {
      const offset=trendView==="stream"?"wiggle":"none";
      return (
        <ResponsiveContainer width="100%" height={210}>
          <AreaChart data={catTrendData} stackOffset={offset as "none" | "wiggle"}>
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
            content={(({x,y,width,height,name,color:clr,depth}: any)=>{
              if(!width||!height||width<3||height<3||depth===0) return null;
              const rx=isConvex?10:2,pad=isConvex?3:1;
              return <g><rect x={x+pad} y={y+pad} width={width-pad*2} height={height-pad*2} rx={rx} ry={rx} fill={clr}/>{width>55&&height>28&&<text x={x+width/2} y={y+height/2} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight="600" fill="#fff">{name}</text>}</g>;
            }) as any}
          />
        </ResponsiveContainer>
      );
    }
    if(trendView==="bump-area") {
      const n=activeCats.length;
      if(!n) return null;
      const rankData=MONTHS.map((mName,mi)=>{
        const row: Record<string, number | string>={month:mName};
        const vals=activeCats.map(c=>({name:c.name,v:(catTrendData[mi]?.[c.name] as number)||0})).sort((a,b)=>b.v-a.v);
        vals.forEach((v,ri)=>{row[v.name]=ri+1;});
        activeCats.forEach(c=>{if(row[c.name]===undefined) row[c.name]=n;});
        return row;
      });
      return (
        <ResponsiveContainer width="100%" height={210}>
          <LineChart data={rankData}>
            <CartesianGrid strokeDasharray="3 3" stroke={cc.grid}/>
            <XAxis dataKey="month" tick={{fontSize:11,fill:cc.tick}} axisLine={false} tickLine={false}/>
            <YAxis reversed domain={[1,n||1]} tickCount={n} tick={{fontSize:11,fill:cc.tick}} axisLine={false} tickLine={false} tickFormatter={(v: number)=>`#${v}`}/>
            <Tooltip {...tipProps} formatter={(v: number,name: string)=>[`Rank #${v}`,name]}/>
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
      <div className={styles.yearNav} style={{marginBottom:24}}>
        <button onClick={()=>setYear(year-1)} className={`year-btn-h ${styles.yearBtn}`}>◂</button>
        <span className={styles.yearLabel}>{year}</span>
        <button onClick={()=>setYear(year+1)} className={`year-btn-h ${styles.yearBtn}`}>▸</button>
      </div>

      <div className="budget-grid-3" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:14,marginBottom:28}}>
        {[
          { label:"Total Income", value:yearTotals.income, color:"var(--accent)", icon:"↑", sub:null },
          { label:"Paid Expenses", value:yearTotals.paid, color:"var(--red)", icon:"↓", sub:null },
          { label:"Anticipated", value:yearTotals.anticipated, color:"var(--amber)", icon:"◷", sub:"unpaid entries" },
          { label:"Net Balance", value:yearTotals.balance, color:yearTotals.balance>=0?"var(--accent)":"var(--red)", icon:"◎", sub:"income − paid" },
        ].map((c,i)=>(
          <div key={i} className={`summary-h stagger-card glass-card chart-3d ${styles.summaryCard}`} style={{animationDelay:`${i*80}ms`,position:"relative",transformStyle:"preserve-3d"}}>
            <span style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1.2,fontWeight:600,fontFamily:"'Space Grotesk',sans-serif"}}>{c.icon} {c.label}</span>
            <div style={{fontSize:28,fontWeight:700,color:c.color,marginTop:8,fontFamily:"'Space Grotesk',sans-serif",letterSpacing:"-0.5px"}}>{fmt(c.value)}</div>
            {c.sub && <div style={{fontSize:11,color:"var(--muted)",marginTop:4}}>{c.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <div className={`stagger-card glass-card chart-3d ${styles.chartCard}`} style={{animationDelay:"100ms",position:"relative",transformStyle:"preserve-3d"}}>
          <h3 className={styles.chartTitle}>Monthly Income vs Expenses</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} barGap={2}>
              <defs><filter id="bar3dBlur"><feGaussianBlur stdDeviation="6"/></filter></defs>
              <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} />
              <XAxis dataKey="month" tick={{fontSize:11,fill:cc.tick}} axisLine={false} tickLine={false} />
              <YAxis tick={{fontSize:11,fill:cc.tick}} axisLine={false} tickLine={false} tickFormatter={(v: number)=>v>=1000?(v/1000).toFixed(0)+"k":`${v}`} />
              <Tooltip cursor={{fill:dark?"rgba(104,192,164,0.08)":"rgba(26,158,118,0.08)",radius:6}} animationDuration={200} content={({active,payload,label}: any)=>{
                if(!active||!payload?.length) return null;
                const d = monthlyData.find(x=>x.month===label);
                return (
                  <div style={{borderRadius:12,border:"1px solid var(--border)",boxShadow:"0 8px 32px var(--shadow-lg)",fontSize:13,background:"var(--tooltip-bg)",color:"var(--tooltip-text)",padding:"12px 16px",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)"}}>
                    <div style={{fontWeight:600,marginBottom:6}}>{label}</div>
                    {payload.map((p: any,i: number)=>(
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
              <Bar dataKey="totalIncome" name="Income" fill={cc.accent} radius={[5,5,0,0]} shape={(p: any)=><Bar3D {...p} isActive={false} radius={[5,5,0,0]}/>} activeBar={(p: any)=><Bar3D {...p} isActive={true} radius={[5,5,0,0]} glowColor={dark?"rgba(104,192,164,0.5)":"rgba(26,158,118,0.4)"}/>} />
              <Bar dataKey="paid" name="Paid" stackId="exp" fill={cc.red} shape={(p: any)=><Bar3D {...p} isActive={false} radius={[0,0,0,0]}/>} activeBar={(p: any)=><Bar3D {...p} isActive={true} radius={[0,0,0,0]} glowColor={dark?"rgba(240,107,94,0.5)":"rgba(212,69,58,0.4)"}/>} />
              <Bar dataKey="anticipated" name="Anticipated" stackId="exp" fill={cc.anticipated} radius={[5,5,0,0]} shape={(p: any)=><Bar3D {...p} isActive={false} radius={[5,5,0,0]}/>} activeBar={(p: any)=><Bar3D {...p} isActive={true} radius={[5,5,0,0]} glowColor={dark?"rgba(245,197,66,0.4)":"rgba(212,160,48,0.35)"}/>} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={`stagger-card glass-card chart-3d ${styles.chartCard}`} style={{animationDelay:"200ms",position:"relative",transformStyle:"preserve-3d"}}>
          <h3 className={styles.chartTitle}>Monthly Balance</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="balG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={cc.accent} stopOpacity={.15}/><stop offset="95%" stopColor={cc.accent} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} />
              <XAxis dataKey="month" tick={{fontSize:11,fill:cc.tick}} axisLine={false} tickLine={false} />
              <YAxis tick={{fontSize:11,fill:cc.tick}} axisLine={false} tickLine={false} tickFormatter={(v: number)=>v>=1000?(v/1000).toFixed(0)+"k":`${v}`} />
              <Tooltip cursor={{stroke:dark?"rgba(104,192,164,0.3)":"rgba(26,158,118,0.3)",strokeWidth:1,strokeDasharray:"4 4"}} animationDuration={200} formatter={(v: number)=>fmt(v)} contentStyle={{borderRadius:12,border:"1px solid var(--border)",boxShadow:"0 8px 32px var(--shadow-lg)",fontSize:13,background:"var(--tooltip-bg)",color:"var(--tooltip-text)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)"}} />
              <Area type="monotone" dataKey="balance" stroke={cc.accent} strokeWidth={2} fill="url(#balG)" name="Balance" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="budget-grid-2" style={{display:"grid",gridTemplateColumns:catBreakdown.length>0?"1fr 1fr":"1fr",gap:14}}>
        {catBreakdown.length > 0 && (
          <div className={`stagger-card glass-card chart-3d ${styles.chartCard}`} style={{animationDelay:"300ms",position:"relative",transformStyle:"preserve-3d"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <h3 className={styles.chartTitle} style={{marginBottom:0}}>Expense Breakdown</h3>
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
        <div className={`stagger-card glass-card chart-3d ${styles.chartCard}`} style={{animationDelay:"350ms",position:"relative",transformStyle:"preserve-3d"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <h3 className={styles.chartTitle} style={{marginBottom:0}}>Spending Trends</h3>
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

      <div className={`stagger-card glass-card chart-3d ${styles.chartCard}`} style={{marginTop:14,animationDelay:"400ms",position:"relative",transformStyle:"preserve-3d"}}>
        <h3 className={styles.chartTitle}>Monthly Detail</h3>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead>
              <tr style={{borderBottom:"2px solid var(--border)"}}>
                {["Month","Fixed Inc.","Variable Inc.","Total Inc.","Paid","Anticipated","Balance"].map(h=>(
                  <th key={h} className={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((d,i)=>(
                <tr key={i} className="stagger-row" style={{borderBottom:"1px solid var(--border-light)",animationDelay:`${i*30}ms`}}>
                  <td className={styles.td}>{d.month}</td>
                  <td className={styles.td}>{fmt(d.fixedIncome)}</td>
                  <td className={styles.td}>{fmt(d.varIncome)}</td>
                  <td className={styles.td} style={{fontWeight:600}}>{fmt(d.totalIncome)}</td>
                  <td className={styles.td} style={{color:"var(--red)",fontWeight:500}}>{fmt(d.paid)}</td>
                  <td className={styles.td} style={{color:"var(--amber)"}}>{fmt(d.anticipated)}</td>
                  <td className={styles.td} style={{fontWeight:600,color:d.balance>=0?"var(--accent)":"var(--red)"}}>{fmt(d.balance)}</td>
                </tr>
              ))}
              <tr style={{borderTop:"2px solid var(--border)",fontWeight:700}}>
                <td className={styles.td}>Total</td>
                <td className={styles.td}>{fmt(monthlyData.reduce((s,d)=>s+d.fixedIncome,0))}</td>
                <td className={styles.td}>{fmt(monthlyData.reduce((s,d)=>s+d.varIncome,0))}</td>
                <td className={styles.td}>{fmt(yearTotals.income)}</td>
                <td className={styles.td} style={{color:"var(--red)"}}>{fmt(yearTotals.paid)}</td>
                <td className={styles.td} style={{color:"var(--amber)"}}>{fmt(yearTotals.anticipated)}</td>
                <td className={styles.td} style={{color:yearTotals.balance>=0?"var(--accent)":"var(--red)"}}>{fmt(yearTotals.balance)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
