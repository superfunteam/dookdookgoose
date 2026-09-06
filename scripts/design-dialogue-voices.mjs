import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {loadEnv} from 'vite';

const key = process.env.ELEVENLABS_API_KEY || loadEnv('production', process.cwd(), '').ELEVENLABS_API_KEY;
if (!key) throw new Error('Set ELEVENLABS_API_KEY in ignored .env.local.');
const cast = JSON.parse(await readFile('assets/dialogue/cast.json', 'utf8'));
const [action, character, selection = '0'] = process.argv.slice(2);
if (!['preview', 'save'].includes(action) || !cast[character]) throw new Error('Usage: node scripts/design-dialogue-voices.mjs preview|save ferret|goose|announcer [preview index]');
const actor = cast[character];
const dir = `assets/dialogue/previews/${character}`;
await mkdir(dir, {recursive: true});
const post = async (endpoint, body) => {
  const response = await fetch(`https://api.elevenlabs.io/v1/${endpoint}`, {
    method: 'POST', headers: {'xi-api-key': key, 'Content-Type': 'application/json'},
    body: JSON.stringify(body), signal: AbortSignal.timeout(240000)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).replaceAll(key, '[REDACTED]')}`);
  return response.json();
};
if (action === 'preview') {
  // No automatic retries or overwrites of paid generation results.
  const existing = await readFile(`${dir}/previews.json`, 'utf8').catch(() => null);
  if (existing) throw new Error('Previews already exist. Review the saved files before making a new generation.');
  const result = await post('text-to-voice/design', {
    voice_description: actor.description, text: actor.preview,
    model_id: 'eleven_ttv_v3', seed: actor.seed, loudness: .5, guidance_scale: 5
  });
  const previews = [];
  for (const [index, preview] of result.previews.entries()) {
    const path = `${dir}/${index}.mp3`;
    await writeFile(path, Buffer.from(preview.audio_base_64, 'base64'));
    previews.push({index, path, generatedVoiceId: preview.generated_voice_id, duration: preview.duration_secs});
  }
  await writeFile(`${dir}/previews.json`, JSON.stringify({text: result.text, previews}, null, 2) + '\n');
  console.log(character, previews.map(({index, path, duration}) => ({index, path, duration})));
} else {
  const path = 'assets/dialogue/voices.json';
  const voices = JSON.parse(await readFile(path, 'utf8').catch(() => '{}'));
  if (voices[character]) throw new Error('This character already has a saved voice.');
  const {previews} = JSON.parse(await readFile(`${dir}/previews.json`, 'utf8'));
  const preview = previews[Number(selection)];
  if (!preview) throw new Error('Invalid preview selection.');
  const result = await post('text-to-voice', {
    voice_name: actor.name, voice_description: actor.description, generated_voice_id: preview.generatedVoiceId,
    labels: {language: 'en', accent: 'british', use_case: 'characters'}
  });
  voices[character] = {voiceId: result.voice_id, name: actor.name, previewIndex: preview.index, model: 'eleven_ttv_v3'};
  await writeFile(path, JSON.stringify(voices, null, 2) + '\n');
  console.log('Saved original character voice:', character);
}
