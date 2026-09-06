import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>localStorage.setItem('dook-save',JSON.stringify({name:'Clark',unlocked:3,music:false,sound:false})));
await page.goto('http://localhost:5173');await page.waitForTimeout(500);await page.screenshot({path:'output/qa/title-mobile-v2.png'});
for(let i=0;i<3;i++){
 if(i)await page.locator('[data-action="home"]').first().click();
 await page.locator('[data-action="chapters"]').click();await page.locator(`[data-chapter="${i}"]`).click();await page.screenshot({path:`output/qa/story-${i}.png`});await page.locator('[data-action="skip-story"]').click();await page.locator('[data-action="run"]').click();await page.waitForTimeout(2200);await page.screenshot({path:`output/qa/level-${i}.png`});console.log(await page.evaluate(()=>window.__dook.snapshot()));await page.locator('[data-action="pause"]').click();
}
console.log({errors});await browser.close();
