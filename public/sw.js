const OFFLINE_CACHE='tkb-offline-v1';
self.addEventListener('install',event=>{event.waitUntil(caches.open(OFFLINE_CACHE).then(cache=>cache.add('/offline.html')));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('tkb-offline-')&&k!==OFFLINE_CACHE).map(k=>caches.delete(k)))));});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||event.request.mode!=='navigate'||url.pathname.startsWith('/api/')||url.pathname.startsWith('/__/auth/'))return;event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')));});

self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()||{};}catch{}
 event.waitUntil(self.registration.showNotification(String(data.title||'TKB Việt Mỹ'),{body:String(data.body||'Bạn có thông báo lịch dạy mới.'),icon:'/icons/tkb-192.png',badge:'/icons/tkb-192.png',tag:String(data.tag||'tkb-notification'),data:{url:'/?open=my_teaching'}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{const target=new URL('/?open=my_teaching',self.location.origin).href;const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});const client=windows.find(w=>new URL(w.url).origin===self.location.origin);if(client){await client.navigate(target);await client.focus();}else await self.clients.openWindow(target);})());
});
