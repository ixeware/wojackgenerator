// Stage runtime. The renderer (Playwright) calls window.wg.setup(timeline, assets)
// once, then window.wg.frame(i) per frame. Everything is a pure function of time,
// so any frame can be produced in any order — which is what lets us render in
// parallel across workers.
import { W, H, M, r1, clamp, lerp, easeInOut } from './lib.js';
import { scenes } from './scenes.js';
import { makePresenter } from './presenter.js';

const underEl = document.getElementById('under');
const overEl = document.getElementById('over');
const actorsEl = document.getElementById('actors');
const uiEl = document.getElementById('ui');
const bgEl = document.getElementById('bg');
const worldEl = document.getElementById('world');

let TL, A, presenter, imgs = new Map();

function makeCtx(t, frame) {
  const buf = { under: [], over: [], svgUnder: [], svgOver: [], arm: [], face: [], ui: [] };
  const used = new Set();
  const anchors = new Map();
  const ctx = {
    t, frame, A, TL,
    html: (layer, s) => buf[layer === 'ui' ? 'ui' : layer === 'under' ? 'under' : 'over'].push(s),
    svg: (layer, s) => buf[layer === 'under' ? 'svgUnder' : 'svgOver'].push(s),
    anchor: (name, x, y) => anchors.set(name, [x, y]),
    getAnchor: name => anchors.get(name),
    mark: name => TL.marks[name] ?? null,         // global seconds for an anchored word
    since: name => TL.marks[name] != null ? t - TL.marks[name] : -Infinity,
    // persistent <img>, positioned by a simple box + rotation/scale
    img(key, src, o) {
      const el = ensureImg(key, src);
      used.add(key);
      const sx = o.sx ?? 1, sy = o.sy ?? 1;
      const ox = o.ox ?? 0, oy = o.oy ?? 0;
      el.style.width = o.w + 'px';
      el.style.height = o.h + 'px';
      el.style.transformOrigin = `${ox}px ${oy}px`;
      el.style.transform = `translate(${r1(o.x)}px,${r1(o.y)}px) rotate(${r1(o.rot ?? 0)}deg) scale(${sx},${sy})`;
      el.style.opacity = r1(clamp(o.opacity ?? 1, 0, 1));
      el.style.zIndex = o.z ?? 20;
      el.style.filter = o.filter || 'none';
      el.style.display = 'block';
    },
    // persistent <img> placed by a full affine matrix (for the puppet)
    imgMatrix(key, src, m, o) {
      const el = ensureImg(key, src);
      used.add(key);
      el.style.width = o.w + 'px';
      el.style.height = o.h + 'px';
      el.style.transformOrigin = '0 0';
      el.style.transform = M.css(m);
      el.style.opacity = r1(clamp(o.opacity ?? 1, 0, 1));
      el.style.zIndex = o.z ?? 40;
      el.style.filter = o.filter || 'none';
      el.style.display = 'block';
    },
    // SVG fragment transformed by a matrix, drawn ABOVE the presenter body
    // (used for the lip-synced mouth so it sits on the face)
    svgMatrix(m, frag) {
      buf.face.push(`<g transform="${M.css(m)}">${frag}</g>`);
    },
    armSvg: s => buf.arm.push(s),   // forearm layer (between content and body)
  };
  return { ctx, buf, used, anchors };
}

function assetUrl(src) {
  return (src.startsWith('/') || src.startsWith('http') || src.startsWith('data:')) ? src : '/assets/' + src;
}
function ensureImg(key, src) {
  src = assetUrl(src);
  let el = imgs.get(key);
  if (!el) {
    el = document.createElement('img');
    el.className = 'spr';
    el.decoding = 'sync';
    el.src = src;
    el.dataset.key = key;
    (key.startsWith('pres-') || key.startsWith('fg-') ? actorsHost() : overEl).appendChild(el);
    imgs.set(key, el);
  } else if (el.getAttribute('src') !== src) {
    el.src = src;
  }
  return el;
}
// images live in #over by default; presenter/foreground go above SVG actors
function actorsHost() { return document.getElementById('actors-host'); }

