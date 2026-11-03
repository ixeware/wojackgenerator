// Debug helper: full-resolution screenshots at given times → scratch dir.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { serve } from '../engine/server.mjs';
import { synthesize } from '../engine/tts.mjs';
import { resolvePapers } from '../engine/pubmed.mjs';
import { buildTimeline } from '../engine/timeline.mjs';
import { buildAudio } from '../engine/audio.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const OUT = process.env.SHOOT_OUT || '/tmp/claude-0/-home-user-wojackgenerator/a3d682d0-3426-54d1-bf5e-55dfe8d1ced5/scratchpad/shots';
const times = process.argv.slice(2).map(Number);

const episode = JSON.parse(await readFile(join(ROOT, 'episodes/nsaids-growth-plates.json'), 'utf8'));
const assets = JSON.parse(await readFile(join(ROOT, 'assets/manifest.json'), 'utf8'));
const blocks = await synthesize(episode.script, episode.voice, join(ROOT, 'cache/tts'));
const papers = await resolvePapers(episode.papers ?? {}, join(ROOT, 'cache/pubmed'));
const timeline = buildTimeline({ ...episode, papers }, blocks);
timeline.papers = papers;
const audio = await buildAudio(timeline, blocks, join(ROOT, 'cache/final.wav'));
timeline.mouth = audio.mouth.states;

const { server, port } = await serve(ROOT);
const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu', '--force-color-profile=srgb'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.error('PAGE ERROR', e.message));
page.on('console', m => { if (m.type() === 'error') console.error('C.error', m.text()); });
await page.goto(`http://127.0.0.1:${port}/engine/stage/index.html`, { waitUntil: 'networkidle' });
await page.evaluate(async ({ t, a }) => window.wg.setup(t, a), { t: timeline, a: assets });
await page.waitForFunction(() => window.wg?.ready);
const fs = await import('node:fs/promises');
await fs.mkdir(OUT, { recursive: true });
for (const t of times) {
  const f = Math.round(t * timeline.meta.fps);
  await page.evaluate(n => window.wg.frame(n), f);
  const name = join(OUT, `t${t.toFixed(1)}.png`);
  await page.screenshot({ path: name, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
  console.log(name);
}
await browser.close();
server.close();
