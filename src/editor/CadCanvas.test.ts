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
for (const name of ['renderSelectionOverlay', 'renderCables', 'renderWires', 'renderComponents', 'renderImages', 'renderBoxes', 'renderTexts', 'renderAutoconnectPreview', 'renderInteractiveWire', 'renderInteractiveWall', 'renderHoveredPin', 'renderGhostSymbol', 'renderGhostOpening', 'renderMagnifierSvg']) scene[name] = () => '';
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

// Interruption points: label (BMK/function text) and cross-reference stack cleanly without collision
const nativeArrowSym: SymbolDefinition = {
  ...getSymbolById('potential_arrow_right')!,
  id: 'native:SPECIAL:8:0',
  source: { library: 'SPECIAL', number: 8, variant: 0 },
  importedGraphics: [],
  pins: [{ id: '0', name: '1', x: 0, y: 10, direction: 'left' }, { id: '1', name: '2', x: 20, y: 10, direction: 'right' }]
};
const intArrow: PlacedComponent = {
  id: 'int1', symbolId: nativeArrowSym.id, x: 100, y: 100, rotation: 0,
  bmk: '', functionText: 'L1PV', crossRef: '/1.2', pins: { '0': { wireIds: ['w1'] } }
};
const wireTarget: PlacedComponent = {
  id: 'int_target', symbolId: builtIn.id, x: 50, y: 100, rotation: 0, bmk: '-X1', functionText: '', pins: { '0': { wireIds: ['w1'] } }
};
const intPage: Page = {
  ...page,
  components: [intArrow, wireTarget],
  wires: [{ id: 'w1', from: { componentId: 'int1', pinId: '0' }, to: { componentId: 'int_target', pinId: '0' }, potential: 'L1' }]
};
const intProject: Project = { ...project, pages: [intPage], symbolLibrary: [nativeArrowSym, builtIn] };
const intCanvas = Object.assign(Object.create(CadCanvas.prototype), {
  activePage: intPage, project: intProject, getElementSelection: () => ({ componentIds: [] }), getComponentScale: () => 1
});
const intSvg = intCanvas.renderComponents();
assert.match(intSvg, /L1PV/);
assert.match(intSvg, /\/1\.2/);
const fnMatch = intSvg.match(/data-label="functionTextPosition"[^>]*\by="(-?\d+(?:\.\d+)?)"[^>]*>L1PV<\/text>/);
const crMatch = intSvg.match(/class="cross-reference"[^>]*\by="(-?\d+(?:\.\d+)?)"[^>]*>.*\/1\.2/);
assert(fnMatch && crMatch, 'Both function text and cross-reference must be rendered');
const fnY = parseFloat(fnMatch[1]), crY = parseFloat(crMatch[1]);
assert(Math.abs(fnY - crY) >= 8, `Interruption label and reference must not collide (fnY=${fnY}, crY=${crY})`);
console.log('✓ Interruption point labels and cross-references render stacked without overlapping');

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
  floorPlanEditMode: false,
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

// Test floorPlanEditMode toggle and new opening kinds
assert.equal(fpCanvas.floorPlanEditMode, false, 'Default floorPlanEditMode should be false');
fpCanvas.setFloorPlanEditMode(true);
assert.equal(fpCanvas.floorPlanEditMode, true);
const opPassage = fpCanvas.addOpening('opening', { x: 200, y: 150 });
assert.equal(opPassage?.kind, 'opening');
const opGarage = fpCanvas.addOpening('garage_door', { x: 250, y: 150 });
assert.equal(opGarage?.kind, 'garage_door');
fpCanvas.setFloorPlanEditMode(false);
assert.equal(fpCanvas.floorPlanEditMode, false);
assert.equal(fpCanvas.selectedOpeningId, null, 'Deselect opening when edit mode is toggled off');

console.log('✓ Architectural floor plan walls and openings: selection, addition, editing and deletion verified');

// Text elements: rendering, selection, rotation, and deletion
const textPage: Page = {
  ...page,
  texts: [
    {
      id: 'txt1',
      text: 'Hauptverteilung EG\nFeld A',
      x: 150,
      y: 200,
      fontSize: 14,
      fontColor: '#48bb78',
      fontWeight: 'bold',
      fontStyle: 'italic',
      align: 'center',
      rotation: 0
    }
  ]
};

