import {HomeSerial,integer,lcdCommand} from './protocol.js';
import {sceneMix} from './scenes.js';
const $=id=>document.getElementById(id), supported=isSecureContext&&'serial' in navigator;
let current=null,working=false,logs=[],phase='off',lastStatus=null;
const stage=$('house-stage'),baseImage=stage.querySelector('img');
baseImage.src='public/images/home-off.png';
const sceneImages={};
for(const [key,file] of [['led','home-led.png'],['neo','home-neo.png'],['both','smart-home.png']]){
 const img=new Image();img.src='public/images/'+file;img.alt='';img.setAttribute('aria-hidden','true');img.className='scene-layer';img.style.opacity='0';stage.insertBefore(img,$('effects'));sceneImages[key]=img;
}
const sceneReady=Promise.all([baseImage,...Object.values(sceneImages)].map(img=>img.decode()));
sceneReady.then(()=>{if(current)renderScene(current);}).catch(()=>notify('조명 장면 이미지를 불러오지 못했습니다. 새로고침 후 다시 확인하세요.'));
function renderScene(s){const mix=sceneMix(s.led.on?s.led.brightness/255:0,s.neo.on&&Math.max(s.neo.r,s.neo.g,s.neo.b)>0?s.neo.brightness/255:0);for(const key of Object.keys(sceneImages))sceneImages[key].style.opacity=String(mix[key]);}
function resetScene(){for(const img of Object.values(sceneImages))img.style.opacity='0';}
document.querySelector('.visual-note').textContent='조명은 상태별로 새로 그린 장면을 혼합해 표시합니다. 장면의 빛은 따뜻한 백색 기준이며 임의 RGB의 정확한 광학 재현은 아닙니다. 아래 RGB 값은 실제 보드 설정입니다. 화면은 실물 밝기·위치를 측정한 결과가 아닙니다.';
function notify(text){$('notice').textContent=text;$('notice').hidden=!text;}
function log(kind,text,detail=''){logs.push({kind,text,detail,at:new Date()});if(logs.length>500)logs.shift();const host=$('log'),bottom=host.scrollHeight-host.scrollTop-host.clientHeight<50;host.replaceChildren();for(const item of logs){const row=document.createElement('div');row.className='log-row '+item.kind;const t=document.createElement('time');t.textContent=item.at.toLocaleTimeString('ko-KR',{hour12:false})+'.'+String(item.at.getMilliseconds()).padStart(3,'0');const k=document.createElement('span');k.textContent=item.kind;const message=document.createElement('div');message.className='message';message.textContent=item.text;if(item.detail){const small=document.createElement('small');small.textContent=item.detail;message.append(small);}row.append(t,k,message);host.append(row);}$('log-count').textContent=logs.length;if(bottom)host.scrollTop=host.scrollHeight;}
function enabled(){const ready=phase==='ready'&&!working&&current;for(const element of document.querySelectorAll('.controls button,.controls input,.modes button'))element.disabled=!ready;$('connect').disabled=!supported||!['off','error'].includes(phase)||Boolean(home.port);$('disconnect').disabled=!['settle','sync','ready'].includes(phase)&&!(phase==='error'&&home.port);}
function displayState(s){current=s;lastStatus=new Date();$('sync-time').textContent='장치 확인 '+lastStatus.toLocaleTimeString('ko-KR',{hour12:false});$('verified').textContent='STATUS 확인됨';$('effects').hidden=false;
 const set=(id,value)=>{if(document.activeElement!==$(id))$(id).value=value;};
 for(const key of ['led','neo']){$(key+'-state').textContent=s[key].on?'켜짐':'꺼짐';$(key+'-toggle').textContent=s[key].on?'끄기':'켜기';$(key+'-toggle').setAttribute('aria-checked',String(s[key].on));set(key+'-brightness',s[key].brightness);$(key+'-value').textContent=s[key].brightness;}
 if(s.neo.r||s.neo.g||s.neo.b)set('neo-color','#'+[s.neo.r,s.neo.g,s.neo.b].map(v=>v.toString(16).padStart(2,'0')).join(''));
 set('angle',s.curtain.angle);$('angle-value').textContent=s.curtain.angle+'°';$('curtain-state').textContent=s.curtain.angle+'°';$('buzzer-state').textContent=s.buzzer.on?s.buzzer.frequency+'Hz 울림':'정지';
 sceneReady.then(()=>{if(current===s)renderScene(s);}).catch(()=>{});
 const openness=$('open-direction').value==='180'?s.curtain.angle/180:1-s.curtain.angle/180;$('curtain-fabric').style.width=(1-openness)*100+'%';
 $('lcd-line1').textContent=s.lcd.line1;$('lcd-line2').textContent=s.lcd.line2;$('alarm-effect').hidden=!s.buzzer.on;
 $('state-summary').textContent=`현관등 ${s.led.on?'ON':'OFF'} · 밝기 ${s.led.brightness} / 천장등 ${s.neo.on?'ON':'OFF'} · RGB ${s.neo.r}, ${s.neo.g}, ${s.neo.b} · 밝기 ${s.neo.brightness} / 커튼 ${s.curtain.angle}° / 알람 ${s.buzzer.on?'ON':'OFF'} / LCD “${s.lcd.line1}” · “${s.lcd.line2}”`;
 enabled();}
