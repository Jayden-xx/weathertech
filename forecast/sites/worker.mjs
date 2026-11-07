import {Gateway,APIError,publications,FUNCTIONS} from './core.mjs';
import {HTML,CSS,JS,REGIONS,DEMO} from './assets.mjs';
const headers={'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'",'Referrer-Policy':'strict-origin-when-cross-origin'};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});}
export default{async fetch(request,env,ctx){
 const url=new URL(request.url),page=url.searchParams.get('page'),code=url.searchParams.get('code'),issue=url.searchParams.get('issue')||'auto';
 const types={'/static/style.css':['text/css; charset=utf-8',CSS],'/static/app.js':['text/javascript; charset=utf-8',JS]};
 if(!['GET','HEAD'].includes(request.method))return json({error:'조회 요청만 허용합니다.'},405);
 if(['/',...Object.keys(FUNCTIONS).map(p=>'/'+p)].includes(url.pathname))return new Response(request.method==='HEAD'?null:HTML,{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=60'}});
 if(types[url.pathname]){const[type,value]=types[url.pathname];return new Response(request.method==='HEAD'?null:value,{headers:{...headers,'Content-Type':type,'Cache-Control':'public, max-age=300'}});}
 if(url.pathname==='/favicon.ico')return new Response(null,{status:204});
 if(!url.pathname.startsWith('/api/'))return json({error:'페이지를 찾을 수 없습니다.'},404);
 try{
  if(!env.DB)throw new APIError('SERVER','자료 저장소를 준비 중입니다. 잠시 후 다시 확인해 주세요.',120);
  const gateway=new Gateway(env.DB,env.KMA_SERVICE_KEY||'',REGIONS);
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
