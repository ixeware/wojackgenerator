import { spawn } from 'node:child_process';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const smooth = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** Natural deceleration — things arrive and settle instead of snapping. */
export const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 4);
export const easeIn = t => Math.pow(clamp(t, 0, 1), 3);
export const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Overshoot used for anything that "lands": cards, pills, chips. */
export function spring(t, { overshoot = 1.35 } = {}) {
  t = clamp(t, 0, 1);
  if (t === 1) return 1;
  const w = 10, z = 0.55 / overshoot;
  return 1 - Math.exp(-z * w * t) * Math.cos(w * Math.sqrt(1 - z * z) * t);
}

/** 0 → 1 → 0 window with eased edges; the workhorse for timed elements. */
export function window01(t, start, end, rise = 0.25, fall = 0.25) {
  if (t <= start || t >= end) return 0;
  const a = easeOut(inv(start, start + rise, t));
  const b = 1 - easeIn(inv(end - fall, end, t));
  return Math.min(a, b);
}

export function run(cmd, args, { input, capture = false, quiet = true } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: [input ? 'pipe' : 'ignore', capture ? 'pipe' : (quiet ? 'ignore' : 'inherit'), 'pipe'] });
    const out = [], err = [];
    if (capture) p.stdout.on('data', d => out.push(d));
    p.stderr.on('data', d => err.push(d));
    p.on('error', reject);
    p.on('close', code => code === 0
      ? resolve(capture ? Buffer.concat(out) : null)
      : reject(new Error(`${cmd} exited ${code}\n${Buffer.concat(err).toString().slice(-2000)}`)));
    if (input) { p.stdin.end(input); }
  });
}

export const fmtTime = s => {
  const ms = Math.round(s * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
};
