import {DeviceRegistry,componentAddress,addressKey,designationContext} from '../model/DeviceRegistry';
import {effectiveArticles} from '../model/ArticleAssignments';
import {activeImportedArticles} from '../model/ImportedArticles';
import { Project, PlacedComponent, SymbolDefinition } from '../model/types';
import { getSymbolForComponent } from '../model/symbols';
import { isConnectionSymbol } from '../model/ConnectionSymbols';

export interface PartEntry {
  articleNumber: string;
  manufacturer: string;
  description: string;
  technicalCharacteristics: string;
  quantity: number;
  quantityUncertain?: boolean;
  deviceCountUncertain?: boolean;
  variant?: string;
  quantityBasis?: 'placement'|'source_function'|'manual_assignment'|'verified_device'|'mixed';
  bmkList: string[];
}

export function isConnectionComponent(comp: PlacedComponent, sym?: SymbolDefinition): boolean {
  if (sym && isConnectionSymbol(sym)) return true;
  if (sym?.category === 'connections' || sym?.connectionGraphic) return true;
  if (sym?.deviceBox || sym?.category === 'structure' || comp.symbolId === 'device_box') return true;
  const id = comp.symbolId.toLowerCase();
  return (
    id === 'potential_arrow' ||
    id.startsWith('potential_arrow') ||
    id.startsWith('t_piece') ||
    id.startsWith('corner') ||
    id.startsWith('cross_') ||
    id === 'potential_rail_source' ||
    id === 'device_box' ||
    id === 'box'
  );
}

export class PartsListGenerator {
  public static generatePartsList(project: Project): PartEntry[] {
    const partsMap = new Map<string, PartEntry>();
    const devices=new DeviceRegistry(project);
    const invalidMembers=new Set(devices.issues.flatMap(i=>i.members.map(addressKey)));

    for (const page of project.pages) {
      for (const comp of page.components) {
        const sym = getSymbolForComponent(comp, project);
        const address=componentAddress(page,comp),device=devices.forComponent(address);
        if(device&&addressKey(device.main)!==addressKey(address))continue;
        const assigned=effectiveArticles(comp,project);
        if(comp.articleAssignment&&!assigned.length)continue;

        // Skip connection elements (T-pieces, corners, potential arrows, crossings, etc.)
        const imported=activeImportedArticles(comp);
        if (!assigned.length && !imported && isConnectionComponent(comp, sym)) {
          continue;
        }

        // Skip auxiliary contacts if part is counted on master coil
        if (!device && !comp.articleAssignment && !imported && sym?.isContact && !sym.isMaster && sym.category === 'relays' && sym.contactType !== 'PowerNO') {
          continue;
        }

        const items=assigned.length?assigned.map(a=>({article:a.articleNumber,manufacturer:a.manufacturer,variant:a.variant,quantity:a.quantity,description:a.snapshot?.description||comp.functionText||sym?.name||'Betriebsmittel',basis:(device?'verified_device':comp.articleAssignment?'manual_assignment':imported?'source_function':'placement') as PartEntry['quantityBasis']}))
          :[{article:comp.articleNumber||'STD-'+comp.symbolId.toUpperCase(),manufacturer:comp.manufacturer||'Standard Fabrikat',variant:undefined,
            quantity:1,description:comp.functionText||sym?.name||'Betriebsmittel',basis:(device?'verified_device':'placement') as PartEntry['quantityBasis']}];
        for(const item of items){
          const key=JSON.stringify([item.article,item.manufacturer,item.variant??'']);
          if(!partsMap.has(key))partsMap.set(key,{articleNumber:item.article,manufacturer:item.manufacturer,description:item.description,
            technicalCharacteristics:comp.technicalCharacteristics||'-',quantity:0,bmkList:[],...(item.variant?{variant:item.variant}:{}),quantityBasis:item.basis});
          const entry=partsMap.get(key)!;
          if(invalidMembers.has(addressKey(address)))entry.deviceCountUncertain=true;
          if(item.quantity===undefined)entry.quantityUncertain=true;else entry.quantity+=item.quantity;
          if(entry.quantityBasis!==item.basis)entry.quantityBasis='mixed';
          const tag=device?[...(devices.valid.get(device.id)?.members??[])].map(a=>devices.placement(a)!).filter(Boolean).map(e=>{const [plant,location,bmk]=JSON.parse(designationContext(e.page,e.component));return `${plant?'='+plant:''}${location?'+'+location:''}${bmk}`;})[0]??comp.bmk:comp.bmk;
          if(!entry.bmkList.includes(tag))entry.bmkList.push(tag);
        }
      }
    }

    return Array.from(partsMap.values()).sort((a, b) => a.articleNumber.localeCompare(b.articleNumber));
  }
}

export function partQuantityLabel(part:PartEntry):string {const quantity=part.quantityUncertain?(part.quantity?`${part.quantity} + ?`:'?')+'x':`${part.quantity}x`;return (part.deviceCountUncertain?'~':'')+quantity;}
