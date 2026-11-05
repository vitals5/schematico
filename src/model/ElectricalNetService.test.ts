import assert from 'node:assert/strict';
import { fixture, add } from '../layout/testing/fixture';
import { ProjectIndex } from './ProjectIndex';
import { ElectricalNetService, sameConductorTopology } from './ElectricalNetService';
import { electricalDefinition, electricalPinGroups } from './ElectricalDefinition';
import { getSymbolById, SYMBOL_DEFINITIONS } from './symbols';
import { snapshotPage } from '../layout/geometry';
import { netIds } from '../layout/validate';
import { TerminalDiagramGenerator } from '../reports/TerminalDiagram';
import { collectPlausibilityMessages } from './ProjectInspection';
import { McpToolRegistry } from '../ai/mcp-tools';
import type { Project, Wire, PlacedComponent } from './types';

const connect = (p: Project, id: string, a: PlacedComponent, ap: string, b: PlacedComponent, bp: string, potential = 'N') => {
  const wire: Wire = { id, from: { componentId: a.id, pinId: ap }, to: { componentId: b.id, pinId: bp }, potential };
  p.pages[0].wires.push(wire);
  return wire;
};
function inspect(p: Project) {
  const index = new ProjectIndex(p), service = new ElectricalNetService(index);
  const pin = (c: PlacedComponent, id: string) => index.pin(index.entry(c)!, id)!;
  const net = (c: PlacedComponent, id: string) => service.netForPin(pin(c, id))!;
  return { index, service, pin, net };
}

// Wire names, device labels and drawing intersections never define conductor identity.
const p = fixture(), socket1 = add(p, 's1', 'socket_schuko'), socket2 = add(p, 's2', 'socket_schuko');
const other = add(p, 'other', 'socket_schuko'), coil = add(p, 'coil', 'contactor_coil');
const contact = add(p, 'contact', 'contact_nc'); contact.bmk = coil.bmk;
socket1.pins.N.customLabel='PE'; socket1.pins.PE.customLabel='N';
connect(p, 'neutral', socket1, 'N', socket2, 'N', 'same-name');
connect(p, 'earth', socket1, 'PE', socket2, 'PE', 'same-name');
connect(p, 'independent', other, 'N', coil, 'A1', 'same-name');
const before = JSON.stringify(p);
let state = inspect(p);
assert.notEqual(state.net(socket1, 'N').id, state.net(socket1, 'PE').id);
assert.equal(state.pin(socket1,'N').role,'neutral','Custom label text does not change the electrical role');
assert.notEqual(state.net(socket1, 'N').id, state.net(other, 'N').id);
assert.notEqual(state.net(coil, 'A1').id, state.net(coil, 'A2').id);
assert.notEqual(state.net(coil, 'A1').id, state.net(contact, '21').id);
assert.notEqual(state.net(contact, '21').id, state.net(contact, '22').id, 'NC drawing is not a simulated permanent bridge');
const ids = state.service.nets.map(n => n.id);
assert.equal(JSON.stringify(p), before, 'Inspection does not mutate project or library data');
for (const c of p.pages[0].components) { c.x += 250; c.y += 200; c.rotation = 180; c.bmk += '-renamed'; }
p.pages[0].components.reverse(); p.pages[0].wires.reverse();
for (const w of p.pages[0].wires) { [w.from, w.to] = [w.to, w.from]; w.waypoints = [{ x: 800, y: 900 }]; }
assert.deepEqual(inspect(p).service.nets.map(n => n.id), ids, 'IDs are independent of layout, labels, order and wire direction');
assert.deepEqual(inspect(JSON.parse(JSON.stringify(p))).service.nets.map(n => n.id), ids, 'Portable JSON roundtrip preserves topology');

// Real separated crossing paths, never four independent ends or a four-way short.
const crossing = fixture(), bridge = add(crossing, 'bridge', 'cross_bridge');
const ends = [1, 2, 3, 4].map(i => add(crossing, 'end' + i, 'socket_schuko'));
ends.forEach((c, i) => connect(crossing, 'bridge' + i, bridge, String(i + 1), c, '1'));
const cs = inspect(crossing), layoutNets = netIds(snapshotPage(crossing.pages[0], crossing));
assert.equal(cs.net(ends[0], '1'), cs.net(ends[1], '1'));
assert.equal(cs.net(ends[2], '1'), cs.net(ends[3], '1'));
assert.notEqual(cs.net(ends[0], '1'), cs.net(ends[2], '1'));
for (const a of crossing.pages[0].wires) for (const b of crossing.pages[0].wires)
  assert.equal(layoutNets.get(a.id) === layoutNets.get(b.id),
    cs.service.netForPin(cs.index.pin(cs.index.component(a.from.componentId)!, a.from.pinId)!)
    === cs.service.netForPin(cs.index.pin(cs.index.component(b.from.componentId)!, b.from.pinId)!), 'Layout and project graph agree');

