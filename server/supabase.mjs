import {teacherPublishedFields,teacherStateFields,teacherPublishedRow} from './teacher-published.mjs';
import {leanWorkingPatch} from './lean-patch.mjs';
import {fail} from './policy.mjs';
export class SupabaseStore {
 constructor(url,key,{fetchFn=fetch}={}){this.url=url.replace(/\/$/,'');this.key=key;this.fetchFn=fetchFn;this.cache=new Map();}
 async request(path,{method='GET',body}={}){
  const headers={apikey:this.key,'Content-Type':'application/json'};
  if(this.key.startsWith('eyJ'))headers.Authorization=`Bearer ${this.key}`;
  let r,data;
  for(let attempt=0;attempt<(method==='GET'?2:1);attempt++){
   try{r=await this.fetchFn(`${this.url}/rest/v1/${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(method==='GET'?15000:30000)});data=await r.json();}
   catch{if(method==='GET'&&attempt===0)continue;throw fail(503,'Kết nối Supabase bị gián đoạn. Thao tác chưa được xác nhận; vui lòng chọn hoặc lưu lại sau.','unavailable');}
   if(r.ok)break;
   if(method==='GET'&&attempt===0&&[502,503,504].includes(r.status))continue;
   if(data?.code==='PGRST202')throw fail(503,'Chưa có hàm lưu rút gọn.','rpc-not-found');
   if(data?.code==='40001'||data?.code==='PT409')throw fail(409,'Lịch vừa có cập nhật mới.','conflict');
   if(data?.message?.includes('IMPORT_'))throw fail(409,'Chỉ nhập dữ liệu vào bản thử trống để tránh ghi đè.','conflict');
   throw fail(503,'Supabase chưa sẵn sàng. Vui lòng thử lưu lại sau.','unavailable');
  }
  return data;
 }
 async get(collection,id){
  const cacheKey=JSON.stringify([collection,id]);
  if(!this.cache.has(cacheKey)){const row=(await this.list(collection,{id}))[0]||{id,data:null,version:0};if(row.data!==null)this.cache.set(cacheKey,structuredClone(row));return row;}
  const query=new URLSearchParams({collection:`eq.${collection}`,id:`eq.${id}`,select:'id,version',limit:'1'});
  const metadata=await this.request(`tkb_documents?${query}`);
  if(!Array.isArray(metadata))throw fail(503,'Chưa đọc được phiên bản dữ liệu.');
  if(!metadata.length){this.cache.delete(cacheKey);return {id,data:null,version:0};}
  const cached=this.cache.get(cacheKey);if(cached&&cached.version===metadata[0].version)return structuredClone(cached);
  const row=(await this.list(collection,{id}))[0]||{id,data:null,version:0};
  this.cache.set(cacheKey,structuredClone(row));return row;
 }
 async getTeacherPublished(){
  const query=new URLSearchParams({collection:'eq.timetables',id:'eq.published',select:'id,version',limit:'1'}),cacheKey='teacher-published';
  const metadata=await this.request('tkb_documents?'+query);if(!Array.isArray(metadata))throw fail(503,'Chưa đọc được lịch hiện hành.');
  if(!metadata.length){this.cache.delete(cacheKey);return {id:'published',data:null,version:0};}
  const cached=this.cache.get(cacheKey);if(cached?.version===metadata[0].version)return structuredClone(cached);
  query.set('select',['id','version','isPublished:data->isPublished',...teacherPublishedFields.map(k=>k+':data->'+k),...teacherStateFields.map(k=>'current_'+k+':data->data->'+k)].join(','));
  const records=await this.request('tkb_documents?'+query);if(!Array.isArray(records))throw fail(503,'Chưa đọc được lịch hiện hành.');
  const raw=records[0];if(!raw)return {id:'published',data:null,version:0};
  const data={isPublished:raw.isPublished,data:{}};for(const k of teacherPublishedFields)if(raw[k]!==null&&raw[k]!==undefined)data[k]=raw[k];for(const k of teacherStateFields)if(raw['current_'+k]!==null&&raw['current_'+k]!==undefined)data.data[k]=raw['current_'+k];
  const row=teacherPublishedRow({id:raw.id,version:raw.version,data});this.cache.set(cacheKey,structuredClone(row));return row;
 }
 async list(collection,{id,email}={}){
  const query=new URLSearchParams({collection:`eq.${collection}`,select:'collection,id,data,version',order:'id',limit:'1000'});if(id!==undefined)query.set('id',`eq.${id}`);if(email!==undefined)query.set('data->>teacherEmail',`eq.${email}`);
  const rows=[];let offset=0;while(true){query.set('offset',String(offset));const batch=await this.request(`tkb_documents?${query}`);if(!Array.isArray(batch))throw fail(503,'Dữ liệu Supabase không hợp lệ.');rows.push(...batch);if(batch.length<1000)break;offset+=1000;if(offset>20000)throw fail(413,'Dữ liệu quá lớn để tải trong một lần.');}return rows;
 }
 async listLessonReports(week){
  const query=new URLSearchParams({collection:'eq.timetables',select:'id,data,version',or:`(id.like.bb~${week}~*,id.like.bs~${week}~*)`,order:'id',limit:'1000'}),rows=[];
  for(let offset=0;offset<=20000;offset+=1000){query.set('offset',String(offset));const batch=await this.request('tkb_documents?'+query);if(!Array.isArray(batch))throw fail(503,'Chưa đọc được báo bài.');rows.push(...batch);if(batch.length<1000)return rows;}throw fail(413,'Có quá nhiều báo bài trong tuần.');
 }
 async cas(collection,id,data,expected,actor,before){
  const patch=collection==='timetables'&&id==='working'&&expected>0?leanWorkingPatch(before,data):null;
  if(patch){try{const ack=await this.request('rpc/tkb_patch_working',{method:'POST',body:{...patch,p_expected:expected,p_actor:actor}});if(ack?.version!==expected+1)throw fail(503,'Chưa xác nhận được phiên bản vừa lưu.');const row={id,data,version:ack.version};this.cache.set(JSON.stringify([collection,id]),structuredClone(row));return row;}catch(e){if(e.code!=='rpc-not-found')throw e;}}
  return this.request('rpc/tkb_cas_document',{method:'POST',body:{p_collection:collection,p_id:id,p_data:data,p_expected:expected,p_actor:actor}});
 }
 import(records,actor){return this.request('rpc/tkb_import_documents',{method:'POST',body:{p_records:records,p_actor:actor}});}
}

