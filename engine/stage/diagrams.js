// Science objects drawn as SVG in one consistent language:
// 5px ink outlines, flat fills, cartilage blue, nucleus violet, bone beige.
// All are schematic; nothing here encodes measured data.
import { r1, lerp, clamp, easeOut, easeInOut, spring, rng, vis } from './lib.js';

const INK = 'var(--ink)';

/* ----------------------------------------------------------- long bone */
export function bone(ctx, o) {
  const { cx, top, h, w = 170, t0 = -1, glow = 0, layer = 'under', grow = 0 } = o;
  const v = vis(ctx.t, t0, Infinity, 0.3);
  if (v <= 0) return;
  const s = h / 640; // drawn on a 640-tall design
  const X = x => r1(cx + x * s), Y = y => r1(top + y * s);
  const shaft = w / 2 / s * 0.5;
  // epiphysis knobs + shaft, one closed outline
  const d = `M${X(-shaft)} ${Y(150)} C${X(-shaft - 6)} ${Y(250)} ${X(-shaft - 6)} ${Y(400)} ${X(-shaft)} ${Y(490)}
    C${X(-150)} ${Y(500)} ${X(-150)} ${Y(640)} ${X(-60)} ${Y(625)} C${X(-30)} ${Y(620)} ${X(-12)} ${Y(600)} ${X(0)} ${Y(585)}
    C${X(12)} ${Y(600)} ${X(30)} ${Y(620)} ${X(60)} ${Y(625)} C${X(150)} ${Y(640)} ${X(150)} ${Y(500)} ${X(shaft)} ${Y(490)}
    C${X(shaft + 6)} ${Y(400)} ${X(shaft + 6)} ${Y(250)} ${X(shaft)} ${Y(150)}
    C${X(150)} ${Y(140)} ${X(160)} ${Y(10)} ${X(70)} ${Y(14)} C${X(36)} ${Y(16)} ${X(14)} ${Y(36)} ${X(0)} ${Y(50)}
    C${X(-14)} ${Y(36)} ${X(-36)} ${Y(16)} ${X(-70)} ${Y(14)} C${X(-160)} ${Y(10)} ${X(-150)} ${Y(140)} ${X(-shaft)} ${Y(150)} Z`;
  const plateY = 128, plateY2 = 506;
  const g = clamp(glow, 0, 1);
  let svg = `<g opacity="${r1(v)}">
    <path d="${d}" fill="var(--bone)" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M${X(-shaft + 14)} ${Y(175)} L${X(-shaft + 14)} ${Y(470)}" stroke="#fff" stroke-width="${r1(10 * s)}" stroke-linecap="round" opacity=".7"/>
    <rect x="${X(-shaft + 26)}" y="${Y(200)}" width="${r1((shaft * 2 - 52) * s)}" height="${r1(250 * s)}" rx="${r1(20 * s)}" fill="var(--bone-deep)" opacity=".35"/>`;
  for (const py of [plateY, plateY2]) {
    const big = py === plateY;
    const half = big ? 124 : 118;
    svg += `<path d="M${X(-half)} ${Y(py)} Q${X(0)} ${Y(py + (big ? 16 : -16))} ${X(half)} ${Y(py)}" stroke="var(--cart-deep)" stroke-width="${r1(22 * s)}" fill="none" stroke-linecap="round"/>`;
    if (big && g > 0) {
      svg += `<path d="M${X(-half)} ${Y(py)} Q${X(0)} ${Y(py + 16)} ${X(half)} ${Y(py)}" stroke="var(--yellow)" stroke-width="${r1(46 * s)}" fill="none" stroke-linecap="round" opacity="${r1(0.55 * g)}"/>
        <path d="M${X(-half)} ${Y(py)} Q${X(0)} ${Y(py + 16)} ${X(half)} ${Y(py)}" stroke="var(--blue)" stroke-width="${r1(22 * s)}" fill="none" stroke-linecap="round" opacity="${r1(g)}"/>`;
    }
  }
  svg += '</g>';
  ctx.svg(layer, svg);
  ctx.anchor(o.anchor ?? 'bone.plate', +X(70), +Y(plateY + 6));
  return { plate: [+X(0), +Y(plateY + 8)], plateHalf: 124 * s, s };
}

