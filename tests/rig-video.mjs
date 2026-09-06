import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1000,height:760},deviceScaleFactor:1});const errors=[];page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text());});await page.goto('http://localhost:5173/character-lab.html');
for(let i=0;i<192;i++){
 await page.evaluate(i=>{
  const lab=window.__rigLab;let mode='idle',t=0,label='Connected sculpt · 22-bone skeleton';lab.ferret.group.visible=true;lab.goose.group.visible=false;
  if(i<24){lab.front();t=i/24;}
  else if(i<60){lab.side();mode='scamper';t=(i-24)/24*.6;label='SCAMPER · quick alternating paw contacts';}
  else if(i<108){lab.side();mode='bound';t=(i-60)/24*.60;label='BOUND · spinal flexion, hind-leg push-off, forepaw landing';}
  else if(i<156){lab.front();mode='barrel';t=((i-108)/47)/.65;label='BIG JUMP · a full 360° roll around the backbone';}
  else if(i<180){lab.front();mode='bound';t=(i-156)/24*.55;label='REAL RIG · weighted skinning and inverse-kinematic paws';}
  else{lab.front();if(i===180)document.querySelector('#friend').click();lab.ferret.group.visible=false;lab.goose.group.visible=true;label='Goose Michael · rebuilt neck, bill, wings and webbed feet';}
  document.querySelector('#skeleton').checked=i>=156&&i<180;document.querySelector('#skeleton').dispatchEvent(new Event('change'));
  document.querySelector('#caption').textContent=label;document.querySelector('#caption').style.fontSize='19px';document.querySelector('#hint').style.display='none';lab.pose(t,mode);
 },i);
 await page.locator('#viewport').screenshot({path:`output/qa/rig-frames/${String(i).padStart(4,'0')}.png`});
}
expect(errors).toEqual([]);console.log('Rendered 192 movement frames without shader or browser errors.');await browser.close();
