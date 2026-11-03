// One function per shot kind. Each is a pure function of ctx (time, assets,
// anchors) and draws that moment. Internal animation syncs to anchored word
// times via ctx.mark(...) so visuals land on the exact spoken word.
//
// Vertical grid (1080×1920):
//   112–300   headline        334–540  PubMed citation dock (study shots)
//   580–1400  content         1640+    captions      bottom: presenter
import { W, r1, lerp, clamp, easeOut, easeInOut, spring, vis } from './lib.js';
import * as P from './parts.js';
import * as D from './diagrams.js';

const TITLE_Y = 112;
const DOCK_Y = 334;

function head(ctx, o) {
  const { title, sub, t0 = ctx.shot.start, color = 'var(--ink)', subColor = 'var(--red)', year } = o;
  const lines = title.split('\n');
  lines.forEach((l, i) => {
    const lv = vis(ctx.t, t0 - 0.03 + i * 0.05, Infinity, 0.16);
    if (lv <= 0) return;
    ctx.html('over', `<div class="disp" style="position:absolute;left:64px;top:${TITLE_Y + i * 92}px;font-size:86px;line-height:1.02;white-space:nowrap;color:${color};opacity:${r1(lv)};transform:translateY(${r1((1 - lv) * 10)}px)">${l}</div>`);
  });
  if (year) P.chip(ctx, year, { x: W - 64, y: TITLE_Y + 46, t0: t0 + 0.1, align: 'right', cls: 'ink', size: 34 });
  if (sub) {
    const v = vis(ctx.t, t0 + 0.15, Infinity, 0.3);
    ctx.html('over', `<div class="label up" style="left:66px;top:${TITLE_Y + lines.length * 92 + 14}px;opacity:${r1(v)};color:${subColor}">${sub}</div>`);
  }
}

const has = (ctx, m) => ctx.mark(m) != null;
const after = (ctx, m, d = 0) => has(ctx, m) && ctx.t >= ctx.mark(m) + d;
const prog = (ctx, m, dur, delay = 0) => (has(ctx, m) ? clamp((ctx.t - ctx.mark(m) - delay) / dur, 0, 1) : 0);
const at = (ctx, m, d = 0, fallback = Infinity) => (has(ctx, m) ? ctx.mark(m) + d : fallback);

