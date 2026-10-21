import assert from 'node:assert/strict';
import { CadCanvas } from './CadCanvas';
import { PdfExporter } from '../export/PdfExporter';
import { arcPoints, drawingToSvg, rotateDrawing } from '../model/ImportedDrawing';
import { Page, PlacedComponent, Project, SymbolDefinition } from '../model/types';

const symbol: SymbolDefinition = {
  id: 'source:test:17:0', name: 'Source library switch', category: 'protection',
  standard: 'DIN EN 60617', defaultBmkPrefix: '-Q', defaultFunctionText: '', description: '',
  width: 20, height: 30, pins: [{ id: '1', name: '1', x: 10, y: 0, direction: 'top' }], svgContent: '',
  importedGraphics: [
    { kind: 'line', x1: 10, y1: 0, x2: 10, y2: 30, color: '#000000' },
    { kind: 'circle', x: 10, y: 15, radius: 3, color: '#0000ff' },
    { kind: 'arc', x: 10, y: 15, radius: 5, startAngle: 0, endAngle: 90, color: '#000000' },
    { kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }], color: '#000000' },
  ],
};
const component: PlacedComponent = { id: 'placed', symbolId: symbol.id, bmk: '-Q1', functionText: 'Hauptschalter', technicalCharacteristics: '63 A',
  x: 100, y: 150, rotation: 90, pins: { '1': { customLabel: 'L1' } }, bmkPosition: { preset: 'left', offsetX: 3 } };
const page = { id: 'p', pageNumber: '2', title: 'Einspeisung',higherLevel:'',location:'', components: [component], wires: [],
  plotFrame: { width: 1000, height: 700 }, importedDrawing: { source: 'NATIVE_CAD', graphics: [], diagnostics: [] } } as unknown as Page;
const project = { pages: [page], symbolLibrary: [symbol] } as Project;
const canvas = Object.assign(Object.create(CadCanvas.prototype), { activePage: page, project, selectedComponentId: component.id });
const svg = canvas.renderComponents() as string;
assert.match(svg, /class="component selected"/);
assert.match(svg, /rotate\(90, 10, 15\)/);
assert.match(svg, /stroke="currentColor"/);
assert.match(svg, /fill="none"/);
assert.match(svg, />-Q1<\/text>/);
assert.match(svg, />Hauptschalter<\/text>/);
assert.match(svg, />63 A<\/text>/);
assert.match(svg, />L1<\/text>/);
component.bmk = '-Q99'; component.functionText = 'Geändert'; component.pins['1'].customLabel = 'L2';
const editedSvg = canvas.renderComponents() as string;
assert.match(editedSvg, />-Q99<\/text>/);
assert.match(editedSvg, />Geändert<\/text>/);
assert.match(editedSvg, />L2<\/text>/);
assert.doesNotMatch(editedSvg, />-Q1<\/text>/);
component.functionText = 'Zeile 1\nZeile 2';
assert.match(canvas.renderComponents(), /<tspan[^>]*>Zeile 1<\/tspan><tspan[^>]*>Zeile 2<\/tspan>/);
component.functionText = 'Geändert';

// An import metadata flag must not change editor paper, grid or frame renderer.
const scene: any = { activePage: page, svg: { innerHTML: '' }, scale: 1, panX: 0, panY: 0,
  getEffectiveGridSize: () => 8, renderPlotFrame: () => '<g id="normal-frame"/>',
};
for (const name of ['renderSelectionOverlay', 'renderCables', 'renderWires', 'renderComponents', 'renderImages', 'renderBoxes', 'renderTexts', 'renderAutoconnectPreview', 'renderInteractiveWire', 'renderInteractiveWall', 'renderHoveredPin', 'renderGhostSymbol']) scene[name] = () => '';
CadCanvas.prototype.render.call(scene);
assert.match(scene.svg.innerHTML, /fill="#1a202c"/);
assert.match(scene.svg.innerHTML, /fill="url\(#cadGrid\)"/);
assert.match(scene.svg.innerHTML, /id="normal-frame"/);
assert.doesNotMatch(scene.svg.innerHTML, /fill="#ffffff"/);

