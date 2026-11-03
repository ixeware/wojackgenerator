// The wojak presenter: a body sprite that slides and leans, a drawn lip-synced
// mouth, and a stretchy arm whose index finger aims at any on-screen anchor.
// Geometry comes from assets/manifest.json → presenter.rig.
import { r1, lerp, clamp, easeOut, M, chain } from './lib.js';

export function makePresenter(A, rig) {
  const PIV = rig.pivot, WR = rig.wrist, TIP = rig.fingertip, MOUTH = rig.mouth, HO = rig.handOrigin;
  const anchorX = rig.size[0] / 2, anchorY = rig.bottom;
  // sprite-space lengths
  const fingerLen = Math.hypot(TIP[0] - WR[0], TIP[1] - WR[1]);          // wrist → fingertip
  const foreRest = Math.hypot(WR[0] - PIV[0], WR[1] - PIV[1]);           // shoulder → wrist (rest)
  const handAng0 = Math.atan2(TIP[1] - WR[1], TIP[0] - WR[0]);           // hand's own pointing axis

  return function draw(ctx, o) {
    const { x, y, scale = 1, flip = false, t0 = -1, mouthState = 0, breathe = true,
      point = null, pointK = 0, lean = 0, z = 40 } = o;
    if (ctx.t < t0) return;
    const sign = flip ? -1 : 1;
    const breath = breathe ? Math.sin(ctx.t * 1.6) * 0.6 : 0;
    const leanRot = lean * 0.05 + Math.sin(ctx.t * 0.9) * 0.004;
    const base = chain(M.t(x, y + breath), M.r(leanRot), M.s(sign * scale, scale), M.t(-anchorX, -anchorY));

    // arm first so the body/sleeve overlaps the shoulder joint
    if (point && pointK > 0.01 && Number.isFinite(point.x) && Number.isFinite(point.y)) {
      drawArm(ctx, base, sign, scale, point, easeOut(clamp(pointK, 0, 1)), z);
    }
    // body + head
    ctx.imgMatrix('pres-body', rig.body, base, { w: rig.size[0], h: rig.size[1], z: z + 1 });
    // lip-synced mouth, drawn in sprite space
    drawMouth(ctx, base, mouthState, z + 2);
  };

  function drawArm(ctx, base, sign, scale, point, k, z) {
    const sh = M.apply(base, PIV);                 // shoulder in screen space
    const rest = M.apply(base, TIP);               // resting fingertip in screen space
    const aim = [lerp(rest[0], point.x, k), lerp(rest[1], point.y, k)];
    let dx = aim[0] - sh[0], dy = aim[1] - sh[1];
    let dist = Math.hypot(dx, dy);
    if (dist < 1) return;
    const ang = Math.atan2(dy, dx);
    const ux = dx / dist, uy = dy / dist;
    const fLen = fingerLen * scale;
    // meme-stretchy: the forearm can grow far enough to tap anything on screen
    const minFore = 90 * scale, maxFore = Math.max(foreRest * scale * 2.4, 1400);
    const fore = clamp(dist - fLen, minFore, maxFore);
    const wrist = [sh[0] + ux * fore, sh[1] + uy * fore];
    if (!Number.isFinite(wrist[0]) || !Number.isFinite(wrist[1])) return;

    // forearm: tapered tube, ink outline then white fill
    const w0 = rig.forearm.shoulderWidth * scale, w1 = rig.forearm.width * scale, ow = rig.forearm.outline * scale;
    const nx = -uy, ny = ux; // normal
    const quad = (hw0, hw1) => `M${r1(sh[0] + nx * hw0)} ${r1(sh[1] + ny * hw0)}
      L${r1(wrist[0] + nx * hw1)} ${r1(wrist[1] + ny * hw1)}
      L${r1(wrist[0] - nx * hw1)} ${r1(wrist[1] - ny * hw1)}
      L${r1(sh[0] - nx * hw0)} ${r1(sh[1] - ny * hw0)} Z`;
    ctx.armSvg(`<path d="${quad(w0 / 2 + ow, w1 / 2 + ow)}" fill="var(--ink)"/>
      <path d="${quad(w0 / 2, w1 / 2)}" fill="#fff"/>
      <circle cx="${r1(sh[0])}" cy="${r1(sh[1])}" r="${r1(w0 / 2 + ow)}" fill="var(--ink)"/>
      <circle cx="${r1(sh[0])}" cy="${r1(sh[1])}" r="${r1(w0 / 2)}" fill="#fff"/>`);

    // hand sprite: rotate its own axis onto `ang`, map its wrist point onto `wrist`
    const hand = { file: rig.hand, w: rig.handSize[0], h: rig.handSize[1] };
    const hm = chain(M.t(wrist[0], wrist[1]), M.r(ang - handAng0), M.s(scale, scale), M.t(-(WR[0] - HO[0]), -(WR[1] - HO[1])));
    ctx.imgMatrix('pres-hand', hand.file, hm, { w: hand.w, h: hand.h, z: z + 3 });

    // expose live fingertip for a tap pulse
    ctx.anchor('presenter.finger', wrist[0] + ux * fLen, wrist[1] + uy * fLen);
  }

  function drawMouth(ctx, base, state, z) {
    const c = MOUTH, w = rig.mouthWidth;
    const shapes = {
      0: `<path d="M${c[0] - w * 0.42} ${c[1] - 4} Q${c[0]} ${c[1] + 16} ${c[0] + w * 0.42} ${c[1] - 4}" fill="none" stroke="#141414" stroke-width="12" stroke-linecap="round"/>`,
      1: `<path d="M${c[0] - w * 0.4} ${c[1] - 8} Q${c[0]} ${c[1] + 34} ${c[0] + w * 0.4} ${c[1] - 8} Q${c[0]} ${c[1] + 8} ${c[0] - w * 0.4} ${c[1] - 8} Z" fill="#7a2f33" stroke="#141414" stroke-width="11" stroke-linejoin="round"/>`,
      2: `<path d="M${c[0] - w * 0.46} ${c[1] - 14} Q${c[0]} ${c[1] - 2} ${c[0] + w * 0.46} ${c[1] - 14} Q${c[0] + w * 0.22} ${c[1] + 60} ${c[0]} ${c[1] + 64} Q${c[0] - w * 0.22} ${c[1] + 60} ${c[0] - w * 0.46} ${c[1] - 14} Z" fill="#6f2a2e" stroke="#141414" stroke-width="12" stroke-linejoin="round"/><path d="M${c[0] - w * 0.4} ${c[1] - 10} Q${c[0]} ${c[1]} ${c[0] + w * 0.4} ${c[1] - 10}" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/>`,
      3: `<ellipse cx="${c[0]}" cy="${c[1] + 18}" rx="${w * 0.28}" ry="${w * 0.4}" fill="#6f2a2e" stroke="#141414" stroke-width="12"/>`,
    };
    ctx.svgMatrix(base, shapes[state] ?? shapes[0], z);
  }
}
