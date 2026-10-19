// src/model/Clipboard.test.ts
import assert from 'node:assert/strict';
import type { Page, Project, SymbolDefinition, PlacedComponent, Wire, CableDefinition, PageBox, PageImage, PageText, ElementGroup } from './types';
import { copySelection, pasteClipboard, computeBmkMap, computeCableBmkMap, setClipboard, getClipboard, hasClipboard, clearClipboard } from './Clipboard';
import { createElementGroup } from './ElementGroups';

const symbol: SymbolDefinition = {
  id: 'test_sym',
  name: 'Test Symbol',
  category: 'controls',
  standard: 'DIN EN 60617',
  defaultBmkPrefix: '-K',
  defaultFunctionText: 'Schütz',
  width: 24,
  height: 48,
  svgContent: '',
  pins: [
    { id: 'A1', name: 'A1', x: 12, y: 0, direction: 'top' },
    { id: 'A2', name: 'A2', x: 12, y: 48, direction: 'bottom' }
  ],
  description: ''
};

function createMockProject(): { project: Project; page1: Page; page2: Page } {
  const page1: Page = {
    id: 'page_1',
    pageNumber: '1',
    pageType: 'schematic',
    title: 'Hauptstromkreis',
    higherLevel: '=A1',
    location: '+S1',
    components: [
      {
        id: 'c1',
        symbolId: 'test_sym',
        bmk: '-Q1',
        functionText: 'Hauptschalter',
        x: 100,
        y: 100,
        rotation: 0,
        pins: { A1: { wireIds: ['w1'] }, A2: { wireIds: [] } }
      },
      {
        id: 'c2',
        symbolId: 'test_sym',
        bmk: '-K1',
        functionText: 'Netzschütz Spule',
        x: 100,
        y: 200,
        rotation: 0,
        pins: { A1: { wireIds: ['w1', 'w2'] }, A2: { wireIds: [] } }
      },
      {
        id: 'c3',
        symbolId: 'test_sym',
        bmk: '-K1',
        functionText: 'Netzschütz Hilfskontakt',
        x: 200,
        y: 200,
        rotation: 0,
        pins: { A1: { wireIds: [] }, A2: { wireIds: [] } }
      },
      {
        id: 'c4_external',
        symbolId: 'test_sym',
        bmk: '-M1',
        functionText: 'Motor',
        x: 500,
        y: 500,
        rotation: 0,
        pins: { A1: { wireIds: ['w2'] }, A2: { wireIds: [] } }
      },
      {
        id: 't1',
        symbolId: 'test_sym',
        bmk: '-X1:1',
        functionText: 'Klemme 1',
        x: 300,
        y: 100,
        rotation: 0,
        pins: {}
      },
      {
        id: 't2',
        symbolId: 'test_sym',
        bmk: '-X1:2',
        functionText: 'Klemme 2',
        x: 324,
        y: 100,
        rotation: 0,
        pins: {}
      }
    ],
    wires: [
      {
        id: 'w1',
        from: { componentId: 'c1', pinId: 'A1' },
        to: { componentId: 'c2', pinId: 'A1' },
        potential: 'L1',
        waypoints: [{ x: 100, y: 150 }]
      },
      {
        id: 'w2',
        from: { componentId: 'c2', pinId: 'A1' },
        to: { componentId: 'c4_external', pinId: 'A1' },
        potential: 'L1',
        waypoints: [{ x: 300, y: 350 }]
      }
    ],
    cables: [
      {
        id: 'cable1',
        bmk: '-W1',
        cableType: 'ÖLFLEX 110',
        crossSection: '1.5mm²',
        start: { x: 100, y: 150 },
        end: { x: 200, y: 150 },
        cores: [{ id: 'core1', wireIds: ['w1'], t: 0.5 }]
      }
    ],
    boxes: [
      {
        id: 'box1',
        bmk: '-A1',
        x: 80,
        y: 80,
        width: 200,
        height: 200,
        label: 'Schaltschrank Feld 1'
      }
    ],
    images: [
      {
        id: 'img1',
        dataUrl: 'data:image/png;base64,abc',
        x: 50,
        y: 50,
        width: 100,
        height: 80
      }
    ],
    texts: [
      {
        id: 'txt1',
        text: 'Steuerungsnotiz',
        x: 60,
        y: 60,
        fontSize: 10
      }
    ],
    plotFrame: { width: 1190, height: 842, margin: 20, orientation: 'landscape', format: 'A3' }
  } as unknown as Page;

  const page2 = {
    id: 'page_2',
    pageNumber: '2',
    pageType: 'schematic',
    title: 'Steuerstromkreis',
    higherLevel: '=A1',
    location: '+S1',
    components: [],
    wires: [],
    cables: [],
    boxes: [],
    images: [],
    texts: [],
    plotFrame: { width: 1190, height: 842, margin: 20, orientation: 'landscape', format: 'A3' }
  } as unknown as Page;

  const project = {
    id: 'proj_1',
    name: 'Test Project',
    activePageId: 'page_1',
    pages: [page1, page2],
    symbolLibrary: [symbol],
    drawingUnitsPerMm: 2,
    modified: new Date().toISOString()
  } as unknown as Project;

  return { project, page1, page2 };
}