/* ----------------------------------------------------------- cartilage cell */
export function cell(o) {
  const { x, y, r, split = 0, swell = 0, dead = 0, mineral = 0, dim = 0, seed = 1 } = o;
  const R = r * (1 + swell * 0.55);
  const fill = mineral > 0 ? mixHex('#D8E7FA', '#E8D3A6', mineral) : '#D8E7FA';
  let s = '';
  if (split > 0.02) {
    // two daughter cells pulling apart (proliferative zone: flat stacked cells)
    const d = split * R * 0.62;
    const rr = R * lerp(1, 0.78, split);
    for (const k of [-1, 1]) {
      s += `<ellipse cx="${r1(x)}" cy="${r1(y + k * d)}" rx="${r1(rr * 1.18)}" ry="${r1(rr * 0.78)}" fill="${fill}" stroke="${INK}" stroke-width="4"/>
        <ellipse cx="${r1(x)}" cy="${r1(y + k * d)}" rx="${r1(rr * 0.34)}" ry="${r1(rr * 0.28)}" fill="var(--nucleus)"/>`;
    }
  } else if (dead > 0) {
    const R2 = rng(seed);
    const pts = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const rr = R * (1 - dead * 0.25) * (1 + (R2() - 0.5) * dead * 0.5);
      pts.push(`${r1(x + Math.cos(a) * rr)},${r1(y + Math.sin(a) * rr)}`);
    }
    s += `<polygon points="${pts.join(' ')}" fill="${mixHex('#D8E7FA', '#F3C9C2', dead)}" stroke="${INK}" stroke-width="4" stroke-dasharray="${dead > 0.4 ? '7 6' : 'none'}"/>`;
    for (let i = 0; i < 3; i++) {
      const a = R2() * 6.28, rr = R * 0.25;
      s += `<circle cx="${r1(x + Math.cos(a) * rr)}" cy="${r1(y + Math.sin(a) * rr)}" r="${r1(R * 0.13 * (1 - dead * 0.4))}" fill="var(--nucleus)" opacity="${r1(1 - dead * 0.4)}"/>`;
    }
  } else {
    s += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(R)}" fill="${fill}" stroke="${INK}" stroke-width="4"/>
      <path d="M${r1(x - R * 0.62)} ${r1(y - R * 0.3)} A${r1(R * 0.7)} ${r1(R * 0.7)} 0 0 1 ${r1(x - R * 0.1)} ${r1(y - R * 0.7)}" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".9"/>
      <circle cx="${r1(x + R * 0.08)}" cy="${r1(y + R * 0.06)}" r="${r1(R * lerp(0.34, 0.24, swell))}" fill="var(--nucleus)"/>`;
  }
  return dim ? `<g opacity="${r1(1 - dim * 0.65)}" style="filter:grayscale(${r1(dim)})">${s}</g>` : s;
}

function mixHex(a, b, t) {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], clamp(t, 0, 1))).toString(16).padStart(2, '0')).join('');
}

/* ----------------------------------------------------------- zoomed growth plate
 * Vertical column: resting → proliferative (stacks) → hypertrophic → bone.
 * phases: divide / swell / bone are 0..1 animation progress values. */
export function plateColumn(ctx, o) {
  const { x, y, w, h, divide = 0, swell = 0, ossify = 0, stall = 0, v = 1, labels = true } = o;
  if (v <= 0) return;
  const zones = [
    { k: 'resting', y0: 0, y1: 0.18 },
    { k: 'dividing', y0: 0.18, y1: 0.5 },
    { k: 'maturing', y0: 0.5, y1: 0.78 },
    { k: 'bone', y0: 0.78, y1: 1 },
  ];
  let s = `<g opacity="${r1(v)}"><clipPath id="pc"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="28"/></clipPath><g clip-path="url(#pc)">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#EEF4FC"/>`;
  // bone zone: trabeculae appear as it ossifies
  const by = y + h * 0.78;
  s += `<rect x="${x}" y="${r1(by)}" width="${w}" height="${r1(h * 0.22)}" fill="${mixHex('#EEF4FC', '#F2E4C7', 0.4 + ossify * 0.6)}"/>`;
  const R = rng(9);
  for (let i = 0; i < 9; i++) {
    const xx = x + 30 + R() * (w - 60), yy = by + 18 + R() * (h * 0.22 - 36);
    s += `<path d="M${r1(xx - 34)} ${r1(yy + 10)} Q${r1(xx)} ${r1(yy - 18)} ${r1(xx + 38)} ${r1(yy + 6)}" stroke="var(--bone-deep)" stroke-width="${r1(lerp(6, 13, ossify))}" fill="none" stroke-linecap="round" opacity="${r1(0.35 + ossify * 0.65)}"/>`;
  }
  const cols = 4;
  const colW = w / cols;
  // resting: small scattered round cells
  for (let c = 0; c < cols; c++) for (let rI = 0; rI < 2; rI++) {
    s += cell({ x: x + colW * (c + 0.5) + (rI % 2 ? 12 : -12), y: y + h * (0.05 + rI * 0.08), r: 15 });
  }
  // proliferative: flattened stacks; dividing animation
  for (let c = 0; c < cols; c++) for (let rI = 0; rI < 4; rI++) {
    const ph = clamp(divide * 1.6 - (rI * 0.12 + c * 0.07), 0, 1);
    s += cell({ x: x + colW * (c + 0.5), y: y + h * (0.22 + rI * 0.075), r: 20, split: easeInOut(ph) * (1 - stall * 0.6) });
  }
  // hypertrophic: big swollen cells
  for (let c = 0; c < cols; c++) for (let rI = 0; rI < 2; rI++) {
    const ph = clamp(swell * 1.5 - (rI * 0.2 + c * 0.06), 0, 1);
    s += cell({ x: x + colW * (c + 0.5), y: y + h * (0.56 + rI * 0.105), r: 25, swell: easeOut(ph) * (1 - stall), mineral: rI === 1 ? ossify * 0.6 : 0 });
  }
  s += `</g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="28" fill="none" stroke="${INK}" stroke-width="6"/></g>`;
  ctx.svg('under', s);
  if (labels) {
    zones.forEach(z => {
      const yy = y + h * (z.y0 + z.y1) / 2;
      ctx.html('over', `<div class="label up" style="left:${r1(x + w + 22)}px;top:${r1(yy)}px;transform:translateY(-50%);opacity:${r1(v)}">${z.k}</div>`);
    });
  }
  return { zoneY: k => y + h * { resting: 0.09, dividing: 0.34, maturing: 0.64, bone: 0.89 }[k] };
}

