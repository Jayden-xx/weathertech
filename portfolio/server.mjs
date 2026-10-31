import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    // 프로젝트 폴더 밖의 파일은 제공하지 않습니다.
    if (!target.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    const content = await readFile(target);
    response.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' }).end(content);
  } catch { response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('파일을 찾을 수 없습니다.'); }
});
server.listen(4173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4173'));
