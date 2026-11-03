#!/usr/bin/env node
// wojackgenerator CLI
//   node engine/cli.mjs voice   <episode.json>   just synthesize + print timing
//   node engine/cli.mjs preview <episode.json>   contact sheet, no encode
//   node engine/cli.mjs build   <episode.json>   full video
//   node engine/cli.mjs frames  <episode.json> <t0> <t1>   PNGs for a time range
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { synthesize, quota } from './tts.mjs';
import { resolvePapers } from './pubmed.mjs';
import { buildTimeline } from './timeline.mjs';
import { buildAudio, writeSrt } from './audio.mjs';
import { renderFrames, encode, contact } from './render.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const CACHE = join(ROOT, 'cache');

async function prepare(episodePath) {
  const episode = JSON.parse(await readFile(episodePath, 'utf8'));
  const assets = JSON.parse(await readFile(join(ROOT, 'assets/manifest.json'), 'utf8'));
  console.log(`episode: ${episode.meta.title}`);

  try { const q = await quota(); console.log(`ElevenLabs: ${q.tier}, ${q.used}/${q.limit} chars used`); } catch (e) { console.warn('quota check skipped:', e.message); }

  console.log('narration…');
  const blocks = await synthesize(episode.script, episode.voice, join(CACHE, 'tts'));

  console.log('citations…');
  const papers = await resolvePapers(episode.papers ?? {}, join(CACHE, 'pubmed'));

  const timeline = buildTimeline({ ...episode, papers }, blocks);
  timeline.papers = papers;
  console.log(`timeline: ${timeline.duration.toFixed(2)}s, ${timeline.words.length} words, ${timeline.meta.frames} frames, ${timeline.captions.length} captions`);

  console.log('audio…');
  const audio = await buildAudio(timeline, blocks, join(CACHE, 'final.wav'));
  timeline.mouth = audio.mouth.states;

  return { episode, assets, timeline, blocks, audio };
}

const cmd = process.argv[2];
const episodePath = process.argv[3] || join(ROOT, 'episodes/nsaids-growth-plates.json');
const t = Date.now();

if (cmd === 'voice') {
  const { timeline } = await prepare(episodePath);
  for (const s of timeline.shots) console.log(`  ${s.id.padEnd(10)} ${s.start.toFixed(2)}–${s.end.toFixed(2)}s  (${s.kind})`);
  await writeFile(join(ROOT, 'dist', 'timeline.json'), JSON.stringify({ ...timeline, mouth: undefined }, null, 1));
  console.log('timeline written to dist/timeline.json');

} else if (cmd === 'preview') {
  const { assets, timeline } = await prepare(episodePath);
  await mkdir(join(ROOT, 'dist'), { recursive: true });
  // times: seconds, or m:<mark>[+/-offset] to look at a specific beat
  const times = process.argv.slice(4).map(a => {
    const m = /^m:([\w']+)([+-][\d.]+)?$/.exec(a);
    if (m) {
      const base = timeline.marks[m[1]];
      if (base == null) throw new Error(`unknown mark ${m[1]}`);
      return base + (m[2] ? parseFloat(m[2]) : 0);
    }
    return Number(a);
  }).filter(x => !isNaN(x));
  const T = times.length ? times : timeline.shots.map(s => s.start + Math.min(1.2, (s.end - s.start) / 2));
  const out = join(ROOT, 'dist', 'preview.jpg');
  await contact(timeline, assets, { times: T, out, cols: Math.min(5, T.length) });
  console.log('preview →', out, `(${T.length} frames)`);

} else if (cmd === 'frames') {
  const { assets, timeline } = await prepare(episodePath);
  const t0 = Number(process.argv[4] ?? 0), t1 = Number(process.argv[5] ?? timeline.duration);
  const dir = join(ROOT, 'dist', 'frames');
  await rm(dir, { recursive: true, force: true });
  const f0 = Math.round(t0 * timeline.meta.fps);
  // render just the slice by offsetting frame indices
  await renderFrames(timeline, assets, { workers: 4, frames: Math.round(t1 * timeline.meta.fps), outDir: dir,
    onProgress: (d, n) => process.stdout.write(`\r  frames ${d}/${n}`) });
  console.log('\nframes →', dir);

} else if (cmd === 'build') {
  const { assets, timeline, audio } = await prepare(episodePath);
  await mkdir(join(ROOT, 'dist'), { recursive: true });
  const dir = join(CACHE, 'frames');
  await rm(dir, { recursive: true, force: true });
  console.log(`rendering ${timeline.meta.frames} frames…`);
  await renderFrames(timeline, assets, { workers: 4, outDir: dir,
    onProgress: (d, n) => process.stdout.write(`\r  ${d}/${n} (${(d / n * 100).toFixed(0)}%)`) });
  console.log('\nencoding…');
  const out = join(ROOT, 'dist', `${timeline.meta.id}.mp4`);
  await encode(timeline, { framesDir: dir, audioWav: audio.wav, out });
  await writeSrt(timeline, join(ROOT, 'dist', `${timeline.meta.id}.srt`));
  console.log(`\n✓ ${out}  (${((Date.now() - t) / 1000).toFixed(0)}s)`);

} else {
  console.log('usage: cli.mjs <voice|preview|build|frames> <episode.json>');
  process.exit(1);
}
