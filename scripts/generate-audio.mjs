import {readFile, writeFile, mkdir, stat} from 'node:fs/promises';
import {loadEnv} from 'vite';

// Authoring tool only. No credentials are included in game files or manifests.
const key = process.env.ELEVENLABS_API_KEY || loadEnv('production', process.cwd(), '').ELEVENLABS_API_KEY;
if (!key) throw new Error('Set ELEVENLABS_API_KEY in your ignored .env.local file.');
const plan = JSON.parse(await readFile('assets/audio/plan.json', 'utf8'));
const selected = process.argv.slice(2);
const assets = plan.assets.filter(asset => !selected.length || selected.includes(`${asset.kind}/${asset.name}`));
if (!assets.length) throw new Error('No audio assets match the selection.');
for (const asset of assets) {
  const music = asset.kind === 'music';
  if (asset.prompt.length > (music ? 4100 : 450)) throw new Error(`${asset.kind}/${asset.name}: prompt exceeds the provider's length limit.`);
  if (asset.duration < (music ? 3 : .5) || asset.duration > (music ? 600 : 30)) throw new Error(`${asset.kind}/${asset.name}: duration is outside the provider's supported range.`);
}
await mkdir('assets/audio/masters', {recursive: true});
const logPath = 'assets/audio/generation.json';
let records = {};
try { records = JSON.parse(await readFile(logPath, 'utf8')); } catch {}

for (const asset of assets) {
  const id = `${asset.kind}/${asset.name}`;
  const file = `assets/audio/masters/${asset.kind}-${asset.name}.mp3`;
  if (await stat(file).then(s => s.size > 1000).catch(() => false)) {
    console.log('Already generated:', id); continue;
  }
  const music = asset.kind === 'music';
  const endpoint = music ? 'music' : 'sound-generation';
  const body = music
    ? {prompt: asset.prompt, music_length_ms: Math.round(asset.duration * 1000), force_instrumental: true, model_id: plan.musicModel}
    : {text: asset.prompt, duration_seconds: asset.duration, loop: asset.loop, prompt_influence: .55, model_id: plan.soundModel};
  console.log('Generating:', id, `(${asset.duration}s)`);
  // No automatic retry: uncertain timeouts must not silently purchase duplicates.
  const response = await fetch(`https://api.elevenlabs.io/v1/${endpoint}?output_format=mp3_44100_128`, {
    method: 'POST', headers: {'xi-api-key': key, 'Content-Type': 'application/json'},
    body: JSON.stringify(body), signal: AbortSignal.timeout(240000)
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const detail = error.detail || error;
    throw new Error(`${id}: HTTP ${response.status} ${JSON.stringify(detail).replaceAll(key, '[REDACTED]')}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1000) throw new Error(`${id}: empty audio response`);
  await writeFile(file, bytes);
  records[id] = {file, bytes: bytes.length, model: music ? plan.musicModel : plan.soundModel,
    requestId: response.headers.get('request-id'), songId: response.headers.get('song-id'),
    characterCost: response.headers.get('character-cost'), generatedAt: new Date().toISOString()};
  await writeFile(logPath, JSON.stringify(records, null, 2) + '\n');
  console.log('Saved:', id, bytes.length, 'bytes');
}
