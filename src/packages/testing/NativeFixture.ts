import fs from 'node:fs';
import JSZip from 'jszip';

/** Private regression data is supplied by the developer, never bundled. */
export function nativeFixtureFiles():string[] {
  const selected=process.env.SCHEMATICO_NATIVE_FIXTURE;if(!selected)return [];
  if(!fs.existsSync(selected))throw new Error('SCHEMATICO_NATIVE_FIXTURE verweist auf keine lesbare Datei.');
  if(!/\.001$/.test(selected))return [selected];
  const files:string[]=[];
  for(let i=1;;i++){const part=selected.replace(/\.001$/,'.'+String(i).padStart(3,'0'));if(!fs.existsSync(part))break;files.push(part);}
  return files;
}
export async function openNativeFixture():Promise<{zip:JSZip;root:string}|undefined> {
  const files=nativeFixtureFiles();
  if(!files.length){console.log('↷ Optionaler Archivtest übersprungen: SCHEMATICO_NATIVE_FIXTURE ist nicht gesetzt.');return;}
  const zip=await JSZip.loadAsync(Buffer.concat(files.map(file=>fs.readFileSync(file))));
  const roots=Object.keys(zip.files).filter(name=>/\.edb\/Page\.eod$/i.test(name)).map(name=>name.slice(0,-'Page.eod'.length));
  if(roots.length!==1)throw new Error('Die private Testdatei muss genau eine native Projektdatenbank enthalten.');
  return {zip,root:roots[0]};
}
