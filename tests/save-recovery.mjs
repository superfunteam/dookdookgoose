import {chromium, expect} from '@playwright/test';

const browser = await chromium.launch({channel: 'chrome', headless: true});
const baseURL = (process.env.DOOK_TEST_URL || 'http://localhost:5173').replace(/\/$/, '');
const cases = [
  {label: 'null', raw: 'null'},
  {label: 'array', raw: '["not a save"]'},
  {label: 'string', raw: '"not a save"'},
  {label: 'number', raw: '42'},
  {label: 'boolean', raw: 'true'},
  {label: 'malformed JSON', raw: '{"name":'},
  {label: 'storage unavailable', blocked: true},
];

async function openWithSave({raw, blocked = false}) {
  const context = await browser.newContext({viewport: {width: 390, height: 844}});
  await context.addInitScript(({raw, blocked}) => {
    if (blocked) {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() { throw new DOMException('Storage unavailable for this test', 'SecurityError'); },
      });
    } else {
      localStorage.setItem('dook-save', raw);
    }
  }, {raw, blocked});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${baseURL}/`);
  await expect(page.locator('.title-screen')).toBeVisible();
  return {context, page, errors};
}

try {
  for (const fixture of cases) {
    const {context, page, errors} = await openWithSave(fixture);
    try {
      const initial = await page.evaluate(() => window.__dook.snapshot());
      expect(initial.name, fixture.label).toBe('');
      expect(initial.unlocked, fixture.label).toBe(0);
      await page.locator('[data-action="start"]').click();
      await expect(page.locator('#player-name')).toHaveValue('');
      await page.locator('#player-name').fill('Fern');
      await page.locator('#name-form button[type="submit"]').click();
      await expect(page.locator('.speaker')).toContainText('GOOSE MICHAEL');
      expect((await page.evaluate(() => window.__dook.snapshot())).name, fixture.label).toBe('Fern');
      if (!fixture.blocked) {
        const repaired = await page.evaluate(() => JSON.parse(localStorage.getItem('dook-save')));
        expect(repaired.name, fixture.label).toBe('Fern');
        expect(repaired.unlocked, fixture.label).toBe(0);
      }
      expect(errors, fixture.label).toEqual([]);
    } finally {
      await context.close();
    }
  }

  const valid = {name: 'Tula', unlocked: 2, best: 4321, sound: false, music: false};
  const {context, page, errors} = await openWithSave({raw: JSON.stringify(valid)});
  try {
    await expect(page.locator('.save-line')).toContainText('FERRET TULA');
    const restored = await page.evaluate(() => window.__dook.snapshot());
    expect(restored.name).toBe('Tula');
    expect(restored.unlocked).toBe(2);
    await page.locator('[data-action="chapters"]').click();
    for (const chapter of [0, 1, 2]) await expect(page.locator(`[data-chapter="${chapter}"]`)).toBeEnabled();
    await page.locator('[data-action="home"]').click();
    await page.locator('[data-action="start"]').click();
    await expect(page.locator('#player-name')).toHaveValue('Tula');
    await page.locator('#name-form button[type="submit"]').click();
    await expect(page.locator('.speaker')).toContainText('GOOSE MICHAEL');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dook-save')))).toEqual(valid);
    expect(errors, 'valid save').toEqual([]);
  } finally {
    await context.close();
  }
  console.log('Save recovery passed: null, array, string, number, boolean, malformed JSON, blocked storage, and valid progress restoration.');
} finally {
  await browser.close();
}