let selectedTextCallback: any = null;
const textCanvas = Object.assign(Object.create(CadCanvas.prototype), {
  activePage: textPage,
  project,
  selectedTextId: null,
  callbacks: {
    onSelectComponent: () => {},
    onSelectWire: () => {},
    onSelectText: (t: any) => { selectedTextCallback = t; },
    onProjectModified: () => {}
  },
  getElementSelection: () => ({ textIds: textCanvas.selectedTextId ? [textCanvas.selectedTextId] : [] }),
  setElementSelection: () => {},
  clearMultipleSelection: () => {},
  render: () => {},
  notifyModified: () => {}
});

// Render unselected text
const renderedUnselected = textCanvas.renderTexts() as string;
assert.match(renderedUnselected, /data-text-id="txt1"/);
assert.match(renderedUnselected, /font-size="14"/);
assert.match(renderedUnselected, /font-weight="bold"/);
assert.match(renderedUnselected, /font-style="italic"/);
assert.match(renderedUnselected, /fill="#48bb78"/);
assert.match(renderedUnselected, /text-anchor="middle"/);
assert.match(renderedUnselected, /<tspan[^>]*>Hauptverteilung EG<\/tspan>/);
assert.match(renderedUnselected, /<tspan[^>]*>Feld A<\/tspan>/);
assert.doesNotMatch(renderedUnselected, /stroke-dasharray="3,2"/);

// Select text
textCanvas.selectText(textPage.texts![0]);
assert.equal(textCanvas.selectedTextId, 'txt1');
assert.equal(selectedTextCallback?.id, 'txt1');

// Render selected text (must NOT contain dashed outline)
const renderedSelected = textCanvas.renderTexts() as string;
assert.match(renderedSelected, /class="canvas-text selected"/);
assert.doesNotMatch(renderedSelected, /stroke-dasharray="3,2"/);

// Rotate selected text
textCanvas.rotateSelected(90);
assert.equal(textPage.texts![0].rotation, 90);
const renderedRotated = textCanvas.renderTexts() as string;
assert.match(renderedRotated, /transform="rotate\(90, 150, 200\)"/);

// Delete selected text
textCanvas.deleteSelected();
assert.equal(textPage.texts?.length, 0);
assert.equal(textCanvas.selectedTextId, null);

console.log('✓ Text elements: rendering, multiline tspans, formatting, selection, rotation and deletion verified');

// Touch hit target padding and mobile optimization tests
{
  const touchTestComp: PlacedComponent = {
    id: 'touch_comp', symbolId: symbol.id, bmk: '-Q50', functionText: 'TouchTest', technicalCharacteristics: '',
    x: 200, y: 300, rotation: 0, pins: { '1': {} }
  };
  const touchPage = {
    id: 'tp', pageNumber: '3', title: 'TouchSheet', higherLevel: '', location: '',
    components: [touchTestComp], wires: [], plotFrame: { width: 1000, height: 700 }
  } as unknown as Page;
  const touchCanvas = Object.assign(Object.create(CadCanvas.prototype), {
    activePage: touchPage,
    project: { pages: [touchPage], symbolLibrary: [symbol] },
    getComponentScale: () => 1,
    getPinCoordinates: (cid: string, pid: string) => {
      if (cid === 'touch_comp' && pid === '1') return { x: 210, y: 300 };
      return null;
    }
  });

  // Test findComponentAt: at distance 10px outside the visual box
  // symbol width=20, height=30. cx=210, cy=315. Right edge is at x=220.
  // Query at x=228 (8px past the visual boundary):
  const mouseCompHit = (touchCanvas as any).findComponentAt(228, 315, false);
  const touchCompHit = (touchCanvas as any).findComponentAt(228, 315, true);
  assert.equal(mouseCompHit, null, 'Desktop mouse with pad=2 must strictly ignore clicks 8px outside component');
  assert.equal(touchCompHit?.id, 'touch_comp', 'Touch interaction with pad=18 must generously hit 8px outside for fingers');

  // Test findPinAt: at distance 12px away from pin center (210, 300)
  // Query at (210, 312) which is exactly 12px away
  const mousePinHit = (touchCanvas as any).findPinAt(210, 312, false);
  const touchPinHit = (touchCanvas as any).findPinAt(210, 312, true);
  assert.equal(mousePinHit, null, 'Desktop mouse with pinRadius=8 must ignore pin 12px away');
  assert.deepEqual(touchPinHit, { componentId: 'touch_comp', pinId: '1' }, 'Touch interaction with pinRadius=16 must reliably hit pin 12px away for fingers');

  console.log('✓ Touch hit targets: verified separate generous touch padding (components, pins) without altering mouse precision');
}

