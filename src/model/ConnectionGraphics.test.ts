import assert from 'node:assert/strict';
import { connectionCutouts, connectionGraphicWires, visibleWireSegments } from './ConnectionGraphics';
import { Page, PlacedComponent, Project, SymbolDefinition } from './types';
import { CadCanvas } from '../editor/CadCanvas';
import { PdfExporter } from '../export/PdfExporter';

const pt = (x: number, y: number) => ({ x, y });
const box = { minX: 0, minY: -2, maxX: 2, maxY: 2 };
// A directional T supplies the diagonal inside its 2 mm library bounds.
assert.deepEqual(visibleWireSegments([pt(0, 0), pt(10, 0)], [box]), [[pt(2, 0), pt(10, 0)]]);
assert.deepEqual(visibleWireSegments([pt(0, -10), pt(0, 10)], [box]),
  [[pt(0, -10), pt(0, -2)], [pt(0, 2), pt(0, 10)]]);
assert.deepEqual(visibleWireSegments([pt(10, 0), pt(0, 0)], [box]), [[pt(10, 0), pt(2, 0)]]);
// Coincident unrelated crossings have no cutout and acquire no connection.
assert.deepEqual(visibleWireSegments([pt(-5, 0), pt(5, 0)], []), [[pt(-5, 0), pt(5, 0)]]);
assert.deepEqual(visibleWireSegments([pt(-5, 5), pt(5, 5)], [box]), [[pt(-5, 5), pt(5, 5)]]);
// Union overlapping glyphs, preserve direction and do not mutate anchors.
const points = [pt(-5, 0), pt(5, 0)], before = JSON.stringify(points);
assert.deepEqual(visibleWireSegments(points, [box, { ...box, minX: 1, maxX: 3 }]),
  [[pt(-5, 0), pt(0, 0)], [pt(3, 0), pt(5, 0)]]);
assert.equal(JSON.stringify(points), before);

const t: SymbolDefinition = { id: 't', name: 'T', category: 'connections', standard: 'DIN EN 60617',
  defaultBmkPrefix: '', defaultFunctionText: '', description: '', width: 4, height: 4, svgContent: '',
  connectionGraphic: true, source: { library: 'SPECIAL', number: 66, variant: 0 },
  pins: [{ id: '0', name: '0', x: 2, y: 2, direction: 'right' }],
  importedGraphics: [{ kind: 'line', x1: 2, y1: 0, x2: 2, y2: 4, color: 'currentColor', width: 0.6 },
    { kind: 'line', x1: 2, y1: 4, x2: 4, y2: 2, color: 'currentColor', width: 0.6 }] };
const device: SymbolDefinition = { ...t, id: 'device', name: 'Device', connectionGraphic: false,
  source: { library: 'IEC_symbol', number: 1, variant: 0 },
  pins: [{ id: '0', name: '1', x: 0, y: 0, direction: 'left',
    labelPosition: { x: 1.5, y: -2, fontSize: 4, alignment: 'start', rotation: 90 } }],
  importedGraphics: [{ kind: 'circle', x: 0, y: 0, radius: 0.5, color: 'currentColor', width: 0.1 }] };
const c: PlacedComponent = { id: 'placed-t', symbolId: t.id, x: 100, y: 150, rotation: 0, bmk: '', functionText: '', pins: { '0': {} } };
const d: PlacedComponent = { ...c, id: 'placed-device', symbolId: device.id, x: 120, y: 152,
  pins: { '0': { customLabel: 'L1 <neu>' } } };
const page = { components: [c, d], wires: [{ id: 'wire', from: { componentId: c.id, pinId: '0' },
  to: { componentId: d.id, pinId: '0' }, potential: 'Signal', lineWidth: 0.6 }],
  plotFrame: { width: 1000, height: 700 } } as Page;
