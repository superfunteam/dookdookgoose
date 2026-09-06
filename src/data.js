import {PACE} from './pacing.js';
export const LEVELS = [
  { id:'house', name:'Breaking Out', subtitle:'A perfectly unreasonable escape.', number:'01', tag:'HOME, SWEET ESCAPE', length:420, speed:10.5, color:'#efb674', mechanic:'THE GREAT SQUEEZE', tip:'Swipe down to slide under furniture. At the window, jump for freedom!', obstacleTypes:['block','low','sock'], dialogues:[['GOOSE MICHAEL','At the zoo. Behind bars. Hurry. It’s melting.'],['PIP THE FERRET','BEHIND BARS?! Hold on, Goose Michael. I’m coming.'],['PIP THE FERRET','Door: locked. Brain: tiny. Window: extremely promising.']], exit:[['PIP THE FERRET','Window? Defenestrated. House? Escaped.'],['GOOSE MICHAEL','Get here soon. I can’t hold these much longer.'],['PIP THE FERRET','They’ve restrained his wings. This goes all the way to the top.']] },
  { id:'woods', name:'Into the Woods', subtitle:'No thoughts. Just woodland parkour.', number:'02', tag:'TAKE THE SCENIC PANIC', length:510, speed:12, color:'#b4d57b', mechanic:'MUSHROOM SPRINGS', tip:'Jump onto orange mushrooms for a super-bounce over the creek. Dodge logs and duck branches.', obstacleTypes:['block','low','gap','spring'], dialogues:[['PIP THE FERRET','The woods. A shortcut for someone with absolutely no map.'],['GOOSE MICHAEL','I’m by the primates. One of them is doing his taxes.'],['PIP THE FERRET','Psychological warfare. Stay strong, buddy.']], exit:[['PIP THE FERRET','I have eaten three bugs and become one with a shrub.'],['GOOSE MICHAEL','Pistachio or strawberry?'],['PIP THE FERRET','I don’t know your captors’ names, Goose.']] },
  { id:'zoo', name:'The Zoo', subtitle:'Something here is deeply human.', number:'03', tag:'OPERATION: LOOSE GOOSE', length:540, speed:13, color:'#eca582', mechanic:'DOOK TO OPEN', tip:'Tap DOOK near striped gates to open them. Look closely at the exhibits…', obstacleTypes:['block','low','gate'], dialogues:[['PIP THE FERRET','I’m in. These enclosures are full of… accountants?'],['EXHIBIT SIGN','HOMO SAPIENS · Please do not feed the middle managers.'],['PIP THE FERRET','No time to unpack that. DOOK at the gates. Find Goose.']] }
].map(level=>({...level,length:level.length*PACE.multiplier,speed:level.speed*PACE.multiplier}));
export const ENDING = [['PIP THE FERRET','GOOSE MICHAEL! Step away from the bars!'],['GOOSE MICHAEL','Oh, hey Pip. I got you pistachio.'],['PIP THE FERRET','You said you were behind bars.'],['GOOSE MICHAEL','The gelato bars. And then I walked behind these bars. For shade.'],['PIP THE FERRET','I jumped out of a window.'],['GOOSE MICHAEL','That’s nice. Look, the humans are having a meeting.'],['PIP THE FERRET','…Do you think they know they’re in a zoo?'],['GOOSE MICHAEL','Do you think we do? Anyway. Yours is melting.']];
export function makeCourse(level, endless=false, seed=7){
  let s=seed; const rand=()=>((s=(s*1664525+1013904223)>>>0)/4294967296);
  const events=[]; const limit=endless?1200:level.length-45;
  for(let d=34,i=0;d<limit;d+=19,i++){
    const lane=Math.floor(rand()*3)-1;
    let type=level.obstacleTypes[i%level.obstacleTypes.length];
    if(type==='gap') { events.push({type:'spring',lane,distance:d-10}); }
    events.push({type,lane,distance:d});
    const coinLane=type==='spring'?lane:(lane===1?-1:lane+1);
    for(let c=0;c<3;c++) events.push({type:'coin',lane:coinLane,distance:d-7+c*3});
    if(i%5===3) events.push({type:'heart',lane:-lane,distance:d+8});
  }
  if(!endless) events.push({type:level.id==='house'?'window':'finish',lane:0,distance:level.length});
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
