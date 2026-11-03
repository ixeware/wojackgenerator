// Reusable visual parts. Each writes into the frame context:
//   ctx.html(layer, str)  absolutely positioned HTML ('under' | 'over')
//   ctx.svg(layer, str)   SVG fragments in frame coordinates
//   ctx.img(key, src, o)  persistent <img> sprites
//   ctx.anchor(name, x, y) named points the presenter can point at
import { esc, r1, lerp, clamp, easeOut, easeIn, spring, pop, scribbleEllipse, arrowPath, approxLen, vis } from './lib.js';

const PAPER_CLR = { ink: 'var(--ink)', red: 'var(--red)', green: 'var(--green)', orange: 'var(--orange)', violet: 'var(--violet)', blue: 'var(--blue)' };

/* ----------------------------------------------------------- citation card
 * Modelled on the PubMed card from the brief: serif title, quiet byline.
 * `o.quote` adds one sentence from the abstract with an optional highlight. */
export function citeCard(ctx, paper, o) {
  const { x, y, w, t0, t1 = Infinity, size = 46, scale = 1, quote, highlight, hlAt, anchor, tilt = -1.2 } = o;
  const p = pop(ctx.t, t0, t1, { from: 0.86, dy: 60 });
  if (p.o <= 0) return;
  const lines = o.lines ?? 3;
  let q = '';
  if (quote) {
    let body = esc(quote);
    if (highlight) {
      const k = clamp((ctx.t - (hlAt ?? Infinity)) / 0.35, 0, 1);
      const grad = `linear-gradient(90deg, var(--yellow) ${r1(k * 100)}%, transparent ${r1(k * 100)}%)`;
      body = body.replace(highlight, `<span class="hl" data-anchor="${anchor ?? ''}" style="background:${grad};font-weight:700">${highlight}</span>`);
    }
    q = `<div class="q">…${body}</div>`;
  }
  ctx.html('over', `<div class="cite" style="left:${r1(x)}px;top:${r1(y + p.y)}px;width:${w}px;opacity:${r1(p.o)};transform:rotate(${tilt}deg) scale(${r1(p.s * scale * 1000) / 1000});transform-origin:50% 0">
    <div class="src"><svg width="22" height="22" viewBox="0 0 24 24"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" fill="none" stroke="#3263C9" stroke-width="3" stroke-linecap="round"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" fill="none" stroke="#3263C9" stroke-width="3" stroke-linecap="round"/></svg>PubMed · ${esc(paper.pmid)}</div>
    <div class="t" style="font-size:${size}px;line-height:1.17;display:-webkit-box;-webkit-line-clamp:${lines};-webkit-box-orient:vertical;overflow:hidden">${esc(paper.title)}</div>
    <div class="m">${esc(paper.byline)} ${esc(paper.journal)}. ${paper.year}.</div>${q}</div>`);
}

/** Compact docked citation that sits at the top of a study shot. */
export function citeDock(ctx, paper, t0, t1, y = 236) {
  citeCard(ctx, paper, { x: 70, y, w: 940, t0, t1, size: 33, lines: 2, tilt: 0 });
}

/* ----------------------------------------------------------- pills */
export function pill(ctx, id, o) {
  const a = ctx.A.pills[id];
  const { cx, cy, size, rot = 0, o: op = 1, key = id, z = 20, shadow = true } = o;
  if (op <= 0.001 || size < 2) return;
  const k = size / Math.max(a.w, a.h);
  const w = a.w * k, h = a.h * k;
  ctx.img(key, a.file, { x: cx - w / 2, y: cy - h / 2, w, h, rot, ox: w / 2, oy: h / 2, opacity: op, z,
    filter: shadow ? 'drop-shadow(0 16px 14px rgba(40,30,20,.28))' : null });
  return { w, h };
}

/* ----------------------------------------------------------- text bits */
export function chip(ctx, text, o) {
  const { x, y, t0, t1 = Infinity, cls = '', size, anchor, align = 'center', bg, color, layer = 'over', rot = 0 } = o;
  const p = pop(ctx.t, t0, t1, { from: 0.5, dy: 18 });
  if (p.o <= 0) return;
  const tx = align === 'center' ? '-50%' : align === 'right' ? '-100%' : '0';
  ctx.html(layer, `<div class="chip ${cls}" ${anchor ? `data-anchor="${anchor}"` : ''} style="left:${r1(x)}px;top:${r1(y + p.y)}px;opacity:${r1(p.o)};transform:translate(${tx},-50%) rotate(${rot}deg) scale(${r1(p.s * 1000) / 1000});${size ? `font-size:${size}px;` : ''}${bg ? `background:${bg};` : ''}${color ? `color:${color};` : ''}">${text}</div>`);
}

