import { geometryFromSymbol } from './DeviceBoxElement';
import type { PlacedComponent, SymbolDefinition, TextFormatConfig } from './types';
import nativeSymbols from './NativeMacroSymbols.json';
import { drawingToSvg } from './ImportedDrawing';
import { positionAtInsertionPoint, scaleSymbolDefinition } from './SymbolGeometry';

export const xmlChildren = (node: Element): Element[] => Array.from(node.childNodes)
  .filter((child): child is Element => child.nodeType === 1);
export const xmlTag = (node: Element) => node.localName || node.tagName;
export function xmlPoint(node: Element, attribute: string, units: number) {
  const parts = (node.getAttribute(attribute) ?? '').split('/');
  if (parts.length !== 2 || parts.some(p => !p.trim() || !Number.isFinite(Number(p)) || Math.abs(Number(p)) > 10000))
    throw new Error(`Ungültige Koordinate im Makro (${attribute}).`);
  return { x: Number(parts[0]) * units, y: -Number(parts[1]) * units };
}

/** Resolve original library/number/variant identities, never the device name.
 * Project master data wins over the bundled standard master data. */
export function nativeXmlSymbol(node: Element, variant: Element, available: readonly SymbolDefinition[], units: number) {
  const lookup = xmlChildren(variant).find(n => xmlTag(n) === 'ESymLib' && n.getAttribute('ID') === node.getAttribute('A1261'));
  const library = lookup?.getAttribute('Name'), number = Number(node.getAttribute('A1262')), v = Number(node.getAttribute('A1263'));
  const matches = (s: SymbolDefinition) =>
    library && s.source && s.source.library === library && s.source.number === number && s.source.variant === v;
  const standard = (nativeSymbols as SymbolDefinition[]).find(matches);
  const master = available.find(matches) ?? standard;
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
  const angle = Math.round(Math.atan2(-m[1], m[0]) * 2 / Math.PI), radians = -angle * Math.PI / 2;
  const expected = [Math.cos(radians), Math.sin(radians), -Math.sin(radians), Math.cos(radians)];
  if (m.some((n, i) => !Number.isFinite(n) || Math.abs(n - expected[i]) > 1e-6))
    throw new Error('Diese Symbolspiegelung oder Skalierung wird noch nicht unterstützt.');
  const rotation = (((angle % 4 + 4) % 4) * 90) as PlacedComponent['rotation'];
  // A variable device box owns local bounds; the enormous sentinel values on
  // ordinary symbols mean "no override" and must not become a giant contour.
  if (!symbol.pins.length && library === 'SPECIAL' && [0,1].includes(number)) {
    const inline = children.find(n => xmlTag(n) === 'S89x5');
    const a = xmlPoint(inline ?? node, inline ? 'A1651' : 'A190', units);
    const b = xmlPoint(inline ?? node, inline ? 'A1652' : 'A191', units);
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    symbol = { ...symbol,deviceBox:true,category:'structure', id: `${symbol.id}:size:${a.x},${a.y},${b.x},${b.y}`, width: Math.abs(b.x - a.x),
      height: Math.abs(b.y - a.y), insertionPoint: { x: -x || 0, y: -y || 0 },
      importedGraphics: [{ kind: 'rect', x: 0, y: 0, width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y), color: 'currentColor', lineWidth: .25 * units }] };
  }
  if (xmlTag(node) === 'O42') symbol.connectionGraphic = true;
  if (symbol.importedGraphics) symbol.svgContent = drawingToSvg(symbol.importedGraphics);
  const own = children.find(n => xmlTag(n) === 'P144'), properties = children.find(n => xmlTag(n) === 'P11');
  const text = (key: string) => (properties?.getAttribute(key) || '').replace(/(?:^|;)[a-z?]{2}_[A-Z?]{2}@/g, '').replace(/;$/, '');
  const bmk = ['P20013', 'P20014', 'P20015'].map(p => own?.getAttribute(p) ?? '').join('');
  const labels = node.hasAttribute('A185') ? node.getAttribute('A185')!.split(';') : undefined;
  const component: PlacedComponent = { id: crypto.randomUUID(), symbolId: symbol.id, bmk: bmk ? '-' + bmk : '',
    ...(symbol.deviceBox?{deviceBox:geometryFromSymbol(symbol)}:{}),
    functionText: text('P20011'), technicalCharacteristics: text('P20027'), additionalText: text('P20025'), deviceTag: text('P20030'),
    articleNumber: text('P20100_1'), ...positionAtInsertionPoint(point, symbol, rotation), rotation,
    pins: Object.fromEntries(symbol.pins.map((pin, i) => [pin.id, { customLabel: labels?.[i] ?? pin.name, wireIds: [] }])) };
  const origin = symbol.insertionPoint ?? { x: 0, y: 0 };
  const config = (field: number, baseY: number): TextFormatConfig | undefined => {
    const n = children.find(n => xmlTag(n) === 'S53x5' && n.getAttribute('A771') === String(field));
    if (!n || !n.hasAttribute('A501')) return undefined;
    const p = xmlPoint(n, 'A501', units), size = 2.5 * 1.242 * units;
    const alignment = Number(n.getAttribute('A503'));
    return { preset: 'custom', offsetX: origin.x + p.x - symbol.width / 2,
      offsetY: origin.y + p.y - baseY + (alignment === 4 ? size * 1.08014513 : 0), fontSize: size,
      alignment: 'start', visible: true };
  };
  component.bmkPosition = config(20010, -8);
  component.functionTextPosition = config(20011, symbol.height + 12);
  component.additionalTextPosition = config(20025, symbol.height + 34);
  component.technicalDataPosition = config(20027, symbol.height + 22);
  return { symbol, component };
}
