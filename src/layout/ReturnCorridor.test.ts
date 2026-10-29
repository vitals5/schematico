import assert from 'node:assert/strict';
import type { LayoutSnapshot } from './types';
import { returnCorridor } from './returnCorridor';
import { routeSelected } from './router';
import { validateLayout } from './validate';

function circuit(horizontal = false, blocked = false): LayoutSnapshot {
    const point = (x: number, y: number) => horizontal ? { x: y, y: x } : { x, y };
    const rect = (x: number, y: number, width: number, height: number) => horizontal ? { x: y, y: x, width: height, height: width } : { x, y, width, height };
    const nodes: LayoutSnapshot['nodes'] = [40, 90, 160].map((y, i) => ({ id: 'device' + i, kind: 'component', fixed: false,
        origin: point(100, y), rect: rect(70, y, 60, 20),
        shapes: [{ id: 'body' + i, owner: 'device' + i, kind: 'body', rect: rect(95, y, 10, 20) }],
        pins: [{ id: 'in', ...point(100, y), direction: horizontal ? 'left' : 'top' },
            { id: 'out', ...point(100, y + 20), direction: horizontal ? 'right' : 'bottom' }],
    }));
    if (blocked) for (const [i, x] of [0, 131].entries()) nodes.push({ id: 'wall' + i, kind: 'image', fixed: true,
        origin: point(x, 0), rect: rect(x, 0, 69, 200), pins: [],
        shapes: [{ id: 'wall' + i, owner: 'wall' + i, kind: 'obstacle', rect: rect(x, 0, 69, 200) }] });
    return { pageId: 'p', area: { x: 0, y: 0, width: 200, height: 200 }, grid: { spacing: 2, origin: { x: 0, y: 0 } }, frames: [], issues: [], nodes,
        edges: [
            { id: 'serial1', from: { componentId: 'device0', pinId: 'out' }, to: { componentId: 'device1', pinId: 'in' }, potential: '', points: [] },
            { id: 'serial2', from: { componentId: 'device1', pinId: 'out' }, to: { componentId: 'device2', pinId: 'in' }, potential: '', points: [] },
            { id: 'return', from: { componentId: 'device0', pinId: 'in' }, to: { componentId: 'device2', pinId: 'in' }, potential: '', points: [] },
        ] };
}
for (const horizontal of [false, true]) for (const blocked of [false, true]) for (const reverse of [false, true]) for (const negative of [false, true]) {
    const s = circuit(horizontal, blocked), e = s.edges[2];
    if (negative) for (const n of s.nodes) {
        const axis = horizontal ? 'x' : 'y', size = horizontal ? 'width' : 'height';
        n.origin[axis] = 200 - n.origin[axis];
        n.rect[axis] = 200 - n.rect[axis] - n.rect[size];
        for (const shape of n.shapes) shape.rect[axis] = 200 - shape.rect[axis] - shape.rect[size];
        for (const pin of n.pins) {
            pin[axis] = 200 - pin[axis];
            pin.direction = ({ top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const)[pin.direction];
        }
    }
    if (reverse) [e.from, e.to] = [e.to, e.from];
    const before = JSON.stringify({ nodes: s.nodes, endpoints: s.edges.map(e => [e.from, e.to]) });
    const a = s.nodes.find(n => n.id === e.from.componentId)!.pins[0], b = s.nodes.find(n => n.id === e.to.componentId)!.pins[0];
    assert(returnCorridor(s, e, a, b, 2));
    assert.deepEqual(routeSelected(s, new Set(['return']), 2), []);
    const long = e.points.slice(1).map((q, i) => [e.points[i], q]).find(([p, q]) => Math.abs(horizontal ? p.x - q.x : p.y - q.y) > 80)!;
    assert(long, 'Long return run must exist');
    const lane = horizontal ? long[0].y : long[0].x;
    assert(blocked ? lane >= 69 && lane <= 131 : lane < 70 || lane > 130, 'Prefer outside envelope; retain valid inner path when outer corridors are blocked');
    assert.equal(JSON.stringify({ nodes: s.nodes, endpoints: s.edges.map(e => [e.from, e.to]) }), before);
    const onlyReturn = { ...s, edges: [e] };
    assert.equal(validateLayout(onlyReturn).metrics.wireObstacles, 0);
}
const s = circuit(), e = s.edges[2], a = s.nodes[0].pins[0], b = s.nodes[2].pins[0];
assert.equal(returnCorridor(s, e, a, { ...b, direction: 'bottom' }, 2), undefined);
assert.equal(returnCorridor(s, e, a, { ...b, y: a.y + 4 }, 2), undefined);
assert.equal(returnCorridor({ ...s, edges: [e] }, e, a, b, 2), undefined, 'Disconnected devices cannot define the return envelope');
assert.equal(returnCorridor({ ...s, grid: { ...s.grid, spacing: 0 } }, e, a, b, 2), undefined);
console.log('✓ Long return corridors, both axes and wire directions, hard obstacles, inner fallback, short/opposed/disconnected guards and immutable endpoints');

// The editor cleanup uses the same router; only the selected wire may change.
const { fixture, add } = await import('./testing/fixture');
const { cleanupConnections } = await import('../model/WireCleanup');
const { snapshotPage } = await import('./geometry');
const { topology } = await import('./types');
const { ProjectHistory } = await import('../model/ProjectHistory');
const project = fixture();
for (let i = 0; i < 3; i++) {
    const c = add(project, 'device' + i, 'contact_no', 300, 100 + i * 120);
    c.functionText = i === 1 ? 'Zusatzbedingung mit langer Beschriftung' : 'Steuerkontakt';
}
project.pages[0].wires = s.edges.map(e => ({ id: e.id, from: { ...e.from, pinId: e.from.pinId === 'in' ? '13' : '14' },
    to: { ...e.to, pinId: e.to.pinId === 'in' ? '13' : '14' }, potential: '', waypoints: [], isAutoconnect: false }));
const saved = JSON.stringify(project), net = topology(project), history = new ProjectHistory(); history.reset(project);
assert.deepEqual(cleanupConnections(project.pages[0], project, ['return']).failed, []);
assert.deepEqual(project.pages[0].components, JSON.parse(saved).pages[0].components);
assert.deepEqual(project.pages[0].wires.slice(0, 2), JSON.parse(saved).pages[0].wires.slice(0, 2));
assert.equal(topology(project), net);
assert.equal(validateLayout(snapshotPage(project.pages[0], project)).metrics.wireObstacles, 0);
history.record(project); assert.deepEqual(history.undo(), JSON.parse(saved));
console.log('✓ Selected editor cleanup preserves devices, other wires, electrical topology and undo');
