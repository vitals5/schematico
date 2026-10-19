import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { PackageHandler } from './PackageHandler';
import { defaultPlotFrame } from '../model/PlotFrame';
import { defaultCoverPageTemplate } from '../model/CoverPage';
import { Project } from '../model/types';

const project: Project = {
  id: 'project<&', name: 'Haus &lt; & <Test> "Öl"', description: 'Editable source data',
  standard: 'DIN EN 81346-2 / IEC 60617', version: '1', created: '', modified: '', author: '', company: '',
  activePageId: 'page', symbolLibrary: [{
    id: 'source<&', name: 'Symbol', category: 'connections', standard: 'DIN EN 60617',
    defaultBmkPrefix: '-X', defaultFunctionText: '', width: 30, height: 60,
    source: { library: 'DIC_W', number: 1, variant: 0 }, description: '',
    pins: [{ id: '0', name: 'PE & N', x: 10, y: 20, direction: 'bottom' }],
    svgContent: '<circle cx="15" cy="30" r="10" fill="currentColor"/>'
  }], pages: [{
    id: 'page', pageNumber: '1<&', pageType: 'schematic', title: 'Einspeisung', higherLevel: '', location: '',
    connectionMode: 'explicit', importDiagnostics: ['Partial source record <example>'],
    components: [{ id: 'component<&', symbolId: 'source<&', bmk: '-X1', functionText: 'Grün & Gelb',
      x: 45.5, y: 100.25, rotation: 90, pins: { '0': { customLabel: 'PE', wireIds: ['wire'] } },
      bmkPosition: { preset: 'custom', offsetX: 3.2, visible: false } }],
    wires: [{ id: 'wire', from: { componentId: 'component<&', pinId: '0' },
      to: { componentId: 'component<&', pinId: '0' }, potential: 'PE', waypoints: [{ x: 90, y: 120 }] }],
    texts: [{ id: 'text', text: '<script>alert("example")</script>', x: 0, y: 0 }],
    plotFrame: { type: 'DIN_A3_LANDSCAPE', width: 1000, height: 700, columns: 10, rows: ['A'],
      titleBlock: { projectTitle: '', commission: '', company: '', author: '', date: '', revision: '', sheetNumber: '1', totalSheets: '1' } }
  }]
};
project.pages[0].cables=[{id:'cable',start:{x:0,y:0},end:{x:100,y:0},bmk:'-W1',cableType:'NYM-J',coreCount:5,crossSection:'2,5',fontSize:4,cores:[{id:'core',t:.5,color:'BU',wireIds:['wire']}]}];
project.pages[0].components[0].crossRefFontSize=3;
project.pages[0].components[0].crossRefPosition={preset:'right',offsetX:2.125,offsetY:-3.875,alignment:'end',rotation:90,visible:true};
project.pages[0].components[0].pinLabelFontSize=4;
project.settings = { interruptionLabelSide: 'before' };
project.plotFrameTemplate = defaultPlotFrame();
project.coverPageTemplate = defaultCoverPageTemplate();
project.pages[0].coverPage = {values:{'10100:0':'Kunde <Haus> & Partner','10014:0':''},logo:null};
const xml = PackageHandler.generateProjectXml(project);
assert(xml.includes('symbol="source&lt;&amp;"'), 'XML attributes are escaped too');
assert(!xml.includes('<script>'), 'payload text must not become XML markup');
const loaded = await PackageHandler.inspectFile(new File([xml], 'roundtrip.xml'));
assert.deepEqual(loaded.extractedProject, project, 'XML roundtrip preserves master data, pins, formatting, diagnostics and routes');
assert.equal(loaded.format, 'PROJECT_XML');

for (const [payload, message] of [
  ['not json', /ungültige JSON/],
  ['null', /gültige Projektstruktur/],
  [JSON.stringify({ ...project, pages: [null] }), /gültige Projektstruktur/],
  [JSON.stringify({ ...project, symbolLibrary: 'incorrect' }), /gültige Projektstruktur/]
] as const) {
  const malformed = `<ProjectXml application="Schematico"><SchematicoData format="json" version="1">${payload}</SchematicoData></ProjectXml>`;
  await assert.rejects(() => PackageHandler.inspectFile(new File([malformed], 'malformed.xml')), message);
}
await assert.rejects(() => PackageHandler.inspectFile(new File(['<ProjectXml application="Schematico"/>'], 'missing.xml')), /keine eindeutigen Projektdaten/);
await assert.rejects(() => PackageHandler.inspectFile(new File([xml.replace('format="json" version="1"', 'format="json" version="99"')], 'unsupported.xml')), /keine eindeutigen Projektdaten/);
await assert.rejects(() => PackageHandler.inspectFile(new File([xml.replace('</ProjectXml>', '<SchematicoData format="json" version="1">{}</SchematicoData></ProjectXml>')], 'duplicate.xml')), /keine eindeutigen Projektdaten/);
console.log('Lossless project XML roundtrip and malformed-payload checks passed.');

// Use actual public archive loading: a failed native database must never become
// a demo project, and app-owned archives must prefer their saved editable JSON.
const broken = new JSZip();
broken.file('Broken.edb/ProjectInfo.xml', '<ProjectInfo/>');
const brokenBytes = new Uint8Array(await broken.generateAsync({ type: 'uint8array' }));
for (const filename of ['broken.zw1', 'broken.unknown']) {
  await assert.rejects(() => PackageHandler.inspectFile(new File([brokenBytes], filename)), /EDB-Projekt konnte nicht importiert werden.*Page\.eod/);
}

const backup = await PackageHandler.exportToZw1(project);
const reopened = await PackageHandler.inspectFile(new File([backup], 'roundtrip.zw1'));
assert.deepEqual(reopened.extractedProject, project, 'saved archive JSON wins over missing native EOD files');
broken.file('Broken.edb/project_data.json', JSON.stringify(project));
const mixed = new Uint8Array(await broken.generateAsync({ type: 'uint8array' }));
for (const filename of ['mixed.zw1', 'mixed.unknown']) {
  const restored = await PackageHandler.inspectFile(new File([mixed], filename));
  assert.deepEqual(restored.extractedProject, project, 'saved JSON wins over a broken native database in either archive reader');
}
broken.file('Broken.edb/project_data.json', 'invalid saved JSON');
const invalidSaved = new Uint8Array(await broken.generateAsync({ type: 'uint8array' }));
await assert.rejects(() => PackageHandler.inspectFile(new File([invalidSaved], 'invalid.zw1')), /ungültige JSON-Projektdaten/);
const metadataOnly = new JSZip();
metadataOnly.file('Metadata.elk', '[Project]\nProjectName=Metadata\n');
const metadataBytes = new Uint8Array(await metadataOnly.generateAsync({ type: 'uint8array' }));
await assert.rejects(PackageHandler.inspectFile(new File([metadataBytes], 'metadata.zw1')), /keine unterstützten Projektdaten/,
  'metadata alone must not fabricate an editable demo circuit');
assert.equal((await PackageHandler.inspectFile(new File([metadataBytes], 'metadata.unknown'))).format, 'UNKNOWN',
  'metadata-only generic archive behavior is preserved');
console.log('Strict EDB failure propagation and saved ZW1 project priority passed.');
