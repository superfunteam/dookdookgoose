import {PACE,travelTime,distanceAtTime} from './pacing.js';
export const LEVELS = [
  { id:'house', name:'Breaking Out', subtitle:'A perfectly unreasonable escape.', number:'01', tag:'HOME, SWEET ESCAPE', length:750, speed:10.5, color:'#efb674', mechanic:'THE GREAT SQUEEZE', tip:'Swipe down to slide under furniture. At the window, jump for freedom!', obstacleTypes:['block','low','sock'], dialogues:[['GOOSE MICHAEL','At the zoo. Behind bars. Hurry. It’s melting.'],['PIP THE FERRET','BEHIND BARS?! Hold on, Goose Michael. I’m coming.'],['PIP THE FERRET','Door: locked. Brain: tiny. Window: extremely promising.']], exit:[['PIP THE FERRET','Window? Defenestrated. House? Escaped.'],['GOOSE MICHAEL','Get here soon. I can’t hold these much longer.'],['PIP THE FERRET','They’ve restrained his wings. This goes all the way to the top.']] },
  { id:'woods', name:'Into the Woods', subtitle:'No thoughts. Just woodland parkour.', number:'02', tag:'TAKE THE SCENIC PANIC', length:950, speed:12, color:'#b4d57b', mechanic:'MUSHROOM SPRINGS', tip:'Jump onto orange mushrooms for a super-bounce over the creek. Dodge logs and duck branches.', obstacleTypes:['block','low','gap','spring'], dialogues:[['PIP THE FERRET','The woods. A shortcut for someone with absolutely no map.'],['GOOSE MICHAEL','I’m by the primates. One of them is doing his taxes.'],['PIP THE FERRET','Psychological warfare. Stay strong, buddy.']], exit:[['PIP THE FERRET','I have eaten three bugs and become one with a shrub.'],['GOOSE MICHAEL','Pistachio or strawberry?'],['PIP THE FERRET','I don’t know your captors’ names, Goose.']] },
  { id:'zoo', name:'The Zoo', subtitle:'Something here is deeply human.', number:'03', tag:'OPERATION: LOOSE GOOSE', length:1050, speed:13, color:'#eca582', mechanic:'DOOK TO OPEN', tip:'Tap DOOK near striped gates to open them. Look closely at the exhibits…', obstacleTypes:['block','low','gate'], dialogues:[['PIP THE FERRET','I’m in. These enclosures are full of… accountants?'],['EXHIBIT SIGN','HOMO SAPIENS · Please do not feed the middle managers.'],['PIP THE FERRET','No time to unpack that. DOOK at the gates. Find Goose.']] }
].map(level=>({...level,length:level.length*PACE.multiplier,speed:level.speed*PACE.multiplier}));
export const ENDING = [['PIP THE FERRET','GOOSE MICHAEL! Step away from the bars!'],['GOOSE MICHAEL','Oh, there you are! I got you pistachio.'],['PIP THE FERRET','You said you were behind bars.'],['GOOSE MICHAEL','The gelato bars. And then I walked behind these bars. For shade.'],['PIP THE FERRET','I jumped out of a window.'],['GOOSE MICHAEL','That’s nice. Look, the humans are having a meeting.'],['PIP THE FERRET','…Do you think they know they’re in a zoo?'],['GOOSE MICHAEL','Do you think we do? Anyway. Yours is melting.']];
// Each beat is a complete, readable encounter. A paired mushroom and creek is
// one encounter, with recovery time before the next hazard. The fixed global
// clock lets adjacent endless chunks partition the same course without seams.
const ENCOUNTER_INTERVALS=[1.65,1.5,1.8,1.6,1.7,1.45,1.8,1.55];
const CYCLE_SECONDS=ENCOUNTER_INTERVALS.reduce((sum,time)=>sum+time,0);
const ROUTE=[1,0,-1,0,1,0,-1,0];
function variation(seed,index){
 let n=(seed^Math.imul(index+1,0x9e3779b1))>>>0;
 n=Math.imul(n^(n>>>16),0x85ebca6b);n=Math.imul(n^(n>>>13),0xc2b2ae35);
 return (n^(n>>>16))>>>0;
}
export function makeCourse(level,endless=false,seed=7,offset=0){
 const start=endless?offset:0,end=endless?offset+PACE.endlessSegmentLength:level.length;
 const endTime=travelTime(level,end,endless),startTime=travelTime(level,start,endless);
 const lastEncounter=endless?Infinity:endTime-PACE.finishApproachSeconds;
 const firstCycle=Math.max(0,Math.floor((startTime-PACE.courseOpeningSeconds)/CYCLE_SECONDS)-1);
 const finalCycle=Math.max(firstCycle,Math.ceil((endTime+1-PACE.courseOpeningSeconds)/CYCLE_SECONDS));
 const events=[];
 const emit=(type,lane,time)=>{
  const distance=distanceAtTime(level,time,endless);
  if(distance>=start&&distance<end)events.push({type,lane,distance});
 };
 for(let cycle=firstCycle;cycle<=finalCycle;cycle++){
  let time=PACE.courseOpeningSeconds+cycle*CYCLE_SECONDS;
  const direction=variation(seed,cycle)%2?1:-1;
  for(let beat=0;beat<ENCOUNTER_INTERVALS.length;beat++){
   const index=cycle*ENCOUNTER_INTERVALS.length+beat,type=level.obstacleTypes[index%level.obstacleTypes.length];
   if(time<=lastEncounter){
    const routeLane=ROUTE[beat]*direction;
    const obstacleLane=['block','sock'].includes(type)?(routeLane===0?(variation(seed,index+17)%2?1:-1):0):routeLane;
    if(type==='gap'){
     emit('spring',routeLane,time);
     emit('gap',routeLane,time+PACE.springGapSeconds);
    }else emit(type,obstacleLane,time);
    const priorType=index>0?level.obstacleTypes[(index-1)%level.obstacleTypes.length]:null;
    // After a spring, place the coin trail after landing instead of underneath
    // the airborne ferret. Every trail stays in the intended safe/action lane.
    const lead=['spring','gap'].includes(priorType)?.5:.95;
    const step=lead===.5?.15:.22;
    for(let coin=0;coin<3;coin++)emit('coin',routeLane,time-lead+coin*step);
    // About twenty seconds between hearts, safely beyond a ground encounter.
    if(index%12===4&&!['spring','gap'].includes(type))emit('heart',routeLane,time+.45);
   }
   time+=ENCOUNTER_INTERVALS[beat];
  }
 }
 if(!endless){
  // The last stretch points toward the window/finish instead of another hazard.
  for(const lead of [1.5,1.2,.9])emit('coin',0,endTime-lead);
  events.push({type:level.id==='house'?'window':'finish',lane:0,distance:level.length});
 }
 return events.sort((a,b)=>a.distance-b.distance);
}
export function resolveHit(type,{height,slide,dook}) {
  if(type==='coin'||type==='heart'||type==='finish') return 'collect';
  if(type==='window') return height>.55?'escape':'damage';
  if(type==='spring') return height>.3?'bounce':'clear';
  if(type==='low') return slide?'clear':'damage';
  if(type==='gate') return dook?'clear':'damage';
  if(type==='gap') return height>1?'clear':'damage';
  return height>.85?'clear':'damage';
}