const texts: string[] = [], lines: number[][] = [], drawColors: unknown[][] = [];
const pdf: any = {};
for (const name of ['setLineWidth', 'setLineDashPattern', 'setTextColor', 'setFillColor', 'setFont', 'setFontSize', 'circle', 'rect', 'path', 'fillStroke', 'stroke']) pdf[name] = () => undefined;
pdf.text = (text: string) => texts.push(text);
pdf.line = (...coords: number[]) => lines.push(coords);
pdf.setDrawColor = (...color: unknown[]) => drawColors.push(color);
(PdfExporter as any).renderComponents(pdf, page, project, 420, 297, { colorMode: 'color' }, new Map());
assert.ok(texts.includes('-Q99') && texts.includes('Geändert') && texts.includes('63 A') && texts.includes('L2'));
assert.deepEqual(drawColors[0], [0, 0, 0], 'Library outlines must use black on white PDF paper');
assert.ok(lines.length > 0, 'The source vectors are exported rather than a fallback symbol');

const arc = { kind: 'arc' as const, x: 0, y: 0, radius: 10, startAngle: 0, endAngle: 90, color: '#000000' };
const points = arcPoints(arc);
assert.deepEqual(points[0], { x: 10, y: 0 });
assert.ok(Math.abs(points.at(-1)!.x) < 1e-9 && Math.abs(points.at(-1)!.y - 10) < 1e-9);
assert.match(drawingToSvg([arc]), /<polyline/);
const rotated = rotateDrawing([{ kind: 'rect', x: 0, y: 0, width: 10, height: 20, color: '#000000' }], 45, 10, 20);
assert.equal(rotated[0].kind, 'polygon', 'Rotation must preserve rectangle corners, not collapse to its diagonal bounds');
console.log('✓ Standard editor and PDF rendering for shared imported library symbols');

// Moving either end of an explicitly routed source wire must preserve its
// anchors, stay connected and remain orthogonal in editor, drag and PDF paths.
const { orthogonalWirePoints, wirePinDirection } = await import('../model/WireRouting');
const anchors = [{ x: 0, y: 20 }, { x: 30, y: 20 }];
const originalAnchors = JSON.stringify(anchors);
assert.deepEqual(orthogonalWirePoints({ x: 0, y: 0 }, { x: 30, y: 40 }, anchors, 'bottom', 'top'),
  [{ x: 0, y: 0 }, ...anchors, { x: 30, y: 40 }]);
const movedFrom = { x: 10, y: 5 }, movedTo = { x: 40, y: 50 };
const routed = orthogonalWirePoints(movedFrom, movedTo, anchors, 'right', 'bottom');
assert.deepEqual(routed[0], movedFrom); assert.deepEqual(routed.at(-1), movedTo);
assert.ok(routed.slice(1).every((p, i) => p.x === routed[i].x || p.y === routed[i].y));
for (const anchor of anchors) assert.ok(routed.some(p => p.x === anchor.x && p.y === anchor.y));
assert.ok(routed[1].x > movedFrom.x && routed[1].y === movedFrom.y, 'Leave the rotated pin in its outward direction');
assert.ok(routed.at(-2)!.y > movedTo.y && routed.at(-2)!.x === movedTo.x, 'Approach the terminal from its outward side');
assert.equal(JSON.stringify(anchors), originalAnchors, 'Rendering must not mutate stored source routes');
assert.equal(wirePinDirection(page, project, { componentId: component.id, pinId: '1' }), 'right');
console.log('✓ Explicit wire anchors remain orthogonal and attached when components move');

