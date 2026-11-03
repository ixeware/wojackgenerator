// Downloads every external asset listed in tools/sources.mjs into assets/_raw.
// Re-running is cheap: anything already on disk is skipped.
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { NLM_PILLS, WOJAK_BASE, pills, wojaks, figures, fonts } from './sources.mjs';

const RAW = new URL('../assets/_raw/', import.meta.url).pathname;

async function exists(p) { try { await stat(p); return true; } catch { return false; } }

const sleep = ms => new Promise(r => setTimeout(r, ms));

// data.lhncbc.nlm.nih.gov throttles bursts with a blanket 403, so every
// download backs off and the script reports misses instead of dying.
async function get(url, dest, { tries = 4 } = {}) {
  if (await exists(dest)) { console.log('  have', dest.split('/').pop()); return true; }
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'wojackgenerator/1.0 (asset fetch)' } });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        await writeFile(dest, buf);
        console.log('  got ', dest.split('/').pop(), (buf.length / 1024).toFixed(0) + 'kB');
        return true;
      }
      if (attempt === tries) { console.warn(`  MISS ${res.status} ${dest.split('/').pop()}`); missing.push(url); return false; }
    } catch (err) {
      if (attempt === tries) { console.warn('  MISS', err.message); missing.push(url); return false; }
    }
    await sleep(2000 * 2 ** (attempt - 1));
  }
  return false;
}
const missing = [];

const limit = (n, jobs) => {
  let i = 0;
  const run = async () => { while (i < jobs.length) await jobs[i++](); };
  return Promise.all(Array.from({ length: n }, run));
};

await mkdir(join(RAW, 'pills'), { recursive: true });
await mkdir(join(RAW, 'wojaks'), { recursive: true });
await mkdir(join(RAW, 'papers'), { recursive: true });
await mkdir(join(RAW, 'fonts'), { recursive: true });

console.log('pills (NLM C3PI, public domain)');
// C3PI filenames contain literal '!' — the server 403s on the %21 form.
await limit(6, pills.map(p => () =>
  get(NLM_PILLS + p.path, join(RAW, 'pills', `${p.id}.png`))));

console.log('wojaks (wojakland.com)');
await limit(6, wojaks.map(w => () =>
  get(WOJAK_BASE + w.file, join(RAW, 'wojaks', `${w.id}.png`))));

console.log('papers (open access)');
const papers = [...new Set(figures.map(f => f.from))];
await limit(2, papers.map(u => () =>
  get(u, join(RAW, 'papers', u.split('/').pop()))));

console.log('fonts (OFL)');
await limit(3, fonts.flatMap(f => [
  () => get(f.url, join(RAW, 'fonts', f.file)),
  () => get(f.license, join(RAW, 'fonts', `${f.id}-OFL.txt`)),
]));

if (missing.length) {
  console.log(`\n${missing.length} asset(s) could not be downloaded right now:`);
  for (const u of missing) console.log('  ' + u);
  console.log('Re-run later — downloads already on disk are skipped.');
  process.exitCode = 1;
} else {
  console.log('done -> assets/_raw');
}
