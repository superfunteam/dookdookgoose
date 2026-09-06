import {chromium, expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const url = process.env.GAME_URL || 'http://localhost:5174/';
await mkdir('output/qa', {recursive: true});
const browser = await chromium.launch({channel: 'chrome', headless: true});
try {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await expect(page.locator('[data-action="start"]')).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker.controller, null, {timeout: 30000});
  const cache = await page.evaluate(async () => {
    const name = (await caches.keys()).find(key => key.startsWith('dook-offline-'));
    const requests = await (await caches.open(name)).keys();
    return {name, files: requests.map(request => new URL(request.url).pathname)};
  });
  expect(cache.files).toContain('/index.html');
  expect(cache.files).toContain('/art/character-reference.png');
  expect(cache.files).not.toContain('/art/movement-reference.png');
  const manifestResponse = await context.request.get(new URL('/manifest.webmanifest', url).href);
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest.name).toBe('Dook, Dook, Goose!');
  expect(manifest.display).toBe('standalone');
  expect(manifest.orientation).toBe('portrait');
  for (const icon of [...manifest.icons, {src: '/apple-touch-icon.png', sizes: '180x180'}]) {
    const response = await context.request.get(new URL(icon.src, url).href);
    expect(response.ok()).toBe(true);
    const png = await response.body();
    expect(png.subarray(1,4).toString()).toBe('PNG');
    expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe(icon.sizes);
    expect(cache.files).toContain(icon.src);
  }
  const og = await context.request.get(new URL('/social/og-image.jpg', url).href);
  expect(og.ok()).toBe(true);
  expect(og.headers()['content-type']).toContain('image/jpeg');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://dookdookgoose.superfun.games/');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://dookdookgoose.superfun.games/social/og-image.jpg');
  for (const width of [320, 375, 390, 768, 1440]) {
    await page.setViewportSize({width, height: width === 1440 ? 1000 : 844});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const controls = await page.locator('.header-right button').evaluateAll(buttons => buttons.map(button => {
      const rect = button.getBoundingClientRect(); return {left: rect.left, right: rect.right, width: rect.width};
    }));
    for (const control of controls) { expect(control.left).toBeGreaterThanOrEqual(0); expect(control.right).toBeLessThanOrEqual(width); expect(control.width).toBeGreaterThanOrEqual(29); }
    if ([390,1440].includes(width)) await page.screenshot({path: `output/qa/branding-title-${width}.png`});
  }
  await page.setViewportSize({width: 390, height: 844});
  await context.setOffline(true);
  await page.goto(new URL('/?source=homescreen', url).href);
  await expect(page.locator('[data-action="start"]')).toBeVisible();
  await page.locator('[data-action="start"]').click();
  await page.locator('#player-name').fill('Offline');
  await page.locator('button[type="submit"]').click();
  await page.locator('[data-action="skip-story"]').click();
  await page.locator('[data-action="run"]').click();
  await page.waitForFunction(() => window.__dook.snapshot().distance > 5);
  expect(await page.evaluate(() => window.__dook.snapshot().rigBones)).toBe(30);
  await page.locator('[data-action="pause"]').click();
  await page.screenshot({path: 'output/qa/offline-play.png'});
  await page.goto(new URL('/character-lab.html?compare=1&expression=happy', url).href);
  await expect(page.locator('#stats')).toContainText('30 BONES');
  expect(await page.locator('canvas').count()).toBe(1);
  expect(errors).toEqual([]);
  console.log('Production icons, metadata, responsive controls, service worker, offline launch/gameplay/lab PASS.', cache);
  await context.close();
} finally { await browser.close(); }
