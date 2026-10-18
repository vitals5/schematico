import JSZip from 'jszip';
import type { CoverPageTemplate } from '../model/CoverPage';
import type { DrawingPrimitive, PageImage } from '../model/types';
import type { FrameText } from '../model/PlotFrame';
import { EodRecord, nativeText, readEodTable, readIndexedEodRecords } from './EodReader';
import { NATIVE_SCALE, nativePrimitives, NativeSymbolLibrary } from './NativeSymbolLibrary';

const xmlText = (value: string) => value.replace(/&#(x[\da-f]+|\d+);/gi, (_, code: string) =>
  String.fromCodePoint(code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code)))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** Preserve indexed source values, including deliberately empty properties. */
async function projectProperties(zip: JSZip, root: string): Promise<Record<string, string>> {
  const properties: Record<string, string> = {};
  const info = zip.file(root + 'ProjectInfo.xml');
  if (!info) return properties;
  const xml = await info.async('text');
  for (const match of xml.matchAll(/<Property\b([^>]*?)(?:\/>|>([\s\S]*?)<\/Property>)/g)) {
    const id = /\bid="(\d+)"/.exec(match[1])?.[1];
    if (!id) continue;
    const index = /\bindex="(\d+)"/.exec(match[1])?.[1] ?? '0';
    const type = /\btype="(\d+)"/.exec(match[1])?.[1];
    let value = xmlText(match[2] ?? '').trim();
    if (type === '15') value = nativeText(value);
    if (type === '14' && /^\d+$/.test(value)) {
      const date = new Date(Number(value) * 1000);
      if (Number.isFinite(date.getTime())) value = date.toISOString().slice(0, 10).split('-').reverse().join('.');
    }
    properties[`${id}:${index}`] = value;
  }
  return properties;
}

// The supplied fixed slots retain only prefixes of these multilingual texts.
// Recover captions only for the identified F26_001 form, from its field pairing
// and the independent native CAD PDF export. Other forms keep their readable literals.
const f26Captions: Record<number, string> = {
  10100: 'Firma / Kunde', 10011: 'Projektbeschreibung', 10013: 'Projektnummer',
  10014: 'Kommission', 10015: 'Hersteller (Firma)', 10901: 'Pfad',
  10000: 'Projektname', 10030: 'Fabrikat', 10031: 'Typ', 10032: 'Installationsort',
  10025: 'Projektverantwortlicher', 10033: 'Teilebesonderheit',
  10021: 'Erstellt am', 10023: 'Bearbeitet am', 10022: 'von (Kürzel)', 10300: 'Anzahl der Seiten'
};

