import {chromium,expect} from '@playwright/test';
import {mkdirSync,readFileSync} from 'node:fs';
const output='output/qa/expressions';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:900,height:850}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.goto('http://localhost:5173/character-lab.html');await page.locator('#face').click();await page.waitForTimeout(300);await page.addStyleTag({content:'#caption,#hint,#stats{display:none}'});
const poses={};
for(const name of ['neutral','grin','happy','dook']){
 await page.evaluate(name=>{window.__rigLab.expression(name);window.__rigLab.pose(.12,'idle');},name);
 poses[name]=await page.evaluate(async()=>{const T=await import('/node_modules/three/build/three.module.js'),f=window.__rigLab.ferret,m=f.rig.mesh,p=m.geometry.attributes.position;let jaw=[],muzzle=[];for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i);if(v.y>1.65&&v.y<1.84&&v.z>1.32)jaw.push(m.applyBoneTransform(i,v.clone()).toArray());if(v.y>1.96&&v.y<2.10&&v.z>1.51)muzzle.push(m.applyBoneTransform(i,v.clone()).toArray());}return{bones:f.faceRig.bones.map(b=>b.name),angle:f.faceRig.jaw.rotation.x,jaw,muzzle,smile:f.faceRig.smile,mouthSkinned:f.faceRig.mouth.isSkinnedMesh};});
 await page.locator('canvas').screenshot({path:`${output}/${name}.png`});
}
const movement=(a,b)=>Math.max(...a.map((p,i)=>Math.hypot(...p.map((v,j)=>v-b[i][j]))));
expect(poses.happy.bones.length).toBe(8);expect(poses.happy.mouthSkinned).toBe(true);expect(movement(poses.neutral.jaw,poses.dook.jaw)).toBeGreaterThan(.06);expect(movement(poses.neutral.muzzle,poses.happy.muzzle)).toBeGreaterThan(.015);expect(poses.happy.smile).toBe(1);expect(errors).toEqual([]);
console.log({facialBones:poses.happy.bones,jawMovement:movement(poses.neutral.jaw,poses.dook.jaw),muzzleMovement:movement(poses.neutral.muzzle,poses.happy.muzzle),errors});
await page.setViewportSize({width:1440,height:390});await page.setContent(`<html><style>body{margin:0;background:#f7edce;color:#384531;font:24px Georgia}main{display:grid;grid-template-columns:repeat(4,1fr)}article{border-right:1px solid #d1c4a3}h2{font:italic 24px Georgia;padding:20px;margin:0}img{width:100%;display:block}p{font:14px system-ui;padding:0 20px}</style><main>${Object.entries({neutral:'Relaxed',grin:'Little grin',happy:'Big smile',dook:'Dook!'}).map(([key,label])=>`<article><h2>${label}</h2><img src="data:image/png;base64,${readFileSync(`${output}/${key}.png`).toString('base64')}"><p>Actual skinned facial rig</p></article>`).join('')}</main></html>`);await page.screenshot({path:`${output}/smile-lineup.png`});await browser.close();
