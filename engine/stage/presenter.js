// The wojak presenter: a body sprite that slides and leans, a drawn lip-synced
// mouth, and a stretchy arm whose index finger aims at any on-screen anchor.
// Geometry comes from assets/manifest.json → presenter.rig.
import { r1, lerp, clamp, easeOut, M, chain } from './lib.js';

export function makePresenter(A, rig) {
  const PIV = rig.pivot, WR = rig.wrist, TIP = rig.fingertip, MOUTH = rig.mouth, HO = rig.handOrigin;
  const anchorX = rig.size[0] / 2, anchorY = rig.bottom;
  // sprite-space lengths
  const foreRest = Math.hypot(WR[0] - PIV[0], WR[1] - PIV[1]);           // shoulder → wrist (rest)

  // The hand sprite ends in a short forearm stub. The drawn tube must continue
  // that stub exactly: same centre line, same width, same direction — otherwise
  // its outline steps at the cut. WC/AX are measured on the sprite.
  const WC = rig.wristCenter ?? WR;
  const AX = (() => { const a = rig.forearmAxis ?? [TIP[0] - WR[0], TIP[1] - WR[1]]; const l = Math.hypot(a[0], a[1]); return [a[0] / l, a[1] / l]; })();
  const axAng = Math.atan2(AX[1], AX[0]);
  const tipVec = [TIP[0] - WC[0], TIP[1] - WC[1]];
  const tipLen = Math.hypot(tipVec[0], tipVec[1]);
  const delta = Math.atan2(tipVec[1], tipVec[0]) - axAng;   // finger vs stub axis

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
    const dx = aim[0] - sh[0], dy = aim[1] - sh[1];
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;
    const fLen = tipLen * scale;
    // Solve for the tube direction α so that tube (along the stub axis) +
    // rotated finger vector lands exactly on `aim`.
    const phi = Math.atan2(dy, dx);
    const alpha = phi - Math.asin(clamp(fLen * Math.sin(delta) / dist, -1, 1));
    const ux = Math.cos(alpha), uy = Math.sin(alpha);
    // meme-stretchy: the forearm can grow far enough to tap anything on screen
    const minFore = 90 * scale, maxFore = Math.max(foreRest * scale * 2.4, 1400);
    const fore = clamp(dist * Math.cos(phi - alpha) - fLen * Math.cos(delta), minFore, maxFore);
    const wc = [sh[0] + ux * fore, sh[1] + uy * fore];          // stub centre at the cut
    if (!Number.isFinite(wc[0]) || !Number.isFinite(wc[1])) return;
    const theta = alpha - axAng;                                 // rotation applied to the hand

    // forearm: tapered tube, ink outline then white fill; it runs a little
    // under the stub so there is never a hairline gap at the cut
    const ow = rig.forearm.outline * scale;
    const hw0 = rig.forearm.shoulderWidth * scale / 2, hw1 = rig.forearm.width * scale / 2;
    const end = [wc[0] + ux * 14 * scale, wc[1] + uy * 14 * scale];
    const nx = -uy, ny = ux;
    const quad = (a, b) => `M${r1(sh[0] + nx * a)} ${r1(sh[1] + ny * a)} L${r1(end[0] + nx * b)} ${r1(end[1] + ny * b)}
      L${r1(end[0] - nx * b)} ${r1(end[1] - ny * b)} L${r1(sh[0] - nx * a)} ${r1(sh[1] - ny * a)} Z`;
    ctx.armSvg(`<path d="${quad(hw0 + ow, hw1 + ow)}" fill="var(--ink)"/>
      <path d="${quad(hw0, hw1)}" fill="#fff"/>
      <circle cx="${r1(sh[0])}" cy="${r1(sh[1])}" r="${r1(hw0 + ow)}" fill="var(--ink)"/>
      <circle cx="${r1(sh[0])}" cy="${r1(sh[1])}" r="${r1(hw0)}" fill="#fff"/>`);

    // hand sprite: rig point p → wc + scale·R(θ)·(p − WC)
    const hand = { file: rig.hand, w: rig.handSize[0], h: rig.handSize[1] };
    const hm = chain(M.t(wc[0], wc[1]), M.r(theta), M.s(scale, scale), M.t(HO[0] - WC[0], HO[1] - WC[1]));
    ctx.imgMatrix('pres-hand', hand.file, hm, { w: hand.w, h: hand.h, z: z + 3 });

    // expose live fingertip for a tap pulse
    const tip = M.apply(hm, [TIP[0] - HO[0], TIP[1] - HO[1]]);
    ctx.anchor('presenter.finger', tip[0], tip[1]);
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
