/** File protocol for the optional, independently usable DWG-to-DXF converter. */
const LIMIT=20*1024*1024;
export function cadConverterFiles(value:unknown):{dxf:File;original:File} {
  const data=value as Record<string,unknown>;
  if(!data||typeof data.name!=='string'||typeof data.originalName!=='string'||!data.name.toLowerCase().endsWith('.dxf')||!data.originalName.toLowerCase().endsWith('.dwg')||!(data.bytes instanceof Uint8Array)||!(data.originalBytes instanceof Uint8Array)||!data.bytes.length||!data.originalBytes.length||data.bytes.length>LIMIT||data.originalBytes.length>LIMIT)throw new Error('cadInvalid');
  const basename=(s:string)=>s.split(/[\\/]/).pop()!.slice(0,200);
  return {dxf:new File([new Uint8Array(data.bytes)],basename(data.name),{type:'application/dxf'}),original:new File([new Uint8Array(data.originalBytes)],basename(data.originalName))};
}
export function openCadConverter(signal:AbortSignal):Promise<{dxf:File;original:File}> {
  const token=Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
  const url=new URL('./cad-converter/index.html',document.baseURI);url.hash=token;
  // Open synchronously from the user's click, before any file/worker awaits.
  const child=window.open(url.href,'_blank','popup,width=820,height=620');
  if(!child)return Promise.reject(new Error('cadPopupBlocked'));
  return new Promise((resolve,reject)=>{
    const cleanup=()=>{window.removeEventListener('message',receive);signal.removeEventListener('abort',abort);clearInterval(poll);clearTimeout(timer);};
    const abort=()=>{cleanup();child.close();reject(new Error('cadCancelled'));};
    const receive=(event:MessageEvent)=>{
      if(event.source!==child||event.origin!==url.origin||event.data?.type!=='cad-dxf-file-v1'||event.data?.token!==token)return;
      try{const files=cadConverterFiles(event.data);cleanup();child.close();resolve(files);}catch(error){cleanup();child.close();reject(error);}
    };
    const poll=setInterval(()=>{if(child.closed){cleanup();reject(new Error('cadCancelled'));}},300);
    const timer=setTimeout(()=>{cleanup();child.close();reject(new Error('cadConverterTimeout'));},10*60*1000);
    signal.addEventListener('abort',abort,{once:true});window.addEventListener('message',receive);
    if(signal.aborted)abort();
  });
}
