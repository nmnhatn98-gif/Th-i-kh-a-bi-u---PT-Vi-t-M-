export const teacherPublishedFields=['name','publishedAt','lastPublishedAt','revision'];
export const teacherStateFields=['school','classes','subjects','teachers','timeSlots','timetableCells'];
export function teacherPublishedRow(row){
 if(!row.data?.isPublished||!row.data?.data)return {id:row.id,version:row.version,data:null};
 const data={isPublished:true};for(const key of teacherPublishedFields)if(row.data[key]!==undefined)data[key]=structuredClone(row.data[key]);
 data.data={};for(const key of teacherStateFields)if(row.data.data[key]!==undefined)data.data[key]=structuredClone(row.data.data[key]);
 if(Array.isArray(data.data.teachers))data.data.teachers=data.data.teachers.map(({assignments,...teacher})=>teacher);
 return {id:row.id,version:row.version,data};
}
