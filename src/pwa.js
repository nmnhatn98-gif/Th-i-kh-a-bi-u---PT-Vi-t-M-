let installPrompt=null;
if(typeof window!=='undefined'){
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
 window.addEventListener('appinstalled',()=>{installPrompt=null;});
 window.addEventListener('load',()=>{if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('/sw.js').catch(()=>{});});
}
export async function installPhoneApp(){if(installPrompt){const event=installPrompt;installPrompt=null;await event.prompt();await event.userChoice;return true;}return false;}
