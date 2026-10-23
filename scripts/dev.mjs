import {spawn} from 'node:child_process';import {createServer} from 'vite';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const api=spawn(process.execPath,[path.join(root,'server.mjs'),'--api-only'],{cwd:root,env:{...process.env,PORT:'3001'},stdio:'inherit',windowsHide:true});
let vite;
async function stop(){await vite?.close();api.kill();process.exit();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
api.on('exit',code=>{if(code)process.exit(code);});
vite=await createServer({root,server:{host:'0.0.0.0',port:3000}});await vite.listen();vite.printUrls();
