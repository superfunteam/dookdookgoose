import * as THREE from 'three';
import {MarchingCubes} from 'three/addons/objects/MarchingCubes.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {writeFileSync,mkdirSync} from 'node:fs';
import {makeBodyShapes} from './ferret-body-shapes.mjs';
const smoothMin=(a,b,k)=>{const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;};
function ellipsoid(p,c,r){const x=(p[0]-c[0])/r[0],y=(p[1]-c[1])/r[1],z=(p[2]-c[2])/r[2];const k0=Math.hypot(x,y,z),k1=Math.hypot(x/r[0],y/r[1],z/r[2]);return k0*(k0-1)/(k1||1);}
function segment(p,a,b,ra,rb){const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2];const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy+(p[2]-a[2])*dz)/(dx*dx+dy*dy+dz*dz)));return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t,p[2]-a[2]-dz*t)-(ra+(rb-ra)*t);}
function sectionHead(p){
 const rings=[[1.65,.10,1.21,.12],[1.76,.27,1.23,.22],[1.94,.43,1.18,.335],[2.14,.535,1.13,.355],[2.35,.49,1.11,.34],[2.49,.36,1.11,.28],[2.535,.15,1.11,.17],[2.55,.012,1.11,.012]];
 let i=0;while(i<rings.length-2&&p[1]>rings[i+1][0])i++;
 const a=rings[i],b=rings[i+1],t=Math.max(0,Math.min(1,(p[1]-a[0])/(b[0]-a[0]))),mix=j=>a[j]+(b[j]-a[j])*t;
 const rx=mix(1),cz=mix(2),rz=mix(3);
 return Math.max((Math.hypot(p[0]/rx,(p[2]-cz)/rz)-1)*Math.min(rx,rz),rings[0][0]-p[1],p[1]-rings.at(-1)[0]);
}
function pawBlock(p,c,r){const t=Math.max(-1,Math.min(1,(p[2]-c[2])/r[2]));const q=[Math.abs(p[0]-c[0])-r[0]*(1-.10*t),Math.abs(p[1]-c[1]+.025*t)-r[1]*(1-.30*t),Math.abs(p[2]-c[2])-r[2]];return Math.hypot(...q.map(x=>Math.max(0,x)))+Math.min(0,Math.max(...q))-.02;}
const fShapes=[
 ...makeBodyShapes({ellipsoid,segment}),
 p=>segment(p,[0,1.00,.72],[0,1.89,1.08],.285,.345),
 sectionHead,
 p=>ellipsoid(p,[-.135,2.00,1.46],[.145,.125,.20]),
 p=>ellipsoid(p,[.135,2.00,1.46],[.145,.125,.20]),
 p=>ellipsoid(p,[0,2.09,1.455],[.125,.115,.20]),
 p=>ellipsoid(p,[0,1.73,1.40],[.16,.05,.12]),
 p=>segment(p,[0,.77,-1.30],[.09,.59,-1.72],.23,.20),
 p=>segment(p,[.09,.59,-1.72],[.22,.34,-2.16],.20,.13),
 p=>segment(p,[.22,.34,-2.16],[.29,.16,-2.63],.13,.012),
];
for(const side of [-1,1]){
 fShapes.push(p=>segment(p,[side*.29,.90,.70],[side*.37,.48,.81],.18,.12));
 fShapes.push(p=>segment(p,[side*.37,.48,.81],[side*.40,.16,1.00],.12,.08));
 fShapes.push(p=>pawBlock(p,[side*.40,.083,1.045],[.149,.050,.153]));
 fShapes.push(p=>ellipsoid(p,[side*.31,.80,-1.0],[.205,.30,.28]));
 fShapes.push(p=>segment(p,[side*.35,.55,-.83],[side*.40,.19,-1.05],.18,.09));
 fShapes.push(p=>pawBlock(p,[side*.40,.081,-.995],[.152,.048,.153]));
 for(let toe=0;toe<4;toe++){
  fShapes.push(p=>ellipsoid(p,[side*.40+(toe-1.5)*.070,.063,1.24+(1-Math.abs(toe-1.5))*.018],[.036,.044,.070]));
  fShapes.push(p=>ellipsoid(p,[side*.40+(toe-1.5)*.070,.061,-.80+(1-Math.abs(toe-1.5))*.018],[.036,.041,.066]));
 }
}
const gShapes=[
 p=>ellipsoid(p,[0,.94,-.12],[.56,.69,.66]),
 p=>ellipsoid(p,[0,1.27,.17],[.42,.52,.40]),
 p=>segment(p,[0,1.32,.23],[0,1.94,.32],.30,.195),
 p=>segment(p,[0,1.94,.32],[0,2.48,.40],.195,.20),
 p=>ellipsoid(p,[0,2.48,.43],[.31,.345,.34]),
 p=>segment(p,[0,.94,-.54],[0,1.30,-.99],.30,.02)
];
function build(name,shapes,bounds,res,target){
 const mc=new MarchingCubes(res,new THREE.MeshBasicMaterial(),false,false,100000);mc.isolation=0;const min=bounds[0],max=bounds[1];
 for(let z=0;z<res;z++)for(let y=0;y<res;y++)for(let x=0;x<res;x++){
  const p=[min[0]+x/res*(max[0]-min[0]),min[1]+y/res*(max[1]-min[1]),min[2]+z/res*(max[2]-min[2])];let d=10;
  for(const f of shapes)d=smoothMin(d,f(p),name==='ferret'?(p[1]<.22?.020:.055):.10);
  if(name==='ferret'){
   const smile=ellipsoid(p,[0,1.825,1.505],[.152*(.64+.36*Math.max(0,Math.min(1,(p[1]-1.73)/.19))),.095,.26]);
   const lipCleft=ellipsoid(p,[0,1.915,1.59],[.028,.035,.16]);
   d=Math.max(d,-smoothMin(smile,lipCleft,.024));
  }
  mc.field[x+y*res+z*res*res]=-d;
 }
 mc.update();let geo=new THREE.BufferGeometry();const source=mc.geometry.attributes.position;const arr=new Float32Array(mc.count*3);for(let i=0;i<mc.count;i++)for(let axis=0;axis<3;axis++)arr[i*3+axis]=min[axis]+(source.array[i*3+axis]+1)*.5*(max[axis]-min[axis]);geo.setAttribute('position',new THREE.BufferAttribute(arr,3));geo=mergeVertices(geo,.00001);console.log(name,'before',geo.attributes.position.count,geo.index.count/3);
 mkdirSync('output/model-build',{recursive:true});writeFileSync(`output/model-build/${name}-raw.json`,JSON.stringify({positions:Array.from(geo.attributes.position.array),indices:Array.from(geo.index.array)}));
 console.log(name,'raw sculpt saved for topology-preserving refinement');
}
build('ferret',fShapes,[[-.85,-.15,-2.9],[.85,2.9,2.0]],112,5200);
build('goose',gShapes,[[-.85,.1,-1.2],[.85,3.0,1.0]],56,1100);
