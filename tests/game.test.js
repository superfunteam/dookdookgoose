import test from 'node:test';
import assert from 'node:assert/strict';
import {LEVELS,makeCourse,resolveHit} from '../src/data.js';
import {PACE,travelTime} from '../src/pacing.js';
test('three distinct deterministic courses with collectible routes and final exits',()=>{for(const l of LEVELS){const c=makeCourse(l);assert.deepEqual(c,makeCourse(l));assert.ok(c.every(e=>e.lane>=-1&&e.lane<=1));assert.equal(c.at(-1).distance,l.length);assert.equal(c.at(-1).type,l.id==='house'?'window':'finish');assert.ok(c.some(e=>e.type==='coin'));assert.ok(c.some(e=>e.type==='heart'));assert.ok(c.every((e,i)=>i===0||e.distance>=c[i-1].distance));}});
test('house tables require slides and window requires a jump',()=>{assert.equal(resolveHit('low',{height:2,slide:false}),'damage');assert.equal(resolveHit('low',{height:0,slide:true}),'clear');assert.equal(resolveHit('window',{height:0}),'damage');assert.equal(resolveHit('window',{height:.9}),'escape');});
test('mushroom assisted creek jumps and dook gates use their own rules',()=>{assert.equal(resolveHit('spring',{height:0}),'clear');assert.equal(resolveHit('spring',{height:.7}),'bounce');assert.equal(resolveHit('gap',{height:.5}),'damage');assert.equal(resolveHit('gap',{height:1.1}),'clear');assert.equal(resolveHit('gate',{height:2,dook:false}),'damage');assert.equal(resolveHit('gate',{height:0,dook:true}),'clear');});
test('every creek follows its same-lane spring by a fixed safe flight time',()=>{
 const level=LEVELS[1],course=makeCourse(level);
 for(const gap of course.filter(e=>e.type==='gap')){
  const spring=course.filter(e=>e.type==='spring'&&e.distance<gap.distance).at(-1);
  assert.equal(spring.lane,gap.lane);
  assert.ok(Math.abs(travelTime(level,gap.distance)-travelTime(level,spring.distance)-PACE.springGapSeconds)<1e-8);
 }
});

test('coin trails guide safe lanes and resume after mushroom landings',()=>{
 for(const level of LEVELS){
  const course=makeCourse(level),encounters=course.filter(e=>!['coin','heart','gap','window','finish'].includes(e.type));
  for(let i=0;i<encounters.length;i++){
   const hazard=encounters[i],trail=course.filter(e=>e.type==='coin'&&e.distance<hazard.distance).slice(-3);
   assert.equal(trail.length,3);
   assert.ok(trail.every(coin=>coin.lane===trail[0].lane));
   if(['block','sock'].includes(hazard.type))assert.notEqual(trail[0].lane,hazard.lane);
   else assert.equal(trail[0].lane,hazard.lane);
   if(i>0&&encounters[i-1].type==='spring')assert.ok(travelTime(level,trail[0].distance)-travelTime(level,encounters[i-1].distance)>.95);
  }
  const hearts=course.filter(e=>e.type==='heart');
  assert.ok(hearts.length>=3&&hearts.length<=4);
  for(let i=0;i<hearts.length;i++){
   const heart=hearts[i],previous=encounters.filter(e=>e.distance<heart.distance).at(-1);
   assert.ok(!['spring','gap'].includes(previous.type));
   if(['block','sock'].includes(previous.type))assert.notEqual(heart.lane,previous.lane);
   if(i>0)assert.ok(travelTime(level,heart.distance)-travelTime(level,hearts[i-1].distance)>18);
  }
  assert.ok(course.filter(e=>e.type==='coin').slice(-3).every(coin=>coin.lane===0));
 }
});

test('endless segments share a global schedule without crowded seams or split mechanics',()=>{
 const level=LEVELS[1],length=PACE.endlessSegmentLength,course=[];
 for(let segment=0;segment<80;segment++){
  const events=makeCourse(level,true,11,segment*length);
  assert.ok(events.every(e=>e.distance>=segment*length&&e.distance<(segment+1)*length));
  assert.ok(!events.some(e=>['finish','window'].includes(e.type)));
  course.push(...events);
 }
 assert.equal(new Set(course.map(e=>`${e.type}/${e.lane}/${e.distance}`)).size,course.length);
 const hazards=course.filter(e=>!['coin','heart'].includes(e.type));let crossingPairs=0;
 for(let i=1;i<hazards.length;i++){
  const previous=hazards[i-1],current=hazards[i];
  const elapsed=travelTime(level,current.distance,true)-travelTime(level,previous.distance,true);
  if(current.type==='gap'){
   assert.equal(previous.type,'spring');assert.equal(previous.lane,current.lane);
   assert.ok(Math.abs(elapsed-PACE.springGapSeconds)<1e-8);
   if(Math.floor(previous.distance/length)!==Math.floor(current.distance/length))crossingPairs++;
  }else assert.ok(elapsed>=1.3-1e-8&&elapsed<=1.8+1e-8,`endless gap ${elapsed} s at ${current.distance}`);
 }
 assert.ok(crossingPairs>0,'exercise an actual mushroom/creek pair partitioned by a segment boundary');
 assert.notDeepEqual(makeCourse(level,true,11),makeCourse(level,true,12));
});