export function label(ctx, text, o) {
  const { x, y, t0 = -1, t1 = Infinity, size = 32, color = 'var(--ink)', align = 'center', weight = 700, cls = '', layer = 'over', font } = o;
  const v = vis(ctx.t, t0, t1, 0.2, 0.15);
  if (v <= 0) return;
  const tx = align === 'center' ? '-50%' : align === 'right' ? '-100%' : '0';
  ctx.html(layer, `<div class="label ${cls}" style="left:${r1(x)}px;top:${r1(y + (1 - v) * 12)}px;opacity:${r1(v)};transform:translate(${tx},-50%);font-size:${size}px;font-weight:${weight};color:${color};${font ? `font-family:${font};` : ''}">${text}</div>`);
}

/** Rubber stamp that slams down (scale from big, slight rotation). */
export function stamp(ctx, text, o) {
  const { x, y, t0, t1 = Infinity, rot = -9, color = 'var(--red)', size = 92, anchor } = o;
  if (ctx.t < t0 || ctx.t > t1) return;
  const k = clamp((ctx.t - t0) / 0.14, 0, 1);
  const s = lerp(2.3, 1, easeIn(k)) * (k >= 1 ? 1 + 0.06 * Math.exp(-(ctx.t - t0 - 0.14) * 18) * Math.cos((ctx.t - t0) * 60) : 1);
  const op = Math.min(1, k * 1.5) * (t1 === Infinity ? 1 : 1 - clamp((ctx.t - (t1 - 0.15)) / 0.15, 0, 1));
  ctx.html('over', `<div class="disp" ${anchor ? `data-anchor="${anchor}"` : ''} style="position:absolute;left:${r1(x)}px;top:${r1(y)}px;transform:translate(-50%,-50%) rotate(${rot}deg) scale(${r1(s * 1000) / 1000});opacity:${r1(op)};
    color:${color};font-size:${size}px;font-stretch:76%;letter-spacing:.04em;line-height:1;padding:10px 26px 14px;border:9px solid ${color};border-radius:18px;text-transform:uppercase;
    background:rgba(255,255,255,.55);mix-blend-mode:multiply;white-space:nowrap">${text}</div>`);
}

/** Hand-drawn loop around something, drawn on over `dur` seconds. */
export function scribble(ctx, cx, cy, rx, ry, t0, o = {}) {
  const { t1 = Infinity, color = 'var(--orange)', width = 10, seed = 3, dur = 0.38 } = o;
  if (ctx.t < t0 || ctx.t > t1) return;
  const d = scribbleEllipse(cx, cy, rx, ry, seed);
  const len = Math.PI * (rx + ry) * 1.2;
  const k = easeOut((ctx.t - t0) / dur);
  const fade = t1 === Infinity ? 1 : 1 - clamp((ctx.t - (t1 - 0.2)) / 0.2, 0, 1);
  ctx.svg('over', `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"
    stroke-dasharray="${r1(len)}" stroke-dashoffset="${r1(len * (1 - k))}" opacity="${r1(fade)}"/>`);
}

/** Hand-drawn underline. */
export function underline(ctx, x0, x1, y, t0, o = {}) {
  const { color = 'var(--orange)', width = 9, dur = 0.3, t1 = Infinity } = o;
  if (ctx.t < t0 || ctx.t > t1) return;
  const k = easeOut((ctx.t - t0) / dur);
  const xe = lerp(x0, x1, k);
  ctx.svg('over', `<path d="M${r1(x0)} ${r1(y)} Q${r1((x0 + xe) / 2)} ${r1(y + 7)} ${r1(xe)} ${r1(y - 3)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`);
}

