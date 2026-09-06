import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir, stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {LEVELS, ENDING} from '../src/data.js';
import {DIALOGUE_LINES, dialogueClip} from '../src/dialogue.js';
import {compareDialogue} from '../scripts/qa-dialogue.mjs';

const root = new URL('../', import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const scenes = LEVELS.flatMap(level => [
  {id: `${level.id}-intro`, lines: level.dialogues},
  ...(level.exit ? [{id: `${level.id}-exit`, lines: level.exit}] : []),
]).concat({id: 'ending', lines: ENDING});
const cast = {'PIP THE FERRET': 'ferret', 'GOOSE MICHAEL': 'goose', 'EXHIBIT SIGN': 'announcer'};

test('every story subtitle has one stable voiced line and the correct character', () => {
  const expected = scenes.flatMap(scene => scene.lines.map(([speaker, text], index) => {
    const id = `${scene.id}-${String(index + 1).padStart(2, '0')}`;
    assert.equal(dialogueClip(scene.lines, index), id);
    assert.ok(cast[speaker], `Uncast speaker: ${speaker}`);
    assert.doesNotMatch(text, /\bPip\b/i, 'Spoken dialogue must work for any player name.');
    return {id, speaker, text, character: cast[speaker]};
  }));
  assert.equal(expected.length, 23);
  assert.deepEqual(DIALOGUE_LINES, expected);
  assert.equal(new Set(DIALOGUE_LINES.map(line => line.id)).size, expected.length);
  for (const scene of scenes) assert.equal(dialogueClip(scene.lines, scene.lines.length), null);
  assert.equal(dialogueClip([], 0), null);
});

test('all baked speech matches current subtitles, casting records and real MP3 metadata', async () => {
  const records = await json('assets/dialogue/generation.json'), voices = await json('assets/dialogue/voices.json');
  const ids = DIALOGUE_LINES.map(line => line.id).sort();
  assert.deepEqual(Object.keys(records).sort(), ids);
  assert.deepEqual((await readdir(new URL('public/audio/dialogue/', root))).filter(name => name.endsWith('.mp3')).sort(), ids.map(id => `${id}.mp3`));
  assert.equal(new Set(Object.values(voices).map(voice => voice.voiceId)).size, 3);
  const audioHashes = new Set();
  for (const line of DIALOGUE_LINES) {
    const record = records[line.id], path = `public/audio/dialogue/${line.id}.mp3`;
    for (const field of ['id', 'speaker', 'text', 'character']) assert.equal(record[field], line[field], `${line.id}: ${field}`);
    assert.equal(record.textHash, sha256(line.text), `${line.id}: stale text hash`);
    assert.equal(record.voiceId, voices[line.character].voiceId, `${line.id}: wrong character voice`);
    assert.equal(record.model, 'eleven_v3');
    assert.match(record.spokenText, /^\[[a-z -]+\] /i, `${line.id}: missing performance direction`);
    assert.doesNotMatch(record.spokenText, /undefined|null/);
    assert.deepEqual(compareDialogue(line.text, record.spokenText.replace(/^\[[^\]]+\]\s*/, '')).edits, [], `${line.id}: spoken text differs from subtitle`);
    assert.equal(record.prepared.path, path);
    const bytes = await readFile(new URL(path, root));
    assert.equal(bytes.length, record.prepared.bytes, `${line.id}: stale output metadata`);
    assert.ok(bytes.length > 1000, `${line.id}: empty audio`);
    assert.equal((await stat(new URL(`assets/dialogue/masters/${line.id}.mp3`, root))).size, record.masterBytes);
    const info = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,sample_rate,channels:format=duration', '-of', 'json', fileURLToPath(new URL(path, root))], {encoding: 'utf8'}));
    assert.equal(info.streams[0].codec_name, 'mp3');
    assert.equal(info.streams[0].channels, 1);
    assert.equal(Number(info.streams[0].sample_rate), 44100);
    const duration = Number(info.format.duration);
    assert.ok(duration >= .5 && duration <= 25, `${line.id}: invalid spoken duration`);
    assert.ok(Math.abs(duration - record.prepared.duration) < .03, `${line.id}: wrong recorded duration`);
    assert.equal(record.prepared.targetLUFS, -18);
    assert.equal(record.prepared.truePeak, -2);
    audioHashes.add(sha256(bytes));
  }
  assert.equal(audioHashes.size, DIALOGUE_LINES.length, 'Different story lines must not reuse the same audio file.');
});

test('word QA detects omissions, repetitions and spoken directions while allowing punctuation and Dook transcription', () => {
  assert.deepEqual(compareDialogue('I’m coming. DOOK at the gates!', 'I am coming, duke at the gates.').edits, []);
  assert.ok(compareDialogue('I jumped out of a window.', 'I jumped out of a.').flags.includes('possible-missing-words'));
  assert.ok(compareDialogue('Behind bars.', 'Behind bars behind bars.').flags.includes('possible-added-or-repeated-words'));
  assert.ok(compareDialogue('At the zoo.', 'Matter of fact, at the zoo.', '[matter-of-fact] At the zoo.').flags.includes('possibly-spoken-direction-tag'));
  assert.ok(compareDialogue('Goose Michael.', '').flags.includes('empty-transcript'));
});

test('independent saved transcripts cover every current rendered clip and match its wording', async () => {
  const qa = await json('assets/dialogue/qa.json'), records = await json('assets/dialogue/generation.json');
  assert.deepEqual(Object.keys(qa.lines).sort(), DIALOGUE_LINES.map(line => line.id).sort());
  for (const line of DIALOGUE_LINES) {
    const result = qa.lines[line.id];
    assert.equal(result.status, 'complete', `${line.id}: no completed transcription`);
    assert.equal(result.model, 'scribe_v2');
    assert.equal(result.expected, line.text);
    assert.equal(result.textHash, sha256(line.text));
    assert.equal(result.audioPath, `public/audio/dialogue/${line.id}.mp3`);
    assert.equal(result.audioHash, sha256(await readFile(new URL(result.audioPath, root))), `${line.id}: QA belongs to another audio revision`);
    assert.ok(result.transcript.length > 0);
    const analysis = compareDialogue(line.text, result.transcript, records[line.id].spokenText);
    assert.deepEqual(analysis.flags, [], `${line.id}: review transcript differences: ${JSON.stringify(analysis.edits)}`);
    assert.deepEqual(result.analysis, analysis);
    assert.ok(result.words.length > 0);
    for (const word of result.words) assert.ok(Number.isFinite(word.start) && Number.isFinite(word.end) && word.start >= 0 && word.end >= word.start);
  }
});
