import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';
import { MacroManager } from './MacroManager';
import { parseNativeXmlMacro } from './NativeXmlMacro';
import { macroWithVariables } from './NativeMacroVariables';
import { mergeNativeMacroData } from './NativeMacroData';
import { meshBoundaryLoops, projectedXmlMesh } from './NativeXmlMesh';
import { ExternalMacroLibrary } from './ExternalMacroLibrary';
import type { Project } from './types';

const example=fs.readFileSync(new URL('./fixtures/2_P_Circuit_Breaker.ems',import.meta.url),'utf8');
const rootName=new DOMParser().parseFromString(example,'application/xml').documentElement.tagName;
const document=(body:string,kind='WindowMacro',attrs='')=>`<${rootName} Name="Example" Type="${kind}"><MacroVariant VariantId="0" MacroFuncType="1" ${attrs}>${body}</MacroVariant></${rootName}>`;
const line='<O31 A1="31/1" A531="0/0" A532="10/0"/>';
const page=(body:string,id='4/1')=>`<O4 A1="${id}">${body}</O4>`;
const target=()=>({drawingUnitsPerMm:3,symbolLibrary:[],pages:[]}as unknown as Project);
const load=(xml:string)=>parseNativeXmlMacro(xml.startsWith(`<${rootName}`)?xml:document(xml),'example.ema',[],{allowMissing:true});

// Cached graphics must follow their owner placement, including scale and rotation.
const cache=load(page(`<O5 A1="5/1"><S31x5 A531="0/0" A532="10/0"/></O5><O191 A1="191/1" R9="5/1"><S40x1201 A762="20/30"><S39x761 A751="0" A752="-.1" A753=".1" A754="0"/></S40x1201></O191>`));
assert.equal(cache.type,'ema');if(cache.type!=='ema')throw new Error();
assert.equal(cache.components.length,1);assert(Math.abs(cache.width)<1e-7||cache.width===1);assert(Math.abs(cache.height-2)<1e-7);
assert(cache.symbolLibrary![0].pins.length===0);assert(cache.nativeData!.metadata.some(m=>m.type==='O191'));

// Embedded files resolve by normalized full path or an unambiguous basename.
const png='89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082';
const image=load(page(`<O26 A1="26/1">${line}<O91 A1="91/1" A1651="0/0" A1652="10/5" A1671="C:\\images\\tiny.png"/></O26><ExternalFile Path="c:/images/tiny.png" Coding="Hex">${png}</ExternalFile>`));
assert.equal(image.type,'ema');if(image.type!=='ema')throw new Error();
assert.equal(image.images?.length,1);assert(!image.images![0].missing);assert(image.images![0].dataUrl.startsWith('data:image/png;base64,'));
assert.equal(image.components.length,1);assert.equal(MacroManager.instantiateWindowMacro(image,0,0,[],target()).images[0].width,30);
assert(image.groups![0].members.some(m=>m.kind==='image'&&m.id===image.images![0].id));
const missing=load(page('<O91 A1651="0/0" A1652="10/5" A1671="missing.png"/>'));
assert(missing.importDiagnostics?.some(d=>d.includes('missing.png')));assert(missing.type==='ema'&&missing.images![0].missing);
assert.throws(()=>parseNativeXmlMacro(document(page('<O91 A1652="10/5" A1671="missing.png"/>')),'example.ema'),/Bilddatei fehlt/);

// Source pages remain independently insertable; empty page templates are valid.
// Build directly rather than relying on filename extensions to distinguish pages.
const pageMacro=parseNativeXmlMacro(document(page(line)+page('<P11 P11011="Second"/>','4/2'),'PageMacro'),'example.emp');
assert.equal(pageMacro.type,'ems');if(pageMacro.type!=='ems')throw new Error();
assert.equal(pageMacro.pages!.length,2);assert.equal(pageMacro.pages![1].title,'Second');
const project=target();for(const source of pageMacro.pages!)project.pages.push(MacroManager.instantiatePageMacro({...pageMacro,page:source},project));
assert.equal(project.pages.length,2);assert.notEqual(project.pages[0].id,project.pages[1].id);
const variablePages=load(document(page(line)+page('<P11 P11011="Second"/>','4/2')+'<O106><S109x1895 R1906="4/2"><S115x1904 A1911="11011" A1913="&lt;Title&gt;"/></S109x1895></O106>','PageMacro'));
assert(variablePages.type==='ems');if(variablePages.type!=='ems')throw new Error();
const configuredPages=macroWithVariables(variablePages,{Title:'Configured'});
assert.equal(configuredPages.pages![1].title,'Configured');
assert.equal(MacroManager.instantiatePageMacro({...configuredPages,page:configuredPages.pages![0]},target()).nativeData!.variables.length,0);
const configuredPage=MacroManager.instantiatePageMacro({...configuredPages,page:configuredPages.pages![1]},target());
assert.equal(configuredPage.title,'Configured');assert.equal(configuredPage.nativeData!.variables[0].bindings[0].pageId,configuredPage.id);
const blank=document(page(''),'PageMacro'),library=new ExternalMacroLibrary(undefined,{get:async()=>undefined,put:async()=>{}});
await library.selectFiles([Object.defineProperty(new File([blank],'blank.emp'),'webkitRelativePath',{value:'Examples/blank.emp'})]);
assert.equal(library.state.macroCount,1);assert.deepEqual(library.state.issues,[]);await library.disconnect();

