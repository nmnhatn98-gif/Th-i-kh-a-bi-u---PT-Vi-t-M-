import {auth,googleProvider,signInWithPopup,onAuthStateChanged} from './firebase.js';
import {getFirestore,collection,getDocs} from 'firebase/firestore';
import config from '../firebase-applet-config.json';
const status=document.querySelector('#status'),login=document.querySelector('#login'),exportButton=document.querySelector('#export');
const owner='nmnhat.n98@gmail.com';let busy=false;
onAuthStateChanged(auth,user=>{exportButton.disabled=!user||user.email?.toLowerCase()!==owner;status.textContent=user?'Đang đăng nhập: '+user.email+(exportButton.disabled?' — không phải quản trị chính.':' — có thể bấm xuất dữ liệu.'):'Chưa đăng nhập. Chưa đọc dữ liệu Firestore.';});
login.onclick=async()=>{try{await signInWithPopup(auth,googleProvider);}catch(e){status.textContent=e.message;}};
exportButton.onclick=async()=>{
 if(busy||auth.currentUser?.email?.toLowerCase()!==owner)return;
 busy=true;exportButton.disabled=true;
 try{
  const database=getFirestore(auth.app,config.firestoreDatabaseId),backup={format:'tkb-hybrid-migration-v1',createdAt:new Date().toISOString(),collections:{}};
  for(const name of ['users','timetables','requests','availabilities']){status.textContent='Đang đọc '+name+'...';const snapshot=await getDocs(collection(database,name));backup.collections[name]=snapshot.docs.map(d=>({id:d.id,data:d.data()}));}
  const content=JSON.stringify(backup,null,2),url=URL.createObjectURL(new Blob([content],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='tkb-chuyen-doi-toan-bo-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  status.textContent='Đã xuất thành công. '+Object.entries(backup.collections).map(([name,list])=>name+': '+list.length).join('; ')+'. Không có thao tác ghi Firestore.';
 }catch(e){status.textContent='Chưa xuất được toàn bộ dữ liệu: '+e.message+'. Không tạo tệp thiếu dữ liệu.';}finally{busy=false;exportButton.disabled=false;}
};
