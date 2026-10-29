import assert from 'node:assert/strict';
import type { ElkNode } from 'elkjs/lib/elk-api';
import type { Direction, LayoutSnapshot } from './types';
import { structuredGroup } from './structured';
import { alignSerialLanes } from './serialLanes';
import { fixture, add } from './testing/fixture';
import { previewLayout, applyLayout } from './service';
import { topology } from './types';

function repeated(horizontal: boolean) {
    const children: ElkNode[] = [{ id: 'feed', width: 120, height: 20, ports: [0, 1, 2].map(i => ({ id: JSON.stringify(['feed', String(i)]), x: 20 + i * 40, y: 20 })) }];
    const s: LayoutSnapshot = { pageId: 'p', area: { x: 0, y: 0, width: 800, height: 800 }, grid: { spacing: 4, origin: { x: 0, y: 0 } }, frames: [], issues: [], nodes: [], edges: [] };
    for (const [b, length] of [6, 3, 5].entries()) for (let k = 0; k < length; k++) {
        const id = `b${b}_${k}`, width = [30, 100, 50, 160][(k + b) % 4], x = width - 10;
        children.push({ id, width, height: 20, ports: [{ id: JSON.stringify([id, 'in']), x, y: 0 }, { id: JSON.stringify([id, 'out']), x, y: 20 }] });
        s.edges.push({ id: 'w' + id, from: { componentId: k ? `b${b}_${k - 1}` : 'feed', pinId: k ? 'out' : String(b) }, to: { componentId: id, pinId: 'in' }, potential: 'Signal', points: [] });
    }
    s.nodes = children.map(c => ({ id: c.id, kind: 'component', fixed: false, origin: { x: 0, y: 0 }, rect: { x: 0, y: 0, width: c.width!, height: c.height! },
        shapes: [{ id: c.id, owner: c.id, kind: 'body', rect: { x: c.width! - 20, y: 0, width: 20, height: 20 } }],
        pins: c.ports!.map((p, i) => ({ id: c.id === 'feed' ? String(i) : i ? 'out' : 'in', x: p.x!, y: p.y!, direction: c.id === 'feed' || i ? 'bottom' : 'top' })) }));
    if (horizontal) {
        const directions: Record<Direction, Direction> = { top: 'left', bottom: 'right', left: 'top', right: 'bottom' };
        for (const c of children) {
            [c.width, c.height] = [c.height, c.width];
            for (const p of c.ports!) [p.x, p.y] = [p.y, p.x];
        }
        for (const n of s.nodes) {
            [n.rect.width, n.rect.height] = [n.rect.height, n.rect.width];
            for (const g of n.shapes) { [g.rect.x, g.rect.y] = [g.rect.y, g.rect.x]; [g.rect.width, g.rect.height] = [g.rect.height, g.rect.width]; }
            for (const p of n.pins) { [p.x, p.y] = [p.y, p.x]; p.direction = directions[p.direction]; }
        }
    }
    return { children, s };
}
const padding = { left: 8, right: 8, top: 8, bottom: 8 };
for (const horizontal of [false, true]) {
    const { children, s } = repeated(horizontal), before = JSON.stringify({ children, s });
    const layout = structuredGroup('repeated', children, s, 6, padding)!;
    assert(layout);
    const byId = new Map(layout.children!.map(n => [n.id, n]));
    const axis = (n: ElkNode) => horizontal ? n.y! + n.ports![0].y! : n.x! + n.ports![0].x!;
    for (const [b, length] of [6, 3, 5].entries()) for (let k = 1; k < length; k++)
        assert(Math.abs(axis(byId.get(`b${b}_${k}`)!) - axis(byId.get(`b${b}_0`)!)) < 1e-6, 'Unequal label envelopes must not bend a serial branch');
    assert(axis(byId.get('b0_0')!) < axis(byId.get('b1_0')!) && axis(byId.get('b1_0')!) < axis(byId.get('b2_0')!), 'Branch order follows physical source pins rather than text-envelope edges');
    for (const [i, a] of layout.children!.entries()) for (const b of layout.children!.slice(i + 1)) {
        if ((horizontal ? a.x : a.y) !== (horizontal ? b.x : b.y)) continue;
        const [first, second] = horizontal ? a.y! < b.y! ? [a, b] : [b, a] : a.x! < b.x! ? [a, b] : [b, a];
        assert((horizontal ? first.y! + first.height! : first.x! + first.width!) + 6 <= (horizontal ? second.y! : second.x!) + 1e-6, 'Every row retains full annotation clearance');
    }
    assert.equal(JSON.stringify({ children, s }), before);
    assert.deepEqual(structuredGroup('repeated', children, s, 6, padding), layout);
    const reversed = structuredGroup('repeated', [...children].reverse(), { ...s, edges: [...s.edges].reverse().map(e => ({ ...e, from: e.to, to: e.from })) }, 6, padding)!;
    for (const n of reversed.children!) {
        assert(Math.abs(n.x! - byId.get(n.id)!.x!) < 1e-6 && Math.abs(n.y! - byId.get(n.id)!.y!) < 1e-6);
    }
}

