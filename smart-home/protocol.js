export function integer(value,min,max){if(!/^\d+$/.test(String(value))||!Number.isSafeInteger(Number(value))||Number(value)<min||Number(value)>max)throw Error(`${min}–${max} 범위의 정수를 입력하세요.`);return Number(value);}
export function lcdCommand(a,b){for(const line of [a,b])if(line.length>16||/[^\x20-\x7e]|\|/.test(line))throw Error('LCD는 줄당 영문·숫자·기호 16자까지입니다. 한글과 | 문자는 지원하지 않습니다.');return `LCD:TEXT:${a}|${b}`;}
export function commandAck(command){
 if(['LED:ON','LED:OFF','NEO:OFF','BUZZER:OFF','LCD:CLEAR'].includes(command))return command;
 if(command==='STATUS')return null;
 const parts=command.split(':'); const name=parts.slice(0,2).join(':');const arg=parts.slice(2).join(':');
 if(['LED:BRIGHTNESS','NEO:BRIGHTNESS'].includes(name))integer(arg,0,255);
 else if(name==='CURTAIN:ANGLE')integer(arg,0,180);
 else if(name==='NEO:COLOR'){const rgb=arg.split(',');if(rgb.length!==3)throw Error('RGB 인수가 필요합니다.');rgb.forEach(v=>integer(v,0,255));}
 else if(name==='BUZZER:TONE'){const pair=arg.split(',');if(pair.length!==2)throw Error('주파수와 시간이 필요합니다.');integer(pair[0],31,10000);integer(pair[1],1,60000);}
 else if(name==='LCD:TEXT'){const lines=arg.split('|');if(lines.length!==2)throw Error('LCD 구분자가 필요합니다.');lcdCommand(...lines);}
 else throw Error('지원하지 않는 명령입니다.');
 return name;
}
export function validStatus(m){
 if(m?.type!=='status')throw Error('STATUS 형식 오류');
 for(const key of ['led','neo','buzzer'])if(typeof m[key]?.on!=='boolean')throw Error(`${key} 상태 누락`);
 for(const [value,max] of [[m.led.brightness,255],[m.neo.brightness,255],[m.neo.r,255],[m.neo.g,255],[m.neo.b,255],[m.curtain?.angle,180],[m.buzzer.frequency,10000]]){if(typeof value!=='number')throw Error('STATUS 숫자 누락');integer(value,0,max);}
 if(typeof m.lcd?.line1!=='string'||typeof m.lcd?.line2!=='string')throw Error('LCD 상태 누락');return m;
}
export class Lines {
 constructor(line,error){this.line=line;this.error=error;this.buffer='';this.decoder=new TextDecoder();this.discard=false;}
 push(bytes){const text=this.decoder.decode(bytes,{stream:true});for(const c of text){if(c==='\n'){if(!this.discard&&this.buffer.trim())this.line(this.buffer.replace(/\r$/,''));this.buffer='';this.discard=false;}else if(!this.discard){this.buffer+=c;if(this.buffer.length>65536){this.buffer='';this.discard=true;this.error('수신 줄이 너무 깁니다.');}}}}
 finish(){if(this.buffer.trim())this.error('연결 종료: 불완전한 수신 줄을 폐기했습니다.');this.buffer='';}
}
// Exactly one command awaits a response at a time. A timed-out session is closed,
// preventing a late prefix-only ACK from acknowledging a later command.
export class HomeSerial {
 constructor({serial,log=()=>{},state=()=>{},status=()=>{},timeout=3500,initialTimeout=8000,settle=2500}){Object.assign(this,{serial,log,state,status,timeout,initialTimeout,settle});this.phase='off';this.port=null;this.opened=false;this.tail=Promise.resolve();this.pending=null;this.busy=false;this.closing=null;this.receivedBytes=0;}
 phaseTo(p,detail=''){this.phase=p;this.state(p,detail);}
 async connect(){if(this.port||!['off','error'].includes(this.phase))return;this.phaseTo('select');try{
 this.receivedBytes=0;this.port=await this.serial.requestPort();const info=this.port.getInfo();this.log('SYS','선택한 포트',JSON.stringify(info));
 if(info.usbVendorId===undefined)this.log('SYS','USB 식별 정보가 없는 포트입니다.','앞서 사용한 USB-SERIAL CH340(COM3)를 선택하세요. 같은 UNO의 입력/출력은 동일한 포트를 사용합니다.');
 await this.port.open({baudRate:115200,dataBits:8,stopBits:1,parity:'none',flowControl:'none'});this.opened=true;
 if(typeof this.port.setSignals==='function'){try{
 await this.port.setSignals({dataTerminalReady:false,requestToSend:false});
 await new Promise(resolve=>setTimeout(resolve,150));
 await this.port.setSignals({dataTerminalReady:true,requestToSend:false});
 this.log('SYS','DTR 꺼짐 → 켜짐 전환 · UNO 재시작 안정화 시작');
 }catch(e){this.log('SYS','DTR 설정을 적용하지 못했습니다.',e.message);}}
 this.writer=this.port.writable.getWriter();
 this.parser=new Lines(raw=>this.receive(raw),e=>this.log('ERROR',e));this.phaseTo('settle');this.readTask=this.readLoop();
 await new Promise(resolve=>{this.readyResolve=resolve;this.readyTimer=setTimeout(resolve,this.settle);});this.readyResolve=null;
 if(this.phase!=='settle')return;this.phaseTo('sync');
 try{await this.request('STATUS',this.initialTimeout);}catch(e){
 if(this.phase!=='sync'||this.receivedBytes!==0||!e.message.startsWith('응답 시간 초과:'))throw e;
 this.log('SYS','초기 STATUS 무수신 · 읽기 전용 상태 조회를 한 번 더 시도합니다.');
 await this.request('STATUS',this.initialTimeout);
 }
 if(this.phase==='sync')this.phaseTo('ready');
 }catch(e){if(e.name==='NotFoundError'&&!this.port){this.phaseTo('off','포트 선택을 취소했습니다.');return;}const detail=this.opened?`포트는 열렸지만 출력 펌웨어의 STATUS 확인에 실패했습니다. ${e.message}. 수신 ${this.receivedBytes}바이트. 같은 UNO에는 출력용 web_serial_output_firmware.ino를 업로드해야 합니다. COM3 등 실제 USB 포트를 선택하고, IDE에서 115200 baud·새 줄로 STATUS 응답을 확인하세요. 무응답이면 LCD/I2C 초기화와 전원·배선도 확인하세요.`:`포트 열기 실패: ${e.message}. 다른 시리얼 모니터·탭의 점유, USB 케이블과 드라이버를 확인하세요.`;this.log('ERROR',detail);await this.disconnect(detail);}}
 receive(raw){let m;try{m=JSON.parse(raw);if(!m||!['ack','status','error'].includes(m.type))throw Error('알 수 없는 응답 type');if(m.type==='status')validStatus(m);if(m.type==='ack'&&typeof m.command!=='string')throw Error('ACK command 누락');if(m.type==='error'&&typeof m.code!=='string')throw Error('error code 누락');}catch(e){this.log('ERROR',raw,`JSON/프로토콜 오류: ${e.message}`);return;}
 this.log(m.type.toUpperCase(),raw);if(m.type==='status')this.status(m);
 if(!this.pending)return;
 if(m.type==='error'){this.pending.reject(Error(`장치 오류: ${m.code}`));return;}
 if((this.pending.ack===null&&m.type==='status')||(m.type==='ack'&&m.command===this.pending.ack))this.pending.resolve(m);
 else this.log('SYS','현재 명령과 일치하지 않는 응답',raw);
 }
 async readLoop(){try{this.reader=this.port.readable.getReader();while(!['off','error','closing'].includes(this.phase)){const {value,done}=await this.reader.read();if(done)break;this.receivedBytes+=value.byteLength;this.parser.push(value);}if(this.phase!=='closing')throw Error('수신 스트림 종료');}catch(e){if(this.phase!=='closing'){this.log('ERROR',`수신 오류: ${e.message}`);queueMicrotask(()=>void this.disconnect(e.message));}}finally{this.reader?.releaseLock();this.reader=null;this.parser.finish();}}
 async request(command,timeout=this.timeout){const ack=commandAck(command);if(!this.opened||!['ready','sync'].includes(this.phase))throw Error('연결 준비가 끝나지 않았습니다.');
 let timer;const response=new Promise((resolve,reject)=>{this.pending={ack,resolve,reject};timer=setTimeout(()=>reject(Error(`응답 시간 초과: ${command}`)),timeout);});
 // Attach rejection handler before a potentially slow write.
 response.catch(()=>{});
 try{await this.writer.write(new TextEncoder().encode(command+'\n'));this.log('TX',command,'LF 포함');return await response;}finally{clearTimeout(timer);this.pending=null;}}
 run(commands){const operation=this.tail.then(async()=>{if(this.phase!=='ready')throw Error('아두이노 연결 후 사용하세요.');this.busy=true;try{for(const command of commands){await this.request(command);if(command!=='STATUS')await this.request('STATUS');}}catch(e){await this.disconnect(e.message);throw e;}finally{this.busy=false;}});this.tail=operation.catch(()=>{});return operation;}
 disconnect(reason=''){if(this.closing)return this.closing;this.closing=this.cleanup(reason).finally(()=>this.closing=null);return this.closing;}
 async cleanup(reason){this.phaseTo('closing');clearTimeout(this.readyTimer);this.readyResolve?.();this.pending?.reject(Error('연결이 종료되었습니다.'));
 try{await this.reader?.cancel();}catch(e){this.log('ERROR',e.message);}await this.readTask;this.readTask=null;
 if(this.writer){try{await this.writer.abort();}catch(e){this.log('ERROR',e.message);}this.writer.releaseLock();this.writer=null;}
 if(this.opened){try{await this.port.close();this.opened=false;}catch(e){if(this.port.readable===null&&this.port.writable===null)this.opened=false;else{reason=`포트 종료 실패: ${e.message}. 연결 해제를 다시 누르세요.`;this.log('ERROR',reason);}}}
 if(!this.opened)this.port=null;this.phaseTo(reason?'error':'off',reason);}
}
