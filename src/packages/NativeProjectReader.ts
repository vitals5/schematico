import { readNativeGroups } from './NativeGroups';
import { geometryFromSymbol } from '../model/DeviceBoxElement';
import { nativeCableKind, readNativeCables, bindImportedCableCores } from './NativeCables';
import JSZip from 'jszip';
import { readNativePlotFrame } from './NativePlotFrame';
import { readNativeCoverPage } from './NativeCoverPage';
import type { CoverPageTemplate } from '../model/CoverPage';
import { nativePageText } from './NativeText';
import { nativePinLabelOverrides } from './NativePinLabelOverrides';
import { readNativePageImages } from './NativeImages';
import { nativePropertyLayouts } from './NativePropertyLayout';
import { PlotFrameTemplate } from '../model/PlotFrame';
import { DrawingPrimitive, Page, PageImage, PinDefinition, PlacedComponent, Project, SymbolDefinition, Wire } from '../model/types';
import { NativePort, physicalConnections } from './NativePhysicalConnections';
import { EodRecord, nativeText, readEodTable, EOD_LAYOUTS } from './EodReader';
import { NativeSymbolLibrary, NATIVE_SCALE as SCALE, LibraryEntry, Point,
  nativePrimitives, labelPosition, normalizeDefinition, propertyPositions, translatePrimitives } from './NativeSymbolLibrary';

const canvas = (p: Point): Point => ({ x: p.x * SCALE, y: (297 - p.y) * SCALE });
const identity = (r: EodRecord) => `${r.type}:${r.id}`;
type Endpoint = { point: Point; direction: PinDefinition['direction'] };
type Tables = Record<keyof typeof EOD_LAYOUTS, EodRecord[]>;

/** Page-independent importer: source placements reference the embedded master data. */
export class NativeProjectReader {
  readonly messages: string[] = [];
  private plotFrameTemplate?: PlotFrameTemplate;
  private coverPageTemplate?: CoverPageTemplate;
  private graphics = new Map<string, LibraryEntry>();
  private images = new Map<number, PageImage[]>();
  private recordsByPage = new Map<number, EodRecord[]>();
  private connectionsByPage = new Map<number, EodRecord[]>();
  get pages() {
    return this.tables.Page.filter(r => r.string(0x2b04, 4)).map(r => ({
      pageId: r.id, pageNumber: r.string(0x2b04, 4), title: nativeText(r.string(0x2b03, 4)),
      pageType:this.coverPageTemplate && r.string(0x2b07,4)===this.coverPageTemplate.name?'cover' as const:undefined,
      higherLevel: r.string(0x044c, 4), location: r.string(0x04b0, 4)
    })).sort((a, b) => {
      const rank = (location: string) => location === 'EAA' ? 0 : /^(TERM_|PLG_)/.test(location) ? 2 : 1;
      return rank(a.location) - rank(b.location) || a.pageNumber.localeCompare(b.pageNumber, 'de', { numeric: true });
    });
  }
  private constructor(private tables: Tables, readonly library: NativeSymbolLibrary) {
    const objects = [...tables.Function, ...tables.IPoint, ...tables.Potential, ...tables.Instance];
    const byIdentity = new Map(objects.map(r => [identity(r), r]));
    const pageOf = (r: EodRecord, seen = new Set<string>()): number | undefined => {
      if (r.pageId) return r.pageId;
      const key = identity(r);
      if (seen.has(key)) return;
      seen.add(key);
      const parentType = r.number(0xebf1), parentId = r.number(0xebf1, 4, 4);
      if (parentType === 4) return parentId;
      const parent = byIdentity.get(`${parentType}:${parentId}`);
      return parent ? pageOf(parent, seen) : undefined;
    };
    for (const r of objects) {
      const page = pageOf(r);
      if (!page) continue;
      if (!this.recordsByPage.has(page)) this.recordsByPage.set(page, []);
      this.recordsByPage.get(page)!.push(r);
    }
    for (const r of tables.Connection) {
      const page = r.pageId;
      if (!page) continue;
      if (!this.connectionsByPage.has(page)) this.connectionsByPage.set(page, []);
      this.connectionsByPage.get(page)!.push(r);
    }
  }

