// src/ai/mcp-tools/mcp-tools.test.ts
import { McpToolRegistry } from './index';
import { Project, Page } from '../../model/types';
import { defaultPlotFrame } from '../../model/PlotFrame';

function createMockProject(): { project: Project; manager: any } {
  const page: Page = {
    id: 'page_1',
    pageNumber: '1',
    pageType: 'schematic',
    title: 'Test Seite',
    higherLevel: '=A1',
    location: '+S1',
    components: [],
    wires: [],
    plotFrame: {
      type: 'DIN_A3_LANDSCAPE',
      width: 420,
      height: 297,
      columns: 10,
      rows: ['A', 'B', 'C', 'D', 'E', 'F'],
      titleBlock: {
        projectTitle: 'Test Project',
        commission: '',
        company: 'Schematico',
        author: 'Tester',
        date: '2026-10-25',
        revision: '1',
        sheetNumber: '1',
        totalSheets: '1'
      }
    }
  };

  const project: Project = {
    id: 'proj_test',
    name: 'Test Project',
    description: 'Unit Test Project',
    standard: 'DIN EN 81346-2 / IEC 60617',
    version: '1.0.0',
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    author: 'Test',
    company: 'Test Co',
    pages: [page],
    activePageId: 'page_1'
  };

  let modifiedCount = 0;
  let renderCount = 0;

  const manager = {
    getProject: () => project,
    getActivePage: (pageId?: string) => {
      if (pageId) {
        const found = project.pages.find(p => p.id === pageId);
        if (found) return found;
      }
      return project.pages.find(p => p.id === project.activePageId) || project.pages[0];
    },
    switchPage: (pageId: string) => {
      project.activePageId = pageId;
    },
    deletePage: (pageId: string) => {
      const idx = project.pages.findIndex(p => p.id === pageId);
      if (idx !== -1) {
        project.pages.splice(idx, 1);
        if (project.activePageId === pageId && project.pages.length > 0) {
          project.activePageId = project.pages[0].id;
        }
      }
    },
    notifyModified: () => {
      modifiedCount++;
    },
    render: () => {
      renderCount++;
    },
    getCounts: () => ({ modifiedCount, renderCount })
  };

  return { project, manager };
}

