import JSZip from 'jszip';
import { DrawingPrimitive, PinDefinition, SymbolDefinition, TextFormatConfig } from '../model/types';
import { drawingToSvg } from '../model/ImportedDrawing';
import { EodRecord, nativeText, readIndexedEodRecords } from './EodReader';
import { NativeLayerStyle, readNativeLayers } from './NativeLayers';

export const NATIVE_SCALE = 1000 / 420;
export type Point = { x: number; y: number };
export type LibraryEntry = {
  definition: SymbolDefinition;
  /** Insertion point in the normalized, y-down library definition. */
  origin: Point;
  labels: Map<number, Point>;
  variantData?: Uint8Array;
};
const zero = { x: 0, y: 0 };
const direction: Record<number, PinDefinition['direction']> = { 1: 'top', 2: 'right', 4: 'bottom', 8: 'left' };

/** Only immutable geometry and physical pins belong to a library definition. */
export function nativePrimitives(record: EodRecord, layers?: ReadonlyMap<number, NativeLayerStyle>): DrawingPrimitive[] {
  const s = NATIVE_SCALE, at = (p: Point) => ({ x: p.x * s, y: -p.y * s });
  const layer = layers?.get(record.number(0xebfb) ?? -1);
  const sourceWidth = layer?.lineWidth;
  const color = 'currentColor', width = sourceWidth !== undefined && sourceWidth >= 0 && sourceWidth < 100
    ? sourceWidth * s : 0.55;
  if (record.type === 0x1f) {
    const a = at(record.point(0xec73) ?? zero), b = at(record.point(0xec74) ?? zero);
    return [{ kind: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y, color, width }];
  }
  if (record.type === 0x20) {
    const center = at(record.point(0xec8b) ?? zero), radiusVector = record.point(0xec8c);
    if (!radiusVector) return [];
    const radius = Math.hypot(radiusVector.x, radiusVector.y) * s;
    if (!radius) return [];
    const start = record.double(0xec89), end = record.double(0xec8a);
    // An omitted parameter defaults to zero; a present but incomplete or
    // non-finite value must not turn a damaged arc into a fabricated circle.
    if ((record.find(0xec89) >= 0 && start === undefined)
      || (record.find(0xec8a) >= 0 && end === undefined)) return [];
    const turn = 2 * Math.PI;
    const sweep = (((end ?? 0) - (start ?? 0)) % turn + turn) % turn;
    if (sweep > 1e-10 && turn - sweep > 1e-10) {
      // EC89/EC8A are start/end parameters in the radius-vector basis,
      // not an absolute heading and a sweep. Variant rotation is already in
      // EC8C. Positive source turns are CCW in y-up coordinates; reflecting
      // y requires negating both angles and retaining the negative sweep.
      const startAngle = -(Math.atan2(radiusVector.y, radiusVector.x) + (start ?? 0)) * 180 / Math.PI;
      return [{ kind: 'arc', ...center, radius, startAngle, endAngle: startAngle - sweep * 180 / Math.PI,
        counterClockwise: true, color, width }];
    }
    const fill = record.number(0xec8e, 1) === 1 ? color : undefined;
    // Equal start/end parameters encode a full circle. Filled native CAD markers use
    // a hairline contour (0.02 mm in the reference PDF), rather than expanding
    // the dot by the layer's ordinary outline width.
    return [{ kind: 'circle', ...center, radius, color, fill, width: fill ? 0.02 * s : width }];
  }
  if (record.type === 0x59) {
    const a = at(record.point(0xf0d3) ?? zero), b = at(record.point(0xf0d4) ?? zero);
    return [{ kind: 'rect', x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
      width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y), color, lineWidth: width }];
  }
  if (record.type === 0x22) {
    const points: Point[] = [];
    for (let i = record.find(0xeccd); i >= 0; i = record.find(0xeccd, i + 18)) {
      const p = new EodRecord(0, 0, 0, record.data.subarray(i)).point(0xeccd);
      if (p) points.push(at(p));
    }
    if (points.length < 2) return [];
    const closed = points.length > 2 && Math.hypot(points[0].x - points.at(-1)!.x, points[0].y - points.at(-1)!.y) < 1e-6;
    if (closed) return [{ kind: 'polygon', points, color, width }];
    return points.slice(1).map((p, i) => ({ kind: 'line', x1: points[i].x, y1: points[i].y, x2: p.x, y2: p.y, color, width }));
  }
  if (record.type === 0x1e) {
    const text = nativeText(record.string(0xec5f));
    // A literal tilde is a native CAD placeholder, not an immutable printed label.
    if (!text || text === '~') return [];
    return [{ kind: 'text', ...at(record.point(0xec55) ?? zero), text, color,
      size: (record.double(0xee21) ?? layer?.fontSize ?? 2.5) * s }];
  }
  return [];
}

