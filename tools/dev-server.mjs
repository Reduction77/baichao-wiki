import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const args=process.argv.slice(2);
if(args.includes('--help')){console.log('Usage: npm run dev -- [--host 127.0.0.1] [--port 7100]');process.exit(0);}
const option=(name,fallback)=>{const index=args.indexOf(name);return index>=0?args[index+1]:args.find(value=>value.startsWith(name+'='))?.slice(name.length+1)||fallback;};
const host=option('--host','127.0.0.1'),port=Number(option('--port','7100'));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../web');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.mp3':'audio/mpeg','.mp4':'video/mp4'};
const server=http.createServer((request,response)=>{
  let pathname;
  try{pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);}catch{response.writeHead(400);response.end('Bad request');return;}
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(file!==root&&!file.startsWith(root+path.sep)){response.writeHead(403);response.end('Forbidden');return;}
  fs.stat(file,(error,stat)=>{
    if(error||!stat.isFile()){response.writeHead(404);response.end('Not found');return;}
    const headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache'};
    if(file.endsWith('.gz')){headers['Content-Type']='application/json; charset=utf-8';headers['Content-Encoding']='gzip';}
    response.writeHead(200,headers);
    if(request.method==='HEAD'){response.end();return;}
    const stream=fs.createReadStream(file);stream.on('error',()=>response.destroy());stream.pipe(response);
  });
});
server.listen(port,host,()=>console.log(`Baichao Wiki preview: http://${host}:${port}/`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
