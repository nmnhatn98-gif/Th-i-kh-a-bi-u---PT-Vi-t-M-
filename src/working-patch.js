import {contentSignature} from './write-gate.js';
export function compactWorkingWrite(before,next){
 if(!before||!next||Object.keys(before).some(k=>!Object.hasOwn(next,k)))return null;
 const base={},data={};
 for(const key of Object.keys(next)){
  if(['revision','updatedAt','updatedBy'].includes(key))continue;
  if(contentSignature({value:before[key]})===contentSignature({value:next[key]}))continue;
  if(Object.hasOwn(before,key))base[key]=before[key];
  data[key]=next[key];
 }
 return {operation:'patch',data,base,partialBase:true};
}