export function translatePrimitives(graphics: DrawingPrimitive[], dx: number, dy: number): DrawingPrimitive[] {
  return graphics.map(g => g.kind === 'line' ? { ...g, x1: g.x1 + dx, y1: g.y1 + dy, x2: g.x2 + dx, y2: g.y2 + dy }
    : g.kind === 'polygon' ? { ...g, points: g.points.map(p => ({ x: p.x + dx, y: p.y + dy })) }
    : { ...g, x: g.x + dx, y: g.y + dy });
}

export function normalizeDefinition(definition: SymbolDefinition, labels = new Map<number, Point>()): LibraryEntry {
  const bounds: Point[] = [{ x: 0, y: 0 }, ...definition.pins];
  for (const g of definition.importedGraphics ?? []) {
    if (g.kind === 'line') bounds.push({ x: g.x1, y: g.y1 }, { x: g.x2, y: g.y2 });
    else if (g.kind === 'rect') bounds.push(g, { x: g.x + g.width, y: g.y + g.height });
    else if (g.kind === 'circle' || g.kind === 'arc') bounds.push({ x: g.x - g.radius, y: g.y - g.radius }, { x: g.x + g.radius, y: g.y + g.radius });
    else if (g.kind === 'polygon') bounds.push(...g.points);
    else bounds.push({ x: g.x, y: g.y - g.size }, { x: g.x + g.text.length * g.size * 0.55, y: g.y });
  }
  const minX = Math.min(...bounds.map(p => p.x)), minY = Math.min(...bounds.map(p => p.y));
  definition.width = Math.max(1, Math.max(...bounds.map(p => p.x)) - minX);
  definition.height = Math.max(1, Math.max(...bounds.map(p => p.y)) - minY);
  definition.insertionPoint = { x: -minX, y: -minY };
  definition.pins = definition.pins.map(p => ({ ...p, x: p.x - minX, y: p.y - minY,
    ...(p.labelPosition ? { labelPosition: { ...p.labelPosition,
      x: p.labelPosition.x - minX, y: p.labelPosition.y - minY } } : {}) }));
  definition.importedGraphics = translatePrimitives(definition.importedGraphics ?? [], -minX, -minY);
  definition.svgContent = drawingToSvg(definition.importedGraphics, { color: 'currentColor' });
  return { definition, origin: { x: -minX, y: -minY }, labels };
}

/** Property-placement subrecords are separate from the variant's physical pin list. */
export function propertyPositions(data: Uint8Array): Map<number, Point> {
  const result = new Map<number, Point>();
  for (let i = 0; i + 6 < data.length; i++) {
    if (data[i] !== 0x65 || data[i + 1] !== 0xea || data[i + 2] !== 0x35) continue;
    let end = i + 4;
    while (end + 3 < data.length && !(data[end] === 0x65 && data[end + 1] === 0xea)) end++;
    const r = new EodRecord(0, 0x35, 0, data.subarray(i, end + 3));
    const field = r.number(0xed63), point = r.point(0xec55);
    if (field && point && !result.has(field)) result.set(field, point);
  }
  return result;
}

/** Field widths observed in the two serialized groups of property-placement objects. */
const placementFieldWidths = new Map<number, number>([
  [0xea64, 2], [0xea67, 6], [0xebf4, 1], [0xebf6, 1], [0xebfb, 2],
  [0xec55, 16], [0xec56, 10], [0xec57, 2], [0xec59, 2],
  [0xee21, 8], [0xee22, 8], [0xee26, 1], [0xed63, 2], [0xed64, 2],
  [0xee17, 2], [0xee18, 1], [0xee19, 1], [0xee1a, 1], [0xfa00, 4], [0xfa01, 4]
]);

class PropertyPlacement extends EodRecord {
  constructor(data: Uint8Array, private fields: Map<number, number>) { super(0, 0x35, 0, data); }
  override find(tag: number, start = 0): number {
    const offset = this.fields.get(tag);
    return offset !== undefined && offset >= start ? offset : -1;
  }
}

/**
 * A placement has a base-text group and a property group, each terminated by
 * FFFF. Walk typed values, not byte matches inside float payloads. An unfinished
 * or unfamiliar object cannot borrow values from the following placement.
 */
