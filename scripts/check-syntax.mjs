import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const files=['server.mjs',...['src','server','scripts'].flatMap(dir=>readdirSync(path.join(root,dir),{recursive:true}).filter(file=>/\.(m?js)$/.test(file)).map(file=>path.join(dir,file)))];
for(const file of files){const result=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8'});if(result.status!==0){process.stderr.write(result.stderr||result.error?.message||'Syntax check failed');process.exit(1);}}
console.log(`Syntax checked ${files.length} application files.`);
