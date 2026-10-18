import { isNativeExchangeRoot } from './LegacyCompatibility';
import { pruneElementGroups } from './ElementGroups';
import { DOMParser } from '@xmldom/xmldom';
import type { WindowMacro } from './MacroManager';
import type { DrawingPrimitive, PlacedComponent, SymbolDefinition, Project, Wire, ElementGroup, Page } from './types';
import { drawingToSvg } from './ImportedDrawing';
import { nativeXmlSymbol, xmlChildren as children, xmlTag as tag, xmlPoint } from './NativeXmlSymbol';
import { AutoconnectEngine } from './AutoconnectEngine';
import { rotatedLocalPoint } from './SymbolGeometry';

type Point = { x: number; y: number };
type Shape = Extract<DrawingPrimitive, { kind: 'line' | 'rect' }>;

/** Native exchange XML stores grouped drawings as O26, lines as O31 and
 * rectangles as O89. Coordinates are physical millimetres with Y pointing up.
 * These are drawings, not electrical devices: never infer pins from a name. */
export function parseNativeXmlMacro(xml: string, filename: string, available: readonly SymbolDefinition[] = []): WindowMacro {
  const invalid = () => { throw new Error('Die Makrodatei enthält ungültiges XML.'); };
  if (/<!DOCTYPE\b/i.test(xml)) invalid();
  const doc = new DOMParser({ errorHandler: invalid }).parseFromString(xml, 'application/xml');
  const root = doc.documentElement;
  if (!root || !isNativeExchangeRoot(tag(root))) invalid();
  if (root.getAttribute('Type') !== 'WindowMacro')
    throw new Error('Dieser XML-Makrotyp wird noch nicht unterstützt.');
  const variants = children(root).filter(n => tag(n) === 'MacroVariant');
  // Variant A is the default; alternate representations must not be overlaid.
  const variant = variants.find(n => n.getAttribute('MacroFuncType') === '1' && n.getAttribute('VariantId') === '0')
    ?? variants.find(n => n.getAttribute('VariantId') === '0') ?? variants[0];
  if (!variant) throw new Error('Die Makrodatei enthält keine Variante.');
  const pages = children(variant).filter(n => tag(n) === 'O4');
  if (pages.length !== 1) throw new Error('Das XML-Makro muss genau einen Zeichenbereich enthalten.');
  const units = 2;
  const point = (node: Element, attribute: string): Point => xmlPoint(node, attribute, units);
  const shapes = (node: Element): Shape[] => {
    const kind = tag(node);
    if (kind === 'O26') return children(node).filter(n => !/^P\d+$/.test(tag(n))).flatMap(shapes);
    if (kind === 'O31') {
      const a = point(node, 'A531'), b = point(node, 'A532');
      return [{ kind: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: 'currentColor', width: .25 * units }];
    }
    if (kind === 'O89') {
      const a = point(node, 'A1651'), b = point(node, 'A1652');
      return [{ kind: 'rect', x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
        width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y), color: 'currentColor', lineWidth: .25 * units }];
    }
    throw new Error(`Das XML-Makro enthält einen noch nicht unterstützten Objekttyp (${kind}).`);
  };
  const groupNodes:Element[]=[];
  const objects = (node: Element): Element[] => {
    if(tag(node)!=='O26')return [node];
    groupNodes.push(node);return children(node).filter(n=>!/^P\d+$/.test(tag(n))).flatMap(objects);
  };
  const nodes = children(pages[0]).filter(n => !/^P\d+$/.test(tag(n))).flatMap(objects);
  // Macro definition frames are editor metadata, not printed drawing objects.
  const electrical = nodes.filter(n => ['O17', 'O42'].includes(tag(n)))
    .map(node => ({node,...nativeXmlSymbol(node, variant, available, units)}));
  const entries = nodes.filter(n => !['O17', 'O42', 'O37'].includes(tag(n))).map(node => ({node, graphics: shapes(node) }))
    .filter(entry => entry.graphics.length);
  if (!entries.length && !electrical.length) throw new Error('Die Makrodatei enthält keine unterstützten Grafikobjekte.');
  const bounds = (graphics: Shape[]) => {
    const points = graphics.flatMap(g => g.kind === 'line' ? [{ x: g.x1, y: g.y1 }, { x: g.x2, y: g.y2 }]
      : [{ x: g.x, y: g.y }, { x: g.x + g.width, y: g.y + g.height }]);
    const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y));
    return { x, y, width: Math.max(...points.map(p => p.x)) - x, height: Math.max(...points.map(p => p.y)) - y };
  };
  const total = bounds([...entries.flatMap(e => e.graphics), ...electrical.map(({ component: c, symbol: s }): Shape => {
    const points = [{ x: 0, y: 0 }, { x: s.width, y: 0 }, { x: 0, y: s.height }, { x: s.width, y: s.height }]
      .map(p => rotatedLocalPoint(p, s, c.rotation));
    const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y));
    return { kind: 'rect', x: c.x + x, y: c.y + y, width: Math.max(...points.map(p => p.x)) - x,
      height: Math.max(...points.map(p => p.y)) - y, color: 'currentColor' };
  })]);
  const reference = variant.hasAttribute('ReferencePoint') ? point(variant, 'ReferencePoint') : total;
  const handlePoint = { x: reference.x - total.x, y: reference.y - total.y };
  const id = `user_xml_${crypto.randomUUID()}`;
  const name = root.getAttribute('Name') || filename.replace(/\.[^.]+$/, '');
  const description = (variant.getAttribute('Description') || root.getAttribute('Description') || '')
    .replace(/(?:^|;)[a-z?]{2}_[A-Z?]{2}@/g, '').replace(/;$/, '');
  const symbolLibrary: SymbolDefinition[] = [], components: PlacedComponent[] = [],nodeComponents=new Map<Element,string>();
  for (const [index, entry] of entries.entries()) {
    const box = bounds(entry.graphics);
    const graphics = entry.graphics.map(g => g.kind === 'line'
      ? { ...g, x1: g.x1 - box.x, y1: g.y1 - box.y, x2: g.x2 - box.x, y2: g.y2 - box.y }
      : { ...g, x: g.x - box.x, y: g.y - box.y });
    const symbol: SymbolDefinition = { id: `macro:${id}:${index}`, name, category: 'controls', standard: 'DIN EN 60617',
      defaultBmkPrefix: '', defaultFunctionText: '', width: Math.max(1, box.width), height: Math.max(1, box.height),
      unitsPerMm: units, insertionPoint: { x: reference.x - box.x, y: reference.y - box.y },
      pins: [], importedGraphics: graphics, svgContent: drawingToSvg(graphics), description };
    symbolLibrary.push(symbol);
    const componentId=crypto.randomUUID();nodeComponents.set(entry.node,componentId);
    components.push({ id: componentId, symbolId: symbol.id, bmk: '', functionText: '',
      x: box.x - total.x, y: box.y - total.y, rotation: 0, pins: {} });
  }
  for (const { node, symbol, component } of electrical) {
    nodeComponents.set(node,component.id);
    if (!symbolLibrary.some(s => s.id === symbol.id)) symbolLibrary.push(symbol);
    component.x -= total.x; component.y -= total.y;
    components.push(component);
  }
  const context = { drawingUnitsPerMm: units, symbolLibrary } as Project;
  const wires: Wire[] = AutoconnectEngine.findAutoconnectPairs(components, 1e-6, .01, context).map(pair => ({
    id: crypto.randomUUID(), from: { componentId: pair.pin1.componentId, pinId: pair.pin1.pinId },
    to: { componentId: pair.pin2.componentId, pinId: pair.pin2.pinId }, potential: 'Signal', lineWidth: .25 * units
  }));
  for (const wire of wires) for (const end of [wire.from, wire.to]) components.find(c => c.id === end.componentId)!
    .pins[end.pinId].wireIds!.push(wire.id);
  const groupIds=new Map(groupNodes.map(n=>[n,'group_'+crypto.randomUUID()]));
  const groups:ElementGroup[]=groupNodes.map(node=>({id:groupIds.get(node)!,members:children(node).flatMap<ElementGroup['members'][number]>(child=>{
    const groupId=groupIds.get(child),componentId=nodeComponents.get(child);
    return groupId?[{kind:'group' as const,id:groupId}]:componentId?[{kind:'component' as const,id:componentId}]:[];
  })}));
  const groupPage={components,wires,groups}as Page;pruneElementGroups(groupPage);
  // The internal XML type takes precedence over a misleading .ems extension.
  return { id, name, type: 'ema', category: 'Importierte Grafikmakros', description, isBuiltIn: false,
    unitsPerMm: units, symbolLibrary, components, wires, groups:groupPage.groups, handlePoint,
    width: Math.max(1, total.width), height: Math.max(1, total.height) };
}
