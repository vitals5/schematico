import { componentFromBox, deviceBoxDefinition } from './DeviceBoxElement';
import type { MacroItem, WindowMacro } from './MacroManager';
import type { PlacedComponent, SymbolDefinition, TextFormatConfig } from './types';
import { SYMBOL_DEFINITIONS } from './symbols';
import { componentInsertionPoint, rotatedLocalPoint, scaleSymbolDefinition } from './SymbolGeometry';
import { remapNativeMacroData } from './NativeMacroData';

/** Both file types become a movable collection of ordinary drawing objects.
 * A page's frame, title block, page number and settings are not drawing content. */
export function macroForPlacement(macro: MacroItem): WindowMacro {
  const copy = structuredClone(macro);
  const content=copy.type==='ema'?copy:copy.page;
  const frameUnits=copy.unitsPerMm??2;
  for(const box of content.boxes??[])if(box.kind==='device'){content.components.push(componentFromBox(box,frameUnits));for(const group of content.groups??[])for(const member of group.members)if(member.kind==='box'&&member.id===box.id)member.kind='component';}
  content.boxes=content.boxes?.filter(box=>box.kind!=='device');
  if (copy.type === 'ema') return copy;
  const page = copy.page, components = page.components, firstSource = components[0];
  const library = copy.symbolLibrary ??= [];
  const units = copy.unitsPerMm ?? library.find(s => s.unitsPerMm)?.unitsPerMm ?? 2;
  const unique = (prefix: string) => { let id = prefix, n = 0; while (components.some(c => c.id === id)) id = `${prefix}_${++n}`; return id; };
  const addAnnotation = (id: string, width: number, height: number): PlacedComponent => {
    let symbolId = `macro:${copy.id}:${id}`, suffix = 0;
    while (library.some(s => s.id === symbolId)) symbolId = `macro:${copy.id}:${id}:${++suffix}`;
    const symbol: SymbolDefinition = { id: symbolId, name: 'Makrografik', category: 'controls', standard: 'DIN EN 60617',
      defaultBmkPrefix: '', defaultFunctionText: '', width, height, unitsPerMm: units, insertionPoint: { x: 0, y: 0 },
      pins: [], importedGraphics: [], svgContent: '', description: 'Bearbeitbares Grafik- oder Textobjekt aus einem Makro' };
    library.push(symbol);
    const component: PlacedComponent = { id: unique(id), symbolId, bmk: '', functionText: '', x: 0, y: 0, rotation: 0,
      pins: {}, bmkPosition: { visible: false }, functionTextPosition: { visible: false }, technicalDataPosition: { visible: false } };
    components.push(component); return component;
  };
  const at = (component: PlacedComponent, x: number, y: number, fontSize: number, baseY: number, fontColor?: string): TextFormatConfig => {
    const symbol = library.find(s => s.id === component.symbolId)!;
    return { preset: 'custom', offsetX: x - symbol.width / 2, offsetY: y - baseY,
      alignment: 'start', fontSize, fontColor, visible: true };
  };
  for (const text of page.texts ?? []) {
    if (!text.text) continue;
    const size = text.fontSize ?? 9, width = Math.max(1, ...text.text.split('\n').map(line => line.length * size * .6));
    const height = Math.max(size, text.text.split('\n').length * size * 1.2);
    const c = addAnnotation(`text_${text.id}`, width, height);
    for(const group of page.groups??[])for(const member of group.members)if(member.kind==='text'&&member.id===text.id){member.kind='component';member.id=c.id;}
    const rot: 0 | 90 | 180 | 270 = (((Math.round((text.rotation ?? 0) / 90) % 4) + 4) % 4) * 90 as 0 | 90 | 180 | 270;
    c.rotation = rot; c.functionText = text.text;
    const baseline = rotatedLocalPoint({ x: 0, y: size }, library.find(s => s.id === c.symbolId)!, c.rotation);
    c.x = text.x - baseline.x; c.y = text.y - baseline.y;
    c.functionTextPosition = { ...at(c, 0, size, size, height + 12, text.fontColor ?? (size >= 11 ? '#63b3ed' : '#cbd5e0')),
      rotation: rot, fontWeight: text.fontWeight ?? (size >= 11 ? 'bold' : 'normal') };
  }
  const images = page.images ?? [], cables = page.cables ?? [], boxes=page.boxes ?? [], points: { x: number; y: number }[] = [];
  const definition = (c: PlacedComponent) => {
    const raw = c.importedSymbol ?? library.find(s => s.id === c.symbolId) ?? SYMBOL_DEFINITIONS.find(s => s.id === c.symbolId);
    return raw && deviceBoxDefinition(c,scaleSymbolDefinition(raw, units));
  };
  for (const c of components) {
    const symbol = definition(c);
    for (const p of symbol ? [{ x: 0, y: 0 }, { x: symbol.width, y: 0 }, { x: 0, y: symbol.height }, { x: symbol.width, y: symbol.height }]
      .map(p => rotatedLocalPoint(p, symbol, c.rotation)) : [{ x: 0, y: 0 }]) points.push({ x: c.x + p.x, y: c.y + p.y });
  }
  for (const box of boxes) points.push({x:box.x,y:box.y},{x:box.x+box.width,y:box.y+box.height});
  for (const image of images) points.push({ x: image.x, y: image.y }, { x: image.x + image.width, y: image.y + image.height });
  for (const cable of cables) points.push(cable.start, cable.end);
  if (!components.length && !images.length && !cables.length && !boxes.length) throw new Error('Das Makro enthält keine platzierbaren Objekte.');
  for (const wire of page.wires) points.push(...(wire.waypoints ?? []));
  if (!points.length) throw new Error('Das Makro enthält keine platzierbaren Objekte.');
  const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y));
  const width = Math.max(1, Math.max(...points.map(p => p.x)) - x), height = Math.max(1, Math.max(...points.map(p => p.y)) - y);
  for (const c of components) { c.x -= x; c.y -= y; }
  for (const box of boxes) {box.x-=x;box.y-=y;}
  for (const image of images) { image.x -= x; image.y -= y; }
  for (const cable of cables) { cable.start = { x: cable.start.x - x, y: cable.start.y - y }; cable.end = { x: cable.end.x - x, y: cable.end.y - y }; }
  for (const wire of page.wires) if (wire.waypoints) wire.waypoints = wire.waypoints.map(p => ({ x: p.x - x, y: p.y - y }));
  const first = firstSource ?? components[0], firstSymbol = first && definition(first);
  const handlePoint = first && firstSymbol ? componentInsertionPoint(first, firstSymbol) : cables[0]?.start ?? { x: 0, y: 0 };
  const { page: _page, type: _type, ...metadata } = copy;
  return { ...metadata, nativeData:remapNativeMacroData(copy.nativeData??page.nativeData,new Map(components.map(c=>[c.id,c.id]))), type: 'ema', components, wires: page.wires, groups: page.groups, images, cables, boxes, width, height, handlePoint, unitsPerMm: units, symbolLibrary: library };
}