/* ----------------------------------------------------------- COX enzyme */
export function enzyme(ctx, o) {
  const { cx, cy, r = 120, label = 'COX', color = 'var(--violet)', blocked = 0, v = 1, wob = 0 } = o;
  if (v <= 0) return;
  const R = rng(5);
  const pts = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const bump = 1 + 0.07 * Math.sin(a * 3 + 1.3) + (R() - 0.5) * 0.05 + Math.sin(ctx.t * 2 + i) * 0.012 * wob;
    pts.push([cx + Math.cos(a) * r * bump, cy + Math.sin(a) * r * bump * 0.86]);
  }
  // active-site notch on the right
  const notch = `M${r1(cx + r * 0.58)} ${r1(cy - r * 0.22)} Q${r1(cx + r * 0.28)} ${r1(cy)} ${r1(cx + r * 0.58)} ${r1(cy + r * 0.22)}`;
  let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
  for (let i = 1; i <= pts.length; i++) {
    const p = pts[i % pts.length], q = pts[(i + 1) % pts.length];
    d += ` Q${r1(p[0])} ${r1(p[1])} ${r1((p[0] + q[0]) / 2)} ${r1((p[1] + q[1]) / 2)}`;
  }
  let s = `<g opacity="${r1(v)}"><path d="${d}Z" fill="${color}" stroke="${INK}" stroke-width="6"/>
    <path d="${notch}" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
    <text x="${r1(cx - r * 0.12)}" y="${r1(cy + 20)}" text-anchor="middle" font-family="Bricolage" font-weight="800" font-size="${r1(r * 0.5)}" fill="#fff">${label}</text>`;
  if (blocked > 0) {
    const b = easeOut(blocked);
    s += `<g transform="translate(${r1(cx + r * 0.7)} ${r1(cy - r * 0.62)}) scale(${r1(lerp(0.2, 1, spring(blocked * 1.4)))})">
      <circle r="44" fill="#fff" stroke="var(--red)" stroke-width="10"/><path d="M-30 30 L30 -30" stroke="var(--red)" stroke-width="10" stroke-linecap="round"/></g>`;
  }
  s += '</g>';
  ctx.svg('under', s);
  return { site: [cx + r * 0.5, cy] };
}

