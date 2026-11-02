import {auth} from './firebase.js';
async function api(path,input){
 if(!auth.currentUser)throw Error('Vui lòng đăng nhập.');
 const token=await auth.currentUser.getIdToken();
 const response=await fetch('/api/push/'+path,{method:input?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(input?{body:JSON.stringify(input)}:{}),signal:AbortSignal.timeout(20000)});
 const result=await response.json();if(!response.ok)throw Error(result.error||'Chưa kết nối được thông báo.');return result;
}
const keyBytes=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'=')),c=>c.charCodeAt(0));
export async function disableDevicePush(){
 if(!('serviceWorker' in navigator))return;
 const registration=await navigator.serviceWorker.getRegistration('/'),sub=await registration?.pushManager?.getSubscription();
 if(!sub)return;
 try{await api('unsubscribe',{endpoint:sub.endpoint});}finally{await sub.unsubscribe();}
}
export async function showPushSettings(openDialog){
 openDialog(`<div id="push-settings"><div class="dialog-title"><h2>Nhắc lịch dạy trên điện thoại</h2><button type="button" data-action="close">Đóng</button></div><p>Nhắc trước tiết dạy <strong>10 phút</strong>, theo thời khóa biểu đã công bố. Dùng cho cả giáo viên cơ hữu và thỉnh giảng.</p><p>iPhone: thêm app vào Màn hình chính, mở từ biểu tượng đó rồi bật thông báo. Thiết bị cần có mạng; chế độ Tập trung hoặc tiết kiệm pin có thể làm thông báo đến chậm.</p><p id="push-message" role="status">Đang kiểm tra thiết bị…</p><div class="dialog-actions"><button type="button" data-push="enable" disabled>Bật nhắc lịch trên máy này</button><button type="button" data-push="test" disabled>Gửi thông báo thử</button><button type="button" data-push="disable" disabled>Tắt trên máy này</button></div></div>`);
 const root=document.querySelector('#push-settings');if(!root)return;
 const message=root.querySelector('#push-message'),buttons=[...root.querySelectorAll('[data-push]')];
 const status=text=>{message.textContent=text;};let config,registration;
 try{
  if(!('Notification' in window)||!('PushManager' in window)||!('serviceWorker' in navigator))throw Error('Trình duyệt này chưa hỗ trợ. Trên iPhone hãy mở app đã thêm vào Màn hình chính.');
  config=await api('config');if(!config.enabled)throw Error('Nhà trường chưa kích hoạt dịch vụ nhắc lịch. Bạn chưa cần cấp quyền trên điện thoại.');
  registration=await navigator.serviceWorker.register('/sw.js');await registration.update();
  if(!registration.active)await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('Chưa khởi động được thông báo. Hãy tải lại app.')),10000))]);
  async function refresh(){const sub=await registration.pushManager.getSubscription();status(sub?'Thiết bị này đã đăng ký. Có thể bấm “Gửi thông báo thử” để kiểm tra.':Notification.permission==='denied'?'Thông báo đang bị chặn. Hãy cho phép trong cài đặt trình duyệt/điện thoại.':'Chưa bật nhắc lịch trên thiết bị này.');buttons.forEach(b=>{b.disabled=b.dataset.push==='enable'?Boolean(sub)||Notification.permission==='denied':!sub;});}
  root.addEventListener('click',async event=>{const button=event.target.closest('[data-push]');if(!button||button.disabled)return;buttons.forEach(b=>b.disabled=true);try{
   if(button.dataset.push==='enable'){
    // Permission request stays in the direct click handler; never prompt on page load.
    const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('Chưa được cấp quyền thông báo.');
    const sub=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(config.publicKey)});
    try{await api('subscribe',{subscription:sub.toJSON()});}catch(e){await sub.unsubscribe();throw e;}
    await refresh();status('Đã bật nhắc lịch trên máy này. Hãy gửi thông báo thử để kiểm tra.');
   }else if(button.dataset.push==='disable'){await disableDevicePush();await refresh();status('Đã tắt nhắc lịch trên máy này.');}
   else {const sub=await registration.pushManager.getSubscription();const result=await api('test',{endpoint:sub?.endpoint});await refresh();status(result.message);}
  }catch(e){await refresh().catch(()=>{});status(e.message);}});
  await refresh();
 }catch(e){status(e.message);}
}
