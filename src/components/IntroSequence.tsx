import { useState, useRef, useEffect, useCallback } from 'react';
import { clamp01, _lerp, easeOut3, easeInOut2 } from '../utils/expressions';

interface IntroSequenceProps {
  onComplete: () => void;
}

interface Particle {
  x: number;
  y: number;
  sx: number;
  sy: number;
  da: number;
  dr: number;
  sz: number;
  ma: number;
  alpha: number;
  gold: boolean;
  trail: { x: number; y: number }[];
  os: number;
  wb: number;
}

interface GridDot {
  x: number;
  y: number;
  d: number;
  a: number;
}

export default function IntroSequence({ onComplete }: IntroSequenceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
    if (!ctx) return;
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
    const particles: Particle[] = Array.from({ length: N }, (_, i) => {
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
    const grid: GridDot[] = [];
    for (let gx = GS / 2; gx < W + GS; gx += GS)
      for (let gy = GS / 2; gy < H + GS; gy += GS) {
        const dx = gx - W / 2, dy = gy - H / 2;
        grid.push({ x: gx, y: gy, d: Math.sqrt(dx * dx + dy * dy), a: 0 });
      }
    const maxGD = Math.sqrt((W / 2) ** 2 + (H / 2) ** 2);

    let raf: number, lp = 0;

    const frame = (now: number) => {
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
      position: 'fixed', inset: 0, zIndex: 9999, background: '#0A0A10',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: textPhase >= 2 ? 0 : 1,
      transition: 'opacity 0.65s cubic-bezier(0.22,1,0.36,1)',
      pointerEvents: textPhase >= 2 ? 'none' : 'all', cursor: 'pointer',
    }} onClick={() => { setTextPhase(2); setTimeout(finish, 650); }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* Logo text */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        opacity: textPhase >= 1 ? (textPhase >= 2 ? 0 : 1) : 0,
        transform: textPhase >= 1 ? (textPhase >= 2 ? 'scale(1.1)' : 'translateY(0) scale(1)') : 'translateY(18px) scale(0.88)',
        transition: 'all 0.8s cubic-bezier(0.22,1,0.36,1)',
      }}>
        <h1 style={{
          fontSize: mob ? 58 : 88, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif",
          color: '#E8E6E3', letterSpacing: mob ? '-1.5px' : '-3px', margin: 0, lineHeight: 1,
          textShadow: '0 0 120px rgba(104,192,164,0.65), 0 0 240px rgba(104,192,164,0.18), 0 2px 32px rgba(0,0,0,0.7)',
        }}>Summa</h1>
        <span style={{
          fontSize: mob ? 15 : 19, fontWeight: 400, fontFamily: "'DM Sans',sans-serif",
          color: 'rgba(232,230,227,0.7)', letterSpacing: mob ? '1px' : '2px',
          opacity: textPhase >= 1 ? 1 : 0,
          transition: 'opacity 0.5s ease 0.15s',
          marginTop: mob ? 6 : 8,
        }}>Personal Finance, Clearly</span>
        <span style={{
          fontSize: mob ? 13 : 16, fontWeight: 500, fontFamily: "'Space Grotesk',sans-serif",
          color: '#68C0A4', letterSpacing: mob ? '2px' : '4px', textTransform: 'uppercase',
          opacity: textPhase >= 1 ? 0.85 : 0,
          transition: 'opacity 0.6s ease 0.4s',
          marginTop: mob ? 16 : 22,
          textShadow: '0 0 40px rgba(104,192,164,0.35)',
        }}>Clarity across every category</span>
      </div>

      {/* Skip hint */}
      <span style={{
        position: 'absolute', bottom: mob ? 32 : 40, left: '50%', transform: 'translateX(-50%)',
        fontSize: 11, color: 'rgba(255,255,255,0.15)', fontFamily: "'DM Sans',sans-serif",
        letterSpacing: '1px', textTransform: 'uppercase',
        opacity: textPhase >= 1 && textPhase < 2 ? 1 : 0,
        transition: 'opacity 0.4s ease 0.5s',
      }}>tap to skip</span>
    </div>
  );
}
