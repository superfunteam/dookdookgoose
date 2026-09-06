// The bot observes the public, read-only inspection API and uses player keys.
// Plan in seconds rather than metres so these inputs also work as endless speeds up.
export async function startRunnerBot(page){
 await page.evaluate(()=>{
  window.__qaActions={jump:0,slide:0,dook:0,dive:0};
  window.__qaHits=[];
  const acted=new Set();let previous=null;
  const key=k=>document.body.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true}));
  window.__qaBot=setInterval(()=>{
   const s=window.__dook.snapshot();if(s.mode!=='playing')return;
   const course=window.__dook.getCourse();
   if(previous&&previous.level===s.level&&s.lives<previous.lives)window.__qaHits.push({distance:s.distance,height:s.height,slide:s.slide,lane:s.lane,course:course.slice(0,6)});
   previous=s;
   const next=course.find(e=>!['coin','heart','finish'].includes(e.type)&&e.distance>s.distance-1);
   if(!next)return;
   const arrival=(next.distance-s.distance)/s.speed;if(arrival>1.3||arrival<0)return;
   const trail=course.find(e=>e.type==='coin'&&e.distance>s.distance&&e.distance<next.distance);
   const heart=course.find(e=>e.type==='heart'&&e.distance>s.distance&&e.distance<next.distance&&(e.distance-s.distance)/s.speed<.6);
   const lane=heart?.lane??(['block','sock'].includes(next.type)?(trail?.lane??(next.lane===0?1:0)):next.lane);
   if(s.lane<lane)key('ArrowRight');if(s.lane>lane)key('ArrowLeft');
   const id=`${s.level}:${next.distance}:${next.type}`;
   if(acted.has(id))return;
   if(next.type==='low'&&arrival<.32){
    key('ArrowDown');window.__qaActions.slide++;if(s.height>.05)window.__qaActions.dive++;acted.add(id);
   }
   if(['spring','window','gap'].includes(next.type)&&arrival<.25){
    // A mushroom already carries us across its paired creek; don't accidentally
    // replace that trajectory with repeated double-jump inputs.
    if(s.height<=.05||(next.type==='gap'&&s.height<1.1&&s.height>.15)){
     key('ArrowUp');window.__qaActions.jump++;acted.add(id);
    }
   }
   if(next.type==='gate'&&arrival<.72){key('d');window.__qaActions.dook++;acted.add(id);}
  },20);
 });
}
