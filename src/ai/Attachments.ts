import type { Part } from '@google/genai';
export interface AiAttachment { id: string; name: string; mimeType: string; size: number; data: string }
export const ATTACHMENT_ACCEPT = '.png,.jpg,.jpeg,.webp,.pdf';
const mime: Record<string,string> = {png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',pdf:'application/pdf'};
export function validateAttachments(files: Pick<AiAttachment,'name'|'mimeType'|'size'>[]): void {
  if(files.length>4)throw new Error('Höchstens 4 Anhänge pro Nachricht.');
  if(files.some(f=>!Object.values(mime).includes(f.mimeType)))throw new Error('Unterstützt werden PNG, JPEG, WebP und PDF.');
  if(files.some(f=>!f.size||f.size>10*1024*1024))throw new Error('Jede Datei muss zwischen 1 Byte und 10 MB groß sein.');
  if(files.reduce((sum,f)=>sum+f.size,0)>14*1024*1024)throw new Error('Anhänge dürfen zusammen höchstens 14 MB groß sein.');
}
export async function readAttachments(files: File[], existing: AiAttachment[] = []): Promise<AiAttachment[]> {
  const info=files.map(f=>({name:f.name,mimeType: mime[f.name.split('.').at(-1)!.toLowerCase()] ?? f.type,size:f.size}));
  validateAttachments([...existing,...info]);
  return Promise.all(files.map(async(file,i)=>{
    const bytes=new Uint8Array(await file.arrayBuffer()), type=info[i].mimeType;
    const head=String.fromCharCode(...bytes.slice(0,12));
    const valid=type==='application/pdf'?head.startsWith('%PDF-'):type==='image/png'?head.startsWith('\x89PNG\r\n\x1a\n'):type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:head.startsWith('RIFF')&&head.slice(8,12)==='WEBP';
    if(!valid)throw new Error('Dateiformat stimmt nicht mit der Endung überein: '+file.name);
    let binary='';for(let offset=0;offset<bytes.length;offset+=8192)binary+=String.fromCharCode(...bytes.subarray(offset,offset+8192));
    return {...info[i],id:crypto.randomUUID(),data:btoa(binary)};
  }));
}
export function assertAttachmentModel(files: AiAttachment[], model?: {vision?:boolean;pdf?:boolean}): void {
  if(files.some(f=>f.mimeType.startsWith('image/'))&&model?.vision===false)throw new Error('Das gewählte Modell unterstützt keine Bilder. Bitte ein Modell mit [Bild] auswählen.');
  if(files.some(f=>f.mimeType==='application/pdf')&&model?.pdf===false)throw new Error('Das gewählte Modell unterstützt keine direkten PDF-Anhänge. Bitte die Modellliste aktualisieren und ein Modell mit [PDF] auswählen.');
}
export function attachmentParts(prompt:string, files:AiAttachment[]): Part[] {
  validateAttachments(files);
  return [{text:prompt},...files.flatMap(f=>[{text:'Referenzdatei: '+f.name},{inlineData:{mimeType:f.mimeType,data:f.data,displayName:f.name}}])];
}
