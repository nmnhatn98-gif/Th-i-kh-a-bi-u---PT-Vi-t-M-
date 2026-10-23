import http from 'node:http';import path from 'node:path';import {fileURLToPath} from 'node:url';import {readFile,stat} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {createFirebaseVerifier} from './server/auth.mjs';import {SupabaseStore} from './server/supabase.mjs';import {createService} from './server/service.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
try{process.loadEnvFile(path.join(root,'.env'));}catch{}
const url=process.env.SUPABASE_URL||'',key=process.env.SUPABASE_SERVICE_ROLE_KEY||'',project=process.env.FIREBASE_PROJECT_ID||'invertible-sublime-v6shk',owner=process.env.OWNER_EMAIL||'nmnhat.n98@gmail.com';
if(url&&!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url))throw Error('SUPABASE_URL phải là URL HTTPS của dự án Supabase.');
const service=url&&key?createService({store:new SupabaseStore(url,key),verifyToken:createFirebaseVerifier(project),ownerEmail:owner}):null;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
function send(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));}
async function body(req){const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>10*1024*1024)throw Object.assign(Error('Tệp quá lớn, giới hạn thử nghiệm 10 MB.'),{status:413});chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw Object.assign(Error('Nội dung JSON không hợp lệ.'),{status:400});}}
const server=http.createServer(async(req,res)=>{
 try{
  const route=new URL(req.url,'http://localhost');
  if(route.pathname==='/api/health'){send(res,200,{storage:'supabase',configured:Boolean(service),driveClientEnabled:true});return;}
  if(route.pathname.startsWith('/api/')){
   if(!service){send(res,503,{error:'Bản thử chưa kết nối Supabase. Hãy tạo dự án và đặt cấu hình máy chủ theo hướng dẫn.',code:'not-configured'});return;}
   const token=req.headers.authorization?.match(/^Bearer ([^\s]+)$/)?.[1];if(!token){send(res,401,{error:'Vui lòng đăng nhập Google.',code:'unauthenticated'});return;}
   if(req.method==='GET'&&route.pathname==='/api/data'){
    const result=await service.read(token,route.searchParams.get('collection'),route.searchParams.has('id')?route.searchParams.get('id'):undefined);
    const tag='"'+createHash('sha256').update(JSON.stringify(result)).digest('hex')+'"';if(req.headers['if-none-match']===tag){res.writeHead(304,{'Cache-Control':'no-store',ETag:tag});res.end();return;}res.setHeader('ETag',tag);send(res,200,result);return;
   }
   if(req.method==='POST'&&route.pathname==='/api/data'){send(res,200,await service.write(token,await body(req)));return;}
   if(req.method==='GET'&&route.pathname==='/api/backup'){send(res,200,await service.backup(token));return;}
   if(req.method==='POST'&&route.pathname==='/api/migration'){send(res,200,await service.migrate(token,await body(req)));return;}
   send(res,404,{error:'Không có chức năng API này.'});return;
  }
  const dir=path.join(root,'dist');let pathname=decodeURIComponent(route.pathname);let target=path.resolve(dir,'.'+pathname);
  const relative=path.relative(dir,target);if(relative.startsWith('..')||path.isAbsolute(relative)){send(res,403,{error:'Không được truy cập.'});return;}
  let entry=await stat(target).catch(()=>null);if(entry?.isDirectory()){target=path.join(target,'index.html');entry=await stat(target).catch(()=>null);}
  if(!entry&&!path.extname(pathname))target=path.join(dir,'index.html');
  const data=await readFile(target).catch(()=>null);if(!data){send(res,404,{error:'Chưa có bản đóng gói. Chạy npm run build trước.'});return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Cache-Control':path.extname(target)==='.html'?'no-cache':'public,max-age=3600'});res.end(data);
 }catch(e){send(res,e.status||500,{error:e.status?e.message:'Chưa hoàn tất thao tác. Vui lòng giữ sao lưu và thử lại.',code:e.code||'internal'});}
});
const port=Number(process.env.PORT)||(process.argv.includes('--api-only')?3001:3000);
server.listen(port,'0.0.0.0',()=>console.log(`TKB hybrid listening on ${port}; Supabase configured: ${Boolean(service)}`));
