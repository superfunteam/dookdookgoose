import {chromium, expect} from '@playwright/test';

const baseURL = (process.env.GAME_URL || 'http://localhost:5173').replace(/\/+$/, '');
const publicURL = 'https://dookdookgoose.superfun.games/';
const browser = await chromium.launch({channel: 'chrome', headless: true});
const errors = [];
const iphone = {
  viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
};

async function openPage({ios = false, standalone = false} = {}) {
  const context = await browser.newContext(ios ? iphone : {viewport: {width: 1280, height: 950}});
  await context.addInitScript(({standalone}) => {
    window.__shareCalls = []; window.__clipboardCalls = []; window.__promptCalls = 0;
    window.__shareMode = 'success'; window.__denyClipboard = false;
    // Never open an OS share sheet or a real install prompt during regression.
    Object.defineProperty(navigator, 'share', {configurable: true, value: async data => {
      window.__shareCalls.push(data);
      if (window.__shareMode === 'abort') throw new DOMException('Cancelled by fixture', 'AbortError');
    }});
    Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: async text => {
      window.__clipboardCalls.push(text);
      if (window.__denyClipboard) throw new DOMException('Denied by fixture', 'NotAllowedError');
    }}});
    Object.defineProperty(navigator, 'standalone', {configurable: true, value: standalone});
    window.addEventListener('beforeinstallprompt', event => {
      if (!event.__testPrompt) { event.preventDefault(); event.stopImmediatePropagation(); }
    });
  }, {standalone});
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${baseURL}/?player=DoNotShare#private`);
  await expect(page.locator('.title-screen')).toBeVisible();
  return {context, page};
}

