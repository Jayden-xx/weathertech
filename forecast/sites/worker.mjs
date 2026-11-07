import {Gateway,APIError,publications,FUNCTIONS} from './core.mjs';
import {HTML,CSS,JS,CHAT_JS,REGIONS,DEMO} from './assets.mjs';
import {ChatGateway,chatFields} from './chat-core.mjs';
const headers={'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'",'Referrer-Policy':'strict-origin-when-cross-origin'};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});}
export default{async fetch(request,env,ctx){
 const url=new URL(request.url),page=url.searchParams.get('page'),code=url.searchParams.get('code'),issue=url.searchParams.get('issue')||'auto';
 const types={'/static/style.css':['text/css; charset=utf-8',CSS],'/static/app.js':['text/javascript; charset=utf-8',JS],'/static/chat.js':['text/javascript; charset=utf-8',CHAT_JS]};
 if(request.method==='POST'&&['/api/chat','/api/chat/session','/api/chat/clear','/api/chat/ack'].includes(url.pathname)){
  if(request.headers.get('Origin')!==url.origin||['cross-site','none'].includes(request.headers.get('Sec-Fetch-Site')))return json({ok:false,error:{kind:'CHAT_ORIGIN',message:'같은 사이트에서만 챗봇을 사용할 수 있습니다.'}},403);
  if(request.headers.get('Content-Type')?.split(';')[0].trim()!=='application/json')return json({ok:false,error:{kind:'CHAT_INPUT',message:'JSON 요청만 허용합니다.'}},415);
  try{
   if(!env.DB)throw new APIError('CHAT_SERVER','챗봇 저장소를 준비 중입니다.',60);
   const reader=request.body?.getReader();if(!reader)throw new APIError('CHAT_INPUT','JSON 본문이 필요합니다.',0);let size=0,chunks=[];
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>32768){await reader.cancel();throw new APIError('CHAT_INPUT','요청은 32KB 이하여야 합니다.',0);}chunks.push(value);}
   const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}let body;try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new APIError('CHAT_INPUT','JSON 형식을 확인하세요.',0);}
   const chat=new ChatGateway(new Gateway(env.DB,env.KMA_SERVICE_KEY||'',REGIONS),env);
   if(url.pathname==='/api/chat/session'){chatFields(body,[]);return json(await chat.session());}
   if(url.pathname==='/api/chat/clear'){chatFields(body,['sessionId']);return json(await chat.clear(body.sessionId));}
   if(url.pathname==='/api/chat/ack')return json(await chat.acknowledge(body));
   return json(await chat.ask(body));
  }catch(e){return json({ok:false,error:(e instanceof APIError?e:new APIError('CHAT_SERVER','챗봇 처리 오류입니다. 예보는 계속 사용할 수 있습니다.',60)).public()},400);}
 }
 if(!['GET','HEAD'].includes(request.method))return json({error:'허용되지 않은 요청입니다.'},405);
 if(['/',...Object.keys(FUNCTIONS).map(p=>'/'+p)].includes(url.pathname))return new Response(request.method==='HEAD'?null:HTML,{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=60'}});
 if(types[url.pathname]){const[type,value]=types[url.pathname];return new Response(request.method==='HEAD'?null:value,{headers:{...headers,'Content-Type':type,'Cache-Control':'public, max-age=300'}});}
 if(url.pathname==='/favicon.ico')return new Response(null,{status:204});
 if(!url.pathname.startsWith('/api/'))return json({error:'페이지를 찾을 수 없습니다.'},404);
 try{
  if(!env.DB)throw new APIError('SERVER','자료 저장소를 준비 중입니다. 잠시 후 다시 확인해 주세요.',120);
  const gateway=new Gateway(env.DB,env.KMA_SERVICE_KEY||'',REGIONS);
  if(url.pathname==='/api/chat/status')return json(await new ChatGateway(gateway,env).status());
  if(url.pathname==='/api/status')return json({ready:true,config:{state:env.KMA_SERVICE_KEY&&env.KMA_SERVICE_KEY!=='YOUR_API_KEY'?'configured':'missing',source:'Sites 서버 비밀 환경변수'},keyPath:'Sites 환경변수: KMA_SERVICE_KEY (방문자에게 키를 요청하지 않습니다)',regions:REGIONS,publications:publications(),quota:await gateway.stats(),url:new URL('/outlook',url).href,notice:'하루 두 번 발표 · 최근 24시간 자료 · 30초는 확인 주기'});
  if(url.pathname==='/api/forecast')return json(await gateway.forecast(page,code,issue));
  if(url.pathname==='/api/demo'){
   if(!FUNCTIONS[page]||!REGIONS[page].some(r=>r.code===code)||issue!=='auto'&&!publications().includes(issue))throw new APIError('INPUT','올바른 지역과 최근 발표본을 선택하세요.',30);
   const used=issue==='auto'?publications()[0]:issue,payload=structuredClone(DEMO[page]);
   const item=payload.response.body.items.item[0];if(page!=='outlook')item.regId=code;
   const result=await gateway.result(page,code,issue,used,{payload,success:Date.now(),cached:false});
   return json({...result,demo:true,source:'모의 응답 · 실제 예보 아님'});
  }
  return json({error:'페이지를 찾을 수 없습니다.'},404);
 }catch(e){return json({ok:false,error:(e instanceof APIError?e:new APIError('SERVER','자료 처리 중 오류가 발생했습니다. 잠시 후 다시 확인해 주세요.',120)).public()},e instanceof APIError?400:503);}
}};