async function runTests() {
  console.log('--- Testing MCP Tool Registry & Handlers ---');
  const registry = new McpToolRegistry();
  const defs = registry.getToolDefinitions();

  // Test 1: Registry definitions
  if (defs.length < 6) {
    throw new Error(`Expected at least 6 tools, got ${defs.length}`);
  }
  const toolNames = defs.map(t => t.name);
  if (!toolNames.includes('get_canvas_state') || !toolNames.includes('add_component') || !toolNames.includes('draw_wire')) {
    throw new Error(`Missing expected tools: ${toolNames.join(', ')}`);
  }
  console.log('✓ Test 1: Registry initialized with tools:', toolNames.join(', '));

  // Test 2: add_component with fuzzy name 'relay' / 'contactor'
  const { project, manager } = createMockProject();
  const addRes1 = await registry.executeTool('add_component', {
    symbolName: 'contactor',
    x: 100,
    y: 150,
    functionText: 'Hauptschütz Antrieb'
  }, manager);

  if (!addRes1.success || !addRes1.component) {
    throw new Error(`Failed to add component by fuzzy name: ${JSON.stringify(addRes1)}`);
  }
  if (!addRes1.component.bmk.startsWith('-K')) {
    throw new Error(`Expected BMK starting with -K, got: ${addRes1.component.bmk}`);
  }
  console.log('✓ Test 2: Added component by fuzzy name:', addRes1.component.bmk, addRes1.component.symbolName);

  // Test 3: add_component with exact symbolId
  const addRes2 = await registry.executeTool('add_component', {
    symbolId: 'fuse_1p',
    x: 100,
    y: 80,
    functionText: 'Steuersicherung'
  }, manager);

  if (!addRes2.success || !addRes2.component) {
    throw new Error(`Failed to add component by symbolId: ${JSON.stringify(addRes2)}`);
  }
  if (!addRes2.component.bmk.startsWith('-F')) {
    throw new Error(`Expected BMK starting with -F, got: ${addRes2.component.bmk}`);
  }
  console.log('✓ Test 3: Added component by symbolId:', addRes2.component.bmk, addRes2.component.symbolName);

  // Test 4: draw_wire between components
  const wireRes = await registry.executeTool('draw_wire', {
    fromComponentId: addRes2.component.id,
    toComponentId: addRes1.component.id,
    potential: 'L1',
    color: 'BK',
    crossSection: '1.5mm²'
  }, manager);

  if (!wireRes.success || !wireRes.wire) {
    throw new Error(`Failed to draw wire: ${JSON.stringify(wireRes)}`);
  }
  if (wireRes.wire.potential !== 'L1') {
    throw new Error(`Expected potential L1, got: ${wireRes.wire.potential}`);
  }
  console.log('✓ Test 4: Wired components:', wireRes.wire.id, `${wireRes.wire.from.bmk} -> ${wireRes.wire.to.bmk}`);

  // Test 5: get_canvas_state
  const stateRes = await registry.executeTool('get_canvas_state', {}, manager);
  if (!stateRes.success || stateRes.components.length !== 2 || stateRes.wires.length !== 1) {
    throw new Error(`State mismatch: ${JSON.stringify(stateRes)}`);
  }
  console.log('✓ Test 5: Canvas state returns', stateRes.components.length, 'components,', stateRes.wires.length, 'wires');

  // Test 6: search_symbols
  const searchRes = await registry.executeTool('search_symbols', { query: 'motor' }, manager);
  if (!searchRes.success || searchRes.returned === 0) {
    throw new Error(`Search symbols failed: ${JSON.stringify(searchRes)}`);
  }
  console.log('✓ Test 6: Search symbols found', searchRes.returned, 'results for "motor"');

  // Test 7: delete_element
  const delRes = await registry.executeTool('delete_element', { id: wireRes.wire.id }, manager);
  if (!delRes.success || delRes.deletedType !== 'wire') {
    throw new Error(`Delete wire failed: ${JSON.stringify(delRes)}`);
  }
  if (project.pages[0].wires.length !== 0) {
    throw new Error('Wire was not deleted from page');
  }
  console.log('✓ Test 7: Wire deleted successfully');

  // Test 8: clear_canvas without confirm
  const clearReject = await registry.executeTool('clear_canvas', { confirm: false }, manager);
  if (clearReject.success !== false) {
    throw new Error('clear_canvas without confirm must fail');
  }
  // clear_canvas with confirm
  const clearSuccess = await registry.executeTool('clear_canvas', { confirm: true }, manager);
  if (!clearSuccess.success || project.pages[0].components.length !== 0) {
    throw new Error('clear_canvas failed to empty canvas');
  }
  console.log('✓ Test 8: Clear canvas safety check passed, canvas successfully cleared');

  // Test 9: Unknown tool execution returns graceful error
  const unknownRes = await registry.executeTool('non_existent_tool', {}, manager);
  if (unknownRes.success !== false || !unknownRes.error) {
    throw new Error('Expected unknown tool to fail gracefully');
  }
  console.log('✓ Test 9: Unknown tool gracefully rejected with available tools list');

  // Test 10: Component modifications (update_component, rotate_element, move_element)
  const addComp = await registry.executeTool('add_component', {
    symbolId: 'motor_3p',
    x: 100,
    y: 100,
    bmk: '-M1',
    functionText: 'Hauptantrieb'
  }, manager);
  if (!addComp.success || !addComp.component) {
    throw new Error('Failed to add motor component');
  }

  const updateComp = await registry.executeTool('update_component', {
    id: addComp.component.id,
    bmk: '-M99',
    functionText: 'Lüftermotor',
    technicalCharacteristics: '15kW 400V'
  }, manager);
  if (!updateComp.success || updateComp.component.bmk !== '-M99' || updateComp.component.technicalCharacteristics !== '15kW 400V') {
    throw new Error('update_component failed to update fields');
  }

  const rotateComp = await registry.executeTool('rotate_element', {
    id: addComp.component.id,
    rotation: 90
  }, manager);
  if (!rotateComp.success || rotateComp.rotation !== 90) {
    throw new Error('rotate_element failed to update rotation');
  }

  const moveComp = await registry.executeTool('move_element', {
    id: addComp.component.id,
    dx: 20,
    dy: 30
  }, manager);
  if (!moveComp.success || moveComp.x !== 120 || moveComp.y !== 130) {
    throw new Error(`move_element failed: expected (120, 130), got (${moveComp.x}, ${moveComp.y})`);
  }
  console.log('✓ Test 10: update_component, rotate_element, and move_element succeeded');

  // Test 11: Text & Device Box operations
  const addTextRes = await registry.executeTool('add_text', {
    text: 'Steuerungsbereich Anlage 1',
    x: 50,
    y: 50,
    fontSize: 14,
    color: '#0055ff'
  }, manager);
  if (!addTextRes.success || !addTextRes.textElement) {
    throw new Error('add_text failed');
  }

  const updateTextRes = await registry.executeTool('update_text', {
    id: addTextRes.textElement.id,
    text: 'Steuerungsbereich Anlage 2'
  }, manager);
  if (!updateTextRes.success || updateTextRes.textElement.text !== 'Steuerungsbereich Anlage 2') {
    throw new Error('update_text failed');
  }

  const addBoxRes = await registry.executeTool('add_device_box', {
    label: '=A1+S1-U1',
    x: 40,
    y: 40,
    width: 200,
    height: 120,
    lineStyle: 'dashed'
  }, manager);
  if (!addBoxRes.success || !addBoxRes.deviceBox) {
    throw new Error('add_device_box failed');
  }

  const updateBoxRes = await registry.executeTool('update_device_box', {
    id: addBoxRes.deviceBox.id,
    label: '=A1+S1-U2'
  }, manager);
  if (!updateBoxRes.success || updateBoxRes.deviceBox.label !== '=A1+S1-U2') {
    throw new Error('update_device_box failed');
  }
  console.log('✓ Test 11: add_text, update_text, add_device_box, update_device_box succeeded');

  // Test 12: Cable definitions and listing
  const addCableRes = await registry.executeTool('add_cable', {
    bmk: '-W1',
    cableType: 'ÖLFLEX CLASSIC 110',
    coreCount: 5,
    crossSection: '1.5mm²',
    voltage: '300/500V'
  }, manager);
  if (!addCableRes.success || !addCableRes.cable) {
    throw new Error('add_cable failed');
  }

  const listCablesRes = await registry.executeTool('list_cables', {}, manager);
  if (!listCablesRes.success || listCablesRes.total !== 1 || listCablesRes.cables[0].bmk !== '-W1') {
    throw new Error('list_cables failed to list added cable');
  }
  console.log('✓ Test 12: add_cable and list_cables succeeded');

  // Test 13: Project & Page lifecycle
  const projInfoRes = await registry.executeTool('get_project_info', {}, manager);
  if (!projInfoRes.success || projInfoRes.project.name !== 'Test Project') {
    throw new Error('get_project_info failed');
  }

  const updateProjRes = await registry.executeTool('update_project_info', {
    name: 'Modernized Schematico Plant',
    company: 'Schematico Automation'
  }, manager);
  if (!updateProjRes.success || project.name !== 'Modernized Schematico Plant') {
    throw new Error('update_project_info failed');
  }

  const createPageRes = await registry.executeTool('create_page', {
    pageNumber: '2',
    title: 'Leistungsteil 400V',
    higherLevel: '=A1',
    location: '+S1'
  }, manager);
  if (!createPageRes.success || project.pages.length !== 2) {
    throw new Error('create_page failed to append new sheet');
  }

  const listPagesRes = await registry.executeTool('list_pages', {}, manager);
  if (!listPagesRes.success || listPagesRes.pages.length !== 2) {
    throw new Error('list_pages failed');
  }

  const switchPageRes = await registry.executeTool('switch_page', {
    pageId: createPageRes.page.id
  }, manager);
  if (!switchPageRes.success || project.activePageId !== createPageRes.page.id) {
    throw new Error('switch_page failed');
  }
  console.log('✓ Test 13: Project info and page lifecycle operations succeeded');

  // Test 14: Reports generation
  const partsListRes = await registry.executeTool('get_parts_list', {}, manager);
  if (!partsListRes.success || !Array.isArray(partsListRes.items)) {
    throw new Error('get_parts_list failed');
  }

  const termReportRes = await registry.executeTool('get_terminal_diagram', {}, manager);
  if (!termReportRes.success || !Array.isArray(termReportRes.strips)) {
    throw new Error('get_terminal_diagram failed');
  }
  console.log('✓ Test 14: get_parts_list and get_terminal_diagram reports generated successfully');

  // Test 15: Floor plan architectural operations
  const wallRes = await registry.executeTool('add_wall', {
    startX: 0,
    startY: 0,
    endX: 5000,
    endY: 0,
    thickness: 240
  }, manager);
  if (!wallRes.success || !wallRes.wall) {
    throw new Error('add_wall failed');
  }

  const openingRes = await registry.executeTool('add_wall_opening', {
    kind: 'door',
    x: 1500,
    y: 0,
    width: 900,
    wallId: wallRes.wall.id
  }, manager);
  if (!openingRes.success || !openingRes.opening) {
    throw new Error('add_wall_opening failed');
  }

  const fpStateRes = await registry.executeTool('get_floor_plan_state', {}, manager);
  if (!fpStateRes.success || fpStateRes.walls.length !== 1 || fpStateRes.openings.length !== 1) {
    throw new Error('get_floor_plan_state failed');
  }
  console.log('✓ Test 15: Architectural floor plan tools (add_wall, add_wall_opening, get_floor_plan_state) succeeded');

  // Test 16: Physical bounding boxes and collision detection
  const c1 = await registry.executeTool('add_component', {
    symbolId: 'energy_meter_3p',
    x: 100,
    y: 100
  }, manager);
  if (!c1.success || !c1.component?.bounds || c1.component.bodyBounds?.width !== 96 || c1.component.bodyBounds?.height !== 48) {
    throw new Error(`Component bounds or dimensions missing on energy_meter_3p: ${JSON.stringify(c1)}`);
  }

  // Place colliding component right on top of c1
  const c2Colliding = await registry.executeTool('add_component', {
    symbolId: 'circuit_breaker_3p',
    x: 110,
    y: 110
  }, manager);
  if (!c2Colliding.success || !c2Colliding.warning || !c2Colliding.collisions || c2Colliding.collisions.length === 0) {
    throw new Error(`Expected collision warning when placing component directly overlapping, got: ${JSON.stringify(c2Colliding)}`);
  }

  // Verify get_canvas_state reports bounds
  const canvasWithBounds = await registry.executeTool('get_canvas_state', {}, manager);
  const foundMeter = canvasWithBounds.components.find((c: any) => c.symbolId === 'energy_meter_3p');
  if (!foundMeter?.bounds || foundMeter.bodyBounds?.width !== 96 || foundMeter.bodyBounds?.height !== 48) {
    throw new Error(`get_canvas_state did not report bounds: ${JSON.stringify(foundMeter)}`);
  }
  console.log('✓ Test 16: Physical symbol bounding boxes & collision detection validated');

  // Test 17: Label dimensions and left border clearance
  const cLabelTest = await registry.executeTool('add_component', {
    symbolId: 'fuse_switch_3p',
    x: 55,
    y: 50,
    bmk: '-F0',
    functionText: 'Hausanschlusskasten (HAK) NH00'
  }, manager);

  if (!cLabelTest.success || !cLabelTest.component?.labelBounds) {
    throw new Error(`Expected labelBounds on component, got: ${JSON.stringify(cLabelTest)}`);
  }
  if (!cLabelTest.warning || !cLabelTest.warning.includes('outside left sheet border')) {
    throw new Error(`Expected left border warning when placing at x=55 with long label, got warning: ${cLabelTest.warning}`);
  }
  if (cLabelTest.component.bounds.left >= 35) {
    throw new Error(`Expected total bounds.left < 35 due to label, got: ${cLabelTest.component.bounds.left}`);
  }
  console.log('✓ Test 17: Component label dimensions and left-margin clearance validated');

  // Test 18: Sheet utilization telemetry and underutilization warnings
  const utilState = await registry.executeTool('get_canvas_state', {}, manager);
  if (!utilState.success || !utilState.sheetUtilization) {
    throw new Error(`Expected sheetUtilization in get_canvas_state, got: ${JSON.stringify(utilState)}`);
  }
  if (typeof utilState.sheetUtilization.horizontalUtilizationPercent !== 'number') {
    throw new Error('horizontalUtilizationPercent is missing or not a number');
  }
  console.log('✓ Test 18: Sheet utilization telemetry verified, horiz %:', utilState.sheetUtilization.horizontalUtilizationPercent);

  // Test 19: distribute_sheet_layout on cramped 3-column circuit
  await registry.executeTool('clear_canvas', { confirm: true }, manager);

  // Place a cramped MK C3 schematic in the left corner (X: 55..140, Y: 50..120)
  await registry.executeTool('add_component', { symbolId: 'fuse_switch_3p', bmk: '-F0', x: 55, y: 50 }, manager);
  await registry.executeTool('add_component', { symbolId: 'circuit_breaker_3p', bmk: '-Q0', x: 55, y: 85 }, manager);
  await registry.executeTool('add_component', { symbolId: 'energy_meter_3p', bmk: '-Z1', x: 55, y: 120 }, manager);

  await registry.executeTool('add_component', { symbolId: 'energy_meter_3p', bmk: '-Z2', x: 95, y: 50 }, manager);
  await registry.executeTool('add_component', { symbolId: 'rcd_4p', bmk: '-F1', x: 95, y: 85 }, manager);
  await registry.executeTool('add_component', { symbolId: 'motor_3phase', bmk: '-M1', x: 95, y: 120 }, manager);

  await registry.executeTool('add_component', { symbolId: 'circuit_breaker_3p', bmk: '-Q2', x: 140, y: 50 }, manager);
  await registry.executeTool('add_component', { symbolId: 'circuit_breaker_3p', bmk: '-Q3', x: 140, y: 85 }, manager);
  await registry.executeTool('add_component', { symbolId: 'terminal_pe', bmk: '-X1', x: 140, y: 120 }, manager);

  await registry.executeTool('add_text', { text: 'Strang 1: Netz', x: 55, y: 200 }, manager);
  await registry.executeTool('add_text', { text: 'Strang 2: Wärmepumpe', x: 95, y: 200 }, manager);
  await registry.executeTool('add_text', { text: 'Strang 3: Haushalt', x: 140, y: 200 }, manager);

  // Add device boxes and cross-column wire
  await registry.executeTool('add_device_box', { bmk: '=HAK', x: 45, y: 40, width: 40, height: 90 }, manager);
  await registry.executeTool('add_device_box', { bmk: '=WP', x: 85, y: 40, width: 40, height: 90 }, manager);
  await registry.executeTool('add_device_box', { bmk: '=PV', x: 130, y: 40, width: 40, height: 90 }, manager);

  // Cross-column wire from Z1 (Column 1) to F1 (Column 2)
  const z1Comp = manager.getActivePage().components.find((c: any) => c.bmk === '-Z1');
  const f1Comp = manager.getActivePage().components.find((c: any) => c.bmk === '-F1');
  await registry.executeTool('draw_wire', {
    fromComponentId: z1Comp.id,
    fromPinId: '2',
    toComponentId: f1Comp.id,
    toPinId: '1',
    potential: 'L1'
  }, manager);

  // Before distribute: verify it's flagged as cramped
  const crampedState = await registry.executeTool('get_canvas_state', {}, manager);
  if (!crampedState.sheetUtilization?.isCramped) {
    throw new Error(`Expected cramped schematic to be flagged as isCramped=true, got: ${JSON.stringify(crampedState.sheetUtilization)}`);
  }
  if (!crampedState.warning || !crampedState.warning.includes('SHEET UNDERUTILIZATION')) {
    throw new Error(`Expected sheet underutilization warning, got: ${crampedState.warning}`);
  }

  // Execute distribute_sheet_layout
  const distRes = await registry.executeTool('distribute_sheet_layout', {}, manager);
  if (!distRes.success || distRes.columns !== 3 || distRes.componentsMoved !== 9) {
    throw new Error(`distribute_sheet_layout failed: ${JSON.stringify(distRes)}`);
  }
  if (distRes.columnPositions[0] !== 85 || distRes.columnPositions[1] !== 205 || distRes.columnPositions[2] !== 315) {
    throw new Error(`Expected targetXs [85, 205, 315], got: ${JSON.stringify(distRes.columnPositions)}`);
  }

  // Verify full-sheet state after distribution
  const distributedState = await registry.executeTool('get_canvas_state', {}, manager);
  if (distributedState.sheetUtilization?.isCramped) {
    throw new Error(`Expected circuit to no longer be cramped, got: ${JSON.stringify(distributedState.sheetUtilization)}`);
  }
  if (distributedState.sheetUtilization.horizontalUtilizationPercent < 80) {
    throw new Error(`Expected horizontal utilization >= 80%, got: ${distributedState.sheetUtilization.horizontalUtilizationPercent}%`);
  }

  // Verify texts moved with the columns
  const textPage = manager.getActivePage();
  const t1 = textPage.texts.find((t: any) => t.text.includes('Strang 1'));
  const t2 = textPage.texts.find((t: any) => t.text.includes('Strang 2'));
  const t3 = textPage.texts.find((t: any) => t.text.includes('Strang 3'));
  if (!t1 || !t2 || !t3 || t1.x !== 85 || t2.x !== 205 || t3.x !== 315) {
    throw new Error(`Texts did not move with distributed columns: t1=${t1?.x}, t2=${t2?.x}, t3=${t3?.x}`);
  }

  // Verify device boxes were separated without overlapping
  const bHak = textPage.boxes.find((b: any) => b.bmk === '=HAK');
  const bWp = textPage.boxes.find((b: any) => b.bmk === '=WP');
  const bPv = textPage.boxes.find((b: any) => b.bmk === '=PV');
  if (!bHak || !bWp || !bPv) {
    throw new Error('Device boxes missing after distribution');
  }
  if (bHak.x + bHak.width > bWp.x || bWp.x + bWp.width > bPv.x) {
    throw new Error(`Device boxes overlap: HAK=${bHak.x}..${bHak.x + bHak.width}, WP=${bWp.x}..${bWp.x + bWp.width}, PV=${bPv.x}..${bPv.x + bPv.width}`);
  }

  // Verify inter-column wire was routed via duct waypoints
  const crossWire = textPage.wires.find((w: any) => w.from.componentId === z1Comp.id && w.to.componentId === f1Comp.id);
  if (!crossWire || !crossWire.waypoints || crossWire.waypoints.length === 0) {
    throw new Error('Expected inter-column wire to have non-overlapping duct waypoints');
  }

  console.log('✓ Test 19: distribute_sheet_layout redistributed 3-strang circuit to X: [85, 205, 315] with >80% sheet utilization, non-overlapping boxes, and orthogonal duct wiring');

  // Test 20: distribute_sheet_layout on 4-box layout (+HAK, +ZP1, +UV-WP, +UV-HH) with stacked texts
  await registry.executeTool('clear_canvas', { confirm: true }, manager);
  await registry.executeTool('add_component', { symbolId: 'fuse_switch_3p', bmk: '-F0', x: 85, y: 58 }, manager);
  await registry.executeTool('add_component', { symbolId: 'circuit_breaker_3p', bmk: '-Q0', x: 85, y: 120 }, manager);
  await registry.executeTool('add_component', { symbolId: 'energy_meter_3p', bmk: '-Z1', x: 85, y: 185 }, manager);

  await registry.executeTool('add_component', { symbolId: 'rcd_4p', bmk: '-F1', x: 135, y: 58 }, manager);
  await registry.executeTool('add_component', { symbolId: 'circuit_breaker_3p', bmk: '-Q1', x: 135, y: 124 }, manager);
  await registry.executeTool('add_component', { symbolId: 'motor_3phase', bmk: '-M1', x: 135, y: 185 }, manager);

  await registry.executeTool('add_component', { symbolId: 'energy_meter_3p', bmk: '-Z2', x: 160, y: 58 }, manager);
  await registry.executeTool('add_component', { symbolId: 'rcd_4p', bmk: '-F2', x: 160, y: 124 }, manager);
  await registry.executeTool('add_component', { symbolId: 'inverter_solar', bmk: '-G1', x: 160, y: 195 }, manager);

  await registry.executeTool('add_device_box', { bmk: '+HAK', x: 75, y: 45, width: 90, height: 60 }, manager);
  await registry.executeTool('add_device_box', { bmk: '+ZP1', x: 75, y: 110, width: 100, height: 130 }, manager);
  await registry.executeTool('add_device_box', { bmk: '+UV-WP', x: 130, y: 45, width: 90, height: 190 }, manager);
  await registry.executeTool('add_device_box', { bmk: '+UV-HH', x: 155, y: 45, width: 90, height: 190 }, manager);

  await registry.executeTool('add_text', { text: 'Messkonzept MK C3: Kaskadenmessung Wärmepumpe & Haushalt', x: 45, y: 38 }, manager);
  await registry.executeTool('add_text', { text: 'STRANG 1: Netzeinspeisung', x: 85, y: 48 }, manager);
  await registry.executeTool('add_text', { text: 'STRANG 2: Kaskadenzweig Wärmepumpe', x: 85, y: 48 }, manager);
  await registry.executeTool('add_text', { text: 'STRANG 3: Haushaltsnetz & PV', x: 85, y: 48 }, manager);

  const dist20Res = await registry.executeTool('distribute_sheet_layout', {}, manager);
  if (!dist20Res.success || dist20Res.columns !== 3) {
    throw new Error(`Test 20 failed: expected 3 columns, got ${dist20Res.columns}`);
  }

  const p20 = manager.getActivePage();
  const txt1 = p20.texts.find((t: any) => t.text.includes('STRANG 1'));
  const txt2 = p20.texts.find((t: any) => t.text.includes('STRANG 2'));
  const txt3 = p20.texts.find((t: any) => t.text.includes('STRANG 3'));
  if (!txt1 || !txt2 || !txt3 || txt1.x !== 85 || txt2.x !== 205 || txt3.x !== 315) {
    throw new Error(`Test 20 failed: Texts not separated: txt1=${txt1?.x}, txt2=${txt2?.x}, txt3=${txt3?.x}`);
  }

  const boxHak = p20.boxes.find((b: any) => b.bmk === '+HAK');
  const boxZp = p20.boxes.find((b: any) => b.bmk === '+ZP1');
  const boxWp = p20.boxes.find((b: any) => b.bmk === '+UV-WP');
  const boxHh = p20.boxes.find((b: any) => b.bmk === '+UV-HH');
  if (!boxHak || !boxZp || !boxWp || !boxHh) {
    throw new Error('Test 20 failed: missing boxes');
  }
  if (boxWp.x + boxWp.width > boxHh.x) {
    throw new Error(`Test 20 failed: +UV-WP overlaps +UV-HH: WP=${boxWp.x}..${boxWp.x + boxWp.width}, HH=${boxHh.x}..${boxHh.x + boxHh.width}`);
  }
  console.log('✓ Test 20: distribute_sheet_layout separated narrow columns (25mm), resolved 4 boxes (+HAK, +ZP1, +UV-WP, +UV-HH), and distributed stacked Strang headers to X: [85, 205, 315]');

  console.log('All MCP Tool Registry tests passed successfully! 🎉');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