// Contour coordinates omitted by the writer mean zero, not an invalid point.
const contour=load(`<${rootName} Type="ContourDefinition"><O169><O200><O31 A532="10/-20"/></O200></O169></${rootName}>`);
assert(contour.type==='ema'&&contour.width===20&&contour.height===40);

// Nonprinting placeholders configure mapped properties, and survive fresh IDs,
// repeated insertion and portable export without mutating the library source.
const variable=load(page(`<O30 A1="30/1" A501="0/0" A511="Pump A"/><O106 A1="106/1"><S109x1895 R1906="30/1"><S115x1904 A1911="20011" A1913="Pump &lt;Name&gt;"/></S109x1895></O106>`));
assert(variable.type==='ema');if(variable.type!=='ema')throw new Error();
assert.equal(variable.components.length,1);assert.equal(variable.nativeData!.variables[0].value,'A');
const changed=macroWithVariables(variable,{Name:'B'});assert.equal(changed.components[0].functionText,'Pump B');assert.equal(variable.components[0].functionText,'Pump A');
assert.equal(macroWithVariables(variable,{Name:''}).components[0].functionText,'Pump ');
const first=MacroManager.instantiateWindowMacro(changed,20,30,[],target()),second=MacroManager.instantiateWindowMacro(changed,30,40,[],target());
assert.equal(first.nativeData!.variables[0].bindings[0].componentId,first.components[0].id);
const merged=mergeNativeMacroData(first.nativeData,second.nativeData)!;
assert.deepEqual(merged.variables.map(v=>v.name),['Name','Name_2']);assert.equal(merged.variables[1].bindings[0].template,'Pump <Name_2>');
const exported=MacroManager.exportMacro(changed),restored=await MacroManager.parseMacroFile(new File([exported.blob],exported.filename),{allowHeuristic:false});
assert.deepEqual(restored.nativeData,changed.nativeData);

// Missing masters are visibly unresolved, retain their identity and have no pins.
const unresolvedXml=document('<ESymLib ID="1" Name="UNAVAILABLE"/>'+page('<O17 A1261="1" A1262="9" A1263="0"><S40x1201 A762="0/0"/></O17>'));
assert.throws(()=>parseNativeXmlMacro(unresolvedXml,'missing.ema'),/Bibliothekssymbol nicht verfügbar/);
const unresolved=load(unresolvedXml);assert(unresolved.type==='ema'&&unresolved.symbolLibrary![0].unresolved);
assert(unresolved.type==='ema'&&unresolved.symbolLibrary![0].pins.length===0);assert.equal(unresolved.importDiagnostics?.length,1);

// A bounded stream decoder reads real boundary indices; invalid indices,
// transforms and parent cycles cannot become arbitrary projected graphics.
const mesh='#,1,1{20,2,16,1>{}{}12,3,0/0/0,10/0/0,0/10/0,0,1,84,2,16842751,*,1,0,0,1,0,2,0,0,1,56,4,0,1,2,0,0}';
assert.equal(meshBoundaryLoops(mesh)[0].length,4);
assert.throws(()=>meshBoundaryLoops(mesh.replace('56,4,0,1,2','56,4,0,1,99')),/3D-Geometrie/);
const meshXml=`<root><O161 A1="mesh"><Stream Id="62491">${mesh}</Stream></O161><O170 A1="parent" A2482="5/10/0"/><O180 A1="part" R9="mesh" R2481="parent" A2482="2/3/4"/></root>`;
const nodes=Array.from(new DOMParser().parseFromString(meshXml,'application/xml').getElementsByTagName('*')),byId=new Map(nodes.map(n=>[n.getAttribute('A1')??'',n]));
const projected=projectedXmlMesh(byId.get('part')!,byId,2);
assert.equal(projected.length,3);assert.deepEqual(projected[0],{kind:'line',x1:14,y1:-26,x2:34,y2:-26,color:'currentColor',width:.36});
byId.get('parent')!.setAttribute('R2481','part');assert.throws(()=>projectedXmlMesh(byId.get('part')!,byId,2),/3D-Geometrie/);
console.log('✓ Extended native macros: cached transforms, embedded/missing images, multiple and empty pages, contours, editable variables, metadata remapping, missing masters and bounded 3D projection');
