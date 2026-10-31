// Source-over opacities producing a convex mixture of four illumination scenes.
export function sceneMix(led,neo){
 const l=Math.max(0,Math.min(1,led)),n=Math.max(0,Math.min(1,neo));
 const both=l*n, ceiling=(1-l)*n;
 return {led:l,neo:both===1?0:ceiling/(1-both),both};
}