  finalize(project: Project): void {
    if (this.plotFrameTemplate) project.plotFrameTemplate = this.plotFrameTemplate;
    if (this.coverPageTemplate) project.coverPageTemplate = this.coverPageTemplate;
    for (const page of project.pages) bindImportedCableCores(page,project);
    const components = new Map(project.pages.flatMap(p => p.components).filter(c => c.source)
      .map(c => [`${c.source!.objectType}:${c.source!.objectId}`, c]));
    project.logicalConnections = [];
    for (const r of this.tables.Connection) {
      const from = components.get(`${r.number(0xeb2b)}:${r.number(0xeb2b, 4, 4)}`);
      const to = components.get(`${r.number(0xeb2e)}:${r.number(0xeb2e, 4, 4)}`);
      const fromPin = String(r.number(0xeb2c) ?? 0), toPin = String(r.number(0xeb2f) ?? 0);
      if (!from?.pins[fromPin] || !to?.pins[toPin]) {
        this.messages.push(`Logische Verbindung ${r.id}: Anschluss nicht auflösbar.`); continue;
      }
      project.logicalConnections.push({ id: `native_logical_${r.id}`,
        from: { componentId: from.id, pinId: fromPin }, to: { componentId: to.id, pinId: toPin },
        potential: 'Signal', color: r.string(0x791c, 4) || undefined, crossSection: r.string(0x791a, 4) || undefined });
    }
    this.messages.push(`${project.logicalConnections.length} elektrische Quellverbindungen separat von den sichtbaren Leitungsabschnitten übernommen.`);
  }

  static async create(zip: JSZip, root: string): Promise<NativeProjectReader | undefined> {
    const tables = {} as Tables;
    for (const name of Object.keys(EOD_LAYOUTS) as (keyof Tables)[]) {
      const data = zip.file(`${root}${name}.eod`), index = zip.file(`${root}${name}.eox`);
      if (!data || !index) return;
      const bytes = await data.async('uint8array');
      if (bytes.length % EOD_LAYOUTS[name].size !== 0) return;
      tables[name] = readEodTable(bytes, await index.async('uint8array'), name);
    }
    const library = await NativeSymbolLibrary.create(zip, root);
    await library.prepare([...tables.Function, ...tables.IPoint, ...tables.Potential, ...tables.Instance]);
    const importer = new NativeProjectReader(tables, library);
    importer.images = await readNativePageImages(zip, root,
      [...tables.Instance, ...tables.Function, ...tables.IPoint, ...tables.Potential], message => importer.messages.push(message));
    importer.plotFrameTemplate = await readNativePlotFrame(zip, root, tables.Instance, library);
    importer.coverPageTemplate = await readNativeCoverPage(zip, root, tables.Instance, library);
    importer.messages.push(...library.diagnostics);
    return importer;
  }

  private graphicEntry(graphics: DrawingPrimitive[], name: string): LibraryEntry {
    const key = JSON.stringify(graphics);
    let entry = this.graphics.get(key);
    if (entry) return entry;
    // FNV identity is an app-generated graphic resource, not an NATIVE symbol number.
    let hash = 2166136261;
    for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
    const base = `native:graphic:${(hash >>> 0).toString(16)}`;
    let id = base, suffix = 0;
    while (this.library.definitions.some(d => d.id === id)) id = `${base}:${++suffix}`;
    const definition: SymbolDefinition = { id, name, category: 'controls', standard: 'DIN EN 60617',
      defaultBmkPrefix: '', defaultFunctionText: '', width: 1, height: 1, unitsPerMm: SCALE, pins: [], svgContent: '',
      description: 'Freies Grafikobjekt aus den Projektdaten', importedGraphics: graphics };
    entry = normalizeDefinition(definition);
    this.graphics.set(key, entry);
    this.library.use(entry);
    return entry;
  }

