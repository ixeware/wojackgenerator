// Generates the paper texture used as the animated background:
// warm stock, large soft mottling, fibres, fine grain and two faint creases.
// Larger than the frame so the stage can drift it slowly.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const W = 1400, H = 2400;
const out = new URL('../assets/texture/paper.jpg', import.meta.url).pathname;
await mkdir(new URL('../assets/texture/', import.meta.url).pathname, { recursive: true });

let seed = 11;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

// fibres: short, slightly curved strokes, some darker, some lighter
let fibres = '';
for (let i = 0; i < 1400; i++) {
  const x = rnd() * W, y = rnd() * H, len = 8 + rnd() * 34, a = rnd() * Math.PI;
  const bend = (rnd() - 0.5) * 10;
  const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
  const cx = (x + x2) / 2 - Math.sin(a) * bend, cy = (y + y2) / 2 + Math.cos(a) * bend;
  const dark = rnd() < 0.6;
  fibres += `<path d="M${x.toFixed(1)} ${y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${dark ? '#9C8B6C' : '#FFFFFF'}" stroke-opacity="${(dark ? 0.10 + rnd() * 0.12 : 0.35 + rnd() * 0.3).toFixed(2)}" stroke-width="${(0.6 + rnd() * 0.9).toFixed(2)}" fill="none" stroke-linecap="round"/>`;
}
// tiny specks of pulp
let specks = '';
for (let i = 0; i < 260; i++) {
  specks += `<circle cx="${(rnd() * W).toFixed(1)}" cy="${(rnd() * H).toFixed(1)}" r="${(0.5 + rnd() * 1.3).toFixed(2)}" fill="#7D6B4E" fill-opacity="${(0.12 + rnd() * 0.2).toFixed(2)}"/>`;
}
// two soft creases: a shadow line with a highlight beside it
const crease = (x0, y0, x1, y1, bend) => {
  const mx = (x0 + x1) / 2 + bend, my = (y0 + y1) / 2;
  const d = `M${x0} ${y0} Q${mx} ${my} ${x1} ${y1}`;
  return `<path d="${d}" stroke="#6E5E44" stroke-opacity=".07" stroke-width="5" fill="none" filter="url(#soft)"/>
    <path d="${d}" transform="translate(3 2)" stroke="#FFFFFF" stroke-opacity=".45" stroke-width="3" fill="none" filter="url(#soft)"/>`;
};

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <filter id="mottle" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.0035" numOctaves="4" seed="3"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.52  0 0 0 0 0.43  0 0 0 0 0.30  0 0 0 0.42 -0.15"/>
    </filter>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="8"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.3  0 0 0 0 0.25  0 0 0 0 0.18  0 0 0 0.38 -0.15"/>
    </filter>
    <filter id="weave" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.05" numOctaves="3" seed="21"/>
      <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.7 -0.28"/>
    </filter>
    <filter id="soft"><feGaussianBlur stdDeviation="1.6"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="#F6F0E3"/>
  <rect width="${W}" height="${H}" filter="url(#mottle)"/>
  <rect width="${W}" height="${H}" filter="url(#weave)"/>
  <rect width="${W}" height="${H}" filter="url(#grain)"/>
  ${fibres}${specks}
  ${crease(-40, 520, 1440, 760, -80)}
  ${crease(380, -40, 980, 2440, 140)}
</svg>`;

await sharp(Buffer.from(svg)).jpeg({ quality: 90, chromaSubsampling: '4:4:4' }).toFile(out);
const m = await sharp(out).stats();
console.log('paper →', out, 'mean RGB', m.channels.slice(0, 3).map(c => c.mean.toFixed(0)).join(','));
