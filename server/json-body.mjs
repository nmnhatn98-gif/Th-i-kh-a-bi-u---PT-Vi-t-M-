import {unpackSchedulePayload} from '../src/schedule-wire.js';
import {gunzipSync} from 'node:zlib';
const LIMIT=10*1024*1024;
export async function readJsonBody(req){
 const encoding=String(req.headers['content-encoding']||'identity').toLowerCase();
 if(!['identity','gzip'].includes(encoding))throw Object.assign(Error('Định dạng nén chưa được hỗ trợ.'),{status:415});
 const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>LIMIT)throw Object.assign(Error('Tệp quá lớn, giới hạn 10 MB.'),{status:413});chunks.push(chunk);}
 let buffer=Buffer.concat(chunks);if(encoding==='gzip'){try{buffer=gunzipSync(buffer,{maxOutputLength:LIMIT});}catch(error){throw Object.assign(Error(error.code==='ERR_BUFFER_TOO_LARGE'?'Tệp sau giải nén vượt quá 10 MB.':'Gói dữ liệu nén không hợp lệ.'),{status:error.code==='ERR_BUFFER_TOO_LARGE'?413:400});}}
 let parsed;try{parsed=JSON.parse(buffer.toString('utf8'));}catch{throw Object.assign(Error('Nội dung JSON không hợp lệ.'),{status:400});}
 try{return unpackSchedulePayload(parsed);}catch(error){throw Object.assign(Error(error.message),{status:400});}
}
