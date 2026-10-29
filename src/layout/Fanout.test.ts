import assert from 'node:assert/strict';
import type { ElkNode } from 'elkjs/lib/elk-api';
import type { Direction, LayoutSnapshot } from './types';
import { channelGap, fanoutPreferences } from './channels';
import { structuredGroup } from './structured';
import { routeAll } from './router';
import { netIds, validateLayout } from './validate';
import { fixture, add } from './testing/fixture';
import { getSymbolById } from '../model/symbols';
import { previewLayout, applyLayout } from './service';
import { topology } from './types';

assert.equal(channelGap([], 4, 6), 6);
assert.equal(channelGap([{ start: 1, end: 1, net: 'a' }], 4, 6), 6, 'Straight paths need no bend channel');
assert.equal(channelGap([{ start: 0, end: 20, net: 'a' }, { start: 0, end: 20, net: 'a' }], 4, 6), 8, 'Same-net branches can share space');
assert.equal(channelGap([{ start: 0, end: 20, net: 'a' }, { start: 0, end: 20, net: 'b' }], 4, 6), 12, 'Equal potential names do not merge independent nets');
assert.equal(channelGap([{ start: 0, end: 10, net: 'a' }, { start: 14, end: 24, net: 'b' }], 4, 6), 8, 'Separated spans reuse a channel');
assert.equal(channelGap([{ start: 0, end: 10, net: 'a' }, { start: 10, end: 24, net: 'b' }], 4, 6), 12, 'Touching spans of independent nets must not join');

function fanout(): LayoutSnapshot {
    const count = 8;
    const children: ElkNode[] = [{ id: 'supply', width: 90, height: 20, ports: Array.from({ length: count }, (_, i) => ({ id: JSON.stringify(['supply', String(i)]), x: 10 + i * 8, y: 20 })) },
        ...Array.from({ length: count }, (_, i) => ({ id: 'load' + i, width: 40, height: 20, ports: [{ id: JSON.stringify(['load' + i, 'p']), x: 20, y: 0 }] }))];
    const s: LayoutSnapshot = { pageId: 'p', area: { x: 0, y: 0, width: 600, height: 250 }, grid: { spacing: 4, origin: { x: 0, y: 0 } }, frames: [], issues: [],
        nodes: children.map(c => ({ id: c.id, kind: 'component', fixed: false, rect: { x: 0, y: 0, width: c.width!, height: c.height! }, origin: { x: 0, y: 0 },
            shapes: [{ id: c.id, owner: c.id, kind: 'body', rect: { x: 0, y: 0, width: c.width!, height: c.height! } }],
            pins: c.ports!.map((p, i) => ({ id: c.id === 'supply' ? String(i) : 'p', x: p.x!, y: p.y!, direction: c.id === 'supply' ? 'bottom' : 'top' })) })),
        edges: Array.from({ length: count }, (_, i) => ({ id: 'w' + i, from: { componentId: 'supply', pinId: String(i) }, to: { componentId: 'load' + i, pinId: 'p' }, points: [], potential: 'Signal' })) };
    const before = JSON.stringify(s);
    const laid = structuredGroup('g', children, s, 6, { left: 8, right: 8, top: 8, bottom: 8 })!;
    assert.equal(JSON.stringify(s), before);
    for (const c of laid.children!) {
        const n = s.nodes.find(n => n.id === c.id)!;
        for (const p of n.pins) { p.x += c.x!; p.y += c.y!; }
        for (const shape of n.shapes) { shape.rect.x += c.x!; shape.rect.y += c.y!; }
        n.rect.x = c.x!; n.rect.y = c.y!;
    }
    const supply = s.nodes.find(n => n.id === 'supply')!, load = s.nodes.find(n => n.id === 'load0')!;
    assert(load.rect.y - supply.rect.y - supply.rect.height > 6, 'Placement reserves routing demand instead of a fixed six-unit gap');
    return s;
}

function reflect(s: LayoutSnapshot): LayoutSnapshot {
    const result = structuredClone(s), height = s.area.height;
    for (const n of result.nodes) {
        n.rect.y = height - n.rect.y - n.rect.height;
        for (const g of n.shapes) g.rect.y = height - g.rect.y - g.rect.height;
        for (const p of n.pins) { p.y = height - p.y; if (p.direction === 'top') p.direction = 'bottom'; else if (p.direction === 'bottom') p.direction = 'top'; }
    }
    return result;
}
function transpose(s: LayoutSnapshot): LayoutSnapshot {
    const result = structuredClone(s);
    const directions: Record<Direction, Direction> = { top: 'left', bottom: 'right', left: 'top', right: 'bottom' };
    const point = (p: { x: number; y: number }) => { [p.x, p.y] = [p.y, p.x]; };
    const rect = (r: { x: number; y: number; width: number; height: number }) => { point(r); [r.width, r.height] = [r.height, r.width]; };
    rect(result.area);
    for (const n of result.nodes) {
        rect(n.rect); for (const g of n.shapes) rect(g.rect);
        for (const p of n.pins) { point(p); p.direction = directions[p.direction]; }
    }
    return result;
}

