export default function SunburstChart({ catBreakdown, catTrendData, dark }) {
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
