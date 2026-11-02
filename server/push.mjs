import {timingSafeEqual} from 'node:crypto';
import {fail} from './policy.mjs';
import {checkedSubscription,dueLessons,digest} from './push-schedule.mjs';

export function validCronSecret(actual,expected){return typeof actual==='string'&&typeof expected==='string'&&expected.length>=32&&Buffer.byteLength(actual)===Buffer.byteLength(expected)&&timingSafeEqual(Buffer.from(actual),Buffer.from(expected));}
export function createPushService({store,verifyToken,publicKey,privateKey,subject='mailto:nmnhat.n98@gmail.com',now=()=>new Date(),send=async(...args)=>(await import('web-push')).default.sendNotification(...args)}){
 const enabled=Boolean(publicKey&&privateKey);
 async function actor(token){const user=await verifyToken(token),profile=(await store.get('users',user.email)).data;if(!profile?.active||!profile.teacherId)throw fail(403,'Chỉ tài khoản đang hoạt động và đã liên kết giáo viên mới bật được nhắc lịch.');return {...profile,email:user.email};}
 async function request(action,body){return store.request('rpc/tkb_push_'+action,{method:'POST',body});}
 async function deliver(subscription,payload){try{await send(subscription,JSON.stringify(payload),{TTL:300,urgency:'high',timeout:10000,vapidDetails:{subject,publicKey,privateKey}});return true;}catch(e){if([404,410].includes(e.statusCode))return 'expired';throw e;}}
 return {
  async config(token){await actor(token);return {enabled,publicKey:enabled?publicKey:'',leadMinutes:10};},
  async subscribe(token,input){const user=await actor(token);if(!enabled)throw fail(503,'Nhắc lịch chưa được quản trị viên cấu hình.');let sub;try{sub=checkedSubscription(input?.subscription);}catch(e){throw fail(400,e.message);}await request('subscribe',{p_id:digest(sub.endpoint),p_email:user.email,p_subscription:sub});return {ok:true};},
  async unsubscribe(token,input){const user=await verifyToken(token);if(typeof input?.endpoint!=='string'||input.endpoint.length>2000)throw fail(400,'Thiếu đăng ký thiết bị.');await request('unsubscribe',{p_id:digest(input.endpoint),p_email:user.email});return {ok:true};},
  async test(token,input){const user=await actor(token);if(!enabled)throw fail(503,'Nhắc lịch chưa được cấu hình.');const id=digest(String(input?.endpoint||'')),rows=await store.request('tkb_push_subscriptions?'+new URLSearchParams({id:'eq.'+id,email:'eq.'+user.email,select:'id,subscription'}));const row=rows[0];if(!row)throw fail(404,'Thiết bị chưa bật thông báo.');const claimed=await request('claim',{p_id:id,p_key:'test:'+Math.floor(+now()/60000)});if(!claimed)throw fail(429,'Vui lòng chờ một phút trước khi thử lại.');const result=await deliver(row.subscription,{title:'TKB Việt Mỹ',body:'Đã kết nối thông báo. App sẽ nhắc trước tiết dạy 10 phút theo lịch đã công bố.',tag:'tkb-push-test',url:'/?open=my_teaching'});if(result==='expired'){await request('unsubscribe',{p_id:id,p_email:user.email});throw fail(410,'Đăng ký thiết bị đã hết hạn. Hãy bật lại.');}return {ok:true,message:'Đã gửi đến dịch vụ thông báo. Hãy kiểm tra trên điện thoại.'};},
  async dispatch(){
   if(!enabled)throw fail(503,'Chưa cấu hình gửi thông báo.');
   const at=now(),hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',hourCycle:'h23'}).format(at));if(hour<6||hour>18)return {sent:0};
   const subscriptions=await store.request('tkb_push_subscriptions?select=id,email,subscription&order=id&limit=1000');if(!subscriptions.length)return {sent:0};
   if(subscriptions.length===1000)throw fail(503,'Số thiết bị vượt giới hạn xử lý; cần chia lô trước khi bật thêm.');
   const published=(await store.get('timetables','published')).data;
   const profileRows=await store.request('tkb_documents?collection=eq.users&select=id,active:data->active,teacherId:data->teacherId&limit=1000');
   if(profileRows.length===1000)throw fail(503,'Cần chia lô danh sách giáo viên.');
   const profiles=new Map(profileRows.map(r=>[r.id,{active:r.active,teacherId:r.teacherId}]));let sent=0,failed=0;
   for(const row of subscriptions){
    const profile=profiles.get(row.email);if(!profile?.active||!profile.teacherId)continue;
    let subscription;try{subscription=checkedSubscription(row.subscription);}catch{continue;}
    for(const lesson of dueLessons(published,profile.teacherId,at)){
     if(!await request('claim',{p_id:row.id,p_key:lesson.id}))continue;
     try{const result=await deliver(subscription,lesson.payload);if(result==='expired'){await request('unsubscribe',{p_id:row.id,p_email:row.email});break;}sent++;}catch{failed++;}
    }
   }
   return {sent,failed};
  }
 };
}