  private sizedEntry(entry: LibraryEntry, record: EodRecord): LibraryEntry {
    const a = record.point(record.type === 0x58 ? 0xf0bf : 0xeb1e);
    const b = record.point(record.type === 0x58 ? 0xf0c0 : 0xeb1f);
    if (!a || !b || entry.definition.pins.length) return entry;
    const box = { kind: 'rect' as const, x: Math.min(a.x, b.x) * SCALE, y: -Math.max(a.y, b.y) * SCALE,
      width: Math.abs(b.x - a.x) * SCALE, height: Math.abs(b.y - a.y) * SCALE,
      color: 'currentColor', lineWidth: (this.library.layers.get(305)?.lineWidth ?? 0.25) * SCALE,
      ...(record.type === 0x58 ? { dash: [6, 2, 1, 2] } : {}) };
    let inline = record.find(0xea65);
    while (inline >= 0 && new EodRecord(0, 0, 0, record.data.subarray(inline)).number(0xea65) !== 0x59)
      inline = record.find(0xea65, inline + 2);
    const nativeBox = inline >= 0
      ? nativePrimitives(new EodRecord(record.id, 0x59, record.row, record.data.subarray(inline)), this.library.layers) : [];
    const graphics = nativeBox.length ? nativeBox : [box];
    const key = `${entry.definition.id}:${JSON.stringify(graphics)}`;
    let sized = this.graphics.get(key);
    if (!sized) {
      sized = normalizeDefinition({ ...entry.definition, id: `${entry.definition.id}:size:${a.x},${a.y},${b.x},${b.y}`,
        name: `${entry.definition.name} (${Math.abs(b.x - a.x)} × ${Math.abs(b.y - a.y)} mm)`,
        pins: [], importedGraphics: graphics }, entry.labels);
      sized.variantData = entry.variantData;
      this.graphics.set(key, sized);
    }
    return sized;
  }

