import test from 'node:test';import assert from 'node:assert/strict';import {sceneMix} from '../scenes.js';
test('scene mixture has correct four endpoints and brightness weights',()=>{
 for(const l of [0,.2,.5,1])for(const n of [0,.3,.8,1]){
 const a=sceneMix(l,n);const weights=[(1-a.led)*(1-a.neo)*(1-a.both),a.led*(1-a.neo)*(1-a.both),a.neo*(1-a.both),a.both];
 const target=[(1-l)*(1-n),l*(1-n),(1-l)*n,l*n];
 weights.forEach((w,i)=>assert.ok(Math.abs(w-target[i])<1e-9));
 }assert.deepEqual(sceneMix(-1,2),{led:0,neo:1,both:0});
});
