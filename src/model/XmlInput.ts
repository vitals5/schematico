/** Decode engineering XML without silently replacing invalid byte sequences. */
export function decodeEngineeringXml(bytes:Uint8Array,maxBytes=4*1024*1024):string {
 if(bytes.byteLength>maxBytes)throw new Error('XML-Datei ist zu groß.');
 const le=bytes[0]===255&&bytes[1]===254||bytes[0]===60&&bytes[1]===0;
 const be=bytes[0]===254&&bytes[1]===255||bytes[0]===0&&bytes[1]===60;
 const utf8=bytes[0]===239&&bytes[1]===187&&bytes[2]===191;
 const declaration=new TextDecoder('windows-1252').decode(bytes.subarray(0,2048)).match(/<\?xml\s[^?]*encoding=["']([^"']+)["']/i)?.[1];
 try{return new TextDecoder(le?'utf-16le':be?'utf-16be':utf8?'utf-8':declaration??'utf-8',{fatal:true}).decode(bytes);}catch{throw new Error('XML-Zeichenkodierung ist ungültig oder nicht unterstützt. Bitte erneut als UTF-8 exportieren.');}
}
