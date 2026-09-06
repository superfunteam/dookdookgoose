import {readFile, writeFile, mkdir, stat, open, unlink} from 'node:fs/promises';
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {loadEnv} from 'vite';
import {DIALOGUE_LINES} from '../src/dialogue.js';

// Offline authoring only. The deployed game loads baked MP3s, never this script or key.
const prepareOnly = process.argv.includes('--prepare');
const selected = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const lines = DIALOGUE_LINES.filter(line => !selected.length || selected.includes(line.id));
if (!lines.length) throw new Error('No matching dialogue IDs.');
const key = prepareOnly ? null : process.env.ELEVENLABS_API_KEY || loadEnv('production', process.cwd(), '').ELEVENLABS_API_KEY;
if (!prepareOnly && !key) throw new Error('Set ELEVENLABS_API_KEY in ignored .env.local.');
const voices = JSON.parse(await readFile('assets/dialogue/voices.json', 'utf8'));
const lockPath = 'assets/dialogue/.generate.lock';
const lock = await open(lockPath, 'wx').catch(() => { throw new Error('Dialogue generation is already running, or an interrupted run left .generate.lock. Review before restarting.'); });
try {
const recordPath = 'assets/dialogue/generation.json';
const records = JSON.parse(await readFile(recordPath, 'utf8').catch(() => '{}'));
const directions = {
  'house-intro-01': '[matter-of-fact]', 'house-intro-02': '[alarmed]', 'house-intro-03': '[excited]',
  'house-exit-01': '[proud]', 'house-exit-02': '[casual]', 'house-exit-03': '[whispers]',
  'woods-intro-01': '[confident]', 'woods-intro-02': '[matter-of-fact]', 'woods-intro-03': '[determined]',
  'woods-exit-01': '[exhausted]', 'woods-exit-02': '[curious]', 'woods-exit-03': '[confused]',
  'zoo-intro-01': '[confused]', 'zoo-intro-02': '[formal]', 'zoo-intro-03': '[determined]',
  'ending-01': '[shouts]', 'ending-02': '[warmly]', 'ending-03': '[confused]', 'ending-04': '[matter-of-fact]',
  'ending-05': '[incredulous]', 'ending-06': '[casual]', 'ending-07': '[curious]', 'ending-08': '[playful]'
};
await mkdir('assets/dialogue/masters', {recursive: true});
await mkdir('public/audio/dialogue', {recursive: true});
const ffmpeg = args => execFileSync('ffmpeg', ['-hide_banner', '-nostdin', ...args], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
const duration = path => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', path], {encoding: 'utf8'}).trim());
for (const line of lines) {
  const source = `assets/dialogue/masters/${line.id}.mp3`;
  const output = `public/audio/dialogue/${line.id}.mp3`;
  const textHash = createHash('sha256').update(line.text).digest('hex');
  const exists = await stat(source).then(s => s.size > 1000).catch(() => false);
  if (exists && records[line.id]?.textHash !== textHash) throw new Error(`${line.id}: subtitle changed. Review and explicitly replace the old master before regenerating.`);
  if (!exists) {
    if (prepareOnly) throw new Error(`${line.id}: missing master.`);
    const actor = voices[line.character];
    const spokenText = `${directions[line.id]} ${line.text.replace('HOMO SAPIENS ·', 'Homo sapiens.').replaceAll('DOOK', 'Dook').replaceAll('GOOSE MICHAEL', 'Goose Michael')}`;
    console.log('Voicing:', line.id, line.character);
    // No automatic retries: an uncertain response must not purchase duplicate takes.
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${actor.voiceId}?output_format=mp3_44100_128`, {
      method: 'POST', headers: {'xi-api-key': key, 'Content-Type': 'application/json'},
      body: JSON.stringify({text: spokenText, model_id: 'eleven_v3', language_code: 'en',
        voice_settings: {stability: .5, similarity_boost: .8, speed: line.character === 'ferret' ? 1.04 : 1},
        seed: 9400 + DIALOGUE_LINES.indexOf(line)}), signal: AbortSignal.timeout(240000)
    });
    if (!response.ok) throw new Error(`${line.id}: HTTP ${response.status} ${(await response.text()).replaceAll(key, '[REDACTED]')}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 1000) throw new Error(`${line.id}: empty audio response.`);
    await writeFile(source, bytes);
    records[line.id] = {...line, spokenText, textHash, model: 'eleven_v3', voiceId: actor.voiceId,
      requestId: response.headers.get('request-id'), characterCost: response.headers.get('character-cost'),
      generatedAt: new Date().toISOString(), masterBytes: bytes.length};
    await writeFile(recordPath, JSON.stringify(records, null, 2) + '\n');
  }
  // Keep deliberate performance pauses. Only trim silence at the outer edges.
  const trim = 'silenceremove=start_periods=1:start_duration=0.02:start_threshold=-48dB:start_silence=0.04,areverse,silenceremove=start_periods=1:start_duration=0.02:start_threshold=-48dB:start_silence=0.14,areverse';
  // loudnorm writes its measurements to stderr even on successful runs.
  const measure = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', '-i', source, '-af', `${trim},loudnorm=I=-18:TP=-2:LRA=9:print_format=json`, '-f', 'null', '-'], {encoding: 'utf8'});
  if (measure.status !== 0) throw new Error(`Cannot measure ${line.id}: ${measure.stderr}`);
  const measured = JSON.parse(measure.stderr.match(/\{[\s\S]*?\}/g).at(-1));
  const normalize = `loudnorm=I=-18:TP=-2:LRA=9:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true`;
  ffmpeg(['-loglevel', 'error', '-y', '-i', source, '-af', `${trim},${normalize},afade=t=in:d=0.005`, '-ac', '1', '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', '96k', '-map_metadata', '-1', output]);
  const seconds = duration(output);
  if (seconds < .5 || seconds > 25) throw new Error(`${line.id}: unexpected duration ${seconds}s.`);
  records[line.id].prepared = {path: output, duration: seconds, bytes: (await stat(output)).size, targetLUFS: -18, truePeak: -2};
  await writeFile(recordPath, JSON.stringify(records, null, 2) + '\n');
  console.log('Prepared:', line.id, `${seconds.toFixed(2)}s`);
}

} finally { await lock.close(); await unlink(lockPath); }
