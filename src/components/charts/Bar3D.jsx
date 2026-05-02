/* 3D active bar shape — lifts, scales, adds top highlight & glow */
export default function Bar3D(props) {
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
