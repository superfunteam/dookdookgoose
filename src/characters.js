import * as THREE from 'three';
import ferretSculpt from './models/ferret.json';
import gooseSculpt from './models/goose.json';
import {makeScarf} from './ferret-scarf.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const clamp=THREE.MathUtils.clamp;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const frac=x=>x-Math.floor(x);
const palette={sable:0x967344,dorsal:0xc2a26b,cream:0xe8cfa0,paw:0x39291c,mask:0x674a2c,white:0xf2e8cc,orange:0xda7c16,green:0x46502a};
// Sample the painted fur swatch in the approved sheet, retaining its uneven pixel clusters.
const furAtlas=new THREE.TextureLoader().load('/art/character-reference.png');
furAtlas.colorSpace=THREE.SRGBColorSpace;furAtlas.magFilter=THREE.NearestFilter;furAtlas.minFilter=THREE.NearestFilter;furAtlas.generateMipmaps=false;
const solidCache=new Map();
function material(color,kind='solid'){
 const key=`${color}-${kind}`;if(solidCache.has(key))return solidCache.get(key);
 const m=new THREE.MeshStandardMaterial({color:['ferret','goose'].includes(kind)?0xffffff:color,roughness:.97,flatShading:kind!=='ferret',vertexColors:kind==='ferret'});
 m.onBeforeCompile=shader=>{
  shader.uniforms.furAtlas={value:furAtlas};
  shader.uniforms.furSable={value:new THREE.Color(palette.sable)};shader.uniforms.furTop={value:new THREE.Color(palette.dorsal)};shader.uniforms.furCream={value:new THREE.Color(palette.cream)};shader.uniforms.furDark={value:new THREE.Color(palette.paw)};shader.uniforms.furMask={value:new THREE.Color(palette.mask)};shader.uniforms.gooseWhite={value:new THREE.Color(palette.white)};
  shader.vertexShader='varying vec3 sculptPosition;\nvarying vec3 sculptNormal;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nsculptPosition=position; sculptNormal=normal;');
  shader.fragmentShader=`varying vec3 sculptPosition; varying vec3 sculptNormal;
   uniform vec3 furSable,furTop,furCream,furDark,furMask,gooseWhite;uniform sampler2D furAtlas;
   float texelHash(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}
  `+shader.fragmentShader;
  const common=`vec3 p=sculptPosition;
   vec3 n=abs(sculptNormal); vec2 uv=n.z>n.x&&n.z>n.y?p.xy:n.x>n.y?p.zy:p.xz;
   vec2 pixel=floor(uv*15.0);float fleck=texelHash(vec3(pixel,2.0));
   float mottle=texelHash(vec3(floor(uv*5.0),5.0));
   float grain=.89+fleck*.14+mottle*.04;`;
  const fur=`vec3 pigment=mix(furDark,furSable,smoothstep(.36,.91,p.y));
   pigment=mix(pigment,furTop,smoothstep(.88,1.19,p.y)*.88);
   if(abs(p.x)>.25&&p.y<.80){pigment=mix(furDark,pigment,smoothstep(.29,.89,p.y));}
   float chest=smoothstep(.83,1.12,p.z)*smoothstep(.86,1.25,p.y);
   float face=smoothstep(1.74,1.97,p.y)*smoothstep(.73,.95,p.z);
   pigment=mix(pigment,furCream,max(chest,face));
   vec2 e=vec2((abs(p.x)-.275)/.184,(p.y-2.235)/.202);
   float eyeField=max(abs(e.x)*.85+abs(e.y)*.42,abs(e.y)*.91+abs(e.x)*.20);
   float bridge=max(abs(p.x)/.28,abs((p.y-2.225)/.13));
   float mask=(1.0-smoothstep(.985,1.015,min(eyeField,bridge)))*smoothstep(1.25,1.37,p.z);
   pigment=mix(pigment,furMask*mix(1.0,1.22,1.0-smoothstep(.10,.29,abs(p.x))),mask);
   float muzzle=(1.0-smoothstep(.96,1.08,length(vec2(p.x/.30,(p.y-1.985)/.160))))*smoothstep(1.40,1.49,p.z);
   pigment=mix(pigment,furCream,muzzle);
   pigment=mix(pigment,furDark,smoothstep(1.42,2.22,-p.z)*.84);
   vec2 tile=fract(uv/.56);
   vec2 artUV=vec2((402.0+tile.x*64.0)/1149.0,1.0-(455.0+tile.y*64.0)/1369.0);
   vec3 painted=texture2D(furAtlas,artUV).rgb;
   float paintedValue=clamp(1.0+(dot(painted,vec3(.2126,.7152,.0722))-.436)*mix(3.2,4.2,face),.55,1.35);
   diffuseColor.rgb*=pigment*mix(grain,paintedValue,.80);`;
  const goose=`vec3 pigment=mix(gooseWhite*.67,gooseWhite,smoothstep(.2,1.2,p.y)*.30+.67);diffuseColor.rgb*=pigment*(.86+fleck*.13+mottle*.13);`;
  if(kind==='ferret')shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
   vec3 facetNormal=normalize(cross(dFdx(vViewPosition),dFdy(vViewPosition)));
   float faceSoftness=smoothstep(1.62,1.92,sculptPosition.y)*smoothstep(1.08,1.32,sculptPosition.z);
   normal=normalize(mix(normal,facetNormal,mix(.92,.40,faceSoftness)));
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\n${common}\n${kind==='ferret'?fur:kind==='goose'?goose:kind==='waffle'?'float u=atan(p.z,p.x)*2.6;float v=p.y*12.0;float seam=min(abs(fract(u+v)-.5),abs(fract(u-v)-.5));diffuseColor.rgb*=grain*(.60+.40*smoothstep(.035,.13,seam));':'diffuseColor.rgb*=grain;'}`);
 };
 m.customProgramCacheKey=()=>`sculpt-${kind}`;solidCache.set(key,m);return m;
}
const eyeMat=new THREE.MeshStandardMaterial({color:0x11120a,roughness:.58,metalness:0,flatShading:true});
const shineMat=new THREE.MeshBasicMaterial({color:0xfff7df});
function add(parent,geometry,mat,pos=V(),scale=V(1,1,1)){
 const m=new THREE.Mesh(geometry,mat);m.position.copy(pos);m.scale.copy(scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function oval(parent,color,pos,scale,detail=1){const geo=new THREE.IcosahedronGeometry(1,detail);geo.scale(...scale);return add(parent,geo,typeof color==='number'?material(color):color,V(...pos));}
function geometryFrom(data){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));g.setIndex(data.indices);g.computeVertexNormals();return g;}
function polygon(parent,vertices,indices,color){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flat(),3));geo.setIndex(indices);geo.computeVertexNormals();const m=add(parent,geo,material(color));m.material.side=THREE.DoubleSide;return m;}
function loft(parent,rings,color,segments=10){
 const vertices=[],indices=[];for(const ring of rings){const [x,y,z,rx,ry]=ring;for(let j=0;j<segments;j++){const a=j/segments*Math.PI*2;vertices.push([x+Math.cos(a)*rx,y+Math.sin(a)*ry,z]);}}
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<segments;j++){const a=i*segments+j,b=i*segments+(j+1)%segments,c=a+segments,d=b+segments;indices.push(a,b,c,b,d,c);}
 for(const [i,reverse] of [[0,true],[rings.length-1,false]]){const center=vertices.length;vertices.push(rings[i].slice(0,3));for(let j=0;j<segments;j++){const a=i*segments+j,b=i*segments+(j+1)%segments;indices.push(center,reverse?b:a,reverse?a:b);}}
 return polygon(parent,vertices,indices,color);
}
function bone(rig,name,rest,parent=rig.root){const b=new THREE.Bone();b.name=name;b.userData.rest=V(...rest);b.position.copy(b.userData.rest);if(parent.isBone)b.position.sub(parent.userData.rest);parent.add(b);rig.bones.push(b);return b;}
function blendZ(z,stations){for(let i=0;i<stations.length-1;i++){if(z<=stations[i+1][0]){const w=clamp((z-stations[i][0])/(stations[i+1][0]-stations[i][0]),0,1);return [[stations[i][1],1-w],[stations[i+1][1],w]];}}return [[stations.at(-1)[1],1]];}
function skin(geo,rig,weights,mat){
 const ids=[],values=[];const p=geo.attributes.position;
 for(let i=0;i<p.count;i++){
  const entries=weights(V(p.getX(i),p.getY(i),p.getZ(i)));const merged=new Map();for(const [b,w] of entries)if(w>0)merged.set(b,(merged.get(b)||0)+w);
  const best=[...merged].sort((a,b)=>b[1]-a[1]).slice(0,4);const sum=best.reduce((s,x)=>s+x[1],0)||1;
  for(let j=0;j<4;j++){ids.push(best[j]?rig.bones.indexOf(best[j][0]):0);values.push(best[j]?best[j][1]/sum:0);}
 }
 geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(ids,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(values,4));
 const mesh=new THREE.SkinnedMesh(geo,mat);mesh.name=rig.name+' continuous skin';mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;rig.root.add(mesh);rig.root.updateMatrixWorld(true);const skeleton=new THREE.Skeleton(rig.bones);mesh.bind(skeleton);rig.mesh=mesh;rig.skeleton=skeleton;return mesh;
}
const tmpQ=new THREE.Quaternion(),parentQ=new THREE.Quaternion();
function poseBone(rig,b,target,rx=0,ry=0,rz=0){
 rig.root.updateWorldMatrix(true,false);b.parent.updateWorldMatrix(true,false);
 const world=rig.root.localToWorld(target.clone());b.position.copy(b.parent.worldToLocal(world));
 rig.root.getWorldQuaternion(tmpQ);tmpQ.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)));
 b.parent.getWorldQuaternion(parentQ);b.quaternion.copy(parentQ.invert().multiply(tmpQ));b.updateWorldMatrix(false,true);
}
function solveLeg(rig,leg,target,bend){
 const [upper,lower,foot]=leg.bones;rig.root.updateWorldMatrix(true,true);
 const a=upper.getWorldPosition(V()),end=rig.root.localToWorld(target.clone());
 const scale=rig.root.getWorldScale(V()).y,l1=leg.lengths[0]*scale,l2=leg.lengths[1]*scale;
 const up=V(0,1,0).applyQuaternion(rig.root.getWorldQuaternion(new THREE.Quaternion()));
 const reach=end.clone().sub(a),vertical=reach.dot(up),horizontal=reach.clone().addScaledVector(up,-vertical);
 const maxHorizontal=Math.sqrt(Math.max(.0001,(l1+l2-.002)**2-vertical*vertical));
 if(horizontal.length()>maxHorizontal){horizontal.setLength(maxHorizontal);end.copy(a).addScaledVector(up,vertical).add(horizontal);}
 const delta=end.clone().sub(a),distance=delta.length(),unit=delta.normalize(),d=clamp(distance,.03,l1+l2-.001);
 const along=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along));
 const bendWorld=V(0,0,bend).applyQuaternion(rig.root.getWorldQuaternion(new THREE.Quaternion()));bendWorld.addScaledVector(unit,-bendWorld.dot(unit)).normalize();
 const knee=a.clone().addScaledVector(unit,along).addScaledVector(bendWorld,height);
 const localKnee=upper.parent.worldToLocal(knee.clone()).sub(upper.position).normalize();upper.quaternion.setFromUnitVectors(leg.restDirections[0],localKnee);upper.updateWorldMatrix(false,true);
 const localFoot=lower.parent.worldToLocal(end.clone()).sub(lower.position).normalize();lower.quaternion.setFromUnitVectors(leg.restDirections[1],localFoot);lower.updateWorldMatrix(false,true);
 foot.parent.getWorldQuaternion(parentQ);rig.root.getWorldQuaternion(tmpQ);foot.quaternion.copy(parentQ.invert().multiply(tmpQ));foot.updateWorldMatrix(false,true);
}
function makeEar(head,side){
 const ear=new THREE.Group();ear.position.set(side*.435,.260,-.055);ear.scale.set(.87,.80,1);ear.rotation.z=side*-.21;head.add(ear);
 loft(ear,[[0,0,-.065,.16,.195],[0,.013,.002,.178,.225],[0,.018,.060,.128,.168],[0,.008,.027,.06,.085]],0xa58153,7);
 loft(ear,[[0,.015,.064,.116,.156],[0,.01,.073,.088,.120],[0,-.01,.056,.025,.052]],0x875137,7);
}
function makeFerretFace(head,rig,faceRig){
 const attach=(mesh,b)=>{mesh.position.y-=.06;b.add(mesh);mesh.position.sub(b.userData.rest.clone().sub(head.userData.rest));return mesh;};
 for(const side of [-1,1]){
  makeEar(head,side);
  const socket=oval(head,0x352819,[side*.275,.041,.243],[.098,.136,.025],1);socket.rotation.y=side*.40;
  const eye=oval(head,eyeMat,[side*.275,.041,.259],[.077,.118,.036],1);eye.rotation.y=side*.40;
  oval(head,shineMat,[side*.263,.081,.295],[.026,.029,.008],1);
  oval(head,0x25291c,[side*.281,.007,.293],[.031,.029,.005],0);
 }
 // The smile's cheeks and chin are now part of the continuous sculpt.
 const nose=polygon(head,[[-.087,-.066,.575],[.087,-.066,.575],[.070,-.107,.607],[0,-.141,.611],[-.070,-.107,.607],[0,-.079,.626]],[0,1,5,1,2,5,2,3,5,3,4,5,4,0,5],0xa96755);
 const noseShine=polygon(head,[[-.072,-.067,.577],[.072,-.067,.577],[0,-.081,.628]],[0,1,2],0xcd947c);
 for(const side of [-1,1]){
  const nostril=polygon(head,[[side*.020,-.108,.622],[side*.060,-.093,.618],[side*.055,-.112,.618],[side*.027,-.122,.619]],[0,1,2,0,2,3],0x4b2520);attach(nostril,faceRig.snout);
 }
 const philtrum=polygon(head,[[-.007,-.136,.613],[.007,-.136,.613],[.005,-.162,.573],[-.005,-.162,.573]],[0,1,2,0,2,3],0x644530);attach(philtrum,faceRig.snout);
 attach(nose,faceRig.snout);attach(noseShine,faceRig.snout);
 const oral=polygon(head,[[-.139,-.224,.423],[.139,-.224,.423],[.103,-.303,.428],[.044,-.374,.435],[0,-.386,.442],[-.044,-.374,.435],[-.103,-.303,.428],[0,-.290,.355],[0,-.189,.454]], [0,8,7,8,1,7,1,2,7,2,3,7,3,4,7,4,5,7,5,6,7,6,0,7],0x2c180f);
 const mouthColors=[];
 for(let i=0;i<oral.geometry.attributes.position.count;i++){
  const color=new THREE.Color(i===7?0x2c1712:i>1&&i<7?0x673b29:0x42241b);mouthColors.push(color.r,color.g,color.b);
 }
 oral.geometry.setAttribute('color',new THREE.Float32BufferAttribute(mouthColors,3));
 oral.material=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide});
 oral.removeFromParent();oral.geometry.translate(0,-.05,0);oral.geometry.translate(...head.userData.rest.toArray());
 const oralRig={...rig,name:'Ferret smile interior'};
 faceRig.mouth=skin(oral.geometry,oralRig,p=>{const top=smooth(1.78,1.89,p.y);return [[faceRig.jaw,1-top],[faceRig.muzzles[p.x<0?0:1],top]];},oral.material);
 const tongue=loft(head,[[0,-.262,.32,.041,.019],[0,-.296,.38,.063,.025],[0,-.332,.433,.073,.027],[0,-.349,.473,.060,.023],[0,-.351,.483,.035,.010]],0xb86d52,10);tongue.removeFromParent();tongue.geometry.translate(0,-.05,0);tongue.geometry.translate(...head.userData.rest.toArray());
 const tongueRig={...rig,name:'Ferret tongue'};
 faceRig.tongue=skin(tongue.geometry,tongueRig,p=>{const jawWeight=.35+.65*smooth(1.48,1.62,p.z);return [[faceRig.jaw,jawWeight],[head,1-jawWeight]];},tongue.material);
 for(const side of [-1,1]){
  const fang=add(head,new THREE.ConeGeometry(.011,.022,4),material(0xf7e3b6),V(side*.091,-.233,.436));fang.rotation.z=Math.PI;attach(fang,faceRig.muzzles[side<0?0:1]);
  const lipPoints=[V(side*.057,-.191,.492),V(side*.115,-.213,.496),V(side*.185,-.218,.477),V(side*.228,-.198,.437)];
  const lip=new THREE.Line(new THREE.BufferGeometry().setFromPoints(lipPoints),new THREE.LineBasicMaterial({color:0x4d3522}));head.add(lip);attach(lip,faceRig.muzzles[side<0?0:1]);
  for(let i=0;i<3;i++){
   const points=[V(side*.185,-.105-i*.036,.473),V(side*.35,-.075-i*.070,.473),V(side*(.54+i*.015),-.028-i*.125,.418)];
   const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x382719,transparent:true,opacity:.85}));head.add(line);attach(line,faceRig.muzzles[side<0?0:1]);
  }
 }
}
export function ferret(parent,pos=[0,0,0],scale=1){
 const outer=new THREE.Group();outer.position.set(...pos);outer.scale.setScalar(scale);parent.add(outer);const rollPivot=new THREE.Group();rollPivot.position.y=.94;outer.add(rollPivot);const root=new THREE.Group();root.position.y=-.94;rollPivot.add(root);const rig={root,bones:[],name:'Ferret'};
 const pelvis=bone(rig,'pelvis',[0,.83,-1.0]);
 const lumbar=bone(rig,'spine.lumbar',[0,.85,-.50],pelvis);
 const thorax=bone(rig,'spine.thoracic',[0,.89,.10],lumbar);
 const shoulders=bone(rig,'spine.shoulders',[0,.94,.72],thorax);
 const neck=bone(rig,'neck',[0,1.35,1.04],shoulders);
 const head=bone(rig,'head',[0,2.17,1.15],neck);
 const tail1=bone(rig,'tail.01',[0,.77,-1.35],pelvis);
 const tail2=bone(rig,'tail.02',[.10,.56,-1.80],tail1);
 const tail3=bone(rig,'tail.03',[.23,.31,-2.23],tail2);
 const tail4=bone(rig,'tail.tip',[.29,.16,-2.63],tail3);
 const legs=[];
 for(const side of [-1,1])for(const fore of [true,false]){
  const name=`${fore?'fore':'hind'}.${side<0?'L':'R'}`;
  const points=fore?[[side*.29,.90,.70],[side*.37,.48,.81],[side*.40,.16,1.00]]:[[side*.31,.78,-1.02],[side*.35,.47,-.83],[side*.40,.16,-1.05]];
  const upper=bone(rig,name+'.upper',points[0],fore?shoulders:pelvis),lower=bone(rig,name+(fore?'.elbow':'.hock'),points[1],upper),foot=bone(rig,name+'.paw',points[2],lower);
  const dirs=[V(...points[1]).sub(V(...points[0])),V(...points[2]).sub(V(...points[1]))];
  const leg={side,fore,bones:[upper,lower,foot],points:points.map(p=>V(...p)),lengths:dirs.map(d=>d.length()),restDirections:dirs.map(d=>d.normalize())};legs.push(leg);
  for(let toe=0;toe<4;toe++){
   const claw=loft(foot,[[side*.0+(toe-1.5)*.070,-.095,.259,.022,.018],[(toe-1.5)*.070,-.111,.321,.003,.004]],0x241e17,4);
  }
 }
 const faceRig={jaw:bone(rig,'face.jaw',[0,1.83,1.26],head),snout:bone(rig,'face.snout',[0,2.07,1.455],head),muzzles:[],cheeks:[],brows:[]};
 for(const side of [-1,1]){
  const suffix=side<0?'L':'R';
  faceRig.muzzles.push(bone(rig,'face.muzzle.'+suffix,[side*.10,2.00,1.49],faceRig.snout));
  faceRig.cheeks.push(bone(rig,'face.cheek.'+suffix,[side*.30,1.98,1.365],head));
  faceRig.brows.push(bone(rig,'face.brow.'+suffix,[side*.275,2.30,1.38],head));
 }
 faceRig.bones=[faceRig.jaw,faceRig.snout,...faceRig.muzzles,...faceRig.cheeks,...faceRig.brows];
 for(const b of faceRig.bones)b.userData.localRest=b.position.clone();
 const spineStations=[[-1.05,pelvis],[-.5,lumbar],[.1,thorax],[.72,shoulders],[1.15,neck]];
 const weights=p=>{
  let primary=blendZ(p.z,spineStations);
  if(p.z< -1.33)primary=blendZ(-p.z,[[1.33,pelvis],[1.55,tail1],[1.96,tail2],[2.37,tail3],[2.63,tail4]]);
  const neckAmount=smooth(.93,1.39,p.y)*smooth(.59,.89,p.z);
  if(neckAmount>0){const neckWeights=blendZ(p.y,[[1.05,shoulders],[1.37,neck],[2.09,head]]);primary=[...primary.map(([b,w])=>[b,w*(1-neckAmount)]),...neckWeights.map(([b,w])=>[b,w*neckAmount])];}
  if(p.y<.85&&Math.abs(p.x)>.14&&p.z> -1.45){
   const leg=legs.find(l=>l.side===Math.sign(p.x)&&l.fore===(p.z>0));
   const local=smooth(.84,.40,p.y); // descending smoothstep is intentional
   const amount=local*smooth(.14,.31,Math.abs(p.x));
   const legWeights=p.y>.46?[[leg.bones[0],1]]:p.y>.18?[[leg.bones[0],smooth(.28,.48,p.y)],[leg.bones[1],1-smooth(.28,.48,p.y)]]:[[leg.bones[1],smooth(.105,.21,p.y)],[leg.bones[2],1-smooth(.105,.21,p.y)]];
   primary=[...primary.map(([b,w])=>[b,w*(1-amount)]),...legWeights.map(([b,w])=>[b,w*amount])];
  }
  // Keep the entire face rigid with the cranium; blend only through the throat.
  const skull=smooth(1.60,1.72,p.y)*smooth(1.07,1.34,p.z);
  primary=[...primary.map(([b,w])=>[b,w*(1-skull)]),[head,skull]];
  if(p.y>1.60&&p.z>1.13){
   const mixBone=(b,a)=>{a=clamp(a,0,1);primary=[...primary.map(([k,w])=>[k,w*(1-a)]),[b,a]];};
   const index=p.x<0?0:1,side=p.x<0?-1:1;
   const blob=(x,y,z,rx,ry,rz)=>Math.max(0,1-Math.hypot((p.x-x)/rx,(p.y-y)/ry,(p.z-z)/rz));
   mixBone(faceRig.snout,smooth(1.36,1.61,p.z)*smooth(1.90,2.01,p.y)*(1-smooth(2.14,2.27,p.y))*.80);
   mixBone(faceRig.muzzles[index],blob(side*.10,2.00,1.49,.22,.18,.265)*.85);
   mixBone(faceRig.cheeks[index],blob(side*.30,1.98,1.365,.23,.24,.26)*.65);
   mixBone(faceRig.brows[index],blob(side*.275,2.30,1.38,.24,.17,.25)*.70);
   mixBone(faceRig.jaw,(1-smooth(1.76,1.93,p.y))*smooth(1.17,1.39,p.z)*smooth(1.61,1.71,p.y));
  }
  return primary;
 };
 const bodyGeometry=geometryFrom(ferretSculpt).toNonIndexed(),faceColors=[];
 // Separate render corners keep each triangle's painted value flat; source topology stays welded.
 const bodyPositions=bodyGeometry.attributes.position;
 for(let i=0;i<bodyPositions.count;i+=3){const h=frac(Math.sin(bodyPositions.getX(i)*173+bodyPositions.getY(i)*271+bodyPositions.getZ(i)*113)*43758.54),shade=.96+h*.08;for(let j=0;j<3;j++)faceColors.push(shade,shade,shade);}
 bodyGeometry.setAttribute('color',new THREE.Float32BufferAttribute(faceColors,3));bodyGeometry.setIndex(Array.from({length:bodyPositions.count},(_,i)=>i));
 skin(bodyGeometry,rig,weights,material(0xffffff,'ferret'));
 makeFerretFace(head,rig,faceRig);head.scale.set(1.14,1.18,1.03);const scarfTails=makeScarf(neck);
 function animateFace(t,expression='grin',sample=false){
  const poses={neutral:[.05,-.33],grin:[.46,-.18],happy:[1,-.10],dook:[.82,-.02+(.5+.5*Math.sin(t*17))*.18]};
  const [targetSmile,targetJaw]=poses[expression]||poses.grin;
  const facialDelta=clamp(t-(faceRig.previousTime??t),0,.05),blend=sample||faceRig.smile===undefined||t<faceRig.previousTime?1:1-Math.exp(-facialDelta*14);
  const smile=THREE.MathUtils.lerp(faceRig.smile??targetSmile,targetSmile,blend),jaw=THREE.MathUtils.lerp(faceRig.jawAngle??targetJaw,targetJaw,blend);faceRig.previousTime=t;
  faceRig.tongue.visible=expression!=='neutral';
  for(const b of faceRig.bones){b.position.copy(b.userData.localRest);b.rotation.set(0,0,0);b.scale.set(1,1,1);}
  faceRig.jaw.rotation.x=jaw;
  faceRig.snout.position.y+=smile*.007+Math.sin(t*5.2)*.004;
  for(let i=0;i<2;i++){
   const side=i===0?-1:1,m=faceRig.muzzles[i],c=faceRig.cheeks[i],b=faceRig.brows[i];
   m.position.x+=side*smile*.050;m.position.y+=smile*.050;m.rotation.z=side*smile*.075;
   c.position.x+=side*smile*.035;c.position.y+=smile*.060;
   b.position.y+=smile*.025;b.rotation.z=-side*smile*.09;
  }
  faceRig.expression=expression;faceRig.smile=smile;faceRig.jawAngle=jaw;
 }
 const contact={};const stats={phase:0,arch:0,contacts:contact};let previousTime=0,previousHeight=0,landingTime=0,gaitClock=0,gaitRate=3.6;
 function animate(t,running=false,slide=false,options={}){
  // Running always uses the gathered, springy ferret bound. Scamper is an
  // explicit preview/animation choice rather than a speed-dependent fallback.
  const scamper=options.motion==='scamper',scamperBlend=scamper?1:0;
  const travelSpeed=Number.isFinite(options.speed)?options.speed:31.5;
  const targetRate=scamper?4.6:3.6+.5*smooth(31.5,45,travelSpeed)+.2*smooth(45,66,travelSpeed);
  const gaitDelta=clamp(t-previousTime,0,.05);if(options.sampleTime||t<previousTime){gaitRate=targetRate;gaitClock=t*gaitRate;}else{gaitRate=THREE.MathUtils.lerp(gaitRate,targetRate,gaitDelta*8);gaitClock+=gaitDelta*gaitRate;}const phase=frac(gaitClock),theta=phase*Math.PI*2;const roll=clamp(options.roll||0,0,1);rollPivot.rotation.z=Math.PI*2*smooth(.08,.87,roll);const rolling=roll>0&&roll<1;
  const h=options.height||0,dt=clamp(t-previousTime,0,.05);if(h<=.12&&previousHeight>.12&&(options.velocity||0)<0)landingTime=.22;landingTime=Math.max(0,landingTime-dt);const landing=landingTime>0?Math.sin((1-landingTime/.22)*Math.PI)*.075:0;previousHeight=h;previousTime=t;const airborne=h>.12,airBlend=smooth(.05,.55,h),tuck=smooth(.05,.25,roll)*(1-smooth(.74,.95,roll));const crouch=slide?1:0;
  const arch=running&&!slide?(.5+.5*Math.cos(theta+.35))*(1-.66*scamperBlend)*(1-airBlend):0;
  // Peak lift follows forepaw release into the stretched part of the bound;
  // the low part gathers the back and paws for the next spring. This is visual
  // body suspension, separate from the player's jump/collision height.
  const spring=Math.pow(.5+.5*Math.sin(theta-.95),1.3);
  const hop=running&&!airborne&&!slide?(scamper?.012+.055*(.5+.5*Math.sin(theta-.5)):.015+.210*spring):0;
  const breathing=running?0:Math.sin(t*2.4)*.012;
  const gather=arch*.20;
  const yDrop=crouch*.38+(running&&!slide?(scamper?.15:.17):0)+landing;
  const sway=running?Math.sin(theta)*.025:Math.sin(t*1.8)*.009;
  poseBone(rig,pelvis,V(sway,.83+hop+breathing-yDrop,-1+gather),-.12*arch);
  poseBone(rig,lumbar,V(-sway,.85+hop+arch*.39+breathing-yDrop,-.50+gather*.5),-.20*arch,0,sway);
  poseBone(rig,thorax,V(-sway*.5,.89+hop+arch*.31+breathing-yDrop,.10-gather*.3),.14*arch);
  poseBone(rig,shoulders,V(0,.94+hop-arch*.025-yDrop,.72-gather*.6),.18*arch);
  poseBone(rig,neck,V(0,1.35+hop-arch*.04-crouch*.66-(running?.15:0)-tuck*.10-landing,1.04-gather*.6),running?.09*Math.sin(theta):-.02,(options.look||0)*.30,Math.sin(t*2)*.012);
  poseBone(rig,head,V(0,2.17+hop-arch*.075-crouch*.91-(running?.42:0)-tuck*.20-landing,1.15-gather*.6+crouch*.17),airborne?-.13:crouch?.08:-.015,(options.look||0),running?Math.sin(theta)*.016:Math.sin(t*1.6)*.02);
  animateFace(t,options.expression||(options.dook?'dook':airborne?'happy':'grin'),options.sampleTime);
  const curl=running?0:1,wave=running?Math.sin(theta-.8)*.12:Math.sin(t*1.7)*.08;
  const tailBones=[tail1,tail2,tail3,tail4],tailTargets=[
   V(.03+wave,.77+hop-yDrop,-1.35+gather),
   V(.10+curl*.22+wave*1.4,.56-curl*.11+hop+arch*.10-yDrop*.6,-1.80+gather*.8),
   V(.23+curl*.40+wave*1.8,.31-curl*.10+hop+arch*.13-yDrop*.2,-2.23+curl*.12+gather*.5),
   V(.29+curl*.72+wave*2.1,.16-curl*.04+hop+arch*.15,-2.63+curl*.57+gather*.3)
  ];
  for(let i=0;i<tailBones.length;i++){
   const a=i===3?2:i,b=i===3?3:i+1;
   const restDirection=tailBones[b].userData.rest.clone().sub(tailBones[a].userData.rest).normalize();
   const direction=tailTargets[b].clone().sub(tailTargets[a]).normalize();
   const rotation=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(restDirection,direction));
   poseBone(rig,tailBones[i],tailTargets[i],rotation.x,rotation.y,rotation.z);
  }
  for(const leg of legs){
   const boundOffset=(leg.fore?0:.51)+(leg.side>0?.055:0),scamperOffset=leg.fore?(leg.side<0?0:.5):(leg.side<0?.55:.05);const offset=THREE.MathUtils.lerp(boundOffset,scamperOffset,scamperBlend);const q=frac(phase+offset);const duty=.40+.12*scamperBlend;
   let y=.16,z=leg.fore?(running?.94:1.0):(running?-1.0:-1.05);
   if(running&&!airborne&&!slide){
    if(q<duty){z+=(.5-q/duty)*(leg.fore?.48:.60);contact[leg.bones[0].name]=true;}
    else{const a=(q-duty)/(1-duty);z+=(-.5+a)*(leg.fore?.48:.60);y+=Math.sin(a*Math.PI)*(leg.fore?.34:.44)*(1-.45*scamperBlend);contact[leg.bones[0].name]=false;}
   }else if(airborne){y+=(leg.fore?.23:.35)+tuck*(leg.fore?.20:.08);z+=leg.fore?.30-tuck*.38:.25;contact[leg.bones[0].name]=false;}
   else if(slide){z+=leg.fore?.38:-.32;y=.12;contact[leg.bones[0].name]=true;}
   else contact[leg.bones[0].name]=true;
   solveLeg(rig,leg,V(leg.side*(slide?.48:.40),y,z),leg.fore?-1:1);
  }
  scarfTails.rotation.y=running?Math.sin(theta-1)*.3:Math.sin(t*2)*.08;
  scarfTails.rotation.z=running?-.2+Math.sin(theta)*.15:0;
  stats.phase=phase;stats.arch=arch;stats.hop=hop;stats.gaitRate=gaitRate;stats.motion=airborne?(rolling?'barrel-roll':'jump'):slide?'slide':running?(scamper?'scamper':'bound'):'idle';stats.roll=rollPivot.rotation.z;stats.expression=faceRig.expression;rig.root.updateMatrixWorld(true);rig.skeleton.update();
 }
 animate(0);
 return {group:outer,head,legs,tail:tail1,animate,rig,faceRig,stats,rollPivot};
}

function webFoot(parent,side){
 const points=[[-.09,.04,-.08],[.10,.04,-.08],[.23,.035,.30],[.105,.035,.34],[0,.035,.40],[-.12,.035,.34],[-.24,.035,.29]];
 const verts=[...points,...points.map(([x,y,z])=>[x,y-.055,z])],idx=[];for(let i=1;i<points.length-1;i++)idx.push(0,i,i+1,7,7+i+1,7+i);for(let i=0;i<7;i++){const n=(i+1)%7;idx.push(i,n,7+i,n,7+n,7+i);}const mesh=polygon(parent,verts,idx,0xcb7919);mesh.rotation.y=side*-.12;return mesh;
}
function gooseHat(head){
 const cap=new THREE.Group();cap.position.set(0,.355,-.015);cap.rotation.z=-.08;head.add(cap);
 const vertices=[],idx=[],rings=[[.31,0],[.46,-.105],[.48,-.14],[.32,-.025],[.27,.185],[.225,.23]];const n=12;
 for(const [r,y]of rings)for(let j=0;j<n;j++){const a=j/n*Math.PI*2;vertices.push([Math.cos(a)*r,y+(Math.sin(a)>.3?-.025:0),Math.sin(a)*r]);}
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<n;j++){const a=i*n+j,b=i*n+(j+1)%n;idx.push(a,b,a+n,b,b+n,a+n);}const center=vertices.length;vertices.push([0,.23,0]);for(let j=0;j<n;j++)idx.push(center,5*n+j,5*n+(j+1)%n);
 polygon(cap,vertices,idx,0x485127);
 const ribbon=add(cap,new THREE.CylinderGeometry(.29,.30,.075,12,1,true),material(0x343e20),V(0,.055,0));
}
function gelato(parent,side){
 const g=new THREE.Group();g.position.set(side*.57,1.45,.48);parent.add(g);
 const cone=add(g,new THREE.ConeGeometry(.19,.56,8),material(0xaa712d,'waffle'),V(0,0,0));cone.rotation.z=Math.PI;
 oval(g,side<0?0xa3af55:0xc36d55,[0,.33,0],[.25,.26,.24],1);
 for(let i=0;i<7;i++)oval(g,side<0?0x697332:0x943f34,[Math.cos(i*2.4)*.18,.30+(i%3)*.075,Math.sin(i*2.4)*.18],[.037,.027,.030],0);
 return g;
}
export function goose(parent,pos=[0,0,0],scale=1){
 const root=new THREE.Group();root.position.set(...pos);root.scale.setScalar(scale);parent.add(root);const rig={root,bones:[],name:'Goose Michael'};
 const body=bone(rig,'body',[0,.95,-.1]);const neck1=bone(rig,'neck.base',[0,1.42,.25],body);const neck2=bone(rig,'neck.mid',[0,1.95,.33],neck1);const head=bone(rig,'head',[0,2.48,.43],neck2);
 skin(geometryFrom(gooseSculpt),rig,p=>blendZ(p.y,[[.9,body],[1.42,neck1],[1.96,neck2],[2.39,head]]),material(0xffffff,'goose'));
 for(const side of [-1,1]){
  const e=oval(head,eyeMat,[side*.226,.077,.223],[.062,.086,.045],2);e.rotation.y=side*.42;
  oval(head,shineMat,[side*.215,.107,.262],[.020,.026,.010],1);
 }
 loft(head,[[0,-.10,.19,.19,.125],[0,-.12,.44,.21,.082],[0,-.145,.69,.14,.036],[0,-.14,.73,.04,.020]],0xdd8419,6);
 polygon(head,[[-.18,-.154,.39],[.18,-.154,.39],[.135,-.171,.68],[-.135,-.171,.68]],[0,1,2,0,2,3],0x784516);
 for(const side of [-1,1])oval(head,0x6e491a,[side*.12,-.032,.37],[.025,.01,.035],0);
 gooseHat(head);
 const wings=[];const treats=new THREE.Group();root.add(treats);treats.visible=false;
 for(const side of [-1,1]){
  const wing=new THREE.Group();wing.position.set(side*.46,1.19,-.06);root.add(wing);wings.push(wing);
  loft(wing,[[0,.13,.22,.11,.25],[side*.035,-.05,.0,.14,.39],[side*.04,-.21,-.30,.095,.26],[0,-.24,-.56,.013,.022]],0xdcd2b7,7);
  const leg=add(root,new THREE.CylinderGeometry(.06,.049,.33,6),material(0xc47818),V(side*.245,.21,.055));
  const foot=new THREE.Group();foot.position.set(side*.245,.05,.06);root.add(foot);webFoot(foot,side);
  gelato(treats,side);loft(treats,[[side*.44,1.20,.01,.17,.26],[side*.53,1.20,.26,.14,.23],[side*.57,1.31,.50,.13,.15],[side*.55,1.39,.53,.07,.06]],0xe2d8be,8);
 }
 return {group:root,treats,head,rig,animate(t){
  poseBone(rig,body,V(0,.95+Math.sin(t*1.8)*.012,-.1),0,0,Math.sin(t*1.8)*.012);
  poseBone(rig,neck1,V(0,1.42,.25),0,0,Math.sin(t*1.8+.4)*.012);
  poseBone(rig,neck2,V(0,1.95,.33),Math.sin(t*1.4)*.018);
  poseBone(rig,head,V(0,2.48,.43),-.045,Math.sin(t*1.2)*.055,Math.sin(t*1.6)*.025);
  wings.forEach((w,i)=>{w.rotation.z=(i===0?1:-1)*(treats.visible?.5:.08);w.rotation.x=treats.visible?-.3:Math.sin(t*1.8)*.025;});rig.skeleton.update();
 }};
}
