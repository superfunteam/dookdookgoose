import {chromium,expect} from '@playwright/test';
import {startRunnerBot} from './runner-bot.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>localStorage.setItem('dook-save',JSON.stringify({name:'River',unlocked:3,music:false,sound:false})));
await page.goto('http://localhost:5173');await page.locator('[data-action="chapters"]').click();await page.locator('[data-action="endless"]').click();
await startRunnerBot(page);
await page.waitForFunction(()=>window.__dook.snapshot().distance>1250||window.__dook.snapshot().mode==='failed',null,{timeout:110000});const snapshot=await page.evaluate(()=>window.__dook.snapshot());if(snapshot.mode==='failed')console.log('Collisions',await page.evaluate(()=>window.__qaHits));expect(snapshot.mode).toBe('playing');expect(snapshot.distance).toBeGreaterThan(1250);expect((await page.evaluate(()=>window.__dook.getCourse())).some(e=>e.distance>1250)).toBe(true);await page.screenshot({path:'output/qa/endless-second-segment.png'});console.log('Endless crossed first segment',snapshot);expect(errors).toEqual([]);await browser.close();
