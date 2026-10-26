import type { Project, PlacedComponent } from '../../model/types';
import { getSymbolById } from '../../model/symbols';
export function fixture(): Project {
  return {
    id: 'test',
    name: 'Layout',
    description: '',
    standard: 'DIN EN 81346-2 / IEC 60617',
    version: '1',
    created: '',
    modified: '',
    author: '',
    company: '',
    drawingUnitsPerMm: 2,
    activePageId: 'p',
    pages: [
      {
        id: 'p',
        pageNumber: '1',
        pageType: 'schematic',
        title: 'Circuit',
        higherLevel: '',
        location: '',
        components: [],
        wires: [],
        plotFrame: {
          type: 'DIN_A3_LANDSCAPE',
          width: 840,
          height: 594,
          columns: 10,
          rows: ['A'],
          titleBlock: {
            projectTitle: '',
            commission: '',
            company: '',
            author: '',
            date: '',
            revision: '',
            sheetNumber: '1',
            totalSheets: '1',
          },
        },
      },
    ],
  };
}
export function add(
  p: Project,
  id: string,
  symbol = 'circuit_breaker_1p',
  x = 30,
  y = 30,
): PlacedComponent {
  const s = getSymbolById(symbol, p)!;
  const c: PlacedComponent = {
    id,
    symbolId: s.id,
    bmk: '-' + id,
    functionText: 'Steuerung',
    x,
    y,
    rotation: 0,
    pins: Object.fromEntries(s.pins.map((pin) => [pin.id, { wireIds: [] }])),
  };
  p.pages[0].components.push(c);
  return c;
}
