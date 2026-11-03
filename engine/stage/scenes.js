// One function per shot kind. Each is a pure function of ctx (time, assets,
// anchors) and draws that moment. Internal animation syncs to anchored word
// times via ctx.mark/ctx.since so visuals land on the exact word.
import { W, H, r1, lerp, clamp, easeOut, easeOut2, easeIn, easeInOut, backOut, spring, vis } from './lib.js';
import * as P from './parts.js';
import * as D from './diagrams.js';

const TITLE_Y = 150;

// headline + context label block shared by study scenes
function head(ctx, o) {
  const { title, sub, t0 = ctx.shot.start, color = 'var(--ink)', subColor = 'var(--red)', year } = o;
  const v = vis(ctx.t, t0, Infinity, 0.3);
  if (v <= 0) return;
  const lines = title.split('\n');
  lines.forEach((l, i) => {
    const lv = vis(ctx.t, t0 + i * 0.08, Infinity, 0.3);
    ctx.html('over', `<div class="disp" style="position:absolute;left:64px;top:${TITLE_Y + i * 92}px;font-size:84px;line-height:1.02;color:${color};opacity:${r1(lv)};transform:translateY(${r1((1 - lv) * 14)}px)">${l}</div>`);
  });
  if (year) {
    P.chip(ctx, year, { x: W - 70, y: TITLE_Y + 24, t0: t0 + 0.1, align: 'right', cls: 'ink', size: 30 });
  }
  if (sub) {
    const y = TITLE_Y + lines.length * 92 + 8;
    ctx.html('over', `<div class="label up" style="left:66px;top:${y}px;opacity:${r1(v)};color:${subColor}">${sub}</div>`);
  }
}

const since = (ctx, m) => ctx.since(m);
const after = (ctx, m, d = 0) => ctx.mark(m) != null && ctx.t >= ctx.mark(m) + d;
const prog = (ctx, m, dur, delay = 0) => { const s = ctx.mark(m); return s == null ? 0 : clamp((ctx.t - s - delay) / dur, 0, 1); };