const project = { pages: [page], symbolLibrary: [t, device] } as Project;
page.wires[0].color = 'BU';
const extra: PlacedComponent = { ...c, id: 'routing-only' };
page.components.push(extra);
assert.equal(connectionGraphicWires(page, project).get(extra.id)?.color, 'BU', 'A routing glyph inherits the crossing wire color without becoming an endpoint');
assert.equal(page.wires.length, 1);
page.components.pop();
assert.deepEqual(connectionCutouts(page, project), [{ minX: 102, minY: 150, maxX: 104, maxY: 154 }]);
c.source = { format: 'NATIVE_CAD', objectType: 42, objectId: 1, routingUsed: false };
assert.deepEqual(connectionCutouts(page, project), [], 'Unused source routing helpers do not cut holes into wire ink');
delete c.source;
c.rotation = 90;
assert.deepEqual(connectionCutouts(page, project), [{ minX: 100, minY: 152, maxX: 104, maxY: 154 }]);
c.rotation = 0;
// A straight library bus has zero horizontal extent, despite minimum editor size.
t.importedGraphics = t.importedGraphics!.slice(0, 1);
assert.equal(connectionCutouts(page, project)[0].minX, connectionCutouts(page, project)[0].maxX);
t.importedGraphics.push({ kind: 'line', x1: 2, y1: 4, x2: 4, y2: 2, color: 'currentColor', width: 0.6 });

const canvas: any = Object.assign(Object.create(CadCanvas.prototype), { activePage: page, project, mode: 'select' });
const svg: string = canvas.renderComponents(), wires: string = canvas.renderWires();
assert.equal((svg.match(/<circle /g) ?? []).length, 1, 'Keep the real library circle; add no synthetic pin rings');
assert.doesNotMatch(svg, /pin-handle/);
assert.match(svg, /class="source-pin-label" x="1.5" y="-2" font-size="4"/);
assert.match(svg, /rotate\(90, 1.5, -2\)/);
assert.match(svg, />L1 &lt;neu&gt;<\/text>/);
assert.match(wires, /data-wire-role="ink" d="M 104 152 L 120 152"/);
assert.match(wires, /data-wire-role="hit" d="M 102 152 L 120 152"/);
assert.match(wires, /stroke-width="0.6"/);
page.wires.push({ ...page.wires[0], id: 'overlapping' });
assert.doesNotMatch(canvas.renderWires(), /junction-dot/, 'Even coincident source endpoints never invent a dot');
canvas.mode = 'wire';
assert.equal((canvas.renderComponents().match(/class="pin-handle"/g) ?? []).length, 2);
// Drag and static rendering use the same clipped ink and uncut hit centerline.
const updated = new Map<string, string>();
canvas.svg = { getElementById: () => ({ querySelector: (role: string) => ({ setAttribute: (_: string, value: string) => updated.set(role, value) }) }) };
c.x += 1;
canvas.updateConnectedWiresFast(c.id);
assert.equal(updated.get('[data-wire-role="ink"]'), 'M 105 152 L 120 152');
c.x -= 1;

const lines: number[][] = [], circles: number[][] = [], texts: unknown[][] = [], widths: number[] = [];
const pdf: any = {};
for (const name of ['setLineDashPattern', 'setDrawColor', 'setTextColor', 'setFillColor', 'setFont', 'setFontSize']) pdf[name] = () => undefined;
pdf.line = (...args: number[]) => lines.push(args);
pdf.circle = (...args: number[]) => circles.push(args);
pdf.text = (...args: unknown[]) => texts.push(args);
pdf.setLineWidth = (width: number) => widths.push(width);
(PdfExporter as any).renderWires(pdf, page, project, 1000, 700, 'color');
assert.deepEqual(lines[0], [104, 152, 120, 152]);
assert.equal(widths[0], 0.6);
(PdfExporter as any).renderComponents(pdf, page, project, 1000, 700, { colorMode: 'color' }, new Map());
assert.equal(circles.length, 1, 'PDF contains the source circle and no editor handles');
assert(texts.some(args => args[0] === 'L1 <neu>'));
assert(!texts.some(args => args[0] === '0'), 'Routing pin indices must not become printed labels');
console.log('✓ Source junction ink, unconnected crossings, pin labels, rotation, drag and PDF stay consistent');
