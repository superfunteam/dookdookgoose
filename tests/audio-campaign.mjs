import {chromium, expect} from '@playwright/test';
import {startRunnerBot} from './runner-bot.mjs';
import {DIALOGUE_LINES} from '../src/dialogue.js';

const url = process.env.GAME_URL || 'http://localhost:5173/';
const browser = await chromium.launch({channel: 'chrome', headless: true});
try {
  const page = await browser.newPage({viewport: {width: 390, height: 844}});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  expect(await page.evaluate(() => window.__dook.audio().context)).toBe('locked');
  await page.locator('[data-action="start"]').click();
  await expect.poll(() => page.evaluate(() => window.__dook.audio().playingMusic)).toBe('title');
  await page.locator('#player-name').fill('Melody');
  await page.locator('#name-form button[type="submit"]').click();
  await expect.poll(() => page.evaluate(() => window.__dook.audio().playingMusic)).toBe('story');
  const readScene = async (scene, replay = false) => {
    const lines = DIALOGUE_LINES.filter(line => line.id.startsWith(scene + '-'));
    for (const [index, line] of lines.entries()) {
      await expect(page.locator('.dialogue-content > p')).toHaveText(line.text);
      await expect.poll(() => page.evaluate(id => window.__dook.audio().speaking === id, line.id)).toBe(true);
      const spoken = await page.evaluate(() => window.__dook.audio());
      expect(spoken.musicDucked).toBe(true);
      expect(spoken.dialogueDuration).toBeGreaterThan(1);
      expect(spoken.decoded.dialogue).toBeLessThanOrEqual(3);
      if (replay && index === 0) {
        await page.locator('[data-action="replay-story"]').click();
        await expect.poll(() => page.evaluate(id => window.__dook.audio().played['dialogue/' + id] || 0, line.id)).toBe(2);
        // Let one real generated line finish; completion restores the score.
        await expect.poll(() => page.evaluate(() => window.__dook.audio().speaking), {timeout: 15000}).toBe(null);
        expect(await page.evaluate(() => window.__dook.audio().musicDucked)).toBe(false);
      }
      await page.locator('[data-action="next-story"]').click();
    }
  };
  await readScene('house-intro', true);
  expect(await page.evaluate(() => window.__dook.audio().speaking)).toBe(null);
  await page.locator('[data-action="run"]').click();
  await expect.poll(() => page.evaluate(() => window.__dook.audio().playingMusic)).toBe('house');
  await page.locator('[data-action="pause"]').click();
  await expect.poll(() => page.evaluate(() => window.__dook.audio().context)).toBe('suspended');
  const position = await page.evaluate(() => window.__dook.audio().musicPosition);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__dook.audio().musicPosition)).toBe(position);
  await page.locator('[data-action="resume"]').click();
  await startRunnerBot(page);
  for (const [chapter, score] of ['house', 'woods', 'zoo'].entries()) {
    await expect.poll(() => page.evaluate(() => window.__dook.audio().playingMusic)).toBe(score);
    await page.waitForFunction(() => ['result', 'failed'].includes(window.__dook.snapshot().mode), null, {timeout: 120000});
    expect(await page.evaluate(() => window.__dook.snapshot().mode)).toBe('result');
    await expect.poll(() => page.evaluate(() => window.__dook.audio().playingMusic)).toBe('story');
    const audio = await page.evaluate(() => window.__dook.audio());
    expect(audio.errors).toEqual([]);
    expect(audio.decoded.music).toBeLessThanOrEqual(2);
    expect(audio.decoded.ambience).toBeLessThanOrEqual(1);
    console.log('Audio chapter:', score, {played: audio.played, decodedMiB: Math.round(audio.decoded.bytes / 1024 / 1024)});
    await page.locator('[data-action="continue"]').click();
    if (chapter < 2) {
      await readScene(score + '-exit');
      await readScene(['woods', 'zoo'][chapter] + '-intro');
      await page.locator('[data-action="run"]').click();
    }
  }
  await expect.poll(() => page.evaluate(() => window.__dook.audio().playingMusic)).toBe('ending');
  await readScene('ending');
  await expect(page.locator('.ending-screen')).toBeVisible();
  const audio = await page.evaluate(() => window.__dook.audio());
  for (const effect of ['ready', 'dook', 'coin', 'jump', 'slide', 'bounce', 'gate', 'window', 'win', 'land', 'paws']) expect(audio.played[effect] || 0, effect).toBeGreaterThan(0);
  for (const line of DIALOGUE_LINES) expect(audio.played['dialogue/' + line.id] || 0, line.id).toBeGreaterThan(0);
  expect(audio.speaking).toBe(null);
  expect(audio.errors).toEqual([]);
  expect(errors).toEqual([]);
  console.log('Full generated-audio campaign PASS: title/story/three chapters/ending, all 23 spoken lines, replay, mechanic effects, pause/resume and bounded decoded memory.');
} finally { await browser.close(); }
