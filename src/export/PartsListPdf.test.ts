import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import { layoutPartsListPdf, BOM_COLUMNS, BOM_ROWS_TOP } from './PartsListPdf';
import { PdfExporter, type PdfExportOptions } from './PdfExporter';
import type { PartEntry } from '../reports/PartsList';
import type { Project, Page } from '../model/types';

const longPart: PartEntry = { quantity: 81, articleNumber: 'ARTICLE' + '1234567890'.repeat(14),
  description: 'Erste Zeile\r\n\r\n' + 'Lange Beschreibung mit technischen Angaben und Zusatzinformationen '.repeat(14),
  manufacturer: 'Hersteller mit einem besonders langen Firmennamen und weiteren Angaben',
  bmkList: Array.from({ length: 81 }, (_, i) => `-K${i + 1}`), technicalCharacteristics: '' };
export const bomTestProject = { id: 'bom', name: 'PDF Umbruch', description: '', author: '', company: '',
  pages: [{ id: 'sheet', pageNumber: '1', title: 'Prüfung', pageType: 'schematic', higherLevel: '', location: '', components: [], wires: [],
    plotFrame: { type: 'DIN_A3_LANDSCAPE', width: 1000, height: 700, columns: 10, rows: ['A'],
      titleBlock: { projectTitle: '', commission: '', company: '', author: '', date: '', revision: '', sheetNumber: '1', totalSheets: '1' } } }],
  activePageId: 'sheet' } as unknown as Project;
export const bomTestOptions: PdfExportOptions = { paperFormat: 'a4', colorMode: 'monochrome', pageRange: 'current', currentPageId: 'sheet',
  includePartsList: true, includeTerminalDiagram: false, interactiveCrossReferences: false, includeBookmarks: true, plotFrame: true };

for (const format of ['a3', 'a4'] as const) {
  const width = format === 'a3' ? 420 : 297, height = format === 'a3' ? 297 : 210;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format });
  doc.setFont('courier', 'italic'); doc.setFontSize(11);
  const wrapped = layoutPartsListPdf(doc, [longPart], height);
  assert.equal(doc.getFont().fontStyle, 'italic'); assert.equal(doc.getFontSize(), 11, 'Measuring does not alter the schematic font');
  const row = wrapped[0][0];
  assert(row.height > 6); assert(row.cells.slice(1).every(c => c.length > 1), 'All text columns wrap, including unbroken article numbers');
  assert(row.cells[2].includes(''), 'Explicit blank lines survive');
  const compact = (s: string) => s.replace(/\s/g, '');
  for (const [index, value] of [longPart.quantity + 'x', longPart.articleNumber, longPart.description, longPart.manufacturer, longPart.bmkList.join(', ')].entries()) {
    assert.equal(compact(wrapped.flatMap(p => p.flatMap(r => r.cells[index])).join('')), compact(value), 'Wrapping does not truncate content');
  }
  const short: PartEntry = { ...longPart, quantity: 1, articleNumber: 'A1', description: 'Kurz', manufacturer: 'Firma', bmkList: ['-K1'] };
  assert.equal(layoutPartsListPdf(doc, [short], height)[0][0].height, 6, 'Short rows retain the previous spacing');
  assert.equal(layoutPartsListPdf(doc, [], height).length, 1, 'Empty BOM still prints its header');
  const huge: PartEntry = { ...short, articleNumber: 'GIANT', description: 'Langtext ohne Abschneiden '.repeat(1700) + 'ENDE' };
  const pages = layoutPartsListPdf(doc, [longPart, ...Array.from({ length: 25 }, () => short), huge, short], height);
  assert(pages.length > 2);
  assert(pages.every(p => p.length && BOM_ROWS_TOP + p.reduce((sum, r) => sum + r.height, 0) <= height - 25 + 1e-7), 'Rows stay above the footer on every page');
  assert(pages.flatMap(p => p.flatMap(r => r.cells[2])).join(' ').includes('ENDE'), 'A row taller than one page reaches its final word');
  const text: { value: string; x: number; y: number; width: number; page: number }[] = [];
  const original = doc.text.bind(doc);
  (doc as any).text = (value: string, x: number, y: number, ...args: any[]) => {
    text.push({ value, x, y, width: doc.getTextWidth(value), page: doc.getCurrentPageInfo().pageNumber });
    return (original as any)(value, x, y, ...args);
  };
  (PdfExporter as any).renderPartsListPage(doc, bomTestProject, width, height, 'monochrome', pages.length, pages);
  assert.equal(doc.getNumberOfPages(), pages.length);
  assert.equal(text.filter(t => t.value === 'Artikelnummer').length, pages.length, 'Continuation pages repeat the column headers');
  const body = text.filter(t => t.y > BOM_ROWS_TOP && t.y < height - 25);
  assert(body.length);
  for (const t of body) {
    let x = 22;
    const column = BOM_COLUMNS.find(c => { const found = Math.abs(t.x - x) < 1e-6; x += c.width; return found; });
    assert(column); assert(t.width <= column.width - 4 + 1e-6, `Text stays inside its column: ${t.value}`);
  }
  const totals = text.filter(t => Math.abs(t.x - 415 / 420 * width) < 1e-6);
  assert(totals.every(t => t.value === String(pages.length)), 'All continuation footers use the actual total');
  const ordinals = text.filter(t => Math.abs(t.x - 413 / 420 * width) < 1e-6);
  assert.deepEqual(ordinals.map(t => t.value), pages.map((_, i) => String(i + 1)));
}

// Exercise public export, including the selected schematic plus multiple BOM pages.
const project = structuredClone(bomTestProject);
const inventory = structuredClone(project.pages[0]); inventory.id = 'inventory'; inventory.pageNumber = '2';
inventory.components = Array.from({ length: 8 }, (_, i) => ({ id: `c${i}`, symbolId: 'contactor_coil', bmk: `-K${i + 1}`,
  functionText: longPart.description, articleNumber: longPart.articleNumber + i, manufacturer: longPart.manufacturer,
  x: 0, y: 0, rotation: 0, pins: {} })) as Page['components'];
project.pages.push(inventory);
export const bomPublicTestProject = project;
const before = JSON.stringify(project);
const blob = await PdfExporter.exportToPdf(project, bomTestOptions);
const bytes = new TextDecoder().decode(await blob.arrayBuffer());
assert(bytes.startsWith('%PDF')); assert((bytes.match(/\/Type \/Page\b/g) ?? []).length > 2);
assert.equal(JSON.stringify(project), before, 'PDF pagination never edits the project');
console.log('BOM PDF: every text column wraps, explicit paragraphs, dynamic rows, A3/A4 continuation, oversized cells, repeated headers and correct page totals passed');
