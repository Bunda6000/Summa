export const reorder = (arr, from, to) => { const n = [...arr]; const [item] = n.splice(from, 1); n.splice(to, 0, item); return n; };
export const clamp01 = v => Math.max(0, Math.min(1, v));
export const _lerp = (a, b, t) => a + (b - a) * t;
export const easeOut3 = t => 1 - Math.pow(1 - t, 3);
export const easeInOut2 = t => t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2) / 2;

/* Evaluate simple arithmetic expressions like "350 + 250 + 200" safely */
export const evalExpr = (val) => {
  const str = String(val ?? "").replace(/\s/g, "");
  if (!str) return NaN;
  if (!/^[0-9+\-*/.()]+$/.test(str)) return parseFloat(str);
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function("return (" + str + ")")();
    if (typeof result === "number" && isFinite(result)) return Math.round(result * 100) / 100;
  } catch {}
  return parseFloat(str);
};
