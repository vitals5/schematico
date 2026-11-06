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
  variant?: string;
  quantityBasis?: 'placement'|'source_function'|'mixed';
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

    for (const page of project.pages) {
      for (const comp of page.components) {
        const sym = getSymbolForComponent(comp, project);

        // Skip connection elements (T-pieces, corners, potential arrows, crossings, etc.)
        const imported=activeImportedArticles(comp);
        if (!imported && isConnectionComponent(comp, sym)) {
          continue;
        }

        // Skip auxiliary contacts if part is counted on master coil
        if (!imported && sym?.isContact && !sym.isMaster && sym.category === 'relays' && sym.contactType !== 'PowerNO') {
          continue;
        }

        const references=imported;
        const items=references?.map(ref=>({article:ref.articleNumber,manufacturer:ref.articleNumber===comp.articleNumber?(comp.manufacturer||ref.manufacturer||''):(ref.manufacturer??''),variant:ref.variant,
          quantity:ref.quantity,description:project.importedArticleLibrary?.find(m=>m.id===ref.masterDataId)?.description??comp.functionText??sym?.name??'Betriebsmittel',basis:'source_function' as const}))
          ??[{article:comp.articleNumber||'STD-'+comp.symbolId.toUpperCase(),manufacturer:comp.manufacturer||'Standard Fabrikat',variant:undefined,
            quantity:1,description:comp.functionText||sym?.name||'Betriebsmittel',basis:'placement' as const}];
        for(const item of items){
          const key=JSON.stringify([item.article,item.manufacturer,item.variant??'']);
          if(!partsMap.has(key))partsMap.set(key,{articleNumber:item.article,manufacturer:item.manufacturer,description:item.description,
            technicalCharacteristics:comp.technicalCharacteristics||'-',quantity:0,bmkList:[],...(item.variant?{variant:item.variant}:{}),quantityBasis:item.basis});
          const entry=partsMap.get(key)!;
          if(item.quantity===undefined)entry.quantityUncertain=true;else entry.quantity+=item.quantity;
          if(entry.quantityBasis!==item.basis)entry.quantityBasis='mixed';
          if(!entry.bmkList.includes(comp.bmk))entry.bmkList.push(comp.bmk);
        }
      }
    }

    return Array.from(partsMap.values()).sort((a, b) => a.articleNumber.localeCompare(b.articleNumber));
  }
}

export function partQuantityLabel(part:PartEntry):string {return part.quantityUncertain?(part.quantity?`${part.quantity} + ?`:'?')+'x':`${part.quantity}x`;}
