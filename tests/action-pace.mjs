import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173');
 await page.locator('[data-action="start"]').click();
 await page.locator('#player-name').fill('Rocket');
 await page.locator('#name-form button[type="submit"]').click();
 await page.locator('[data-action="skip-story"]').click();
 await page.locator('[data-action="run"]').click();
 const motion=await page.evaluate(()=>new Promise(resolve=>{
  const samples=[],start=performance.now(),initial=window.__dook.snapshot();
  const sample=()=>{samples.push(window.__dook.snapshot());if(performance.now()-start<450)requestAnimationFrame(sample);else resolve({samples,initial,elapsed:(performance.now()-start)/1000});};requestAnimationFrame(sample);
 }));
 expect(motion.samples.every(s=>s.motion==='bound')).toBe(true);
 expect(motion.samples.every(s=>s.speed>=31.5)).toBe(true);
 expect(Math.max(...motion.samples.map(s=>s.arch))-Math.min(...motion.samples.map(s=>s.arch))).toBeGreaterThan(.85);
 expect(Math.max(...motion.samples.map(s=>s.hop))).toBeGreaterThan(.15);
 expect(motion.samples.at(-1).gaitRate).toBeGreaterThanOrEqual(3.5);
 const measuredSpeed=(motion.samples.at(-1).distance-motion.initial.distance)/motion.elapsed;
 expect(measuredSpeed).toBeGreaterThan(28);expect(measuredSpeed).toBeLessThan(36);
 await page.keyboard.press('r');await page.waitForTimeout(160);
 expect((await page.evaluate(()=>window.__dook.snapshot())).height).toBeGreaterThan(1.5);
 await page.keyboard.press('ArrowDown');await page.waitForTimeout(210);
 const dive=await page.evaluate(()=>window.__dook.snapshot());
 expect(dive.height).toBe(0);expect(dive.slide).toBeGreaterThan(0);expect(dive.motion).toBe('slide');
 await page.keyboard.press('ArrowRight');await page.waitForTimeout(110);
 expect((await page.evaluate(()=>window.__dook.snapshot())).laneX).toBeGreaterThan(2);
 expect(errors).toEqual([]);
 await page.locator('[data-action="pause"]').click();
 await page.screenshot({path:'output/qa/fast-action-mobile.png'});
 console.log({measuredSpeed,defaultGait:motion.samples[0].motion,maxHop:Math.max(...motion.samples.map(s=>s.hop)),gaitRate:motion.samples.at(-1).gaitRate,dive: dive.motion,errors});
}finally{await browser.close();}
