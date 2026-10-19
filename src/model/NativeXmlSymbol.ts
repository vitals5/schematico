import { geometryFromSymbol } from './DeviceBoxElement';
import type { PlacedComponent, SymbolDefinition, TextFormatConfig } from './types';
import nativeSymbols from './NativeMacroSymbols.json';
import { drawingToSvg } from './ImportedDrawing';
import { positionAtInsertionPoint, scaleSymbolDefinition } from './SymbolGeometry';
import { nativeXmlText } from './NativeXmlText';

export const xmlChildren = (node: Element): Element[] => Array.from(node.childNodes)
  .filter((child): child is Element => child.nodeType === 1);
const legacyStructureTags:Record<string,string>={S1201:'S40x1201',S761:'S39x761',S505:'S54x505'};
export const xmlTag = (node: Element) => {
  const name=node.localName || node.tagName;
  return legacyStructureTags[name]??name;
};
export function xmlPoint(node: Element, attribute: string, units: number) {
  if (!node.hasAttribute(attribute)) return { x: 0, y: 0 };
  const parts = (node.getAttribute(attribute) ?? '').split('/');
  if (![2,3].includes(parts.length) || parts.some(p => !p.trim() || !Number.isFinite(Number(p)) || Math.abs(Number(p)) > 10000))
    throw new Error(`Ungültige Koordinate im Makro (${attribute}).`);
  if (parts.length === 3 && Number(parts[2]) !== 0)
    throw new Error(`Räumliche Koordinaten werden im 2D-Makro noch nicht unterstützt (${attribute}).`);
  return { x: Number(parts[0]) * units, y: -Number(parts[1]) * units };
}

/** Resolve original library/number/variant identities, never the device name.
 * Project master data wins over the bundled standard master data. */
