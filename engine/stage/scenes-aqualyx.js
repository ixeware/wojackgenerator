// Scenes for the Aqualyx (deoxycholate fat-dissolving injection) episode.
// Research explainer: mechanism, trial evidence, risks. Deliberately contains
// no dosing, mixing or injection-technique content.
import { W, r1, lerp, clamp, easeOut, easeInOut, spring, vis, rng } from './lib.js';
import * as P from './parts.js';
import * as D from './diagrams.js';
import { head, has, after, prog, at, DOCK_Y } from './scenes.js';

const INK = 'var(--ink)';
const LIPID = '#FFD54A';

/* ----------------------------------------------------------- drawings */

/** Fat cell: big lipid droplet, thin rim, flattened nucleus. burst 0..1 lyses it. */
function adipocyte(x, y, r, burst = 0, seed = 1) {
  if (burst <= 0.001) {
    return `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" fill="#FFF3C9" stroke="${INK}" stroke-width="4.5"/>
      <circle cx="${r1(x - r * 0.06)}" cy="${r1(y + r * 0.04)}" r="${r1(r * 0.8)}" fill="${LIPID}"/>
      <path d="M${r1(x - r * 0.55)} ${r1(y - r * 0.25)} A${r1(r * 0.6)} ${r1(r * 0.6)} 0 0 1 ${r1(x - r * 0.1)} ${r1(y - r * 0.62)}" stroke="#fff" stroke-width="${r1(Math.max(3, r * 0.07))}" fill="none" stroke-linecap="round" opacity=".85"/>
      <ellipse cx="${r1(x + r * 0.7)}" cy="${r1(y - r * 0.3)}" rx="${r1(r * 0.13)}" ry="${r1(r * 0.07)}" fill="var(--nucleus)" transform="rotate(-62 ${r1(x + r * 0.7)} ${r1(y - r * 0.3)})"/>`;
  }
  const R = rng(seed * 7 + 3);
  const b = easeOut(clamp(burst, 0, 1));
  let s = `<g opacity="${r1(1 - b * 0.55)}">`;
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 + R() * 0.3, a1 = a0 + (Math.PI * 2 / n) * (1 - 0.6 * b);
    const push = r * 0.35 * b, mid = (a0 + a1) / 2;
    const cx = x + Math.cos(mid) * push, cy = y + Math.sin(mid) * push;
    const p = a => `${r1(cx + Math.cos(a) * r)} ${r1(cy + Math.sin(a) * r)}`;
    s += `<path d="M${p(a0)} A${r1(r)} ${r1(r)} 0 0 1 ${p(a1)}" stroke="${INK}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
  }
  for (let k = 0; k < 10; k++) {
    const ang = R() * Math.PI * 2, d = r * (0.2 + 1.15 * b * R()), sz = r * (0.16 + 0.14 * R()) * (1 - 0.35 * b);
    s += `<circle cx="${r1(x + Math.cos(ang) * d)}" cy="${r1(y + Math.sin(ang) * d)}" r="${r1(sz)}" fill="${LIPID}" opacity="${r1(1 - 0.5 * b)}"/>`;
  }
  return s + '</g>';
}

/** Deoxycholate, drawn as a bile-acid steroid skeleton (schematic). */
function steroid(cx, cy, L, v = 1) {
  const pt = (x, y, a, rr) => [x + rr * Math.cos(a * Math.PI / 180), y + rr * Math.sin(a * Math.PI / 180)];
  const hex = (x, y) => [-90, -30, 30, 90, 150, 210].map(a => pt(x, y, a, L));
  const s3 = Math.sqrt(3) * L;
  const A = [cx, cy], B = [cx + s3, cy], C = [cx + 1.5 * s3, cy - 1.5 * L];
  const Dc = [C[0] + 0.866 * L + 0.688 * L, C[1]];
  const pent = [144, 216, 288, 0, 72].map(a => pt(Dc[0], Dc[1], a, 0.851 * L));
  const poly = ps => `M${ps.map(p => `${r1(p[0])} ${r1(p[1])}`).join(' L')} Z`;
  const tail0 = pent[2];
  const tail = [tail0, [tail0[0] + 0.7 * L, tail0[1] - 0.5 * L], [tail0[0] + 1.4 * L, tail0[1]], [tail0[0] + 2.1 * L, tail0[1] - 0.5 * L]];
  const oh1 = hex(...A)[4], oh2 = hex(...C)[0];
  return `<g opacity="${r1(v)}" fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
    <path d="${poly(hex(...A))}" fill="#fff"/><path d="${poly(hex(...B))}" fill="#fff"/><path d="${poly(hex(...C))}" fill="#fff"/><path d="${poly(pent)}" fill="#fff"/>
    <path d="M${tail.map(p => `${r1(p[0])} ${r1(p[1])}`).join(' L')}"/>
    <path d="M${r1(oh1[0])} ${r1(oh1[1])} l${r1(-0.55 * L)} ${r1(0.3 * L)}"/>
    <path d="M${r1(oh2[0])} ${r1(oh2[1])} l0 ${r1(-0.55 * L)}"/>
  </g>
  <g font-family="Onest" font-weight="800" font-size="${r1(L * 0.62)}" fill="${INK}" opacity="${r1(v)}">
    <text x="${r1(oh1[0] - 1.45 * L)}" y="${r1(oh1[1] + 0.55 * L)}">HO</text>
    <text x="${r1(oh2[0] - 0.4 * L)}" y="${r1(oh2[1] - 0.72 * L)}">OH</text>
    <text x="${r1(tail[3][0] + 0.15 * L)}" y="${r1(tail[3][1] + 0.2 * L)}" fill="var(--blue)">COO⁻</text>
  </g>`;
}

/** Detergent molecule: polar head + greasy tail. */
function amphiphile(x, y, ang, s = 1, op = 1) {
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
  let d = `M${r1(x)} ${r1(y)}`;
  for (let i = 1; i <= 4; i++) {
    const w = (i % 2 ? 1 : -1) * 5 * s;
    d += ` L${r1(x + ux * 8 * s * i + nx * w)} ${r1(y + uy * 8 * s * i + ny * w)}`;
  }
  return `<g opacity="${r1(op)}"><path d="${d}" stroke="${INK}" stroke-width="${r1(3.2 * s)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(7.5 * s)}" fill="var(--blue)" stroke="${INK}" stroke-width="${r1(2.5 * s)}"/></g>`;
}

/** Generic vial — no brand. */
function vial(x, y, s, label, v = 1) {
  return `<g opacity="${r1(v)}" transform="translate(${r1(x)} ${r1(y)}) scale(${s})">
    <rect x="-46" y="-74" width="92" height="190" rx="18" fill="rgba(226,239,255,.9)" stroke="${INK}" stroke-width="6"/>
    <rect x="-40" y="10" width="80" height="100" rx="12" fill="#CFE5FF"/>
    <rect x="-34" y="-112" width="68" height="44" rx="10" fill="var(--blue)" stroke="${INK}" stroke-width="6"/>
    <rect x="-46" y="-30" width="92" height="44" fill="#fff" stroke="${INK}" stroke-width="4"/>
    <text x="0" y="-1" text-anchor="middle" font-family="Onest" font-weight="800" font-size="15" fill="${INK}">${label}</text>
  </g>`;
}

/** Skin / fat / muscle column with protein "sponges" in skin and muscle. */
function tissue(ctx, o) {
  const { x, y, w, h, soak = 0, burst = 0, v = 1 } = o;
  if (v <= 0) return;
  const R = rng(17);
  const skinH = h * 0.2, fatH = h * 0.52, musH = h - skinH - fatH;
  let s = `<g opacity="${r1(v)}"><clipPath id="tz"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="26"/></clipPath><g clip-path="url(#tz)">
    <rect x="${x}" y="${y}" width="${w}" height="${r1(skinH)}" fill="#F6CFC5"/>
    <rect x="${x}" y="${r1(y + skinH)}" width="${w}" height="${r1(fatH)}" fill="#FFF4D2"/>
    <rect x="${x}" y="${r1(y + skinH + fatH)}" width="${w}" height="${r1(musH)}" fill="#E48C7E"/>`;
  for (let i = 0; i < 6; i++) s += `<path d="M${x} ${r1(y + skinH + fatH + 14 + i * (musH - 20) / 6)} h${w}" stroke="#C9665A" stroke-width="5" opacity=".6"/>`;
  // fat lobules
  const cols = 3, rows = 3, cw = w / cols, ch = fatH / rows;
  for (let rI = 0; rI < rows; rI++) for (let c = 0; c < cols; c++) {
    const k = rI * cols + c;
    const bk = clamp(burst * 1.6 - k * 0.07, 0, 1);
    s += adipocyte(x + cw * (c + 0.5) + (rI % 2 ? 14 : -10), y + skinH + ch * (rI + 0.5), Math.min(cw, ch) * 0.4, bk, k + 2);
  }
  // protein sponges (blue dots) in skin and muscle
  const prot = [];
  for (let i = 0; i < 9; i++) prot.push([x + 22 + R() * (w - 44), y + 18 + R() * (skinH - 36)]);
  for (let i = 0; i < 9; i++) prot.push([x + 22 + R() * (w - 44), y + skinH + fatH + 18 + R() * (musH - 36)]);
  for (const [px, py] of prot) s += `<circle cx="${r1(px)}" cy="${r1(py)}" r="9" fill="#3E7BFA" stroke="${INK}" stroke-width="2.5"/>`;
  // detergent molecules: those near proteins get soaked up (fade in place)
  for (let i = 0; i < prot.length; i++) {
    const [px, py] = prot[i];
    const ang = R() * Math.PI * 2;
    const fx = px + Math.cos(ang) * 42, fy = py + Math.sin(ang) * 32;
    const k = easeOut(soak);
    s += amphiphile(lerp(fx, px + Math.cos(ang) * 12, k), lerp(fy, py + Math.sin(ang) * 12, k), ang, 0.8, 1 - 0.75 * k);
  }
  s += `</g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="26" fill="none" stroke="${INK}" stroke-width="6"/></g>`;
  ctx.svg('under', s);
  const lab = (t, yy, c) => ctx.html('over', `<div class="label up" style="left:${x - 14}px;top:${r1(yy)}px;transform:translate(-100%,-50%);opacity:${r1(v)};color:${c}">${t}</div>`);
  lab('skin', y + skinH / 2, '#B5523F'); lab('fat', y + skinH + fatH / 2, '#A07A00'); lab('muscle', y + skinH + fatH + musH / 2, '#9B3A2D');
  return { skin: [x + w / 2, y + skinH / 2], fat: [x + w / 2, y + skinH + fatH / 2] };
}

/* ----------------------------------------------------------- scenes */

const CLUSTER = [[560, 720, 70], [700, 700, 66], [840, 745, 62], [500, 860, 72], [645, 852, 78], [792, 885, 70],
  [560, 1003, 66], [705, 1005, 72], [850, 1022, 60], [935, 870, 46], [440, 990, 50]];

export const aqScenes = {
  // ================================================================= HOOK
  aqHook(ctx, shot) {
    const hv = vis(ctx.t, 0, Infinity, 0.3);
    ctx.html('over', `<div class="disp" style="position:absolute;left:62px;top:${r1(116 + (1 - hv) * 18)}px;width:960px;font-size:104px;line-height:0.98;opacity:${r1(hv)}">This shot<br>melts <span style="background:var(--yellow);padding:0 12px;border-radius:14px">fat</span> <span class="emoji" style="font-size:90px">💀</span></div>`);
    ctx.svg('under', vial(205, 870, 1.35, 'deoxycholate', vis(ctx.t, 0.15)));
    P.arrow(ctx, [300, 860], [420, 860], at(ctx, 'melts', -0.35, 0.8), { color: INK, width: 8, bend: 0 });
    const m = at(ctx, 'melts', 0, 1.2);
    let svg = '';
    CLUSTER.forEach(([x, y, r], i) => {
      const pv = spring((ctx.t - (0.1 + i * 0.04)) * 1.4);
      if (pv <= 0) return;
      const b = clamp((ctx.t - (m + 0.07 * i)) / 0.5, 0, 1);
      svg += `<g transform="translate(${x} ${y}) scale(${r1(Math.min(1, pv))}) translate(${-x} ${-y})">${adipocyte(x, y, r, b, i + 1)}</g>`;
    });
    ctx.svg('under', svg);
    ctx.anchor(shot.id + '.cells', 645, 830);
    // soap bubbles rise on "soap"
    const sp = at(ctx, 'soap', -0.1);
    if (ctx.t > sp) {
      let bub = '';
      const R = rng(4);
      for (let i = 0; i < 12; i++) {
        const tt = ctx.t - sp - i * 0.06;
        if (tt < 0) continue;
        const bx = 440 + R() * 520, by = 1080 - tt * (160 + R() * 120), br = 10 + R() * 22;
        bub += `<circle cx="${r1(bx + Math.sin(tt * 3 + i) * 12)}" cy="${r1(by)}" r="${r1(br)}" fill="rgba(255,255,255,.55)" stroke="${INK}" stroke-width="3" opacity="${r1(clamp(1.6 - tt, 0, 1))}"/>`;
      }
      ctx.svg('over', bub);
    }
    P.emoji(ctx, '🧼', { x: 200, y: 600, size: 140, t0: at(ctx, 'soap', -0.05), rot: -10 });
    return { camera: { scale: lerp(1.06, 1, easeOut(clamp(ctx.local / 1.2, 0, 1))), ox: 540, oy: 820 } };
  },

  // ================================================================= WHAT IT IS
  aqWhat(ctx, shot) {
    head(ctx, { title: "It's a\nbile acid.", sub: 'Deoxycholate', subColor: 'var(--blue)' });
    const mv = vis(ctx.t, at(ctx, 'deoxycholate', -0.2, shot.start + 0.4), Infinity, 0.3);
    ctx.svg('under', steroid(150, 700, 52, mv));
    P.label(ctx, 'deoxycholate', { x: 330, y: 840, t0: at(ctx, 'deoxycholate', 0, shot.start + 0.5), size: 38, weight: 800, font: 'Bricolage', color: 'var(--blue)' });
    ctx.anchor(shot.id + '.molecule', 320, 650);
    P.chip(ctx, '🧪 bile acid · digests fat', { x: 330, y: 920, t0: at(ctx, 'bile', 0, shot.start + 1), size: 30, bg: 'var(--green-soft)' });
    // one big fat cell; detergent molecules gather on its membrane, then it tears
    const cx = 760, cy = 1090, r = 150;
    const cv = spring((ctx.t - (shot.start + 0.3)) * 1.3);
    const rip = prog(ctx, 'rips', 0.6);
    let s = '';
    if (cv > 0) {
      s += `<g transform="translate(${cx} ${cy}) scale(${r1(Math.min(1, cv))}) translate(${-cx} ${-cy})">${adipocyte(cx, cy, r, rip, 9)}</g>`;
      const gather = clamp((ctx.t - at(ctx, 'fatIn', -0.8, shot.start + 2)) / 0.8, 0, 1);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const far = r + 120, near = r + 16;
        const d = lerp(far, near, easeOut(gather)) + rip * 60;
        s += amphiphile(cx + Math.cos(a) * d, cy + Math.sin(a) * d, a, 1.1, gather * (1 - rip * 0.8));
      }
    }
    ctx.svg('under', s);
    ctx.anchor(shot.id + '.cell', cx - 40, cy - 60);
    P.stamp(ctx, 'ripped open', { x: 760, y: 870, t0: at(ctx, 'rips', 0.15), size: 52, rot: -6 });
    return {};
  },

  // ================================================================= WHY MOSTLY FAT
  aqSelect(ctx, shot) {
    head(ctx, { title: 'Why mostly\nfat?', year: '2010' });
    P.citeDock(ctx, ctx.TL.papers[shot.paper], shot.start + 0.03, Infinity, DOCK_Y);
    // in a dish: everything dies
    P.label(ctx, 'in a dish', { x: 270, y: 610, t0: shot.start + 0.15, size: 36, weight: 800, font: 'Bricolage' });
    D.dish(ctx, { cx: 270, cy: 850, r: 185, n: 16, divide: 0, die: prog(ctx, 'kills', 0.8), v: vis(ctx.t, shot.start + 0.2), seed: 6 });
    P.stamp(ctx, 'all cells die', { x: 270, y: 1090, t0: at(ctx, 'kills', 0.35), size: 44, rot: -6 });
    // in the body: proteins in skin & muscle soak it up, fat bursts
    P.label(ctx, 'in your body', { x: 790, y: 610, t0: at(ctx, 'body', -0.1, shot.start + 1), size: 36, weight: 800, font: 'Bricolage' });
    const tz = tissue(ctx, { x: 640, y: 650, w: 300, h: 640, soak: prog(ctx, 'soak', 0.8, -0.3), burst: prog(ctx, 'bursts', 0.7, -0.1),
      v: vis(ctx.t, at(ctx, 'body', -0.15, shot.start + 1)) });
    if (tz) { ctx.anchor(shot.id + '.skin', ...tz.skin); ctx.anchor(shot.id + '.fat', ...tz.fat); }
    else { ctx.anchor(shot.id + '.skin', 790, 720); ctx.anchor(shot.id + '.fat', 790, 950); }
    P.chip(ctx, '🔵 proteins soak it up', { x: 790, y: 1340, t0: at(ctx, 'proteins', 0), size: 28, bg: '#DCE8FF' });
    return {};
  },

  // ================================================================= TRIALS
  aqTrials(ctx, shot) {
    head(ctx, { title: 'Does it\nwork?', year: '2016' });
    const [p1, p2] = (shot.papers || []).map(k => ctx.TL.papers[k]);
    if (p1) P.citeDock(ctx, p1, shot.start + 0.03, Infinity, DOCK_Y);
    if (p2) P.citeCard(ctx, p2, { x: 70, y: 586, w: 940, t0: at(ctx, 'trials', -0.3, shot.start + 1.2), size: 33, lines: 2, tilt: 0 });
    // composite ≥1-grade responders, 12 weeks after last treatment (abstracts)
    const groups = [['REFINE-1', 70.0, 18.6], ['REFINE-2', 66.5, 22.2]];
    const base = 1300, H = 400, bw = 120;
    const up = easeOut(has(ctx, 'shrank') ? prog(ctx, 'shrank', 1.1) : prog(ctx, 'thirds', 0.6, -0.2)), upP = easeOut(prog(ctx, 'placebo', 0.5));
    const v = vis(ctx.t, at(ctx, 'kybella', 0.2, shot.start + 0.5));
    let s = `<g opacity="${r1(v)}"><line x1="120" y1="${base}" x2="960" y2="${base}" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
    groups.forEach(([name, drug, plac], gi) => {
      const gx = 220 + gi * 420;
      const hd = H * drug / 100 * up, hp = H * plac / 100 * upP;
      s += `<rect x="${gx}" y="${r1(base - hd)}" width="${bw}" height="${r1(hd)}" rx="12" fill="var(--green)" stroke="${INK}" stroke-width="5"/>
        <rect x="${gx + bw + 24}" y="${r1(base - hp)}" width="${bw}" height="${r1(hp)}" rx="12" fill="#D9D4CA" stroke="${INK}" stroke-width="5"/>`;
      if (up > 0.6) s += `<text x="${gx + bw / 2}" y="${r1(base - hd - 18)}" text-anchor="middle" font-family="Bricolage" font-weight="800" font-size="46" fill="var(--green)">${drug}%</text>`;
      if (upP > 0.6) s += `<text x="${gx + bw * 1.5 + 24}" y="${r1(base - hp - 18)}" text-anchor="middle" font-family="Bricolage" font-weight="800" font-size="40" fill="${INK}">${plac}%</text>`;
      s += `<text x="${gx + bw + 12}" y="${base + 44}" text-anchor="middle" font-family="Onest" font-weight="800" font-size="28" fill="${INK}">${name}</text>`;
    });
    ctx.svg('under', s + '</g>');
    ctx.anchor(shot.id + '.bar', 280, base - H * 0.70 + 30);
    ctx.anchor(shot.id + '.placebo', 424, base - H * 0.186 + 10);
    P.chip(ctx, 'Kybella (deoxycholic acid)', { x: 290, y: 880, t0: at(ctx, 'kybella', 0.1, shot.start + 0.6), size: 26, bg: 'var(--green-soft)' });
    P.chip(ctx, 'placebo', { x: 760, y: 880, t0: at(ctx, 'placebo', -0.1), size: 26, bg: '#EDE8DE' });
    P.label(ctx, '≥1-grade chin-fat improvement · clinician + patient rated', { x: 540, y: 1388, t0: at(ctx, 'thirds', 0), size: 22, color: 'var(--muted)', weight: 600 });
    return {};
  },

  // ================================================================= THE CATCH
  aqCatch(ctx, shot) {
    head(ctx, { title: 'The\ncatch.' });
    P.citeDock(ctx, ctx.TL.papers[shot.paper], shot.start + 0.03, Infinity, DOCK_Y);
    // our presenter's own face as the anatomy model
    const fx = 70, fy = 590, k = 0.8, fw = 711 * k, fh = 820 * k;
    const fv = vis(ctx.t, shot.start + 0.1);
    ctx.img('aq-face', 'presenter/01_idle.png', { x: fx, y: fy, w: fw, h: fh, opacity: fv, z: 22 });
    const F = (px, py) => [fx + px * k, fy + py * k];
    // swelling: a warm glow over the jaw that pulses
    const sw = prog(ctx, 'swelling', 0.4);
    if (sw > 0) {
      const [sx, sy] = F(520, 720);
      ctx.svg('over', `<ellipse cx="${r1(sx)}" cy="${r1(sy)}" rx="${r1(150 * k * (1 + 0.04 * Math.sin(ctx.t * 6)))}" ry="${r1(95 * k)}" fill="#FF6A4D" opacity="${r1(0.28 * sw)}"/>`);
    }
    // marginal mandibular nerve along the jaw
    const nv = prog(ctx, 'nerve', 0.5, -0.15);
    if (nv > 0) {
      const pts = [[660, 590], [640, 660], [600, 725], [545, 760], [480, 742]].map(p => F(...p));
      const d = `M${pts.map(p => `${r1(p[0])} ${r1(p[1])}`).join(' L')}`;
      const len = 420 * k;
      const hot = after(ctx, 'lopsided', 0) && Math.sin(ctx.t * 12) > 0;
      ctx.svg('over', `<path d="${d}" fill="none" stroke="${INK}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${r1(len)}" stroke-dashoffset="${r1(len * (1 - easeOut(nv)))}"/>
        <path d="${d}" fill="none" stroke="${hot ? 'var(--red)' : 'var(--yellow)'}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${r1(len)}" stroke-dashoffset="${r1(len * (1 - easeOut(nv)))}"/>`);
    }
    ctx.anchor(shot.id + '.nerve', ...F(600, 725));
    P.chip(ctx, '🥵 swelling for days', { x: 1010, y: 700, t0: at(ctx, 'swelling', -0.05), align: 'right', size: 30 });
    P.chip(ctx, '⚡ nerve injury: 4.3%', { x: 1010, y: 820, t0: at(ctx, 'nerve', 0), align: 'right', size: 30, bg: 'var(--red-soft)' });
    P.chip(ctx, 'temporary', { x: 1010, y: 920, t0: at(ctx, 'temporary', 0, at(ctx, 'nerve', 0.3)), align: 'right', size: 26, cls: 'ink' });
    P.stamp(ctx, 'lopsided smile', { x: 760, y: 1060, t0: at(ctx, 'lopsided', 0.05), size: 50, rot: -6 });
    P.sticker(ctx, 'crying', { x: 905, y: 1340, h: 230, t0: at(ctx, 'lopsided', 0.3), key: 'stk-aq-cry', rot: 5 });
    return {};
  },

  // ================================================================= DIY CASE
  aqCase(ctx, shot) {
    head(ctx, { title: 'DIY gone\nwrong.', year: '2022' });
    P.citeDock(ctx, ctx.TL.papers[shot.paper], shot.start + 0.03, Infinity, DOCK_Y);
    P.chip(ctx, '💉 "sold as Aqualyx"', { x: 90, y: 640, t0: at(ctx, 'sold', -0.1, shot.start + 0.5), align: 'left', size: 32 });
    P.chip(ctx, '🚫 injector with no training', { x: 90, y: 740, t0: at(ctx, 'untrained', -0.1, shot.start + 1), align: 'left', size: 32, bg: 'var(--red-soft)' });
    P.stamp(ctx, 'skin necrosis', { x: 420, y: 900, t0: at(ctx, 'necrosis', 0), size: 58, rot: -6 });
    P.stamp(ctx, 'painful nodules', { x: 470, y: 1040, t0: at(ctx, 'nodules', 0), size: 52, rot: 4 });
    P.stamp(ctx, 'burst open', { x: 380, y: 1170, t0: at(ctx, 'burst', 0), size: 50, rot: -3 });
    ctx.anchor(shot.id + '.stamp', 420, 900);
    P.sticker(ctx, 'nooo', { x: 870, y: 1110, h: 250, t0: at(ctx, 'necrosis', 0.2), key: 'stk-aq-nooo', rot: 4, flip: true });
    P.chip(ctx, 'real Aqualyx is sold only to trained clinicians', { x: 540, y: 1300, t0: at(ctx, 'burst', 0.3), size: 24, cls: 'ink' });
    return {};
  },

  // ================================================================= MY TAKE
  aqTake(ctx, shot) {
    head(ctx, { title: 'My honest\ntake.' });
    const good = at(ctx, 'clinic', -0.2, shot.start + 0.6), bad = at(ctx, 'slideshow', -0.3, shot.start + 2.5);
    P.card(ctx, { x: 90, y: 560, w: 900, h: 200, t0: good, radius: 30, bg: 'var(--green-soft)' });
    ctx.html('over', `<div class="emoji" style="position:absolute;left:140px;top:660px;font-size:80px;transform:translateY(-50%);opacity:${r1(vis(ctx.t, good + 0.08))}">✅</div>`);
    P.label(ctx, 'Clinic + small fat pocket', { x: 260, y: 634, t0: good + 0.1, align: 'left', size: 44, weight: 800, font: 'Bricolage' });
    P.label(ctx, 'it works', { x: 260, y: 692, t0: at(ctx, 'works2', 0, good + 0.6), align: 'left', size: 40, weight: 800, font: 'Bricolage', color: 'var(--green)' });
    P.card(ctx, { x: 90, y: 820, w: 900, h: 200, t0: bad, radius: 30, bg: 'var(--red-soft)' });
    ctx.html('over', `<div class="emoji" style="position:absolute;left:140px;top:920px;font-size:80px;transform:translateY(-50%);opacity:${r1(vis(ctx.t, bad + 0.08))}">❌</div>`);
    P.label(ctx, 'TikTok slideshow + syringe', { x: 260, y: 894, t0: bad + 0.1, align: 'left', size: 44, weight: 800, font: 'Bricolage' });
    P.label(ctx, 'hard pass', { x: 260, y: 952, t0: at(ctx, 'pass', 0, bad + 0.8), align: 'left', size: 40, weight: 800, font: 'Bricolage', color: 'var(--red)' });
    ctx.anchor(shot.id + '.good', 800, 640);
    ctx.anchor(shot.id + '.bad', 800, 900);
    P.sticker(ctx, 'chad', { x: 900, y: 500, h: 220, t0: at(ctx, 'works2', 0.1), key: 'stk-aq-chad', rot: -3 });
    P.stamp(ctx, 'hard pass', { x: 540, y: 1180, t0: at(ctx, 'pass', 0.1), size: 84, rot: -6 });
    return {};
  },
};
