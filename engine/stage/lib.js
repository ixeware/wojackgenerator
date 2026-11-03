// Shared math, easing and SVG/HTML helpers for the stage.
export const W = 1080, H = 1920;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, v) => (b === a ? 0 : clamp((v - a) / (b - a), 0, 1));
export const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 4);
export const easeOut2 = t => 1 - Math.pow(1 - clamp(t, 0, 1), 2);
export const easeIn = t => Math.pow(clamp(t, 0, 1), 3);
export const easeInOut = t => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const backOut = (t, s = 1.9) => { t = clamp(t, 0, 1) - 1; return 1 + t * t * ((s + 1) * t + s); };

/** Damped spring 0→1 used for anything that lands. */
export function spring(t, k = 1) {
  t = Math.max(0, t);
  if (t > 3) return 1;
  return 1 - Math.exp(-7 * t * k) * Math.cos(15 * t * k);
}

/** Appear at `a`, optional disappear at `b`. Returns 0..1 visibility. */
export function vis(t, a, b = Infinity, rise = 0.22, fall = 0.18) {
  if (t < a || t > b) return 0;
  return Math.min(easeOut((t - a) / rise), b === Infinity ? 1 : 1 - easeIn((t - (b - fall)) / fall));
}

/** Pop-in transform helper: returns {s, o, y} for a spring entrance at `a`. */
export function pop(t, a, b = Infinity, { from = 0.6, dy = 30 } = {}) {
  if (t < a) return { s: from, o: 0, y: dy, on: false };
  const p = spring((t - a) * 1.25);
  const out = b === Infinity ? 1 : 1 - easeIn((t - (b - 0.16)) / 0.16);
  return { s: lerp(from, 1, p) * (out < 1 ? lerp(0.85, 1, out) : 1), o: Math.min(1, (t - a) / 0.08) * clamp(out, 0, 1), y: (1 - p) * dy, on: t <= b };
}

export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const px = v => `${Math.round(v * 10) / 10}px`;
export const r1 = v => Math.round(v * 10) / 10;

/** Deterministic pseudo-random from a seed (stable across frames). */
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** A hand-drawn loop (like the orange annotations in the brief) around a box. */
export function scribbleEllipse(cx, cy, rx, ry, seed = 1, turns = 1.12) {
  const R = rng(seed);
  const pts = [];
  const n = 44, start = -2.2 + R() * 0.4;
  for (let i = 0; i <= n; i++) {
    const a = start + (i / n) * Math.PI * 2 * turns;
    const wob = 1 + (R() - 0.5) * 0.045 + (i / n) * 0.06;
    pts.push([cx + Math.cos(a) * rx * wob, cy + Math.sin(a) * ry * wob]);
  }
  return smoothPath(pts);
}

export function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    d += ` Q${r1(x0)} ${r1(y0)} ${r1((x0 + x1) / 2)} ${r1((y0 + y1) / 2)}`;
  }
  const last = pts[pts.length - 1];
  return d + ` L${r1(last[0])} ${r1(last[1])}`;
}

/** Curved, slightly wobbly arrow from a to b. */
export function arrowPath(a, b, bend = 0.18) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const c = [mx - dy * bend, my + dx * bend];
  const ang = Math.atan2(b[1] - c[1], b[0] - c[0]);
  const h = 30;
  const head = `M${r1(b[0] - h * Math.cos(ang - 0.5))} ${r1(b[1] - h * Math.sin(ang - 0.5))} L${r1(b[0])} ${r1(b[1])} L${r1(b[0] - h * Math.cos(ang + 0.5))} ${r1(b[1] - h * Math.sin(ang + 0.5))}`;
  return { body: `M${r1(a[0])} ${r1(a[1])} Q${r1(c[0])} ${r1(c[1])} ${r1(b[0])} ${r1(b[1])}`, head };
}

/** Approximate length of a quadratic arrow body (for draw-on dashes). */
export function approxLen(a, b) { return Math.hypot(b[0] - a[0], b[1] - a[1]) * 1.08; }

// ------------------------------------------------------------ 2D affine
// [a, b, c, d, e, f] maps (x, y) -> (a x + c y + e, b x + d y + f), like CSS matrix().
export const M = {
  id: () => [1, 0, 0, 1, 0, 0],
  mul: (m, n) => [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ],
  t: (x, y) => [1, 0, 0, 1, x, y],
  s: (x, y = x) => [x, 0, 0, y, 0, 0],
  r: a => [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0],
  apply: (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]],
  css: m => `matrix(${m.map(v => Math.round(v * 10000) / 10000).join(',')})`,
  invert: m => {
    const det = m[0] * m[3] - m[1] * m[2];
    return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det,
      (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
  },
};
export const chain = (...ms) => ms.reduce((acc, m) => M.mul(acc, m), M.id());
