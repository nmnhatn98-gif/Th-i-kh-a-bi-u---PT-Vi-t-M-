import {isDeepStrictEqual as equal} from 'node:util';
export function leanWorkingPatch(before,next){
 if(!before||!next||Object.keys(before).some(k=>!Object.hasOwn(next,k)))return null;
 const patch={};let historyChanges=null,historyOrder=null;
 for(const key of Object.keys(next)){
  if(equal(before[key],next[key]))continue;
  if(key==='changeHistory'&&Array.isArray(before[key])&&Array.isArray(next[key])){
   const valid=list=>list.every(x=>x&&typeof x.id==='string')&&new Set(list.map(x=>x.id)).size===list.length;
   if(valid(before[key])&&valid(next[key])){const old=new Map(before[key].map(x=>[x.id,x]));historyChanges=Object.fromEntries(next[key].filter(x=>!equal(old.get(x.id),x)).map(x=>[x.id,x]));historyOrder=next[key].map(x=>x.id);continue;}
  }
  patch[key]=next[key];
 }
 return {p_patch:patch,p_history_changes:historyChanges,p_history_order:historyOrder};
}
