import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
const allowed=new Set(['/','/index.html','/src/app.js','/src/core.js','/src/seed.js','/src/styles.css']);
const server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(!allowed.has(pathname)){res.writeHead(404);res.end('Not found');return;}
  try{const file=path.join(root,pathname==='/'?'index.html':pathname.slice(1));const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'text/plain','X-Content-Type-Options':'nosniff'});res.end(data);}
  catch{res.writeHead(404);res.end('Not found');}
});
server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log(`Local: http://localhost:${server.address().port}`));