// Labels follow the component anchor, but keep their independent text angle.
component.rotation = 180;
const upright = canvas.renderComponents();
assert.match(upright, /rotate\(180, 10, 15\)/);
assert.match(upright, /transform="rotate\(-180,/);
const pdfTexts: {text: string; x: number; y: number; angle: number}[] = [];
pdf.text = (text: string, x: number, y: number, options: any = {}) => pdfTexts.push({text,x,y,angle:options.angle ?? 0});
(PdfExporter as any).renderComponents(pdf, page, project, 420, 297, { colorMode: 'color' }, new Map());
assert.equal(Math.abs(pdfTexts.find(t => t.text === '-Q99')!.angle), 0);
const lettering = rotateDrawing([{kind:'text',x:5,y:8,size:6,text:'M',color:'#000',rotation:0}],180,20,30)[0];
assert.deepEqual(lettering, {kind:'text',x:15,y:22,size:6,text:'M',color:'#000',rotation:0});
console.log('✓ Rotation moves labels and internal lettering without turning their text upside down');

// PDF outlines must rotate with the electrical pins, including built-in symbols.
const { getSymbolById } = await import('../model/symbols');
const { AutoconnectEngine } = await import('../model/AutoconnectEngine');
const builtIn = getSymbolById('contact_no')!;
for (const rotation of [90,180,270] as const) {
  const c = {...component,symbolId:builtIn.id,rotation,bmk:'-K1',functionText:'Licht'};
  const p = {...page,components:[c]};
  lines.length=0;
  (PdfExporter as any).renderComponents(pdf,p,{...project,pages:[p]},420,297,{colorMode:'color'},new Map());
  for (const pin of builtIn.pins) {
    const world = AutoconnectEngine.getRotatedPinInfo(c,pin,builtIn);
    const x=world.worldX*.42,y=world.worldY*297/700;
    assert(lines.some(l=>Math.hypot(l[0]-x,l[1]-y)<1e-7 || Math.hypot(l[2]-x,l[3]-y)<1e-7),`PDF outline meets rotated ${rotation}° pin ${pin.id}`);
  }
}
console.log('✓ Built-in PDF contours remain attached to rotated electrical pins');

component.crossRef='/2.4';component.crossRefFontSize=3;component.pinLabelFontSize=4;
component.bmkPosition={...component.bmkPosition,fontSize:5};
const sizes: {text:string;size:number}[]=[];let currentSize=0;
pdf.setFontSize=(size:number)=>{currentSize=size;};pdf.text=(text:string)=>sizes.push({text,size:currentSize});
(PdfExporter as any).renderComponents(pdf,page,project,420,297,{colorMode:'color'},new Map());
assert(Math.abs(sizes.find(t=>t.text==='-Q99')!.size-5*297/700*72/25.4)<1e-7);
assert(Math.abs(sizes.find(t=>t.text==='/2.4')!.size-3*297/700*72/25.4)<1e-7);
assert.match(canvas.renderComponents(),/font-size="3"/);
console.log('✓ Individual label and cross-reference sizes are reflected in SVG and physical PDF fonts');

// Moved reference anchors and their PDF links follow a rotated component while
// retaining the independent text angle and the individual label settings.
const referenceTexts:{text:string;x:number;y:number;align:string;angle:number}[]=[];
const links:number[][]=[];
pdf.text=(text:string,x:number,y:number,o:any={})=>referenceTexts.push({text,x,y,align:o.align,angle:o.angle ?? 0});
pdf.getTextWidth=()=>12;pdf.link=(x:number,y:number,w:number,h:number)=>links.push([x,y,w,h]);
component.crossRefPosition={preset:'right',offsetX:2.125,offsetY:-3.875,alignment:'start',rotation:90};
for(const rotation of [0,90,180,270] as const){
  component.rotation=rotation;referenceTexts.length=0;links.length=0;
  const before: string=JSON.stringify(component.bmkPosition);
  const output=canvas.renderComponents();
  assert.match(output,/class="cross-reference"[^>]*x="30.125" y="11.125"/);
  assert.match(output,/data-crossref-source="placed"/,'Moved SVG references remain clickable');
  (PdfExporter as any).renderComponents(pdf,page,project,420,297,{colorMode:'color',interactiveCrossReferences:true},new Map([['2',1]]));
  const text=referenceTexts.find(t=>t.text==='/2.4')!;
  const a=rotation*Math.PI/180,dx=30.125-10,dy=11.125-15;
  assert(Math.abs(text.x-(component.x+10+dx*Math.cos(a)-dy*Math.sin(a))*.42)<1e-7);
  assert(Math.abs(text.y-(component.y+15+dx*Math.sin(a)+dy*Math.cos(a))*297/700)<1e-7);
  assert.equal(text.angle,-90);assert.equal(text.align,'left');assert.equal(links.length,1);
  assert(text.x>=links[0][0]-1e-7&&text.x<=links[0][0]+links[0][2]+1e-7);
  assert(text.y>=links[0][1]-1e-7&&text.y<=links[0][1]+links[0][3]+1e-7);
  assert.equal(JSON.stringify(component.bmkPosition),before);
}
component.crossRefPosition.visible=false;referenceTexts.length=0;links.length=0;
assert.doesNotMatch(canvas.renderComponents(),/class="cross-reference"/);
(PdfExporter as any).renderComponents(pdf,page,project,420,297,{colorMode:'color',interactiveCrossReferences:true},new Map([['2',1]]));
assert(!referenceTexts.some(t=>t.text==='/2.4'));assert.equal(links.length,0);
console.log('✓ Editable reference positions agree in SVG and PDF, including rotated text, clickable links and visibility');

component.additionalText='Gravur <1>\nZweite Zeile';
component.additionalTextPosition={preset:'custom',offsetX:4,offsetY:7,fontSize:6,fontColor:'#ff00ff'};
component.functionTextPosition={fontColor:'#ff00ff'};
component.rotation=0;
const engravingSvg=canvas.renderComponents();
assert.match(engravingSvg,/class="additional-text" x="14" y="71" font-size="6"[^>]*fill="#ff00ff"/);
assert.match(engravingSvg,/Gravur &lt;1&gt;/);
assert.match(engravingSvg,/fill="#ff00ff"[^>]*>Geändert<\/text>/);
let currentColor:unknown[]=[];const coloredLabels:{text:string;color:unknown[]}[]=[];
pdf.setTextColor=(...color:unknown[])=>{currentColor=color;};
pdf.text=(text:string)=>coloredLabels.push({text,color:currentColor});
(PdfExporter as any).renderComponents(pdf,page,project,420,297,{colorMode:'color'},new Map());
assert.deepEqual(coloredLabels.find(t=>t.text===component.additionalText)?.color,[255,0,255]);
assert.deepEqual(coloredLabels.find(t=>t.text===component.functionText)?.color,[255,0,255]);
coloredLabels.length=0;
(PdfExporter as any).renderComponents(pdf,page,project,420,297,{colorMode:'monochrome'},new Map());
assert.deepEqual(coloredLabels.find(t=>t.text===component.additionalText)?.color,[0,0,0]);
component.additionalTextPosition.visible=false;
assert.doesNotMatch(canvas.renderComponents(),/class="additional-text"/);
coloredLabels.length=0;
(PdfExporter as any).renderComponents(pdf,page,project,420,297,{colorMode:'color'},new Map());
assert(!coloredLabels.some(t=>t.text===component.additionalText));
console.log('✓ Editable engraving text and imported label colors agree in SVG and PDF; monochrome and explicit hiding remain supported');

// Embedded page images are selectable in the normal editor, and deleting an
// image leaves all electrical components and connections untouched.
page.images=[{id:'graphic',dataUrl:'data:image/png;base64,AA==',x:400,y:80,width:120,height:60,caption:'Grafik'}];
canvas.selectedComponentId=null;canvas.selectedImageId='graphic';
const imageSvg=canvas.renderImages();
assert.match(imageSvg,/data-image-id="graphic"/);
assert.match(imageSvg,/class="embedded-image selected"/);
assert.match(imageSvg,/pointer-events="all"/);
assert.match(imageSvg,/preserveAspectRatio="xMidYMid meet"/);
assert.match(imageSvg,/class="image-selection-rect"[^>]*visibility="visible"/);
let imageEdits=0;
canvas.callbacks={onSelectComponent:()=>{},onSelectWire:()=>{},onProjectModified:()=>{imageEdits++;}};
canvas.updateSelectionClasses=()=>{};canvas.render=()=>{};canvas.autoconnectEnabled=false;
component.crossRef=''; // Clear the synthetic reference fixture before normal recomputation.
const electricalBefore=JSON.stringify({components:page.components,wires:page.wires});
canvas.deleteSelected();
assert.deepEqual(page.images,[]);assert.equal(imageEdits,1);assert.equal(canvas.selectedImageId,null);
assert.equal(JSON.stringify({components:page.components,wires:page.wires}),electricalBefore);
console.log('✓ Embedded images are interactive and image deletion records a single edit without changing electrical objects');

// A directly hit image wins over a loose imported component bounding box.
// Imported large outlines can surround a visible image without drawing there.
const hitImage={id:'hit-image',dataUrl:'data:image/png;base64,AA==',x:10,y:20,width:40,height:50};
const hitCanvas=Object.assign(Object.create(CadCanvas.prototype),{activePage:{...page,images:[hitImage]},project,
  callbacks:{onSelectComponent:()=>{},onSelectWire:()=>{}},updateSelectionClasses:()=>{},
  cableFromEvent:()=>undefined,imageFromEvent:()=>hitImage,findComponentAt:()=>{throw new Error('A direct image target must not use a loose component hitbox');}});
assert.equal(hitCanvas.handleSelectionMouseDown({}, {x:20,y:30}),true);
assert.equal(hitCanvas.selectedImageId,'hit-image');assert(hitCanvas.selectionDrag);

// Architectural walls and openings are selectable, editable and deletable
const floorPlanPage: Page = {
  ...page,
  floorPlan: {
    scale: { scaleRatio: 100, pixelPerMeter: 50 },
    walls: [
      { id: 'w1', start: { x: 100, y: 100 }, end: { x: 300, y: 100 }, thickness: 3.5, isExterior: true },
      { id: 'w2', start: { x: 300, y: 100 }, end: { x: 300, y: 300 }, thickness: 2.0, isExterior: false }
    ],
    openings: [
      { id: 'd1', kind: 'door', center: { x: 200, y: 100 }, width: 88.5, orientation: 'horizontal', wallId: 'w1' }
    ],
    rooms: []
  }
};
const fpCanvas = Object.assign(Object.create(CadCanvas.prototype), {
  activePage: floorPlanPage,
  project,
  callbacks: {
    onSelectComponent: () => {},
    onSelectWire: () => {},
    onSelectWall: (w: any) => { fpCanvas.selectedWall = w; },
    onSelectOpening: (op: any) => { fpCanvas.selectedOpening = op; },
    onProjectModified: () => {}
  },
  render: () => {},
  notifyModified: () => {},
  snap: (val: number) => val,
  clearMultipleSelection: () => {}
});

// Select wall
fpCanvas.selectWall(floorPlanPage.floorPlan!.walls[0]);
assert.equal(fpCanvas.selectedWallId, 'w1');

// Add window
const newWin = fpCanvas.addOpening('window', { x: 300, y: 200 }, 'w2');
assert.equal(newWin.kind, 'window');
assert.equal(floorPlanPage.floorPlan!.openings.length, 2);
assert.equal(fpCanvas.selectedOpeningId, newWin.id);

// Delete opening
fpCanvas.deleteSelected();
assert.equal(floorPlanPage.floorPlan!.openings.length, 1);
assert.equal(floorPlanPage.floorPlan!.openings[0].id, 'd1');
assert.equal(fpCanvas.selectedOpeningId, null);

// Delete wall w1 - should also remove door d1 attached to w1
fpCanvas.selectWall(floorPlanPage.floorPlan!.walls[0]);
fpCanvas.deleteSelected();
assert.equal(floorPlanPage.floorPlan!.walls.length, 1);
assert.equal(floorPlanPage.floorPlan!.walls[0].id, 'w2');
assert.equal(floorPlanPage.floorPlan!.openings.length, 0); // door d1 was removed with w1
assert.equal(fpCanvas.selectedWallId, null);

console.log('✓ Architectural floor plan walls and openings: selection, addition, editing and deletion verified');
