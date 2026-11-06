import {teacherPublishedFields,teacherStateFields,teacherPublishedRow} from './teacher-published.mjs';
import {leanWorkingPatch} from './lean-patch.mjs';
import {fail} from './policy.mjs';
export class SupabaseStore {
 constructor(url,key,{fetchFn=fetch,cacheLimit=32}={}){this.url=url.replace(/\/$/,'');this.key=key;this.fetchFn=fetchFn;this.cache=new Map();this.cacheLimit=Math.max(1,cacheLimit);this.pendingReads=new Map();}
 remember(key,row){this.cache.delete(key);this.cache.set(key,structuredClone(row));while(this.cache.size>this.cacheLimit)this.cache.delete(this.cache.keys().next().value);}
 async request(path,options={}){
  if((options.method||'GET')!=='GET'){this.pendingReads.clear();return this.requestOnce(path,options);}
  let pending=this.pendingReads.get(path);
  if(!pending){pending=this.requestOnce(path,options);this.pendingReads.set(path,pending);}
  try{return structuredClone(await pending);}finally{if(this.pendingReads.get(path)===pending)this.pendingReads.delete(path);}
 }
 async requestOnce(path,{method='GET',body}={}){
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
 async getMany(collection,ids){
  const result=[];for(let i=0;i<ids.length;i+=80){const batch=[...new Set(ids.slice(i,i+80))];if(!batch.length)continue;
   const query=new URLSearchParams({collection:`eq.${collection}`,id:'in.('+batch.map(id=>'"'+String(id).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"').join(',')+')',select:'id,data,version',limit:String(batch.length)});
   const rows=await this.request('tkb_documents?'+query);if(!Array.isArray(rows))throw fail(503,'Chưa đọc được điểm danh.');result.push(...rows);
  }return result;
 }
 async get(collection,id){
  const cacheKey=JSON.stringify([collection,id]);
  if(!this.cache.has(cacheKey)){const row=(await this.list(collection,{id}))[0]||{id,data:null,version:0};if(row.data!==null)this.remember(cacheKey,row);return row;}
  const query=new URLSearchParams({collection:`eq.${collection}`,id:`eq.${id}`,select:'id,version',limit:'1'});
  const metadata=await this.request(`tkb_documents?${query}`);
  if(!Array.isArray(metadata))throw fail(503,'Chưa đọc được phiên bản dữ liệu.');
  if(!metadata.length){this.cache.delete(cacheKey);return {id,data:null,version:0};}
  const cached=this.cache.get(cacheKey);if(cached&&cached.version===metadata[0].version){this.cache.delete(cacheKey);this.cache.set(cacheKey,cached);return structuredClone(cached);}
  const row=(await this.list(collection,{id}))[0]||{id,data:null,version:0};
  this.remember(cacheKey,row);return row;
 }
 async listPublicationHistory(){
  const query=new URLSearchParams({collection:'eq.timetables',id:'like.pubweek~*',select:'id,week:data->week,start:data->start,end:data->end,year:data->year,term:data->term,publishedAt:data->publishedAt',order:'id',limit:'1000'}),rows=[];
  for(let offset=0;;offset+=1000){query.set('offset',String(offset));const batch=await this.request('tkb_documents?'+query);if(!Array.isArray(batch))throw fail(503,'Chưa đọc được kho lịch tuần.');rows.push(...batch);if(batch.length<1000)return rows;}
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
  const row=teacherPublishedRow({id:raw.id,version:raw.version,data});this.remember(cacheKey,row);return row;
 }
 async list(collection,{id,email}={}){
  const query=new URLSearchParams({collection:`eq.${collection}`,select:'collection,id,data,version',order:'id',limit:'1000'});if(id!==undefined)query.set('id',`eq.${id}`);if(email!==undefined)query.set('data->>teacherEmail',`eq.${email}`);
  const rows=[];let offset=0;while(true){query.set('offset',String(offset));const batch=await this.request(`tkb_documents?${query}`);if(!Array.isArray(batch))throw fail(503,'Dữ liệu Supabase không hợp lệ.');rows.push(...batch);if(batch.length<1000)break;offset+=1000;if(offset>20000)throw fail(413,'Dữ liệu quá lớn để tải trong một lần.');}return rows;
 }
 async listAttendance(year,start,end){
  const query=new URLSearchParams({collection:'eq.timetables','data->>kind':'eq.student-attendance','data->>year':'eq.'+year,and:`(data->>date.gte.${start},data->>date.lte.${end})`,select:'id,kind:data->kind,year:data->year,classId:data->classId,className:data->className,date:data->date,entries:data->entries,lateOptions:data->lateOptions',order:'id',limit:'100'}),rows=[];
  for(let offset=0;offset<=10000;offset+=100){query.set('offset',String(offset));const batch=await this.request('tkb_documents?'+query);if(!Array.isArray(batch))throw fail(503,'Chưa đọc được thống kê điểm danh.');rows.push(...batch.map(({id,...data})=>({id,data})));if(batch.length<100)return rows;}throw fail(413,'Khoảng thống kê quá lớn. Vui lòng chọn khoảng ngắn hơn.');
 }
 async listLessonReports(week){
  const query=new URLSearchParams({collection:'eq.timetables',select:'id,data,version',or:`(id.like.bb~${week}~*,id.like.bs~${week}~*)`,order:'id',limit:'1000'}),rows=[];
  for(let offset=0;offset<=20000;offset+=1000){query.set('offset',String(offset));const batch=await this.request('tkb_documents?'+query);if(!Array.isArray(batch))throw fail(503,'Chưa đọc được báo bài.');rows.push(...batch);if(batch.length<1000)return rows;}throw fail(413,'Có quá nhiều báo bài trong tuần.');
 }
 async cas(collection,id,data,expected,actor,before){
  const patch=collection==='timetables'&&id==='working'&&expected>0?leanWorkingPatch(before,data):null;
  if(patch){try{const ack=await this.request('rpc/tkb_patch_working',{method:'POST',body:{...patch,p_expected:expected,p_actor:actor}});if(ack?.version!==expected+1)throw fail(503,'Chưa xác nhận được phiên bản vừa lưu.');const row={id,data,version:ack.version};this.remember(JSON.stringify([collection,id]),row);return row;}catch(e){if(e.code!=='rpc-not-found')throw e;}}
  return this.request('rpc/tkb_cas_document',{method:'POST',body:{p_collection:collection,p_id:id,p_data:data,p_expected:expected,p_actor:actor}});
 }
 import(records,actor){return this.request('rpc/tkb_import_documents',{method:'POST',body:{p_records:records,p_actor:actor}});}
}

