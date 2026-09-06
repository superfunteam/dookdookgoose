import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const baseURL = (process.env.GAME_URL || 'http://localhost:5173').replace(/\/+$/, '');
const source = await readFile(new URL('../src/audio.js', import.meta.url), 'utf8');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [], requests = new Map();
let missingHouseScore = false;
page.on('pageerror', error => errors.push(error.message));

// A real decodable PCM fixture isolates playback lifecycle from the generated mix.
// Its silent samples avoid playing test sounds through the user's speakers.
function silentWav(seconds = 3) {
  const rate = 16000, samples = rate * seconds, wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
  return wav;
}
await page.route('**/__audio-test.js', route => route.fulfill({ contentType: 'text/javascript', body: source }));
await page.route('**/__audio-test.html', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><button id="unlock">Unlock sound</button><script type="module">import {Sound} from './__audio-test.js'; window.audio = new Sound(); document.querySelector('button').onclick = () => audio.start();</script>` }));
await page.route('**/audio/**/*.mp3', async route => {
  const path = new URL(route.request().url()).pathname;
  requests.set(path, (requests.get(path) || 0) + 1);
  if (missingHouseScore && path.endsWith('/music/house.mp3')) return route.fulfill({ status: 404, body: '' });
  if (path.endsWith('/window.mp3')) return route.fulfill({ status: 404, body: '' });
  if (path.endsWith('/ready.mp3')) return route.fulfill({ contentType: 'audio/mpeg', body: 'corrupt fixture' });
  if (path.endsWith('/dialogue/missing-line.mp3')) return route.fulfill({ status: 404, body: '' });
  if (path.endsWith('/dialogue/slow-start.mp3')) await new Promise(resolve => setTimeout(resolve, 1400));
  if (path.endsWith('/dialogue/slow-cancel.mp3')) await new Promise(resolve => setTimeout(resolve, 250));
  if (path.endsWith('/dialogue/complete-line.mp3')) return route.fulfill({ contentType: 'audio/wav', body: silentWav(.3) });
  return route.fulfill({ contentType: 'audio/wav', body: silentWav() });
});

const snapshot = () => page.evaluate(() => audio.snapshot());
const playing = name => expect.poll(async () => (await snapshot()).playingMusic).toBe(name);
const tick = (mode, level) => page.evaluate(({mode, level}) => audio.tick(mode, level), {mode, level});

try {
  await page.goto(`${baseURL}/__audio-test.html`);
  await page.waitForFunction(() => !!window.audio);
  await page.bringToFront();
  expect((await snapshot()).context).toBe('locked');
  expect(requests.size).toBe(0);
  await page.locator('#unlock').click();
  await playing('title');
  await expect.poll(async () => (await snapshot()).decoded.sfx).toBe(16);
  expect((await snapshot()).errors.sort()).toEqual(['sfx/ready', 'sfx/window']);

  for (const [mode, level, expected] of [
    ['name', 'house', 'title'], ['chapters', 'house', 'title'], ['story', 'house', 'story'],
    ['briefing', 'house', 'story'], ['playing', 'house', 'house'], ['result', 'house', 'story'],
    ['playing', 'woods', 'woods'], ['playing', 'zoo', 'zoo'], ['failed', 'zoo', 'setback'],
    ['ending', 'zoo', 'ending'], ['credits', 'zoo', 'ending'],
  ]) {
    await tick(mode, level); await playing(expected);
    const status = await snapshot();
    expect(status.desiredMusic).toBe(expected);
    expect(status.decoded.music).toBeLessThanOrEqual(2);
    expect(status.decoded.ambience).toBeLessThanOrEqual(1);
  }
  const beforeRepeat = (await snapshot()).played['music/ending'];
  await page.evaluate(() => { for (let i = 0; i < 100; i++) audio.tick('credits', 'zoo'); });
  expect((await snapshot()).played['music/ending']).toBe(beforeRepeat);

  await tick('playing', 'woods'); await playing('woods');
  await page.evaluate(() => audio.effect('jump'));
  await tick('paused');
  await expect.poll(async () => (await snapshot()).context).toBe('suspended');
  const paused = await snapshot();
  await page.waitForTimeout(150);
  expect((await snapshot()).musicPosition).toBe(paused.musicPosition);
  expect((await snapshot()).activeEffects).toBe(0);
  expect(await page.evaluate(() => audio.effect('coin'))).toBe(false);
  await tick('playing', 'woods'); await playing('woods');
  expect((await snapshot()).played['music/woods']).toBe(paused.played['music/woods']);

  await page.evaluate(() => { audio.music = false; });
  expect((await snapshot()).playingMusic).toBe(null);
  expect((await snapshot()).context).toBe('running');
  expect((await snapshot()).loops.some(loop => loop.key === 'ambience/woods' && !loop.retiring)).toBe(true);
  expect(await page.evaluate(() => audio.effect('heart'))).toBe(true);
  await page.evaluate(() => { audio.music = true; }); await playing('woods');
  await page.evaluate(() => audio.voice('goose'));
  expect((await snapshot()).voiceCount).toBe(1);
  expect((await snapshot()).musicDucked).toBe(true);
  await page.evaluate(() => audio.cancelVoice());
  expect((await snapshot()).voiceCount).toBe(0);
  expect((await snapshot()).musicDucked).toBe(false);
  const spokenBefore = (await snapshot()).played.dook || 0;
  expect(await page.evaluate(async () => {
    const pending = audio.voice('dook'); audio.cancelVoice(); return pending;
  })).toBe(false);
  expect((await snapshot()).played.dook || 0).toBe(spokenBefore);
  const slideBefore = (await snapshot()).played.slide || 0;
  expect(await page.evaluate(async () => {
    const pending = audio.effect('slide'); audio.tick('paused'); audio.tick('playing', 'woods'); return pending;
  })).toBe(false);
  expect((await snapshot()).played.slide || 0).toBe(slideBefore);

  const coinsBefore = (await snapshot()).played.coin || 0;
  await page.evaluate(() => Promise.all(Array.from({length: 30}, () => audio.effect('coin'))));
  const burst = await snapshot();
  expect(burst.played.coin - coinsBefore).toBe(1);
  expect(burst.effectKinds.filter(kind => kind === 'coin').length).toBeLessThanOrEqual(2);
  expect(burst.dropped).toBeGreaterThanOrEqual(29);
  await page.evaluate(() => Promise.all(['click','message','roll','slide','dook','hit','bounce','gate','win','fail','land','paws'].map(kind => audio.effect(kind))));
  expect((await snapshot()).activeEffects).toBeLessThanOrEqual(8);

  await page.evaluate(() => { audio.enabled = false; });
  await expect.poll(async () => (await snapshot()).context).toBe('suspended');
  expect((await snapshot()).activeEffects).toBe(0);
  expect(await page.evaluate(() => audio.effect('click'))).toBe(false);
  await page.evaluate(() => { audio.enabled = true; }); await playing('woods');

  for (const event of ['hidden', 'blur']) {
    await page.evaluate(event => {
      if (event === 'hidden') { Object.defineProperty(document, 'hidden', {configurable: true, value: true}); document.dispatchEvent(new Event('visibilitychange')); }
      else window.dispatchEvent(new Event('blur'));
    }, event);
    await expect.poll(async () => (await snapshot()).context).toBe('suspended');
    expect((await snapshot()).foreground).toBe(false);
    expect(await page.evaluate(() => audio.effect('jump'))).toBe(false);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', {configurable: true, value: false}); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); });
    await playing('woods');
  }

  // Speech uses its own full-length source; advancing a line replaces both speech and reaction cues.
  expect(await page.evaluate(() => audio.dialogue('first-line', {nextId: 'second-line'}))).toBe(true);
  await expect.poll(async () => (await snapshot()).decoded.dialogue).toBe(2);
  expect((await snapshot()).speaking).toBe('first-line');
  expect((await snapshot()).dialogueDuration).toBe(3);
  expect((await snapshot()).voiceCount).toBe(1);
  expect((await snapshot()).musicDucked).toBe(true);
  expect((await snapshot()).ambienceDucked).toBe(true);
  expect((await snapshot()).played['dialogue/second-line']).toBeUndefined();
  expect(await page.evaluate(() => audio.dialogue('second-line', {nextId: 'third-line'}))).toBe(true);
  expect((await snapshot()).speaking).toBe('second-line');
  expect(requests.get('/audio/dialogue/second-line.mp3')).toBe(1);
  expect(await page.evaluate(async () => {
    const pending = audio.dialogue('third-line'); audio.cancelVoice(); return pending;
  })).toBe(false);
  expect((await snapshot()).played['dialogue/third-line']).toBeUndefined();
  expect((await snapshot()).pendingDialogue).toBe(null);
  expect((await snapshot()).ambienceDucked).toBe(false);

  await page.evaluate(() => { window.speechRequest = audio.dialogue('slow-cancel'); });
  expect((await snapshot()).pendingDialogue).toBe('slow-cancel');
  await page.evaluate(() => audio.cancelVoice());
  expect(await page.evaluate(() => window.speechRequest)).toBe(false);
  expect((await snapshot()).played['dialogue/slow-cancel']).toBeUndefined();
  // This download takes longer than an effect's stale-cue cutoff, but the line remains relevant.
  expect(await page.evaluate(() => audio.dialogue('slow-start'))).toBe(true);
  expect((await snapshot()).speaking).toBe('slow-start');
  expect((await snapshot()).dialogueDuration).toBe(3);
  expect(await page.evaluate(() => audio.dialogue('complete-line'))).toBe(true);
  await expect.poll(async () => (await snapshot()).speaking).toBe(null);
  expect((await snapshot()).musicDucked).toBe(false);
  expect((await snapshot()).ambienceDucked).toBe(false);

  for (let index = 0; index < 5; index++) {
    expect(await page.evaluate(index => audio.dialogue(`cache-line-${index}`, {nextId: `cache-line-${index + 1}`}), index)).toBe(true);
    expect((await snapshot()).decoded.dialogue).toBeLessThanOrEqual(3);
  }
  await page.evaluate(() => { audio.music = false; });
  expect(await page.evaluate(() => audio.dialogue('music-off-line'))).toBe(true);
  expect((await snapshot()).playingMusic).toBe(null);
  expect((await snapshot()).speaking).toBe('music-off-line');
  await page.evaluate(() => { audio.music = true; audio.cancelVoice(); }); await playing('woods');

  for (const event of ['mute', 'pause', 'hidden', 'blur']) {
    const id = `stop-${event}`;
    expect(await page.evaluate(id => audio.dialogue(id), id)).toBe(true);
    await page.evaluate(event => {
      if (event === 'mute') audio.enabled = false;
      if (event === 'pause') audio.tick('paused');
      if (event === 'hidden') { Object.defineProperty(document, 'hidden', {configurable: true, value: true}); document.dispatchEvent(new Event('visibilitychange')); }
      if (event === 'blur') window.dispatchEvent(new Event('blur'));
    }, event);
    await expect.poll(async () => (await snapshot()).context).toBe('suspended');
    expect((await snapshot()).speaking).toBe(null);
    expect((await snapshot()).pendingDialogue).toBe(null);
    expect((await snapshot()).voiceCount).toBe(0);
    expect((await snapshot()).ambienceDucked).toBe(false);
    expect(await page.evaluate(() => audio.dialogue('must-not-play'))).toBe(false);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', {configurable: true, value: false});
      document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus'));
      audio.enabled = true; audio.tick('playing', 'woods');
    });
    await playing('woods');
    expect((await snapshot()).speaking).toBe(null);
    expect((await snapshot()).played[`dialogue/${id}`]).toBe(1);
  }
  for (const event of ['mute', 'pause']) {
    expect(await page.evaluate(async event => {
      const pending = audio.dialogue(`race-${event}`);
      if (event === 'mute') { audio.enabled = false; audio.enabled = true; }
      else { audio.tick('paused'); audio.tick('playing', 'woods'); }
      return pending;
    }, event)).toBe(false);
    expect((await snapshot()).played[`dialogue/race-${event}`]).toBeUndefined();
  }
  expect(await page.evaluate(() => audio.dialogue('missing-line'))).toBe(false);
  expect(await page.evaluate(() => audio.dialogue('missing-line'))).toBe(false);
  expect((await snapshot()).errors).toContain('dialogue/missing-line');
  expect(requests.get('/audio/dialogue/missing-line.mp3')).toBe(1);
  const requestsBeforeInvalid = requests.size;
  expect(await page.evaluate(() => audio.dialogue('../private'))).toBe(false);
  expect(requests.size).toBe(requestsBeforeInvalid);

  expect(await page.evaluate(() => audio.effect('window'))).toBe(false);
  expect(await page.evaluate(() => audio.effect('ready'))).toBe(false);
  expect(await page.evaluate(() => audio.effect('not-a-real-effect'))).toBe(false);
  expect(requests.get('/audio/sfx/window.mp3')).toBe(1);
  expect(requests.get('/audio/sfx/ready.mp3')).toBe(1);
  missingHouseScore = true;
  await tick('playing', 'house');
  await expect.poll(async () => (await snapshot()).errors.includes('music/house')).toBe(true);
  await tick('playing', 'zoo'); await playing('zoo');
  const missingRequests = requests.get('/audio/music/house.mp3');
  await tick('playing', 'house');
  expect((await snapshot()).loops.filter(loop => loop.key.startsWith('music/') && !loop.retiring)).toHaveLength(0);
  expect(requests.get('/audio/music/house.mp3')).toBe(missingRequests);
  expect(await page.evaluate(() => {
    const value = audio.snapshot();
    return [value, value.played, value.errors, value.decoded, value.loops].every(Object.isFrozen);
  })).toBe(true);
  await page.evaluate(() => audio.dispose());
  await expect.poll(async () => (await snapshot()).context).toBe('closed');
  expect((await snapshot()).decoded.bytes).toBe(0);
  expect(errors).toEqual([]);
  console.log('Audio lifecycle passed: gesture unlock, all scenes, cache bounds, pause/background, toggles, full dialogue/prefetch/cancellation, ducking, cue limits, quiet failures, disposal.');
} finally { await context.close(); await browser.close(); }
