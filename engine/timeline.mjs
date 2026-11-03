// Turns ElevenLabs character timestamps into the thing every other part of
// the engine reads: a word list, tightened pauses, caption groups, and cue
// times resolved from word anchors.

const PUNCT = /[.,!?;:—–-]+$/;
export const normWord = w => w.toLowerCase().replace(/[^a-z0-9']/g, '');

/** chars + per-char times -> words with absolute start/end */
export function wordsFromAlignment(alignment, offset = 0) {
  const ch = alignment.characters;
  const st = alignment.character_start_times_seconds;
  const en = alignment.character_end_times_seconds;
  const words = [];
  let cur = null;
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i];
    if (/\s/.test(c)) { if (cur) { words.push(cur); cur = null; } continue; }
    if (!cur) cur = { text: '', start: st[i] + offset, end: en[i] + offset, charStart: i };
    cur.text += c;
    cur.end = en[i] + offset;
    cur.charEnd = i;
  }
  if (cur) words.push(cur);
  return words;
}

/**
 * Shortens the dead air between words so the delivery feels edited rather
 * than read. Returns the kept audio segments plus the remapped words.
 */
export function tighten(words, { maxGap = 0.17, sentenceGap = 0.26, lead = 0.06, tail = 0.35 } = {}) {
  if (!words.length) return { words, segments: [], duration: 0 };
  const segments = [];
  const out = [];
  let srcCursor = Math.max(0, words[0].start - lead);
  let dst = 0;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const prev = words[i - 1];
    if (prev) {
      const gap = w.start - prev.end;
      const allow = PUNCT.test(prev.text) ? sentenceGap : maxGap;
      if (gap > allow + 0.02) {
        // keep `allow` worth of silence, drop the rest
        const keepFrom = w.start - allow;
        segments.push({ src: [srcCursor, prev.end], dst });
        dst += prev.end - srcCursor;
        srcCursor = keepFrom;
      }
    }
    out.push({ ...w, start: dst + (w.start - srcCursor), end: dst + (w.end - srcCursor) });
  }
  const last = words[words.length - 1];
  segments.push({ src: [srcCursor, last.end + tail], dst });
  dst += last.end + tail - srcCursor;
  return { words: out, segments, duration: dst };
}

/**
 * Display tokens: spoken words with caption rewrites applied across the
 * whole stream ("COX two" → "COX-2", "Twenty oh six." → "2006."), so a term
 * can never be split between two caption groups.
 */
export function captionTokens(words, rewrites = [], emphasis = []) {
  const emph = new Set(emphasis.map(normWord));
  let text = '';
  const starts = [];
  words.forEach((w, i) => { starts.push(text.length); text += (i ? ' ' : '') + w.text; if (i) starts[i] += 1; });
  const wordAt = pos => { let lo = 0; for (let i = 0; i < starts.length; i++) if (starts[i] <= pos) lo = i; return lo; };
  const merges = [];
  for (const [pat, rep] of rewrites) {
    for (const m of text.matchAll(new RegExp(pat, 'g'))) {
      const a = wordAt(m.index), b = wordAt(m.index + m[0].length - 1);
      if (merges.some(x => !(b < x.a || a > x.b))) continue;
      merges.push({ a, b, rep });
    }
  }
  merges.sort((x, y) => x.a - y.a);
  const tokens = [];
  for (let i = 0; i < words.length; i++) {
    const m = merges.find(x => x.a === i);
    if (m) {
      const last = words[m.b];
      const trail = (/[.,!?;:]+$/.exec(last.text) || [''])[0];
      tokens.push({ text: m.rep + trail, start: words[m.a].start, end: last.end, emph: false });
      i = m.b;
    } else {
      tokens.push({ text: words[i].text, start: words[i].start, end: words[i].end, emph: emph.has(normWord(words[i].text)) });
    }
  }
  return tokens;
}