  importPage(pageId: number, page: Page, pageNumbers: Map<number, string>): void {
    const records = this.recordsByPage.get(pageId) ?? [];
    page.images = this.images.get(pageId) ?? [];
    const connections = this.connectionsByPage.get(pageId) ?? [];
    const pageRecord = this.tables.Page.find(r => r.id === pageId);
    const stamp = pageRecord?.string(0x2b10, 4), editor = pageRecord?.string(0x2b0e, 4);
    if (stamp && /^\d+$/.test(stamp)) page.plotFrame.titleBlock.date = new Date(Number(stamp) * 1000).toISOString().slice(0, 10).split('-').reverse().join('.');
    if (editor) page.plotFrame.titleBlock.author = editor;
    const diagnostics: string[] = [], components: PlacedComponent[] = [];
    const objects = new Map<string, PlacedComponent>(), points = new Map<string, Endpoint>();
    const referenced = new Set(connections.flatMap(r => [`${r.number(0xeb2b)}:${r.number(0xeb2b, 4, 4)}`,
      `${r.number(0xeb2e)}:${r.number(0xeb2e, 4, 4)}`]));
    const add = (r: EodRecord, entry: LibraryEntry, position: Point): PlacedComponent => {
      // 1400 is the source function definition for an electrical distributor.
      // Its symbol can be superseded by a co-located graphical routing node.
      if ([0x2a, 0x82].includes(r.type) || r.type === 17 && r.number(0xefc5) === 1400)
        entry.definition.connectionGraphic = true;
      this.library.use(entry);
      const p = canvas(position), d = entry.definition;
      const pinLabels = r.pins;
      const functionText = nativeText(r.string(0x4e2b, 4) || r.string(0xeb1a));
      const comp: PlacedComponent = {
        id: `native_${pageId}_${r.type}_${r.id}`, symbolId: d.id,
        source: { format: 'NATIVE_CAD', objectType: r.type, objectId: r.id },
        ...(d.deviceBox?{deviceBox:geometryFromSymbol(d)}:{}),
        x: p.x - entry.origin.x, y: p.y - entry.origin.y, rotation: 0,
        bmk: r.bmk && r.type !== 0x46 ? '-' + r.bmk : '', functionText,
        technicalCharacteristics: nativeText(r.string(0x4e3b, 4)), deviceTag: r.string(0x4e3e, 4) || undefined,
        additionalText:nativeText(r.string(0x4e39,4)) || undefined,
        higherLevelFunction: page.higherLevel, mountingLocation: page.location,
        pins: Object.fromEntries(d.pins.map(pin => [pin.id, { customLabel: pinLabels[Number(pin.id)] ?? pin.name, wireIds: [] as string[] }]))
      };
      for (const [id, label] of nativePinLabelOverrides(r, d.pins, this.library.layers))
        comp.pins[id].labelPosition = { ...label, x: entry.origin.x + label.x, y: entry.origin.y + label.y };
      const overrides = propertyPositions(r.data);
      const nativeLayouts = entry.variantData ? nativePropertyLayouts(entry.variantData, r, this.library.layers) : new Map();
      const propertyLabel = (field: number) => {
        const layout = nativeLayouts.get(field);
        if (!layout || overrides.has(field)) return labelPosition(entry, field, overrides);
        const baseY = field === 20010 ? -8 : d.height + (field === 20011 ? 12 : field === 20025 ? 34 : 22);
        return { preset: 'custom' as const, offsetX: entry.origin.x + layout.point.x * SCALE - d.width / 2,
          offsetY: entry.origin.y - layout.point.y * SCALE - baseY,
          fontSize: layout.fontSize * SCALE, alignment: layout.alignment, rotation: layout.rotation, visible: true };
      };
      comp.bmkPosition = propertyLabel(20010);
      if (r.type === 17 && r.number(0xeb23, 4) === 3) comp.bmkPosition.visible = false;
      comp.functionTextPosition = propertyLabel(20011);
      comp.technicalDataPosition = propertyLabel(comp.deviceTag &&
        (nativeLayouts.has(20030) || overrides.has(20030)) ? 20030 : 20027);
      comp.additionalTextPosition = propertyLabel(20025);
      if (r.type === 0x46) {
        comp.functionText = r.string(0xee2c) + r.string(0xee2d) + (r.string(0xee2e) ? '.' + r.string(0xee2e) : '');
        const other = this.tables.IPoint.find(ip => ip.pageId !== pageId && ip.bmk === r.bmk && ip.position && ip.pageId && pageNumbers.has(ip.pageId));
        if (other) comp.crossRef = `/${pageNumbers.get(other.pageId!)}.${Math.floor(other.position!.x / 42)}`;
        comp.bmkPosition.visible = false;
        if (!comp.functionTextPosition.visible) comp.functionTextPosition = { preset: 'right', fontSize: 7, visible: true };
      }
      for (const pin of d.pins) {
        points.set(`${identity(r)}:${pin.id}`, { point: { x: position.x + (pin.x - entry.origin.x) / SCALE,
          y: position.y - (pin.y - entry.origin.y) / SCALE }, direction: pin.direction });
      }
      components.push(comp); objects.set(identity(r), comp);
      return comp;
    };
    const cableIds=new Set(records.filter(r=>nativeCableKind(r,this.library)==='cable').map(r=>r.id));
    for (const r of records) {
      const annotation=nativeCableKind(r,this.library);
      if (annotation==='cable' || annotation==='cable_core' && r.number(0xee67)===17 && cableIds.has(r.number(0xee67,4,4)!)) continue;
      if (r.symbol !== undefined) {
        const entry = this.library.resolve(r);
        if (!entry || !r.position) {
          diagnostics.push(`Objekt ${identity(r)}: ${!entry ? 'Bibliothekssymbol nicht auflösbar' : 'Platzierung fehlt'}.`);
          continue;
        }
        add(r, this.sizedEntry(entry, r), r.position);
      } else if ([0x1e,0x53].includes(r.type)) {
        const text=nativePageText(r,this.library.layers);
        if(!text)continue;
        const {position,text:value,fontSize:size,width,height,origin,config}=text;
        const key = `text:${size}:${width}:${height}:${origin.x}:${origin.y}`;
        let entry = this.graphics.get(key);
        if (!entry) {
          entry = { definition: { id: `native:annotation:${size}:${width}:${height}:${origin.x}:${origin.y}`, name: 'Projekttext',
            category: 'controls', standard: 'DIN EN 60617', defaultBmkPrefix: '', defaultFunctionText: '',
            width, height, unitsPerMm: SCALE, insertionPoint: origin,
            pins: [], svgContent: '', importedGraphics: [], description: 'Editierbarer Projekttext' },
            origin, labels: new Map() };
          this.graphics.set(key, entry);
        }
        const comp = add(r, entry, position);
        comp.functionText = value;
        comp.bmkPosition = { visible: false }; comp.technicalDataPosition = { visible: false };
        comp.functionTextPosition = config;
      } else {
        const graphics = nativePrimitives(r, this.library.layers);
        if (!graphics.length) continue;
        const first = graphics[0];
        const anchor = first.kind === 'line' ? { x: first.x1, y: first.y1 }
          : first.kind === 'polygon' ? first.points[0] : first;
        const entry = this.graphicEntry(translatePrimitives(graphics, -anchor.x, -anchor.y), 'Projektgrafik');
        const comp = add(r, entry, { x: anchor.x / SCALE, y: -anchor.y / SCALE });
        comp.bmk = ''; comp.functionText = '';
        comp.bmkPosition = { visible: false }; comp.functionTextPosition = { visible: false }; comp.technicalDataPosition = { visible: false };
      }
    }
    const netlist: Wire[] = [];
    const referencedPins = new Set<string>();
    for (const r of connections) {
      const fromKey = `${r.number(0xeb2b)}:${r.number(0xeb2b, 4, 4)}`, toKey = `${r.number(0xeb2e)}:${r.number(0xeb2e, 4, 4)}`;
      const fromPin = String(r.number(0xeb2c) ?? 0), toPin = String(r.number(0xeb2f) ?? 0);
      const from = objects.get(fromKey), to = objects.get(toKey);
      if (!from?.pins[fromPin] || !to?.pins[toPin]) {
        diagnostics.push(`Verbindung ${r.id}: Bibliotheksanschluss fehlt.`); continue;
      }
      referencedPins.add(`${fromKey}:${fromPin}`); referencedPins.add(`${toKey}:${toPin}`);
      netlist.push({ id: `native_net_${r.id}`, from: { componentId: from.id, pinId: fromPin },
        to: { componentId: to.id, pinId: toPin }, potential: 'Signal',
        color: r.string(0x791c, 4) || undefined, crossSection: r.string(0x791a, 4) || undefined });
    }
    const definitions = new Map(this.library.definitions.map(d => [d.id, d]));
    const routing = records.filter(r => r.type === 0x2a && objects.has(identity(r)));
    const atSameAnchor = (a: EodRecord, b: EodRecord) => a.position && b.position
      && Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y) < 1e-6;
    const directions = (r: EodRecord) => definitions.get(objects.get(identity(r))!.symbolId)!.pins.map(p => p.direction).sort().join(',');
    const sameDevice = (a: EodRecord, b: EodRecord) => a.bmk === b.bmk
      && (a.string(0x044c, 4) || page.higherLevel) === (b.string(0x044c, 4) || page.higherLevel)
      && (a.string(0x04b0, 4) || page.location) === (b.string(0x04b0, 4) || page.location);
    const ports: NativePort[] = [];
    for (const r of records) {
      const comp = objects.get(identity(r));
      if (!comp) continue;
      const definition = definitions.get(comp.symbolId)!;
      // A functional distributor may have an explicit directional glyph in the
      // source at the same anchor. Its duplicate ports must not create edges.
      if (r.type === 17 && r.number(0xefc5) === 1400 && routing.some(n => atSameAnchor(r, n) && directions(r) === directions(n))) continue;
      // An unconnected illustration inside a device box is not an additional
      // external device. Its separate DCP functions carry the actual terminals.
      const illustration = r.type === 17 && !referenced.has(identity(r)) && r.pins.length > 0 && r.pins.every(p => !p)
        && records.some(other => other.type === 17 && sameDevice(other, r) && other.number(0xefc5) === 1302)
        && records.some(other => other.type === 17 && sameDevice(other, r) && other.number(0xefc5) === 1303);
      if (illustration) continue;
      for (const pin of definition.pins) {
        const key = `${identity(r)}:${pin.id}`, endpoint = points.get(key);
        if (!endpoint) continue;
        // Both coincident interruption-point pins are valid in the format.
        // When a source edge selects one, do not infer an extra opposite side.
        if (r.type === 0x46 && referenced.has(identity(r)) && !referencedPins.has(key)) continue;
        const label = (comp.pins[pin.id].customLabel ?? pin.name).toUpperCase();
        const potential = (['PE', 'PEN', 'N', 'L1', 'L2', 'L3'] as Wire['potential'][]).find(p => p === label);
        ports.push({ key, endpoint: { componentId: comp.id, pinId: pin.id }, ...endpoint,
          // Composite bundle (type 130) ink crosses separate conductors.
          // Its graphical bus must never short the represented poles together.
          ...(definition.connectionGraphic && r.type !== 0x82 ? { junction: comp.id } : {}),
          routing: r.type === 0x2a, potential });
      }
    }
    const wires = physicalConnections(ports, netlist, pageId, (this.library.layers.get(311)?.lineWidth ?? 0.25) * SCALE);
    for (const wire of wires) for (const ep of [wire.from, wire.to])
      components.find(c => c.id === ep.componentId)!.pins[ep.pinId].wireIds!.push(wire.id);
    for (const r of routing) {
      const comp = objects.get(identity(r))!;
      comp.source!.routingUsed = wires.some(w => w.from.componentId === comp.id || w.to.componentId === comp.id);
    }
    for (const key of referenced) if (!objects.has(key)) diagnostics.push(`Referenziertes Objekt ${key} fehlt.`);
    const partial = records.filter(r => r.partial);
    if (partial.length) diagnostics.push(`${partial.length} Datensätze haben nur einen lesbaren Datenpräfix; unvollständige Eigenschaften sind nicht validiert.`);
    const byId = new Map(this.library.definitions.map(d => [d.id, d]));
    const drawingOrder = (c: PlacedComponent) => {
      const d = byId.get(c.symbolId)!;
      return c.symbolId.startsWith('native:graphic:') ? 0 : d.source?.library === 'SPECIAL' && [0, 2].includes(d.source.number) ? 1
        : c.symbolId.startsWith('native:annotation:') ? 3 : 2;
    };
    components.sort((a, b) => drawingOrder(a) - drawingOrder(b));
    page.components = components; page.wires = wires;
    page.cables = readNativeCables(records,page,this.library,diagnostics); page.texts = []; page.boxes = [];
    readNativeGroups(page,records);
    page.plotFrame.height = 297 * SCALE;
    page.grid = { spacing: 4 * SCALE, origin: { x: 0, y: page.plotFrame.height } };
    page.connectionMode = 'explicit';
    page.importDiagnostics = diagnostics;
    delete page.importedDrawing;
  }
}
