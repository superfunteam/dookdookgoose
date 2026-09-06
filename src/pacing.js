// World travel is three times faster; action arcs stay compact and readable.
export const PACE={
 multiplier:3,
 storyMaxSpeed:45,
 endlessMaxSpeed:66,
 gravity:42,
 jumpVelocity:12.5,
 bigJumpVelocity:17.4,
 slideDuration:.65,
 diveVelocity:20,
 dookDuration:.55,
 dookLeadTime:.95,
 laneResponse:28,
 endlessSegmentLength:1200,
 courseOpeningSeconds:2.6,
 finishApproachSeconds:2.6,
 springGapSeconds:.28,
};

export const runSpeed=(level,distance,endless=false)=>Math.min(
 level.speed+distance/(endless?500:350),
 endless?PACE.endlessMaxSpeed:PACE.storyMaxSpeed
);

// Integrate the same distance-based acceleration used at runtime. Authoring in
// seconds keeps obstacles readable even late in endless mode at 66 m/s.
export function travelTime(level,distance,endless=false){
 const rate=endless?500:350,cap=endless?PACE.endlessMaxSpeed:PACE.storyMaxSpeed;
 const start=Math.min(level.speed,cap),capDistance=(cap-start)*rate;
 const d=Math.max(0,distance),accelerating=Math.min(d,capDistance);
 return rate*Math.log1p(accelerating/(start*rate))+Math.max(0,d-capDistance)/cap;
}

export function distanceAtTime(level,seconds,endless=false){
 const rate=endless?500:350,cap=endless?PACE.endlessMaxSpeed:PACE.storyMaxSpeed;
 const start=Math.min(level.speed,cap),capTime=rate*Math.log(cap/start),t=Math.max(0,seconds);
 return start*rate*Math.expm1(Math.min(t,capTime)/rate)+Math.max(0,t-capTime)*cap;
}

// Test the whole travelled interval, so fast frames cannot skip a thin obstacle.
export const crossesObstacle=(distance,previous,current)=>
 distance>=previous-1&&distance<=current+.9;

export const impactFraction=(distance,previous,current)=>
 Math.max(0,Math.min(1,(distance-previous)/Math.max(.0001,current-previous)));