for (const transform of [(s: LayoutSnapshot) => s, reflect, transpose, (s: LayoutSnapshot) => transpose(reflect(s))]) {
    for (const reversed of [false, true]) {
        const s = transform(fanout());
        if (reversed) for (const e of s.edges) [e.from, e.to] = [e.to, e.from];
        const original = structuredClone(s), nets = netIds(s);
        assert.equal(new Set(nets.values()).size, 8, 'Identical potential labels still represent eight independent nets');
        assert.equal(fanoutPreferences(s).size, 8);
        routeAll(s, false, true, 4);
        const report = validateLayout(s);
        assert(report.valid, JSON.stringify(report.issues));
        assert.equal(report.metrics.crossings, 0, 'Ordered outer-first fan-out avoids crossings in both axes and directions');
        assert.equal(report.metrics.bends, 16, 'Each displaced conductor uses only two bends');
        assert.deepEqual(netIds(s), nets);
        assert.deepEqual(s.nodes, original.nodes, 'Routing changes no bodies, pins, labels or component attributes');
        assert.deepEqual(s.edges.map(({ points, ...e }) => e), original.edges.map(({ points, ...e }) => e));
        const repeat = structuredClone(original); routeAll(repeat, false, true, 4);
        assert.deepEqual(repeat, s, 'Deterministic routing');
    }
}

// Intentional crossed pin assignment must not be silently reinterpreted as an ordered bank.
const crossed = fanout();
[crossed.edges[0].to, crossed.edges[1].to] = [crossed.edges[1].to, crossed.edges[0].to];
assert.equal(fanoutPreferences(crossed).size, 0);
const tight = fanout();
for (const n of tight.nodes.filter(n => n.id !== 'supply')) {
    const dy = 34 - n.rect.y; n.rect.y += dy;
    for (const p of n.pins) p.y += dy;
    for (const g of n.shapes) g.rect.y += dy;
}
routeAll(tight, false, true, 4);
assert(!validateLayout(tight).valid, 'Insufficient space remains an error; fan-out preferences never bypass obstacles or clearance');

// Full editor model: visible labels, grid snapping and sheet packing must retain
// the global arrangement even without an explicit functional group.
const project = fixture();
const base = getSymbolById('circuit_breaker_1p', project)!;
project.symbolLibrary = [
    { ...base, id: 'test_port_bank', name: 'Test-Anschlussblock', width: 90, height: 20,
        svgContent: '<rect x="0" y="0" width="90" height="20" fill="none" stroke="currentColor"/>',
        pins: Array.from({ length: 8 }, (_, i) => ({ id: String(i), name: String(i + 1), x: 10 + i * 8, y: 20, direction: 'bottom', labelPosition: { x: 10 + i * 8, y: 14, fontSize: 5, alignment: 'middle' } })) },
    { ...base, id: 'test_output', name: 'Test-Abgang', width: 40, height: 20,
        svgContent: '<rect x="0" y="0" width="40" height="20" fill="none" stroke="currentColor"/>',
        pins: [{ id: 'p', name: '1', x: 20, y: 0, direction: 'top', labelPosition: { x: 20, y: 10, fontSize: 5, alignment: 'middle' } }] },
];
const source = add(project, 'source', 'test_port_bank'); source.bmk = '-X1'; source.functionText = 'Signalverteiler';
for (let i = 0; i < 8; i++) { const c = add(project, 'load' + i, 'test_output'); c.bmk = '-X' + (i + 2); c.functionText = 'Abgang ' + (i + 1); }
project.pages[0].wires = Array.from({ length: 8 }, (_, i) => ({ id: 'w' + i, from: { componentId: 'source', pinId: String(i) }, to: { componentId: 'load' + i, pinId: 'p' }, potential: 'Signal', waypoints: [], isAutoconnect: false }));
const locked = add(project, 'fixed', 'circuit_breaker_1p', 600, 350);
const before = JSON.stringify(project), net = topology(project);
const preview = await previewLayout(project, 'p', { multiPage: false, lockedIds: ['fixed'] });
assert.equal(JSON.stringify(project), before, 'Preview never changes the source project');
const candidate = preview.candidates.find(c => c.profile === 'structured');
assert(candidate, 'Ungrouped circuit survives sheet packing, routing and stored-model validation');
assert.equal(candidate.report.metrics.crossings, 0);
const outputs = candidate.page.components.filter(c => c.id.startsWith('load'));
assert(outputs.every(c => c.y === outputs[0].y), 'Individual sheet packing must not destroy common device levels');
const fixed = candidate.page.components.find(c => c.id === 'fixed')!;
assert.deepEqual([fixed.x, fixed.y, fixed.rotation], [locked.x, locked.y, locked.rotation], 'Coherent placement respects fixed obstacles');
applyLayout(project, candidate);
assert.equal(topology(project), net);
console.log('✓ Demand-based channels, independent nets, ordered fan-out/fan-in in both axes, complete wire costs and hard routing constraints');
