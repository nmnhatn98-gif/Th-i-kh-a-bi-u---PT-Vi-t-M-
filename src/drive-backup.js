export async function saveDriveFile({token,name,content,mimeType='application/json',fetchFn=fetch}){
 const boundary='tkb_'+crypto.randomUUID().replaceAll('-','');
 const metadata={name,mimeType,appProperties:{application:'tkb-school-backup',format:'v1'}};
 const blob=new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,content,`\r\n--${boundary}--`],{type:`multipart/related; boundary=${boundary}`});
 const response=await fetchFn('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:blob,signal:AbortSignal.timeout(60000)});
 const file=await response.json().catch(()=>null);if(!response.ok||!file?.id)throw Error(response.status===401?'Quyền Drive đã hết hạn, hãy bấm sao lưu lại.':'Chưa lưu được Drive. Kiểm tra đã bật Google Drive API và quyền drive.file; bản JSON tải về máy vẫn dùng được.');
 return {id:file.id,name:file.name,url:file.webViewLink||null};
}
