export const FUNCTIONS={outlook:'getMidFcst',land:'getMidLandFcst',temperature:'getMidTa',sea:'getMidSeaFcst'};
const DAY=86400000,INTERVAL=30000,LIMIT=9000,WARNING=8000;
export class APIError extends Error{
 constructor(kind,message,retryAfter=60){super(message);this.kind=kind;this.retryAfter=retryAfter;}
 public(){return{kind:this.kind,message:this.message,retryAfter:this.retryAfter};}
}
export function publications(now=Date.now()){
 const kst=new Date(now+9*3600000),date=kst.toISOString().slice(0,10),items=[];
 for(let back=0;back<2;back++)for(const hour of ['06','18']){
  const day=new Date(Date.parse(date+'T00:00:00Z')-back*DAY).toISOString().slice(0,10);
  const at=Date.parse(day+'T'+hour+':00:00+09:00');
  if(now>=at&&now-at<DAY)items.push(day.replaceAll('-','')+hour+'00');
 }
 return items.sort().reverse();
}
export function numeric(v){if(v==null||typeof v==='boolean'||typeof v==='string'&&!v.trim())return null;const n=Number(v);return Number.isFinite(n)?n:null;}
const words=v=>typeof v==='string'&&v.trim()?v.trim():null;
export function rowsFor(page,item,issue){
 if(page==='outlook')return[];
 const base=Date.parse(`${issue.slice(0,4)}-${issue.slice(4,6)}-${issue.slice(6,8)}T00:00:00Z`),rows=[];
 for(let day=issue.slice(8,10)==='18'?5:4;day<=10;day++){
  for(const part of page==='temperature'||day>=8?['']:['Am','Pm']){
   const row={date:new Date(base+day*DAY).toISOString().slice(0,10),day,period:{Am:'오전',Pm:'오후','':'하루'}[part]};
   if(page==='temperature')Object.assign(row,{min:numeric(item[`taMin${day}`]),max:numeric(item[`taMax${day}`])});
   else if(page==='land'){let rain=numeric(item[`rnSt${day}${part}`]);if(rain!==null&&(rain<0||rain>100))rain=null;Object.assign(row,{weather:words(item[`wf${day}${part}`]),rain});}
   else Object.assign(row,{weather:words(item[`wf${day}${part}`]),min:numeric(item[`wh${day}A${part}`]),max:numeric(item[`wh${day}B${part}`])});
   rows.push(row);
  }
 }
 return rows;
}
export function keyValue(value){try{return /%[a-f\d]{2}/i.test(value)?decodeURIComponent(value):value;}catch{throw new APIError('KEY_FORMAT','서버 인증 설정의 형식을 확인해야 합니다.',900);}}
export function redact(value,key){
 if(Array.isArray(value))return value.map(v=>redact(v,key));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!['servicekey','authkey','kma_service_key'].includes(k.toLowerCase())).map(([k,v])=>[k,redact(v,key)]));
 if(typeof value==='string'&&key){for(const token of new Set([key,keyValue(key),encodeURIComponent(keyValue(key)),encodeURIComponent(keyValue(key)).toLowerCase()]))if(token)value=value.split(token).join('[비공개]');return value.replace(/(serviceKey|authKey)\s*[=:]\s*[^\s&<>"']+/gi,'$1=[비공개]');}
 return value;
}
export function errorCode(code){
 code=String(code).padStart(2,'0');
 if(code==='03')return new APIError('NO_DATA','해당 발표본의 데이터가 없습니다.',120);
 if(code==='22')return new APIError('PROVIDER_LIMIT','제공기관 호출 제한으로 외부 호출을 24시간 중지합니다.',86400);
 if(['20','21','30','31','32','33'].includes(code))return new APIError('AUTH','기상청 인증 또는 접근 권한 오류입니다. 관리자가 키와 활용신청 상태를 확인해야 합니다.',900);
 if(['10','11','12'].includes(code))return new APIError('REQUEST','제공기관이 요청 조건 또는 서비스 오류를 반환했습니다.',300);
 return new APIError('PROVIDER','제공기관 응답 상태가 정상적이지 않습니다.',120);
}
export function parsePayload(raw){
 let obj;try{obj=typeof raw==='string'?JSON.parse(raw):raw;}catch{
  const code=raw.match(/<(?:\w+:)?(?:returnReasonCode|resultCode)[^>]*>\s*([^<]+)/i)?.[1];
  if(code)throw errorCode(code.trim());
  throw new APIError('FORMAT','제공기관 응답이 정상 JSON 형식이 아닙니다.',120);
 }
 const serviceCode=obj?.OpenAPI_ServiceResponse?.cmmMsgHeader?.returnReasonCode;
 if(serviceCode!=null)throw errorCode(serviceCode);
 const r=obj?.response;
 if(!r?.header)throw new APIError('FORMAT','제공기관 응답 구조를 확인할 수 없습니다.',120);
 if(!['00','0'].includes(String(r.header.resultCode)))throw errorCode(r.header.resultCode);
 let items=r.body?.items?.item;
 if(items&&typeof items==='object'&&!Array.isArray(items))items=[items];
 if(!Array.isArray(items)||!items.length)throw new APIError('NO_DATA','해당 발표본에 데이터가 없습니다.',120);
 if(items.some(i=>!i||typeof i!=='object'||Array.isArray(i)))throw new APIError('FORMAT','예보 항목 구조가 다릅니다.',120);
 return{obj,body:r.body,items};
}
export async function fetchKMA(page,code,issue,key){
 const url=new URL('https://apis.data.go.kr/1360000/MidFcstInfoService/'+FUNCTIONS[page]);
 for(const[k,v]of Object.entries({serviceKey:keyValue(key),dataType:'JSON',numOfRows:'10',pageNo:'1',tmFc:issue,[page==='outlook'?'stnId':'regId']:code}))url.searchParams.set(k,v);
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
 let response;try{response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'KMA-Weather-Note/1.0'},redirect:'manual',signal:controller.signal});}catch(e){
  // 진단은 오류 종류만 남깁니다. URL과 키를 포함할 수 있는 원문은 출력하지 않습니다.
  console.error('KMA_FETCH_FAILED',String(e?.name||'Error'),String(e?.message||'').replace(/https?:\/\/\S+/g,'[URL]').slice(0,180).split(key).join('[비공개]'));
  throw new APIError('NETWORK','기상청 연결에 실패했습니다. 이전 자료가 있으면 유지합니다.',120);
 }finally{clearTimeout(timeout);}
 if(response.status>=300&&response.status<400)throw new APIError('HTTP','제공기관이 다른 주소로 이동하는 응답을 반환했습니다. 자동으로 따라가지 않습니다.',300);
 let raw;try{raw=await response.text();}catch{throw new APIError('NETWORK','기상청 응답을 읽지 못했습니다.',120);}
 if(raw.length>2000000)throw new APIError('FORMAT','제공기관 응답 크기가 예상보다 큽니다.',300);
 if(!response.ok){
  try{parsePayload(raw);}catch(e){if(e instanceof APIError&&!['FORMAT','NO_DATA'].includes(e.kind))throw e;}
  if(response.status===429)throw errorCode('22');
  if([401,403].includes(response.status))throw errorCode('20');
  throw new APIError('HTTP','제공기관 HTTP 오류입니다.',120);
 }
 return redact(parsePayload(raw).obj,key);
}
const inFlight=new Map();
export class Gateway{
 constructor(db,key,regions,{clock=Date.now,transport=fetchKMA}={}){this.db=db;this.key=key;this.regions=regions;this.clock=clock;this.transport=transport;}
 k(page,code,issue){return`${FUNCTIONS[page]}|${code}|${issue}|1|10|JSON`;}
 async stats(){
  const now=this.clock();
  const [count,control]=await Promise.all([this.db.prepare('SELECT COUNT(*) AS n FROM gateway_calls WHERE at > ?').bind(now-DAY).first(),this.db.prepare('SELECT * FROM gateway_control WHERE id=1').first()]);
  return{calls24h:count?.n||0,warning:(count?.n||0)>=WARNING,limit:LIMIT,warningAt:WARNING,nextExternalIn:Math.max(0,Math.ceil(((control?.last_start||0)+INTERVAL-now)/1000)),stoppedUntil:control?.blocked_until>now?new Date(control.blocked_until).toISOString():null,basis:'최근 24시간 · 네 기능 합산 · Sites 공용 DB'};
 }
 async reserve(){
  const now=this.clock(),owner=crypto.randomUUID();
  // D1 batch는 한 트랜잭션. 전역 잠금과 호출 기록을 원자적으로 예약합니다.
  const out=await this.db.batch([
   this.db.prepare('INSERT OR IGNORE INTO gateway_control(id) VALUES(1)'),
   this.db.prepare(`UPDATE gateway_control SET owner=?,last_start=?,lease_until=? WHERE id=1 AND lease_until<=? AND last_start<=? AND blocked_until<=? AND (SELECT COUNT(*) FROM gateway_calls WHERE at>?)<?`).bind(owner,now,now+45000,now,now-INTERVAL,now,now-DAY,LIMIT),
   this.db.prepare('INSERT INTO gateway_calls(at) SELECT ? FROM gateway_control WHERE id=1 AND owner=?').bind(now,owner)
  ]);
  if(!out[1].meta?.changes){
   const control=await this.db.prepare('SELECT * FROM gateway_control WHERE id=1').first();
   const stats=await this.stats();
   if(control?.blocked_until>now)throw new APIError('PROVIDER_LIMIT','제공기관 호출 제한으로 외부 호출이 중지되어 있습니다.',Math.ceil((control.blocked_until-now)/1000));
   if(stats.calls24h>=LIMIT)throw new APIError('APP_LIMIT','앱의 최근 24시간 호출 상한 9,000회에 도달했습니다.',300);
   throw new APIError('THROTTLED','전체 기능의 외부 호출 간격을 지키며 대기 중입니다.',Math.max(1,stats.nextExternalIn));
  }
  return owner;
 }
 async one(page,code,issue){
  const k=this.k(page,code,issue);
  const cached=await this.db.prepare('SELECT * FROM forecast_cache WHERE k=?').bind(k).first();
  if(cached)return{payload:JSON.parse(cached.payload),success:cached.success,cached:true};
  const old=await this.db.prepare('SELECT * FROM forecast_errors WHERE k=?').bind(k).first();
  if(old&&old.until_at>this.clock())throw new APIError(old.kind,old.message,Math.ceil((old.until_at-this.clock())/1000));
  if(inFlight.has(k))return inFlight.get(k);
  const promise=this.pull(page,code,issue,k,old);inFlight.set(k,promise);
  try{return await promise;}finally{if(inFlight.get(k)===promise)inFlight.delete(k);}
 }
 async pull(page,code,issue,k,old){
  const owner=await this.reserve();
  try{
   const payload=redact(await this.transport(page,code,issue,this.key),this.key);parsePayload(payload);
   const success=this.clock();
   await this.db.batch([
    this.db.prepare('INSERT OR REPLACE INTO forecast_cache(k,page,code,issue,payload,success) VALUES(?,?,?,?,?,?)').bind(k,page,code,issue,JSON.stringify(payload),success),
    this.db.prepare('DELETE FROM forecast_errors WHERE k=?').bind(k)
   ]);
   return{payload,success,cached:false};
  }catch(unknown){
   const e=unknown instanceof APIError?unknown:new APIError('SERVER','예보 처리 중 오류가 발생했습니다.',120);
   const attempt=(old?.attempt||0)+1,delay=e.kind==='PROVIDER_LIMIT'?86400:Math.min(1800,Math.max(e.retryAfter,60)*2**Math.min(attempt-1,5));
   await this.db.prepare('INSERT OR REPLACE INTO forecast_errors(k,kind,message,until_at,attempt) VALUES(?,?,?,?,?)').bind(k,e.kind,e.message,this.clock()+delay*1000,attempt).run();
   if(e.kind==='PROVIDER_LIMIT')await this.db.prepare('UPDATE gateway_control SET blocked_until=? WHERE id=1').bind(this.clock()+DAY).run();
   else if(['AUTH','NETWORK','HTTP','PROVIDER','REQUEST','FORMAT','SERVER'].includes(e.kind))await this.db.prepare('UPDATE gateway_control SET last_start=MAX(last_start,?) WHERE id=1').bind(this.clock()+delay*1000-INTERVAL).run();
   e.retryAfter=delay;throw e;
  }finally{await this.db.prepare("UPDATE gateway_control SET lease_until=0,owner='' WHERE id=1 AND owner=?").bind(owner).run();}
 }
 async forecast(page,code,requested='auto'){
  if(!FUNCTIONS[page]||!this.regions[page]?.some(r=>r.code===code))throw new APIError('INPUT','해당 기능의 지역을 선택하세요.',30);
  const choices=publications(this.clock());
  if(requested!=='auto'&&!choices.includes(requested))throw new APIError('INPUT','최근 24시간 안의 06시·18시 발표본을 선택하세요.',30);
  let error;
  if(!this.key||this.key.trim()==='YOUR_API_KEY')error=new APIError('KEY_MISSING','서비스 인증 설정을 준비 중입니다. 잠시 후 다시 확인해 주세요.',300);
  else for(const issue of requested==='auto'?choices:[requested]){
   try{const data=await this.one(page,code,issue);return await this.result(page,code,requested,issue,data,error);}
   catch(e){error=e instanceof APIError?e:new APIError('SERVER','예보 처리 오류입니다.',120);if(error.kind!=='NO_DATA')break;}
  }
  const old=requested==='auto'?await this.db.prepare('SELECT * FROM forecast_cache WHERE page=? AND code=? ORDER BY issue DESC LIMIT 1').bind(page,code).first():await this.db.prepare('SELECT * FROM forecast_cache WHERE k=?').bind(this.k(page,code,requested)).first();
  if(old)return this.result(page,code,requested,old.issue,{payload:JSON.parse(old.payload),success:old.success,cached:true},error);
  return{ok:false,error:(error||new APIError('NO_DATA','자료가 없습니다.')).public(),checkedAt:new Date(this.clock()).toISOString(),quota:await this.stats()};
 }
 async result(page,code,requested,issue,{payload,success,cached},error){
  const{body,items}=parsePayload(payload),field=page==='outlook'?'stnId':'regId';
  const item=items.find(i=>String(i[field]??i.regid??'')===code)||items[0],actual=item[field]??item.regid??null;
  const comparison=actual==null?'비교 불가 · 응답에 코드 없음':String(actual)===code?'일치':'불일치',warnings=[];
  if(comparison==='불일치')warnings.push('요청 코드와 응답 코드가 다릅니다. 적용 지역을 확인하세요.');
  if(items.length>1)warnings.push('여러 항목이 반환되어 요청 코드와 일치하는 항목을 우선 표시했습니다.');
  if(Object.keys(item).some(k=>/^ta(?:Min|Max)\d+Min$/.test(k)))warnings.push('명세와 다른 Min 범위 필드가 있습니다. Low로 자동 변경하지 않습니다.');
  if(issue.slice(8,10)==='18'&&Object.keys(item).some(k=>/^(taMin|taMax|wf|rnSt|wh)4/.test(k)))warnings.push('18시 발표에 명세상 제공되지 않는 4일 후 필드가 있습니다. 원문을 확인하세요.');
  const rows=rowsFor(page,item,issue),missingCount=rows.reduce((n,r)=>n+Object.entries(r).filter(([k,v])=>!['date','day','period'].includes(k)&&v===null).length,0);
  return{ok:true,page,code,requestedTmFc:requested,usedTmFc:issue,publicationSource:'요청에 사용한 발표시각 · API 반환 시각 아님',source:cached?'서버 캐시':'실제 API 응답',stale:!!error,error:error?.public()||null,checkedAt:new Date(this.clock()).toISOString(),lastSuccessAt:new Date(success).toISOString(),responseCode:actual,codeComparison:comparison,rows,outlook:words(item.wfSv),totalCount:body.totalCount,itemCount:items.length,missingCount,warnings,raw:payload,quota:await this.stats()};
 }
}
