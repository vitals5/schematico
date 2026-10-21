import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import { PdfExporter } from './PdfExporter';
import { getSymbolById } from '../model/symbols';
import type { Project, Page, PlacedComponent, Wire } from '../model/types';

// Verify that connection elements (potential arrows, tees, corners, crossings)
// are rendered as proper vector geometry and NOT as fallback rectangular blocks (doc.rect).

const connectionSymbolIds = [
  'potential_arrow',
  'potential_arrow_down',
  'potential_arrow_up',
  'potential_arrow_right',
  'potential_arrow_left',
  't_piece_down',
  't_piece_up',
  't_piece_right',
  't_piece_left',
  'corner_top_right',
  'corner_top_left',
  'corner_bottom_right',
  'corner_bottom_left',
  'cross_junction',
  'cross_bridge',
];

for (const symbolId of connectionSymbolIds) {
  const sym = getSymbolById(symbolId);
  assert(sym, `Symbol ${symbolId} must exist in the library`);

  const component: PlacedComponent = {
    id: `comp_${symbolId}`,
    symbolId,
    x: 100,
    y: 100,
    rotation: 0,
    bmk: 'X1',
    functionText: '',
    pins: {},
  };

  const page: Page = {
    id: 'test_page',
    pageNumber: '1',
    title: 'Test',
    pageType: 'schematic',
    higherLevel: '',
    location: '',
    components: [component],
    wires: [],
    plotFrame: {
      type: 'DIN_A3_LANDSCAPE',
      width: 1000,
      height: 700,
      columns: 10,
      rows: ['A'],
      titleBlock: {
        projectTitle: '',
        commission: '',
        company: '',
        author: '',
        date: '',
        revision: '',
        sheetNumber: '1',
        totalSheets: '1',
      },
    },
  };

  const project: Project = {
    id: 'test_proj',
    name: 'Test',
    description: '',
    author: '',
    company: '',
    standard: 'DIN EN 81346-2 / IEC 60617',
    version: '1.0',
    created: '2026-01-01',
    modified: '2026-01-01',
    pages: [page],
    activePageId: 'test_page',
  };

  const rects: number[][] = [];
  const lines: number[][] = [];
  const triangles: number[][] = [];
  const circles: number[][] = [];

  const mockPdf: any = {};
  for (const name of [
    'setLineWidth', 'setLineDashPattern', 'setTextColor', 'setFillColor',
    'setDrawColor', 'setFont', 'setFontSize', 'path', 'fill', 'fillStroke', 'stroke',
  ]) {
    mockPdf[name] = () => undefined;
  }

  mockPdf.rect = (...args: number[]) => { rects.push(args); };
  mockPdf.line = (...args: number[]) => { lines.push(args); };
  mockPdf.triangle = (...args: number[]) => { triangles.push(args); };
  mockPdf.circle = (...args: number[]) => { circles.push(args); };
  mockPdf.text = () => undefined;

  (PdfExporter as any).renderComponents(mockPdf, page, project, 420, 297, { colorMode: 'color' }, new Map());

  // Connection elements must NEVER draw an empty bounding box rectangle
  assert.equal(
    rects.length,
    0,
    `Connection symbol ${symbolId} must NOT render as an empty fallback rectangle in PDF export`
  );

  // Must render either lines, triangles, or circles representing the connection symbol
  const totalVectors = lines.length + triangles.length + circles.length;
  assert(
    totalVectors > 0,
    `Connection symbol ${symbolId} must render vector elements (lines/triangles/circles), got ${totalVectors}`
  );
}

// Test potential color matching on connection elements
{
  const nArrow: PlacedComponent = {
    id: 'comp_n',
    symbolId: 'potential_arrow',
    x: 50,
    y: 50,
    rotation: 0,
    bmk: 'PF1',
    functionText: 'N',
    pins: {},
  };

  const nWire: Wire = {
    id: 'wire_n',
    from: { componentId: 'comp_n', pinId: 'IN' },
    to: { componentId: 'other', pinId: '1' },
    potential: 'N',
  };

  const peArrow: PlacedComponent = {
    id: 'comp_pe',
    symbolId: 'potential_arrow',
    x: 80,
    y: 50,
    rotation: 0,
    bmk: 'PF2',
    functionText: 'PE',
    pins: {},
  };

  const peWire: Wire = {
    id: 'wire_pe',
    from: { componentId: 'comp_pe', pinId: 'IN' },
    to: { componentId: 'other', pinId: '2' },
    potential: 'PE',
  };

  const page: Page = {
    id: 'page_colors',
    pageNumber: '1',
    title: 'Colors',
    pageType: 'schematic',
    higherLevel: '',
    location: '',
    components: [nArrow, peArrow],
    wires: [nWire, peWire],
    plotFrame: {
      type: 'DIN_A3_LANDSCAPE',
      width: 1000,
      height: 700,
      columns: 10,
      rows: ['A'],
      titleBlock: {
        projectTitle: '',
        commission: '',
        company: '',
        author: '',
        date: '',
        revision: '',
        sheetNumber: '1',
        totalSheets: '1',
      },
    },
  };

  const project: Project = {
    id: 'p_colors',
    name: 'Colors',
    description: '',
    author: '',
    company: '',
    standard: 'DIN EN 81346-2 / IEC 60617',
    version: '1.0',
    created: '2026-01-01',
    modified: '2026-01-01',
    pages: [page],
    activePageId: 'page_colors',
  };

  const drawColors: number[][] = [];
  const fillColors: number[][] = [];
  const rects: number[][] = [];

  const mockPdf: any = {};
  for (const name of [
    'setLineWidth', 'setLineDashPattern', 'setTextColor', 'setFont', 'setFontSize',
    'path', 'fill', 'fillStroke', 'stroke', 'line', 'triangle', 'circle', 'text',
  ]) {
    mockPdf[name] = () => undefined;
  }
  mockPdf.setDrawColor = (...args: number[]) => { drawColors.push(args); };
  mockPdf.setFillColor = (...args: number[]) => { fillColors.push(args); };
  mockPdf.rect = (...args: number[]) => { rects.push(args); };

  (PdfExporter as any).renderComponents(mockPdf, page, project, 420, 297, { colorMode: 'color' }, new Map());

  assert.equal(rects.length, 0, 'No bounding boxes for potential arrows');
  // N wire potential RGB is blue: [37, 99, 235]
  assert(
    fillColors.some(c => c[0] === 37 && c[1] === 99 && c[2] === 235),
    'N potential arrow must be filled with N blue color'
  );
  // PE wire potential RGB is green: [22, 163, 74]
  assert(
    fillColors.some(c => c[0] === 22 && c[1] === 163 && c[2] === 74),
    'PE potential arrow must be filled with PE green color'
  );
}