export async function setup(timeline, assets) {
  TL = timeline; A = assets;
  // a host for sprites that must sit above the SVG actor layer
  if (!document.getElementById('actors-host')) {
    const host = document.createElement('div');
    host.id = 'actors-host';
    host.style.cssText = 'position:absolute;left:0;top:0;width:1080px;height:1920px;z-index:40;pointer-events:none';
    worldEl.appendChild(host);
    const mkSvg = (id, z) => {
      const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      s.id = id; s.setAttribute('viewBox', '0 0 1080 1920'); s.setAttribute('width', '1080'); s.setAttribute('height', '1920');
      s.style.cssText = `position:absolute;left:0;top:0;width:1080px;height:1920px;z-index:${z};pointer-events:none`;
      worldEl.appendChild(s);
    };
    mkSvg('armfx', 35);   // forearm: above content, below the body
    mkSvg('facefx', 55);  // mouth: above the body
  }
  presenter = makePresenter(A, A.presenter.rig);
  paintBackground();
  // preload all images referenced in the manifest so no frame waits on decode
  const urls = new Set();
  for (const grp of ['pills', 'wojaks', 'figures']) for (const k in A[grp]) urls.add('/assets/' + A[grp][k].file);
  for (const k of ['rig-body', 'rig-hand']) urls.add('/assets/' + A.presenter.rig[k === 'rig-body' ? 'body' : 'hand']);
  await Promise.all([...urls].map(u => new Promise(res => { const im = new Image(); im.onload = im.onerror = res; im.src = u; })));
  document.fonts && await document.fonts.ready;
  window.__ready = true;
}

function paintBackground() {
  // warm paper with a faint grain + vignette, painted once
  bgEl.innerHTML = `<svg width="1080" height="1920" viewBox="0 0 1080 1920">
    <defs>
      <radialGradient id="vig" cx="50%" cy="42%" r="75%"><stop offset="55%" stop-color="#F5F1E7"/><stop offset="100%" stop-color="#E7DFCF"/></radialGradient>
      <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.03 0"/></filter>
    </defs>
    <rect width="1080" height="1920" fill="url(#vig)"/>
    <rect width="1080" height="1920" filter="url(#grain)"/>
  </svg>`;
}

/** Camera: scenes may request a push-in / drift via ctx result. */
function applyCamera(cam) {
  if (!cam) { worldEl.style.transform = 'none'; return; }
  const { x = 0, y = 0, scale = 1, rot = 0 } = cam;
  worldEl.style.transformOrigin = `${cam.ox ?? 540}px ${cam.oy ?? 820}px`;
  worldEl.style.transform = `translate(${r1(x)}px,${r1(y)}px) scale(${r1(scale * 1000) / 1000}) rotate(${r1(rot)}deg)`;
}

export function frame(i) {
  const t = i / TL.meta.fps;
  const { ctx, buf, used, anchors } = makeCtx(t, i);

  // which shot are we in
  const shot = TL.shots.find(s => t >= s.start && t < s.end) ?? TL.shots.at(-1);
  const prev = TL.shots[TL.shots.indexOf(shot) - 1];
  ctx.shot = shot;
  ctx.local = t - shot.start;

  // 1) draw the active scene (and a short cross-fade tail of the previous)
  const scene = scenes[shot.kind] || scenes.default;
  let cam = null;
  const trans = clamp(ctx.local / 0.45, 0, 1); // scene entrance progress
  ctx.enter = easeInOut(trans);
  const res = scene(ctx, shot) || {};
  cam = res.camera || null;

  // 2) presenter (reads anchors the scene just registered)
  drawPresenter(ctx, shot, anchors);

  // 3) captions
  drawCaptions(ctx);

  // 4) global cue FX (screen shake)
  const shake = shakeAt(t);
  applyCamera(cam ? { ...cam, x: (cam.x || 0) + shake.x, y: (cam.y || 0) + shake.y } : (shake.on ? { x: shake.x, y: shake.y, scale: 1 + shake.s } : null));

  // 5) progress hairline
  buf.ui.push(progressBar(t));

  // flush
  actorsEl.innerHTML = buf.svgUnder.join('') + buf.svgOver.join('');
  document.getElementById('armfx').innerHTML = buf.arm.join('');
  document.getElementById('facefx').innerHTML = buf.face.join('');
  underEl.innerHTML = buf.under.join('');
  overEl.innerHTML = buf.over.join('');
  uiEl.innerHTML = buf.ui.join('');
  for (const [key, el] of imgs) if (!used.has(key)) el.style.display = 'none';
  return true;
}

function shakeAt(t) {
  let x = 0, y = 0, s = 0, on = false;
  for (const c of TL.cues) {
    if (!c.fx) continue;
    const dt = t - c.t;
    if (dt < 0 || dt > 0.3) continue;
    on = true;
    const d = Math.exp(-dt * 16) * (c.fx === 'shake' ? 1 : 0.6);
    x += Math.sin(dt * 90) * 16 * d;
    y += Math.cos(dt * 78) * 12 * d;
    s += 0.01 * d;
  }
  return { x, y, s, on };
}

