import http from 'node:http';import {readFile} from 'node:fs/promises';
const port=Number(process.env.PORT||5174);
const sceneFiles=['home-off.png','home-led.png','home-neo.png'];
const files={'/':['index.html','text/html'],'/index.html':['index.html','text/html'],'/style.css':['style.css','text/css'],'/app.js':['app.js','text/javascript'],'/protocol.js':['protocol.js','text/javascript'],'/public/images/smart-home.png':['public/images/smart-home.png','image/png']};
files['/scenes.js']=['scenes.js','text/javascript'];
for(const name of sceneFiles)files['/public/images/'+name]=['public/images/'+name,'image/png'];
const server=http.createServer(async(req,res)=>{const file=files[new URL(req.url,'http://localhost').pathname];if(!file){res.writeHead(404);res.end('Not found');return;}try{const bytes=await readFile(new URL(file[0],import.meta.url));res.writeHead(200,{'Content-Type':file[1]+(file[1]==='image/png'?'':'; charset=utf-8'),'Cache-Control':'no-store','Permissions-Policy':'serial=(self)','X-Content-Type-Options':'nosniff'});res.end(bytes);}catch{res.writeHead(500);res.end('Asset unavailable');}});
server.on('error',e=>{console.error(e.message);process.exitCode=1;});server.listen(port,'127.0.0.1',()=>console.log(`My Smart Home: http://localhost:${port}`));
