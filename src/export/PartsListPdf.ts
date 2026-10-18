import type { jsPDF } from 'jspdf';
import type { PartEntry } from '../reports/PartsList';

export const BOM_COLUMNS = [
  { title: 'Menge', width: 18, font: 'helvetica', style: 'bold' },
  { title: 'Artikelnummer', width: 45, font: 'courier', style: 'bold' },
  { title: 'Beschreibung / Typ', width: 65, font: 'helvetica', style: 'normal' },
  { title: 'Hersteller', width: 40, font: 'helvetica', style: 'normal' },
  { title: 'BMK-Liste', width: 50, font: 'courier', style: 'normal' }
];
export const BOM_FONT_SIZE = 7.5;
export const BOM_LINE_HEIGHT = 3.2; // mm, including leading
export const BOM_ROWS_TOP = 47;
export type BomRow = { cells: string[][]; height: number };
export type BomPage = BomRow[];

/** Measure with each cell's actual font. Keep ordinary rows together; a row
 * taller than a whole page continues without dropping any of its text. */
export function layoutPartsListPdf(doc: jsPDF, parts: PartEntry[], pageHeight: number): BomPage[] {
  const savedFont = doc.getFont(), savedSize = doc.getFontSize();
  const pages: BomPage[] = [[]];
  const bottom = pageHeight - 25, fullHeight = bottom - BOM_ROWS_TOP;
  let y = BOM_ROWS_TOP;
  const next = () => { pages.push([]); y = BOM_ROWS_TOP; };
  try {
    for (const part of parts) {
      const values = [`${part.quantity}x`, part.articleNumber, part.description, part.manufacturer, part.bmkList.join(', ')];
      const cells = values.map((text, i) => {
        const column = BOM_COLUMNS[i];
        doc.setFont(column.font, column.style); doc.setFontSize(BOM_FONT_SIZE);
        return doc.splitTextToSize(text.replace(/\r\n?/g, '\n'), column.width - 4) as string[];
      });
      const lines = Math.max(1, ...cells.map(c => c.length));
      const height = 6 + (lines - 1) * BOM_LINE_HEIGHT;
      if (height <= fullHeight && y + height > bottom + 1e-8) next();
      let offset = 0;
      do {
        if (bottom - y < 6 - 1e-8) next();
        const capacity = Math.max(1, Math.floor((bottom - y - 6 + 1e-8) / BOM_LINE_HEIGHT) + 1);
        const count = Math.min(lines - offset, capacity), rowHeight = 6 + (count - 1) * BOM_LINE_HEIGHT;
        pages.at(-1)!.push({ cells: cells.map(c => c.slice(offset, offset + count)), height: rowHeight });
        y += rowHeight; offset += count;
        if (offset < lines) next();
      } while (offset < lines);
    }
    return pages;
  } finally {
    doc.setFont(savedFont.fontName, savedFont.fontStyle); doc.setFontSize(savedSize);
  }
}
