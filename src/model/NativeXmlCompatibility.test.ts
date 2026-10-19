import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';
import { parseNativeXmlMacro } from './NativeXmlMacro';
import { affineXmlGraphics } from './NativeXmlAffine';
import type { DrawingPrimitive } from './types';

const example=fs.readFileSync(new URL('./fixtures/2_P_Circuit_Breaker.ems',import.meta.url),'utf8');
const rootName=new DOMParser().parseFromString(example,'application/xml').documentElement.tagName;
const xml=(body:string,func='1')=>`<${rootName} Type="WindowMacro"><MacroVariant MacroFuncType="${func}" VariantId="0">${body}</MacroVariant></${rootName}>`;
const parse=(body:string)=>parseNativeXmlMacro(xml(body),'example.ema');
const page=(body:string)=>`<O4>${body}</O4>`;
const body='<ESymLib ID="0" Name="SPECIAL"/>'+page('<O17 A1261="0" A1262="32" A1263="0" A185="IN"><S1201 A762="7/9"><S761 A751="0" A752="-1" A753="1" A754="0"/></S1201><P144 P20013="X" P20014="1"/></O17><O30 A501="30/10" A511="PLC"><S505 A961="3"/></O30><O76 A1="76/1" A1422="1"/>');
const old=parse(body),current=parse(body.replaceAll('S1201','S40x1201').replaceAll('S761','S39x761').replaceAll('S505','S54x505'));
assert(old.type==='ema'&&current.type==='ema');if(old.type!=='ema'||current.type!=='ema')throw new Error();
const data=(m:typeof old)=>({width:m.width,height:m.height,graphics:m.symbolLibrary?.map(s=>s.importedGraphics),
  components:m.components.map(c=>({x:c.x,y:c.y,rotation:c.rotation,bmk:c.bmk,functionText:c.functionText,functionTextPosition:c.functionTextPosition,pins:c.pins}))});
assert.deepEqual(data(old),data(current));
assert(old.symbolLibrary!.some(s=>s.source?.number===32&&!s.unresolved));
assert.equal(old.components.find(c=>c.bmk==='-X1')!.rotation,90);
assert.equal(old.components.find(c=>c.functionText==='PLC')!.functionTextPosition!.fontSize,3*1.242*2);
assert(old.nativeData!.metadata.some(m=>m.type==='O76'));
assert.throws(()=>parse(body.replaceAll('S1201','S1202')),/Symbolplatzierung/);

const linked=parse(page('<O122 A1="122/1" A501="0/0" A2081="de_DE@Datenblatt;en_US@Data sheet;" A2082="documents/specification.pdf"><S505 A961="2"/></O122>'));
assert(linked.type==='ema');if(linked.type!=='ema')throw new Error();
assert.equal(linked.components[0].functionText,'Datenblatt');assert.equal(linked.symbolLibrary![0].pins.length,0);
assert(linked.nativeData!.metadata.some(m=>m.type==='O122'&&m.xml.includes('documents/specification.pdf')));
assert.equal(linked.importDiagnostics!.length,1);

const matrix={a:2,b:0,c:0,d:3,x:4,y:5};
const line:DrawingPrimitive={kind:'line',x1:2,y1:3,x2:10,y2:7,color:'currentColor',width:.5};
const original=structuredClone(line),transformed=affineXmlGraphics([line],matrix,2)[0];
assert.deepEqual(transformed,{...line,x1:8,y1:14,x2:24,y2:26,width:.5*Math.sqrt(6)});assert.deepEqual(line,original);
const ellipse=affineXmlGraphics([{kind:'circle',x:0,y:0,radius:2,color:'currentColor',fill:'currentColor'}],matrix,2)[0];
assert(ellipse.kind==='polygon');if(ellipse.kind!=='polygon')throw new Error();assert.equal(ellipse.fill,'currentColor');
for(const p of ellipse.points)assert(Math.abs(((p.x-4)/4)**2+((p.y-5)/6)**2-1)<1e-10);
const reflected=affineXmlGraphics([line],{a:-1,b:0,c:0,d:1,x:0,y:0},2)[0];
assert(reflected.kind==='line'&&reflected.x1===-2&&reflected.x2===-10&&reflected.y2===7);
assert.throws(()=>affineXmlGraphics([{kind:'text',x:0,y:0,text:'Text',size:5,color:'currentColor'}],matrix,2),/Skalierung gespeicherter Texte/);

const cache=page('<O3><S40x21 A762="10/10"><S39x761 A751="0" A752="-1" A753="1" A754="0"/></S40x21><O5 A1="5/1"><S31x5 A531="0/0" A532="10/0"/></O5><O144 A1="144/1" R9="5/1"><S1201 A762="2/3"><S761 A751="2" A754="1"/></S1201></O144></O3>');
const cached=parse(cache);assert(cached.type==='ema'&&cached.height===40&&cached.width===1);
assert.throws(()=>parse(cache.replace('A751="2"','A751="0"')),/Ungültige Transformation/);

const mesh='#,1,1{20,2,16,1>{}{}12,3,0/0/0,10/0/0,0/10/0,0,1,84,2,16842751,*,1,0,0,1,0,2,0,0,1,56,4,0,1,2,0,0}';
const cutout=parseNativeXmlMacro(xml(`<O161 A1="161/1"><Stream Id="62491">${mesh}</Stream></O161><O187 A1="187/1" R9="161/1" A2482="0/0/3"/>`,'10'),'projection.ema');
assert(cutout.type==='ema'&&cutout.components.length===1&&cutout.symbolLibrary![0].pins.length===0);
assert(cutout.nativeData!.metadata.some(m=>m.type==='O187'));

// External library references remain explicit; legacy syntax must not invent
// missing connector geometry or electrical connections.
const missing=xml('<ESymLib ID="0" Name="IEC_symbol"/>'+page('<O17 A1261="0" A1262="3031" A1263="0"><S1201 A762="0/0"/></O17>'));
assert.throws(()=>parseNativeXmlMacro(missing,'connector.ema'),/Bibliothekssymbol nicht verfügbar/);
const incomplete=parseNativeXmlMacro(missing,'connector.ema',[],{allowMissing:true});
assert(incomplete.type==='ema'&&incomplete.symbolLibrary![0].unresolved&&incomplete.symbolLibrary![0].pins.length===0);
console.log('✓ Legacy placement/font aliases, source masters, editable document captions, affine cached vectors, nested rotations, projected cutouts and explicit missing connectors');
