import fs from 'node:fs';
import path from 'node:path';
import { legacyVendorToken, legacyEditionToken } from '../src/model/LegacyCompatibility';
const pattern=new RegExp(`${legacyVendorToken}|\\b${legacyEditionToken}\\b`,'i');
const failures:string[]=[];
const visit=(name:string)=>{
  if(pattern.test(path.basename(name)))failures.push('Dateiname: '+name);
  if(fs.statSync(name).isDirectory()){for(const entry of fs.readdirSync(name))visit(path.join(name,entry));return;}
  if(!/\.(?:ts|cjs|json|html|md|css|ems|ema|ya?ml)$/.test(name))return;
  const lines=fs.readFileSync(name,'utf8').split('\n');
  for(let i=0;i<lines.length;i++)if(pattern.test(lines[i]))failures.push(`${name}:${i+1}`);
};
for(const entry of ['src','electron','scripts','docs','public','.github','README.md','index.html','package.json'])visit(entry);
if(failures.length)throw new Error('Nicht neutrale Produktverweise gefunden: '+failures.join(', '));
for(const entry of fs.readdirSync('.'))if(/\.zip(?:\.\d+)?$/i.test(entry))throw new Error('Private Archive dürfen nicht im Projektstamm liegen.');
console.log('✓ Schematico: neutrale Quelldateien, Dokumentation und Dateinamen; keine privaten Stammarchive');
