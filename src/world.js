import * as THREE from 'three';
import {ferret,goose} from './characters.js';
export {ferret,goose} from './characters.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const C={cream:0xf7e8bb,brown:0x876345,dark:0x392f27,orange:0xf17639,green:0x2a6245};
const materials=new Map();
function mat(color){
 if(!materials.has(color)){
  const base=new THREE.Color(color);const cv=document.createElement('canvas');cv.width=cv.height=32;const c=cv.getContext('2d');let seed=color%65536+1;
  for(let y=0;y<32;y++)for(let x=0;x<32;x++){seed=(seed*16807)%2147483647;const shade=.88+(seed%100)/430;const col=base.clone().multiplyScalar(shade);c.fillStyle='#'+col.getHexString();c.fillRect(x,y,1,1);}
  const texture=new THREE.CanvasTexture(cv);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestMipmapNearestFilter;
  materials.set(color,new THREE.MeshStandardMaterial({map:texture,roughness:1,flatShading:true}));
 }return materials.get(color);
}
const boxGeo=new THREE.BoxGeometry(1,1,1), ballGeo=new THREE.IcosahedronGeometry(1,1), coarseGeo=new THREE.IcosahedronGeometry(1,0);
function mesh(g,geometry,color,pos=[0,0,0],scale=[1,1,1]){let m=new THREE.Mesh(geometry,mat(color));m.position.set(...pos);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
const box=(g,color,p,s)=>mesh(g,boxGeo,color,p,s);
const ball=(g,color,p,s,coarse=false)=>mesh(g,coarse?coarseGeo:ballGeo,color,p,s);
function cone(g,color,p,r,h,n=6){return mesh(g,new THREE.ConeGeometry(r,h,n),color,p);}
function cylinder(g,color,p,r,h,n=8){return mesh(g,new THREE.CylinderGeometry(r,r,h,n),color,p);}
function group(parent,pos=[0,0,0]){const g=new THREE.Group();g.position.set(...pos);parent.add(g);return g;}
function label(parent,text,pos,width=3,bg='#eedaa4',fg='#274a3b'){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const c=canvas.getContext('2d');c.fillStyle=bg;c.fillRect(0,0,512,128);c.strokeStyle=fg;c.lineWidth=7;c.strokeRect(8,8,496,112);c.fillStyle=fg;c.font='bold 34px monospace';c.textAlign='center';c.textBaseline='middle';c.fillText(text,256,65,470);
  const t=new THREE.CanvasTexture(canvas);t.magFilter=THREE.NearestFilter;t.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(width,width/4),new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide}));m.position.set(...pos);parent.add(m);return m;
}
function tree(g,x,z,size=1,kind=0){const p=group(g,[x,0,z]);p.scale.setScalar(size);cylinder(p,0x78503a,[0,1.45,0],.23,2.9,5);if(kind===0){for(let j=0;j<3;j++)cone(p,[0x2e6046,0x3e7950,0x568557][j],[0,2+j*.9,0],1.65-j*.30,2.25,5);}else{ball(p,0x639153,[0,3.3,0],[1.7,1.6,1.5],true);ball(p,0x8ea856,[.9,3.1,.3],[1.1,1.2,1.1],true);}}
function mushroom(g,x,z,size=1){const a=group(g,[x,0,z]);a.scale.setScalar(size);cylinder(a,0xf1db9b,[0,.25,0],.12,.5);const cap=ball(a,0xd96d38,[0,.52,0],[.45,.23,.44],true);for(let i=0;i<3;i++)box(a,0xffe7b0,[(i-1)*.2,.7-Math.abs(i-1)*.07,.06],[.08,.025,.08]);return a;}
function fern(g,x,z,size=1){const a=group(g,[x,0,z]);for(let i=0;i<5;i++){const b=cone(a,i%2?0x79a351:0x467b45,[Math.cos(i*1.25)*.18,.26,Math.sin(i*1.25)*.18],.19,.85,3);b.rotation.z=.65;b.rotation.y=i*1.25;}a.scale.setScalar(size);}
function rock(g,x,z,size=1){ball(g,0x8f9980,[x,.23*size,z],[.55*size,.47*size,.44*size],true);}
function human(g,x,z,index=0){const p=group(g,[x,0,z]);const shirt=[0xc88368,0x658d8a,0xbba361][index%3];for(let s of [-1,1]){box(p,0x4d5652,[s*.17,.42,0],[.22,.8,.25]);box(p,0x503e31,[s*.17,.09,.08],[.25,.15,.43]);box(p,shirt,[s*.40,1.13,0],[.22,.65,.25]);}box(p,shirt,[0,1.15,0],[.66,.76,.34]);ball(p,0xd5ac82,[0,1.91,0],[.31,.36,.29],true);box(p,0x584638,[0,2.12,0],[.53,.18,.45]);box(p,0xe9e3c5,[0,1.24,.2],[.07,.44,.03]);box(p,0x59685d,[.45,.87,.12],[.54,.45,.12]);for(let side of [-1,1]){ball(p,0xe4bb92,[side*.40,.79,.03],[.13,.15,.13],true);box(p,0x292f29,[side*.12,1.97,.277],[.13,.10,.025]);box(p,0xe9dcc0,[side*.12,1.99,.293],[.06,.03,.012]);}box(p,0x7d4638,[0,1.78,.283],[.12,.03,.03]);}
function cage(g,side,z,i){const x=side*5.4;box(g,0xc28e65,[x,.25,z],[2.5,.5,7]);box(g,0x42665b,[side*4.28,2.8,z],[.16,.16,7]);box(g,0x42665b,[side*6.6,2.8,z],[.16,.16,7]);for(let k of [-1,1])box(g,0x42665b,[x,2.8,z+k*3.4],[2.5,.16,.16]);for(let j=0;j<8;j++)cylinder(g,0x42665b,[side*4.28,1.5,z-3+j*.85],.055,2.7,5);for(let k=0;k<2;k++)human(g,x+(k-.5)*.7,z-1.2+k*2,i+k);const sign=label(g,['THE ACCOUNTANTS','INFLUENCER HABITAT','MIDDLE MANAGEMENT','HOMO SAPIENS'][i%4],[side*4.16,2.58,z],2.5);sign.rotation.y=-side*Math.PI/2;}
function floorTexture(theme){const cv=document.createElement('canvas');cv.width=cv.height=128;const c=cv.getContext('2d');let seed=23;let rand=()=>((seed=seed*16807%2147483647)/2147483647);c.fillStyle=theme==='house'?'#bd8655':theme==='zoo'?'#dab788':'#b7a879';c.fillRect(0,0,128,128);for(let i=0;i<600;i++){c.fillStyle=theme==='house'?(i%2?'#ad794f':'#ce9763'):(i%2?'#c4b28a':'#a99e73');c.fillRect(rand()*128,rand()*128,rand()*5+1,theme==='house'?1:2);}if(theme==='house'){c.fillStyle='#805938';for(let x=0;x<128;x+=32){c.fillRect(x,0,1,128);c.fillRect(x,(x*3)%100,32,1);}}if(theme==='zoo'){c.strokeStyle='#ba9877';for(let i=0;i<128;i+=32){c.beginPath();c.moveTo(0,i);c.lineTo(128,i);c.stroke();for(let j=0;j<128;j+=32)c.strokeRect(j+(i%64?16:0),i,32,32);}}
 const tx=new THREE.CanvasTexture(cv);tx.wrapS=tx.wrapT=THREE.RepeatWrapping;tx.repeat.set(2,36);tx.magFilter=THREE.NearestFilter;tx.colorSpace=THREE.SRGBColorSpace;return tx;}

