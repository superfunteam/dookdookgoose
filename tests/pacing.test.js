import test from 'node:test';
import assert from 'node:assert/strict';
import {LEVELS,makeCourse} from '../src/data.js';
import {PACE,runSpeed,travelTime,distanceAtTime,crossesObstacle,impactFraction} from '../src/pacing.js';

test('fast runs last sixty to eighty seconds with room to read each encounter',()=>{
 for(const [index,originalSpeed] of [10.5,12,13].entries()){
  const level=LEVELS[index];
  assert.equal(level.speed/originalSpeed,3);
  assert.ok(travelTime(level,level.length)>=60&&travelTime(level,level.length)<=80);
  assert.ok(runSpeed(level,level.length)<=PACE.storyMaxSpeed);
  const hazards=makeCourse(level).filter(e=>!['coin','heart','window','finish'].includes(e.type));
  assert.ok(hazards.length>=35&&hazards.length<=55);
  assert.ok(travelTime(level,hazards[0].distance)>=2.5);
  assert.ok(travelTime(level,level.length)-travelTime(level,hazards.at(-1).distance)>=2.3);
  for(let i=1;i<hazards.length;i++){
   const previous=hazards[i-1],current=hazards[i];
   const elapsed=travelTime(level,current.distance)-travelTime(level,previous.distance);
   if(previous.type==='spring'&&current.type==='gap')assert.ok(Math.abs(elapsed-PACE.springGapSeconds)<1e-8);
   else assert.ok(elapsed>=1.3-1e-8&&elapsed<=1.8+1e-8,`${level.id}: ${elapsed} s between hazards`);
  }
 }
 assert.equal(runSpeed(LEVELS[1],1e6,true),66);
});

test('course time and distance agree through acceleration and speed caps',()=>{
 for(const level of LEVELS)for(const endless of [false,true]){
  for(const distance of [0,100,level.length,15000,100000]){
   const time=travelTime(level,distance,endless);
   assert.ok(Math.abs(distanceAtTime(level,time,endless)-distance)<1e-7);
   const step=.0001;
   const speed=(distanceAtTime(level,time+step,endless)-distance)/step;
   assert.ok(Math.abs(speed-runSpeed(level,distance,endless))<.001);
  }
 }
});

test('high-speed collision sweeps cannot tunnel through an obstacle between frames',()=>{
 const events=[.25,1,2.1,3],previous=0,current=66*.05;
 assert.equal(events.filter(d=>crossesObstacle(d,previous,current)).length,events.length);
 assert.equal(crossesObstacle(4.3,previous,current),false);
 assert.equal(crossesObstacle(-1.1,previous,current),false);
 assert.equal(impactFraction(1,previous,current),1/current);
 assert.equal(impactFraction(-.5,previous,current),0);
 assert.equal(impactFraction(4,previous,current),1);
});

test('mushroom-to-creek travel time preserves a safe roll at every speed',()=>{
 const height=(v,t)=>v*t-.5*PACE.gravity*t*t;
 for(const level of LEVELS)for(const endless of [false,true])for(const offset of [0,1200,14400,60000]){
  const course=makeCourse(level,endless,7,offset);
  for(const gap of course.filter(event=>event.type==='gap')){
   const time=travelTime(level,gap.distance,endless)-PACE.springGapSeconds;
   const springDistance=distanceAtTime(level,time,endless);
   assert.ok(gap.distance-springDistance>9);
   assert.ok(gap.distance-springDistance<19);
   assert.ok(.8+height(PACE.bigJumpVelocity,PACE.springGapSeconds)>3.5);
  }
 }
 assert.ok(height(PACE.jumpVelocity,.28)>1.5);
 assert.ok(2*PACE.jumpVelocity/PACE.gravity<.65);
 assert.ok(2*PACE.bigJumpVelocity/PACE.gravity>.8);
});
