// Optional development server. The game also opens directly through file://.
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf','.md':'text/plain; charset=utf-8'};
http.createServer((req,res)=>{
  let file;
  try {
    const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    file=path.resolve(root,'.'+(name.endsWith('/')?name+'index.html':name));
  }catch{res.writeHead(400).end();return;}
  if(!file.startsWith(root+path.sep)||!['GET','HEAD'].includes(req.method)){res.writeHead(403).end();return;}
  fs.stat(file,(error,stat)=>{
    if(error||!stat.isFile()){res.writeHead(404).end('Not found');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-store'});
    if(req.method==='HEAD')res.end();else {const stream=fs.createReadStream(file);stream.on('error',()=>res.destroy());stream.pipe(res);}
  });
}).listen(Number(process.env.PORT)||4178,'127.0.0.1',()=>console.log('Kakuro: http://127.0.0.1:'+(Number(process.env.PORT)||4178)));