export function nativeXmlSymbol(node: Element, variant: Element, available: readonly SymbolDefinition[], units: number,
  options: { allowMissing?: boolean; diagnostics?: string[] } = {}) {
  const lookup = xmlChildren(variant).find(n => xmlTag(n) === 'ESymLib' && n.getAttribute('ID') === node.getAttribute('A1261'));
  const library = lookup?.getAttribute('Name'), number = Number(node.getAttribute('A1262')), v = Number(node.getAttribute('A1263'));
  const matches = (s: SymbolDefinition) =>
    library && s.source && s.source.library === library && s.source.number === number && s.source.variant === v;
  const standard = (nativeSymbols as SymbolDefinition[]).find(matches);
  let master = available.find(matches) ?? standard;
  if (!master && options.allowMissing && library && Number.isInteger(number) && number >= 0 && Number.isInteger(v)) {
    options.diagnostics?.push(`Bibliothekssymbol fehlt: ${library} / ${number}:${v}. Als markiertes Objekt ohne erfundene Anschlüsse übernommen.`);
    master = { id: `unresolved:${library}:${number}:${v}`, name: `Symbol fehlt · ${library} / ${number}:${v}`,
      category: 'structure', standard: 'DIN EN 60617', defaultBmkPrefix: '', defaultFunctionText: '',
      width: 24, height: 16, unitsPerMm: units, insertionPoint: { x: 12, y: 8 }, pins: [], svgContent: '',
      source: { library, number, variant: v }, unresolved: true,
      description: `Benötigte Bibliothek: ${library}, Symbol ${number}, Variante ${v}`,
      importedGraphics: [{ kind: 'rect', x: 0, y: 0, width: 24, height: 16, color: 'currentColor', dash: [2,1] },
        { kind: 'text', x: 12, y: 10, text: '?', color: 'currentColor', size: 10, anchor: 'middle' }] };
  }
  if (!master) throw new Error(`Bibliothekssymbol nicht verfügbar: ${library || '?'} / ${number}:${v}.`);
  let symbol = structuredClone(scaleSymbolDefinition(master, units));
  if (standard) {
    const fallback = scaleSymbolDefinition(standard, units), origin = symbol.insertionPoint ?? { x: 0, y: 0 };
    const fallbackOrigin = fallback.insertionPoint ?? { x: 0, y: 0 };
    for (const pin of symbol.pins) {
      const label = fallback.pins.find(p => p.id === pin.id)?.labelPosition;
      if (!pin.labelPosition && label) pin.labelPosition = { ...label,
        x: label.x - fallbackOrigin.x + origin.x, y: label.y - fallbackOrigin.y + origin.y };
    }
  }
  const children = xmlChildren(node), placement = children.find(n => xmlTag(n) === 'S40x1201');
  if (!placement) throw new Error('Die Symbolplatzierung fehlt im Makro.');
  const point = xmlPoint(placement, 'A762', units);
  const matrix = xmlChildren(placement).find(n => xmlTag(n) === 'S39x761');
  const m = ['A751', 'A752', 'A753', 'A754'].map((a, i) => Number(matrix?.getAttribute(a) ?? (i % 3 === 0 ? 1 : 0)));
  const scale = Math.hypot(m[0], m[1]);
  const angle = Math.round(Math.atan2(-m[1], m[0]) * 2 / Math.PI), radians = -angle * Math.PI / 2;
  const expected = [Math.cos(radians), Math.sin(radians), -Math.sin(radians), Math.cos(radians)].map(n => n * scale);
  if (!(scale > 0)) throw new Error('Ungültiger Symbolmaßstab im Makro.');
  if (m.some((n, i) => !Number.isFinite(n) || Math.abs(n - expected[i]) > 1e-6))
    throw new Error('Diese Symbolspiegelung oder Skalierung wird noch nicht unterstützt.');
  const rotation = (((angle % 4 + 4) % 4) * 90) as PlacedComponent['rotation'];
  // A variable device box owns local bounds; the enormous sentinel values on
  // ordinary symbols mean "no override" and must not become a giant contour.
  if (!symbol.pins.length && library === 'SPECIAL' && ([0,1,2].includes(number) || xmlTag(node) === 'O241')) {
    const inline = children.find(n => xmlTag(n) === 'S89x5');
    const a = xmlPoint(inline ?? node, inline ? 'A1651' : xmlTag(node) === 'O88' ? 'A1631' : 'A190', units);
    const b = xmlPoint(inline ?? node, inline ? 'A1652' : xmlTag(node) === 'O88' ? 'A1632' : 'A191', units);
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    symbol = { ...symbol,deviceBox:true,category:'structure', id: `${symbol.id}:size:${a.x},${a.y},${b.x},${b.y}`, width: Math.abs(b.x - a.x),
      height: Math.abs(b.y - a.y), insertionPoint: { x: -x || 0, y: -y || 0 },
      importedGraphics: [{ kind: 'rect', x: 0, y: 0, width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y), color: 'currentColor', lineWidth: .25 * units }] };
  }
  if (Math.abs(scale - 1) > 1e-9) symbol = { ...scaleSymbolDefinition(symbol, units * scale), unitsPerMm: units,
    id: `${symbol.id}:scale:${scale}` };
  if (['O42', 'O70', 'O93', 'O231', 'O234'].includes(xmlTag(node))) symbol.connectionGraphic = true;
  if (symbol.importedGraphics) symbol.svgContent = drawingToSvg(symbol.importedGraphics);
  const own = children.find(n => xmlTag(n) === 'P144'), properties = children.find(n => xmlTag(n) === 'P11');
  const text = (key: string) => nativeXmlText(properties?.getAttribute(key) || '');
  const bmk = ['P20013', 'P20014', 'P20015'].map(p => own?.getAttribute(p) ?? '').join('');
  const labels = node.hasAttribute('A185') ? node.getAttribute('A185')!.split(';') : undefined;
  const interruption = xmlTag(node) === 'O70';
  const component: PlacedComponent = { id: crypto.randomUUID(), symbolId: symbol.id, bmk: bmk && !interruption ? '-' + bmk : '',
    nativeProperties: Object.fromEntries(children.filter(n=>/^P(?:11|144|150)$/.test(xmlTag(n)))
      .flatMap(n=>Array.from(n.attributes).map(a=>[a.name,a.value]))),
    ...(symbol.deviceBox?{deviceBox:geometryFromSymbol(symbol)}:{}),
    functionText: text('P20011') || (interruption ? bmk : xmlTag(node) === 'O88' ? nativeXmlText(own?.getAttribute('P1700') ?? '')
      : xmlTag(node) === 'O93' ? nativeXmlText(node.getAttribute('A1691') ?? text('P33000')) : ''),
    technicalCharacteristics: text('P20027'), additionalText: text('P20025'), deviceTag: text('P20030'),
    articleNumber: text('P20100_1'), ...positionAtInsertionPoint(point, symbol, rotation), rotation,
    pins: Object.fromEntries(symbol.pins.map((pin, i) => [pin.id, { customLabel: labels?.[i] ?? pin.name, wireIds: [] }])) };
  const origin = symbol.insertionPoint ?? { x: 0, y: 0 };
  const config = (field: number, baseY: number): TextFormatConfig | undefined => {
    const n = children.find(n => xmlTag(n) === 'S53x5' && n.getAttribute('A771') === String(field));
    if (!n || !n.hasAttribute('A501')) return undefined;
    const p = xmlPoint(n, 'A501', units * scale), size = 2.5 * 1.242 * units * scale;
    const alignment = Number(n.getAttribute('A503'));
    return { preset: 'custom', offsetX: origin.x + p.x - symbol.width / 2,
      offsetY: origin.y + p.y - baseY + (alignment === 4 ? size * 1.08014513 : 0), fontSize: size,
      alignment: 'start', visible: true };
  };
  component.bmkPosition = config(20010, -8);
  component.functionTextPosition = config(xmlTag(node) === 'O88' ? 20010 : xmlTag(node) === 'O93' ? -32536 : 20011, symbol.height + 12);
  component.additionalTextPosition = config(20025, symbol.height + 34);
  component.technicalDataPosition = config(20027, symbol.height + 22);
  return { symbol, component };
}
