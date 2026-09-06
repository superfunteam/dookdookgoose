import test from 'node:test';
import assert from 'node:assert/strict';
import {LEVELS,makeCourse} from '../src/data.js';
import {PACE,runSpeed,crossesObstacle,impactFraction} from '../src/pacing.js';

test('triple travel speed keeps substantial chapters and adds action beats',()=>{
 for(const [index,original] of [{speed:10.5,length:420},{speed:12,length:510},{speed:13,length:540}].entries()){
  const level=LEVELS[index];
  assert.equal(level.speed/original.speed,3);
  assert.equal(level.length/level.speed,original.length/original.speed);
  assert.ok(makeCourse(level).filter(e=>level.obstacleTypes.includes(e.type)).length>55);
  assert.ok(runSpeed(level,level.length)<=PACE.storyMaxSpeed);
 }
 assert.equal(runSpeed(LEVELS[1],1e6,true),66);
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

test('compact jump clears a creek and big jump leaves time for a full roll',()=>{
 const height=(v,t)=>v*t-.5*PACE.gravity*t*t;
 for(const level of LEVELS){
  assert.ok(height(PACE.jumpVelocity,.28)>1.5);
  // Ten metres separate a mushroom launch and its creek, at every story speed.
  assert.ok(.8+height(PACE.bigJumpVelocity,10/level.speed)>1);
 }
 assert.ok(2*PACE.jumpVelocity/PACE.gravity<.65);
 assert.ok(2*PACE.bigJumpVelocity/PACE.gravity>.8);
});
