// Turns assets/_raw into render-ready sprites + assets/manifest.json.
//   pills    → transparent cutouts without the NLM info strip
//   wojaks   → trimmed transparent sprites
//   presenter→ puppet rig (body with mouth erased + separate arm layer)
//   figures  → panels cropped from open-access papers (pdfimages)
//   fonts    → copied
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { mkdir, copyFile, writeFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pills, wojaks, fonts } from './sources.mjs';

const ROOT = new URL('../assets/', import.meta.url).pathname;
const RAW = join(ROOT, '_raw');
const manifest = { pills: {}, wojaks: {}, presenter: {}, figures: {}, fonts: {} };

for (const d of ['pills', 'wojaks', 'presenter', 'figures', 'fonts']) await mkdir(join(ROOT, d), { recursive: true });

// ---------------------------------------------------------------- helpers
async function alphaTrim(input, { maxSide = 900, alphaMin = 12, pad = 6 } = {}) {
  const img = sharp(input).ensureAlpha();
  const { data, info } = await img.clone().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > alphaMin) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  let out = sharp(input).ensureAlpha().extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 });
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, s = Math.min(1, maxSide / Math.max(cw, ch));
  if (s < 1) out = out.resize(Math.round(cw * s), Math.round(ch * s), { kernel: 'lanczos3' });
  return { pipeline: out, box: [x0, y0, cw, ch], scale: s };
}

async function save(pipeline, file) {
  const buf = await pipeline.png({ compressionLevel: 9, palette: false }).toBuffer();
  await writeFile(file, buf);
  const meta = await sharp(buf).metadata();
  return { w: meta.width, h: meta.height };
}

// ---------------------------------------------------------------- pills
// C3PI _SEG images: 2400×1920, transparent around the pill, opaque NLM
// caption strip at the bottom. Cut everything from the strip down.
for (const p of pills) {
  const src = join(RAW, 'pills', `${p.id}.png`);
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let strip = info.height;
  for (let y = Math.floor(info.height * 0.5); y < info.height; y++) {
    let opaque = 0;
    for (let x = 0; x < info.width; x += 8) if (data[(y * info.width + x) * 4 + 3] > 200) opaque++;
    if (opaque > info.width / 8 * 0.9) { strip = y; break; }
  }
  const top = await sharp(src).ensureAlpha().extract({ left: 0, top: 0, width: info.width, height: strip - 4 }).png().toBuffer();
  const { pipeline } = await alphaTrim(top, { maxSide: 720, pad: 4 });
  const size = await save(pipeline, join(ROOT, 'pills', `${p.id}.png`));
  manifest.pills[p.id] = { file: `pills/${p.id}.png`, ...size, label: p.label, strength: p.strength, ndc: p.ndc,
    source: 'NLM C3PI (public domain)', url: 'https://data.lhncbc.nlm.nih.gov/public/Pills/' + p.path };
  console.log('pill', p.id, size);
}

// ---------------------------------------------------------------- wojaks
for (const w of wojaks) {
  const src = join(RAW, 'wojaks', `${w.id}.png`);
  const { pipeline } = await alphaTrim(src, { maxSide: 900 });
  const size = await save(pipeline, join(ROOT, 'wojaks', `${w.id}.png`));
  manifest.wojaks[w.id] = { file: `wojaks/${w.id}.png`, ...size, source: 'Wojak Land', url: w.page + ' · ' + w.file };
  console.log('wojak', w.id, size);
}

// ---------------------------------------------------------------- presenter
// Talking heads (supplied with the original project): an opaque white band
// fills the bottom ~70 rows. Cut it and trim.
for (const f of ['01_idle', '02_talk_small', '03_talk_wide', '04_talk_o', '05_glowing_glasses_smirk', '06_laugh', '07_surprise', '08_angry']) {
  const src = join(RAW, 'presenter', `${f}.png`);
  const cut = await sharp(src).extract({ left: 0, top: 0, width: 1174, height: 1262 }).png().toBuffer();
  const { pipeline } = await alphaTrim(cut, { maxSide: 820, pad: 0 });
  const size = await save(pipeline, join(ROOT, 'presenter', `${f}.png`));
  manifest.presenter[f] = { file: `presenter/${f}.png`, ...size };
}

// Pointing sprite (1254×1254) → body + arm puppet layers.
// Coordinates were measured on the source sprite; see DESIGN notes in README.
const P = join(RAW, 'presenter', 'pointing.png');
const SZ = 1254;
const armPoly = [[752, 834], [700, 770], [690, 600], [730, 400], [860, 190], [1010, 40], [1254, 40], [1254, 760],
  [950, 1050], [857, 1028], [848, 977], [831, 930], [808, 890], [778, 857]];
const polySvg = (fill) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SZ}" height="${SZ}">
  <polygon points="${armPoly.map(p => p.join(',')).join(' ')}" fill="${fill}"/></svg>`);
// Mouth is erased so the renderer can draw lip-synced mouths on top.
const mouthPatch = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SZ}" height="${SZ}">
  <ellipse cx="531" cy="733" rx="80" ry="45" fill="#fff"/></svg>`);

const body = await sharp(P).ensureAlpha()
  .composite([{ input: polySvg('#000'), blend: 'dest-out' }, { input: mouthPatch, blend: 'atop' }])
  .png().toBuffer();
const arm = await sharp(P).ensureAlpha()
  .composite([{ input: polySvg('#000'), blend: 'dest-in' }])
  .png().toBuffer();
await writeFile(join(ROOT, 'presenter', 'rig-body.png'), body);
await writeFile(join(ROOT, 'presenter', 'rig-arm.png'), arm);