function progressBar(t) {
  const k = clamp(t / TL.duration, 0, 1);
  return `<svg width="1080" height="1920" style="position:absolute;inset:0"><rect x="0" y="1912" width="${r1(1080 * k)}" height="8" fill="var(--red)" opacity="0.9"/></svg>`;
}

// ----------------------------------------------------- presenter driver
function drawPresenter(ctx, shot, anchors) {
  if (shot.presenter === false) return;
  const t = ctx.t;
  // home position per shot: alternate sides so the cast feels lively
  const idx = TL.shots.indexOf(shot);
  const spot = shot.presenterSpot || (idx % 2 ? 'right' : 'left');
  const scale = shot.presenterScale ?? 0.46;
  const spots = {
    left: { x: 205, y: 2010 }, right: { x: 880, y: 2010 },
    bottom: { x: 540, y: 2040 }, 'low-left': { x: 240, y: 2050 }, 'low-right': { x: 840, y: 2050 },
  };
  let home = spots[spot] || spots.left;

  // slide in from previous shot's spot
  const slide = clamp(ctx.local / 0.5, 0, 1);
  const prev = TL.shots[idx - 1];
  if (prev && slide < 1) {
    const ph = spots[prev.presenterSpot || ((idx - 1) % 2 ? 'right' : 'left')] || spots.left;
    home = { x: lerp(ph.x, home.x, easeInOut(slide)), y: home.y };
  }

  // find an active pointing instruction
  const pt = TL.points.find(p => t >= p.start - 0.25 && t <= p.end + 0.2);
  let target = null, pointK = 0, lean = 0;
  if (pt) {
    const a = anchors.get(pt.target);
    if (a) {
      target = { x: a[0], y: a[1] };
      const inK = clamp((t - (pt.start - 0.22)) / 0.3, 0, 1);
      const outK = 1 - clamp((t - pt.end) / 0.25, 0, 1);
      pointK = Math.min(inK, outK);
      lean = (target.x > home.x ? 1 : -1) * 0.5 * pointK;
    }
  }

  const flip = shot.presenterFlip ?? (spot === 'right');
  const ms = TL.mouth ? TL.mouth[Math.min(ctx.frame, TL.mouth.length - 1)] : 0;
  presenter(ctx, {
    x: home.x, y: home.y, scale, flip, mouthState: ms,
    point: target, pointK, lean, z: 46,
  });
  // tap pulse at the fingertip when fully pointing
  if (pointK > 0.6) {
    const tip = anchors.get('presenter.finger') || (target && [target.x, target.y]);
    if (tip) {
      const pulse = (Math.sin(t * 14) + 1) / 2;
      ctx.svg('over', `<circle cx="${r1(target.x)}" cy="${r1(target.y)}" r="${r1(18 + pulse * 10)}" fill="none" stroke="var(--red)" stroke-width="5" opacity="${r1(0.5 * pointK)}"/>`);
    }
  }
}

// ----------------------------------------------------- captions
function drawCaptions(ctx) {
  if (ctx.shot?.captions === false) return;
  const t = ctx.t;
  const g = TL.captions.find(c => t >= c.start - 0.04 && t < c.end + 0.14);
  if (!g) return;
  const y = ctx.shot?.captionY ?? 1560;
  const inK = clamp((t - (g.start - 0.04)) / 0.12, 0, 1);
  const words = g.tokens.map((w, i) => {
    const wk = clamp((t - w.start) / 0.09, 0, 1);
    const spoken = t >= w.start - 0.02;
    const col = w.emph ? 'var(--red)' : 'var(--ink)';
    const hl = w.emph ? `<i style="background:var(--yellow)"></i>` : '';
    const pop = spoken ? 1 : 0.88;
    const yoff = (1 - wk) * 6;
    return `<span class="w" style="color:${col};transform:translateY(${r1(yoff)}px) scale(${spoken ? 1 : 0.97});opacity:${spoken ? 1 : 0.55}">${hl}${esc(w.text)}</span>`;
  }).join('');
  ctx.html('ui', `<div id="cap" style="top:${y}px;opacity:${r1(inK)}">${words}</div>`);
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// expose to the renderer
window.wg = { setup, frame, get ready() { return !!window.__ready; } };
