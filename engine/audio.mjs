// Builds the final soundtrack: narration with tightened pauses, plus a small
// procedural sound kit (no sample licensing to worry about) mixed at cue times.
import { writeFile } from 'node:fs/promises';
import { run } from './util.mjs';

const SR = 48000;

async function decode(mp3) {
  const raw = await run('ffmpeg', ['-v', 'error', '-i', mp3, '-f', 'f32le', '-ac', '1', '-ar', String(SR), '-'], { capture: true });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
}

const idx = s => Math.max(0, Math.round(s * SR));

/** Pitch-preserving speed change of a mono float buffer via ffmpeg atempo. */
async function stretch(buf, tempo, duration) {
  const input = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  const raw = await run('ffmpeg', ['-v', 'error', '-f', 'f32le', '-ar', String(SR), '-ac', '1', '-i', 'pipe:0',
    '-af', `atempo=${tempo}`, '-f', 'f32le', '-ar', String(SR), '-ac', '1', 'pipe:1'], { input, capture: true });
  const out = new Float32Array(idx(duration) + SR);
  const got = new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 4));
  out.set(got.subarray(0, Math.min(got.length, out.length)));
  return out;
}

/** Cuts the kept segments out of the source and butt-joins them with short ramps. */
function applySegments(src, segments, duration) {
  const out = new Float32Array(idx(duration) + SR);
  const ramp = Math.round(0.006 * SR);
  for (const seg of segments) {
    const a = idx(seg.src[0]), b = Math.min(src.length, idx(seg.src[1]));
    const d = idx(seg.dst);
    for (let i = 0; i < b - a; i++) {
      let g = 1;
      if (i < ramp) g = i / ramp;
      else if (i > b - a - ramp) g = (b - a - i) / ramp;
      out[d + i] += src[a + i] * g;
    }
  }
  return out;
}

// --------------------------------------------------------------- sound kit
const rnd = (seed => () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)(7);

function mix(buf, at, sample, gain = 1) {
  const d = idx(at);
  for (let i = 0; i < sample.length && d + i < buf.length; i++) buf[d + i] += sample[i] * gain;
}

function env(n, attack, decay) {
  const e = new Float32Array(n);
  const a = Math.max(1, Math.round(attack * SR));
  for (let i = 0; i < n; i++) e[i] = i < a ? i / a : Math.exp(-(i - a) / (decay * SR));
  return e;
}

/** Airy noise sweep for scene changes. */
function whoosh(dur = 0.42, tone = 1) {
  const n = Math.round(dur * SR), out = new Float32Array(n), e = env(n, 0.12, 0.12);
  let lp = 0, bp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const f = (320 + 2600 * Math.sin(Math.PI * t) * tone) / SR;
    const w = rnd() * 2 - 1;
    lp += f * (w - lp); bp += f * (lp - bp);
    out[i] = (lp - bp) * e[i];
  }
  return out;
}

/** Short wooden click for chips, ticks, counters. */
function tick(freq = 1800, dur = 0.05) {
  const n = Math.round(dur * SR), out = new Float32Array(n), e = env(n, 0.001, 0.012);
  for (let i = 0; i < n; i++) out[i] = Math.sin(2 * Math.PI * freq * i / SR) * e[i] * 0.5 + (rnd() * 2 - 1) * e[i] * 0.2;
  return out;
}

/** Low body hit for the hook and the verdict. */
function thud(freq = 62, dur = 0.5) {
  const n = Math.round(dur * SR), out = new Float32Array(n), e = env(n, 0.002, 0.1);
  for (let i = 0; i < n; i++) {
    const f = freq * (1 + 1.6 * Math.exp(-i / (0.03 * SR)));
    out[i] = Math.sin(2 * Math.PI * f * i / SR) * e[i];
  }
  return out;
}

/** Two-note rise for the positive twist (flurbiprofen). */
function blip(f0 = 520, f1 = 880, dur = 0.26) {
  const n = Math.round(dur * SR), out = new Float32Array(n), e = env(n, 0.004, 0.07);
  for (let i = 0; i < n; i++) {
    const t = i / n, f = f0 + (f1 - f0) * t;
    out[i] = (Math.sin(2 * Math.PI * f * i / SR) * 0.7 + Math.sin(4 * Math.PI * f * i / SR) * 0.2) * e[i];
  }
  return out;
}

/** Descending tone for "down / impaired / blocked". */
function drop(f0 = 700, f1 = 180, dur = 0.34) {
  const n = Math.round(dur * SR), out = new Float32Array(n), e = env(n, 0.004, 0.09);
  for (let i = 0; i < n; i++) {
    const t = i / n, f = f0 + (f1 - f0) * t * t;
    out[i] = Math.sin(2 * Math.PI * f * i / SR) * e[i];
  }
  return out;
}

