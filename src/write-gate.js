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
    if(this.cache.has(path)&&contentSignature(this.cache.get(path))===contentSignature(next))return {skipped:true};
    this.busy=true;const generation=this.generation,stamp=this.stamps.get(path)||0;
    try{const result=await write();if(generation===this.generation&&stamp===(this.stamps.get(path)||0))this.observe(path,next);return {skipped:false,result};}
    catch(error){if(error.code==='resource-exhausted'||error.code==='firestore/resource-exhausted')this.blocked=true;throw error;}
    finally{this.busy=false;}
  }
}
