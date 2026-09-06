import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
for(const name of ['ferret','goose'])test(`${name} sculpt is a single connected, finite mesh`,()=>{
 const m=JSON.parse(readFileSync(new URL(`../src/models/${name}.json`,import.meta.url)));assert.ok(m.positions.every(Number.isFinite));const count=m.positions.length/3;assert.ok(m.indices.every(i=>Number.isInteger(i)&&i>=0&&i<count));const adj=Array.from({length:count},()=>[]);
 for(let i=0;i<m.indices.length;i+=3)for(let j=0;j<3;j++){const a=m.indices[i+j],b=m.indices[i+(j+1)%3];adj[a].push(b);adj[b].push(a);}
 const seen=new Set(),queue=[0];while(queue.length){const i=queue.pop();if(seen.has(i))continue;seen.add(i);queue.push(...adj[i]);}assert.equal(seen.size,count,'Every leg, paw, torso and tail vertex must be connected to the same mesh.');const edges=new Map();for(let i=0;i<m.indices.length;i+=3)for(let j=0;j<3;j++){const a=m.indices[i+j],b=m.indices[i+(j+1)%3],key=Math.min(a,b)+','+Math.max(a,b);edges.set(key,(edges.get(key)||0)+1);}assert.ok([...edges.values()].every(n=>n===2),'The skin must be a closed manifold with exactly two faces per edge.');
});