const KIT = { whoosh, tick, thud, blip, drop };
const GAIN = { whoosh: 0.09, tick: 0.1, thud: 0.3, blip: 0.1, drop: 0.12 };

export async function buildAudio(timeline, blocks, outWav) {
  // Place every block exactly where the timeline put its words.
  const parts = await Promise.all(blocks.map(b => decode(b.mp3Path)));
  const offs = timeline.blockOffsets ?? [0];
  const end = Math.max(...parts.map((p, i) => idx(offs[i] ?? 0) + p.length));
  const src = new Float32Array(end + SR);
  parts.forEach((p, i) => {
    const at = idx(offs[i] ?? 0);
    for (let j = 0; j < p.length; j++) src[at + j] += p[j];
  });

  let bed = applySegments(src, timeline.segments, timeline.sourceDuration ?? timeline.duration);
  if ((timeline.tempo ?? 1) !== 1) bed = await stretch(bed, timeline.tempo, timeline.duration);
  const mouth = lipSync(bed, timeline);

  // scene changes get a whoosh unless the shot opted out
  for (const s of timeline.shots.slice(1)) {
    if (s.sfx === false) continue;
    mix(bed, Math.max(0, s.start - 0.16), whoosh(0.4, s.sfxTone ?? 1), GAIN.whoosh);
  }
  for (const c of timeline.cues) {
    const make = KIT[c.sound];
    if (!make) continue;
    mix(bed, c.t + (c.delay ?? 0), make(...(c.args ?? [])), (c.gain ?? 1) * (GAIN[c.sound] ?? 0.1));
  }

  // headroom: narration peaks near 0 dBFS out of the box
  let peak = 0;
  for (let i = 0; i < bed.length; i++) peak = Math.max(peak, Math.abs(bed[i]));
  const norm = peak > 0 ? 0.89 / peak : 1;
  const pcm = Buffer.alloc(bed.length * 2);
  for (let i = 0; i < bed.length; i++) {
    const v = Math.max(-1, Math.min(1, bed[i] * norm));
    pcm.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  await run('ffmpeg', ['-v', 'error', '-y', '-f', 's16le', '-ar', String(SR), '-ac', '1', '-i', 'pipe:0',
    '-af', 'highpass=f=70,loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '48000', '-ac', '2', outWav], { input: pcm });
  return { wav: outWav, mouth };
}

/**
 * Per-frame mouth shapes from the narration only (SFX excluded):
 *   0 rest · 1 small · 2 wide · 3 round ("o", "u", "w")
 * Loudness picks open vs closed; the letter being spoken picks the shape.
 */
function lipSync(bed, timeline) {
  const fps = timeline.meta.fps;
  const n = timeline.meta.frames;
  const hop = SR / fps;
  const rms = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let s = 0, c = 0;
    for (let i = Math.floor(f * hop); i < Math.floor((f + 1) * hop) && i < bed.length; i++) { s += bed[i] * bed[i]; c++; }
    rms[f] = c ? Math.sqrt(s / c) : 0;
  }
  const voiced = [...rms].filter(v => v > 0.01).sort((a, b) => a - b);
  const q = p => voiced[Math.floor(p * (voiced.length - 1))] ?? 0.05;
  const lo = Math.max(0.012, q(0.18)), hi = q(0.72);

  const letterAt = t => {
    const w = timeline.words.find(x => x.start <= t && t < x.end);
    if (!w) return '';
    const letters = w.text.replace(/[^a-z]/gi, '');
    return letters[Math.min(letters.length - 1, Math.floor((t - w.start) / Math.max(0.01, w.end - w.start) * letters.length))]?.toLowerCase() ?? '';
  };

  const out = new Array(n).fill(0);
  for (let f = 0; f < n; f++) {
    const t = f / fps + 0.03;
    const a = rms[f];
    let s = 0;
    if (a > lo) {
      const ch = letterAt(t);
      if ('ouw'.includes(ch) && ch) s = 3;
      else if (a > hi || 'ae'.includes(ch) && a > (lo + hi) / 2) s = 2;
      else s = 1;
    }
    out[f] = s;
  }
  // hold each pose at least two frames so drawn mouths stay readable
  for (let f = 1; f < n - 1; f++) if (out[f] !== out[f - 1] && out[f + 1] === out[f - 1]) out[f] = out[f - 1];
  return { states: out, level: [...rms].map(v => Math.min(1, v / (hi || 0.1))) };
}

export async function writeSrt(timeline, file) {
  const lines = timeline.captions.map((g, i) => {
    const t = s => {
      const ms = Math.round(s * 1000);
      return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
    };
    const text = g.tokens.map(w => w.text).join(' ');
    return `${i + 1}\n${t(g.start)} --> ${t(Math.max(g.end, g.start + 0.4))}\n${text}`;
  });
  await writeFile(file, lines.join('\n\n') + '\n');
}
