import { DrawingPrimitive, PlacedComponent, SymbolDefinition } from './types';

export type Point = { x: number; y: number };

/** Exact quarter turns shared by insertion, pins and rotation. */
export function rotatedLocalPoint(point: Point, symbol: SymbolDefinition, rotation: number): Point {
  const cx = symbol.width / 2, cy = symbol.height / 2, dx = point.x - cx, dy = point.y - cy;
  switch ((rotation % 360 + 360) % 360) {
    case 90: return { x: cx - dy, y: cy + dx };
    case 180: return { x: cx - dx, y: cy - dy };
    case 270: return { x: cx + dy, y: cy - dx };
    default: return { ...point };
  }
}

export function symbolInsertionPoint(symbol: SymbolDefinition): Point {
  return symbol.insertionPoint ?? symbol.pins[0] ?? { x: 0, y: 0 };
}

export function componentInsertionPoint(component: PlacedComponent, symbol: SymbolDefinition): Point {
  const offset = rotatedLocalPoint(symbolInsertionPoint(symbol), symbol, component.rotation);
  return { x: component.x + offset.x, y: component.y + offset.y };
}

export function positionAtInsertionPoint(point: Point, symbol: SymbolDefinition, rotation: number, scale: number = 1): Point {
  const raw = symbolInsertionPoint(symbol);
  const scaledPoint = { x: raw.x * scale, y: raw.y * scale };
  const scaledSym: SymbolDefinition = { ...symbol, width: symbol.width * scale, height: symbol.height * scale };
  const offset = rotatedLocalPoint(scaledPoint, scaledSym, rotation);
  return { x: point.x - offset.x, y: point.y - offset.y };
}

export function scalePlacedComponent(component: PlacedComponent, factor: number): PlacedComponent {
  const copy: PlacedComponent = JSON.parse(JSON.stringify(component));
  copy.x *= factor; copy.y *= factor;
  if(copy.deviceBox){copy.deviceBox.width*=factor;copy.deviceBox.height*=factor;copy.deviceBox.lineWidth*=factor;if(copy.deviceBox.dash)copy.deviceBox.dash=copy.deviceBox.dash.map(n=>n*factor);}
  for (const pin of Object.values(copy.pins)) if (pin.labelPosition) {
    pin.labelPosition.x *= factor; pin.labelPosition.y *= factor; pin.labelPosition.fontSize *= factor;
  }
  if (copy.crossRefFontSize !== undefined) copy.crossRefFontSize *= factor;
  if (copy.pinLabelFontSize !== undefined) copy.pinLabelFontSize *= factor;
  for (const key of ['bmkPosition', 'functionTextPosition', 'additionalTextPosition', 'technicalDataPosition', 'crossRefPosition'] as const) {
    const config = copy[key];
    if (!config) continue;
    for (const field of ['offsetX', 'offsetY', 'fontSize'] as const) if (config[field] !== undefined) config[field]! *= factor;
  }
  return copy;
}

/** Scale contour and ports together; never round individual physical pins. */
export function scaleSymbolDefinition(symbol: SymbolDefinition, unitsPerMm: number): SymbolDefinition {
  const factor = unitsPerMm / (symbol.unitsPerMm ?? 2);
  if (Math.abs(factor - 1) < 1e-12) return symbol;
  const point = (p: Point): Point => ({ x: p.x * factor, y: p.y * factor });
  const graphics = symbol.importedGraphics?.map((g): DrawingPrimitive => {
    const width = 'width' in g && g.width !== undefined ? { width: g.width * factor } : {};
    if (g.kind === 'line') return { ...g, x1: g.x1 * factor, y1: g.y1 * factor, x2: g.x2 * factor, y2: g.y2 * factor,
      ...width, ...(g.dash ? { dash: g.dash.map(n => n * factor) } : {}) };
    if (g.kind === 'polygon') return { ...g, points: g.points.map(point), ...width };
    if (g.kind === 'circle' || g.kind === 'arc') return { ...g, ...point(g), radius: g.radius * factor, ...width };
    if (g.kind === 'rect') return { ...g, ...point(g), width: g.width * factor, height: g.height * factor,
      ...(g.lineWidth !== undefined ? { lineWidth: g.lineWidth * factor } : {}), ...(g.dash ? { dash: g.dash.map(n => n * factor) } : {}) };
    return { ...g, ...point(g), size: g.size * factor };
  });
  return { ...symbol, unitsPerMm, width: symbol.width * factor, height: symbol.height * factor,
    insertionPoint: point(symbolInsertionPoint(symbol)),
    pins: symbol.pins.map(p => ({ ...p, ...point(p), ...(p.labelPosition ? { labelPosition: {
      ...p.labelPosition, ...point(p.labelPosition), fontSize: p.labelPosition.fontSize * factor } } : {}) })),
    svgContent: `<g transform="scale(${factor})">${symbol.svgContent}</g>`,
    ...(graphics ? { importedGraphics: graphics } : {}) };
}
