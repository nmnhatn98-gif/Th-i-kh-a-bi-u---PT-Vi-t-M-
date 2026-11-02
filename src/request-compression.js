import {packSchedulePayload} from './schedule-wire.js';
export async function compressJsonBody(body,{Compression=globalThis.CompressionStream,threshold=65536}={}){
 if(typeof body!=='string'||body.length<threshold)return {body,headers:{}};
 try{const packed=JSON.stringify(packSchedulePayload(JSON.parse(body)));if(packed.length<body.length)body=packed;}catch{}
 if(typeof Compression!=='function')return {body,headers:{}};
 try{const blob=new Blob([body]);const compressed=await new Response(blob.stream().pipeThrough(new Compression('gzip'))).arrayBuffer();if(compressed.byteLength>=blob.size)return {body,headers:{}};return {body:new Uint8Array(compressed),headers:{'Content-Encoding':'gzip'}};}catch{return {body,headers:{}};}
}
