// Large export libraries are loaded only after an export/import action.
export function createExportLibraries({xlsx=()=>import('xlsx'),canvas=()=>import('html2canvas')}={}){
 let excelPromise,canvasPromise;
 const loadXlsx=()=>excelPromise||(excelPromise=Promise.resolve().then(xlsx).catch(error=>{excelPromise=null;throw error;}));
 const loadCanvas=()=>canvasPromise||(canvasPromise=Promise.resolve().then(canvas).catch(error=>{canvasPromise=null;throw error;}));
 return {loadXlsx,async html2canvas(...args){return (await loadCanvas()).default(...args);}};
}
export const {loadXlsx,html2canvas}=createExportLibraries();

export function sheetCanvasSize(p){return {width:p.offsetWidth,height:p.offsetHeight,onclone(doc){const copy=doc.getElementById(p.id);if(copy){copy.style.setProperty('zoom','1','important');copy.style.setProperty('--poster-preview-scale','1');}}};}
