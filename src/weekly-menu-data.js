export const MEAL_FIELDS=['breakfast','soup','main','vegetable','dessert','snack'];
export function menuFriday(start){const d=new Date(start+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!Number.isFinite(+d)||d.toISOString().slice(0,10)!==start||d.getUTCDay()!==1)throw Error('Vui lòng chọn ngày Thứ hai đầu tuần.');d.setUTCDate(d.getUTCDate()+4);return d.toISOString().slice(0,10);}
export function validateMenu(data){
 if(!data||typeof data!=='object'||Array.isArray(data)||data.endDate!==menuFriday(data.startDate))throw Error('Ngày áp dụng thực đơn không hợp lệ.');
 if(data.title!=='THỰC ĐƠN BÁN TRÚ'||!Array.isArray(data.rows)||data.rows.length!==5)throw Error('Thực đơn cần đủ 5 ngày từ Thứ hai đến Thứ sáu.');
 for(let i=0;i<5;i++){const r=data.rows[i];if(!r||r.day!==i+2||!MEAL_FIELDS.every(k=>typeof r[k]==='string'&&r[k].trim().length>0&&r[k].length<=2000)||Object.keys(r).some(k=>!['day',...MEAL_FIELDS].includes(k)))throw Error('Mỗi ngày cần đủ 6 mục thực đơn, tối đa 2.000 ký tự mỗi mục.');}
 if(Object.keys(data).some(k=>!['title','startDate','endDate','rows','updatedAt','updatedBy'].includes(k)))throw Error('Thông tin thực đơn không hợp lệ.');
 return data;
}
