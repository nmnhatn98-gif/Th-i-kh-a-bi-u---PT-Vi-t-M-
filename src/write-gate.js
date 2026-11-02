const ignored=new Set(['updatedAt','updatedBy','revision','confirmedAt','confirmedBy']);
function sorted(value){
  if(Array.isArray(value))return value.map(sorted);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,sorted(value[k])]));
  return value;
}
export function contentSignature(value){
  if(value===null)return 'null';
  return JSON.stringify(sorted(Object.fromEntries(Object.entries(value).filter(([key])=>!ignored.has(key)))));
}
// Compare JSON documents without allocating two sorted copies of the full undo history.
export function sameContent(a,b){
 function equal(x,y,root=false){
  if(x===y)return true;
  if(x===null||y===null||typeof x!=='object'||typeof y!=='object')return x===y;
  if(Array.isArray(x)!==Array.isArray(y))return false;
  if(Array.isArray(x)){if(x.length!==y.length)return false;for(let i=0;i<x.length;i++)if(!equal(x[i],y[i]))return false;return true;}
  const keys=Object.keys(x).filter(k=>(!root||!ignored.has(k))&&x[k]!==undefined),other=Object.keys(y).filter(k=>(!root||!ignored.has(k))&&y[k]!==undefined);
  if(keys.length!==other.length)return false;
  for(const k of keys)if(!Object.hasOwn(y,k)||!equal(x[k],y[k]))return false;
  return true;
 }
 return equal(a,b,true);
}
export function mergeFields(base,patch){
  const next=structuredClone(base||{});
  for(const [key,value] of Object.entries(patch)){
    const parts=key.split('.');let target=next;
    for(const part of parts.slice(0,-1))target=target[part]??={};
    target[parts.at(-1)]=value;
  }
  return next;
}
export class WriteGate{
  constructor(){this.cache=new Map();this.busy=false;this.blocked=false;this.generation=0;this.stamps=new Map();}
  clear(){this.cache.clear();this.stamps.clear();this.generation++;}
  observe(path,value){this.cache.set(path,value===null?null:structuredClone(value));this.stamps.set(path,(this.stamps.get(path)||0)+1);}
  async run(path,next,write){
    if(this.blocked)throw Object.assign(Error('Đã hết hạn mức ghi Firestore. Đã dừng gửi thêm; hãy sao lưu và thử lại sau khi hạn mức được khôi phục.'),{code:'resource-exhausted'});
    if(this.busy)throw Object.assign(Error('Đang lưu một thay đổi. Vui lòng đợi rồi thử lại.'),{code:'write-in-progress'});
    if(this.cache.has(path)&&sameContent(this.cache.get(path),next))return {skipped:true};
    this.busy=true;const generation=this.generation,stamp=this.stamps.get(path)||0;
    try{const result=await write();if(generation===this.generation&&stamp===(this.stamps.get(path)||0))this.observe(path,next);return {skipped:false,result};}
    catch(error){if(error.code==='resource-exhausted'||error.code==='firestore/resource-exhausted')this.blocked=true;throw error;}
    finally{this.busy=false;}
  }
}