export const scenes = {
  // ================================================================= HOOK
  hook(ctx, shot) {
    const lt = ctx.local;
    const hv = vis(ctx.t, 0.0, Infinity, 0.35);
    // the episode title is the hook
    ctx.html('over', `<div class="disp" style="position:absolute;left:62px;top:${r1(116 + (1 - hv) * 20)}px;width:960px;font-size:100px;line-height:0.98;opacity:${r1(hv)}">How <span style="color:var(--red)">ibuprofen</span><br>makes you<br>a <span style="background:var(--yellow);padding:0 12px;border-radius:14px">dwarf</span> <span class="emoji" style="font-size:88px">💀</span></div>`);

    // a handful of pills tumbles in
    const pills = [['aspirin', 190, 640, 160, -18], ['naproxen', 470, 620, 160, 14], ['ibuprofen', 330, 750, 270, -8]];
    pills.forEach(([id, x, y, s, rot], i) => {
      const k = spring((lt - (0.18 + i * 0.1)) * 1.3);
      if (k <= 0) return;
      P.pill(ctx, id, { cx: x, cy: lerp(y - 160, y, Math.min(1, k)), size: s * Math.min(1, k), rot: lerp(rot - 70, rot, Math.min(1, k)), key: 'hk-' + id, o: Math.min(1, k * 1.4) });
    });
    ctx.anchor(shot.id + '.pill', 330, 700);

    // arrow → the mouse, who then shrinks on "dwarfs"
    P.arrow(ctx, [520, 770], [690, 820], at(ctx, 'mice', -0.25, 1.4), { color: 'var(--ink)', width: 9, bend: -0.25 });
    const shrink = easeInOut(prog(ctx, 'dwarfs', 0.45));
    const mh = lerp(340, 165, shrink);
    const ground = 1060;
    P.sticker(ctx, 'mouse', { x: 845, y: ground, h: mh, t0: 1.0, key: 'hk-mouse', z: 26 });
    ctx.anchor(shot.id + '.mouse', 845, ground - mh * 0.62);
    // height ruler shows how much was lost
    D.ruler(ctx, { x: 1012, y0: ground - 360, y1: ground, v: vis(ctx.t, 1.1) });
    if (shrink > 0) ctx.svg('over', `<line x1="770" y1="${ground - 340}" x2="1000" y2="${ground - 340}" stroke="var(--red)" stroke-width="5" stroke-dasharray="6 9" opacity="${r1(shrink)}"/>`);
    P.emoji(ctx, '💀', { x: 845, y: 560, size: 150, t0: at(ctx, 'dwarfs', 0.1), rot: -8 });
    P.stamp(ctx, 'dwarfism', { x: 330, y: 935, t0: at(ctx, 'dwarfs', 0.08), rot: -7, size: 104 });
    return { camera: { scale: lerp(1.07, 1, easeOut(clamp(lt / 1.3, 0, 1))), ox: 540, oy: 760 } };
  },

  // ================================================================= PROOF
  paper(ctx, shot) {
    const paper = ctx.TL.papers[shot.paper];
    head(ctx, { title: "It's in\nthe paper.", sub: 'Receipts · PubMed', subColor: 'var(--green)' });
    P.citeCard(ctx, paper, {
      x: 76, y: 470, w: 928, t0: shot.start + 0.08, size: 50, lines: 3,
      quote: paper.quote, highlight: paper.highlight, hlAt: ctx.mark('actual'),
      anchor: shot.id + '.highlight', tilt: -1.4,
    });
    ctx.anchor(shot.id + '.highlight', 700, 1010); // replaced by the measured word position
    return {};
  },

  // ================================================================= COX
  cox(ctx, shot) {
    head(ctx, { title: 'They all\nblock COX.', sub: 'One enzyme, many jobs', subColor: 'var(--violet)' });
    const names = [['ibuprofen', 'Ibuprofen', 'ibuprofen'], ['aspirin', 'Aspirin', 'aspirin'], ['naproxen', 'Naproxen', 'naproxen1']];
    names.forEach(([id, lab, m], i) => {
      const t0 = Math.min(at(ctx, m, -0.12, shot.start + i * 0.3), shot.start + 0.1 + i * 0.6);
      const k = spring((ctx.t - t0) * 1.4);
      if (k <= 0) return;
      const cy = 560 + i * 150;
      P.pill(ctx, id, { cx: 150, cy, size: 124 * Math.min(1, k), rot: [-8, 4, -5][i], key: 'cx-' + id, o: Math.min(1, k * 1.3) });
      P.label(ctx, lab, { x: 238, y: cy, t0, align: 'left', size: 42, weight: 800, font: 'Bricolage' });
    });
    const ex = 820, ey = 720;
    D.enzyme(ctx, { cx: ex, cy: ey, r: 138, label: 'COX', color: 'var(--violet)', wob: 1,
      blocked: prog(ctx, 'enzyme', 0.45, 0.25), v: vis(ctx.t, at(ctx, 'blockCox', -0.2, shot.start + 1)) });
    ctx.anchor(shot.id + '.enzyme', ex, ey - 30);
    [560, 710, 860].forEach((cy, i) => P.arrow(ctx, [520, cy], [ex - 145, ey + (i - 1) * 50], at(ctx, 'blockCox', i * 0.07, shot.start + 1), { color: 'var(--red)', width: 7, bend: 0.1 }));

    if (after(ctx, 'prostaglandins', -0.3)) {
      const pv = vis(ctx.t, ctx.mark('prostaglandins') - 0.25);
      P.arrow(ctx, [ex, ey + 140], [ex, 960], ctx.mark('prostaglandins') - 0.25, { color: 'var(--green)', width: 7, bend: 0 });
      ctx.svg('under', `<g opacity="${r1(pv)}">${D.pg(ex - 60, 1010, 1.6, 'var(--green)')}${D.pg(ex + 60, 1030, 1.3, 'var(--green)')}</g>`);
      P.label(ctx, 'prostaglandins', { x: ex, y: 1110, t0: ctx.mark('prostaglandins') - 0.1, size: 40, color: 'var(--green)', weight: 800, font: 'Bricolage' });
    }
    return {};
  },

  // ================================================================= GROWTH PLATE
  plate(ctx, shot) {
    head(ctx, { title: 'Where bones\nget longer.', sub: 'The growth plate', subColor: 'var(--blue)' });
    const b = D.bone(ctx, { cx: 250, top: 440, h: 800, w: 220, t0: shot.start + 0.15, glow: prog(ctx, 'plate', 0.5, -0.1), anchor: shot.id + '.band' });
    if (b) ctx.anchor(shot.id + '.band', b.plate[0] + 40, b.plate[1]);
    P.label(ctx, 'growth plate', { x: 250, y: 1290, t0: at(ctx, 'plate', -0.1), size: 38, color: 'var(--blue)', weight: 800, font: 'Bricolage' });
    D.plateColumn(ctx, {
      x: 610, y: 450, w: 250, h: 780,
      divide: prog(ctx, 'divide', 1.0), swell: prog(ctx, 'swell', 1.0), ossify: prog(ctx, 'replaced', 1.1),
      v: vis(ctx.t, at(ctx, 'plate', 0.1, shot.start + 1)),
    });
    P.arrow(ctx, [395, 560], [600, 480], at(ctx, 'plate', 0.05, shot.start + 1), { color: 'var(--ink)', width: 6, bend: -0.15, dash: '2 12' });
    // the column grows downward = bone gets longer
    P.chip(ctx, '↑ longer bone', { x: 735, y: 1300, t0: at(ctx, 'replaced', 0.3), size: 32, bg: 'var(--green-soft)' });
    return {};
  },

  // ================================================================= 2015 PATHWAY
  pathway(ctx, shot) {
    head(ctx, { title: 'The growth\nsignal.', year: '2015' });
    P.citeDock(ctx, ctx.TL.papers[shot.paper], shot.start + 0.03, Infinity, DOCK_Y);
    const cx = 330, Y = { cox: 720, pg: 940, erk: 1160 };
    const blocked = prog(ctx, 'block2015', 0.45), stopped = prog(ctx, 'stop', 0.4);
    const rescue = prog(ctx, 'add2015', 0.6), back = prog(ctx, 'returns', 0.4);
    const off = blocked > 0.3 && back < 0.3;
    const v0 = vis(ctx.t, shot.start + 0.3);

    ctx.svg('under', `<line x1="${cx}" y1="${Y.cox}" x2="${cx}" y2="${Y.erk}" stroke="#CDD1D8" stroke-width="8" opacity="${r1(v0)}"/>`);
    D.node(ctx, { cx, cy: Y.cox, r: 88, text: 'COX-2', state: blocked > 0.3 ? -1 : 1, color: 'var(--violet)', v: v0, size: 40 });
    ctx.anchor(shot.id + '.cox', cx + 20, Y.cox - 20);
    // COX-2 level meter: high, then higher with IGF-1
    const lvl = Math.max(prog(ctx, 'packed', 0.5) * 0.65, prog(ctx, 'igf', 0.5) * 1);
    if (lvl > 0) {
      const mh = 150 * lvl;
      ctx.svg('under', `<g opacity="${r1(v0)}"><rect x="${cx + 108}" y="${Y.cox - 75}" width="34" height="150" rx="10" fill="#fff" stroke="var(--ink)" stroke-width="4"/>
        <rect x="${cx + 112}" y="${r1(Y.cox + 71 - mh)}" width="26" height="${r1(mh - 4)}" rx="7" fill="var(--violet)"/></g>`);
    }
    P.chip(ctx, 'IGF-1', { x: 70, y: Y.cox - 130, t0: at(ctx, 'igf', -0.1), align: 'left', size: 32, bg: 'var(--green-soft)' });
    P.arrow(ctx, [150, Y.cox - 100], [cx - 92, Y.cox - 20], at(ctx, 'igf', 0), { color: 'var(--green)', width: 7, bend: 0.2 });
    if (blocked > 0) P.pill(ctx, 'ibuprofen', { cx: lerp(cx + 330, cx + 76, easeOut(blocked)), cy: Y.cox + 60, size: 104, rot: -14, key: 'pw-pill' });

    D.node(ctx, { cx, cy: Y.pg, r: 74, text: 'PG', sub: 'PGE2 · PGI2', state: off && rescue < 0.3 ? 0 : 1, color: 'var(--green)', v: v0 });
    D.node(ctx, { cx, cy: Y.erk, r: 88, text: 'ERK', state: stopped > 0.3 && back < 0.3 ? -1 : 1, color: 'var(--blue)', v: v0, size: 44 });
    ctx.anchor(shot.id + '.erk', cx + 20, Y.erk - 20);
    if (rescue > 0) {
      P.arrow(ctx, [cx + 300, Y.pg - 60], [cx + 80, Y.pg], ctx.mark('add2015'), { color: 'var(--green)', width: 8, bend: 0.15 });
      P.chip(ctx, '+ PGE2 / PGI2', { x: cx + 300, y: Y.pg - 100, t0: ctx.mark('add2015') - 0.05, size: 30, bg: 'var(--green-soft)' });
    }

    // the cell on the right: dividing while the signal flows
    const divOn = !(stopped > 0.3 && back < 0.5);
    const cyc = (ctx.t * 0.9) % 1;
    const split = divOn ? Math.sin(cyc * Math.PI) : lerp(0.15, 0, stopped);
    ctx.svg('under', `<g opacity="${r1(v0)}">${D.cell({ x: 790, y: 960, r: 92, split: clamp(split, 0, 1), dim: divOn ? 0 : 0.8 })}</g>`);
    P.label(ctx, 'cell division', { x: 790, y: 1150, t0: shot.start + 0.4, size: 34, color: 'var(--ink-2)', weight: 700 });
    ctx.anchor(shot.id + '.division', 790, 900);
    P.stamp(ctx, 'slowed', { x: 790, y: 960, t0: at(ctx, 'stop', 0.05), t1: at(ctx, 'returns', -0.1), size: 56, rot: -8 });
    P.stamp(ctx, 'back on', { x: 790, y: 960, t0: at(ctx, 'returns', 0), size: 54, rot: -5, color: 'var(--green)' });
    return {};
  },


  // ================================================================= 2015 MICE
  mice(ctx, shot) {
    head(ctx, { title: 'Same paper:\nreal mice.', sub: 'Injected NSAIDs → dwarfism' });
    const ground = 1190;
    const v0 = vis(ctx.t, shot.start + 0.2);
    ctx.svg('under', `<line x1="90" y1="${ground}" x2="990" y2="${ground}" stroke="var(--ink)" stroke-width="6" stroke-linecap="round" opacity="${r1(v0)}"/>`);
    // control mouse
    P.sticker(ctx, 'mouse', { x: 310, y: ground, h: 360, t0: shot.start + 0.2, key: 'mc-ctrl', z: 26 });
    P.label(ctx, 'control', { x: 310, y: ground + 46, t0: shot.start + 0.3, size: 34, color: 'var(--ink-2)' });
    // treated mouse: same size at first, shrinks on "dwarfism"
    const shrink = easeInOut(prog(ctx, 'miceDwarf', 0.45, -0.05));
    const th = lerp(360, 200, shrink);
    P.sticker(ctx, 'mouse', { x: 770, y: ground, h: th, t0: at(ctx, 'inject', -0.1, shot.start + 0.5), key: 'mc-nsaid', z: 26, flip: true });
    P.label(ctx, 'NSAID injections', { x: 770, y: ground + 46, t0: at(ctx, 'inject', 0, shot.start + 0.6), size: 34, color: 'var(--red)', weight: 800 });
    ctx.anchor(shot.id + '.small', 770, ground - th * 0.6);
    // control height reference + the gap
    if (v0 > 0) ctx.svg('over', `<line x1="170" y1="${ground - 360}" x2="980" y2="${ground - 360}" stroke="var(--ink)" stroke-width="4" stroke-dasharray="5 10" opacity="${r1(v0 * 0.7)}"/>`);
    if (shrink > 0.2) P.arrow(ctx, [930, ground - 352], [930, ground - th - 8], ctx.mark('miceDwarf') + 0.15, { color: 'var(--red)', width: 7, bend: 0 });
    P.stamp(ctx, 'dwarfism', { x: 560, y: 640, t0: at(ctx, 'miceDwarf', 0.1), size: 96, rot: -6 });
    // reaction cameo (Wojak Land)
    P.sticker(ctx, 'crying', { x: 925, y: 600, h: 250, t0: at(ctx, 'miceDwarf', 0.35), key: 'stk-crying', rot: 6, wiggle: 2 });
    P.chip(ctx, 'schematic · see paper for data', { x: 540, y: 1330, t0: shot.start + 0.6, size: 24, color: 'var(--muted)' });
    return {};
  },

  // ================================================================= 2006 CELLS
  cells(ctx, shot) {
    head(ctx, { title: 'Cells in\na dish.', year: '2006' });
    P.citeDock(ctx, ctx.TL.papers[shot.paper], shot.start + 0.03, Infinity, DOCK_Y);
    // the four NSAIDs, each lands as it is named
    const drugs = [['indomethacin', 'Indomethacin', 'indo', 120, 610], ['ketorolac', 'Ketorolac', 'keto', 580, 610],
      ['diclofenac', 'Diclofenac', 'diclo', 120, 705], ['piroxicam', 'Piroxicam', 'piro', 580, 705]];
    drugs.forEach(([id, name, m, x, y]) => {
      const t0 = at(ctx, m, -0.1, shot.start + 1);
      const k = spring((ctx.t - t0) * 1.4);
      if (k <= 0) return;
      P.pill(ctx, id, { cx: x + 40, cy: y, size: 86 * Math.min(1, k), rot: -10, key: 'c6-' + id, o: Math.min(1, k * 1.3) });
      P.label(ctx, name, { x: x + 100, y, t0, align: 'left', size: 38, weight: 800, font: 'Bricolage' });
    });
    // culture dish: dividing, then frozen, then dying; PGs don't rescue
    const cx = 540, cy = 1045;
    D.dish(ctx, { cx, cy, r: 240, n: 24,
      divide: 1 - prog(ctx, 'down2006', 0.6), die: prog(ctx, 'dying', 0.9), rescueTry: prog(ctx, 'notsave', 0.9, -0.6),
      v: vis(ctx.t, at(ctx, 'rat2006', -0.1, shot.start + 0.8)) });
    ctx.anchor(shot.id + '.dish', cx + 60, cy - 90);
    const clear = at(ctx, 'notsave', -1.0);
    P.stamp(ctx, 'division ↓', { x: 210, y: 860, t0: at(ctx, 'down2006', 0), t1: clear, size: 44, rot: -8 });
    P.stamp(ctx, 'cycle frozen', { x: 870, y: 860, t0: at(ctx, 'frozen', 0), t1: clear, size: 40, rot: 7, color: 'var(--blue)' });
    P.stamp(ctx, 'cells dying', { x: 810, y: 1320, t0: at(ctx, 'dying', 0), t1: clear, size: 46, rot: -3 });
    // "adding prostaglandins back did not save them"
    P.chip(ctx, '+ prostaglandins', { x: 540, y: 790, t0: at(ctx, 'notsave', -0.9), size: 32, bg: 'var(--green-soft)' });
    P.scribble(ctx, 540, 790, 190, 46, at(ctx, 'notsave', 0.1), { color: 'var(--red)', seed: 7, width: 9 });
    // "Nobody fully knows why."
    P.sticker(ctx, 'thinking', { x: 905, y: 1010, h: 250, t0: at(ctx, 'nobody', -0.05), key: 'stk-thinking', rot: -4 });
    P.chip(ctx, 'not just COX · ¯\\_(ツ)_/¯', { x: 540, y: 1330, t0: at(ctx, 'nobody', 0.1), size: 32, cls: 'ink', rot: -2 });
    return {};
  },

  // ================================================================= 2011 MATURE
  mature(ctx, shot) {
    head(ctx, { title: 'Growing up\nstalls.', year: '2011' });
    P.citeDock(ctx, ctx.TL.papers[shot.paper], shot.start + 0.03, Infinity, DOCK_Y);
    const v0 = vis(ctx.t, shot.start + 0.3);
    const blocked = after(ctx, 'block2011', 0);
    D.node(ctx, { cx: 290, cy: 720, r: 84, text: 'COX-2', state: blocked ? -1 : 1, color: 'var(--violet)', v: v0, size: 38 });
    D.node(ctx, { cx: 790, cy: 720, r: 84, text: 'BMP-2', state: 1, color: 'var(--green)', v: v0, size: 38 });
    P.arrow(ctx, [385, 690], [695, 690], at(ctx, 'coxworks', 0, shot.start + 0.6), { color: 'var(--ink)', width: 7, bend: -0.25 });
    P.arrow(ctx, [695, 760], [385, 760], at(ctx, 'bmp', 0, shot.start + 0.8), { color: 'var(--ink)', width: 7, bend: -0.25 });
    // maturation strip: small cell → swollen cell → bone
    const y = 1060;
    const grow = blocked ? Math.min(prog(ctx, 'mature', 1.0), 0.45) : prog(ctx, 'mature', 1.0);
    ctx.svg('under', `<g opacity="${r1(v0)}">${D.cell({ x: 210, y, r: 52 })}${D.cell({ x: 540, y, r: 62, swell: easeOut(grow) })}
      <rect x="790" y="${y - 70}" width="150" height="140" rx="24" fill="var(--bone)" stroke="var(--ink)" stroke-width="5" opacity="${r1(blocked ? 0.35 : 1)}"/>
      <path d="M815 ${y - 20} Q865 ${y - 50} 915 ${y - 18} M815 ${y + 26} Q865 ${y} 915 ${y + 30}" stroke="var(--bone-deep)" stroke-width="9" fill="none" stroke-linecap="round" opacity="${r1(blocked ? 0.35 : 1)}"/></g>`);
    P.arrow(ctx, [280, y], [460, y], shot.start + 0.7, { color: 'var(--ink)', width: 6, bend: 0 });
    P.arrow(ctx, [640, y], [775, y], shot.start + 0.8, { color: blocked ? 'var(--red)' : 'var(--ink)', width: 6, bend: 0 });
    P.label(ctx, 'cartilage', { x: 210, y: y + 110, t0: shot.start + 0.6, size: 30, color: 'var(--ink-2)' });
    P.label(ctx, 'mature', { x: 540, y: y + 110, t0: shot.start + 0.7, size: 30, color: 'var(--ink-2)' });
    P.label(ctx, 'bone', { x: 865, y: y + 110, t0: shot.start + 0.8, size: 30, color: 'var(--ink-2)' });
    ctx.anchor(shot.id + '.cell', 560, y - 40);
    if (blocked) ctx.svg('over', `<path d="M682 ${y - 34} L732 ${y + 34} M732 ${y - 34} L682 ${y + 34}" stroke="var(--red)" stroke-width="10" stroke-linecap="round" opacity="${r1(vis(ctx.t, ctx.mark('block2011')))}"/>`);
    P.stamp(ctx, 'stalls', { x: 540, y: 1270, t0: at(ctx, 'stalls', 0), size: 70, rot: -6 });
    return {};
  },

  // ================================================================= 2017 RABBITS
  rabbit(ctx, shot) {
    head(ctx, { title: '25 days.\nRabbits.', year: '2017' });
    P.citeDock(ctx, ctx.TL.papers[shot.paper], shot.start + 0.03, Infinity, DOCK_Y);
    P.sticker(ctx, 'rabbit', { x: 200, y: 930, h: 330, t0: at(ctx, 'rabbits', -0.1, shot.start + 0.5), key: 'rb', z: 26 });
    P.pill(ctx, 'celecoxib', { cx: 455, cy: 660, size: 230 * Math.min(1, spring((ctx.t - at(ctx, 'cele25', -0.3, shot.start + 1)) * 1.4)), rot: -12, key: 'rb-cele' });
    // 25 daily doses fill in
    const filled = Math.round(prog(ctx, 'cele25', 1.3, -0.4) * 25);
    let cal = '';
    for (let i = 0; i < 25; i++) {
      const x = 640 + (i % 5) * 72, yy = 590 + Math.floor(i / 5) * 72;
      cal += `<rect x="${x}" y="${yy}" width="56" height="56" rx="10" fill="${i < filled ? 'var(--red)' : '#fff'}" stroke="var(--ink)" stroke-width="4"/>`;
    }
    ctx.svg('under', `<g opacity="${r1(vis(ctx.t, at(ctx, 'cele25', -0.5, shot.start + 1)))}">${cal}</g>`);
    // the real figure: mineralisation front, control vs celecoxib
    const fig = P.figure(ctx, 'janssen-front', { x: 70, y: 980, w: 940, t0: at(ctx, 'front', -0.45, shot.start + 3) });
    ctx.anchor(shot.id + '.front', ...(fig.on ? fig.map(600, 150) : [700, 1150]));
    if (fig.on) {
      P.scribble(ctx, ...fig.map(655, 140), 210, 70, at(ctx, 'behind', 0, at(ctx, 'front', 0.6)), { seed: 5 });
      P.chip(ctx, 'mineralisation front: 2436 → 1830 µm', { x: 540, y: 955, t0: at(ctx, 'behind', 0.1, at(ctx, 'front', 0.7)), size: 28, cls: 'ink' });
    }
    return {};
  },

  // ================================================================= 2021 NAPROXEN
  naproxen(ctx, shot) {
    head(ctx, { title: '10 weeks.\nShorter bones.', year: '2021' });
    P.citeDock(ctx, ctx.TL.papers[shot.paper], shot.start + 0.03, Infinity, DOCK_Y);
    // ten weekly ticks
    const weeks = Math.round(prog(ctx, 'naproxen10', 0.9, -0.3) * 10);
    P.ticks(ctx, { x: 160, y: 588, n: 10, filled: weeks, size: 52, gap: 26, color: 'var(--red)', t0: shot.start + 0.4 });
    P.pill(ctx, 'naproxen', { cx: 92, cy: 614, size: 96, rot: -10, key: 'nx-pill', o: vis(ctx.t, shot.start + 0.4) });
    // real data: tibia + femur length, then growth-plate zone thickness
    const swap = at(ctx, 'thicker', -0.5);
    const lenFig = P.figure(ctx, 'caron-length', { x: 50, y: 690, w: 980, t0: Math.min(at(ctx, 'naproxen10', 0.05, shot.start + 0.5), at(ctx, 'shin', -0.6, shot.start + 1.5)), t1: swap });
    const zoneFig = P.figure(ctx, 'caron-zones', { x: 50, y: 690, w: 980, t0: swap });
    if (lenFig.on) {
      ctx.anchor(shot.id + '.tibia', ...lenFig.map(311, 232));
      ctx.anchor(shot.id + '.femur', ...lenFig.map(904, 232));
      P.scribble(ctx, ...lenFig.map(270, 200), 150, 90, at(ctx, 'shin', 0.05), { seed: 2, t1: swap });
      P.scribble(ctx, ...lenFig.map(860, 200), 150, 90, at(ctx, 'thigh', 0.05), { seed: 9, t1: swap });
      P.chip(ctx, 'shin ↓', { x: lenFig.map(311, 0)[0], y: lenFig.map(0, 0)[1] - 30, t0: at(ctx, 'shin', 0.1), t1: swap, size: 30, bg: 'var(--red-soft)' });
      P.chip(ctx, 'thigh ↓', { x: lenFig.map(904, 0)[0], y: lenFig.map(0, 0)[1] - 30, t0: at(ctx, 'thigh', 0.1), t1: swap, size: 30, bg: 'var(--red-soft)' });
    } else {
      ctx.anchor(shot.id + '.tibia', 330, 900);
      ctx.anchor(shot.id + '.femur', 760, 900);
    }
    if (zoneFig.on) {
      ctx.anchor(shot.id + '.prolif', ...zoneFig.map(255, 150));
      ctx.anchor(shot.id + '.hyper', ...zoneFig.map(788, 205));
      P.chip(ctx, 'dividing zone ↑', { x: zoneFig.map(255, 0)[0], y: zoneFig.map(0, 0)[1] - 30, t0: at(ctx, 'thicker', 0), size: 30, bg: 'var(--violet-soft)' });
      P.chip(ctx, 'maturing zone ↓', { x: zoneFig.map(788, 0)[0], y: zoneFig.map(0, 0)[1] - 30, t0: at(ctx, 'thinner', 0), size: 30, bg: 'var(--red-soft)' });
    } else {
      ctx.anchor(shot.id + '.prolif', 300, 900);
      ctx.anchor(shot.id + '.hyper', 780, 900);
    }
    return {};
  },

  // ================================================================= SUMMARY
  summary(ctx, shot) {
    head(ctx, { title: 'Every step,\nhit.', sub: 'What NSAIDs touched in these studies', subColor: 'var(--ink-2)' });
    const rows = ['cells divide ↓', 'PGE2 / PGI2 ↓', 'IGF-1 → ERK ↓', 'more cells die', 'cartilage → bone ↓'];
    rows.forEach((txt, i) => {
      const t0 = shot.start + 0.25 + i * 0.22;
      const y = 560 + i * 150;
      P.card(ctx, { x: 120, y: y - 56, w: 840, h: 112, t0, radius: 26 });
      P.label(ctx, txt, { x: 180, y, t0: t0 + 0.04, align: 'left', size: 50, weight: 800, font: 'Bricolage' });
      const k = spring((ctx.t - t0 - 0.12) * 1.3);
      if (k > 0) ctx.svg('over', `<g transform="translate(880 ${y}) scale(${r1(Math.min(1, k))})"><circle r="34" fill="var(--red-soft)"/><path d="M-14 -14 L14 14 M14 -14 L-14 14" stroke="var(--red)" stroke-width="7" stroke-linecap="round"/></g>`);
    });
    return {};
  },

  // ================================================================= MY TAKE
  take(ctx, shot) {
    head(ctx, { title: 'My honest\ntake.', sub: 'Before you panic', subColor: 'var(--green)' });
    P.sticker(ctx, 'chad', { x: 900, y: 450, h: 270, t0: at(ctx, 'probably', -0.1), key: 'stk-chad-yes', rot: -3 });
    const items = [
      ['🐭', 'Animal & cell studies', at(ctx, 'studies', -0.2, shot.start + 0.4), 'var(--card)'],
      ['📅', 'Mostly long, daily dosing', at(ctx, 'studies', 0.9, shot.start + 1.4), 'var(--card)'],
      ['✅', 'Short course, normal dose:\nprobably fine', at(ctx, 'short', -0.1, shot.start + 2.4), 'var(--green-soft)'],
    ];
    items.forEach(([emo, txt, t0, bg], i) => {
      const y = 600 + i * 240;
      P.card(ctx, { x: 100, y: y - 92, w: 880, h: 184, t0, radius: 30, bg });
      ctx.html('over', `<div class="emoji" style="position:absolute;left:150px;top:${y}px;font-size:80px;transform:translateY(-50%);opacity:${r1(vis(ctx.t, t0 + 0.08))}">${emo}</div>`);
      const lines = txt.split('\n');
      lines.forEach((l, j) => P.label(ctx, l, { x: 270, y: y + (j - (lines.length - 1) / 2) * 56, t0: t0 + 0.1, align: 'left', size: 46, weight: 800, font: 'Bricolage' }));
    });
    return {};
  },

  // ================================================================= TWIST
  twist(ctx, shot) {
    head(ctx, { title: 'Plot twist.', sub: 'Same drug class, opposite result', subColor: 'var(--green)', year: '1989' });
    P.citeDock(ctx, ctx.TL.papers[shot.paper], shot.start + 0.03, Infinity, DOCK_Y);
    const k = spring((ctx.t - at(ctx, 'flurbi', -0.15, shot.start + 0.4)) * 1.3);
    if (k > 0) P.pill(ctx, 'flurbiprofen', { cx: 250, cy: 760, size: 230 * Math.min(1, k), rot: -8, key: 'tw-pill' });
    P.label(ctx, 'Flurbiprofen', { x: 250, y: 920, t0: at(ctx, 'flurbi', 0, shot.start + 0.5), size: 44, weight: 800, font: 'Bricolage' });
    P.chip(ctx, 'also an NSAID', { x: 250, y: 990, t0: at(ctx, 'flurbi', 0.4, shot.start + 0.9), size: 30, cls: 'ink' });
    P.sticker(ctx, 'rat', { x: 175, y: 1330, h: 215, t0: at(ctx, 'boosted', 0.3, shot.start + 1.5), key: 'tw-rat', z: 26 });
    // growth bar shoots up on "boosted"
    const up = easeOut(prog(ctx, 'boosted', 0.7));
    const base = 1260, barH = lerp(150, 520, up);
    const v = vis(ctx.t, at(ctx, 'flurbi', 0.2, shot.start + 0.8));
    ctx.svg('under', `<g opacity="${r1(v)}"><rect x="620" y="${base - 150}" width="140" height="150" rx="16" fill="#E7E3DA" stroke="var(--ink)" stroke-width="5"/>
      <rect x="800" y="${r1(base - barH)}" width="140" height="${r1(barH)}" rx="16" fill="var(--green)" stroke="var(--ink)" stroke-width="5"/></g>`);
    const tb = at(ctx, 'flurbi', 0.2, shot.start + 0.8);
    P.label(ctx, 'control', { x: 690, y: base + 40, t0: tb, size: 28, color: 'var(--ink-2)' });
    P.label(ctx, 'flurbiprofen', { x: 870, y: base + 40, t0: tb, size: 28, color: 'var(--green)', weight: 800 });
    ctx.anchor(shot.id + '.arrow', 870, base - barH + 40);
    P.chip(ctx, '+30–40% growth rate', { x: 870, y: base - barH - 50, t0: at(ctx, 'boosted', 0.35), size: 32, bg: 'var(--green-soft)' });
    P.sticker(ctx, 'chad-flex', { x: 430, y: 1335, h: 270, t0: at(ctx, 'boosted', 0.5), key: 'stk-chad', rot: 3 });
    return {};
  },

  default() { return {}; },
};

// shared with episode-specific scene modules
export { head, has, after, prog, at, TITLE_Y, DOCK_Y };
