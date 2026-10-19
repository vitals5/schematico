import { Project, PlacedComponent, SymbolDefinition } from '../model/types';
import { getSymbolForComponent } from '../model/symbols';
import { isConnectionSymbol } from '../model/ConnectionSymbols';

export interface PartEntry {
  articleNumber: string;
  manufacturer: string;
  description: string;
  technicalCharacteristics: string;
  quantity: number;
  bmkList: string[];
}

export function isConnectionComponent(comp: PlacedComponent, sym?: SymbolDefinition): boolean {
  if (sym && isConnectionSymbol(sym)) return true;
  if (sym?.category === 'connections' || sym?.connectionGraphic) return true;
  const id = comp.symbolId.toLowerCase();
  return (
    id === 'potential_arrow' ||
    id.startsWith('potential_arrow') ||
    id.startsWith('t_piece') ||
    id.startsWith('corner') ||
    id.startsWith('cross_') ||
    id === 'potential_rail_source'
  );
}

export class PartsListGenerator {
  public static generatePartsList(project: Project): PartEntry[] {
    const partsMap = new Map<string, PartEntry>();

    for (const page of project.pages) {
      for (const comp of page.components) {
        const sym = getSymbolForComponent(comp, project);

        // Skip connection elements (T-pieces, corners, potential arrows, crossings, etc.)
        if (isConnectionComponent(comp, sym)) {
          continue;
        }

        // Skip auxiliary contacts if part is counted on master coil
        if (sym?.isContact && !sym.isMaster && sym.category === 'relays' && sym.contactType !== 'PowerNO') {
          continue;
        }

        const article = comp.articleNumber || 'STD-' + comp.symbolId.toUpperCase();
        const manufacturer = comp.manufacturer || 'Standard Fabrikat';
        const description = comp.functionText || sym?.name || 'Betriebsmittel';
        const technical = comp.technicalCharacteristics || '-';
        const key = `${article}_${manufacturer}`;

        if (!partsMap.has(key)) {
          partsMap.set(key, {
            articleNumber: article,
            manufacturer,
            description,
            technicalCharacteristics: technical,
            quantity: 0,
            bmkList: []
          });
        }

        const entry = partsMap.get(key)!;
        entry.quantity += 1;
        if (!entry.bmkList.includes(comp.bmk)) {
          entry.bmkList.push(comp.bmk);
        }
      }
    }

    return Array.from(partsMap.values()).sort((a, b) => a.articleNumber.localeCompare(b.articleNumber));
  }
}
