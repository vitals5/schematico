import { arcPoints } from './ImportedDrawing';
import type { DrawingPrimitive } from './types';
import { xmlChildren, xmlPoint, xmlTag } from './NativeXmlSymbol';
import { nativeXmlText } from './NativeXmlText';

const numeric = (node: Element, field: string, fallback: number) => {
  const text = node.getAttribute(field);
  if (text === null || text === '' || text === 'L') return fallback;
  const value = Number(text);
  if (!Number.isFinite(value) || Math.abs(value) > 10000) throw new Error(`Ungültiger Grafikwert im Makro (${field}).`);
  return value;
};

/** Physical millimetres and radian parameters in a Y-up coordinate system. */
export function nativeXmlGraphics(node: Element, units: number): DrawingPrimitive[] {
  const kind = xmlTag(node), point = (attribute: string) => xmlPoint(node, attribute, units);
  const color = 'currentColor', width = numeric(node, 'A414', .25) * units;
  if (width < 0) throw new Error('Ungültige Linienbreite im Makro.');
  if (kind === 'O31') {
    const a = point('A531'), b = point('A532');
    return [{ kind: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y, color, width }];
  }
  if (kind === 'O89') {
    const a = point('A1651'), b = point('A1652');
    return [{ kind: 'rect', x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
      width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y), color, lineWidth: width }];
  }
  if (kind === 'O32') {
    const center = point('A555'), vector = point('A556'), radius = Math.hypot(vector.x, vector.y);
    const start = numeric(node, 'A553', 0), end = numeric(node, 'A554', 0);
    const turn = Math.PI * 2, sweep = ((end - start) % turn + turn) % turn;
    if (!radius) throw new Error('Ungültiger Kreisradius im Makro.');
    if (sweep < 1e-10 || turn - sweep < 1e-10) return [{ kind: 'circle', ...center, radius, color, width,
      ...(node.getAttribute('A558') === '1' ? { fill: color } : {}) }];
    const startAngle = (Math.atan2(vector.y, vector.x) - start) * 180 / Math.PI;
    return [{ kind: 'arc', ...center, radius, color, width, startAngle,
      endAngle: startAngle - sweep * 180 / Math.PI, counterClockwise: true }];
  }
  if (kind === 'O34') {
    const values = (node.getAttribute('A621') ?? '').split(';').filter(Boolean);
    if (values.length < 2) throw new Error('Ungültiger Linienzug im Makro.');
    const points = values.map(value => {
      const copy = node.cloneNode(false) as Element;
      copy.setAttribute('point', value);
      return xmlPoint(copy, 'point', units);
    });
    const closed = points.length > 2 && (node.getAttribute('A623') === '1'
      || Math.hypot(points[0].x - points.at(-1)!.x, points[0].y - points.at(-1)!.y) < 1e-6);
    if (closed) return [{ kind: 'polygon', points, color, width,
      ...(node.getAttribute('A623') === '1' ? { fill: color } : {}) }];
    return points.slice(1).map((p, i) => ({ kind: 'line', x1: points[i].x, y1: points[i].y, x2: p.x, y2: p.y, color, width }));
  }
  if (kind === 'O30' || kind === 'O83') {
    const text = nativeXmlText(node.getAttribute('A511') ?? '');
    if (!text) return [];
    const format = xmlChildren(node).find(n => xmlTag(n) === 'S54x505');
    const size = (format ? numeric(format, 'A961', 2.5) : 2.5) * 1.242 * units;
    if (size <= 0) throw new Error('Ungültige Schriftgröße im Makro.');
    const alignment = numeric(node, 'A503', 0) % 16;
    const anchor = alignment >= 6 ? 'end' : alignment >= 3 ? 'middle' : 'start';
    return [{ kind: 'text', ...point('A501'), text, size, color, anchor,
      rotation: -numeric(node, 'A504', 0) }];
  }
  throw new Error(`Das XML-Makro enthält einen noch nicht unterstützten Objekttyp (${kind}).`);
}

export function graphicBounds(graphics: DrawingPrimitive[]) {
  const points = graphics.flatMap(g => {
    if (g.kind === 'line') return [{ x: g.x1, y: g.y1 }, { x: g.x2, y: g.y2 }];
    if (g.kind === 'polygon') return g.points;
    if (g.kind === 'arc') return arcPoints(g);
    if (g.kind === 'circle') return [{ x: g.x - g.radius, y: g.y - g.radius }, { x: g.x + g.radius, y: g.y + g.radius }];
    if (g.kind === 'rect') return [g, { x: g.x + g.width, y: g.y + g.height }];
    const lines = g.text.split('\n'), width = Math.max(...lines.map(line => line.length)) * g.size * .6;
    const left = g.anchor === 'end' ? -width : g.anchor === 'middle' ? -width / 2 : 0;
    const top = -g.size, bottom = (lines.length - 1) * g.size * 1.2;
    const radians = (g.rotation ?? 0) * Math.PI / 180;
    return [[left, top], [left + width, top], [left, bottom], [left + width, bottom]].map(([x,y]) => ({
      x: g.x + x * Math.cos(radians) - y * Math.sin(radians),
      y: g.y + x * Math.sin(radians) + y * Math.cos(radians)
    }));
  });
  if (!points.length) throw new Error('Das Makro enthält keine platzierbare Geometrie.');
  const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y));
  return { x, y, width: Math.max(...points.map(p => p.x)) - x, height: Math.max(...points.map(p => p.y)) - y };
}

export function translateGraphics(graphics: DrawingPrimitive[], dx: number, dy: number): DrawingPrimitive[] {
  return graphics.map(g => g.kind === 'line' ? { ...g, x1: g.x1 + dx, y1: g.y1 + dy, x2: g.x2 + dx, y2: g.y2 + dy }
    : g.kind === 'polygon' ? { ...g, points: g.points.map(p => ({ x: p.x + dx, y: p.y + dy })) }
    : { ...g, x: g.x + dx, y: g.y + dy });
}
