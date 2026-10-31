import { DOMParser } from '@xmldom/xmldom';
import { SVGPathData } from 'svg-pathdata';
import type { jsPDF } from 'jspdf';
import { uprightSymbolSvg } from '../model/ImportedDrawing';

type Matrix = [number, number, number, number, number, number];
type Style = Record<string, string>;
const identity: Matrix = [1, 0, 0, 1, 0, 0];
const numbers = (s: string) => (s.match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi) ?? []).map(Number);
const multiply = (a: Matrix, b: Matrix): Matrix => [
  a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1],
  a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3],
  a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5],
];
const point = (m: Matrix, x: number, y: number): [number, number] => [m[0]*x+m[2]*y+m[4], m[1]*x+m[3]*y+m[5]];
function transform(value: string): Matrix {
  let matrix = identity;
  for (const [, name, args] of value.matchAll(/([a-z]+)\s*\(([^)]*)\)/gi)) {
    const n = numbers(args); let next = identity;
    switch (name.toLowerCase()) {
      case 'matrix': if (n.length === 6) next = n as Matrix; break;
      case 'translate': next = [1, 0, 0, 1, n[0] ?? 0, n[1] ?? 0]; break;
      case 'scale': next = [n[0], 0, 0, n[1] ?? n[0], 0, 0]; break;
      case 'rotate': {
        const angle = n[0]*Math.PI/180, c = Math.cos(angle), s = Math.sin(angle), x = n[1] ?? 0, y = n[2] ?? 0;
        next = [c, s, -s, c, x-c*x+s*y, y-s*x-c*y]; break;
      }
      case 'skewx': next = [1, 0, Math.tan(n[0]*Math.PI/180), 1, 0, 0]; break;
      case 'skewy': next = [1, Math.tan(n[0]*Math.PI/180), 0, 1, 0, 0]; break;
    }
    matrix = multiply(matrix, next);
  }
  return matrix;
}
const presentation = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin',
  'font-size', 'font-family', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline', 'visibility'];
function styleFor(el: Element, inherited: Style): Style {
  const style = {...inherited};
  for (const key of presentation) if (el.hasAttribute(key)) style[key] = el.getAttribute(key)!;
  for (const declaration of (el.getAttribute('style') ?? '').split(';')) {
    const colon = declaration.indexOf(':');
    if (colon >= 0) style[declaration.slice(0, colon).trim()] = declaration.slice(colon+1).trim();
  }
  return style;
}
const children = (el: Element) => Array.from(el.childNodes).filter((n): n is Element => n.nodeType === 1);

/** Export the editor's actual library SVG as vectors, including transformed
 * groups, stroke styles and exact SVG curves. No second set of symbol contours. */
