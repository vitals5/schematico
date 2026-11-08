// src/model/PartCatalogue.ts
// Schematico Manufacturer Parts Catalogue & Component Database
import defaultCatalog from '../../catalog/articles.json';

export interface ManufacturerPart {
  id: string;
  manufacturer: string;
  articleNumber: string;
  name: string;
  category: 'protection' | 'relays' | 'controls' | 'motors' | 'terminals' | 'supply';
  symbolId: string;
  technicalData: string;
  widthModules?: string; // Teilungseinheiten (TE)
  datasheetUrl?: string;
  description: string;
  defaultBmkPrefix: string;
}

export const MANUFACTURER_PARTS: ManufacturerPart[] = (defaultCatalog.articles as any[]).map(a => {
  const parts = (a.description || '').split(' · ');
  const isRelay = a.symbolId === 'impulse_relay_1no' || a.symbolId === 'impulse_relay_2no' || a.symbolId === 'timer_relay_multifunction';
  const isContactor = a.symbolId === 'contactor_coil';
  const category: ManufacturerPart['category'] = isRelay ? 'relays' : isContactor ? 'controls' : 'protection';
  const defaultBmkPrefix = isRelay || isContactor ? '-K' : '-F';
  return {
    id: (a.manufacturer + '_' + a.articleNumber).toLowerCase().replace(/[^a-z0-9]/g, '_'),
    manufacturer: a.manufacturer,
    articleNumber: a.articleNumber,
    name: parts[0] || a.articleNumber,
    category,
    symbolId: a.symbolId || '',
    technicalData: parts[1] || '',
    description: a.description || '',
    defaultBmkPrefix
  };
});

export class PartCatalogue {
  public static getAllParts(): ManufacturerPart[] {
    return MANUFACTURER_PARTS;
  }

  public static getPartsByManufacturer(manufacturer: string): ManufacturerPart[] {
    return MANUFACTURER_PARTS.filter(p => p.manufacturer.toLowerCase() === manufacturer.toLowerCase());
  }

  public static getPartsByCategory(category: string): ManufacturerPart[] {
    return MANUFACTURER_PARTS.filter(p => p.category === category);
  }

  public static findPartByArticle(articleNumber: string): ManufacturerPart | undefined {
    return MANUFACTURER_PARTS.find(p => p.articleNumber.toLowerCase() === articleNumber.toLowerCase());
  }
}