/** Read a referenced native title form as shared, editable project resources. */
export async function readNativeCoverPage(zip: JSZip, root: string, instances: EodRecord[], library: NativeSymbolLibrary): Promise<CoverPageTemplate | undefined> {
  const data = zip.file(root + 'Form.eod'), index = zip.file(root + 'Form.eox');
  const pageData = zip.file(root + 'Page.eod'), pageIndex = zip.file(root + 'Page.eox');
  if (!data || !index || !pageData || !pageIndex) return;
  const bytes = await data.async('uint8array');
  if (bytes.length % 1297) return;
  const forms = readIndexedEodRecords(bytes, await index.async('uint8array'), { size: 1297, typedIndex: true }, 'Form');
  const pages = readEodTable(await pageData.async('uint8array'), await pageIndex.async('uint8array'), 'Page');
  const reference = pages.map(page => page.string(0x2b07, 4)).find(name => /^F26_/i.test(name));
  const form = reference && forms.find(record => record.type === 51 && record.string(0xede6).toLowerCase() === reference.toLowerCase());
  if (!form) return;
  const norm = forms.find(record => record.type === 21);
  const width = Number(form.string(0x2f01, 4) || norm?.string(0x2f01, 4)) || 420;
  const height = Number(form.string(0x2f02, 4) || norm?.string(0x2f02, 4)) || 297;
  const records = instances.filter(record => record.number(0xebf1) === form.type && record.number(0xebf1, 4, 4) === form.id);
  const graphics: DrawingPrimitive[] = [], texts: FrameText[] = [], images: PageImage[] = [], diagnostics: string[] = [];
  for (const record of records) {
    if ([30, 53].includes(record.type)) {
      const point = record.point(0xec55);
      if (!point) continue;
      const format = record.number(0xee26, 1), nominal = record.double(0xee21) ?? library.layers.get(record.number(0xebfb) ?? -1)?.fontSize ?? 3.5;
      // native CAD middle-height anchors 4/6 place the baseline 1.727 mm below a
      // 3.5-mm nominal anchor; baseline anchors 10/12 need no displacement.
      const baselineOffset = [4, 6].includes(format ?? -1) ? nominal * .49342857 : 0;
      texts.push({ id: String(record.id), x: point.x, y: height - point.y + baselineOffset, size: nominal * 1.242,
        anchor: [6, 12].includes(format ?? -1) ? 'end' : [5, 8, 11].includes(format ?? -1) ? 'middle' : 'start',
        ...(record.type === 30 ? { text: nativeText(record.string(0xec5f)) } : { property: record.number(0xed63), index: record.number(0xed65) ?? record.number(0xed64) }) });
    } else if (record.type === 91) {
      const a = record.point(0xf0d3), b = record.point(0xf0d4), sourcePath = record.string(0xf0e7);
      const basename = sourcePath.split(/[\\/]/).pop()?.toLowerCase();
      const matches = Object.values(zip.files).filter(file => !file.dir && file.name.startsWith(root + 'Images/') && file.name.split('/').pop()?.toLowerCase() === basename);
      if (!a || !b || !basename || matches.length !== 1) { diagnostics.push(`Titelseitenbild ${record.id}: eingebettete Bilddatei nicht eindeutig auflösbar.`); continue; }
      const extension = basename.split('.').pop(), mime = extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : extension === 'png' ? 'image/png' : undefined;
      if (!mime) { diagnostics.push(`Titelseitenbild ${record.id}: Bildformat ${extension} wird nicht unterstützt.`); continue; }
      images.push({ id: `native-cover-image-${record.id}`, dataUrl: `data:${mime};base64,${await matches[0].async('base64')}`,
        x: Math.min(a.x, b.x), y: height - Math.max(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y), caption: sourcePath.split(/[\\/]/).pop() });
    } else {
      const explicitWidth = record.double(0xebfe);
      for (const primitive of nativePrimitives(record, library.layers)) {
        if (primitive.kind === 'line') graphics.push({ ...primitive,
          x1: primitive.x1 / NATIVE_SCALE, y1: height + primitive.y1 / NATIVE_SCALE,
          x2: primitive.x2 / NATIVE_SCALE, y2: height + primitive.y2 / NATIVE_SCALE,
          width: explicitWidth ?? (primitive.width ?? .6) / NATIVE_SCALE });
        if (primitive.kind === 'rect') {
          const x = primitive.x / NATIVE_SCALE, y = height + primitive.y / NATIVE_SCALE;
          const w = primitive.width / NATIVE_SCALE, h = primitive.height / NATIVE_SCALE;
          const lineWidth = explicitWidth ?? (primitive.lineWidth ?? .6) / NATIVE_SCALE;
          if (record.number(0xf0d8, 1) === 1) graphics.push({ kind: 'polygon', points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], color: 'currentColor', fill: 'currentColor', width: lineWidth });
          else graphics.push({ ...primitive, x, y, width: w, height: h, lineWidth });
        }
      }
    }
  }
  if (!graphics.length && !texts.length) return;
  if (form.string(0xede6).toUpperCase() === 'F26_001') {
    let recovered = 0;
    for (const record of records.filter(item => item.type === 30 && item.partial)) {
      const label = texts.find(text => text.id === String(record.id)), point = record.point(0xec55);
      if (!label || !point) continue;
      const field = records.filter(item => item.type === 53 && item.point(0xec55)?.y === point.y)
        .filter(item => (item.point(0xec55)?.x ?? 0) > point.x).sort((a, b) => a.point(0xec55)!.x - b.point(0xec55)!.x)[0];
      const caption = field && f26Captions[field.number(0xed63) ?? 0];
      if (caption && label.text !== caption) { label.text = caption; recovered++; }
      else if (label.text?.includes('@')) label.text = '';
    }
    if (recovered) diagnostics.push(`${recovered} unvollständige F26_001-Beschriftungen wurden anhand der belegten Feldzuordnung und des PDF-Exports ergänzt.`);
  }
  const properties = await projectProperties(zip, root);
  properties['11015:0'] = form.string(0xede6);
  // The four address/header fields are absent from ProjectInfo in the example.
  // Keep them empty instead of substituting unrelated customer-address values.
  return { id: `native-cover-${form.id}`, name: form.string(0xede6), width, height, graphics, texts, images, properties, diagnostics };
}