export function completePropertyPlacements(data: Uint8Array): EodRecord[] {
  const result: EodRecord[] = [];
  for (let start = 0; start + 16 <= data.length; start++) {
    if (data[start] !== 0x65 || data[start + 1] !== 0xea || data[start + 2] !== 0x35 || data[start + 3] !== 0
      || data[start + 4] !== 0x64 || data[start + 5] !== 0xea
      || data[start + 8] !== 0x67 || data[start + 9] !== 0xea) continue;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let cursor = start + 4, groups = 0;
    const fields = new Map<number, number>([[0xea65, 0]]);
    while (cursor + 2 <= data.length) {
      const tag = view.getUint16(cursor, true);
      if (tag === 0xffff) {
        cursor += 2;
        if (++groups === 2) {
          result.push(new PropertyPlacement(data.subarray(start, cursor), fields));
          start = cursor - 1;
          break;
        }
        continue;
      }
      const width = placementFieldWidths.get(tag);
      if (width === undefined || cursor + 2 + width > data.length || fields.has(tag)) break;
      fields.set(tag, cursor - start);
      cursor += 2 + width;
    }
  }
  return result;
}

/** Pin designations remain editable instance strings; only their source layout is shared. */
export function sourcePinLabelPositions(data: Uint8Array, pins: PinDefinition[],
  layers: ReadonlyMap<number, NativeLayerStyle>, diagnostic?: (message: string) => void): PinDefinition[] {
  const placements = completePropertyPlacements(data).filter(r => [20028, 20036].includes(r.number(0xed63) ?? -1)
    && r.number(0xea67) === 0x2d);
  return pins.map(pin => {
    const index = Number(pin.id) + 1;
    const unresolved = (reason: string) => { diagnostic?.(`Anschlussbeschriftung ${index}: ${reason}`); return pin; };
    // The supplied project prints the horizontal designation arrangement.
    // The vertical EE19=1 object is an alternative, not a second label.
    const placement = placements.find(r => (r.number(0xed63) === 20036
      ? pins.length === 1 && r.number(0xee18, 1) === 1 && r.number(0xee26, 1) === 2
      : r.number(0xed64) === index)
      && r.number(0xee19, 1) === 2);
    if (!placement) return pin;
    const point = placement.point(0xec55);
    if (!point) return pin;
    const layer = layers.get(placement.number(0xebfb) ?? -1);
    const explicitSize = placement.double(0xee21);
    if (placement.find(0xee21) >= 0 && explicitSize === undefined) return pin;
    const size = explicitSize ?? layer?.fontSize;
    if (size === undefined || size <= 0 || size >= 1000)
      return unresolved(`Textgröße der Quellebene ${placement.number(0xebfb) ?? '?'} fehlt oder ist ungültig.`);
    const dcp = placement.number(0xed63) === 20036;
    const explicitAngle = placement.double(0xee22);
    if (placement.find(0xee22) >= 0 && explicitAngle === undefined) return pin;
    // -16002 is the native CAD automatic/unset text-angle sentinel, not radians.
    const angle = dcp ? (explicitAngle === -16002 ? 0 : explicitAngle ?? 0)
      : explicitAngle === -16002 ? layer?.angle ?? 0 : explicitAngle ?? layer?.angle ?? 0;
    const degrees = -angle * 180 / Math.PI;
    const quarterTurns = Math.round(degrees / 90);
    if (Math.abs(degrees - quarterTurns * 90) > 1e-6) return unresolved('Textwinkel wird noch nicht unterstützt.');
    const alignment = placement.number(0xec57);
    // The sample's horizontal labels use bottom-left (20) and top-left (4).
    // DCP arrangement 1/EE26=2 defaults to centered top alignment.
    // Other source alignments are deliberately not guessed.
    if (alignment !== 4 && alignment !== 20 && !(dcp && alignment === undefined)) return unresolved(`Textausrichtung ${alignment ?? '?'} wird noch nicht unterstützt.`);
    // native CAD specifies nominal text height, while the PDF uses Tahoma em size.
    // Both 1.8 mm pin labels (6.33713 pt) and 2.5 mm BMKs (8.80157 pt)
    // in the supplied export verify the same 1.242 conversion.
    const fontSize = size * NATIVE_SCALE * 1.242;
    // Source insertion points anchor the native CAD text box. Convert its verified
    // top/bottom alignment to the baseline used by the SVG/PDF renderers.
    const baseline = fontSize * (dcp && alignment === undefined ? 1.001139 : alignment === 20 ? -0.12753948 : 1.08014513);
    const radians = quarterTurns * Math.PI / 2;
    return { ...pin, labelPosition: { x: (dcp ? 0 : pin.x) + point.x * NATIVE_SCALE - Math.sin(radians) * baseline,
      y: (dcp ? 0 : pin.y) - point.y * NATIVE_SCALE + Math.cos(radians) * baseline,
      fontSize, alignment: dcp && alignment === undefined ? 'middle' : 'start', rotation: (((quarterTurns % 4) + 4) % 4 * 90) as 0 | 90 | 180 | 270,
      ...(layer?.visible !== undefined ? { visible: layer.visible } : {}) } };
  });
}