/* Prostaglandin glyph: little lipid "hairpin" — reads as a molecule. */
export function pg(x, y, s = 1, color = 'var(--green)', op = 1) {
  return `<g transform="translate(${r1(x)} ${r1(y)}) scale(${r1(s)})" opacity="${r1(op)}">
    <path d="M-26 -8 L-14 -18 L-2 -8 L10 -18 L22 -8" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M-26 6 L-14 16 L-2 6 L10 16" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="-30" cy="-1" r="9" fill="${color}"/></g>`;
}

/* ----------------------------------------------------------- pathway node */
export function node(ctx, o) {
  const { cx, cy, r = 70, text, sub, state = 1, color = 'var(--violet)', v = 1, anchor, size } = o;
  if (v <= 0) return;
  // state: 1 active, 0 off, -1 blocked (dimmed + red ring)
  const on = clamp(state, 0, 1);
  const fill = state < 0 ? '#EDEDED' : `color-mix(in srgb, ${color} ${Math.round(on * 100)}%, #E9E9E9)`;
  const pulse = on > 0.5 ? 1 + 0.035 * Math.sin(ctx.t * 6) : 1;
  ctx.svg('under', `<g opacity="${r1(v)}"><circle cx="${cx}" cy="${cy}" r="${r1(r * pulse)}" fill="${fill}" stroke="${state < 0 ? 'var(--red)' : INK}" stroke-width="6"/>
    <text x="${cx}" y="${r1(cy + (sub ? 2 : 13))}" text-anchor="middle" font-family="Bricolage" font-weight="800" font-size="${size ?? r1(r * 0.42)}" fill="${on > 0.5 ? '#fff' : '#8B8F96'}">${text}</text>
    ${sub ? `<text x="${cx}" y="${r1(cy + 36)}" text-anchor="middle" font-family="Onest" font-weight="700" font-size="22" fill="${on > 0.5 ? 'rgba(255,255,255,.85)' : '#9A9EA5'}">${sub}</text>` : ''}</g>`);
  if (anchor) ctx.anchor(anchor, cx, cy - r * 0.2);
}

/* ----------------------------------------------------------- culture dish */
export function dish(ctx, o) {
  const { cx, cy, r = 230, n = 26, divide = 0, die = 0, rescueTry = 0, v = 1, seed = 4 } = o;
  if (v <= 0) return;
  const R = rng(seed);
  let s = `<g opacity="${r1(v)}"><ellipse cx="${cx}" cy="${cy + 14}" rx="${r + 16}" ry="${r1((r + 16) * 0.34)}" fill="rgba(22,24,29,.12)"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#F3F8FF" stroke="${INK}" stroke-width="6"/>
    <circle cx="${cx}" cy="${cy}" r="${r - 18}" fill="none" stroke="#C9D7EA" stroke-width="4"/>`;
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, d = Math.sqrt(R()) * (r - 52);
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
    const rs = R();
    const dying = rs < 0.42 ? clamp(die * 1.4 - rs, 0, 1) : 0;
    const splitting = rs > 0.6 ? clamp(divide - (rs - 0.6) * 2, 0, 1) : 0;
    s += cell({ x, y, r: 18, dead: dying, split: dying ? 0 : splitting * 0.9, seed: i + 3 });
  }
  if (rescueTry > 0) {
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9 + 0.4, fall = clamp(rescueTry * 1.3 - i * 0.08, 0, 1);
      s += pg(cx + Math.cos(a) * (r * 0.55), cy - r - 40 + fall * (r * 0.9 + Math.sin(a) * r * 0.5), 0.75, 'var(--green)', clamp(1.4 - fall, 0, 1) * 0.95);
    }
  }
  s += '</g>';
  ctx.svg('under', s);
}