// Touch navigation, zoom, and wall/opening proximity tests
{
  const testWall = { id: 'w1', start: { x: 100, y: 100 }, end: { x: 300, y: 100 }, thickness: 240 };
  const testOpening = { id: 'op1', wallId: 'w1', kind: 'door' as const, center: { x: 200, y: 100 }, width: 80 };
  const fpPage = {
    id: 'fpp', pageNumber: '4', title: 'FP', higherLevel: '', location: '',
    components: [], wires: [], plotFrame: { width: 1000, height: 700 },
    pageType: 'floor_plan',
    floorPlan: {
      walls: [testWall],
      openings: [testOpening],
      scale: { pixelPerMeter: 50, measuredDistanceM: 5, pixelDistance: 250 }
    }
  } as unknown as Page;

  const canvas = Object.assign(Object.create(CadCanvas.prototype), {
    activePage: fpPage,
    project: { pages: [fpPage], symbolLibrary: [] },
    selectedWallId: 'w1',
    floorPlanEditMode: true,
    multiSelectMode: false,
    mode: 'select',
    snap: (v: number) => v,
    callbacks: { onSelectComponent: () => {}, onSelectWire: () => {}, onSelectOpening: () => {}, onSelectWall: () => {} },
    scale: 1.0,
    panX: 100,
    panY: 50,
    container: { getBoundingClientRect: () => ({ width: 800, height: 600, left: 0, top: 0 }) },
    render: () => {}
  });

  // 1. Multi-select mode toggle
  assert.equal(canvas.multiSelectMode, false);
  assert.equal(canvas.toggleMultiSelectMode(), true);
  assert.equal(canvas.multiSelectMode, true);
  assert.equal(canvas.toggleMultiSelectMode(false), false);
  assert.equal(canvas.multiSelectMode, false);

  // 2. Pan and centered zoom
  canvas.panBy(40, -20);
  assert.equal(canvas.panX, 140);
  assert.equal(canvas.panY, 30);

  canvas.zoomIn(1.2, 400, 300);
  assert.equal(Math.round(canvas.scale * 100) / 100, 1.2);

  canvas.zoomOut(1 / 1.2, 400, 300);
  assert.equal(Math.round(canvas.scale * 100) / 100, 1.0);
  assert.equal(Math.round(canvas.panX), 140);
  assert.equal(Math.round(canvas.panY), 30);

  // 3. Wall handle & body proximity check (handle at 100, 100)
  // Touch query at 120, 100 (dist 20px <= 36px touch tolerance, but > 14px desktop tolerance)
  const fakeEvent = { target: null } as unknown as Event;
  const desktopHit = (canvas as any).wallHandleFromEvent(fakeEvent, { x: 120, y: 100 }, false);
  const touchHit = (canvas as any).wallHandleFromEvent(fakeEvent, { x: 120, y: 100 }, true);
  assert.equal(desktopHit?.handle, undefined, 'Desktop mouse must not trigger handle at 20px distance');
  assert.equal(touchHit?.handle, 'start', 'Touch with 36px screen proximity must reliably hit start handle at 20px distance');

  // Test wall body proximity for whole wall move: query at (200, 115) -> dist 15px from wall line
  const desktopBody = (canvas as any).wallFromEvent(fakeEvent, { x: 200, y: 115 }, false);
  const touchBody = (canvas as any).wallFromEvent(fakeEvent, { x: 200, y: 115 }, true);
  assert.equal(desktopBody, undefined, 'Desktop mouse must not hit wall body 15px away');
  assert.equal(touchBody?.wall.id, 'w1', 'Touch must hit wall body within tolerance for moving whole wall');

  // Test mobile phone zoomed-out scale (e.g. scale = 0.35)
  canvas.scale = 0.35;
  // Point at 80 world units away = 80 * 0.35 = 28 screen pixels away
  const phoneTouchHit = (canvas as any).wallHandleFromEvent(fakeEvent, { x: 100, y: 180 }, true);
  assert.equal(phoneTouchHit?.handle, 'start', 'On zoomed out phone (scale 0.35), 28 screen px must reliably hit handle');
  canvas.scale = 1.0;

  // 4. Opening proximity check (center at 200, 100)
  const desktopOp = (canvas as any).openingFromEvent(fakeEvent, { x: 220, y: 100 }, false);
  const touchOp = (canvas as any).openingFromEvent(fakeEvent, { x: 220, y: 100 }, true);
  assert.equal(desktopOp, undefined, 'Desktop mouse must not hit opening 20px away without element click');
  assert.equal(touchOp?.id, 'op1', 'Touch must hit opening within generous center proximity');

  // 5. Selecting an already selected wall must NOT re-render (avoids destroying DOM during touch)
  let renderCalls = 0;
  canvas.render = () => { renderCalls++; };
  canvas.selectedWallId = 'w1';
  canvas.callbacks = { onSelectComponent: () => {}, onSelectWire: () => {} };
  canvas.selectWall(testWall);
  assert.equal(renderCalls, 0, 'selectWall must return early without re-rendering if wall is already selected');

  canvas.selectWall(null);
  assert.equal(renderCalls, 1, 'selectWall must re-render when selection actually changes');

  // 6. Context menu suppression after touch
  canvas.lastTouchTime = Date.now();
  let ctxMenuTriggered = false;
  canvas.triggerContextMenu = () => { ctxMenuTriggered = true; };
  canvas.onContextMenu({ preventDefault: () => {} } as unknown as MouseEvent);
  assert.equal(ctxMenuTriggered, false, 'Context menu must be suppressed right after touch interaction on mobile');

  canvas.lastTouchTime = Date.now() - 2000;
  canvas.onContextMenu({ preventDefault: () => {}, clientX: 10, clientY: 10, target: null } as unknown as MouseEvent);
  assert.equal(ctxMenuTriggered, true, 'Context menu must open for desktop mouse clicks');

  // 7. Touch Drag Magnifier (Loupe): furthest corner positioning
  const mockSvg: any = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 700 }),
    getElementById: (id: string) => ({
      style: {},
      setAttribute: () => {},
      textContent: ''
    })
  };
  canvas.svg = mockSvg;
  canvas.magnifierCorner = 'top-left';

  // Finger at bottom-right (350, 600) -> furthest corner must be top-left
  (canvas as any).updateMagnifier(350, 600, 100, 100, 'Test Label');
  assert.equal((canvas as any).magnifierCorner, 'top-left', 'When dragging at bottom-right, loupe must dock at top-left');

  // Finger at top-left (30, 40) -> furthest corner must switch to bottom-right
  (canvas as any).updateMagnifier(30, 40, 100, 100, 'Test Label');
  assert.equal((canvas as any).magnifierCorner, 'bottom-right', 'When dragging at top-left, loupe must dock at bottom-right');

  // Finger at top-right (370, 50) -> furthest corner must switch to bottom-left
  (canvas as any).updateMagnifier(370, 50, 100, 100, 'Test Label');
  assert.equal((canvas as any).magnifierCorner, 'bottom-left', 'When dragging at top-right, loupe must dock at bottom-left');

  (canvas as any).hideMagnifier();

  // 8. Opening touch drag test: must not re-render during touchstart or touchmove
  let opRenderCalls = 0;
  canvas.render = () => { opRenderCalls++; };
  canvas.selectedOpeningId = null;
  const mockOpeningEl: any = {
    setAttribute: (attr: string, val: string) => { mockOpeningEl[attr] = val; },
    removeAttribute: (attr: string) => { delete mockOpeningEl[attr]; },
    classList: { toggle: () => {} }
  };
  mockSvg.querySelector = (selector: string) => {
    if (selector.includes('data-opening-id="op1"')) return mockOpeningEl;
    return null;
  };
  mockSvg.querySelectorAll = () => [];

  // Touch start on door (at 200, 100)
  canvas.screenToWorld = (x: number, y: number) => ({ x, y });
  const fakeTouchStart = {
    touches: [{ clientX: 200, clientY: 100 }],
    target: { closest: () => null },
    preventDefault: () => {}
  } as unknown as TouchEvent;

  canvas.onTouchStart(fakeTouchStart);
  assert.equal(canvas.selectedOpeningId, 'op1', 'Door must be selected on touchstart');
  assert.equal(canvas.openingDrag?.opening.id, 'op1', 'openingDrag must be active');
  assert.equal(opRenderCalls, 0, 'Must NOT re-render on touchstart (preserves DOM and touch tracking)');

  // Touch move 50px right (to 250, 100)
  const fakeTouchMove = {
    touches: [{ clientX: 250, clientY: 100 }],
    preventDefault: () => {}
  } as unknown as TouchEvent;
  canvas.onTouchMove(fakeTouchMove);
  assert.equal(testOpening.center.x, 250, 'Door center.x must move along wall to 250');
  assert.equal(testOpening.center.y, 100, 'Door center.y must stay constrained to wall line at 100');
  assert.equal(mockOpeningEl.transform, 'translate(50, 0)', 'Opening DOM element must receive fast translate transform');
  assert.equal(opRenderCalls, 0, 'Must NOT re-render on touchmove (smooth 60fps drag without DOM churn)');

  // Touch end
  canvas.onTouchEnd({ type: 'touchend', touches: [] } as unknown as TouchEvent);
  assert.equal(canvas.openingDrag, null, 'openingDrag must be cleared on touchend');
  assert.equal(mockOpeningEl.transform, undefined, 'Temporary transform must be removed on touchend');
  assert.equal(opRenderCalls, 1, 'Must re-render once on touchend to finalize floor plan');

  // 9. When floorPlanEditMode is false, touching or clicking a wall/opening must NOT select or drag it
  canvas.floorPlanEditMode = false;
  canvas.selectedWallId = null;
  canvas.selectedOpeningId = null;
  canvas.onTouchStart(fakeTouchStart);
  assert.equal(canvas.selectedOpeningId, null, 'Must not select opening when floorPlanEditMode is disabled');
  assert.equal(canvas.selectedWallId, null, 'Must not select wall when floorPlanEditMode is disabled');
  assert.equal(canvas.openingDrag ?? null, null, 'Must not start openingDrag when floorPlanEditMode is disabled');
  assert.equal(canvas.wallDrag ?? null, null, 'Must not start wallDrag when floorPlanEditMode is disabled');

  // 10. Ctrl+Arrow nudges selected elements by one grid step
  const nudgeComp: PlacedComponent = {
    id: 'nudge_c1', symbolId: symbol.id, bmk: '-K1', functionText: '', technicalCharacteristics: '',
    x: 80, y: 120, rotation: 0, pins: {}
  };
  const nudgePage = {
    id: 'np', pageNumber: '5', title: 'Nudge', higherLevel: '', location: '',
    components: [nudgeComp], wires: [], plotFrame: { width: 1000, height: 700 },
    grid: { spacing: 8, origin: { x: 0, y: 0 } }
  } as unknown as Page;
  const nudgeCanvas = Object.assign(Object.create(CadCanvas.prototype), {
    activePage: nudgePage,
    project: { pages: [nudgePage], symbolLibrary: [symbol] },
    gridSize: 8,
    gridSnap: true,
    gridResolution: 'full',
    selectedComponentId: 'nudge_c1',
    autoconnectEnabled: false,
    callbacks: { onSelectComponent: () => {}, onSelectWire: () => {}, onProjectModified: () => {} },
    notifyModified: () => {},
    render: () => {}
  });
  assert.equal(nudgeCanvas.nudgeSelectedByGrid(1, 0), true);
  assert.equal(nudgeComp.x, 88, 'Ctrl+ArrowRight moves component by +1 grid step (8 units)');
  assert.equal(nudgeComp.y, 120);
  assert.equal(nudgeCanvas.nudgeSelectedByGrid(0, -1), true);
  assert.equal(nudgeComp.y, 112, 'Ctrl+ArrowUp moves component by -1 grid step (-8 units)');

  console.log('✓ Touch navigation, centered zoom, multi-select and wall/opening proximity tests verified');
}