export function arrow(ctx, a, b, t0, o = {}) {
  const { color = 'var(--ink)', width = 8, dur = 0.32, bend = 0.18, t1 = Infinity, layer = 'over', dash } = o;
  if (ctx.t < t0 || ctx.t > t1) return;
  const k = easeOut((ctx.t - t0) / dur);
  const { body, head } = arrowPath(a, b, bend);
  const len = approxLen(a, b);
  const fade = t1 === Infinity ? 1 : 1 - clamp((ctx.t - (t1 - 0.15)) / 0.15, 0, 1);
  ctx.svg(layer, `<g opacity="${r1(fade)}"><path d="${body}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"
    ${dash ? `stroke-dasharray="${dash}"` : `stroke-dasharray="${r1(len)}" stroke-dashoffset="${r1(len * (1 - k))}"`}/>
    ${k > 0.92 ? `<path d="${head}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>` : ''}</g>`);
}

/* ----------------------------------------------------------- wojak stickers */
export function sticker(ctx, id, o) {
  const a = ctx.A.wojaks[id];
  const { x, y, h, t0, t1 = Infinity, rot = 0, flip = false, z = 45, key = 'stk-' + id, wiggle = 0 } = o;
  const p = pop(ctx.t, t0, t1, { from: 0.3, dy: 80 });
  if (p.o <= 0) return;
  const w = a.w * h / a.h;
  const wig = wiggle ? Math.sin((ctx.t - t0) * 9) * wiggle : 0;
  ctx.img(key, a.file, { x: x - w / 2, y: y - h + p.y, w, h, rot: rot + wig, sx: (flip ? -1 : 1) * p.s, sy: p.s,
    ox: w / 2, oy: h, opacity: p.o, z, filter: 'drop-shadow(0 14px 16px rgba(22,24,29,.30))' });
  return { w, h };
}

/** Big emoji burst (e.g. the skull). */
export function emoji(ctx, ch, o) {
  const { x, y, size = 150, t0, t1 = Infinity, rot = 0 } = o;
  const p = pop(ctx.t, t0, t1, { from: 0.2, dy: 0 });
  if (p.o <= 0) return;
  const wob = Math.sin((ctx.t - t0) * 7) * 4 * Math.exp(-(ctx.t - t0) * 1.5);
  ctx.html('over', `<div class="emoji" style="position:absolute;left:${r1(x)}px;top:${r1(y)}px;font-size:${size}px;line-height:1;transform:translate(-50%,-50%) rotate(${r1(rot + wob)}deg) scale(${r1(p.s * 1000) / 1000});opacity:${r1(p.o)}">${ch}</div>`);
}

/* ----------------------------------------------------------- brutal card shell */
export function card(ctx, o) {
  const { x, y, w, h, t0 = -1, t1 = Infinity, bg = 'var(--card)', layer = 'under', radius = 34, rot = 0 } = o;
  const p = pop(ctx.t, t0, t1, { from: 0.92, dy: 40 });
  if (p.o <= 0) return null;
  ctx.html(layer, `<div class="card" style="left:${r1(x)}px;top:${r1(y + p.y)}px;width:${w}px;height:${h}px;opacity:${r1(p.o)};background:${bg};border-radius:${radius}px;transform:rotate(${rot}deg) scale(${r1(p.s * 1000) / 1000});transform-origin:50% 60%"></div>`);
  return p;
}

/* ----------------------------------------------------------- study figure
 * Shows a real open-access figure in a card, with the source line under it.
 * Returns fig→screen mapping so annotations can target data points. */
export function figure(ctx, id, o) {
  const f = ctx.A.figures[id];
  const { x, y, w, t0, t1 = Infinity, pad = 22, key = 'fig-' + id, caption = true } = o;
  const p = pop(ctx.t, t0, t1, { from: 0.9, dy: 50 });
  const k = (w - pad * 2) / f.w;
  const ih = f.h * k;
  const capH = caption ? 58 : 0;
  const h = ih + pad * 2 + capH;
  const map = (fx, fy) => [x + pad + fx * k, y + p.y + pad + fy * k];
  if (p.o <= 0) return { map, h, k, on: false };
  ctx.html('under', `<div class="card" style="left:${r1(x)}px;top:${r1(y + p.y)}px;width:${w}px;height:${r1(h)}px;opacity:${r1(p.o)};border-radius:28px"></div>`);
  ctx.img(key, f.file, { x: x + pad, y: y + p.y + pad, w: w - pad * 2, h: ih, opacity: p.o, z: 20 });
  if (caption) {
    ctx.html('over', `<div class="abs" style="left:${r1(x + pad)}px;top:${r1(y + p.y + pad + ih + 14)}px;width:${w - pad * 2}px;opacity:${r1(p.o)};
      font:600 22px/1.25 Onest;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(f.cite)} · ${esc(f.license)}</div>`);
  }
  return { map, h, k, on: true };
}

/* ----------------------------------------------------------- small counters */
export function ticks(ctx, o) {
  const { x, y, n, filled, size = 34, gap = 10, color = 'var(--ink)', label: lab, t0 } = o;
  const v = vis(ctx.t, t0);
  if (v <= 0) return;
  let s = '';
  for (let i = 0; i < n; i++) {
    const on = i < filled;
    const xx = x + i * (size + gap);
    s += `<rect x="${r1(xx)}" y="${r1(y)}" width="${size}" height="${size}" rx="8" fill="${on ? color : '#fff'}" stroke="var(--ink)" stroke-width="4" opacity="${r1(v)}"/>`;
    if (on) s += `<path d="M${r1(xx + 9)} ${r1(y + size / 2)} l7 7 l11 -13" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="${r1(v)}"/>`;
  }
  ctx.svg('over', s);
  if (lab) label(ctx, lab, { x: x + (n * (size + gap) - gap) / 2, y: y + size + 34, t0, size: 28, color: 'var(--ink-2)' });
}