/** Groups display tokens into caption chunks that fit on screen and break on sense. */
export function captionGroups(tokens, { maxWords = 4, maxChars = 24 } = {}) {
  const groups = [];
  let cur = [];
  const flush = () => { if (cur.length) { groups.push({ tokens: cur, start: cur[0].start, end: cur[cur.length - 1].end }); cur = []; } };
  for (const w of tokens) {
    const chars = cur.reduce((n, x) => n + x.text.length + 1, 0) + w.text.length;
    if (cur.length && (cur.length >= maxWords || chars > maxChars)) flush();
    cur.push(w);
    if (/[.,!?;:—]$/.test(w.text)) flush();
  }
  flush();
  // a lonely short word reads badly on its own; fold it back
  for (let i = groups.length - 1; i > 0; i--) {
    const g = groups[i];
    if (g.tokens.length === 1 && g.tokens[0].text.length <= 4 && !/[.!?]$/.test(groups[i - 1].tokens.at(-1).text)) {
      groups[i - 1].tokens.push(...g.tokens);
      groups[i - 1].end = g.end;
      groups.splice(i, 1);
    }
  }
  return groups;
}

/**
 * Anchor syntax used throughout episode files:
 *   "@dwarfs"      first word matching `dwarfs`
 *   "@dwarfs#2"    second match
 *   "@dwarfs+0.4"  0.4 s after that word starts
 *   "@dwarfs>"     end of that word instead of its start
 *   "#12"          word index
 *   3.5            absolute seconds
 *   "end"          end of narration
 */
export function makeResolver(words, duration) {
  const index = new Map();
  words.forEach((w, i) => {
    const k = normWord(w.text);
    if (!k) return;
    if (!index.has(k)) index.set(k, []);
    index.get(k).push(i);
  });

  return function resolve(anchor, fallback = 0) {
    if (anchor == null) return fallback;
    if (typeof anchor === 'number') return anchor;
    const s = String(anchor).trim();
    if (s === 'end') return duration;
    if (s === 'start') return 0;
    if (/^#\d+$/.test(s)) return words[Math.min(+s.slice(1), words.length - 1)]?.start ?? fallback;
    const m = /^@([a-z0-9']+)(?:#(\d+))?(>)?(?:([+-])([\d.]+))?$/i.exec(s);
    if (!m) throw new Error(`Bad anchor: ${anchor}`);
    const [, word, nth, useEnd, sign, delta] = m;
    const hits = index.get(normWord(word));
    if (!hits || !hits.length) throw new Error(`Anchor word not found in narration: "${word}"`);
    const w = words[hits[Math.min((nth ? +nth : 1) - 1, hits.length - 1)]];
    let t = useEnd ? w.end : w.start;
    if (sign) t += (sign === '-' ? -1 : 1) * parseFloat(delta);
    return Math.max(0, Math.min(duration, t));
  };
}

/** Builds the full timeline object the renderer consumes. */
export function buildTimeline(episode, blocks) {
  let words = [];
  let offset = 0;
  for (const b of blocks) {
    const bw = wordsFromAlignment(b.alignment, offset);
    const last = bw[bw.length - 1];
    words.push(...bw);
    offset = (last ? last.end : offset) + (episode.voice.blockGap ?? 0.18);
  }
  const tightCfg = episode.voice.tighten ?? {};
  const { words: tw, segments, duration } = tighten(words, tightCfg);
  const resolve = makeResolver(tw, duration);

  const shots = episode.shots.map((s, i) => ({ ...s, start: resolve(s.at, 0) }));
  shots.forEach((s, i) => { s.end = i + 1 < shots.length ? shots[i + 1].start : duration; });

  const cues = (episode.cues ?? []).map(c => ({ ...c, t: resolve(c.at) }));
  const points = (episode.points ?? []).map(p => ({
    ...p, start: resolve(p.at), end: resolve(p.until ?? null, resolve(p.at) + (p.hold ?? 1.1)),
  }));
  const tokens = captionTokens(tw, episode.captionRewrites ?? [], episode.emphasis ?? []);
  const fps = episode.fps ?? 30;

  // named anchored times scenes can sync their internal animation to
  const marks = {};
  for (const [name, anchor] of Object.entries(episode.marks ?? {})) marks[name] = resolve(anchor);
  // also expose every shot boundary as mark `shot:<id>`
  for (const s of shots) marks[`shot:${s.id}`] = s.start;

  return {
    meta: { ...episode.meta, duration, fps, width: episode.width ?? 1080, height: episode.height ?? 1920,
      frames: Math.ceil(duration * fps) },
    voice: episode.voice,
    words: tw,
    segments,
    duration,
    captions: captionGroups(tokens, episode.captions ?? {}),
    shots, cues, points, marks,
    papers: episode.papers ?? {},
  };
}
