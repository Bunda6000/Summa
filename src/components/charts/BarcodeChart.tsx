interface BarcodeDataItem {
  name: string;
  value: number;
  color: string;
}

interface BarcodeChartProps {
  data: BarcodeDataItem[];
  dark: boolean;
}

export default function BarcodeChart({ data, dark }: BarcodeChartProps) {
  const H = 190;
  if (!data.length) return null;
  const maxV = Math.max(...data.map(d => d.value), 1), n = data.length;
  const VW = Math.max(n * 44, 200), bw = Math.min(26, VW / n - 10), gap = (VW - n * bw) / (n + 1);
  return (
    <svg viewBox={`0 0 ${VW} ${H + 22}`} width="100%" height={H + 22}>
      {data.map((d, i) => {
        const bh = (d.value / maxV) * (H - 16), x = gap + i * (bw + gap);
        return (
          <g key={i}>
            <rect x={x} y={10} width={bw} height={H - 16} fill={dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"} rx={4} />
            <rect x={x} y={H - 6 - bh} width={bw} height={bh} fill={d.color} rx={4} />
            <text x={x + bw / 2} y={H + 14} textAnchor="middle" fontSize={9} fill={dark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.4)"}>{d.name.slice(0, 6)}</text>
          </g>
        );
      })}
    </svg>
  );
}
