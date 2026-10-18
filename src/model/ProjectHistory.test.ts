import assert from 'node:assert/strict';
import { ProjectHistory } from './ProjectHistory';
import { Project } from './types';
const initial = {
  id: 'test', name: 'Test', activePageId: 'a', modified: 'today', symbolLibrary: [{ id: 'shared', pins: [] }],
  pages: [ { id: 'a', components: [{ id: 'c', bmk: '-Q1', x: 1, pins: { p: { wireIds: ['w'] } } }],
    wires: [{ id: 'w' }], suppressedAutoconnections: ['suppressed'] }, { id: 'b', components: [], wires: [] } ],
  logicalConnections: [{ id: 'native' }]
} as unknown as Project;
const clone = () => JSON.parse(JSON.stringify(initial)) as Project;
const history = new ProjectHistory(); let p = clone(); history.reset(p);
assert(!history.canUndo && !history.canRedo);
p.activePageId = 'b'; assert(!history.record(p), 'Page navigation is not an edit');
p.activePageId = 'a'; p.pages[0].components[0].x = 42; assert(history.record(p));
p.pages[0].components = []; p.pages[0].wires = []; p.logicalConnections = []; history.record(p);
p = history.undo()!;
assert.equal(p.pages[0].components[0].x, 42); assert.equal(p.pages[0].wires[0].id, 'w');
assert.equal(p.logicalConnections![0].id, 'native'); assert.deepEqual(p.pages[0].suppressedAutoconnections, ['suppressed']);
p = history.undo()!; assert.equal(p.pages[0].components[0].x, 1);
p = history.redo()!; assert.equal(p.pages[0].components[0].x, 42);
p.pages[0].components[0].bmk = '-Q99'; history.record(p); assert(!history.canRedo, 'A new edit branches history');
assert.equal(history.undo()!.pages[0].components[0].bmk, '-Q1');
// Restore does not hand out a mutable history object, including shared library.
p = history.redo()!; p.symbolLibrary![0].name = 'Changed'; p.pages[0].components[0].x = 99;
assert.equal(history.undo()!.pages[0].components[0].x, 42);
assert.equal(initial.pages[0].components[0].x, 1);
history.reset(clone()); p = clone();
p.activePageId = 'b'; p.pages[1].title = 'Edited elsewhere'; history.record(p);
assert.equal(history.undo()!.activePageId, 'b', 'Undo focuses the edited page');
history.reset(clone()); p = clone();
for (const bmk of ['-Q2', '-Q23', '-Q234']) { p.pages[0].components[0].bmk = bmk; history.record(p, 'field-session'); }
assert.equal(history.undo()!.pages[0].components[0].bmk, '-Q1', 'A property entry is one step');
assert(!history.canUndo); assert.equal(history.redo()!.pages[0].components[0].bmk, '-Q234');
history.reset(clone()); p = clone();
p.pages[0].components[0].bmk = '-Q2'; history.record(p, 'typing');
p.pages[0].components[0].bmk = '-Q1'; history.record(p, 'typing'); assert(!history.canUndo, 'Typing back to the original value adds no empty step');
history.reset(clone()); p = clone();
p.pages[0].title = 'A edited'; history.record(p);
p.activePageId = 'b'; p.pages[1].title = 'B edited'; history.record(p);
assert.equal(history.undo()!.activePageId, 'b'); assert.equal(history.undo()!.activePageId, 'a');
assert.equal(history.redo()!.activePageId, 'a'); assert.equal(history.redo()!.activePageId, 'b');
const limited = new ProjectHistory(2); p = clone(); limited.reset(p);
for (let i = 2; i < 6; i++) { p.pages[0].components[0].x = i; limited.record(p); }
assert.equal(limited.undo()!.pages[0].components[0].x, 4); assert.equal(limited.undo()!.pages[0].components[0].x, 3); assert(!limited.canUndo);
history.reset(clone()); assert(!history.canUndo && !history.canRedo, 'Opening a document clears old history');
console.log('✓ Project history: full edits, wires/netlist, coalescing, cross-page undo, branches, reset and limits');
