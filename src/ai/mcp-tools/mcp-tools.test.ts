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
      return project.pages[0];
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

  console.log('All MCP Tool Registry tests passed successfully! 🎉');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
