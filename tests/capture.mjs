import { chromium } from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
page.on('pageerror',error=>console.error('PAGE ERROR',error));
await page.goto('http://localhost:5173');await page.waitForTimeout(1500);await page.screenshot({path:'output/qa/title-desktop-v1.png'});
await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);await page.screenshot({path:'output/qa/title-mobile-v1.png'});
await browser.close();
