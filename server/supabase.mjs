import {fail} from './policy.mjs';
export class SupabaseStore {
 constructor(url,key,{fetchFn=fetch}={}){this.url=url.replace(/\/$/,'');this.key=key;this.fetchFn=fetchFn;}
 async request(path,{method='GET',body}={}){
  const headers={apikey:this.key,'Content-Type':'application/json'};
  if(this.key.startsWith('eyJ'))headers.Authorization=`Bearer ${this.key}`;
  let r;try{r=await this.fetchFn(`${this.url}/rest/v1/${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});}catch{throw fail(503,'Chưa kết nối được Supabase. Hãy giữ bản sao lưu và thử lại sau.','unavailable');}
  const data=await r.json().catch(()=>null);
  if(!r.ok){if((data?.code==='40001'||data?.code==='PT409'))throw fail(409,'Lịch vừa có cập nhật mới.','conflict');if(data?.message?.includes('IMPORT_'))throw fail(409,'Chỉ nhập dữ liệu vào bản thử trống để tránh ghi đè.','conflict');throw fail(503,'Supabase chưa sẵn sàng. Kiểm tra cấu hình và SQL thiết lập trên máy chủ.','unavailable');}
  return data;
 }
 async get(collection,id){return (await this.list(collection,{id}))[0]||{id,data:null,version:0};}
 async list(collection,{id,email}={}){
  const query=new URLSearchParams({collection:`eq.${collection}`,select:'collection,id,data,version',order:'id',limit:'1000'});if(id!==undefined)query.set('id',`eq.${id}`);if(email!==undefined)query.set('data->>teacherEmail',`eq.${email}`);
  const rows=[];let offset=0;while(true){query.set('offset',String(offset));const batch=await this.request(`tkb_documents?${query}`);if(!Array.isArray(batch))throw fail(503,'Dữ liệu Supabase không hợp lệ.');rows.push(...batch);if(batch.length<1000)break;offset+=1000;if(offset>20000)throw fail(413,'Dữ liệu quá lớn để tải trong một lần.');}return rows;
 }
 cas(collection,id,data,expected,actor){return this.request('rpc/tkb_cas_document',{method:'POST',body:{p_collection:collection,p_id:id,p_data:data,p_expected:expected,p_actor:actor}});}
 import(records,actor){return this.request('rpc/tkb_import_documents',{method:'POST',body:{p_records:records,p_actor:actor}});}
}

