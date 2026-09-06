import {readFile, writeFile, rename, open, unlink, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadEnv} from 'vite';
import {DIALOGUE_LINES} from '../src/dialogue.js';

const hash = value => createHash('sha256').update(value).digest('hex');
export function dialogueWords(text) {
  return text.toLowerCase().normalize('NFKC').replace(/[’‘]/g, "'")
    .replace(/\b(i'm|it's|that's|they're|they've|can't|don't)\b/g, word => ({"i'm": 'i am', "it's": 'it is', "that's": 'that is', "they're": 'they are', "they've": 'they have', "can't": 'can not', "don't": 'do not'}[word]))
    .replace(/\bcannot\b/g, 'can not').replace(/\bhomosapiens\b/g, 'homo sapiens').replace(/\b3\b/g, 'three')
    .replace(/'/g, '').match(/[a-z0-9]+/g) || [];
}
export function compareDialogue(expectedText, transcript, spokenText = '') {
  const expected = dialogueWords(expectedText), recognized = dialogueWords(transcript);
  const same = (a, b) => a === b || (a === 'dook' && ['duke', 'duck'].includes(b));
  const rows = Array.from({length: expected.length + 1}, () => Array(recognized.length + 1).fill(0));
  for (let i = 0; i <= expected.length; i++) rows[i][0] = i;
  for (let j = 0; j <= recognized.length; j++) rows[0][j] = j;
  for (let i = 1; i <= expected.length; i++) for (let j = 1; j <= recognized.length; j++) rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (same(expected[i - 1], recognized[j - 1]) ? 0 : 1));
  const edits = [], tolerated = [];
  let i = expected.length, j = recognized.length;
  while (i || j) {
    if (i && j && rows[i][j] === rows[i - 1][j - 1] + (same(expected[i - 1], recognized[j - 1]) ? 0 : 1)) {
      if (!same(expected[i - 1], recognized[j - 1])) edits.push({type: 'substitution', expected: expected[i - 1], recognized: recognized[j - 1], expectedIndex: i - 1});
      else if (expected[i - 1] !== recognized[j - 1]) tolerated.push({expected: expected[i - 1], recognized: recognized[j - 1], reason: 'Ferret call may be transcribed phonetically.'});
      i--; j--;
    } else if (i && rows[i][j] === rows[i - 1][j] + 1) { edits.push({type: 'missing', expected: expected[--i], expectedIndex: i}); }
    else { edits.push({type: 'extra', recognized: recognized[--j], recognizedIndex: j}); }
  }
  edits.reverse(); tolerated.reverse();
  const direction = spokenText.match(/^\[([^\]]+)\]/)?.[1];
  const directionWords = direction ? dialogueWords(direction).join(' ') : '';
  const spokenDirection = !!directionWords && (` ${recognized.join(' ')} `).includes(` ${directionWords} `) && !(` ${expected.join(' ')} `).includes(` ${directionWords} `);
  const flags = [];
  if (edits.some(edit => edit.type === 'missing')) flags.push('possible-missing-words');
  if (edits.some(edit => edit.type === 'extra')) flags.push('possible-added-or-repeated-words');
  if (edits.some(edit => edit.type === 'substitution')) flags.push('possible-word-substitutions');
  if (spokenDirection) flags.push('possibly-spoken-direction-tag');
  if (!recognized.length) flags.push('empty-transcript');
  return {expectedWords: expected, recognizedWords: recognized, wordErrorRate: rows[expected.length][recognized.length] / Math.max(expected.length, 1), edits, tolerated, flags};
}

async function main() {
  const offline = process.argv.includes('--check');
  const selected = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
  if (selected.some(id => !DIALOGUE_LINES.some(line => line.id === id))) throw new Error('Unknown dialogue ID.');
  const lines = DIALOGUE_LINES.filter(line => !selected.length || selected.includes(line.id));
  await mkdir('assets/dialogue', {recursive: true});
  const lockPath = 'assets/dialogue/.qa.lock';
  const lock = await open(lockPath, 'wx').catch(() => { throw new Error('Dialogue QA already running, or an interrupted run left assets/dialogue/.qa.lock. Review before restarting.'); });
  try {
    const key = offline ? null : process.env.ELEVENLABS_API_KEY || loadEnv('production', process.cwd(), '').ELEVENLABS_API_KEY;
    if (!offline && !key) throw new Error('Set ELEVENLABS_API_KEY in ignored .env.local.');
    const qaPath = 'assets/dialogue/qa.json';
    const qa = JSON.parse(await readFile(qaPath, 'utf8').catch(() => 'null')) || {version: 1, method: 'ElevenLabs Scribe v2 transcription of final rendered MP3s; normalized word alignment.', limitation: 'Automated recognition can flag or miss errors. This is not a human listening or accent/performance review.', lines: {}};
    const save = async () => { qa.updatedAt = new Date().toISOString(); await writeFile(`${qaPath}.tmp`, JSON.stringify(qa, null, 2) + '\n'); await rename(`${qaPath}.tmp`, qaPath); };
    for (const line of lines) {
      const records = JSON.parse(await readFile('assets/dialogue/generation.json', 'utf8'));
      const record = records[line.id], path = `public/audio/dialogue/${line.id}.mp3`;
      if (!record?.prepared) { console.log('Not prepared yet:', line.id); continue; }
      const audio = await readFile(path), audioHash = hash(audio), textHash = hash(line.text);
      if (record.textHash !== textHash || record.prepared.bytes !== audio.length) throw new Error(`${line.id}: generated record and final file do not match.`);
      const previous = qa.lines[line.id];
      if (previous?.audioHash === audioHash && previous?.textHash === textHash) {
        if (previous.status !== 'complete') throw new Error(`${line.id}: a prior transcription did not finish. Review the recorded attempt before explicitly retrying.`);
        previous.analysis = compareDialogue(line.text, previous.transcript, record.spokenText); if (!offline) await save();
        console.log('Cached QA:', line.id, previous.analysis.flags.length ? previous.analysis.flags.join(', ') : 'words match'); continue;
      }
      if (offline) throw new Error(`${line.id}: no current saved transcription; run the authoring QA explicitly.`);
      qa.lines[line.id] = {id: line.id, status: 'pending', audioPath: path, audioHash, textHash, expected: line.text, model: 'scribe_v2', requestedAt: new Date().toISOString()};
      await save();
      // No reference text or keyterms are supplied: recognition should independently check the audio.
      // https://elevenlabs.io/docs/api-reference/speech-to-text/convert
      const form = new FormData(); form.append('file', new Blob([audio], {type: 'audio/mpeg'}), `${line.id}.mp3`);
      for (const [name, value] of Object.entries({model_id: 'scribe_v2', language_code: 'en', tag_audio_events: 'false', diarize: 'false', timestamps_granularity: 'word', no_verbatim: 'false', temperature: '0'})) form.append(name, value);
      console.log('Transcribing final clip:', line.id);
      try {
        const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {method: 'POST', headers: {'xi-api-key': key}, body: form, signal: AbortSignal.timeout(120000)});
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).replaceAll(key, '[REDACTED]')}`);
        const result = await response.json();
        if (typeof result.text !== 'string') throw new Error('Missing transcript in response.');
        Object.assign(qa.lines[line.id], {status: 'complete', completedAt: new Date().toISOString(), requestId: response.headers.get('request-id'), transcript: result.text,
          languageCode: result.language_code, languageProbability: result.language_probability,
          words: (result.words || []).filter(word => word.type === 'word').map(({text, start, end, logprob}) => ({text, start, end, logprob})),
          analysis: compareDialogue(line.text, result.text, record.spokenText)});
        await save(); console.log('QA:', line.id, qa.lines[line.id].analysis.flags.length ? qa.lines[line.id].analysis.flags.join(', ') : 'words match');
      } catch (error) {
        qa.lines[line.id].status = 'incomplete'; qa.lines[line.id].error = String(error.message).replaceAll(key, '[REDACTED]'); await save(); throw new Error(`${line.id}: ${qa.lines[line.id].error}`);
      }
    }
    const reviewed = lines.map(line => qa.lines[line.id]).filter(line => line?.status === 'complete');
    console.log(JSON.stringify({reviewed: reviewed.length, total: lines.length, flagged: reviewed.filter(line => line.analysis.flags.length).map(line => ({id: line.id, transcript: line.transcript, edits: line.analysis.edits, flags: line.analysis.flags}))}, null, 2));
  } finally { await lock.close(); await unlink(lockPath); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