// Permanent distribution paths and isolated terminal levels are explicit master data.
for (const symbol of SYMBOL_DEFINITIONS) assert.equal(electricalPinGroups(symbol).invalid.length, 0, symbol.id);
const blocks = fixture(), block = add(blocks, 'block', 'catalog_distribution_block_copper');
state = inspect(blocks);
assert.equal(state.net(block, 'L1-IN'), state.net(block, 'L1.3'));
assert.notEqual(state.net(block, 'L1-IN'), state.net(block, 'L2-IN'));
const levels = add(blocks, 'levels', 'catalog_feed_terminal_push_in_3');
const disconnect = add(blocks, 'disconnect', 'catalog_disconnect_terminal_knife');
const earthTerminal=add(blocks,'earth-terminal','terminal_pe');
state = inspect(blocks);
assert.equal(state.pin(earthTerminal,'1').role,'protective_earth');
assert.equal(state.net(levels, '1.1'), state.net(levels, '1.2'));
assert.notEqual(state.net(levels, '1.1'), state.net(levels, '2.1'));
assert.notEqual(state.net(disconnect, '1.1'), state.net(disconnect, '1.2'));

// Report tracing follows branches and named sheet continuations, preserving sides.
const report = fixture(); report.pages[0].higherLevel = '=A'; report.pages[0].location = '+L';
const terminal = add(report, 'terminal', 'terminal_single'); terminal.bmk = '-X1:7';
const tee = add(report, 'tee', 't_piece_down'), arrow = add(report, 'arrow', 'potential_arrow_right'); arrow.bmk = 'BUS.N';
const upstream = add(report, 'up', 'contactor_coil'), branch = add(report, 'branch', 'contactor_coil');
connect(report, 'inside', terminal, '1', upstream, 'A1');
connect(report, 'out', terminal, '2', tee, '1');
connect(report, 'branch', tee, '2', branch, 'A1');
connect(report, 'to-arrow', tee, '3', arrow, '1');
const remoteArrow = add(report, 'remote-arrow', 'potential_arrow_left'); remoteArrow.bmk = 'BUS.N';
const remote = add(report, 'remote', 'contactor_coil');
const remotePage = structuredClone(report.pages[0]); remotePage.id = 'p2'; remotePage.pageNumber = '2'; remotePage.location = '+Remote';
remotePage.components = [remoteArrow, remote];
report.pages[0].components = report.pages[0].components.filter(c => !remotePage.components.includes(c));
const remoteWire = connect(report, 'remote-wire', remoteArrow, '1', remote, 'A1');
report.pages[0].wires.pop(); remotePage.wires = [remoteWire]; report.pages.push(remotePage);
const rs = inspect(report);
assert.equal(rs.net(terminal, '2'), rs.net(remote, 'A1'), 'Explicit interruption symbols bridge locations in the same plant');
assert.deepEqual(rs.service.traceTargets(rs.pin(terminal, '2')).targets.map(t => t.owner.component.id), ['branch', 'remote']);
const row = TerminalDiagramGenerator.generateTerminalReport(report).get('-X1')![0];
assert.equal(row.internalTarget, '-up:A1');
assert.equal(row.externalTarget, '-branch:A1, =A+Remote-remote:A1');
remotePage.higherLevel = '=Other';
state = inspect(report); assert.notEqual(state.net(terminal, '2'), state.net(remote, 'A1'));
report.logicalConnections = [{ id: 'logical', from: { componentId: arrow.id, pinId: '1' }, to: { componentId: remoteArrow.id, pinId: '1' }, potential: 'N' }];
state = inspect(report); assert.equal(state.net(terminal, '2'), state.net(remote, 'A1'), 'Explicit logical edge crosses plants');

