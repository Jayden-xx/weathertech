import type { RegionId } from './regions';
import dump from './weather-scenarios.json' with {type:'json'};
export const SCENARIOS=dump.scenarios;
export type ScenarioId=keyof typeof SCENARIOS;
export type WeatherMode='live'|ScenarioId;
export function kstToday(){return new Date(Date.now()+9*3600000).toISOString().slice(0,10);}
export type Hour = { time: string; temp: number; wind: number; rain: number; lightning:number|null };
export type Forecast = { mode: 'live' | 'example'; region:RegionId; date:string; availableDates:string[]; lightningIssued?:string|null; scenario?:ScenarioId; hours: Hour[]; issued: string | null; fetched: string | null; label: string };
export const DURATION = 12;
export const FORECAST_HOURS = 6;
export const WIDTH = 640;
export const HEIGHT = 430;
export function exampleForecast(region:RegionId='seoul',date=kstToday(),scenario?:ScenarioId): Forecast {
 if(scenario){const p=SCENARIOS[scenario];return {mode:'example',scenario,region,date:'',availableDates:[],issued:null,fetched:null,label:p.title+' · 창작 예시 덤프',hours:dump.timeSlots.map((time,i)=>({time,temp:p.temperature[i],wind:p.wind[i],rain:p.rain[i],lightning:p.lightning[i]}))};}
 const temps=region==='hallasan'?[3,2,0,-1,-2,-1]:region==='daegu'?[24,26,28,27,25,22]:[18,21,24,23,20,18];
 return {mode:'example',region,date,availableDates:[],issued:null,fetched:null,label:'패턴 체험용 예시 · 실제 예보 아님',hours:temps.map((temp,i)=>({time:'예시 '+String(8+i).padStart(2,'0')+':00',temp,wind:region==='hallasan'?5+i:1.5+i,rain:i>=2&&i<=4?(region==='hallasan'?3:1):0,lightning:i===2||i===4?.2:0}))};
}
export type Drop = { x:number;y:number;r:number;speed:number;kind:number;hit:boolean };
export type Bolt = {x:number;age:number;hit:boolean};
export type Game = {status:'playing'|'paused'|'won'|'lost';elapsed:number;x:number;hp:number;invulnerable:number;spawn:number;drops:Drop[];bolts:Bolt[];lastThunderHour:number;boltCooldown:number;dodged:number;seed:number};
export function createGame(): Game {return {status:'playing',elapsed:0,x:320,hp:3,invulnerable:0,spawn:.5,drops:[],bolts:[],lastThunderHour:-1,boltCooldown:0,dodged:0,seed:3921};}
function random(g:Game){g.seed=(g.seed*1664525+1013904223)>>>0;return g.seed/4294967296;}
export function hourIndex(g:Game,hours:Hour[]){return Math.min(Math.floor(g.elapsed/DURATION*hours.length),hours.length-1);}
export function currentHour(g:Game,hours:Hour[]){return hours[hourIndex(g,hours)];}
export function stepGame(g:Game, delta:number, direction:number, hours:Hour[]){
 if(g.status!=='playing'||!hours.length)return;
 const dt=Math.min(.04,Math.max(0,delta));
 g.elapsed=Math.min(DURATION,g.elapsed+dt);g.invulnerable=Math.max(0,g.invulnerable-dt);
 g.x=Math.max(22,Math.min(WIDTH-22,g.x+direction*330*dt));
 const h=currentHour(g,hours),index=hourIndex(g,hours);g.spawn-=dt;g.boltCooldown-=dt;
 if(g.spawn<=0){g.spawn=h.wind>=30?.28:h.temp>=38?.32:.53;g.drops.push({x:20+random(g)*(WIDTH-40),y:104,r:9,speed:155+Math.min(12,g.elapsed)*3+Math.max(0,h.temp-35)*5+Math.max(0,h.wind-15)*1.5,kind:[2,3,7].includes(h.rain)?2:h.rain?1:0,hit:false});}
 if(h.lightning!==null&&h.lightning>0&&(g.lastThunderHour!==index||(h.lightning>=1&&g.boltCooldown<=0))){g.lastThunderHour=index;g.boltCooldown=h.lightning>=1?.95:2;g.bolts.push({x:Math.max(35,Math.min(WIDTH-35,g.x)),age:0,hit:false});}
 for(const bolt of g.bolts){bolt.age+=dt;if(bolt.age>=.75&&bolt.age<1.05&&!bolt.hit&&Math.abs(bolt.x-g.x)<30&&g.invulnerable<=0){bolt.hit=true;g.hp--;g.invulnerable=1;}}
 g.bolts=g.bolts.filter(b=>b.age<1.3);
 const drift=(h.wind>15?72+Math.min(45,h.wind-15)*4:Math.min(8,Math.max(0,h.wind))*9)*(Math.floor(g.elapsed/3)%2?1:-1);
 for(const d of g.drops){d.y+=d.speed*dt;d.x+=drift*dt;
  if(!d.hit&&Math.abs(d.x-g.x)<d.r+11&&Math.abs(d.y-HEIGHT+43)<d.r+16&&g.invulnerable<=0){d.hit=true;g.hp--;g.invulnerable=1;}
 }
 const remaining:Drop[]=[];for(const d of g.drops){if(d.y>HEIGHT+15){if(!d.hit)g.dodged++;}else remaining.push(d);}g.drops=remaining;
 if(g.hp<=0)g.status='lost';else if(g.elapsed>=DURATION)g.status='won';
}


