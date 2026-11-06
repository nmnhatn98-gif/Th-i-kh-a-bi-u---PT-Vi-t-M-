import {createLessonReports} from './server/lesson-reports.mjs';
import {createAttendance} from './server/attendance.mjs';
import {createPushService,validCronSecret} from './server/push.mjs';
import {readJsonBody as body} from './server/json-body.mjs';
import {suggestSchedule} from './server/ai-schedule.mjs';
import {gzipSync} from 'node:zlib';
import http from 'node:http';import path from 'node:path';import {fileURLToPath} from 'node:url';import {readFile,stat} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {createFirebaseVerifier} from './server/auth.mjs';import {SupabaseStore} from './server/supabase.mjs';import {createService} from './server/service.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
try{process.loadEnvFile(path.join(root,'.env'));}catch{}
const url=process.env.SUPABASE_URL||'',key=process.env.SUPABASE_SERVICE_ROLE_KEY||'',project=process.env.FIREBASE_PROJECT_ID||'invertible-sublime-v6shk',owner=process.env.OWNER_EMAIL||'nmnhat.n98@gmail.com';
if(url&&!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url))throw Error('SUPABASE_URL phải là URL HTTPS của dự án Supabase.');
const store=url&&key?new SupabaseStore(url,key):null,verifyToken=createFirebaseVerifier(project);
const service=store?createService({store,verifyToken,ownerEmail:owner}):null;
const lessonReports=store?createLessonReports({store,verifyToken,ownerEmail:owner}):null;
const attendance=store?createAttendance({store,verifyToken,ownerEmail:owner}):null;
const push=store?createPushService({store,verifyToken,publicKey:process.env.PUSH_PUBLIC_KEY,privateKey:process.env.PUSH_PRIVATE_KEY}):null;
const mime={'.webmanifest':'application/manifest+json; charset=utf-8','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
function send(res,status,value){let body=Buffer.from(JSON.stringify(value));const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',Vary:'Accept-Encoding'};if(body.length>4096&&/\bgzip\b/.test(res.req?.headers['accept-encoding']||'')){body=gzipSync(body,{level:3});headers['Content-Encoding']='gzip';}res.writeHead(status,headers);res.end(body);}
const server=http.createServer(async(req,res)=>{
 try{
  const route=new URL(req.url,'http://localhost');
  if(route.pathname==='/api/health'){send(res,200,{storage:'supabase',configured:Boolean(service),driveClientEnabled:true,aiConfigured:Boolean(process.env.GEMINI_API_KEY)});return;}
  if(route.pathname.startsWith('/api/')){
   if(!service){send(res,503,{error:'Bản thử chưa kết nối Supabase. Hãy tạo dự án và đặt cấu hình máy chủ theo hướng dẫn.',code:'not-configured'});return;}
   if(route.pathname==='/api/push/dispatch'){if(req.method!=='POST'||!validCronSecret(req.headers['x-tkb-cron'],process.env.PUSH_CRON_SECRET)){send(res,403,{error:'Không được phép gọi lịch gửi.'});return;}send(res,200,await push.dispatch());return;}
   const token=req.headers.authorization?.match(/^Bearer ([^\s]+)$/)?.[1];if(!token){send(res,401,{error:'Vui lòng đăng nhập Google.',code:'unauthenticated'});return;}
   if(req.method==='GET'&&route.pathname==='/api/push/config'){send(res,200,await push.config(token));return;}
   if(req.method==='POST'&&['/api/push/subscribe','/api/push/unsubscribe','/api/push/test'].includes(route.pathname)){send(res,200,await push[route.pathname.split('/').pop()](token,await body(req)));return;}
   if(req.method==='GET'&&route.pathname==='/api/attendance/teaching'){send(res,200,await attendance.teaching(token,route.searchParams.get('date')));return;}
   if(req.method==='GET'&&route.pathname==='/api/attendance/statistics'){send(res,200,await attendance.statistics(token,Object.fromEntries(route.searchParams)));return;}
   if(req.method==='GET'&&route.pathname==='/api/attendance/overview'){send(res,200,await attendance.overview(token,route.searchParams.get('date')));return;}
   if(req.method==='GET'&&route.pathname==='/api/attendance'){send(res,200,await attendance.read(token,route.searchParams.get('date'),route.searchParams.get('classId')));return;}
   if(req.method==='POST'&&route.pathname==='/api/attendance'){send(res,200,await attendance.write(token,await body(req)));return;}
   if(req.method==='GET'&&route.pathname==='/api/lesson-reports'){send(res,200,await lessonReports.read(token,route.searchParams.get('week')));return;}
   if(req.method==='POST'&&route.pathname==='/api/lesson-reports'){send(res,200,await lessonReports.write(token,await body(req)));return;}
   if(req.method==='POST'&&route.pathname==='/api/ai/suggest'){
    const row=await service.read(token,'timetables','working');
    const input=await body(req);if(!row.data)throw Object.assign(Error('Chưa có lịch nháp.'),{status:400});
    const result=await suggestSchedule({state:row.data,email:createHash('sha256').update(token).digest('hex'),instruction:input.instruction,key:process.env.GEMINI_API_KEY,model:process.env.GEMINI_MODEL||'gemini-2.5-flash'});
    send(res,200,{...result,revision:row.data.revision});return;
   }
   if(req.method==='GET'&&route.pathname==='/api/data'){
    const result=await service.read(token,route.searchParams.get('collection'),route.searchParams.has('id')?route.searchParams.get('id'):undefined);
    const tag='"'+createHash('sha256').update(JSON.stringify(result)).digest('hex')+'"';if(req.headers['if-none-match']===tag){res.writeHead(304,{'Cache-Control':'no-store',ETag:tag});res.end();return;}res.setHeader('ETag',tag);send(res,200,result);return;
   }
   if(req.method==='POST'&&route.pathname==='/api/data'){const input=await body(req),result=await service.write(token,input);if(input.returnReceipt&&input.collection==='timetables'&&input.id==='working'&&result.receiptSafe){send(res,200,{id:result.id,version:result.version,skipped:result.skipped,receipt:{revision:result.data.revision,updatedAt:result.data.updatedAt,updatedBy:result.data.updatedBy}});}else send(res,200,result);return;}
   if(req.method==='GET'&&route.pathname==='/api/backup'){send(res,200,await service.backup(token));return;}
   if(req.method==='POST'&&route.pathname==='/api/migration'){send(res,200,await service.migrate(token,await body(req)));return;}
   send(res,404,{error:'Không có chức năng API này.'});return;
  }
  const dir=path.join(root,'dist');let pathname=decodeURIComponent(route.pathname);let target=path.resolve(dir,'.'+pathname);
  const relative=path.relative(dir,target);if(relative.startsWith('..')||path.isAbsolute(relative)){send(res,403,{error:'Không được truy cập.'});return;}
  let entry=await stat(target).catch(()=>null);if(entry?.isDirectory()){target=path.join(target,'index.html');entry=await stat(target).catch(()=>null);}
  if(!entry&&!path.extname(pathname))target=path.join(dir,'index.html');
  const data=await readFile(target).catch(()=>null);if(!data){send(res,404,{error:'Chưa có bản đóng gói. Chạy npm run build trước.'});return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Cache-Control':(path.extname(target)==='.html'||['sw.js','manifest.webmanifest'].includes(path.basename(target)))?'no-cache':'public,max-age=3600'});res.end(data);
 }catch(e){send(res,e.status||500,{error:e.status?e.message:'Chưa hoàn tất thao tác. Vui lòng giữ sao lưu và thử lại.',code:e.code||'internal'});}
});
const port=Number(process.env.PORT)||(process.argv.includes('--api-only')?3001:3000);
server.listen(port,'0.0.0.0',()=>console.log(`TKB hybrid listening on ${port}; Supabase configured: ${Boolean(service)}`));
