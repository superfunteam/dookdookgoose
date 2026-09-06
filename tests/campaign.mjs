import {chromium,expect} from '@playwright/test';
import {startRunnerBot} from './runner-bot.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:5173');
await page.locator('[data-action="start"]').click();await page.locator('#player-name').fill('Ada');await page.locator('#name-form button[type="submit"]').click();
await expect(page.locator('.speaker')).toContainText('GOOSE MICHAEL');await page.locator('[data-action="next-story"]').click();await expect(page.locator('.speaker')).toContainText('FERRET ADA');await page.screenshot({path:'output/qa/personalized-intro.png'});
await page.locator('[data-action="skip-story"]').click();await page.locator('[data-action="run"]').click();
await page.locator('[data-action="pause"]').click();const paused=await page.evaluate(()=>window.__dook.snapshot().distance);await page.waitForTimeout(400);expect(await page.evaluate(()=>window.__dook.snapshot().distance)).toBe(paused);await page.locator('[data-action="resume"]').click();
// Play through the actual keyboard input path, including every special mechanic.
await startRunnerBot(page);
for(let chapter=0;chapter<3;chapter++){
 await page.waitForFunction(()=>['result','failed'].includes(window.__dook.snapshot().mode),null,{timeout:75000});
 const result=await page.evaluate(()=>window.__dook.snapshot());console.log('Chapter result',result);if(result.mode==='failed')console.log('Collisions',await page.evaluate(()=>window.__qaHits));expect(result.mode).toBe('result');await page.screenshot({path:`output/qa/completed-${chapter}.png`});
 await page.locator('[data-action="continue"]').click();
 if(chapter<2){await page.locator('[data-action="skip-story"]').click();await page.locator('[data-action="skip-story"]').click();await page.locator('[data-action="run"]').click();await page.waitForTimeout(1100);await page.screenshot({path:`output/qa/campaign-level-${chapter+1}.png`});}
}
await expect(page.locator('.speaker')).toContainText('FERRET ADA');await page.screenshot({path:'output/qa/ending-scene.png'});
for(let i=0;i<7;i++)await page.locator('[data-action="next-story"]').click();await expect(page.locator('.dialogue-content p')).toContainText('Yours is melting');await page.locator('[data-action="next-story"]').click();await expect(page.locator('.credits-card')).toContainText('Ferret Ada');await page.screenshot({path:'output/qa/credits.png'});
await page.locator('[data-action="endless"]').click();await page.waitForTimeout(500);expect(await page.evaluate(()=>window.__dook.snapshot().endless)).toBe(true);
const actions=await page.evaluate(()=>window.__qaActions);console.log('Mechanic inputs',actions);for(const mechanic of ['jump','slide','dook'])expect(actions[mechanic]).toBeGreaterThan(0);console.log('Browser errors',errors);expect(errors).toEqual([]);await browser.close();
