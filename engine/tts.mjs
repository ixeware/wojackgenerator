// ElevenLabs narration with character-level timestamps, cached on disk.
// The cache key covers text + voice + model + settings, so re-renders of an
// unchanged script never spend quota.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const API = 'https://api.elevenlabs.io/v1';

function apiKey() {
  const k = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY || process.env.XI_API_KEY;
  if (!k) throw new Error('Set ELEVENLABS_API_KEY (see README) — no key, no narration.');
  return k;
}

const exists = async p => { try { await stat(p); return true; } catch { return false; } };

export async function synthesize(blocks, voice, cacheDir) {
  await mkdir(cacheDir, { recursive: true });
  const out = [];
  for (const [i, block] of blocks.entries()) {
    const req = {
      text: block,
      model_id: voice.model,
      voice_settings: {
        stability: voice.stability ?? 0.42,
        similarity_boost: voice.similarity ?? 0.8,
        ...(voice.speed ? { speed: voice.speed } : {}),
      },
    };
    const key = createHash('sha256').update(JSON.stringify({ v: voice.id, ...req })).digest('hex').slice(0, 20);
    const mp3Path = join(cacheDir, `${key}.mp3`);
    const jsonPath = join(cacheDir, `${key}.json`);

    if (!(await exists(mp3Path)) || !(await exists(jsonPath))) {
      process.stdout.write(`  tts block ${i + 1}/${blocks.length} (${block.length} chars) … `);
      const res = await fetch(`${API}/text-to-speech/${voice.id}/with-timestamps?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'xi-api-key': apiKey(), 'content-type': 'application/json' },
        body: JSON.stringify(req),
      });
      if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 400)}`);
      const data = await res.json();
      await writeFile(mp3Path, Buffer.from(data.audio_base64, 'base64'));
      await writeFile(jsonPath, JSON.stringify({ alignment: data.alignment, normalized: data.normalized_alignment }));
      console.log('ok');
    } else {
      console.log(`  tts block ${i + 1}/${blocks.length} — cached`);
    }
    out.push({ mp3Path, alignment: JSON.parse(await readFile(jsonPath, 'utf8')).alignment, text: block });
  }
  return out;
}

export async function listVoices() {
  const res = await fetch(`${API}/voices`, { headers: { 'xi-api-key': apiKey() } });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);
  return (await res.json()).voices.map(v => ({ id: v.voice_id, name: v.name, labels: v.labels }));
}

export async function quota() {
  const res = await fetch(`${API}/user/subscription`, { headers: { 'xi-api-key': apiKey() } });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);
  const d = await res.json();
  return { tier: d.tier, used: d.character_count, limit: d.character_limit };
}