// Unknown import semantics are retained; malformed groups never partially join pins.
const imported = fixture(), custom = structuredClone(getSymbolById('terminal_single', imported)!);
custom.id = 'unknown-import'; delete custom.electrical; custom.source = { library: 'USER', number: 1, variant: 0 };
imported.symbolLibrary = [custom];
const unknown = add(imported, 'unknown', custom.id); state = inspect(imported);
assert.equal(state.service.knowledge.get(state.index.entry(unknown)!), 'unknown');
assert.notEqual(state.net(unknown, '1'), state.net(unknown, '2'));
assert(state.net(unknown, '1').knowledgeIncomplete);
custom.electrical = { permanentConnections: [['1', 'missing', '2']] };
state = inspect(imported); assert(state.service.issues.some(i => i.code === 'invalid_internal_group'));
assert.notEqual(state.net(unknown, '1'), state.net(unknown, '2'));
(custom.electrical as any).permanentConnections = null;
assert(inspect(imported).service.issues.some(i => i.code === 'invalid_internal_group'));
delete custom.electrical;
const legacy = structuredClone(getSymbolById('terminal_pe')!); delete legacy.electrical;
assert.equal(electricalDefinition(legacy).knowledge, 'legacy');
const legacyBlock=structuredClone(getSymbolById('catalog_distribution_block_copper')!); delete legacyBlock.electrical;
assert.equal(electricalDefinition(legacyBlock).knowledge,'legacy','Previously saved standard master data retains known topology');
const changedLegacy=structuredClone(legacyBlock);changedLegacy.pins.pop();
assert.equal(electricalDefinition(changedLegacy).knowledge,'unknown','Modified port inventory must not inherit canonical groups');
custom.id = 't_piece_unknown'; delete custom.source;
assert.equal(electricalDefinition(custom).knowledge, 'unknown', 'Unknown ID prefixes must not invent connectivity');

// Inserting a real routing piece preserves the conductor's real endpoint identity.
const insertion = fixture(), left = add(insertion, 'left', 'socket_schuko'), right = add(insertion, 'right', 'socket_schuko');
connect(insertion, 'direct', left, 'N', right, 'N');
const originalId = inspect(insertion).net(left, 'N').id;
insertion.pages[0].wires = [];
const corner = add(insertion, '000-corner', 'corner_top_right');
connect(insertion, 'run1', left, 'N', corner, '1'); connect(insertion, 'run2', corner, '2', right, 'N');
assert.equal(inspect(insertion).net(left, 'N').id, originalId);
const split = structuredClone(insertion), next = structuredClone(split.pages[0]);
next.id='next'; next.pageNumber='2'; next.components=split.pages[0].components.filter(c=>c.id===right.id);next.wires=[];
split.pages[0].components=split.pages[0].components.filter(c=>c.id!==right.id);split.pages.push(next);
split.logicalConnections=split.pages[0].wires.filter(w=>w.id==='run2');
split.pages[0].wires=split.pages[0].wires.filter(w=>w.id!=='run2');
assert(sameConductorTopology(insertion,split),'Moving a placement between pages and keeping its logical edges preserves identity');
split.logicalConnections[0].to.pinId='PE';
assert(!sameConductorTopology(insertion,split),'Global comparison detects shorts and interruptions across sheets');
assert(sameConductorTopology(insertion,insertion),'Self-comparison includes isolated contacts');

// A real N/PE link is diagnosed; names alone are not mistaken for such a link.
const mixed = fixture(), s = add(mixed, 'socket', 'socket_schuko');
connect(mixed, 'short', s, 'N', s, 'PE', 'Signal');
state = inspect(mixed); assert(state.service.issues.some(i => i.code === 'neutral_pe_connection'));
assert(collectPlausibilityMessages(mixed).some(m => m.id.includes('neutral_pe_connection')));
mixed.pages[0].wires.push({ id: 'broken', from: { componentId: s.id, pinId: 'typo' }, to: { componentId: s.id, pinId: 'N' }, potential: 'N' });
assert(inspect(mixed).service.issues.some(i => i.code === 'invalid_endpoint'));
const registry = new McpToolRegistry(), manager = { getProject: () => mixed } as any;
const snapshot = JSON.stringify(mixed), response = await registry.executeTool('get_electrical_nets', {}, manager);
assert(response.success); assert.equal(response.switchStatesSimulated, false);
assert.deepEqual(response.messages.items, collectPlausibilityMessages(mixed));
assert.equal(JSON.stringify(mixed), snapshot, 'MCP query is read-only');
assert.equal((await registry.executeTool('get_electrical_nets', { pageId: 'missing' }, manager)).success, false);
console.log('✓ Shared electrical topology: separate conductors, permanent/conditional groups, crossings, sheet links, terminal tracing, unknown imports, stable endpoint IDs and UI/MCP parity');
