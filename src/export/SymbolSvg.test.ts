import assert from 'node:assert/strict';
import { renderSymbolSvg } from './SymbolSvg';
import { PdfExporter } from './PdfExporter';
import { CadCanvas } from '../editor/CadCanvas';
import { fixture, add } from '../layout/testing/fixture';
import { getSymbolById, getSymbolDefinitions } from '../model/symbols';
import { AutoconnectEngine } from '../model/AutoconnectEngine';
import { computePinLabelPosition } from '../model/LabelLayout';
import { rotatedLocalPoint } from '../model/SymbolGeometry';

function recorder() {
  const calls: {name: string; args: any[]}[] = [];
  const pdf: any = new Proxy({}, {get: (_,name: string) => (...args: any[]) => {calls.push({name,args});}});
  return {pdf,calls,of:(name: string) => calls.filter(c => c.name === name).map(c => c.args)};
}
const close = (a: number,b: number) => Math.abs(a-b)<1e-7;
// A legacy socket has contacts at x=10/18/26 and a semicircle. The former
// independent PDF approximation used x=9/18/27 and a closed oval with two dots.
for (const units of [2,4]) for (const rotation of [0,90,180,270] as const) {
  const project=fixture();project.drawingUnitsPerMm=units;const page=project.pages[0];
  const c=add(project,'socket','socket_schuko',100,120);c.rotation=rotation;
  const sym=getSymbolById(c.symbolId,project)!,tape=recorder();
  (PdfExporter as any).renderComponents(tape.pdf,page,project,page.plotFrame.width,page.plotFrame.height,{colorMode:'color'},new Map());
  for (const pin of sym.pins) {
    const p=AutoconnectEngine.getRotatedPinInfo(c,pin,sym);
    assert(tape.of('line').some(l => close(l[0],p.worldX)&&close(l[1],p.worldY)),`Socket contour meets port ${pin.id}, ${rotation}°, ${units} units/mm`);
    const label=computePinLabelPosition(c,sym,pin),pLabel=rotatedLocalPoint(label,sym,rotation);
    const text=tape.of('text').find(t => t[0]===pin.name)!;
    assert(close(text[1],c.x+pLabel.x)&&close(text[2],c.y+pLabel.y),'Shared pin label anchors');
    assert.equal(text[3].align,label.anchor==='middle'?'center':label.anchor==='end'?'right':'left');
  }
  assert.equal(tape.of('ellipse').length,0,'No invented oval');
  assert.equal(tape.of('circle').length,0,'No printed editor handles or invented socket dots');
  assert(tape.of('path').some(([path]) => path.some((c:any) => c.op==='c')&&path.at(-1).op==='h'),'Actual closed library arc');
  assert(tape.of('setFont').some(f => f[0]==='courier'&&f[1]==='bold'),'BMK retains monospace font');
}
// Project master data must win even for a built-in ID.
{
  const project=fixture(),c=add(project,'custom','socket_schuko'),custom=structuredClone(getSymbolById(c.symbolId,project)!);
  custom.svgContent='<line x1="5" y1="6" x2="31" y2="22" stroke="currentColor" stroke-width="2"/>';
  project.symbolLibrary=[custom];const tape=recorder();
  (PdfExporter as any).renderComponents(tape.pdf,project.pages[0],project,840,594,{colorMode:'monochrome'},new Map());
  assert(tape.of('line').some(l => l.every((v:number,i:number) => close(v,[35,36,61,52][i]))));
  assert.equal(tape.of('path').length,0,'No fallback socket silhouette');
}
// Group transforms, inherited widths/dashes and relative Bezier subpaths are
// consumed as real vector geometry, including independently placed subpaths.
{
  const tape=recorder();
  renderSymbolSvg(tape.pdf,'<g transform="translate(5,7) scale(2)" stroke="currentColor" stroke-width="3" stroke-dasharray="4 2" fill="none"><path d="M0 0 q3 6 9 0 m5 5 h2 v3"/></g>',0,0,20,20,20,20);
  assert(tape.of('setLineWidth').some(([w]) => close(w,6)));assert.deepEqual(tape.of('setLineDashPattern')[0][0],[8,4]);
  const path=tape.of('path')[0][0];assert.deepEqual(path[0],{op:'m',c:[5,7]});assert.equal(path[1].op,'c');assert.deepEqual(path[1].c.slice(-2),[23,7]);
  assert.deepEqual(path[2],{op:'m',c:[33,17]});assert.deepEqual(path.at(-1),{op:'l',c:[37,23]});
}
// Every SVG-only library symbol must survive the exporter (including curves,
// groups, filled junction dots and internal text), at all quarter turns.
const library=getSymbolDefinitions(fixture()).filter(s => s.svgContent&&!s.importedGraphics);
for (const sym of library) for (const rotation of [0,90,180,270]) {
  const tape=recorder();renderSymbolSvg(tape.pdf,sym.svgContent,0,0,sym.width,sym.height,sym.width,sym.height,rotation);
  for (const call of tape.calls) assert(!JSON.stringify(call).includes('null'),`Non-finite geometry in ${sym.id}`);
}
// Hidden connection labels must never make the editing handles permanent.
// Real junction dots are still part of the library and remain visible.
for (const symbolId of ['t_piece_directed_bottom_left','corner_compact_left_top','cross_junction']) {
  const project=fixture(),c=add(project,'junction',symbolId);c.bmk='';c.functionText='';c.pinLabelPosition={visible:false};
  const page=project.pages[0],canvas:any=Object.assign(Object.create(CadCanvas.prototype),{activePage:page,project,mode:'select'});
  const before=JSON.stringify(project);assert.doesNotMatch(canvas.renderComponents(),/class="pin-handle"/);
  if (symbolId==='cross_junction') assert.match(canvas.renderComponents(),/<circle[^>]+fill="currentColor"/);
  canvas.mode='wire';assert.equal((canvas.renderComponents().match(/class="pin-handle"/g)??[]).length,getSymbolById(symbolId,project)!.pins.length);
  canvas.mode='select';assert.doesNotMatch(canvas.renderComponents(),/class="pin-handle"/);assert.equal(JSON.stringify(project),before);
}
console.log(`✓ Shared library PDF contours (${library.length} SVG symbols at all rotations), exact socket ports/arcs, scaled groups/styles, project overrides and context-only connection handles`);