const home=new HomeSerial({serial:navigator.serial,log,status:displayState,state(p,detail){phase=p;$('connection').textContent='● '+({off:'연결 안 됨',select:'포트 선택 중',settle:'UNO 안정화 중',sync:'초기 상태 조회 중',ready:'연결됨',closing:'연결 해제 중',error:'연결 오류'})[p];
 if(!['ready','sync'].includes(p))resetScene();
 if(!['ready','sync'].includes(p)){$('effects').hidden=true;current=null;$('verified').textContent='상태 미확인';$('sync-time').textContent=lastStatus?'마지막 확인 '+lastStatus.toLocaleTimeString('ko-KR')+' · 현재 연결 안 됨':'장치 상태 확인 대기';for(const key of ['led','neo','curtain','buzzer'])$(key+'-state').textContent='상태 미확인';$('state-summary').textContent='현재 장치 상태 미확인 · 연결 후 STATUS로 동기화합니다.';}
 if(p==='settle')notify('UNO 재시작을 고려해 2.5초 대기한 후 STATUS를 조회합니다(최대 8초 응답 대기).');else if(p==='ready')notify('');else if(detail)notify(detail);enabled();}});
async function execute(commands,label='명령'){if(working)return;working=true;enabled();$('progress').textContent=label+' 처리 중 · 응답 확인';try{await home.run(commands);$('progress').textContent=label+' 완료 · 장치 상태 확인됨';notify('');}catch(e){notify(e.message);$('progress').textContent=label+' 중단 · 일부 명령은 이미 적용됐을 수 있습니다.';}finally{working=false;enabled();}}
$('connect').onclick=()=>void home.connect();$('disconnect').onclick=()=>void home.disconnect();$('status').onclick=()=>void execute(['STATUS'],'상태 조회');
$('led-toggle').onclick=()=>void execute([current?.led.on?'LED:OFF':'LED:ON'],'현관등');
for(const key of ['led','neo']){$(key+'-brightness').addEventListener('input',()=>$(key+'-value').textContent=$(key+'-brightness').value);$(key+'-brightness').addEventListener('change',()=>void execute([`${key.toUpperCase()}:BRIGHTNESS:${integer($(key+'-brightness').value,0,255)}`],'밝기 변경'));}
function rgb(){return $('neo-color').value.slice(1).match(/../g).map(v=>parseInt(v,16)).join(',');}
$('neo-toggle').onclick=()=>void execute([current?.neo.on?'NEO:OFF':'NEO:COLOR:'+rgb()],'천장등');$('neo-color').onchange=()=>void execute(['NEO:COLOR:'+rgb()],'천장등 색상');
const openAngle=()=>Number($('open-direction').value);
$('curtain-open').onclick=()=>void execute(['CURTAIN:ANGLE:'+openAngle()],'커튼 열기');$('curtain-close').onclick=()=>void execute(['CURTAIN:ANGLE:'+(180-openAngle())],'커튼 닫기');$('angle').oninput=()=>$('angle-value').textContent=$('angle').value+'°';$('angle').onchange=()=>void execute(['CURTAIN:ANGLE:'+integer($('angle').value,0,180)],'커튼 각도');
try{$('open-direction').value=localStorage.getItem('home.openDirection')==='0'?'0':'180';}catch{}
$('open-direction').onchange=()=>{try{localStorage.setItem('home.openDirection',$('open-direction').value);}catch{}if(current)displayState(current);};
$('buzzer-form').onsubmit=e=>{e.preventDefault();try{void execute([`BUZZER:TONE:${integer($('frequency').value,31,10000)},${integer($('duration').value,1,60000)}`],'알람');}catch(e){notify(e.message);}};$('buzzer-off').onclick=()=>void execute(['BUZZER:OFF'],'알람 정지');
$('lcd-form').onsubmit=e=>{e.preventDefault();try{void execute([lcdCommand($('line1').value,$('line2').value)],'LCD 문구');}catch(e){notify(e.message);}};$('lcd-clear').onclick=()=>void execute(['LCD:CLEAR'],'LCD 지우기');
document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{const modes={home:['BUZZER:OFF','LED:BRIGHTNESS:200','NEO:BRIGHTNESS:180','NEO:COLOR:255,218,156','CURTAIN:ANGLE:'+openAngle(),'LCD:TEXT:Welcome Home|Climate Smart'],away:['BUZZER:OFF','LED:OFF','NEO:OFF','CURTAIN:ANGLE:'+(180-openAngle()),'LCD:TEXT:Away Mode|See You Soon'],eco:['BUZZER:OFF','LED:OFF','NEO:BRIGHTNESS:40','NEO:COLOR:255,218,156','CURTAIN:ANGLE:'+openAngle(),'LCD:TEXT:Eco Mode|Save Energy']};void execute(modes[button.dataset.mode],button.textContent.trim());});
$('clear-log').onclick=()=>{logs=[];$('log').replaceChildren();$('log-count').textContent='0';};
// No synthetic buzzer-end state: query the firmware periodically instead.
setInterval(()=>{if(phase==='ready'&&!working&&!home.busy)void home.run(['STATUS']).catch(e=>notify(e.message));},2000);
navigator.serial?.addEventListener('disconnect',e=>{if(e.target===home.port||e.port===home.port)void home.disconnect('USB 장치가 분리됐습니다.');});window.addEventListener('pagehide',()=>void home.disconnect());
if(!supported){$('connect').disabled=true;notify(isSecureContext?'Web Serial을 지원하는 데스크톱 Chrome/Edge에서 열어주세요.':'localhost 또는 HTTPS에서 열어주세요.');}


