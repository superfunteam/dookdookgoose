import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1200,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text())});
await page.goto('http://localhost:5173/character-lab.html');
const result=await page.evaluate(async()=>{
 const T=await import('/node_modules/three/build/three.module.js'),f=window.__rigLab.ferret;const w=f.rig.mesh.geometry.attributes.skinWeight;let maxWeightError=0,maxContactError=0,maxReach=0;
 for(let i=0;i<w.count;i++)maxWeightError=Math.max(maxWeightError,Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1));
 const poses=[];for(let frame=0;frame<40;frame++){
  window.__rigLab.pose(frame/(40*2.25),'bound');const bonePositions=f.legs.map(l=>l.bones[2].getWorldPosition(new T.Vector3()).toArray());
  for(let j=0;j<f.legs.length;j++){if(f.stats.contacts[f.legs[j].bones[0].name])maxContactError=Math.max(maxContactError,Math.abs(bonePositions[j][1]-.16));}
  const m=f.rig.mesh;const p=m.geometry.attributes.position;for(let j=0;j<p.count;j+=19){const v=m.applyBoneTransform(j,new T.Vector3().fromBufferAttribute(p,j));if(!Number.isFinite(v.x+v.y+v.z))throw Error('Nonfinite skin deformation');maxReach=Math.max(maxReach,v.length());}
  poses.push({arch:f.stats.arch,spine:f.rig.bones[1].getWorldPosition(new T.Vector3()).y});
 }
 window.__rigLab.pose(.5/.65,'barrel');const halfway=f.stats.roll;window.__rigLab.pose(.9/.65,'barrel');const full=f.stats.roll;
 return {bones:f.rig.bones.map(b=>b.name),isSkinnedMesh:f.rig.mesh.isSkinnedMesh,maxWeightError,maxContactError,maxReach,archRange:Math.max(...poses.map(x=>x.arch))-Math.min(...poses.map(x=>x.arch)),halfway,full};
});
console.log('Rig verification',result);expect(result.isSkinnedMesh).toBe(true);expect(result.bones.length).toBe(30);expect(result.maxWeightError).toBeLessThan(.00001);expect(result.maxContactError).toBeLessThan(.018);expect(result.archRange).toBeGreaterThan(.95);expect(result.halfway).toBeGreaterThan(Math.PI*.9);expect(result.full).toBeCloseTo(Math.PI*2,4);
await page.locator('#skeleton').check();await page.evaluate(()=>{window.__rigLab.front();window.__rigLab.pose(.06,'bound');});await page.screenshot({path:'output/qa/ferret-skeleton.png'});
await page.goto('http://localhost:5173');await page.locator('[data-action="start"]').click();await page.locator('#player-name').fill('Billy');await page.locator('#name-form button[type="submit"]').click();await page.locator('[data-action="skip-story"]').click();await page.locator('[data-action="run"]').click();
await page.keyboard.press('r');await page.waitForTimeout(540);const airborne=await page.evaluate(()=>window.__dook.snapshot());console.log('In-game barrel roll',airborne);expect(airborne.height).toBeGreaterThan(2.5);expect(airborne.motion).toBe('barrel-roll');expect(airborne.roll).toBeGreaterThan(1);await page.screenshot({path:'output/qa/in-game-barrel-roll.png'});
await page.locator('[data-action="pause"]').click();const paused=await page.evaluate(()=>window.__dook.snapshot());await page.waitForTimeout(150);expect((await page.evaluate(()=>window.__dook.snapshot())).roll).toBe(paused.roll);await page.locator('[data-action="resume"]').click();await page.waitForTimeout(850);expect((await page.evaluate(()=>window.__dook.snapshot())).height).toBe(0);
await page.keyboard.press('Space');await page.waitForTimeout(140);await page.keyboard.press('Space');expect((await page.evaluate(()=>window.__dook.snapshot())).rollProgress).toBeLessThan(.2);
await page.keyboard.press('d');await page.waitForTimeout(80);expect((await page.evaluate(()=>window.__dook.snapshot())).expression).toBe('dook');
console.log('Errors',errors);expect(errors).toEqual([]);await browser.close();
