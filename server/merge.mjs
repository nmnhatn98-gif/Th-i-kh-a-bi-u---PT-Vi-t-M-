import {isDeepStrictEqual as equal} from 'node:util';
const missing=Symbol('missing');
function key(item){
 if(!item||typeof item!=='object')return null;
 if(item.classId&&item.timeSlotId)return `cell:${item.classId}:${item.timeSlotId}`;
 if(item.classId&&item.subjectId)return `assignment:${item.classId}:${item.subjectId}`;
 return item.id?`id:${item.id}`:null;
}
function object(value){return value!==missing&&value!==null&&typeof value==='object'&&!Array.isArray(value);}
export function mergeChanges(base,local,remote,path=''){
 if(equal(local,base))return remote;
 if(equal(remote,base)||equal(local,remote))return local;
 if(object(base)&&object(local)&&object(remote)){
   const result={};for(const k of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)])){
     if(!path&&['revision','updatedAt','updatedBy'].includes(k))continue;
     const val=mergeChanges(Object.hasOwn(base,k)?base[k]:missing,Object.hasOwn(local,k)?local[k]:missing,Object.hasOwn(remote,k)?remote[k]:missing,`${path}/${k}`);
     if(val!==missing)result[k]=val;
   }return result;
 }
 if([base,local,remote].every(Array.isArray)){
   const maps=[base,local,remote].map(list=>new Map(list.map(item=>[key(item),item])));
   if([base,local,remote].every((list,i)=>list.every(item=>key(item)!==null)&&maps[i].size===list.length)){
     const result=[];for(const k of new Set([...maps[2].keys(),...maps[1].keys(),...maps[0].keys()])){
       if(k.startsWith('cell:')&&!equal(maps[1].get(k),maps[0].get(k))&&!equal(maps[2].get(k),maps[0].get(k))&&!equal(maps[1].get(k),maps[2].get(k)))throw Object.assign(Error('Có người vừa sửa cùng ô lịch. Hãy tải lại để đối chiếu.'),{status:409,code:'conflict',path:path+'/'+k});
       const value=mergeChanges(...maps.map(map=>map.has(k)?map.get(k):missing),`${path}/${k}`);if(value!==missing)result.push(value);
     }return result;
   }
 }
 throw Object.assign(Error('Có người vừa sửa cùng dữ liệu. Hãy tải lại để đối chiếu trước khi lưu.'),{status:409,code:'conflict',path});
}
