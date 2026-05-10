export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function isMobile(): boolean {
  return typeof window !== 'undefined' && window.innerWidth <= 768;
}

// Tracks the last button element clicked — populated before any modal opens
let _lastButtonRect: DOMRect | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener(
    'mousedown',
    (e) => {
      const btn = (e.target as Element)?.closest?.('button, a, [role="button"], [data-trigger]');
      if (btn) _lastButtonRect = btn.getBoundingClientRect();
    },
    { capture: true }
  );
}

export function getLastButtonRect(): DOMRect | null {
  return _lastButtonRect;
}

interface PixelOpts {
  count?: number;
  minSize?: number;
  maxSize?: number;
  minDuration?: number;
  maxDuration?: number;
  maxDelay?: number;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function makePixel(size: number): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    `width:${size}px`,
    `height:${size}px`,
    'background:var(--pixel-color,var(--accent))',
    'border-radius:1px',
    `box-shadow:0 0 ${Math.ceil(size * 2)}px var(--pixel-glow,var(--accent-glow))`,
    'pointer-events:none',
    'will-change:transform,opacity',
    'z-index:9999',
  ].join(';');
  return el;
}

function buildKeyframes(
  sx: number, sy: number,
  ex: number, ey: number,
  steps = 22
): Keyframe[] {
  // Quadratic Bezier with random control point offset
  const cpx = (sx + ex) / 2 + rand(-70, 70);
  const cpy = (sy + ey) / 2 + rand(-70, 70);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const x = (1 - t) ** 2 * sx + 2 * (1 - t) * t * cpx + t ** 2 * ex;
    const y = (1 - t) ** 2 * sy + 2 * (1 - t) * t * cpy + t ** 2 * ey;
    const opacity = t < 0.12 ? t / 0.12 : 1;
    return { transform: `translate(${x}px,${y}px)`, opacity };
  });
}

/**
 * Spawn pixels from a source point that travel toward a target rect.
 * Resolves when the last pixel arrives. Container is cleared on completion.
 */
export function animatePixelsFromPoint(
  srcX: number,
  srcY: number,
  targetRect: DOMRect,
  container: HTMLElement,
  opts: PixelOpts = {}
): Promise<void> {
  if (prefersReducedMotion()) return Promise.resolve();

  // Fewer particles on mobile for performance
  const mob = isMobile();
  const {
    count = mob ? 110 : 190,
    minSize = 2, maxSize = mob ? 5 : 6,
    minDuration = 450, maxDuration = 650,
    maxDelay = 80,
  } = opts;

  const promises: Promise<void>[] = [];
  const { left, top, width, height } = targetRect;

  for (let i = 0; i < count; i++) {
    const size = rand(minSize, maxSize);
    const el = makePixel(size);
    container.appendChild(el);

    const ex = left + rand(2, Math.max(4, width - size - 2));
    const ey = top + rand(2, Math.max(4, height - size - 2));

    const kf = buildKeyframes(srcX - size / 2, srcY - size / 2, ex, ey);
    const anim = el.animate(kf, {
      duration: rand(minDuration, maxDuration),
      delay: rand(0, maxDelay),
      easing: 'cubic-bezier(0.22,1,0.36,1)',
      fill: 'forwards',
    });
    promises.push(new Promise<void>(res => { anim.onfinish = () => res(); }));
  }

  return Promise.all(promises).then(() => { container.innerHTML = ''; });
}

/**
 * Spawn pixels from all four screen edges that travel inward to assemble a target rect.
 * Left and right edges have higher density. Resolves when the last pixel arrives.
 */
export function animatePixelsFromEdges(
  targetRect: DOMRect,
  container: HTMLElement,
  opts: PixelOpts = {}
): Promise<void> {
  if (prefersReducedMotion()) return Promise.resolve();

  const {
    count = 290,
    minSize = 2, maxSize = 5,
    minDuration = 600, maxDuration = 800,
    maxDelay = 100,
  } = opts;

  const W = window.innerWidth;
  const H = window.innerHeight;
  const { left, top, width, height } = targetRect;
  const promises: Promise<void>[] = [];

  for (let i = 0; i < count; i++) {
    const size = rand(minSize, maxSize);
    const el = makePixel(size);
    container.appendChild(el);

    // Left/right get 35% each; top 15%; bottom 15%
    const roll = Math.random();
    let sx: number, sy: number;
    if      (roll < 0.35) { sx = 0; sy = rand(0, H); }
    else if (roll < 0.70) { sx = W; sy = rand(0, H); }
    else if (roll < 0.85) { sx = rand(0, W); sy = 0; }
    else                  { sx = rand(0, W); sy = H; }

    const ex = left + rand(2, Math.max(4, width - size - 2));
    const ey = top + rand(2, Math.max(4, height - size - 2));

    const kf = buildKeyframes(sx, sy, ex, ey, 26);
    const anim = el.animate(kf, {
      duration: rand(minDuration, maxDuration),
      delay: rand(0, maxDelay),
      easing: 'cubic-bezier(0.22,1,0.36,1)',
      fill: 'forwards',
    });
    promises.push(new Promise<void>(res => { anim.onfinish = () => res(); }));
  }

  return Promise.all(promises).then(() => { container.innerHTML = ''; });
}
