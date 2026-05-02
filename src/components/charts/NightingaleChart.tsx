interface NightingaleDataItem {
  value: number;
  color: string;
}

interface NightingaleChartProps {
  data: NightingaleDataItem[];
  dark: boolean;
}

export default function NightingaleChart({ data, dark }: NightingaleChartProps) {
  const W = 210, H = 210, cx = 105, cy = 105, maxR = 88;
  if (!data.length) return null;
  const n = data.length, maxV = Math.max(...data.map(d => d.value), 1), step = (2 * Math.PI) / n;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
      {[.25, .5, .75, 1].map(t => <circle key={t} cx={cx} cy={cy} r={maxR * t} fill="none" stroke={dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} />)}
      {data.map((d, i) => {
        const sa = i * step - Math.PI / 2, ea = sa + step - 0.04, r = Math.sqrt(d.value / maxV) * maxR;
        const x1 = cx + Math.cos(sa) * r, y1 = cy + Math.sin(sa) * r, x2 = cx + Math.cos(ea) * r, y2 = cy + Math.sin(ea) * r;
        return <path key={i} d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2} Z`} fill={d.color} fillOpacity={0.85} stroke={dark ? "#1a1a2e" : "#fff"} strokeWidth={1} />;
      })}
    </svg>
  );
}
