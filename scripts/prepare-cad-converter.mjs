// SPDX-License-Identifier: MIT
// Prepare an independently usable GPL CAD converter; never add it to the application module graph.
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),tool=path.join(root,'tools/cad-converter'),dest=path.join(root,'public/cad-converter');
// Keep unchanged assets stable for an already running development server.
async function copy(source,target){
  const bytes=await fs.readFile(source);
  try{if((await fs.readFile(target)).equals(bytes))return;}catch(error){if(error.code!=='ENOENT')throw error;}
  const temporary=target+'.'+process.pid+'.tmp';
  try{await fs.writeFile(temporary,bytes);await fs.rename(temporary,target);}finally{await fs.rm(temporary,{force:true});}
}
const pkg=path.join(tool,'node_modules/@mlightcad/libredwg-web');
if(!existsSync(pkg))execFileSync(process.platform==='win32'?'npm.cmd':'npm',['ci','--ignore-scripts'],{cwd:tool,stdio:'inherit',shell:process.platform==='win32'});
const installed=JSON.parse(await fs.readFile(path.join(pkg,'package.json'),'utf8'));
if(installed.version!=='0.8.7'||installed.license!=='GPL-3.0')throw new Error('Unexpected CAD converter version or license');
const cache=path.join(tool,'.cache'),archive=path.join(cache,'libredwg-source.tar.gz');
await fs.mkdir(cache,{recursive:true});
if(!existsSync(archive)){
  const response=await fetch('https://codeload.github.com/mlightcad/libredwg-web/tar.gz/82bf45777635942e5eb9b68c15a2ee75bbaf64ab');
  if(!response.ok)throw new Error('Unable to obtain corresponding CAD converter source: '+response.status);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(createHash('sha256').update(bytes).digest('hex')!=='5587e5d92629cba0de37d99448517110c2f292fa59d0ab9ddf3cb26dc736cf0a')throw new Error('CAD source integrity check failed');
  await fs.writeFile(archive,bytes);
}
if(createHash('sha256').update(await fs.readFile(archive)).digest('hex')!=='5587e5d92629cba0de37d99448517110c2f292fa59d0ab9ddf3cb26dc736cf0a')throw new Error('CAD source integrity check failed');
await fs.mkdir(path.join(dest,'vendor/dist'),{recursive:true});await fs.mkdir(path.join(dest,'vendor/wasm'),{recursive:true});await fs.mkdir(path.join(dest,'source'),{recursive:true});
for(const name of ['index.html','converter.js','worker.js','COPYING'])await copy(path.join(tool,name),path.join(dest,name));
for(const name of ['index.html','converter.js','worker.js','COPYING','README.md','package.json','package-lock.json'])await copy(path.join(tool,name),path.join(dest,'source',name));
await copy(fileURLToPath(import.meta.url),path.join(dest,'source','prepare-cad-converter.mjs'));
await copy(archive,path.join(dest,'source','libredwg-source.tar.gz'));
await copy(path.join(root,'LICENSE'),path.join(dest,'source','Schematico-MIT-LICENSE.txt'));
await copy(path.join(pkg,'dist/libredwg-web.js'),path.join(dest,'vendor/dist/libredwg-web.js'));
await copy(path.join(pkg,'wasm/libredwg-web.wasm'),path.join(dest,'vendor/wasm/libredwg-web.wasm'));
await copy(path.join(pkg,'wasm/libredwg-web.js'),path.join(dest,'vendor/wasm/libredwg-web.js'));
console.log('Standalone CAD converter and complete corresponding source prepared.');
