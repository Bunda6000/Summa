export default function MarimekoChart({ data }) {
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
