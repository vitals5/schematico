import { CableDefinition, Page, Project } from '../model/types';
import { EodRecord, nativeText } from './EodReader';
import { NATIVE_SCALE as S, NativeSymbolLibrary } from './NativeSymbolLibrary';
import { cableCrossings } from '../model/CableDefinition';

/** String properties carry an index word. A tag inside ED63 label metadata is
 * a property reference, not another value; do not read its following bytes. */
function propertyString(r:EodRecord,tag:number):string {
  for(let i=r.find(tag);i>=0;i=r.find(tag,i+2))
    if(r.data[i+2]===0 && r.data[i+3]===0) return r.string(tag,4,i);
  return '';
}

export function nativeCableKind(r: EodRecord,library: NativeSymbolLibrary) {
  return r.symbol!==undefined ? library.resolve(r)?.definition.annotationKind : undefined;
}

export function readNativeCables(records: EodRecord[],page: Page,library: NativeSymbolLibrary, diagnostics: string[]=[]): CableDefinition[] {
  const lines=records.filter(r=>nativeCableKind(r,library)==='cable');
  const cores=records.filter(r=>nativeCableKind(r,library)==='cable_core');
  const world=(p:{x:number;y:number})=>({x:p.x*S,y:(297-p.y)*S});
  return lines.flatMap(r=>{
    const p=r.position,a=r.point(0xeb1e),b=r.point(0xeb1f),entry=library.resolve(r);
    if(!p||!a||!b||!entry){diagnostics.push(`Kabeldefinition ${r.id}: Bibliothek oder Endpunkte fehlen.`);return [];}
    library.use(entry);
    const start=world({x:p.x+a.x,y:p.y+a.y}),end=world({x:p.x+b.x,y:p.y+b.y});
    const dx=end.x-start.x,dy=end.y-start.y,length2=dx*dx+dy*dy;if(length2<1e-8){diagnostics.push(`Kabeldefinition ${r.id}: Definitionslinie ohne Länge.`);return [];}
    const cable: CableDefinition={id:`native_cable_${page.id}_${r.id}`,symbolId:entry.definition.id,
      source:{format:'NATIVE_CAD',objectType:r.type,objectId:r.id},start,end,bmk:r.bmk?'-'+r.bmk:'',
      cableType:propertyString(r,0x4e48),coreCount:Number(propertyString(r,0x4e4a))||undefined,crossSection:propertyString(r,0x4e4b),
      description:nativeText(propertyString(r,0x4e2b)),fontSize:2.2356*S,bmkFontSize:3.105*S,markStyle:'none',cores:[]};
    for(const c of cores.filter(c=>c.number(0xee67)===r.type && c.number(0xee67,4,4)===r.id)) {
      const point=c.position,coreEntry=library.resolve(c);if(!point)continue;if(coreEntry)library.use(coreEntry);
      const q=world(point);
      cable.cores.push({id:`native_core_${c.id}`,symbolId:coreEntry?.definition.id,source:{format:'NATIVE_CAD',objectType:c.type,objectId:c.id},
        t:((q.x-start.x)*dx+(q.y-start.y)*dy)/length2,color:propertyString(c,0x791c),designation:propertyString(c,0x7923),crossSection:propertyString(c,0x791a)});
    }
    return [cable];
  });
}

export function bindImportedCableCores(page:Page,project:Project):void {
  for(const cable of page.cables ?? []) for(const crossing of cableCrossings(cable,page,project)) {
    const core=cable.cores.find(c=>Math.abs(c.t-crossing.t)<1e-5);if(core)core.wireIds=crossing.wireIds;
  }
}