function batchScenery(g){
 g.updateWorldMatrix(true,true);const inverse=g.matrixWorld.clone().invert(),bins=new Map(),labels=[],originals=new Set();
 g.traverse(o=>{if(!o.isMesh)return;const matrix=inverse.clone().multiply(o.matrixWorld);if(!Array.from(materials.values()).includes(o.material)){const copy=o.clone();copy.matrix.copy(matrix);copy.matrix.decompose(copy.position,copy.quaternion,copy.scale);labels.push(copy);return;}const geo=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(matrix);if(!bins.has(o.material))bins.set(o.material,[]);bins.get(o.material).push(geo);originals.add(o.geometry);});
 g.clear();for(const [material,geometries] of bins){const merged=mergeGeometries(geometries);const m=new THREE.Mesh(merged,material);m.castShadow=true;m.receiveShadow=true;g.add(m);geometries.forEach(x=>x.dispose());}labels.forEach(x=>g.add(x));for(const geo of originals)if(![boxGeo,ballGeo,coarseGeo].includes(geo))geo.dispose();
}

export class World {
 constructor(container){this.container=container;this.renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'high-performance'});this.renderer.setPixelRatio(1);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.setClearColor(0x94b09a);container.append(this.renderer.domElement);this.camera=new THREE.PerspectiveCamera(49,1,.1,160);this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x94b09a);this.scene.fog=new THREE.Fog(0x94b09a,20,85);this.scene.add(new THREE.HemisphereLight(0xfff4e0,0x324c36,1.6));this.sun=new THREE.DirectionalLight(0xffe0b0,2.1);this.sun.position.set(-12,23,10);this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-18,right:18,top:20,bottom:-20,near:1,far:70});this.sun.shadow.bias=-.002;this.scene.add(this.sun);this.root=group(this.scene);this.actors=group(this.scene);this.player=ferret(this.actors);this.friend=goose(this.actors);this.chunks=[];this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.resize();}
 resize(){const w=this.container.clientWidth,h=this.container.clientHeight;this.width=w;this.height=h;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();const scale=w<600?.92:.85;this.renderer.setSize(Math.round(w*scale),Math.round(h*scale),false);}
 clear(){this.root.traverse(o=>{if(o.isMesh){if(o.geometry!==boxGeo&&o.geometry!==ballGeo&&o.geometry!==coarseGeo)o.geometry.dispose();if(o.material.map&&!Array.from(materials.values()).includes(o.material)){o.material.map.dispose();o.material.dispose();}}});this.root.clear();this.chunks=[];}
 setup(theme='woods',mode='title'){
  this.clear();this.theme=theme;this.mode=mode;const house=theme==='house',zoo=theme==='zoo';const bg=house?0x9e9a73:zoo?0xe2bd8d:0xa3b89a;this.scene.background.set(bg);this.scene.fog.color.set(bg);this.scene.fog.near=house?16:27;this.scene.fog.far=house?65:85;
  const tx=floorTexture(theme);const ground=new THREE.Mesh(new THREE.PlaneGeometry(8,180),new THREE.MeshStandardMaterial({map:tx,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.set(0,-.03,-55);ground.receiveShadow=true;this.root.add(ground);this.groundTexture=tx;
  box(this.root,house?0x584436:zoo?0xb9ad75:0x6c894f,[0,-.32,-55],[100,.4,180]);
  for(let i=0;i<15;i++){const chunk=group(this.root,[0,0,-i*10]);this.chunks.push(chunk);this.decorate(chunk,i,theme);batchScenery(chunk);}
  this.player.group.visible=true;this.friend.group.visible=mode==='title'||mode==='ending';this.friend.treats.visible=mode==='ending';this.player.group.position.set(mode==='run'?0:1.1,0,mode==='run'?4:1);this.player.group.rotation.y=mode==='run'?Math.PI:-.25;this.player.group.scale.setScalar(mode==='run'?1:1.65);this.playerScale=mode==='run'?1:1.65;this.friend.group.position.set(3.5,0,-1);this.friend.group.rotation.y=.28;this.friend.group.scale.setScalar(.96);
  if(mode==='ending'){this.player.group.position.set(-1.0,0,2);this.player.group.rotation.y=.5;this.friend.group.position.set(1.6,0,1.8);this.gelatoCart(this.root,4,-1);}
  if(mode==='title'){for(let i=0;i<5;i++)mushroom(this.root,-2.5+i*.25,2+i*.45,.8);label(this.root,'ZOO  →',[3,2,-7],2.8);box(this.root,0x795139,[3,1,-7.05],[.15,2,.15]);}
 }
 decorate(g,i,theme){
  if(theme==='house'){
   box(g,0x6f563b,[0,7,-4.7],[10.6,.18,10]);box(g,0x513e2e,[0,6.8,-.1],[10.6,.3,.3]);
   for(let s of [-1,1]){box(g,0x73927c,[s*5.3,3.5,-4.7],[.3,7,10]);box(g,0x4e705a,[s*5.08,.45,-4.7],[.13,.9,10]);box(g,0xe7cc98,[s*5.03,.96,-4.7],[.10,.12,10]);box(g,0xc29a63,[s*5.03,6.3,-4.7],[.17,.19,10]);for(let j=0;j<5;j++){ball(g,0xa1b294,[s*5.10,2.4+(j%2)*.7,-j*2],[.02,.16,.13],true);}
   if((i+(s===1?1:0))%3===0){box(g,0x815643,[s*4.45,.58,-4],[1.2,1.15,3.1]);box(g,0xcbb281,[s*4.45,1.23,-4],[1.3,.15,3.2]);box(g,0x8a5e3d,[s*4.4,1.65,-4],[.25,.8,.25]);cone(g,0xf1c977,[s*4.4,2.25,-4],.55,.6);}
   else if(i%3===1){box(g,0xb37355,[s*4.4,.6,-5],[1.25,1.2,2.9]);box(g,0xd5ab72,[s*4.4,1.25,-5],[1.2,.25,2.8]);}
   else{box(g,0x644b3a,[s*5.0,2.7,-5],[.15,1.65,1.4]);box(g,0xe5c69a,[s*4.89,2.7,-5],[.04,1.38,1.12]);}}
   if(i%3===0){const rug=box(g,0xa95f44,[0,.005,-5],[5,.025,3.7]);for(let k of [-1,1])box(g,0xe0b478,[k*2.15,.025,-5],[.12,.02,3.4]);}
  }else if(theme==='woods'){
   for(let s of [-1,1]){tree(g,s*(5+(i%3)*.8),-3,(1.25+i%4*.19),i%3===0?1:0);tree(g,s*(9+(i%4)*1.2),-7,1.35,i%2);fern(g,s*3.9,-i%5,.8+i%3*.2);fern(g,s*4.5,-6,1.3);rock(g,s*(4.1+i%3*.4),-8,.65+i%3*.3);if(i%2===0)mushroom(g,s*4.1,-3,.8);ball(g,0x537647,[s*4.6,.38,-5],[1,.7,1.4],true);for(let f=0;f<4;f++){ball(g,0xe5bc53,[s*(3.9+(f%2)*.25),.23,-2-f*.45],[.07,.075,.07],true);}if(s===1){box(g,0x60978a,[3.9,-.012,-5],[.56,.02,10]);box(g,0xafd2b4,[3.9,.003,-6],[.25,.014,.08]);}}
   for(let n=0;n<3;n++)ball(g,0xd3c391,[(n-1)*2.4,.008,-n*3-1],[.06,.015,.12],true);
  }else{
   for(let s of [-1,1]){box(g,0xe2a378,[s*4.1,.18,-4.7],[.28,.35,10]);if(i%3!==2)cage(g,s,-5,i);else{tree(g,s*5,-5,.75,1);box(g,0x557f6e,[s*4.3,.5,-2],[.7,1,.7]);}if(i%2===0){cylinder(g,0x425d49,[s*3.7,1.9,-.4],.06,3.8);ball(g,0xffdf9c,[s*3.7,3.9,-.4],[.20,.30,.20],true);}}
   if(i%5===1)this.gelatoCart(g,5,-4);
   for(let side of [-1,1]){box(g,0xbb8462,[side*8,2.6,-5],[1.9,5.2,9]);box(g,0xd5ae7c,[side*7,4.8,-5],[.3,.25,9]);for(let w=0;w<3;w++){box(g,0x3c624e,[side*6.99,3.45,-2-w*2.3],[.04,1.5,.9]);}}
   if(i%3===0){for(let side of [-1,1]){box(g,0x3b7056,[side*3.65,1.9,-5],[.32,3.8,.32]);cylinder(g,0xb97f52,[side*3.5,.36,-2],.36,.7,7);ball(g,0x78974c,[side*3.5,.95,-2],[.5,.65,.5],true);}mesh(g,new THREE.TorusGeometry(3.65,.22,5,16,Math.PI),0x437957,[0,3.7,-5]);label(g,'THE PEOPLE ZOO',[0,6.45,-4.8],3.8);}

  }
 }
 gelatoCart(g,x,z){const p=group(g,[x,0,z]);box(p,0xe68b72,[0,.83,0],[1.8,1.35,1.1]);box(p,0xffe1a7,[0,1.54,0],[2,.15,1.3]);for(let s of [-1,1]){const w=cylinder(p,0x394f43,[s*.68,.30,0],.3,.12);w.rotation.x=Math.PI/2;box(p,0xeadbb7,[s*.80,2.1,0],[.06,1.3,.06]);}for(let i=0;i<6;i++)box(p,i%2?0xfcdfa4:0xcc644a,[-.85+i*.34,2.72,0],[.34,.16,1.7]);label(p,'GELATO',[0,.99,.56],1.6);}
 icecream(g,x,y,z){const p=group(g,[x,y,z]);const c=cone(p,0xc99451,[0,0,0],.16,.42);c.rotation.z=Math.PI;ball(p,0xb5ce7c,[0,.25,0],[.21,.21,.21],true);}
 removeObject(g){g.traverse(o=>{if(o.isMesh){if(![boxGeo,ballGeo,coarseGeo].includes(o.geometry))o.geometry.dispose();if(o.material.map&&!Array.from(materials.values()).includes(o.material)){o.material.map.dispose();o.material.dispose();}}});this.root.remove(g);}
 obstacle(type,lane,distance){
 const g=group(this.root,[lane*2.3,0,4-distance]);g.userData={type,lane,distance};
 if(type==='coin'){const coin=cylinder(g,0xfbd065,[0,1,0],.24,.10,8);coin.rotation.x=Math.PI/2;box(g,0xffe7a0,[0,1,.065],[.075,.25,.025]);}
 else if(type==='heart'){ball(g,0xe68a79,[-.13,1,0],[.21,.22,.16]);ball(g,0xe68a79,[.13,1,0],[.21,.22,.16]);const h=cone(g,0xe68a79,[0,.78,0],.29,.35,4);h.rotation.z=Math.PI;}
 else if(type==='spring'){mushroom(g,0,0,2.1);const ring=new THREE.Mesh(new THREE.RingGeometry(.85,1,16),new THREE.MeshBasicMaterial({color:0xf6d277,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.015;g.add(ring);}
 else if(type==='gap'){box(g,0x6eafab,[0,.008,0],[2.2,.02,3.8]);for(let i=0;i<4;i++)box(g,0xa6d4be,[(i%2?-.4:.4),.025,-1.4+i*.8],[.8,.012,.07]);}
 else if(type==='window'){
  for(let s of [-1,1])box(g,0x73927c,[s*3.05,2.6,0],[3.7,5.2,.35]);box(g,0x73927c,[0,4.5,0],[2.5,1.4,.35]);box(g,0xe4c79a,[0,.44,0],[2.5,.88,.6]);for(let s of [-1,1])box(g,0xffe8b5,[s*1.26,2.25,0],[.15,3.4,.4]);box(g,0xffe8b5,[0,3.9,0],[2.6,.15,.4]);label(g,'FREEDOM ↑',[0,4.58,.25],2.5);
 }else if(type==='finish'){label(g,this.theme==='zoo'?'GOOSE MICHAEL ↓':'THE ZOO →',[0,3.5,0],5);for(let s of [-1,1])box(g,0x7d6145,[s*3,1.7,0],[.18,3.4,.18]);}
 else if(type==='gate'){
  for(let s of [-1,1])box(g,0x326d5a,[s*.95,1,0],[.18,2,.25]);for(let i=0;i<6;i++)box(g,i%2?0xece2b5:0xd96e4c,[-.8+i*.32,.95,0],[.32,.34,.28]);label(g,'DOOK!',[0,1.75,.04],1.65);
 }else if(type==='low'){
  if(this.theme==='house'){box(g,0x946a48,[0,1.47,0],[2.05,.27,1.6]);for(let s of [-1,1])box(g,0x70513b,[s*.89,.71,0],[.18,1.42,1.5]);box(g,0xdac395,[0,1.70,0],[1.2,.18,.8]);}
  else if(this.theme==='woods'){const b=cylinder(g,0x6b4a33,[0,1.5,0],.23,2.25,6);b.rotation.z=Math.PI/2;ball(g,0x567c42,[.9,1.64,0],[.5,.4,.4],true);}
  else{for(let s of [-1,1])box(g,0x3e6857,[s*.92,.85,0],[.1,1.7,.1]);box(g,0xf1bd76,[0,1.5,0],[1.95,.55,.18]);label(g,'DUCK!',[0,1.52,.10],1.7);}
 }else if(type==='sock'){box(g,0x719f9a,[0,.3,0],[1.45,.6,1]);box(g,0xe9d9aa,[-.45,.63,0],[.4,.08,.9]);}
 else if(this.theme==='house'){box(g,0xca9d65,[0,.48,0],[1.6,.96,1.15]);box(g,0xebc388,[0,.99,0],[1.68,.09,1.2]);label(g,'VERY FRAGILE',[0,.5,.582],1.4);}
 else if(this.theme==='woods'){const log=cylinder(g,0x775238,[0,.47,0],.48,1.85,7);log.rotation.z=Math.PI/2;const cap=cylinder(g,0xc09559,[.94,.47,0],.39,.04,7);cap.rotation.z=Math.PI/2;}
 else{box(g,0xd08460,[0,.54,0],[1.7,1.08,1.1]);box(g,0x669577,[0,1.12,0],[1.8,.14,1.2]);ball(g,0x739357,[0,1.25,0],[.7,.25,.45],true);}
 return g;
 }
 update(t,dt,state){
  const run=this.mode==='run';if(run){
   const dz=state.speed*dt;if(state.playing){this.groundTexture.offset.y-=dz/5;for(const c of this.chunks){c.position.z+=dz;if(c.position.z>15)c.position.z-=150;}}
   this.player.group.position.x=state.laneX;this.player.group.position.y=state.height;this.player.group.rotation.z=THREE.MathUtils.lerp(this.player.group.rotation.z,(state.lane*2.3-this.player.group.position.x)*-.1,dt*12);
   this.poseTime=(this.poseTime||0)+(state.playing?dt:0);this.player.animate(this.poseTime,true,state.slide,{height:state.height,velocity:state.velocity,speed:state.speed,dook:state.dook>0,roll:state.rollDuration?state.rollTime/state.rollDuration:0});this.player.group.scale.setScalar(1);this.player.group.visible=state.invincible>0?Math.floor(t*13)%3!==0:true;
   this.camera.position.set(state.shake?(Math.sin(t*70)*.1):0,5.25+state.height*.10,12.8);this.camera.lookAt(0,.85,-9);const speedRush=THREE.MathUtils.clamp((state.speed-31.5)/34.5,0,1);this.camera.fov=(this.width>this.height?51:62)+speedRush*5;
  }else{
   this.player.animate(t,false,false,{look:this.mode==='title'?.42:0,expression:this.mode==='title'||this.mode==='ending'?'happy':'grin'});this.player.group.scale.setScalar(this.playerScale);this.friend.animate(t);
   const mobile=this.width/this.height<.8;const ending=this.mode==='ending';if(ending&&mobile)this.player.group.scale.setScalar(1.4);
   if(this.mode==='title'){this.player.group.position.x=mobile?.55:1.1;this.player.group.scale.setScalar(mobile?1.45:1.65);this.friend.group.position.x=mobile?2.4:3.5;this.friend.group.position.z=mobile?(this.height<650?2.2:1.8):-1;this.friend.group.scale.setScalar(mobile?.80:.96);}this.camera.position.set(mobile?6:10,mobile?6.3:6.0,mobile?13:12);this.camera.lookAt(ending?0:mobile?1.15:-1.4,ending?1:mobile?1.7:1.0,0);this.camera.fov=mobile?53:42;
  }
  this.camera.updateProjectionMatrix();this.renderer.render(this.scene,this.camera);
 }
}
