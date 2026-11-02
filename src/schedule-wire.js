// Lossless transport dictionary: each repeated timetable cell travels once.
const FORMAT='tkb-cell-dictionary-v1';
const CELL_LISTS=new Set(['timetableCells','draftSchedule','previousScheduleSnapshot']);
export function packSchedulePayload(payload){
 const table=[],ids=new Map();let refs=0;
 function walk(value,key='',depth=0){
  if(depth>120)throw Error('Dữ liệu có quá nhiều cấp lồng nhau.');
  if(Array.isArray(value)&&CELL_LISTS.has(key)){
   const indexes=value.map(cell=>{const signature=JSON.stringify(cell);if(!ids.has(signature)){ids.set(signature,table.length);table.push(cell);}refs++;return ids.get(signature);});
   return {cellIndexes:indexes};
  }
  if(Array.isArray(value))return value.map(v=>walk(v,'',depth+1));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,walk(v,k,depth+1)]));
  return value;
 }
 const data=walk(payload);
 return refs?{scheduleWire:FORMAT,cellTable:table,payload:data}:payload;
}
export function unpackSchedulePayload(value){
 if(value?.scheduleWire!==FORMAT)return value;
 if(!Array.isArray(value.cellTable)||value.cellTable.length>100000||!Object.hasOwn(value,'payload'))throw Error('Gói lịch không hợp lệ.');
 let refs=0,bytes=0;const sizes=value.cellTable.map(cell=>new TextEncoder().encode(JSON.stringify(cell)).length);
 function walk(node,key='',depth=0){
  if(depth>120)throw Error('Gói lịch có quá nhiều cấp lồng nhau.');
  if(CELL_LISTS.has(key)&&node&&typeof node==='object'&&!Array.isArray(node)&&Object.keys(node).length===1&&Array.isArray(node.cellIndexes))return node.cellIndexes.map(index=>{
   if(!Number.isSafeInteger(index)||index<0||index>=value.cellTable.length)throw Error('Tham chiếu ô lịch không hợp lệ.');
   refs++;bytes+=sizes[index];if(refs>200000||bytes>64*1024*1024)throw Error('Gói lịch sau khôi phục quá lớn.');
   return structuredClone(value.cellTable[index]);
  });
  if(Array.isArray(node))return node.map(v=>walk(v,'',depth+1));
  if(node&&typeof node==='object')return Object.fromEntries(Object.entries(node).map(([k,v])=>[k,walk(v,k,depth+1)]));
  return node;
 }
 return walk(value.payload);
}
