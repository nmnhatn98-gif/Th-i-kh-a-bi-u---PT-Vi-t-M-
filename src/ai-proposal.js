import {deleteCell,putCell,findConflicts,validateState,jointPartner} from './core.js';
export function validateMoves(state,moves){
 if(!Array.isArray(moves)||!moves.length||moves.length>5)throw Error('AI chưa đưa ra đề xuất hợp lệ (tối đa 5 tiết).');
 let next=structuredClone(state);const result=[];
 for(const move of moves){const cell=next.timetableCells.find(c=>c.id===move.cellId);if(!cell||cell.locked||cell.parallelLessons?.length||jointPartner(next,cell.classId,cell.subjectId))throw Error('Không được tự di chuyển ô khóa hoặc tiết song song.');
 const target=next.timeSlots.find(s=>s.id===move.timeSlotId);if(!target||target.id===cell.timeSlotId||next.timetableCells.some(c=>c.classId===cell.classId&&c.timeSlotId===target.id))throw Error('Ô đích phải còn trống.');
 next=deleteCell(next,cell.classId,cell.timeSlotId);next=putCell(next,{...cell,timeSlotId:target.id,day:"Thứ "+target.dayOfWeek,period:target.period});result.push({cellId:cell.id,timeSlotId:target.id,day:"Thứ "+target.dayOfWeek,period:target.period});
 }validateState(next);if(findConflicts(next).length)throw Error('Đề xuất còn trùng lịch giáo viên. Vui lòng chọn phạm vi nhỏ hơn hoặc xử lý các xung đột hiện có.');return result;
}
export function applyMoves(state,moves){validateMoves(state,moves);let next=structuredClone(state);for(const move of moves){const cell=next.timetableCells.find(c=>c.id===move.cellId);next=deleteCell(next,cell.classId,cell.timeSlotId);next=putCell(next,{...cell,timeSlotId:move.timeSlotId,day:"Thứ "+next.timeSlots.find(s=>s.id===move.timeSlotId).dayOfWeek,period:next.timeSlots.find(s=>s.id===move.timeSlotId).period});}return next;}
