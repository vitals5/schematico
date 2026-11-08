// SPDX-License-Identifier: GPL-3.0-only
// Standalone file conversion. The only output contract is the standard DXF format.
import {LibreDwg} from './vendor/dist/libredwg-web.js';
self.onmessage=async event=>{
  try{
    const bytes=event.data;
    if(!(bytes instanceof ArrayBuffer)||bytes.byteLength>20*1024*1024||!/^AC10\d\d/.test(new TextDecoder().decode(bytes.slice(0,6))))throw new Error('Invalid DWG file / Ungültige DWG-Datei.');
    const lib=await LibreDwg.create(new URL('./vendor/wasm/',import.meta.url).href.replace(/\/$/,''));
    const dxf=lib.dwg_write_dxf(bytes);
    if(!dxf?.length||dxf.length>20*1024*1024)throw new Error('DXF conversion failed or output exceeds 20 MiB / Konvertierung fehlgeschlagen oder DXF zu groß.');
    self.postMessage({bytes:dxf},[dxf.buffer]);
  }catch(error){self.postMessage({error:error instanceof Error?error.message:String(error)});}
};