try {
  const {context, page} = await openPage();
  try {
    const share = page.locator('.site-header [data-share-game]');
    const install = page.locator('.site-header [data-install-game]');
    await expect(share).toBeVisible(); await expect(install).toBeVisible();
    expect(await page.evaluate(() => [window.__shareCalls.length, window.__clipboardCalls.length, window.__promptCalls])).toEqual([0, 0, 0]);
    await page.evaluate(url => {
      const canonical = document.querySelector('link[rel="canonical"]');
      if (!canonical) throw new Error('Missing production canonical link');
      canonical.href = `${url}?player=DoNotShare#private`;
    }, publicURL);

    await share.click();
    await expect.poll(() => page.evaluate(() => window.__shareCalls.length)).toBe(1);
    const shared = await page.evaluate(() => window.__shareCalls[0]);
    expect(shared.url).toBe(publicURL); expect(shared.title).toBe('Dook, Dook, Goose!');
    expect(JSON.stringify(shared)).not.toContain('DoNotShare');
    await page.evaluate(() => { window.__shareMode = 'abort'; });
    await share.click();
    await expect.poll(() => page.evaluate(() => window.__shareCalls.length)).toBe(2);
    expect(await page.evaluate(() => window.__clipboardCalls.length)).toBe(0);
    await expect(page.locator('.dook-share-dialog')).toHaveCount(0);

    await page.evaluate(() => { Object.defineProperty(navigator, 'share', {configurable: true, value: undefined}); });
    await share.click();
    await expect.poll(() => page.evaluate(() => window.__clipboardCalls.at(-1))).toBe(publicURL);
    await expect(page.locator('.dook-share-toast')).toContainText('copied');

    // A denied clipboard opens a copyable dialog and pauses a real active run.
    await page.evaluate(() => { window.__denyClipboard = true; });
    await page.locator('[data-action="start"]').click();
    await page.locator('#player-name').fill('Fern');
    await page.locator('#name-form button[type="submit"]').click();
    await page.locator('[data-action="skip-story"]').click();
    await page.locator('[data-action="run"]').click();
    await share.click();
    await expect(page.locator('.dook-share-dialog')).toBeVisible();
    expect((await page.evaluate(() => window.__dook.snapshot())).mode).toBe('paused');
    await expect(page.locator('#dook-share-url')).toHaveValue(publicURL);
    await page.keyboard.press('Shift+Tab'); await expect(page.locator('.dook-dialog-button')).toBeFocused();
    await page.keyboard.press('Tab'); await expect(page.locator('.dook-dialog-close')).toBeFocused();
    await page.locator('.dook-dialog-button').click();
    await expect(page.locator('.dook-copy-feedback')).toContainText('Link selected');
    expect(await page.locator('#dook-share-url').evaluate(input => input.selectionEnd - input.selectionStart)).toBe(publicURL.length);
    const pausedDistance = (await page.evaluate(() => window.__dook.snapshot())).distance;
    await page.keyboard.press('Escape');
    await expect(page.locator('.dook-share-dialog')).toHaveCount(0); await expect(share).toBeFocused();
    expect((await page.evaluate(() => window.__dook.snapshot())).mode).toBe('paused');
    await page.waitForTimeout(100);
    expect((await page.evaluate(() => window.__dook.snapshot())).distance).toBe(pausedDistance);

    // Escape closes only the custom dialog, retaining a help overlay underneath.
    await page.locator('#help-button').click();
    await page.locator('#help-overlay [data-install-game]').click();
    await expect(page.locator('.dook-install-steps')).toContainText('Install app');
    await page.keyboard.press('Escape');
    await expect(page.locator('#help-overlay')).toBeVisible();
    expect((await page.evaluate(() => window.__dook.snapshot())).mode).toBe('paused');
    await page.locator('[data-action="close-help"]').click();

    await page.evaluate(() => {
      const event = new Event('beforeinstallprompt', {cancelable: true});
      event.__testPrompt = true;
      event.prompt = async () => { window.__promptCalls++; };
      event.userChoice = Promise.resolve({outcome: 'dismissed'});
      window.dispatchEvent(event); window.__promptPrevented = event.defaultPrevented;
    });
    expect(await page.evaluate(() => window.__promptPrevented)).toBe(true);
    expect(await page.evaluate(() => window.__promptCalls)).toBe(0);
    await install.click(); await expect.poll(() => page.evaluate(() => window.__promptCalls)).toBe(1);
    await install.click();
    await expect(page.locator('.dook-install-steps')).toBeVisible();
    expect(await page.evaluate(() => window.__promptCalls)).toBe(1);
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
    await expect(install).toBeHidden();
    await page.locator('#help-button').click();
    await expect(page.locator('#help-overlay [data-install-game]')).toBeHidden();
    await expect(page.locator('#help-overlay [data-share-game]')).toBeVisible();
  } finally { await context.close(); }

  const mobile = await openPage({ios: true});
  try {
    await mobile.page.locator('.site-header [data-install-game]').click();
    await expect(mobile.page.locator('.dook-install-steps')).toContainText('Share button');
    await expect(mobile.page.locator('.dook-install-steps')).toContainText('Add to Home Screen');
    await expect(mobile.page.locator('.dook-install-note')).toContainText('Safari');
    expect(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await mobile.page.evaluate(() => window.__promptCalls)).toBe(0);
  } finally { await mobile.context.close(); }

  const installed = await openPage({ios: true, standalone: true});
  try {
    await expect(installed.page.locator('html')).toHaveClass(/dook-standalone/);
    await expect(installed.page.locator('.site-header [data-install-game]')).toBeHidden();
    await installed.page.locator('#help-button').click();
    await expect(installed.page.locator('#help-overlay [data-install-game]')).toBeHidden();
    await expect(installed.page.locator('#help-overlay [data-share-game]')).toBeVisible();
    expect(await installed.page.evaluate(() => [window.__shareCalls.length, window.__promptCalls])).toEqual([0, 0]);
  } finally { await installed.context.close(); }

  expect(errors).toEqual([]);
  console.log('Share/install regression passed: explicit native sharing, cancel, canonical privacy, clipboard recovery, dialog focus/keyboard/game pause, deferred install, fresh-control hiding, iOS help and standalone.');
} finally {
  await browser.close();
}