/* ----------------------------------------------------------- cell cycle ring */
export function cycle(ctx, o) {
  const { cx, cy, r = 120, spin = 0, arrest = 0, v = 1 } = o;
  if (v <= 0) return;
  const segs = [['G1', '#7FB6F2'], ['S', '#8CD9B6'], ['G2', '#F7C66E'], ['M', '#F28E7F']];
  let s = `<g opacity="${r1(v)}">`;
  const arcs = [0.42, 0.28, 0.18, 0.12];
  let a0 = -Math.PI / 2;
  arcs.forEach((f, i) => {
    const a1 = a0 + f * Math.PI * 2 - 0.05;
    const p = (a, rr) => `${r1(cx + Math.cos(a) * rr)} ${r1(cy + Math.sin(a) * rr)}`;
    s += `<path d="M${p(a0, r)} A${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${p(a1, r)}" fill="none" stroke="${segs[i][1]}" stroke-width="34"/>`;
    const mid = (a0 + a1) / 2;
    s += `<text x="${r1(cx + Math.cos(mid) * (r + 52))}" y="${r1(cy + Math.sin(mid) * (r + 52) + 11)}" text-anchor="middle" font-family="Bricolage" font-weight="800" font-size="32" fill="var(--ink)">${segs[i][0]}</text>`;
    a0 = a1 + 0.05;
  });
  // the "runner" goes round until arrested in G0/G1
  const ang = -Math.PI / 2 + (arrest > 0 ? lerp((spin % 1) * Math.PI * 2, 0.55, easeOut(arrest)) : (spin % 1) * Math.PI * 2);
  s += `<circle cx="${r1(cx + Math.cos(ang) * r)}" cy="${r1(cy + Math.sin(ang) * r)}" r="22" fill="#fff" stroke="var(--ink)" stroke-width="6"/>`;
  if (arrest > 0) {
    const k = spring(arrest * 1.3);
    s += `<g transform="translate(${cx} ${cy}) scale(${r1(lerp(0.3, 1, k))})"><rect x="-58" y="-40" width="116" height="80" rx="18" fill="var(--red)" stroke="var(--ink)" stroke-width="5"/>
      <rect x="-26" y="-22" width="16" height="44" rx="4" fill="#fff"/><rect x="10" y="-22" width="16" height="44" rx="4" fill="#fff"/></g>`;
  } else {
    s += `<text x="${cx}" y="${cy + 12}" text-anchor="middle" font-family="Bricolage" font-weight="800" font-size="34" fill="var(--ink)">cycle</text>`;
  }
  s += '</g>';
  ctx.svg('under', s);
}

/* ----------------------------------------------------------- simple height ruler */
export function ruler(ctx, o) {
  const { x, y0, y1, v = 1, marks = 8 } = o;
  if (v <= 0) return;
  let s = `<g opacity="${r1(v)}"><rect x="${x - 18}" y="${y0}" width="36" height="${y1 - y0}" rx="10" fill="#fff" stroke="${INK}" stroke-width="5"/>`;
  for (let i = 1; i < marks; i++) {
    const yy = y0 + (y1 - y0) * i / marks;
    s += `<path d="M${x - 18} ${r1(yy)} h${i % 2 ? 14 : 24}" stroke="${INK}" stroke-width="4"/>`;
  }
  ctx.svg('under', s + '</g>');
}
