import {test} from 'node:test';import assert from 'node:assert/strict';import {saveDriveFile} from '../src/drive-backup.js';
test('Drive backup uploads private file with short-lived token and correct multipart content',async()=>{
 let sent;const file=await saveDriveFile({token:'temporary-token',name:'backup.json',content:'{"school":"test"}',fetchFn:async(url,options)=>{sent={url,...options};return {ok:true,json:async()=>({id:'file-1',name:'backup.json',webViewLink:'https://drive.google.com/file/d/file-1/view'})};}});
 assert.equal(file.id,'file-1');assert.equal(sent.headers.Authorization,'Bearer temporary-token');const body=await sent.body.text();assert.ok(body.includes('backup.json'));assert.ok(body.includes('{"school":"test"}'));assert.ok(!body.includes('temporary-token'));assert.ok(!body.includes('permissions'));assert.match(sent.body.type,/multipart\/related/);
});
test('Drive upload failure never reports success',async()=>{
 await assert.rejects(saveDriveFile({token:'expired',name:'x',content:'x',fetchFn:async()=>({ok:false,status:401,json:async()=>({})})}),/hết hạn/);
});