// === Test 1: Single Component Copy & Paste ===
{
  const { project, page1 } = createMockProject();
  const payload = copySelection(page1, project, { componentIds: ['c1'], cableIds: [] });
  assert(payload !== null, 'Payload should be created');
  assert.equal(payload.components.length, 1);
  assert.equal(payload.components[0].bmk, '-Q1');
  assert.equal(payload.wires.length, 0, 'No internal wires for single component without both ends');

  const result = pasteClipboard(page1, project, payload, { dx: 40, dy: 40 });
  assert.equal(result.components.length, 1);
  assert.notEqual(result.components[0].id, 'c1', 'Pasted component must have a fresh ID');
  assert.equal(result.components[0].bmk, '-Q2', 'BMK should auto-increment from -Q1 to -Q2');
  assert.equal(result.components[0].x, 140, 'X coordinate offset correctly');
  assert.equal(result.components[0].y, 140, 'Y coordinate offset correctly');
  assert.deepEqual(result.components[0].pins.A1.wireIds, [], 'External wire IDs filtered out');
  assert(page1.components.some(c => c.id === result.components[0].id), 'Component added to page');
  console.log('✓ Single component copy, paste, ID generation and BMK increment');
}

// === Test 2: Multiple Components with Internal Wire ===
{
  const { project, page1 } = createMockProject();
  const payload = copySelection(page1, project, { componentIds: ['c1', 'c2'], cableIds: [] });
  assert(payload !== null);
  assert.equal(payload.components.length, 2);
  assert.equal(payload.wires.length, 1, 'Wire w1 between c1 and c2 must be copied');
  assert.equal(payload.wires[0].id, 'w1');

  const result = pasteClipboard(page1, project, payload, { dx: 50, dy: 50 });
  assert.equal(result.components.length, 2);
  assert.equal(result.wires.length, 1, 'Cloned wire created');

  const clonedW = result.wires[0];
  const clonedC1 = result.components.find(c => c.bmk === '-Q2')!;
  const clonedC2 = result.components.find(c => c.bmk === '-K2')!;

  assert.notEqual(clonedW.id, 'w1');
  assert.equal(clonedW.from.componentId, clonedC1.id);
  assert.equal(clonedW.to.componentId, clonedC2.id);
  assert.deepEqual(clonedW.waypoints, [{ x: 150, y: 200 }], 'Waypoints correctly shifted');
  assert(clonedC1.pins.A1.wireIds?.includes(clonedW.id), 'Pin wireIds points to cloned wire');
  assert(clonedC2.pins.A1.wireIds?.includes(clonedW.id), 'Pin wireIds points to cloned wire');
  assert(!clonedC2.pins.A1.wireIds?.includes('w2'), 'Uncopied wire w2 removed from pin');
  console.log('✓ Multiple components with internal wire routing, endpoints and pin wireIds remapping');
}

// === Test 3: Shared BMK Preservation (Contactor Coil and Contact) ===
{
  const { project, page1 } = createMockProject();
  // c2 and c3 both have BMK '-K1'
  const payload = copySelection(page1, project, { componentIds: ['c2', 'c3'], cableIds: [] });
  assert(payload !== null);

  const result = pasteClipboard(page1, project, payload, { dx: 10, dy: 10 });
  assert.equal(result.components.length, 2);
  const bmks = result.components.map(c => c.bmk);
  assert.deepEqual(bmks, ['-K2', '-K2'], 'Coil and auxiliary contact must both receive the SAME new BMK -K2');
  console.log('✓ Shared BMK preservation for multi-part devices');
}

