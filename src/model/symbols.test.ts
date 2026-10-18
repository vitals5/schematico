import assert from 'node:assert/strict';
import { MacroManager } from './MacroManager';
import { Page, PlacedComponent, Project, SymbolDefinition } from './types';
import { getSymbolById, getSymbolDefinitions, getSymbolForComponent, mergeProjectSymbolLibrary, setProjectSymbolLibrary } from './symbols';

const symbol: SymbolDefinition = {
  id: 'native:DIC_W:1:0', name: 'Projekt-Schütz', category: 'relays',
  standard: 'DIN EN 60617', defaultBmkPrefix: '-K', defaultFunctionText: '',
  width: 20, height: 40, pins: [{ id: '0', name: 'A1', x: 10, y: 0, direction: 'top' }],
  svgContent: '<line x1="10" x2="10" y1="0" y2="40" stroke="currentColor"/>',
  description: 'Project master data', source: { library: 'DIC_W', number: 1, variant: 0 }
};
const component = (id: string): PlacedComponent => ({
  id, symbolId: symbol.id, bmk: '-K1', functionText: 'Original', x: 80, y: 160,
  rotation: 0, pins: { '0': { customLabel: 'A1' } }
});
function project(components: PlacedComponent[] = [], library: SymbolDefinition[] = []): Project {
  return {
    id: 'test', name: 'Library test', description: '', standard: 'DIN EN 81346-2 / IEC 60617',
    version: '1', created: '', modified: '', author: '', company: '', activePageId: 'page',
    symbolLibrary: JSON.parse(JSON.stringify(library)), pages: [{
      id: 'page', pageNumber: '1', title: '', higherLevel: '', location: '', pageType: 'schematic',
      components, wires: [], plotFrame: {
        type: 'DIN_A3_LANDSCAPE', width: 1000, height: 700, columns: 10, rows: [],
        titleBlock: { projectTitle: '', commission: '', company: '', author: '', date: '', revision: '', sheetNumber: '1', totalSheets: '1' }
      }
    } satisfies Page]
  };
}

const first = project([component('a'), component('b')], [symbol]);
setProjectSymbolLibrary(first);
assert.equal(getSymbolForComponent(first.pages[0].components[0]), first.symbolLibrary![0]);
assert.equal(getSymbolForComponent(first.pages[0].components[1]), first.symbolLibrary![0]);
assert(getSymbolById('contactor_coil'), 'built-in symbols remain available');
assert(getSymbolDefinitions().some(s => s.id === symbol.id), 'project symbols are placeable in the palette');
first.symbolLibrary![0].name = 'Edited master data';
assert.equal(getSymbolForComponent(first.pages[0].components[1])!.name, 'Edited master data');
const saved = JSON.parse(JSON.stringify(first)) as Project;
setProjectSymbolLibrary(project());
assert.equal(getSymbolById(symbol.id), undefined, 'project switch cannot leak the previous library');
assert.equal(getSymbolById(symbol.id, saved)!.name, 'Edited master data', 'explicit context works independently');
setProjectSymbolLibrary(saved);
assert.deepEqual(getSymbolForComponent(saved.pages[0].components[0])!.pins, symbol.pins);
assert(saved.pages[0].components.every(c => !c.importedSymbol));

const legacyA = { ...component('legacy-a'), importedSymbol: symbol };
const legacyB = { ...component('legacy-b'), importedSymbol: { ...symbol, width: 31 } };
const legacy = project([legacyA, legacyB]);
setProjectSymbolLibrary(legacy);
assert.equal(legacy.symbolLibrary!.length, 2, 'legacy variants with a colliding ID retain their own geometry');
assert.equal(getSymbolForComponent(legacyA)!.width, 20);
assert.equal(getSymbolForComponent(legacyB)!.width, 31);
assert(!legacyA.importedSymbol && !legacyB.importedSymbol);

setProjectSymbolLibrary(saved);
const macro = MacroManager.createMacroFromComponents('Portable', '', '', saved.pages[0].components);
const exported = MacroManager.exportMacro(macro);
const parsed = await MacroManager.parseMacroFile(new File([exported.blob], exported.filename));
assert.equal(parsed.type, 'ema');
if (parsed.type !== 'ema') throw new Error('Expected window macro');
assert.deepEqual(parsed.symbolLibrary, saved.symbolLibrary, 'macro export and import retains project master data');
const destination = project([], [{ ...symbol, width: 99 }]);
setProjectSymbolLibrary(destination);
const placed = MacroManager.instantiateWindowMacro(parsed, 100, 200, [], destination);
assert.notEqual(placed.components[0].symbolId, symbol.id, 'conflicting macro symbol receives a new shared ID');
assert.equal(getSymbolForComponent(placed.components[0], destination)!.width, 20);
assert.equal(getSymbolById(symbol.id, destination)!.width, 99, 'existing master data remains intact');
assert.equal(placed.components[0].pins['0'].customLabel, 'A1');
assert.equal(placed.components[0].x, 100);
assert.equal(placed.components[0].functionText, 'Original');

// Creation resolves the active project's shared master data.
setProjectSymbolLibrary(saved);
const portablePage = MacroManager.createMacroFromPage(saved.pages[0]);
setProjectSymbolLibrary(destination);
const page = MacroManager.instantiatePageMacro(portablePage, destination);
assert.equal(getSymbolForComponent(page.components[0], destination)!.width, 20);
assert.equal(destination.symbolLibrary!.length, 2, 'reusing a macro deduplicates its definition');

const collision = project([], [{ ...symbol, width: 99 }]);
const incoming = [symbol, { ...symbol, id: `${symbol.id}:import-1`, width: 55 }];
const incomingComponents = [component('one'), { ...component('two'), symbolId: incoming[1].id }];
mergeProjectSymbolLibrary(collision, incoming, incomingComponents);
assert.equal(getSymbolForComponent(incomingComponents[0], collision)!.width, 20);
assert.equal(getSymbolForComponent(incomingComponents[1], collision)!.width, 55, 'collision remapping cannot capture another incoming symbol ID');
console.log('Project-scoped symbol master data, legacy migration, JSON and portable macro round trips passed.');