export function labelPosition(entry: LibraryEntry, field: number, override?: Map<number, Point>): TextFormatConfig {
  const p = override?.get(field) ?? entry.labels.get(field);
  if (!p) return { visible: field === 20010 };
  const d = entry.definition;
  const base = field === 20010 ? { x: d.width / 2, y: -8 }
    : { x: d.width / 2, y: d.height + (field === 20011 ? 12 : field===20025 ? 34 : 22) };
  return { preset: 'custom', offsetX: entry.origin.x + p.x * NATIVE_SCALE - base.x,
    offsetY: entry.origin.y - p.y * NATIVE_SCALE - base.y, alignment: 'start', fontSize: field === 20010 ? 7 : 6, visible: true };
}

/** Embedded master data, indexed by the project setting and original symbol numbers. */
export class NativeSymbolLibrary {
  private entries = new Map<string, LibraryEntry>();
  private names: string[];
  readonly diagnostics: string[] = [];
  readonly definitions: SymbolDefinition[] = [];
  private constructor(private zip: JSZip, private root: string, names: string[],
    readonly layers: ReadonlyMap<number, NativeLayerStyle>) { this.names = names; }

  static async create(zip: JSZip, root: string): Promise<NativeSymbolLibrary> {
    const setting = zip.file(`${root}Settings.xdb/Setting.eod`);
    if (!setting) throw new Error('Bibliotheksverzeichnis Settings.xdb/Setting.eod fehlt.');
    const data = await setting.async('uint8array');
    const key = new TextEncoder().encode('TrDMProject.EmbeddedMasterDataLibraries.SymbolLibs');
    let start = -1;
    outer: for (let i = 0; i <= data.length - key.length; i++) {
      for (let j = 0; j < key.length; j++) if (data[i + j] !== key[j]) continue outer;
      start = i + key.length; break;
    }
    if (start < 0) throw new Error('Keine Zuordnung der eingebetteten Symbolbibliotheken gefunden.');
    let names: string[] | undefined;
    for (let i = start; i + 11 < Math.min(data.length, start + 1024); i++) {
      if (data[i] !== 0x95 || data[i + 1] !== 3 || data[i + 2] !== 0x92) continue;
      const v = new DataView(data.buffer, data.byteOffset + i + 3, 8);
      const length = v.getUint32(0, true), count = v.getUint32(4, true);
      if (length < 4 || count > 1024 || i + 7 + length > data.length) continue;
      names = new TextDecoder().decode(data.subarray(i + 11, i + 7 + length)).split('\0').slice(0, count); break;
    }
    if (!names) throw new Error('Die Bibliothekszuordnung ist nicht lesbar.');
    return new NativeSymbolLibrary(zip, root, names, await readNativeLayers(zip, root));
  }

  private loaded = new Set<number>();
  async prepare(records: EodRecord[]): Promise<void> {
    const requested = new Set(records.filter(r => r.symbol !== undefined).map(r => `${r.number(0xef4d) ?? 0}:${r.symbol}:${r.variant}`));
    const indexes = new Set(records.filter(r => r.symbol !== undefined).map(r => r.number(0xef4d) ?? 0));
    // Keep the archive's data buffers bounded: each library is released before the next.
    for (const index of indexes) await this.load(index, requested);
  }