export function renderSymbolSvg(doc: jsPDF, svg: string, x: number, y: number, width: number, height: number,
  symbolWidth: number, symbolHeight: number, rotation = 0, foreground = '#000000', monochrome = false): void {
  const sx = width/symbolWidth, sy = height/symbolHeight, cx = symbolWidth/2, cy = symbolHeight/2;
  const rad = rotation*Math.PI/180, c = Math.cos(rad), s = Math.sin(rad);
  const base: Matrix = [sx*c, sy*s, -sx*s, sy*c, x+sx*(cx-c*cx+s*cy), y+sy*(cy-s*cx-c*cy)];
  const root = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${uprightSymbolSvg(svg, rotation)}</svg>`, 'image/svg+xml').documentElement;
  const color = (value: string): [number, number, number] => {
    if (value === 'currentColor') value = foreground;
    if (monochrome) return [0, 0, 0];
    const hex = value.match(/^#([a-f0-9]{3}|[a-f0-9]{6})$/i)?.[1];
    if (!hex) return value === 'white' ? [255, 255, 255] : [0, 0, 0];
    const full = hex.length === 3 ? [...hex].map(c => c+c).join('') : hex;
    return [0, 2, 4].map(i => parseInt(full.slice(i, i+2), 16)) as [number, number, number];
  };
  const drawPath = (d: string, matrix: Matrix, fill: boolean, stroke: boolean) => {
    const commands = new SVGPathData(d).toAbs().normalizeHVZ(false).normalizeST().qtToC().aToC().matrix(...matrix).commands;
    const ops: {op: string; c: number[]}[] = commands.map(cmd => {
      switch (cmd.type) {
        case SVGPathData.MOVE_TO: return {op:'m', c:[cmd.x,cmd.y]};
        case SVGPathData.LINE_TO: return {op:'l', c:[cmd.x,cmd.y]};
        case SVGPathData.CURVE_TO: return {op:'c', c:[cmd.x1,cmd.y1,cmd.x2,cmd.y2,cmd.x,cmd.y]};
        case SVGPathData.CLOSE_PATH: return {op:'h', c:[]};
        default: throw new Error('Nicht unterstützter Pfad im Bibliothekssymbol.');
      }
    });
    if (!ops.length) return;
    doc.path(ops);
    if (fill && stroke) doc.fillStroke(); else if (fill) doc.fill(); else doc.stroke();
  };
  const visit = (el: Element, parent: Matrix, inherited: Style) => {
    const tag = el.localName || el.tagName, style = styleFor(el, inherited);
    if (['defs','title','desc','metadata','script','style'].includes(tag) || style.display === 'none' || style.visibility === 'hidden') return;
    const matrix = multiply(parent, transform(el.getAttribute('transform') ?? ''));
    if (['svg','g','a'].includes(tag)) {for (const child of children(el)) visit(child,matrix,style); return;}
    const n = (attr: string, fallback = 0) => Number.parseFloat(el.getAttribute(attr) ?? '') || fallback;
    const fill = style.fill !== 'none', stroke = style.stroke !== 'none', scale = Math.sqrt(Math.abs(matrix[0]*matrix[3]-matrix[1]*matrix[2]));
    if (!fill && !stroke) return;
    doc.setDrawColor(...color(style.stroke)); doc.setFillColor(...color(style.fill));
    doc.setLineWidth((parseFloat(style['stroke-width']) || 1)*scale);
    doc.setLineDashPattern(style['stroke-dasharray'] === 'none' ? [] : numbers(style['stroke-dasharray'] ?? '').map(v => v*scale), (parseFloat(style['stroke-dashoffset']) || 0)*scale);
    doc.setLineCap?.(style['stroke-linecap'] === 'round' ? 1 : style['stroke-linecap'] === 'square' ? 2 : 0);
    doc.setLineJoin?.(style['stroke-linejoin'] === 'round' ? 1 : style['stroke-linejoin'] === 'bevel' ? 2 : 0);
    if (tag === 'text') {
      if (!fill) return;
      const font = /mono|courier/i.test(style['font-family']) ? 'courier' : 'helvetica';
      const bold = style['font-weight'] === 'bold' || Number(style['font-weight']) >= 600;
      const italic = style['font-style'] === 'italic';
      doc.setFont(font, bold ? italic ? 'bolditalic' : 'bold' : italic ? 'italic' : 'normal');
      doc.setFontSize((parseFloat(style['font-size']) || 8)*Math.hypot(matrix[2],matrix[3])*72/25.4);
      doc.setTextColor(...color(style.fill));
      const options = {align: style['text-anchor'] === 'middle' ? 'center' as const : style['text-anchor'] === 'end' ? 'right' as const : 'left' as const,
        angle: -Math.atan2(matrix[1],matrix[0])*180/Math.PI,
        baseline: /^(middle|central)$/.test(style['dominant-baseline']) ? 'middle' as const : 'alphabetic' as const};
      const spans = children(el).filter(c => (c.localName || c.tagName) === 'tspan');
      if (!spans.length) doc.text(el.textContent ?? '', ...point(matrix,n('x'),n('y')), options);
      else {
        let py = n('y');
        for (const span of spans) {
          py = span.hasAttribute('y') ? parseFloat(span.getAttribute('y')!) : py;
          py += parseFloat(span.getAttribute('dy') ?? '0');
          doc.text(span.textContent ?? '', ...point(matrix,parseFloat(span.getAttribute('x') ?? String(n('x'))),py),options);
        }
      }
      return;
    }
    if (tag === 'line') {
      if (stroke) doc.line(...point(matrix,n('x1'),n('y1')),...point(matrix,n('x2'),n('y2')));
      return;
    }
    let d = '';
    if (tag === 'path') d = el.getAttribute('d') ?? '';
    else if (tag === 'rect') {
      const x = n('x'), y = n('y'), w = n('width'), h = n('height');
      const rx = Math.min(n('rx',n('ry')),w/2), ry = Math.min(n('ry',rx),h/2);
      d = rx && ry ? `M ${x+rx} ${y} H ${x+w-rx} A ${rx} ${ry} 0 0 1 ${x+w} ${y+ry} V ${y+h-ry} A ${rx} ${ry} 0 0 1 ${x+w-rx} ${y+h} H ${x+rx} A ${rx} ${ry} 0 0 1 ${x} ${y+h-ry} V ${y+ry} A ${rx} ${ry} 0 0 1 ${x+rx} ${y} Z`
        : `M ${x} ${y} h ${w} v ${h} h ${-w} Z`;
    } else if (tag === 'circle' || tag === 'ellipse') {
      const x = n('cx'), y = n('cy'), rx = tag === 'circle' ? n('r') : n('rx'), ry = tag === 'circle' ? rx : n('ry');
      d = `M ${x-rx} ${y} A ${rx} ${ry} 0 1 0 ${x+rx} ${y} A ${rx} ${ry} 0 1 0 ${x-rx} ${y} Z`;
    } else if (tag === 'polygon' || tag === 'polyline') {
      const coords = numbers(el.getAttribute('points') ?? '');
      if (coords.length >= 4) d = coords.reduce((d,v,i) => d+(i%2 ? `${v} ` : `${i ? 'L' : 'M'} ${v} `),'')+(tag === 'polygon' ? 'Z' : '');
    }
    if (d.trim()) drawPath(d,matrix,fill,stroke);
  };
  visit(root,base,{fill:'currentColor',stroke:'none','stroke-width':'1','font-size':'8','font-family':'sans-serif'});
  doc.setLineDashPattern([],0);
}
