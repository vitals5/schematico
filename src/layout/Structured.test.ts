import assert from 'node:assert/strict';
import { structuredGroup, designPenalty } from './structured';
import { routeAll } from './router';
import { fixture, add } from './testing/fixture';
import { previewLayout, applyLayout } from './service';
import { topology } from './types';
const port = (id: string, p: string, x: number, y: number) => ({ id: JSON.stringify([id, p]), x, y });
const children = [
    { id: 'source', width: 40, height: 30, ports: [port('source', 'out', 20, 30)] },
    { id: 'load', width: 20, height: 20, ports: [port('load', 'in', 10, 0)] },
    { id: 'input', width: 15, height: 8, ports: [port('input', 'active', 15, 4), port('input', 'unused', 15, 4)] },
];
const snapshot: any = { nodes: [
        { id: 'source', rect: { x: 0, y: 0 }, pins: [{ id: 'out', direction: 'bottom' }], shapes: [{ kind: 'body', rect: { y: 5 } }] },
        { id: 'load', rect: { x: 0, y: 0 }, pins: [{ id: 'in', direction: 'top' }], shapes: [{ kind: 'body', rect: { y: 2 } }] },
        { id: 'input', handover: true, pins: [{ id: 'active', direction: 'right' }, { id: 'unused', direction: 'left' }], shapes: [] },
    ], edges: [
        { from: { componentId: 'source', pinId: 'out' }, to: { componentId: 'load', pinId: 'in' } },
        { from: { componentId: 'input', pinId: 'active' }, to: { componentId: 'source', pinId: 'out' } },
    ] };
const before = JSON.stringify({ children, snapshot });
const padding = { left: 8, right: 8, top: 8, bottom: 8 };
const layout = structuredGroup('root', children, snapshot, 10, padding)!;
assert(layout);
const byId = new Map(layout.children!.map(n => [n.id, n]));
const source = byId.get('source')!, load = byId.get('load')!, input = byId.get('input')!;
assert.equal(source.x! + 20, load.x! + 10, 'Unequal label envelopes share the actual port axis');
assert(input.x! + input.width! < source.x!, 'Only the connected handover pin decides the edge bank');
assert(source.y! < load.y!, 'Serial devices retain vertical levels');
assert.equal(JSON.stringify({ children, snapshot }), before, 'Layout never mutates source graph or library geometry');
assert.deepEqual(layout, structuredGroup('root', children, snapshot, 10, padding), 'Deterministic style layout');
// Axis deviation is visible in the quality score even when no bodies collide.
const axes: any = { nodes: [{ id: 'a', pins: [{ id: 'p', direction: 'bottom', x: 20, y: 10 }] }, { id: 'b', pins: [{ id: 'p', direction: 'top', x: 20, y: 30 }] }], edges: [{ from: { componentId: 'a', pinId: 'p' }, to: { componentId: 'b', pinId: 'p' } }] };
assert.equal(designPenalty(axes), 0);
axes.nodes[1].pins[0].x += 12;
assert(designPenalty(axes) > 0);
// Bundle routing may never merge the two independent nets or cross a body.
const circuit: any = { pageId: 'p', area: { x: 0, y: 0, width: 100, height: 100 }, grid: { spacing: 2, origin: { x: 0, y: 0 } }, frames: [], issues: [], nodes: [
        { id: 's', shapes: [], pins: [{ id: '1', direction: 'bottom', x: 20, y: 10 }, { id: '2', direction: 'bottom', x: 24, y: 10 }] },
        { id: 't', shapes: [], pins: [{ id: '1', direction: 'top', x: 20, y: 80 }, { id: '2', direction: 'top', x: 24, y: 80 }] },
    ], edges: [1, 2].map(n => ({ id: 'e' + n, from: { componentId: 's', pinId: String(n) }, to: { componentId: 't', pinId: String(n) }, potential: 'L' + n, points: [] })) };
routeAll(circuit, false, true);
assert.equal(circuit.issues.length, 0);
for (const e of circuit.edges) {
    assert.equal(e.points[0].x, e.id === 'e1' ? 20 : 24);
    assert.equal(e.points.at(-1).y, 80);
}
assert.notDeepEqual(circuit.edges[0].points, circuit.edges[1].points);
// Real model round-trip: preview/apply, constraints and net graph survive.
const project = fixture();
add(project, 's', 'circuit_breaker_3p');
add(project, 't', 'circuit_breaker_3p');
project.pages[0].wires = [1, 3, 5].map((pin, i) => ({ id: 'w' + i, from: { componentId: 's', pinId: String(pin + 1) }, to: { componentId: 't', pinId: String(pin) }, potential: 'L' + (i + 1), waypoints: [], isAutoconnect: false } as any));
const original = JSON.stringify(project), net = topology(project);
const preview = await previewLayout(project, 'p', { multiPage: false });
assert.equal(JSON.stringify(project), original);
const candidate = preview.candidates.find(c => c.profile === 'structured');
assert(candidate, 'Structured candidate must pass the final stored-model validation');
applyLayout(project, candidate);
assert.equal(topology(project), net);
console.log('✓ Structured axes, handover banks, quality scoring, independent bundle nets and stored-model validation');
// Multi-pole terminal rows follow physical source ports, even with misleading IDs.
const bankChildren: any[] = [{ id: 'supply', width: 60, height: 20, ports: [0, 1, 2, 3].map(i => port('supply', 'p' + i, 10 + i * 10, 20)) },
    ...['zL1', 'aL2', 'qL3', 'bN'].map(id => ({ id, width: 12, height: 14, ports: [port(id, 'p', 6, 0)] }))];
const bankSnapshot: any = { nodes: bankChildren.map(c => ({ id: c.id, rect: { x: 0, y: 0 }, shapes: [], pins: c.ports.map((p: any, i: number) => ({ id: c.id === 'supply' ? 'p' + i : 'p', direction: c.id === 'supply' ? 'bottom' : 'top' })) })),
    edges: ['zL1', 'aL2', 'qL3', 'bN'].map((id, i) => ({ from: { componentId: 'supply', pinId: 'p' + i }, to: { componentId: id, pinId: 'p' } })) };
const bankLayout = structuredGroup('bank', bankChildren, bankSnapshot, 6, padding)!;
const order = bankLayout.children!.filter(n => n.id !== 'supply').sort((a, b) => a.x! - b.x!).map(n => n.id);
assert.deepEqual(order, ['zL1', 'aL2', 'qL3', 'bN'], 'Conductor order follows ports, not lexical component IDs');
// Different annotation heights do not change body baselines within one device level.
const baselineChildren: any[] = [{ id: 'a', width: 20, height: 30, ports: [] }, { id: 'b', width: 20, height: 20, ports: [] }];
const baselineSnapshot: any = { nodes: [{ id: 'a', rect: { x: 0, y: 0 }, pins: [], shapes: [{ kind: 'body', rect: { y: 15 } }] }, { id: 'b', rect: { x: 0, y: 0 }, pins: [], shapes: [{ kind: 'body', rect: { y: 3 } }] }], edges: [] };
const baseline = structuredGroup('baseline', baselineChildren, baselineSnapshot, 6, padding)!;
assert.equal(baseline.children![0].y! + 15, baseline.children![1].y! + 3);
console.log('✓ Phase-order and common-body-baseline regressions');
