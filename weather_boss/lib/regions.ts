export const REGIONS = {
 seoul:{id:'seoul',name:'서울 · 중구',english:'SEOUL',nx:60,ny:127,note:'서울 중구 대표 격자'},
 daegu:{id:'daegu',name:'대구 · 중구',english:'DAEGU',nx:89,ny:90,note:'대구 중구 대표 격자'},
 hallasan:{id:'hallasan',name:'제주 · 한라산',english:'HALLASAN',nx:53,ny:35,note:'백록담 인근 5km 예보 격자 · 정상 실측 아님'}
} as const;
export type RegionId = keyof typeof REGIONS;
export function isRegion(value:string):value is RegionId{return Object.hasOwn(REGIONS,value);}
