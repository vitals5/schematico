// SPDX-License-Identifier: GPL-3.0-only
const input=document.querySelector('#file'),status=document.querySelector('#status'),error=document.querySelector('#error'),download=document.querySelector('#download'),send=document.querySelector('#send');
const token=location.hash.slice(1),connected=Boolean(window.opener&&/^[\da-f]{32}$/.test(token));
send.hidden=!connected;
let result,original,name,worker,timer,generation=0;
const stop=()=>{worker?.terminate();worker=undefined;clearTimeout(timer);};
input.addEventListener('change',async()=>{
  const current=++generation;stop();result=undefined;original=undefined;download.disabled=send.disabled=true;error.textContent='';
  const file=input.files?.[0];if(!file)return;
  if(file.size>20*1024*1024){error.textContent='Maximum file size: 20 MiB.';return;}
  try{
    const bytes=await file.arrayBuffer();if(current!==generation)return;original=bytes;name=file.name;status.textContent='Konvertierung läuft / Converting…';
    worker=new Worker('./worker.js',{type:'module'});
    timer=setTimeout(()=>{stop();error.textContent='Conversion timed out after 60 seconds. Please try a simpler drawing.';status.textContent='';},60000);
    worker.onerror=e=>{if(current!==generation)return;stop();status.textContent='';error.textContent=e.message||'Converter worker failed.';};
    worker.onmessage=e=>{if(current!==generation)return;stop();if(e.data.error){error.textContent=e.data.error;status.textContent='';return;}result=e.data.bytes;status.textContent=name+' → '+result.length.toLocaleString()+' bytes DXF';download.disabled=send.disabled=false;};
    worker.postMessage(original.slice(0));
  }catch(e){stop();error.textContent=String(e);}
});
download.addEventListener('click',()=>{if(!result)return;const url=URL.createObjectURL(new Blob([result],{type:'application/dxf'})),a=document.createElement('a');a.href=url;a.download=name.replace(/\.dwg$/i,'')+'.dxf';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
send.addEventListener('click',()=>{
  if(!result||!original||!connected)return;
  window.opener.postMessage({type:'cad-dxf-file-v1',token,name:name.replace(/\.dwg$/i,'')+'.dxf',bytes:result,originalName:name,originalBytes:new Uint8Array(original)},location.origin==='null'?'*':location.origin);
  send.disabled=true;status.textContent='DXF übergeben. Dieses Fenster kann geschlossen werden. / DXF sent. You may close this window.';
});
addEventListener('pagehide',stop);
