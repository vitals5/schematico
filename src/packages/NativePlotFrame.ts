import JSZip from 'jszip';
import { EodRecord, nativeText, readIndexedEodRecords } from './EodReader';
import { nativePrimitives, NativeSymbolLibrary } from './NativeSymbolLibrary';
import { PlotFrameTemplate, FrameText } from '../model/PlotFrame';

/** Indexed native frame resources, separate from placed page symbols. */
export async function readNativePlotFrame(zip: JSZip, root: string, instances: EodRecord[], library: NativeSymbolLibrary): Promise<PlotFrameTemplate | undefined> {
  const eod=zip.file(root+'Form.eod'),eox=zip.file(root+'Form.eox'),setting=zip.file(root+'Settings.xdb/Setting.eod');
  if(!eod || !eox || !setting)return;
  const settings=await setting.async('uint8array'), encoded=new TextEncoder().encode('TrDMProject.Frame');
  let start=-1;
  outer:for(let i=0;i<=settings.length-encoded.length;i++){for(let j=0;j<encoded.length;j++)if(settings[i+j]!==encoded[j])continue outer;start=i+encoded.length;break;}
  if(start<0)return;
  const bytes=await eod.async('uint8array');if(bytes.length%1297)return;
  const forms=readIndexedEodRecords(bytes,await eox.async('uint8array'),{size:1297,typedIndex:true},'Form');
  const window=new TextDecoder('latin1').decode(settings.subarray(start,start+256)).toUpperCase();
  const form=forms.find(f=>f.type===21 && f.string(0xede6) && window.includes(f.string(0xede6).toUpperCase()));
  if(!form)return;
  const width=Number(form.string(0x2f01,4)) || 420,height=Number(form.string(0x2f02,4)) || 297;
  const records=instances.filter(r=>r.number(0xebf1)===21 && r.number(0xebf1,4,4)===form.id);
  const graphics: PlotFrameTemplate['graphics']=[],texts:FrameText[]=[];
  const scale=1000/420;
  for(const r of records) {
    if([30,53].includes(r.type)) {
      const p=r.point(0xec55);if(!p)continue;
      const format=r.number(0xee26,1),size=(r.double(0xee21)??library.layers.get(r.number(0xebfb)??-1)?.fontSize??1.8)*1.242;
      texts.push({id:String(r.id),x:p.x,y:height-p.y-(format===8?.38482683:0),size,
        anchor:[11,8].includes(format??0)?'middle':format===12?'end':'start',
        ...(r.type===30?{text:(() => { const raw = r.string(0xec5f); return !/(?:de_DE|\?\?_\?\?)@/.test(raw) && /(?:^|;)en_US@Page(?:;|$)/.test(raw) ? 'Seite' : nativeText(raw); })()}:{property:r.number(0xed63),index:r.number(0xed65) ?? r.number(0xed64)})});
    }else{
      const explicit=r.double(0xebfe);
      for(const g of nativePrimitives(r,library.layers)) {
        if(g.kind==='line')graphics.push({...g,x1:g.x1/scale,y1:height+g.y1/scale,x2:g.x2/scale,y2:height+g.y2/scale,width:explicit??(g.width??.6)/scale});
        else if(g.kind==='rect')graphics.push({...g,x:g.x/scale,y:height+g.y/scale,width:g.width/scale,height:g.height/scale,lineWidth:explicit??(g.lineWidth??.6)/scale});
      }
    }
  }
  if(!graphics.length)return;
  // Some Instance slots contain only the prefix of a multilingual caption.
  // Use conventional norm-sheet captions for identified field pairs; never
  // display a serialization language marker as user text.
  const diagnostics: string[] = [];
  for (const text of texts) {
    if (text.text?.includes('@')) {
      const english = text.text.match(/(?:^|;)en_US@([^;]+)/)?.[1];
      text.text = english === 'Page' ? 'Seite' : text.text.replace(/^[^@]*@/, '');
      diagnostics.push('Eine mehrsprachige Normblatt-Beschriftung wurde aus dem lesbaren Präfix übernommen.');
    }
  }
  for (const [property, caption] of [[11085, 'Ersatz von'], [11086, 'Ersetzt durch']] as const) {
    const field = texts.find(t => t.property === property);
    const label = field && texts.filter(t => t.text === '' && Math.abs(t.y-field.y)<.01 && t.x<field.x && field.x-t.x<=45).sort((a,b)=>b.x-a.x)[0];
    if (label) { label.text = caption; diagnostics.push(`Unvollständige Beschriftung zu Feld ${property}: Standardbezeichnung verwendet.`); }
  }
  return {id:`native-frame-${form.id}`,name:form.string(0xede6),width,height,graphics,texts,diagnostics};
}