// === Test 4: Terminal Strip Renumbering with Terminal Numbers Preserved ===
{
  const { project, page1 } = createMockProject();
  // t1 has '-X1:1', t2 has '-X1:2'
  const payload = copySelection(page1, project, { componentIds: ['t1', 't2'], cableIds: [] });
  assert(payload !== null);

  const result = pasteClipboard(page1, project, payload, { dx: 0, dy: 50 });
  assert.equal(result.components.length, 2);
  assert.equal(result.components[0].bmk, '-X2:1', 'Terminal 1 mapped to strip -X2');
  assert.equal(result.components[1].bmk, '-X2:2', 'Terminal 2 mapped to strip -X2');
  console.log('✓ Terminal strip renumbering preserves individual terminal designators');
}

// === Test 5: Mixed Selection (Components, Wires, Cables, Boxes, Images, Texts, Groups) ===
{
  const { project, page1 } = createMockProject();
  // Group c1 and c2
  createElementGroup(page1, { componentIds: ['c1', 'c2'], cableIds: [] });
  assert.equal(page1.groups?.length, 1);

  const payload = copySelection(page1, project, {
    componentIds: ['c1', 'c2'],
    cableIds: ['cable1'],
    boxIds: ['box1'],
    imageIds: ['img1'],
    textIds: ['txt1']
  });
  assert(payload !== null);
  assert.equal(payload.components.length, 2);
  assert.equal(payload.cables?.length, 1);
  assert.equal(payload.boxes?.length, 1);
  assert.equal(payload.images?.length, 1);
  assert.equal(payload.texts?.length, 1);
  assert.equal(payload.groups?.length, 1);

  const result = pasteClipboard(page1, project, payload, { dx: 100, dy: 100 });
  assert.equal(result.components.length, 2);
  assert.equal(result.cables.length, 1);
  assert.equal(result.boxes.length, 1);
  assert.equal(result.images.length, 1);
  assert.equal(result.texts.length, 1);
  assert.equal(result.groups.length, 1);

  // Verify cable BMK incremented to -W2
  assert.equal(result.cables[0].bmk, '-W2');
  assert.equal(result.cables[0].start.x, 200);
  assert.equal(result.cables[0].end.x, 300);

  // Verify box BMK incremented to -A2
  assert.equal(result.boxes[0].bmk, '-A2');
  assert.equal(result.boxes[0].x, 180);

  // Verify image and text offset
  assert.equal(result.images[0].x, 150);
  assert.equal(result.texts[0].x, 160);

  // Verify group remapped with new member IDs
  const clonedGroup = result.groups[0];
  const newCompIds = new Set(result.components.map(c => c.id));
  assert(clonedGroup.members.every(m => newCompIds.has(m.id)), 'Cloned group references cloned component IDs');

  // Verify pastedSelection
  assert.equal(result.pastedSelection.componentIds.length, 2);
  assert.equal(result.pastedSelection.cableIds.length, 1);
  assert.equal(result.pastedSelection.boxIds?.length, 1);
  assert.equal(result.pastedSelection.imageIds?.length, 1);
  assert.equal(result.pastedSelection.textIds?.length, 1);
  console.log('✓ Mixed selection copy and paste (components, wires, cables, boxes, images, texts, groups)');
}

// === Test 6: Cross-Page Copy & Paste ===
{
  const { project, page1, page2 } = createMockProject();
  const payload = copySelection(page1, project, { componentIds: ['c1', 'c2'], cableIds: [] });
  assert(payload !== null);

  // Paste onto page 2
  const result = pasteClipboard(page2, project, payload, { dx: 0, dy: 0 });
  assert.equal(page2.components.length, 2);
  assert.equal(page2.wires.length, 1);
  assert.equal(result.components[0].x, 100);
  assert.equal(result.components[0].y, 100);
  // On page 2, BMK is still unique across the project!
  assert.equal(result.components[0].bmk, '-Q2');
  assert.equal(result.components[1].bmk, '-K2');
  console.log('✓ Cross-page copy and paste across separate sheets in the project');
}

// === Test 7: Clipboard State Manager ===
{
  clearClipboard();
  assert(!hasClipboard());
  const { project, page1 } = createMockProject();
  const payload = copySelection(page1, project, { componentIds: ['c1'], cableIds: [] });
  setClipboard(payload);
  assert(hasClipboard());
  assert.equal(getClipboard()?.components[0].bmk, '-Q1');
  clearClipboard();
  assert(!hasClipboard());
  console.log('✓ Clipboard state manager get, set, has, clear');
}

console.log('🎉 ALL CLIPBOARD TESTS PASSED SUCCESSFULLY!');
