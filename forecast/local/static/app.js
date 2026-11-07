'use strict';
const pages={
 outlook:{title:'중기전망',subtitle:'기상청의 전망문으로 앞으로의 날씨 흐름을 살펴보세요.',explainer:'전국 또는 권역의 기상전망 원문입니다. 문장에 없는 수치를 만들거나 그래프로 바꾸지 않습니다.'},
 land:{title:'육상예보',subtitle:'날짜별 날씨와 강수확률을 함께 살펴보세요.',explainer:'강수확률(%)은 비나 눈이 올 가능성이며 강수량이 아닙니다. 4~7일 후는 오전·오후, 8~10일 후는 하루 단위입니다.'},
 temperature:{title:'기온예보',subtitle:'예상 최저·최고기온의 변화를 한눈에 확인하세요.',explainer:'날짜별 예상 최저·최고기온(℃)입니다. 특정 시각의 기온이나 관측값이 아닙니다. Low·High의 계산 의미는 확정하지 않아 그래프에 넣지 않습니다.'},
 sea:{title:'해상예보',subtitle:'해역별 날씨와 예상파고의 최저·최고 범위를 확인하세요.',explainer:'예상파고(m)는 예보된 파도의 높이입니다. A는 최저, B는 최고입니다. 육상 지역과 해역을 자동으로 연결하지 않습니다.'}
};
const $=id=>document.getElementById(id);
const page=pages[location.pathname.slice(1)]?location.pathname.slice(1):'outlook';
const spec=pages[page];
let statusInfo=null,busy=false,timer=null,nextAt=0,failures=0,last=null,controller=null,disposed=false,lastError=null;
const missing='미제공';
function set(id,value){$(id).textContent=value;}
function fmt(value,unit=''){return value===null||value===undefined?missing:`${value}${unit}`;}
function issueLabel(v){return /^\d{12}$/.test(v)?`${v.slice(0,4)}.${v.slice(4,6)}.${v.slice(6,8)} ${v.slice(8,10)}:${v.slice(10)} KST`:v;}
function timeLabel(v){if(!v)return '—';const d=new Date(v);return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d);}
function safeStorage(key,value){try{if(value===undefined)return localStorage.getItem(key);localStorage.setItem(key,value);}catch{}return null;}
function state(message,kind=''){set('status',message);$('status').className='status '+kind;}
function quota(q){if(!q)return;set('quota',q.calls24h.toLocaleString());document.querySelector('.usage').classList.toggle('warn',q.warning||!!q.stoppedUntil);set('quota-warning',q.stoppedUntil?`제공기관 제한으로 ${timeLabel(q.stoppedUntil)}까지 외부 호출 중지`:q.warning?'관리자 확인 필요: 최근 24시간 8,000회 이상 사용':'8,000회부터 경고 · 외부 호출은 전체 최소 30초 간격');}
function options(){const el=$('issue'),old=el.value;el.replaceChildren(new Option('최신 유효 발표본 자동 확인','auto'));for(const v of statusInfo.publications)el.add(new Option(issueLabel(v),v));el.value=[...el.options].some(o=>o.value===old)?old:'auto';}
function regionInfo(){const r=statusInfo.regions[page].find(r=>r.code===$('region').value);set('region-info',`${r.name} · ${page==='outlook'?'stnId':'regId'} ${r.code} · ${r.scope}`);}
function cancelTimer(){if(timer!==null)clearTimeout(timer);timer=null;}
function schedule(seconds=30){cancelTimer();nextAt=Date.now()+seconds*1000;tick();}
function tick(){cancelTimer();if(disposed)return;if(document.hidden){set('countdown','일시 정지');return;}const left=Math.max(0,Math.ceil((nextAt-Date.now())/1000));set('countdown',busy?'확인 중…':`${left}초`);if(left===0&&!busy){void refresh();return;}timer=setTimeout(tick,1000);}
async function getJSON(url,signal){const r=await fetch(url,{cache:'no-store',signal});let data;try{data=await r.json();}catch{throw new Error('서버 응답을 읽지 못했습니다. 서버 터미널을 확인하세요.');}if(!r.ok)throw new Error(data.error?.message||'서버 응답 오류입니다.');return data;}
function setup(){const config=statusInfo.config;const labels={missing:'인증키 설정이 없습니다.',empty:'인증키 설정이 빈 값입니다.',placeholder:'예제 자리표시자가 입력되어 있습니다.',file_error:'KEY.env를 읽지 못했습니다.'};$('setup').hidden=config.state==='configured'||$('demo').checked;set('key-state',(labels[config.state]||'인증키가 설정되어 있습니다. 실제 인증·활용신청 권한은 API 응답으로 확인합니다.')+` 설정 출처: ${config.source}`+(config.note?` · ${config.note}`:''));set('key-path',statusInfo.keyPath);}
async function refresh(){if(busy||document.hidden||disposed)return;busy=true;cancelTimer();$('refresh').disabled=true;state('선택한 지역과 발표본을 확인하고 있습니다…');let delay=30;const selectedCode=$('region').value,selectedIssue=$('issue').value,demo=$('demo').checked;
 controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),25000);
 try{
  statusInfo=await getJSON('/api/status',controller.signal);options();setup();quota(statusInfo.quota);set('server-url',statusInfo.url);
  const query=new URLSearchParams({page,code:selectedCode,issue:selectedIssue});
  const data=await getJSON((demo?'/api/demo?':'/api/forecast?')+query,controller.signal);
  // 조회 중 지역·모드가 바뀌었으면 이전 요청 결과를 새 지역에 표시하지 않습니다.
  if(selectedCode!==$('region').value||selectedIssue!==$('issue').value||demo!==$('demo').checked){delay=0;return;}
  set('checked',timeLabel(data.checkedAt));quota(data.quota);
  lastError=data.error?.kind||null;
  if(data.ok){last=data;render(data);failures=data.error?failures+1:0;
   if(data.demo)state('모의 응답 · 화면 및 처리 구조 확인용입니다. 실제 기상청 예보가 아닙니다.','demo');
   else if(data.error){state(`이전 자료 표시 · ${data.error.message}`,'error');delay=Math.max(30,data.error.retryAfter||30,Math.min(900,30*2**Math.min(failures,5)));}
   else state('확인 완료 · '+data.source+' · 30초는 확인 주기이며 예보 발표 주기가 아닙니다.','good');
  }else{
   failures++;delay=Math.max(30,data.error?.retryAfter||30,Math.min(900,30*2**Math.min(failures,5)));
   const same=last&&last.code===selectedCode&&!!last.demo===demo;
   state((same?'이전 정상 자료 유지 · ':'')+(data.error?.message||'자료를 불러오지 못했습니다.'),'error');
   if(!same){$('results').hidden=true;$('empty').hidden=false;set('publication','미확인');set('last-success','실제 API 성공 이력 없음');}
  }
 }catch(e){lastError='NETWORK';if(disposed)return;failures++;delay=Math.min(900,30*2**Math.min(failures,5));state(e.name==='AbortError'?'요청 시간이 초과되었습니다. 서버 상태를 확인하세요.':`서버 연결 실패 · ${e.message}`,'error');}
 finally{clearTimeout(timeout);busy=false;$('refresh').disabled=false;controller=null;if(!disposed)schedule(delay);}
}
function el(tag,className,value){const node=document.createElement(tag);if(className)node.className=className;if(value!==undefined)node.textContent=value;return node;}
function render(data){$('results').hidden=false;$('empty').hidden=true;
set('publication',issueLabel(data.usedTmFc));set('last-success',data.demo?'모의 응답 · 실제 API 성공시각 아님':`마지막 API 성공 ${timeLabel(data.lastSuccessAt)}`);
const region=statusInfo.regions[page].find(r=>r.code===data.code);
set('result-title',`${region.name} · ${spec.title}`);set('source',data.demo?'모의 응답':data.stale?'이전 자료 · 캐시':data.source);$('source').className='tag'+(data.demo?' demo':'');
const dates=data.rows.length?`${data.rows[0].date} ~ ${data.rows.at(-1).date}`:'전망문에 기재된 대상 기간';
set('data-note',`${dates} · 응답 전체 ${data.totalCount??missing}건 / 실제 항목 ${data.itemCount}개${data.rows.length?` / 표시 구간 ${data.rows.length}개 / 결측 ${data.missingCount}개`:''} · 코드 ${data.codeComparison}`);
set('warnings',data.warnings.join('\n'));$('outlook-panel').hidden=page!=='outlook';$('chart-panel').hidden=page==='outlook';$('table-panel').hidden=page==='outlook';$('cards').replaceChildren();
if(page==='outlook')set('outlook-text',data.outlook||missing);else{renderCards(data.rows);renderTable(data.rows);drawChart(data.rows);}
set('raw-note',`${data.demo?'모의 응답':'기상청 응답'} · 조회 발표시각 ${issueLabel(data.usedTmFc)}는 서버가 별도 보관한 요청 정보입니다. 범위 필드는 계산 없이 원문으로 제공합니다.`);
set('raw',JSON.stringify(data.raw,null,2));}
function renderCards(rows){if(page==='temperature')return;for(const row of rows){const card=el('article','weather-card');card.append(el('div','date',row.date.slice(5).replace('-',' / ')),el('div','period',row.period),el('div','weather',row.weather||missing),el('div','value',page==='land'?`강수확률 ${fmt(row.rain,'%')}`:`예상파고 ${fmt(row.min)} ~ ${fmt(row.max)} m`));$('cards').append(card);}}
function renderTable(rows){const t=$('data-table');t.replaceChildren();const head=el('thead'),hr=el('tr');const cols=page==='land'?['예보 날짜','구분','날씨','강수확률 (%)']:page==='temperature'?['예보 날짜','구분','예상 최저기온 (℃)','예상 최고기온 (℃)']:['예보 날짜','구분','날씨','최저 예상파고 (m)','최고 예상파고 (m)'];for(const label of cols){const th=el('th',null,label);th.scope='col';hr.append(th);}head.append(hr);const body=el('tbody');for(const r of rows){const tr=el('tr');const values=page==='land'?[r.date,r.period,r.weather,fmt(r.rain)]:page==='temperature'?[r.date,r.period,fmt(r.min),fmt(r.max)]:[r.date,r.period,r.weather,fmt(r.min),fmt(r.max)];for(const v of values)tr.append(el('td',null,v??missing));body.append(tr);}t.append(head,body);}
function svgEl(tag,attrs={},label){const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(label!==undefined)n.textContent=label;return n;}
function drawChart(rows){const svg=$('chart');svg.replaceChildren();const rain=page==='land',sea=page==='sea',unit=rain?'%':sea?'m':'℃';
set('chart-title',rain?'날짜별 강수확률 (%)':sea?'최저·최고 예상파고 (m)':'예상 최저·최고기온 (℃)');$('legend').replaceChildren();for(const label of rain?['강수확률']:sea?['최저 파고','최고 파고']:['최저기온','최고기온'])$('legend').append(el('span',null,label));
const series=rain?['rain']:['min','max'];const values=rows.flatMap(r=>series.map(k=>r[k]).filter(v=>typeof v==='number'&&Number.isFinite(v)));
svg.append(svgEl('title',{},$('chart-title').textContent),svgEl('desc',{},'누락값은 연결하지 않습니다. 같은 값은 아래 수치표에서도 확인할 수 있습니다.'));
if(!values.length){svg.append(svgEl('text',{x:450,y:150,'text-anchor':'middle',class:'axis-text'},'표시할 수치가 없습니다.'));return;}
let low=rain||sea?0:Math.floor(Math.min(...values)-2),high=rain?100:Math.ceil(Math.max(...values)+2);if(high<=low)high=low+1;
const x=i=>65+i*(790/Math.max(1,rows.length-1)),y=v=>255-(v-low)/(high-low)*205;
for(let j=0;j<=4;j++){let v=low+(high-low)*j/4;svg.append(svgEl('line',{x1:55,x2:865,y1:y(v),y2:y(v),class:'grid'}),svgEl('text',{x:43,y:y(v)+4,'text-anchor':'end',class:'axis-text'},Number(v.toFixed(1))));}
rows.forEach((r,i)=>{svg.append(svgEl('text',{x:x(i),y:286,'text-anchor':'middle',class:'axis-text'},r.date.slice(5).replace('-','/')),svgEl('text',{x:x(i),y:305,'text-anchor':'middle',class:'axis-text'},r.period));});
if(sea)rows.forEach((r,i)=>{if(r.min!==null&&r.max!==null)svg.append(svgEl('line',{x1:x(i),x2:x(i),y1:y(r.min),y2:y(r.max),class:'range'}));});
series.forEach((key,s)=>{if(!rain){let d='';rows.forEach((r,i)=>{if(r[key]===null){d='';return;}d+=(d?' L':'M')+x(i)+','+y(r[key]);const next=rows[i+1];if(!next||next[key]===null){svg.append(svgEl('path',{d,class:`series${s}`}));d='';}});}
rows.forEach((r,i)=>{const v=r[key];if(v===null||v===undefined)return;const label=`${r.date} ${r.period} ${rain?'강수확률':key==='min'?'최저':'최고'} ${v}${unit}`;let node;
if(rain){node=svgEl('rect',{x:x(i)-14,y:y(v),width:28,height:Math.max(1,255-y(v)),rx:4,class:'bar',tabindex:0,'aria-label':label});svg.append(svgEl('text',{x:x(i),y:y(v)-9,class:'chart-value'},v+'%'));}else node=svgEl('circle',{cx:x(i),cy:y(v),r:5,class:`dot${s}`,tabindex:0,'aria-label':label});
node.append(svgEl('title',{},label));svg.append(node);});});}
async function init(){document.title=`${spec.title} · 기후의 흐름`;set('page-title',spec.title);set('breadcrumb',spec.title);set('subtitle',spec.subtitle);set('explainer',spec.explainer);document.querySelector(`[data-page="${page}"]`).classList.add('active');document.querySelector(`[data-page="${page}"]`).setAttribute('aria-current','page');
try{statusInfo=await getJSON('/api/status');for(const r of statusInfo.regions[page])$('region').add(new Option(`${r.name} · ${r.code}`,r.code));const saved=safeStorage('kma.region.'+page);if(saved&&statusInfo.regions[page].some(r=>r.code===saved))$('region').value=saved;options();
// 페이지 이동 직후 챗봇의 최종 선택을 첫 조회 전에 반영해 중복 조회를 막습니다.
try{const p=JSON.parse(sessionStorage.getItem('weatherchat.pending')||'null');if(p?.target?.page===page&&Date.now()-p.created<120000){if(p.target.code&&statusInfo.regions[page].some(r=>r.code===p.target.code))$('region').value=p.target.code;if(p.target.publication&&[...$('issue').options].some(o=>o.value===p.target.publication))$('issue').value=p.target.publication;}}catch{}
regionInfo();setup();quota(statusInfo.quota);set('server-url',statusInfo.url);await refresh();}catch{state('서버에 연결할 수 없습니다. 로컬 실행은 서버실행.cmd의 터미널 메시지와 포트를 확인하세요.','error');}}
function changed(){failures=0;last=null;$('results').hidden=true;$('empty').hidden=false;set('publication','미확인');set('last-success','실제 API 성공 이력 없음');if(statusInfo){regionInfo();setup();}safeStorage('kma.region.'+page,$('region').value);if(busy)schedule(0);else void refresh();}
$('region').addEventListener('change',changed);$('issue').addEventListener('change',changed);$('demo').addEventListener('change',changed);$('refresh').addEventListener('click',()=>void refresh());
document.addEventListener('visibilitychange',()=>{cancelTimer();if(document.hidden)set('countdown','일시 정지');else if(Date.now()>=nextAt)void refresh();else tick();});
window.addEventListener('pagehide',()=>{disposed=true;cancelTimer();controller?.abort();});
window.addEventListener('pageshow',e=>{if(e.persisted){disposed=false;schedule(0);}});
function chatContext(){return {page,code:$('region').value,publication:last?.usedTmFc||null,success:last?.lastSuccessAt||null,demo:$('demo').checked,stale:!!last?.stale||!!lastError,errorKind:lastError};}
async function waitIdle(){const until=Date.now()+30000;while(busy&&Date.now()<until)await new Promise(r=>setTimeout(r,100));if(busy)throw new Error('기존 예보 조회가 끝나지 않았습니다.');}
const ready=init();
window.ForecastUI={ready,context:chatContext,catalog:()=>statusInfo,async apply(target,force=false){await ready;await waitIdle();if(target.page!==page)throw new Error('페이지가 일치하지 않습니다.');if(target.code&&!statusInfo.regions[page].some(r=>r.code===target.code))throw new Error('기능에 맞지 않는 지역입니다.');if(target.publication&&!['auto',...statusInfo.publications].includes(target.publication))throw new Error('유효하지 않은 발표본입니다.');const changedSelection=(target.code&&target.code!==$('region').value)||(target.publication&&target.publication!==$('issue').value);if(target.code)$('region').value=target.code;if(target.publication)$('issue').value=target.publication;if(changedSelection){last=null;lastError=null;regionInfo();safeStorage('kma.region.'+page,$('region').value);}if(changedSelection||force)await refresh();return chatContext();}};
