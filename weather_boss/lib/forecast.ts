import type { Forecast, Hour } from './game';
import type { RegionId } from './regions';
export type Item = {category:string;fcstDate:string;fcstTime:string;fcstValue:string};
function itemTime(item:Item){return item.fcstDate.slice(0,4)+'-'+item.fcstDate.slice(4,6)+'-'+item.fcstDate.slice(6,8)+'T'+item.fcstTime.slice(0,2)+':'+item.fcstTime.slice(2,4)+':00+09:00';}
export function parseForecast(items:Item[],now:Date,issued:string,region:RegionId='seoul',date?:string,lightningItems:Item[]=[]):Forecast {
 const rows=new Map<string,Partial<Hour>>();
 for(const item of [...items,...lightningItems.filter(x=>x.category==='LGT')]){if(!['T1H','TMP','WSD','PTY','LGT'].includes(item.category))continue;
  const t=itemTime(item);if(!String(item.fcstValue).trim())continue;const value=Number(item.fcstValue);if(!Number.isFinite(value)||value===-999||!Number.isFinite(Date.parse(t)))continue;
  const r=rows.get(t)||{time:t,lightning:null};if(item.category==='TMP'||item.category==='T1H')r.temp=value;if(item.category==='WSD'&&value>=0)r.wind=value;if(item.category==='PTY'&&value>=0)r.rain=value;if(item.category==='LGT'&&value>=0)r.lightning=value;rows.set(t,r);
 }
 const cutoff=Math.floor(now.getTime()/3600000)*3600000;
 const complete=[...rows.values()].filter((r):r is Hour=>typeof r.time==='string'&&typeof r.temp==='number'&&typeof r.wind==='number'&&typeof r.rain==='number'&&Date.parse(r.time)>=cutoff).sort((a,b)=>a.time.localeCompare(b.time));
 const availableDates=[...new Set(complete.map(h=>h.time.slice(0,10)))].filter(d=>{const list=complete.filter(h=>h.time.slice(0,10)>=d);return list.length>=6;});
 const selected=date||availableDates[0];const hours=complete.filter(h=>h.time.slice(0,10)>=selected).slice(0,6);
 if(!availableDates.includes(selected)||hours.length<6||hours.some((h,i)=>i>0&&Date.parse(h.time)-Date.parse(hours[i-1].time)!==3600000))throw new Error('insufficient');
 return {mode:'live',region,date:selected,availableDates,hours,issued,fetched:now.toISOString(),label:'기상청 단기예보 + 초단기 낙뢰'};
}
export function forecastBase(now:Date){
 const kst=new Date(now.getTime()+9*3600000-45*60000);
 const date=kst.toISOString().slice(0,10).replaceAll('-',''),time=String(kst.getUTCHours()).padStart(2,'0')+'30';
 return {date,time,issued:date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8)+'T'+time.slice(0,2)+':30:00+09:00'};
}
export function shortForecastBase(now:Date){
 const kst=new Date(now.getTime()+9*3600000-30*60000);let base=[2,5,8,11,14,17,20,23].filter(h=>h<=kst.getUTCHours()).pop();
 if(base===undefined){kst.setUTCDate(kst.getUTCDate()-1);base=23;}
 const date=kst.toISOString().slice(0,10).replaceAll('-',''),time=String(base).padStart(2,'0')+'00';
 return {date,time,issued:date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8)+'T'+time.slice(0,2)+':00:00+09:00'};
}
