import { DrawingPrimitive } from './types';

export const escapeSvg = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** Source geometry uses the same foreground as any other library symbol in the editor. */
export function drawingToSvg(graphics: DrawingPrimitive[], options: { color?: string; componentRotation?: number } = {}): string {
  return graphics.map(g => {
    const color = escapeSvg(options.color ?? g.color);
    const fill = 'fill' in g && g.fill ? escapeSvg(options.color ?? g.fill) : 'none';
    switch (g.kind) {
      case 'line': return `<line x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}" stroke="${color}" stroke-width="${g.width ?? 0.6}" ${g.dash ? `stroke-dasharray="${g.dash.join(',')}"` : ''}/>`;
      case 'rect': return `<rect x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}" fill="none" stroke="${color}" stroke-width="${g.lineWidth ?? 0.6}" ${g.dash ? `stroke-dasharray="${g.dash.join(',')}"` : ''}/>`;
      case 'circle': return `<circle cx="${g.x}" cy="${g.y}" r="${g.radius}" fill="${fill}" stroke="${color}" stroke-width="${g.width ?? 0.5}"/>`;
      case 'polygon': return `<polygon points="${g.points.map(p => `${p.x},${p.y}`).join(' ')}" fill="${fill}" stroke="${color}" stroke-width="${g.width ?? 0.6}"/>`;
      case 'arc': {
        const points = arcPoints(g);
        return `<polyline points="${points.map(p => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="${color}" stroke-width="${g.width ?? 0.6}"/>`;
      }
      case 'text': return `<text x="${g.x}" y="${g.y}" fill="${color}" font-family="Arial, sans-serif" font-size="${g.size}" text-anchor="${g.anchor ?? 'start'}" ${(g.rotation ?? 0) - (options.componentRotation ?? 0) ? `transform="rotate(${(g.rotation ?? 0) - (options.componentRotation ?? 0)},${g.x},${g.y})"` : ''}>${g.text.split('\n').map((t, i) => `<tspan x="${g.x}" dy="${i ? g.size * 1.2 : 0}">${escapeSvg(t)}</tspan>`).join('')}</text>`;
    }
  }).join('');
}

/** Degrees in SVG coordinates. Identical sampling is used in SVG and PDF. */
export function arcPoints(arc: Extract<DrawingPrimitive, { kind: 'arc' }>): { x: number; y: number }[] {
  const raw = arc.endAngle - arc.startAngle;
  let sweep = arc.counterClockwise ? -(((-raw % 360) + 360) % 360) : ((raw % 360) + 360) % 360;
  if (Math.abs(raw) >= 360 && Math.abs(sweep) < 1e-9) sweep = arc.counterClockwise ? -360 : 360;
  const steps = Math.max(1, Math.ceil(Math.abs(sweep) / 3));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const angle = (arc.startAngle + sweep * i / steps) * Math.PI / 180;
    return { x: arc.x + arc.radius * Math.cos(angle), y: arc.y + arc.radius * Math.sin(angle) };
  });
}

/** Rotate the library geometry around the same center as component pins and labels. */
export function rotateDrawing(graphics: DrawingPrimitive[], angle: number, width: number, height: number): DrawingPrimitive[] {
  if (!angle) return graphics;
  const radians = angle * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians);
  const point = (x: number, y: number) => ({ x: width / 2 + (x - width / 2) * cos - (y - height / 2) * sin,
    y: height / 2 + (x - width / 2) * sin + (y - height / 2) * cos });
  return graphics.map(g => {
    if (g.kind === 'line') {
      const a = point(g.x1, g.y1), b = point(g.x2, g.y2);
      return { ...g, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
    }
    if (g.kind === 'rect') {
      return { kind: 'polygon', points: [point(g.x, g.y), point(g.x + g.width, g.y), point(g.x + g.width, g.y + g.height), point(g.x, g.y + g.height)], color: g.color, width: g.lineWidth };
    }
    if (g.kind === 'polygon') return { ...g, points: g.points.map(p => point(p.x, p.y)) };
    const p = point(g.x, g.y);
    if (g.kind === 'arc') return { ...g, ...p, startAngle: g.startAngle + angle, endAngle: g.endAngle + angle };
    return { ...g, ...p };
  });
}

/** Library SVGs use text anchors without transforms; keep their lettering upright. */
export function uprightSymbolSvg(svg: string, rotation = 0): string {
  if (!rotation) return svg;
  return svg.replace(/<text\b([^>]*)>/g, (tag, attrs: string) => {
    const x = /\bx="([^"]+)"/.exec(attrs)?.[1] ?? '0';
    const y = /\by="([^"]+)"/.exec(attrs)?.[1] ?? '0';
    return `<g transform="rotate(${-rotation},${x},${y})">${tag}`;
  }).replace(/<\/text>/g, '</text></g>');
}
