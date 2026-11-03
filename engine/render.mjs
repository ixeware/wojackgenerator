// Drives the stage page in headless Chromium and captures frames in parallel,
// then muxes them with the soundtrack via ffmpeg.
import { chromium } from 'playwright';
import { mkdir, rm, readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { serve } from './server.mjs';
import { run } from './util.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

async function newPage(browser, base, timeline, assets) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('PAGE ERROR:', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('console.error:', m.text()); });
  await page.goto(`${base}/engine/stage/index.html`, { waitUntil: 'networkidle' });
  await page.evaluate(async ({ t, a }) => { await window.wg.setup(t, a); }, { t: timeline, a: assets });
  await page.waitForFunction(() => window.wg && window.wg.ready, null, { timeout: 30000 });
  return page;
}

export async function renderFrames(timeline, assets, { workers = 4, frames, outDir, onProgress, format = 'png' } = {}) {
  await mkdir(outDir, { recursive: true });
  const { server, port } = await serve(ROOT);
  const base = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu', '--force-color-profile=srgb', '--hide-scrollbars'] });
  const total = frames ?? timeline.meta.frames;
  let done = 0;

  try {
    const pages = [];
    for (let w = 0; w < workers; w++) pages.push(await newPage(browser, base, timeline, assets));
    const clip = { x: 0, y: 0, width: 1080, height: 1920 };

    // Lossless PNG straight from Chromium's compositor (CDP, fast zlib):
    // ~4x faster than Playwright's PNG and, unlike JPEG, adds no per-frame
    // block noise for the encoder to chase on the paper texture.
    const cdps = await Promise.all(pages.map(p => p.context().newCDPSession(p)));
    async function worker(wi) {
      const page = pages[wi];
      for (let i = wi; i < total; i += workers) {
        await page.evaluate(n => window.wg.frame(n), i);
        if (format === 'png') {
          const { data } = await cdps[wi].send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, clip: { ...clip, scale: 1 } });
          await writeFile(join(outDir, `f${String(i).padStart(6, '0')}.png`), Buffer.from(data, 'base64'));
          done++;
          if (onProgress && done % 25 === 0) onProgress(done, total);
          continue;
        }
        // JPEG q95: ~8× faster than PNG in Chromium, visually lossless before H.264
        const name = join(outDir, `f${String(i).padStart(6, '0')}.${format === 'png' ? 'png' : 'jpg'}`);
        await page.screenshot(format === 'png' ? { path: name, clip, animations: 'disabled' } : { path: name, clip, type: 'jpeg', quality: 95, animations: 'disabled' });
        done++;
        if (onProgress && done % 25 === 0) onProgress(done, total);
      }
    }
    await Promise.all(pages.map((_, wi) => worker(wi)));
    if (onProgress) onProgress(total, total);
  } finally {
    await browser.close();
    server.close();
  }
  return outDir;
}

export async function encode(timeline, { framesDir, audioWav, out, format = 'png' }) {
  const fps = timeline.meta.fps;
  await run('ffmpeg', ['-v', 'error', '-y',
    '-framerate', String(fps), '-i', join(framesDir, `f%06d.${format === 'png' ? 'png' : 'jpg'}`),
    '-i', audioWav,
    '-map', '0:v', '-map', '1:a',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k',
    '-shortest', '-movflags', '+faststart', out], { quiet: false });
  return out;
}

/** A few frames stitched into one contact sheet for quick review. */
export async function contact(timeline, assets, { times, out, cols = 3 }) {
  const { server, port } = await serve(ROOT);
  const base = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu', '--force-color-profile=srgb'] });
  const sharp = (await import('sharp')).default;
  try {
    const page = await newPage(browser, base, timeline, assets);
    const shots = [];
    for (const t of times) {
      const f = Math.round(t * timeline.meta.fps);
      await page.evaluate(n => window.wg.frame(n), f);
      shots.push(await page.screenshot({ clip: { x: 0, y: 0, width: 1080, height: 1920 } }));
    }
    const tw = 360, th = 640;
    const rows = Math.ceil(shots.length / cols);
    const tiles = await Promise.all(shots.map(async (b, i) => ({
      input: await sharp(b).resize(tw, th).png().toBuffer(),
      left: (i % cols) * (tw + 8) + 4, top: Math.floor(i / cols) * (th + 8) + 4,
    })));
    await sharp({ create: { width: cols * (tw + 8) + 4, height: rows * (th + 8) + 4, channels: 3, background: '#ddd' } })
      .composite(tiles).jpeg({ quality: 88 }).toFile(out);
  } finally { await browser.close(); server.close(); }
  return out;
}
