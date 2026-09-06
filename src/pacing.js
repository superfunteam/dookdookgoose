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
};

export const runSpeed=(level,distance,endless=false)=>Math.min(
 level.speed+distance/(endless?500:350),
 endless?PACE.endlessMaxSpeed:PACE.storyMaxSpeed
);

// Test the whole travelled interval, so fast frames cannot skip a thin obstacle.
export const crossesObstacle=(distance,previous,current)=>
 distance>=previous-1&&distance<=current+.9;

export const impactFraction=(distance,previous,current)=>
 Math.max(0,Math.min(1,(distance-previous)/Math.max(.0001,current-previous)));
