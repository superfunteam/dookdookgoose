import {chromium, expect} from '@playwright/test';
import {startRunnerBot} from './runner-bot.mjs';

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
  await expect.poll(() => page.evaluate(() => window.__dook.audio().played.message || 0)).toBeGreaterThan(0);
  await page.locator('[data-action="next-story"]').click();
  await expect.poll(() => page.evaluate(() => window.__dook.audio().played.dook || 0)).toBeGreaterThan(0);
  await page.locator('[data-action="skip-story"]').click();
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
    await page.waitForFunction(() => ['result', 'failed'].includes(window.__dook.snapshot().mode), null, {timeout: 75000});
    expect(await page.evaluate(() => window.__dook.snapshot().mode)).toBe('result');
    await expect.poll(() => page.evaluate(() => window.__dook.audio().playingMusic)).toBe('story');
    const audio = await page.evaluate(() => window.__dook.audio());
    expect(audio.errors).toEqual([]);
    expect(audio.decoded.music).toBeLessThanOrEqual(2);
    expect(audio.decoded.ambience).toBeLessThanOrEqual(1);
    console.log('Audio chapter:', score, {played: audio.played, decodedMiB: Math.round(audio.decoded.bytes / 1024 / 1024)});
    await page.locator('[data-action="continue"]').click();
    if (chapter < 2) {
      await page.locator('[data-action="skip-story"]').click();
      await page.locator('[data-action="skip-story"]').click();
      await page.locator('[data-action="run"]').click();
    }
  }
  await expect.poll(() => page.evaluate(() => window.__dook.audio().playingMusic)).toBe('ending');
  await page.locator('[data-action="next-story"]').click();
  await expect.poll(() => page.evaluate(() => window.__dook.audio().played.goose || 0)).toBeGreaterThan(0);
  const audio = await page.evaluate(() => window.__dook.audio());
  for (const effect of ['ready', 'message', 'dook', 'goose', 'coin', 'jump', 'slide', 'bounce', 'gate', 'window', 'win', 'land', 'paws']) expect(audio.played[effect] || 0, effect).toBeGreaterThan(0);
  expect(errors).toEqual([]);
  console.log('Full generated-audio campaign PASS: title/story/three chapters/ending, mechanic effects, pause/resume and bounded decoded memory.');
} finally { await browser.close(); }
