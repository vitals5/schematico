// src/reports/PartsList.ts
// Generates Bill of Materials (Stückliste / Artikelliste) according to DIN EN 81346 standards

import { Project } from '../model/types';
import { getSymbolForComponent } from '../model/symbols';

export interface PartEntry {
  articleNumber: string;
  manufacturer: string;
  description: string;
  technicalCharacteristics: string;
  quantity: number;
  bmkList: string[];
}

export class PartsListGenerator {
  public static generatePartsList(project: Project): PartEntry[] {
    const partsMap = new Map<string, PartEntry>();

    for (const page of project.pages) {
      for (const comp of page.components) {
        const sym = getSymbolForComponent(comp);
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