  private async load(index: number, requested: Set<string>): Promise<void> {
    if (this.loaded.has(index)) return;
    this.loaded.add(index);
    const library = this.names[index];
    if (!library) { this.diagnostics.push(`Symbolbibliothek mit Index ${index} fehlt.`); return; }
    const table = async (name: string, size: number): Promise<EodRecord[]> => {
      const path = `${this.root}${library}.sdb/${name}`;
      const data = this.zip.file(`${path}.eod`), ix = this.zip.file(`${path}.eox`);
      if (!data || !ix) throw new Error(`Eingebettete Symbolbibliothek unvollständig: ${path}`);
      return readIndexedEodRecords(await data.async('uint8array'), await ix.async('uint8array'), { size, typedIndex: false }, name);
    };
    const [symbols, variants, instances] = await Promise.all([table('Symbol', 901), table('Variant', 635), table('Instance', 134)]);
    const symbolsById = new Map(symbols.map(s => [s.id, s]));
    const shapes = new Map<number, EodRecord[]>();
    for (const instance of instances) {
      if (instance.number(0xebf1) !== 0x2d) continue;
      const id = instance.number(0xebf1, 4, 4)!;
      if (!shapes.has(id)) shapes.set(id, []);
      shapes.get(id)!.push(instance);
    }
    for (const variant of variants) {
      const symbol = symbolsById.get(variant.number(0xed95, 4, 4)!);
      if (!symbol) continue;
      const number = symbol.number(0xeb52) ?? 0, variantIndex = variant.number(0xed96, 1) ?? 0;
      if (!requested.has(`${index}:${number}:${variantIndex}`)) continue;
      const pins: PinDefinition[] = [];
      const propertyStart = variant.find(0xea65), pinData = propertyStart >= 0 ? variant.data.subarray(0, propertyStart) : variant.data;
      const header = new EodRecord(0, 0, 0, pinData);
      for (let i = header.find(0xed97); i >= 0; i = header.find(0xed97, i + 2)) {
        let end = i + 2;
        while (end + 1 < pinData.length && !(pinData[end] === 255 && pinData[end + 1] === 255)) end++;
        const pin = new EodRecord(0, 0, 0, pinData.subarray(i, end));
        const index = pin.number(0xedbd) ?? 0, p = pin.point(0xedbe) ?? zero;
        pins.push({ id: String(index), name: String(index + 1), x: p.x * NATIVE_SCALE, y: -p.y * NATIVE_SCALE,
          direction: direction[pin.number(0xedbf, 1) ?? 1] ?? 'top' });
      }
      const name = symbol.string(0xeb51) || String(number);
      const description = nativeText(symbol.string(0xeb53));
      const functionClass = symbol.number(0xefc5);
      const definition: SymbolDefinition = {
        id: `native:${library}:${number}:${variantIndex}`, name: `${library==='SPECIAL'&&[0,1].includes(number)&&!pins.length?'Gerätekasten · ':''}${library} / ${name} [${number}:${variantIndex}]`,
        category: functionClass === 100 || functionClass === 1302 ? 'terminals' : functionClass === 1303 ? 'controls'
          : functionClass === 200 ? 'relays' : library === 'SPECIAL' && [0,1].includes(number) ? 'structure' : library === 'SPECIAL' ? 'connections' : /^F/.test(name) ? 'protection' : /^K/.test(name) ? 'relays'
          : /^X/.test(name) ? 'terminals' : 'controls',
        deviceBox:library==='SPECIAL'&&[0,1].includes(number)&&!pins.length || undefined,
        annotationKind: library === 'SPECIAL' && number === 4 ? 'cable' : library === 'SPECIAL' && number === 311 ? 'cable_core' : undefined,
        standard: 'DIN EN 60617', defaultBmkPrefix: '', defaultFunctionText: '',
        width: 1, height: 1, unitsPerMm: NATIVE_SCALE, pins: sourcePinLabelPositions(variant.data, pins, this.layers,
          message => this.diagnostics.push(`${library}/${number}:${variantIndex}: ${message}`)), svgContent: '', description: description || `${library}: ${name}`,
        importedGraphics: (shapes.get(variant.id) ?? []).flatMap(r => nativePrimitives(r, this.layers)), source: { library, number, variant: variantIndex },
        isMaster: functionClass === 200 || undefined,
        isContact: functionClass === 201 || functionClass === 202 || undefined,
        contactType: functionClass === 202 ? 'NC' : functionClass === 201 ? (symbol.number(0xefc7) === 3 ? 'PowerNO' : 'NO') : undefined
      };
      const entry = normalizeDefinition(definition, propertyPositions(variant.data));
      entry.variantData = variant.data;
      this.entries.set(`${index}:${number}:${variantIndex}`, entry);
    }
  }

  resolve(record: EodRecord): LibraryEntry | undefined {
    const key = `${record.number(0xef4d) ?? 0}:${record.symbol ?? 0}:${record.variant}`;
    return this.entries.get(key);
  }

  use(entry: LibraryEntry): void {
    if (!this.definitions.some(d => d.id === entry.definition.id)) this.definitions.push(entry.definition);
  }
}