export const scenes = {
  // ----------------------------------------------------------------- HOOK
  hook(ctx, shot) {
    const lt = ctx.local;
    // big question headline
    const hv = vis(ctx.t, 0.05, Infinity, 0.4);
    ctx.html('over', `<div class="disp" style="position:absolute;left:60px;top:120px;width:960px;font-size:96px;line-height:0.98;opacity:${r1(hv)}">Can a <span style="color:var(--red)">painkiller</span><br>make you<br><span style="color:var(--red)">shorter?</span></div>`);

    // three pills tumble in
    const names = ['ibuprofen', 'aspirin', 'naproxen'];
    const px = [300, 540, 780];
    names.forEach((id, i) => {
      const k = spring((lt - (0.3 + i * 0.12)) * 1.3);
      if (k <= 0) return;
      P.pill(ctx, id, { cx: px[i], cy: lerp(560, 640, easeOut(k)), size: lerp(60, 210, Math.min(1, k)), rot: lerp(-40, [-12, 6, -6][i], easeOut(k)), key: 'hk-' + id, o: Math.min(1, k * 1.4) });
    });
    ctx.anchor(shot.id + '.pill', 540, 640);

    // arrow pills -> mouse once pills are down
    const arrowAt = ctx.mark('mice') ?? 3.5;
    P.arrow(ctx, [820, 700], [905, 760], arrowAt - 0.3, { color: 'var(--ink)', width: 9, bend: 0.1 });

    // the mouse, then it shrinks into a dwarf as "dwarfs" is said
    const shrink = prog(ctx, 'dwarfs', 0.5, 0.0);
    const mouseV = spring((lt - 1.1) * 1.1);
    if (mouseV > 0) {
      const base = 300, sz = lerp(base, base * 0.5, easeInOut(shrink));
      P.sticker(ctx, 'mouse', { x: 905, y: lerp(900, 980, easeInOut(shrink)), h: sz * mouseV, t0: 1.0, key: 'hk-mouse', z: 44 });
    }
    ctx.anchor(shot.id + '.mouse', 905, 820);
    if (shrink > 0.3) {
      P.emoji(ctx, '💀', { x: 905, y: 560, size: lerp(40, 150, easeOut(shrink)), t0: ctx.mark('dwarfs'), rot: -6 });
    }

    // "DWARFISM" stamp + not clickbait
    if (after(ctx, 'dwarfs', 0.1)) {
      P.stamp(ctx, 'dwarfs', { x: 540, y: 1180, t0: ctx.mark('dwarfs') + 0.08, rot: -7, color: 'var(--red)', size: 120, anchor: shot.id + '.stamp' });
    }
    if (after(ctx, 'clickbait', -0.2)) {
      P.chip(ctx, 'NOT clickbait', { x: 540, y: 1330, t0: ctx.mark('clickbait') - 0.1, cls: 'ink', size: 40, rot: -2 });
    }
    return { camera: { scale: lerp(1.06, 1, easeOut(clamp(lt / 1.2, 0, 1))), ox: 540, oy: 700 } };
  },

  // ----------------------------------------------------------------- PAPER proof
  paper(ctx, shot) {
    const paper = ctx.TL.papers[shot.paper];
    head(ctx, { title: "It's in\nthe paper.", sub: 'Receipts', subColor: 'var(--green)' });
    P.citeCard(ctx, paper, {
      x: 90, y: 470, w: 900, t0: shot.start + 0.1, size: 52, lines: 4,
      quote: paper.quote, highlight: paper.highlight, hlAt: ctx.mark('actual'),
      anchor: shot.id + '.highlight', tilt: -1.4,
    });
    // register where the highlighted word sits (approx, lower third of card)
    ctx.anchor(shot.id + '.highlight', 300, 980);
    return {};
  },

  // ----------------------------------------------------------------- COX block
  cox(ctx, shot) {
    head(ctx, { title: 'They all\nblock COX.', sub: 'One enzyme, many signals', subColor: 'var(--violet)' });
    // three pills on the left, lined up
    const names = ['ibuprofen', 'aspirin', 'naproxen'];
    const labels = ['Ibuprofen', 'Aspirin', 'Naproxen'];
    names.forEach((id, i) => {
      const k = spring((ctx.local - (0.1 + i * 0.1)) * 1.4);
      if (k <= 0) return;
      const cy = 560 + i * 150;
      P.pill(ctx, id, { cx: 190, cy, size: 128 * Math.min(1, k), rot: [-8, 4, -5][i], key: 'cx-' + id, o: Math.min(1, k * 1.3) });
      P.label(ctx, labels[i], { x: 290, y: cy, t0: shot.start + 0.1 + i * 0.1, align: 'left', size: 38, weight: 700 });
    });
    // arrows into the enzyme
    const enzymeX = 760, enzymeY = 720;
    D.enzyme(ctx, { cx: enzymeX, cy: enzymeY, r: 150, label: 'COX', color: 'var(--violet)', wob: 1,
      blocked: prog(ctx, 'enzyme', 0.5, 0.2), v: vis(ctx.t, shot.start + 0.3) });
    ctx.anchor(shot.id + '.enzyme', enzymeX, enzymeY - 40);
    [540, 710, 880].forEach((cy, i) => P.arrow(ctx, [330, cy], [enzymeX - 150, enzymeY], shot.start + 0.4 + i * 0.08, { color: 'var(--ink)', width: 6, bend: 0.12 }));

    // COX -> prostaglandins -> "more than pain"
    if (after(ctx, 'prostaglandins', -0.3)) {
      const pv = vis(ctx.t, ctx.mark('prostaglandins') - 0.2);
      ctx.svg('under', `<g opacity="${r1(pv)}">${D.pg(760, 1010, 1.8, 'var(--green)', 1)}</g>`);
      P.label(ctx, 'prostaglandins', { x: 760, y: 1110, t0: ctx.mark('prostaglandins') - 0.1, size: 40, color: 'var(--green)', weight: 700 });
      P.arrow(ctx, [enzymeX, enzymeY + 150], [760, 960], ctx.mark('prostaglandins') - 0.2, { color: 'var(--green)', width: 7 });
    }
    if (after(ctx, 'pain', -0.2)) {
      P.chip(ctx, '🔥 pain · 🦴 bone growth · 🩸 more', { x: 540, y: 1230, t0: ctx.mark('pain') - 0.1, size: 34 });
    }
    return {};
  },

  // ----------------------------------------------------------------- GROWTH PLATE
  plate(ctx, shot) {
    head(ctx, { title: 'Where bones\nget longer.', sub: 'The growth plate', subColor: 'var(--blue)' });
    // bone on the left; glow its growth plate on "growth plate"
    const g = prog(ctx, 'plate', 0.6, 0);
    const b = D.bone(ctx, { cx: 250, top: 420, h: 760, w: 220, t0: shot.start + 0.2, glow: g, anchor: shot.id + '.band' });
    ctx.anchor(shot.id + '.band', 320, 548);
    P.label(ctx, 'growth plate', { x: 250, y: 1230, t0: ctx.mark('plate') - 0.1, size: 36, color: 'var(--blue)', weight: 700 });

    // zoomed column on the right showing divide / swell / replaced
    const col = D.plateColumn(ctx, {
      x: 640, y: 440, w: 230, h: 740,
      divide: prog(ctx, 'divide', 1.0, 0),
      swell: prog(ctx, 'swell', 1.0, 0),
      ossify: prog(ctx, 'replaced', 1.1, 0),
      v: vis(ctx.t, shot.start + 0.3),
    });
    // connector from plate to column
    P.arrow(ctx, [380, 548], [630, 520], shot.start + 0.5, { color: 'var(--ink)', width: 6, bend: -0.1, dash: '2 10' });
    return {};
  },

  // ----------------------------------------------------------------- 2015 PATHWAY
  pathway(ctx, shot) {
    head(ctx, { title: 'The growth\nsignal.', sub: 'COX-2 · IGF-1 · ERK', subColor: 'var(--violet)', year: '2015' });
    P.citeDock(ctx, ctx.TL.papers[shot.paper], shot.start + 0.2, Infinity, 300);

    const cx = 300;
    const ys = { cox: 620, pg: 850, erk: 1080 };
    // signal rail
    ctx.svg('under', `<line x1="${cx}" y1="${ys.cox + 80}" x2="${cx}" y2="${ys.erk - 80}" stroke="#C7CBD2" stroke-width="7"/>`);

    const blocked = prog(ctx, 'block2015', 0.5);
    const stopped = prog(ctx, 'stop', 0.5);
    const rescue = prog(ctx, 'add2015', 0.6);
    const returned = prog(ctx, 'returns', 0.5);

    // COX-2 node, dimmed when blocked
    D.node(ctx, { cx, cy: ys.cox, r: 86, text: 'COX-2', state: blocked > 0.3 ? -1 : 1, color: 'var(--violet)', v: vis(ctx.t, shot.start + 0.3), anchor: shot.id + '.cox', size: 40 });
    // IGF-1 input arrow raising COX-2 (on "packed / igf")
    if (after(ctx, 'igf', -0.2)) {
      P.arrow(ctx, [cx - 230, ys.cox - 40], [cx - 86, ys.cox], ctx.mark('igf') - 0.1, { color: 'var(--green)', width: 7 });
      P.chip(ctx, 'IGF-1 ↑', { x: cx - 250, y: ys.cox - 70, t0: ctx.mark('igf') - 0.1, size: 30, bg: 'var(--green-soft)', color: 'var(--ink)' });
    }
    // block token docks on "block"
    if (blocked > 0) {
      const k = spring(blocked * 1.3);
      P.pill(ctx, 'ibuprofen', { cx: lerp(cx + 320, cx + 110, easeOut(blocked)), cy: ys.cox, size: 96 * Math.min(1, k), rot: -12, key: 'pw-pill' });
    }

    // PGE2 / prostacyclin node
    D.node(ctx, { cx, cy: ys.pg, r: 72, text: 'PG', sub: rescue > 0.2 ? '+ added' : 'PGE2/PGI2', state: blocked > 0.3 && rescue < 0.3 ? 0 : 1, color: 'var(--green)', v: vis(ctx.t, shot.start + 0.4), anchor: shot.id + '.pg' });
    ctx.svg('under', D.pg(cx, ys.pg, rescue > 0.2 ? 1 : 0.0001, 'var(--green)', clamp(rescue, 0, 1)));

    // ERK / division node at the bottom
    const erkState = stopped > 0.3 && returned < 0.3 ? -1 : 1;
    D.node(ctx, { cx, cy: ys.erk, r: 86, text: 'ERK', sub: 'cell division', state: erkState, color: 'var(--blue)', v: vis(ctx.t, shot.start + 0.5), anchor: shot.id + '.erk', size: 40 });
    ctx.anchor(shot.id + '.division', cx, ys.erk - 20);

    // connecting arrows light up with signal
    P.arrow(ctx, [cx, ys.cox + 86], [cx, ys.pg - 72], shot.start + 0.6, { color: blocked > 0.3 ? '#B9Bec6' : 'var(--violet)', width: 6 });
    P.arrow(ctx, [cx, ys.pg + 72], [cx, ys.erk - 86], shot.start + 0.7, { color: erkState < 0 ? 'var(--red)' : 'var(--green)', width: 6 });

    // rescue input from the side
    if (rescue > 0.05) {
      P.arrow(ctx, [cx + 280, ys.pg], [cx + 72, ys.pg], ctx.mark('add2015'), { color: 'var(--green)', width: 7 });
    }

    // status stamp on the right
    if (stopped > 0.3 && returned < 0.2) P.stamp(ctx, 'division ↓', { x: 760, y: ys.erk, t0: ctx.mark('stop') + 0.1, color: 'var(--red)', size: 58, rot: -6 });
    if (returned > 0.2) P.stamp(ctx, 'signal back', { x: 760, y: ys.erk, t0: ctx.mark('returns'), color: 'var(--green)', size: 56, rot: -4 });
    return {};
  },

  // ----------------------------------------------------------------- 2015 MICE
  mice(ctx, shot) {
    head(ctx, { title: 'Same paper,\nreal mice.', sub: 'Inject NSAIDs → dwarfism', subColor: 'var(--red)' });
    // normal mouse vs small mouse, with a height ruler
    const normalH = 300, smallH = 180;
    const grow = prog(ctx, 'miceDwarf', 0.6);
    P.sticker(ctx, 'mouse', { x: 330, y: 1080, h: normalH, t0: shot.start + 0.3, key: 'mc-norm', z: 42 });
    P.label(ctx, 'control', { x: 330, y: 1130, t0: shot.start + 0.4, size: 32, color: 'var(--ink-2)' });
    // dashed height line of the control
    ctx.svg('over', `<line x1="180" y1="${1080 - normalH}" x2="900" y2="${1080 - normalH}" stroke="var(--ink)" stroke-width="3" stroke-dasharray="4 10" opacity="${r1(vis(ctx.t, shot.start + 0.5))}"/>`);
    // small mouse appears when "dwarfism" is said
    const sv = spring(since(ctx, 'miceDwarf') * 1.2);
    if (ctx.mark('miceDwarf') != null && ctx.t >= ctx.mark('miceDwarf') - 0.3) {
      P.sticker(ctx, 'mouse-glasses', { x: 740, y: 1080, h: smallH * Math.min(1, Math.max(0, sv)), t0: ctx.mark('miceDwarf') - 0.25, key: 'mc-small', z: 42 });
      P.label(ctx, 'NSAIDs', { x: 740, y: 1130, t0: ctx.mark('miceDwarf') - 0.2, size: 32, color: 'var(--red)', weight: 700 });
      ctx.anchor(shot.id + '.small', 740, 1000);
      // gap arrow showing the height difference
      P.arrow(ctx, [740, 1080 - normalH], [740, 1080 - smallH], ctx.mark('miceDwarf') + 0.2, { color: 'var(--red)', width: 6, bend: 0.25 });
      P.stamp(ctx, 'shorter', { x: 860, y: 1080 - (normalH + smallH) / 2, t0: ctx.mark('miceDwarf') + 0.3, color: 'var(--red)', size: 48, rot: 8 });
    } else {
      ctx.anchor(shot.id + '.small', 740, 1000);
    }
    return {};
  },

  // ----------------------------------------------------------------- 2006 CELLS
  cells(ctx, shot) {
    head(ctx, { title: 'Cells in\na dish.', sub: 'Four NSAIDs · rat growth plate', subColor: 'var(--red)', year: '2006' });
    P.citeDock(ctx, ctx.TL.papers[shot.paper], shot.start + 0.2, Infinity, 300);
    // drug chips tick in as named
    const drugs = [['indomethacin', 'Indomethacin'], ['keto', 'Ketorolac'], ['diclo', 'Diclofenac'], ['piro', 'Piroxicam']];
    const marks = ['indo', 'keto', 'diclo', 'piro'];
    drugs.forEach((d, i) => {
      const m = ctx.mark(marks[i]);
      if (m == null) return;
      P.chip(ctx, d[1], { x: 150 + (i % 2) * 300, y: 430 + Math.floor(i / 2) * 78, t0: m - 0.08, align: 'left', size: 30 });
    });
    // the dish
    const cx = 540, cy = 1000;
    D.dish(ctx, { cx, cy, r: 300,
      divide: 1 - prog(ctx, 'down2006', 0.7),
      die: prog(ctx, 'dying', 1.0),
      rescueTry: prog(ctx, 'notsave', 0.8),
      v: vis(ctx.t, shot.start + 0.3) });
    ctx.anchor(shot.id + '.dish', cx, cy - 120);
    // verdict chips
    if (after(ctx, 'down2006', -0.1)) P.stamp(ctx, 'division ↓', { x: 240, y: 700, t0: ctx.mark('down2006'), color: 'var(--red)', size: 44, rot: -8 });
    if (after(ctx, 'frozen', -0.1)) P.stamp(ctx, 'cycle frozen', { x: 840, y: 700, t0: ctx.mark('frozen'), color: 'var(--blue)', size: 42, rot: 6 });
    if (after(ctx, 'dying', -0.1)) P.stamp(ctx, 'cells dying', { x: 540, y: 1360, t0: ctx.mark('dying'), color: 'var(--red)', size: 50, rot: -3 });
    // PG rescue crossed out ("did not save them")
    if (after(ctx, 'notsave', -0.1)) {
      P.chip(ctx, 'add prostaglandins', { x: 300, y: 1330, t0: ctx.mark('notsave') - 0.1, size: 30, bg: 'var(--green-soft)', color: 'var(--ink)' });
      P.scribble(ctx, 300, 1330, 180, 44, ctx.mark('notsave') + 0.3, { color: 'var(--red)', seed: 7 });
    }
    return {};
  },

  // ----------------------------------------------------------------- 2011 MATURE
  mature(ctx, shot) {
    head(ctx, { title: 'Cartilage →\nbone stalls.', sub: 'COX-2 works with BMP-2', subColor: 'var(--violet)', year: '2011' });
    P.citeDock(ctx, ctx.TL.papers[shot.paper], shot.start + 0.2, Infinity, 300);
    // COX-2 + BMP-2 -> hypertrophy; block -> stall
    const cx = 300, cyTop = 640;
    D.node(ctx, { cx: cx - 20, cy: cyTop, r: 76, text: 'COX-2', state: after(ctx, 'block2011', 0) ? -1 : 1, color: 'var(--violet)', v: vis(ctx.t, shot.start + 0.3), size: 36, anchor: shot.id + '.cell' });
    D.node(ctx, { cx: cx + 300, cy: cyTop, r: 76, text: 'BMP-2', state: 1, color: 'var(--green)', v: vis(ctx.t, shot.start + 0.4), size: 36 });
    // handshake arrows
    P.arrow(ctx, [cx + 56, cyTop + 50], [cx + 244, cyTop + 50], shot.start + 0.5, { color: 'var(--ink)', width: 6, bend: 0.3 });
    // a maturing cell growing then stalling
    const sw = after(ctx, 'stalls', 0) ? 0.2 : prog(ctx, 'mature', 1.0, 0);
    const cellY = 1000;
    ctx.svg('under', `<g opacity="${r1(vis(ctx.t, shot.start + 0.5))}">
      ${D.cell({ x: 440, y: cellY, r: 70, swell: easeOut(sw), mineral: after(ctx, 'stalls', 0) ? 0 : prog(ctx, 'mature', 1.2, 0.3) })}</g>`);
    P.arrow(ctx, [cx + 140, cyTop + 76], [440, cellY - 90], shot.start + 0.7, { color: 'var(--green)', width: 6, bend: 0.1, dash: '2 10' });
    P.label(ctx, 'mature into bone', { x: 540, y: 1150, t0: shot.start + 0.6, size: 34, color: 'var(--ink-2)' });
    if (after(ctx, 'stalls', -0.1)) {
      P.stamp(ctx, 'stalls', { x: 700, y: 1000, t0: ctx.mark('stalls'), color: 'var(--red)', size: 64, rot: -8 });
      ctx.svg('over', `<g opacity="${r1(vis(ctx.t, ctx.mark('stalls')))}"><path d="M 610 940 L 690 1060 M 690 940 L 610 1060" stroke="var(--red)" stroke-width="8" stroke-linecap="round"/></g>`);
    }
    return {};
  },

  // ----------------------------------------------------------------- 2017 RABBIT
  rabbit(ctx, shot) {
    head(ctx, { title: '25 days.\nRabbits.', sub: 'Celecoxib · femur', subColor: 'var(--red)', year: '2017' });
    P.citeDock(ctx, ctx.TL.papers[shot.paper], shot.start + 0.2, Infinity, 300);
    P.sticker(ctx, 'rabbit', { x: 230, y: 760, h: 300, t0: shot.start + 0.3, key: 'rb', z: 42 });
    // 25-day calendar ticking
    const filled = Math.round(prog(ctx, 'cele25', 1.4) * 25);
    let cal = '';
    for (let i = 0; i < 25; i++) {
      const on = i < filled;
      const x = 470 + (i % 5) * 64, y = 470 + Math.floor(i / 5) * 64;
      cal += `<rect x="${x}" y="${y}" width="48" height="48" rx="8" fill="${on ? 'var(--red)' : '#fff'}" stroke="var(--ink)" stroke-width="4"/>`;
    }
    ctx.svg('under', `<g opacity="${r1(vis(ctx.t, shot.start + 0.4))}">${cal}</g>`);
    P.label(ctx, '25 daily doses', { x: 630, y: 830, t0: shot.start + 0.5, size: 30, color: 'var(--ink-2)' });
    // the real figure: mineralisation front
    const fig = P.figure(ctx, 'janssen-front', { x: 90, y: 980, w: 900, t0: ctx.mark('front') - 0.4 });
    if (fig.on) {
      ctx.anchor(shot.id + '.front', ...fig.map(640, 110));
      P.stamp(ctx, 'front fell behind', { x: 540, y: 1360, t0: ctx.mark('behind') ?? ctx.mark('front') + 0.4, color: 'var(--red)', size: 46, rot: -3 });
    } else {
      ctx.anchor(shot.id + '.front', 540, 1100);
    }
    return {};
  },

  // ----------------------------------------------------------------- 2021 NAPROXEN
  naproxen(ctx, shot) {
    head(ctx, { title: '10 weeks.\nShorter bones.', sub: 'Naproxen · growing mice', subColor: 'var(--red)', year: '2021' });
    P.citeDock(ctx, ctx.TL.papers[shot.paper], shot.start + 0.2, Infinity, 300);
    // the real length figure (tibia + femur)
    const fig = P.figure(ctx, 'caron-length', { x: 70, y: 430, w: 940, t0: shot.start + 0.3 });
    // point targets on the two length panels
    ctx.anchor(shot.id + '.tibia', ...fig.map(760, 150));
    ctx.anchor(shot.id + '.femur', ...fig.map(1320, 150));
    if (after(ctx, 'shin', -0.1)) P.stamp(ctx, 'shin ↓', { x: fig.map(760, 150)[0], y: fig.map(760, 10)[1] - 10, t0: ctx.mark('shin'), color: 'var(--red)', size: 40, rot: -6 });
    if (after(ctx, 'thigh', -0.1)) P.stamp(ctx, 'thigh ↓', { x: fig.map(1320, 150)[0], y: fig.map(1320, 10)[1] - 10, t0: ctx.mark('thigh'), color: 'var(--red)', size: 40, rot: 5 });

    // zone changes: a small schematic column
    const colY = 440 + fig.h + 30;
    const col = D.plateColumn(ctx, { x: 120, y: colY, w: 200, h: 560,
      divide: 1, swell: 1, ossify: 0.3, stall: after(ctx, 'thinner', 0) ? 0.6 : 0, labels: false,
      v: vis(ctx.t, shot.start + 0.4) });
    // thicker proliferative / thinner hypertrophic callouts
    ctx.anchor(shot.id + '.prolif', 320, colY + 560 * 0.34);
    ctx.anchor(shot.id + '.hyper', 320, colY + 560 * 0.64);
    if (after(ctx, 'thicker', -0.1)) {
      P.chip(ctx, 'dividing zone ↑', { x: 560, y: colY + 150, t0: ctx.mark('thicker') - 0.1, align: 'left', size: 32, bg: 'var(--violet-soft)', color: 'var(--ink)' });
      P.arrow(ctx, [540, colY + 150], [330, colY + 560 * 0.34], ctx.mark('thicker'), { color: 'var(--violet)', width: 6 });
    }
    if (after(ctx, 'thinner', -0.1)) {
      P.chip(ctx, 'maturing zone ↓', { x: 560, y: colY + 360, t0: ctx.mark('thinner') - 0.1, align: 'left', size: 32, bg: 'var(--red-soft)', color: 'var(--ink)' });
      P.arrow(ctx, [540, colY + 360], [330, colY + 560 * 0.64], ctx.mark('thinner'), { color: 'var(--red)', width: 6 });
    }
    return {};
  },

  // ----------------------------------------------------------------- SUMMARY
  summary(ctx, shot) {
    head(ctx, { title: 'Every step,\nhit.', sub: 'What NSAIDs touched', subColor: 'var(--ink)' });
    const steps = [
      ['divide', 'cell division ↓', 'var(--red)'],
      ['signal', 'PGE2 / PGI2 ↓', 'var(--red)'],
      ['erk', 'IGF-1 → ERK ↓', 'var(--red)'],
      ['death', 'more cell death', 'var(--red)'],
      ['mature', 'maturing → bone ↓', 'var(--red)'],
    ];
    steps.forEach((s, i) => {
      const t0 = shot.start + 0.3 + i * 0.26;
      const y = 520 + i * 150;
      P.card(ctx, { x: 150, y: y - 56, w: 780, h: 112, t0, radius: 26 });
      P.label(ctx, s[1], { x: 210, y, t0: t0 + 0.05, align: 'left', size: 48, weight: 700, color: 'var(--ink)' });
      // red cross mark
      const k = spring((ctx.t - t0 - 0.1) * 1.3);
      if (k > 0) ctx.svg('over', `<g transform="translate(840 ${y}) scale(${r1(Math.min(1, k))})"><circle r="34" fill="var(--red-soft)"/><path d="M-14 -14 L14 14 M14 -14 L-14 14" stroke="var(--red)" stroke-width="7" stroke-linecap="round"/></g>`);
    });
    return {};
  },

  // ----------------------------------------------------------------- TAKE
  take(ctx, shot) {
    head(ctx, { title: 'But be\nreal.', sub: 'My honest take', subColor: 'var(--green)' });
    const points = [
      ['🐭', 'Animal & cell studies', shot.start + 0.3],
      ['💉', 'Mostly long, daily dosing', shot.start + 1.0],
      ['✅', "Short normal course?\nProbably fine", ctx.mark('probably') ? ctx.mark('probably') - 0.4 : shot.start + 2.2],
    ];
    points.forEach((p, i) => {
      const y = 560 + i * 230;
      P.card(ctx, { x: 120, y: y - 80, w: 840, h: 190, t0: p[2], radius: 30, bg: i === 2 ? 'var(--green-soft)' : 'var(--card)' });
      ctx.html('over', `<div style="position:absolute;left:170px;top:${y}px;font-size:76px;transform:translateY(-50%);opacity:${r1(vis(ctx.t, p[2] + 0.1))}">${p[0]}</div>`);
      p[1].split('\n').forEach((l, j) => {
        P.label(ctx, l, { x: 300, y: y - (p[1].includes('\n') ? 26 : 0) + j * 52, t0: p[2] + 0.15, align: 'left', size: 44, weight: 700 });
      });
    });
    return {};
  },

  // ----------------------------------------------------------------- TWIST
  twist(ctx, shot) {
    head(ctx, { title: 'Plot twist.', sub: 'Flurbiprofen · young rats', subColor: 'var(--green)', year: '1989' });
    P.citeDock(ctx, ctx.TL.papers[shot.paper], shot.start + 0.2, Infinity, 300);
    // same NSAID class, opposite result: growth UP
    P.pill(ctx, 'flurbiprofen', { cx: 250, cy: 760, size: 200 * Math.min(1, spring((ctx.local - 0.2) * 1.3)), rot: -8, key: 'tw-pill' });
    P.label(ctx, 'Flurbiprofen', { x: 250, y: 900, t0: shot.start + 0.3, size: 40, weight: 700 });
    P.chip(ctx, 'also an NSAID', { x: 250, y: 965, t0: shot.start + 0.5, size: 28, cls: 'ink' });
    // big up-arrow for bone growth
    const up = prog(ctx, 'boosted', 0.7);
    const barH = lerp(60, 420, easeOut(up));
    ctx.svg('under', `<g opacity="${r1(vis(ctx.t, ctx.mark('boosted') ? ctx.mark('boosted') - 0.3 : shot.start + 1))}">
      <rect x="640" y="${r1(1120 - barH)}" width="150" height="${r1(barH)}" rx="16" fill="var(--green)" stroke="var(--ink)" stroke-width="6"/>
    </g>`);
    ctx.anchor(shot.id + '.arrow', 715, 1120 - barH - 60);
    if (up > 0.2) P.arrow(ctx, [715, 1100], [715, 1120 - barH - 40], ctx.mark('boosted'), { color: 'var(--green)', width: 10, bend: 0 });
    P.label(ctx, 'bone growth ↑', { x: 715, y: 1180, t0: ctx.mark('boosted') ?? shot.start + 1, size: 36, color: 'var(--green)', weight: 700 });
    if (up > 0.4) P.emoji(ctx, '🐓', { x: 915, y: 620, size: 120, t0: ctx.mark('boosted') + 0.1, rot: 8 });
    return {};
  },

  default(ctx) { return {}; },
};