// Incompatible multi-pole spacings cannot share an exact axis through translation.
const unequal: ElkNode[][] = [[{ id: 'a', x: 10, y: 0, width: 30, ports: [{ id: 'a0', x: 0 }, { id: 'a1', x: 10 }] }], [{ id: 'b', x: 20, y: 50, width: 40, ports: [{ id: 'b0', x: 0 }, { id: 'b1', x: 20 }] }]];
const saved = JSON.stringify(unequal);
assert.equal(alignSerialLanes(unequal, [0, 1].map(i => ({ ac: 'a', bc: 'b', a: 'a' + i, b: 'b' + i })), 6, 0), false);
assert.equal(JSON.stringify(unequal), saved, 'Never resize ports or partially apply an incompatible lane');

const project = fixture();
const feed = add(project, 'feed', 'circuit_breaker_3p'); feed.bmk = '-Q0'; feed.functionText = 'Drei getrennte Pfade';
for (const [b, length] of [5, 3, 4].entries()) for (let k = 0; k < length; k++) {
    const c = add(project, `b${b}_${k}`, 'contact_no'); c.bmk = `-K${b + 1}${k + 1}`;
    c.functionText = ['Freigabe', 'Steuerkontakt mit längerer Beschriftung', 'Schaltbedingung', 'Abgang'][(k + b) % 4];
    project.pages[0].wires.push({ id: 'w' + c.id, from: { componentId: k ? `b${b}_${k - 1}` : 'feed', pinId: k ? '14' : String(2 + b * 2) }, to: { componentId: c.id, pinId: '13' }, potential: 'Signal', waypoints: [], isAutoconnect: false });
}
const original = JSON.stringify(project), net = topology(project);
const preview = await previewLayout(project, 'p', { multiPage: false });
assert.equal(JSON.stringify(project), original);
const candidate = preview.candidates.find(c => c.profile === 'structured');
assert(candidate);
assert.equal(candidate.report.metrics.crossings, 0);
assert(candidate.report.metrics.bends <= 6, 'Only the feeder fan-out needs bends; the branch chains stay straight');
applyLayout(project, candidate);
assert.equal(topology(project), net);
const axes: number[] = [];
for (let b = 0; b < 3; b++) {
    const devices = project.pages[0].components.filter(c => c.id.startsWith('b' + b + '_'));
    assert(devices.every(c => Math.abs(c.x - devices[0].x) < 1e-6)); axes.push(devices[0].x);
}
assert(axes[0] < axes[1] && axes[1] < axes[2]);
assert(project.pages[0].components.some(c => c.functionText === 'Steuerkontakt mit längerer Beschriftung'), 'Labels are retained without shortening or scaling');
console.log('✓ Exact serial lanes across unequal branch lengths and labels, physical pin order, row clearance, both axes, immutable geometry and routed model preservation');
