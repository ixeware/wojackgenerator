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
// images created (or re-pointed) during the current frame; the frame waits for
// them to decode so a sprite never flashes in one frame late
let pendingDecode = [];
function ensureImg(key, src) {
  src = assetUrl(src);
  let el = imgs.get(key);
  if (!el) {
    el = document.createElement('img');
    el.className = 'spr';
    el.decoding = 'sync';
    el.src = src;
    el.dataset.key = key;
    // Sprites live in hosts that are never innerHTML-reset, so they persist
    // across frames. Presenter + reaction stickers sit above the content.
    const top = key.startsWith('pres-') || key.startsWith('fg-') || key.startsWith('stk-');
    (top ? actorsHost() : document.getElementById('media')).appendChild(el);
    imgs.set(key, el);
    pendingDecode.push(el);
  } else if (el.getAttribute('src') !== src) {
    el.src = src;
    pendingDecode.push(el);
  }
  return el;
}
// images live in #over by default; presenter/foreground go above SVG actors
function actorsHost() { return document.getElementById('actors-host'); }

export async function setup(timeline, assets) {
  TL = timeline; A = assets;
  // a host for sprites that must sit above the SVG actor layer
  if (!document.getElementById('actors-host')) {
    // content sprites (pills, animals, figures): above diagrams, below chips
    const media = document.createElement('div');
    media.id = 'media';
    media.style.cssText = 'position:absolute;left:0;top:0;width:1080px;height:1920px;z-index:25;pointer-events:none';
    worldEl.appendChild(media);
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
  urls.add('/assets/texture/paper.jpg');
  await Promise.all([...urls].map(u => new Promise(res => { const im = new Image(); im.onload = im.onerror = res; im.src = u; })));
  document.fonts && await document.fonts.ready;
  window.__ready = true;
}

function paintBackground() {
  // Real paper texture (tools/make-paper.mjs), larger than the frame so it can
  // drift; a soft light wanders across it; edges are gently vignetted.
  bgEl.innerHTML = `<img id="paper" src="/assets/texture/paper.jpg" style="position:absolute;left:0;top:0;width:1400px;height:2400px;transform-origin:700px 1200px">
    <div id="light" style="position:absolute;inset:0"></div>
    <div style="position:absolute;inset:0;background:radial-gradient(120% 85% at 50% 42%, rgba(0,0,0,0) 58%, rgba(92,72,40,.16) 100%)"></div>`;
}

/** Slow, smooth motion of the paper: drift, tiny rotation, breathing, light sweep. */
function animateBackground(t) {
  const TAU = Math.PI * 2;
  const x = -160 + 38 * Math.sin(TAU * t / 23) + 12 * Math.sin(TAU * t / 9.3 + 1.1);
  const y = -240 + 52 * Math.sin(TAU * t / 31 + 0.7) + 10 * Math.sin(TAU * t / 11.7);
  // whole-pixel translation only: the encoder can then predict the texture as
  // a pure shift (sub-pixel moves / rotation resample the grain every frame
  // and balloon the file size)
  const paper = document.getElementById('paper');
  // even steps keep the 4:2:0 chroma planes aligned too
  if (paper) paper.style.transform = `translate(${Math.round(x / 2) * 2}px,${Math.round(y / 2) * 2}px)`;
  const lx = 540 + 330 * Math.sin(TAU * t / 17), ly = 760 + 420 * Math.sin(TAU * t / 25 + 0.6);
  const light = document.getElementById('light');
  if (light) light.style.background = `radial-gradient(900px 760px at ${r1(lx)}px ${r1(ly)}px, rgba(255,252,242,.42), rgba(255,252,242,0) 70%)`;
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
  // lay out and measure with the camera neutral; it is applied at the end
  worldEl.style.transform = 'none';
  animateBackground(t);

  // which shot are we in
  const shot = TL.shots.find(s => t >= s.start && t < s.end) ?? TL.shots.at(-1);
  ctx.shot = shot;
  ctx.local = t - shot.start;
  ctx.enter = easeInOut(clamp(ctx.local / 0.45, 0, 1));

  // 1) the scene draws content and registers named anchors
  const scene = scenes[shot.kind] || scenes.default;
  const res = scene(ctx, shot) || {};

  // 2) flush content so HTML anchors have real positions, then measure them
  actorsEl.innerHTML = buf.svgUnder.join('') + buf.svgOver.join('');
  underEl.innerHTML = buf.under.join('');
  overEl.innerHTML = buf.over.join('');
  for (const el of overEl.querySelectorAll('[data-anchor]')) {
    const name = el.dataset.anchor;
    if (!name) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0) anchors.set(name, [r.left + r.width / 2, r.top + r.height / 2]);
  }

  // 3) presenter (aims at the measured anchors) + captions
  drawPresenter(ctx, shot, anchors);
  drawCaptions(ctx);
  buf.ui.push(progressBar(t));
  document.getElementById('armfx').innerHTML = buf.arm.join('');
  document.getElementById('facefx').innerHTML = buf.face.join('');
  uiEl.innerHTML = buf.ui.join('');
  for (const [key, el] of imgs) if (!used.has(key)) el.style.display = 'none';

  // 4) camera: scene push-in + cue shake
  const cam = res.camera || null;
  const shake = shakeAt(t);
  applyCamera(cam ? { ...cam, x: (cam.x || 0) + shake.x, y: (cam.y || 0) + shake.y }
    : (shake.on ? { x: shake.x, y: shake.y, scale: 1 + shake.s } : null));
  if (!pendingDecode.length) return true;
  const waiting = pendingDecode;
  pendingDecode = [];
  return Promise.all(waiting.map(el => el.decode().catch(() => {}))).then(() => true);
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
    left: { x: 215, y: 2085 }, right: { x: 870, y: 2085 },
    bottom: { x: 540, y: 2100 }, 'low-left': { x: 240, y: 2110 }, 'low-right': { x: 840, y: 2110 },
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
  const WALK = 0.42; // seconds to dash over before the point lands
  const pt = TL.points.find(p => t >= p.start - WALK && t <= p.end + WALK);
  let target = null, pointK = 0, walkK = 0, lean = 0;
  let x = home.x, y = home.y;
  let flip = shot.presenterFlip ?? (spot === 'right');
  if (pt) {
    const a = anchors.get(pt.target);
    if (a) {
      target = { x: a[0], y: a[1] };
      // walk: ramp in before the word, back out after the hold
      walkK = Math.min(clamp((t - (pt.start - WALK)) / WALK, 0, 1), 1 - clamp((t - pt.end) / WALK, 0, 1));
      pointK = Math.min(clamp((t - (pt.start - 0.18)) / 0.26, 0, 1), 1 - clamp((t - pt.end) / 0.22, 0, 1));
      // stand where the arm makes a natural ~60° reach; face the target
      const pFlip = target.x < 470;
      const shoulderDX = 78 * (scale / 0.46);
      const reach = Math.max(260, Math.min(620, (home.y - 120 - target.y) * 0.55));
      const px = clamp(pFlip ? target.x + reach + shoulderDX : target.x - reach - shoulderDX, 130, 950);
      const e = easeInOut(walkK);
      x = lerp(home.x, px, e);
      // little hop while moving, lean into the direction of travel
      const moving = Math.abs(px - home.x) > 40 && walkK > 0 && walkK < 1;
      y = home.y - (moving ? Math.abs(Math.sin(e * Math.PI * 2)) * 34 : 0);
      if (walkK > 0.5) flip = pFlip;
      lean = moving ? Math.sign(px - home.x) * 0.8 : (pFlip ? -0.4 : 0.4) * pointK;
    }
  }

  const ms = TL.mouth ? TL.mouth[Math.min(ctx.frame, TL.mouth.length - 1)] : 0;
  presenter(ctx, {
    x, y, scale, flip, mouthState: ms,
    point: target, pointK, lean, z: 46,
  });
  // tap pulse at the fingertip when fully pointing
  if (pointK > 0.6) {
    const tip = anchors.get('presenter.finger') || (target && [target.x, target.y]);
    if (tip) {
      const pulse = (Math.sin(t * 14) + 1) / 2;
      ctx.armSvg(`<circle cx="${r1(target.x)}" cy="${r1(target.y)}" r="${r1(22 + pulse * 12)}" fill="none" stroke="var(--orange)" stroke-width="6" opacity="${r1(0.75 * pointK)}"/>`);
    }
  }
}

// ----------------------------------------------------- captions
function drawCaptions(ctx) {
  if (ctx.shot?.captions === false) return;
  const t = ctx.t;
  const g = TL.captions.find(c => t >= c.start - 0.04 && t < c.end + 0.14);
  if (!g) return;
  const y = ctx.shot?.captionY ?? 1418;
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