// Test floor plan rendering in PDF export (walls, openings, arcWires, background image)
{
  const fpPage: Page = {
    id: 'fp_page',
    pageNumber: '2',
    title: 'Grundriss OG',
    pageType: 'installation',
    higherLevel: '',
    location: '',
    components: [
      { id: 'c1', symbolId: 'inst_socket_single', x: 100, y: 100, rotation: 0, bmk: '-X1', functionText: '', pins: {} },
      { id: 'c2', symbolId: 'inst_switch_off', x: 200, y: 100, rotation: 0, bmk: '-Q1', functionText: '', pins: {} },
    ],
    wires: [],
    plotFrame: {
      type: 'DIN_A3_LANDSCAPE',
      width: 1000,
      height: 700,
      columns: 10,
      rows: ['A'],
      titleBlock: {
        projectTitle: '',
        commission: '',
        company: '',
        author: '',
        date: '',
        revision: '',
        sheetNumber: '2',
        totalSheets: '2',
      },
    },
    floorPlan: {
      walls: [
        { id: 'w1', start: { x: 50, y: 50 }, end: { x: 300, y: 50 }, thickness: 24, isExterior: true },
        { id: 'w2', start: { x: 300, y: 50 }, end: { x: 300, y: 300 }, thickness: 12, isExterior: false },
      ],
      openings: [
        { id: 'op1', wallId: 'w1', kind: 'door', center: { x: 150, y: 50 }, width: 80, swingDirection: 'right_in' },
        { id: 'op2', wallId: 'w1', kind: 'window', center: { x: 250, y: 50 }, width: 60 },
        { id: 'op3', wallId: 'w2', kind: 'opening', center: { x: 300, y: 150 }, width: 70 },
        { id: 'op4', wallId: 'w2', kind: 'garage_door', center: { x: 300, y: 240 }, width: 50 },
      ],
      arcWires: [
        { id: 'aw1', fromComponentId: 'c1', toComponentId: 'c2', curvature: 0.3, circuitId: 'circ1' },
      ],
      backgroundImage: {
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        bounds: { x: 20, y: 20, width: 400, height: 300 },
        opacity: 0.5,
        visible: true,
      },
      scale: {
        scaleRatio: 100,
        pixelPerMeter: 50,
      },
    },
  };

  const lines: number[][] = [];
  const addedImages: any[] = [];
  let saveGraphicsStateCalled = false;
  let restoreGraphicsStateCalled = false;

  const mockPdf: any = {};
  for (const name of [
    'setLineWidth', 'setLineDashPattern', 'setTextColor', 'setFillColor',
    'setDrawColor', 'setFont', 'setFontSize', 'path', 'fill', 'fillStroke', 'stroke',
    'circle', 'text', 'triangle', 'rect',
  ]) {
    mockPdf[name] = () => undefined;
  }
  mockPdf.line = (...args: number[]) => { lines.push(args); };
  mockPdf.addImage = (...args: any[]) => { addedImages.push(args); };
  mockPdf.saveGraphicsState = () => { saveGraphicsStateCalled = true; };
  mockPdf.restoreGraphicsState = () => { restoreGraphicsStateCalled = true; };
  mockPdf.GState = class MockGState {
    opacity: number;
    constructor(opts: any) { this.opacity = opts?.opacity; }
  };
  mockPdf.setGState = () => undefined;

  (PdfExporter as any).renderFloorPlan(mockPdf, fpPage, 420, 297, 'color');

  // Verify background image was embedded
  assert.equal(addedImages.length, 1, 'Background image must be rendered in PDF');
  assert.equal(saveGraphicsStateCalled, true, 'Graphics state should be saved for transparent background image');
  assert.equal(restoreGraphicsStateCalled, true, 'Graphics state should be restored after background image');

  // Verify walls and openings lines were generated
  assert(lines.length > 10, `Expected multiple vector lines for walls, doors, windows, openings, and arcWires, got ${lines.length}`);

  // Test monochrome mode
  lines.length = 0;
  (PdfExporter as any).renderFloorPlan(mockPdf, fpPage, 420, 297, 'monochrome');
  assert(lines.length > 10, `Monochrome floor plan rendering should also produce vector lines, got ${lines.length}`);
}

console.log('✓ Connection elements render as vector arrows/junctions in PDF without placeholder blocks');
console.log('✓ Floor plan elements (walls, doors, windows, arc wires, background image) render cleanly in PDF export');