// The hand alone (everything beyond the wrist line) — the renderer draws a
// stretchy forearm tube up to it, so the presenter can point anywhere.
const wristCut = [995, 608];
const ax = [0.414, -0.910];                     // forearm axis, toward fingers
const nx = [-ax[1], ax[0]];                     // across the wrist
const far = 2400;
const half = [
  [wristCut[0] - far * nx[0], wristCut[1] - far * nx[1]],
  [wristCut[0] + far * nx[0], wristCut[1] + far * nx[1]],
  [wristCut[0] + far * nx[0] + far * ax[0], wristCut[1] + far * nx[1] + far * ax[1]],
  [wristCut[0] - far * nx[0] + far * ax[0], wristCut[1] - far * nx[1] + far * ax[1]],
].map(p => p.map(Math.round).join(',')).join(' ');
const handFull = await sharp(arm)
  .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SZ}" height="${SZ}"><polygon points="${half}" fill="#000"/></svg>`), blend: 'dest-in' }])
  .png().toBuffer();
const handTrim = await alphaTrim(handFull, { maxSide: 2000, pad: 2 });
const [hx, hy] = handTrim.box;
await writeFile(join(ROOT, 'presenter', 'rig-hand.png'), await handTrim.pipeline.png().toBuffer());
manifest.presenter.rig = {
  body: 'presenter/rig-body.png', arm: 'presenter/rig-arm.png', hand: 'presenter/rig-hand.png', size: [SZ, SZ],
  pivot: [796, 938],        // centre of the sleeve hem; arm rotates here
  fingertip: [1208, 192],   // index finger tip
  wrist: wristCut,          // where the hand sprite starts
  handOrigin: [hx, hy],     // top-left of rig-hand.png in rig space
  handSize: [handTrim.box[2], handTrim.box[3]],
  // measured on the stub at the cut: centre, axis, ink-to-ink 112 px, outline 9.5 px
  wristCenter: [980.3, 601.3], forearmAxis: [0.414, -0.910],
  forearm: { width: 93, shoulderWidth: 105, outline: 9.5 },
  mouth: [531, 733],        // centre of the erased mouth
  mouthWidth: 128,
  bottom: 1198,             // lowest drawn row of the bust
  note: 'Glasses wojak supplied with the original NSAIDs project; split into body / arm / hand for aiming.',
};

// ---------------------------------------------------------------- figures
const tmp = join(ROOT, '_raw', 'tmp');
await rm(tmp, { recursive: true, force: true });
await mkdir(tmp, { recursive: true });
function pdfImage(pdf, page, prefix) {
  execFileSync('pdfimages', ['-png', '-f', String(page), '-l', String(page), pdf, join(tmp, prefix)]);
  return join(tmp, `${prefix}-000.png`);
}
const caronPdf = join(RAW, 'papers', 'PMC7984053.1.pdf');
const janssenPdf = join(RAW, 'papers', 'v034a13.pdf');
const fig2 = pdfImage(caronPdf, 5, 'caron5');
const fig3 = pdfImage(caronPdf, 6, 'caron6');
const fig4 = pdfImage(janssenPdf, 8, 'janssen8');

const crops = [
  { id: 'caron-length', src: fig2, box: [596, 0, 1204, 571],
    cite: 'Caron MMJ et al. J Orthop Res 2021;39:553–564 · Fig. 2B–C', license: 'CC BY-NC-ND 4.0',
    url: 'https://doi.org/10.1002/jor.24819' },
  { id: 'caron-zones', src: fig3, box: [1040, 0, 1037, 582],
    cite: 'Caron MMJ et al. J Orthop Res 2021;39:553–564 · Fig. 3C–D', license: 'CC BY-NC-ND 4.0',
    url: 'https://doi.org/10.1002/jor.24819' },
  { id: 'caron-histo', src: fig3, box: [0, 585, 1062, 232],
    cite: 'Caron MMJ et al. J Orthop Res 2021;39:553–564 · Fig. 3E (Safranin O)', license: 'CC BY-NC-ND 4.0',
    url: 'https://doi.org/10.1002/jor.24819' },
  { id: 'janssen-front', src: fig4, box: [0, 0, 872, 272],
    cite: 'Janssen MP et al. Eur Cell Mater 2017;34:202–216 · Fig. 4A', license: 'eCM open access',
    url: 'https://doi.org/10.22203/eCM.v034a13' },
  { id: 'janssen-table', src: fig4, box: [0, 300, 524, 108],
    cite: 'Janssen MP et al. Eur Cell Mater 2017;34:202–216 · Fig. 4B', license: 'eCM open access',
    url: 'https://doi.org/10.22203/eCM.v034a13' },
];
for (const c of crops) {
  const [left, top, width, height] = c.box;
  const meta = await sharp(c.src).metadata();
  const box = { left, top, width: Math.min(width, meta.width - left), height: Math.min(height, meta.height - top) };
  const out = sharp(c.src).extract(box).flatten({ background: '#ffffff' });
  const size = await save(out, join(ROOT, 'figures', `${c.id}.png`));
  manifest.figures[c.id] = { file: `figures/${c.id}.png`, ...size, cite: c.cite, license: c.license, url: c.url };
  console.log('figure', c.id, size);
}
await rm(tmp, { recursive: true, force: true });

// ---------------------------------------------------------------- fonts
for (const f of fonts) {
  await copyFile(join(RAW, 'fonts', f.file), join(ROOT, 'fonts', f.file));
  await copyFile(join(RAW, 'fonts', `${f.id}-OFL.txt`), join(ROOT, 'fonts', `${f.id}-OFL.txt`));
  manifest.fonts[f.id] = { file: `fonts/${f.file}`, license: 'SIL OFL 1.1' };
}

await writeFile(join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('manifest written:', Object.fromEntries(Object.entries(manifest).map(([k, v]) => [k, Object.keys(v).length])));
