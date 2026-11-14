import { env } from 'cloudflare:workers';
import { forecastBase, shortForecastBase, parseForecast, type Item } from '@/lib/forecast';
import { REGIONS, isRegion } from '@/lib/regions';
import { kstToday } from '@/lib/game';
export const dynamic = 'force-dynamic';
const cache=new Map<string,{expires:number;items:Item[];lightning:Item[];issued:string;lightningIssued:string|null}>();
export async function GET(request:Request){
 const url=new URL(request.url),region=url.searchParams.get('region')||'seoul',date=url.searchParams.get('date')||kstToday();
 if(!isRegion(region))return Response.json({error:'invalid_region',message:'지원하지 않는 지역입니다.'},{status:400});
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<kstToday()||date>new Date(Date.now()+9*3600000+6*86400000).toISOString().slice(0,10))return Response.json({error:'invalid_date',message:'오늘부터 7일 이내의 날짜를 선택해 주세요.'},{status:400});
 const key=(env as unknown as Record<string,string>).KMA_SERVICE_KEY;
 if(!key)return Response.json({error:'not_configured',message:'서버 예보 연결을 준비 중입니다. 예시 데이터로 먼저 플레이할 수 있어요.'},{status:503});
 try{
  const now=new Date(),place=REGIONS[region];let record=cache.get(region);
  if(!record||record.expires<Date.now()){
   async function fetchItems(endpoint:string,b:{date:string;time:string},page=1){
    const q=new URLSearchParams({serviceKey:decodeURIComponent(key.trim()),pageNo:String(page),numOfRows:'1000',dataType:'JSON',base_date:b.date,base_time:b.time,nx:String(place.nx),ny:String(place.ny)});
    const res=await fetch('https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/'+endpoint+'?'+q,{signal:AbortSignal.timeout(6500)});if(!res.ok)throw new Error('upstream');const json=await res.json() as any;if(json.response?.header?.resultCode!=='00')throw new Error('upstream');return {items:(json.response.body.items.item||[]) as Item[],total:Number(json.response.body.totalCount)||0};
   }
   const b=shortForecastBase(now),u=forecastBase(now);
   const [short,ultra]=await Promise.all([fetchItems('getVilageFcst',b),fetchItems('getUltraSrtFcst',u).catch(()=>null)]);
   let items=short.items;
   if(short.total>1000){const pages=await Promise.all(Array.from({length:Math.min(4,Math.ceil(short.total/1000))-1},(_,i)=>fetchItems('getVilageFcst',b,i+2)));items=items.concat(...pages.map(p=>p.items));}
   record={expires:Date.now()+180000,items,lightning:ultra?.items||[],issued:b.issued,lightningIssued:ultra?u.issued:null};cache.set(region,record);
  }
  try{const data=parseForecast(record.items,now,record.issued,region,date,record.lightning);return Response.json({...data,lightningIssued:record.lightningIssued});}
  catch{const first=parseForecast(record.items,now,record.issued,region,undefined,record.lightning);return Response.json({error:'date_unavailable',message:'선택한 날짜에는 연속 6시간 단기예보가 아직 없습니다.',availableDates:first.availableDates},{status:422});}
 }catch{return Response.json({error:'unavailable',message:'예보를 불러오지 못했어요. 다시 시도하거나 예시로 체험해 주세요.'},{status:502});}
}
