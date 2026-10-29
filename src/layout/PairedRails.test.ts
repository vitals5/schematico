import assert from 'node:assert/strict';
import { fixture, add } from './testing/fixture';
import { snapshotPage } from './geometry';
import { previewLayout, applyLayout } from './service';
import { topology } from './types';
import { perpendicularRail } from './perpendicularRail';
import { structuredGroup } from './structured';
import { ProjectHistory } from '../model/ProjectHistory';

function circuit(vertical = false, reverse = false) {
    const project = fixture(), page = project.pages[0];
    const connect = (a: string, pin: string, b: string, q: string) => page.wires.push({
        id: 'wire' + page.wires.length, from: { componentId: a, pinId: pin }, to: { componentId: b, pinId: q },
        potential: '', waypoints: [], isAutoconnect: false,
    });
    for (const side of ['supply', 'return']) {
        for (let i = 0; i < 3; i++) {
            const tee = add(project, side + i, vertical ? side === 'supply' ? 't_piece_right' : 't_piece_left' : side === 'supply' ? 't_piece_down' : 't_piece_up');
            tee.bmk = ''; tee.functionText = ''; tee.showLabels = false;
            if (i) connect(side + (i - 1), '2', side + i, '1');
        }
        const dock = add(project, side, 'terminal_single'); dock.rotation = vertical ? 0 : 270;
        dock.bmk = side === 'supply' ? '-L' : '-N'; dock.functionText = '';
        connect(side, '2', side + '0', '1');
    }
    for (let i = 0; i < 3; i++) {
        const contact = add(project, 'contact' + i, 'contact_no');
        const coil = add(project, 'coil' + i, 'contactor_coil');
        contact.bmk = coil.bmk = '-K' + i;
        contact.functionText = i === 1 ? 'Abgang mit längerer Beschriftung' : 'Abgang';
        coil.functionText = 'Verbraucher';
        contact.rotation = coil.rotation = vertical ? 270 : 0;
        if (vertical) for (const c of [contact, coil]) {
            c.bmkPosition = { offsetX: 80 }; c.functionTextPosition = { offsetX: 80 }; c.crossRefPosition = { offsetX: 80 };
        }
        connect('supply' + i, '3', contact.id, '13');
        connect(contact.id, '14', coil.id, 'A1');
        connect(coil.id, 'A2', 'return' + i, '3');
    }
    if (reverse) {
        page.components.reverse(); page.wires.reverse();
        for (const w of page.wires) [w.from, w.to] = [w.to, w.from];
    }
    return project;
}
const padding = { left: 8, right: 8, top: 8, bottom: 8 };
function specialized(project: ReturnType<typeof circuit>) {
    const source = snapshotPage(project.pages[0], project);
    const children = source.nodes.map(n => ({ id: n.id, width: n.rect.width, height: n.rect.height,
        ports: n.pins.map(p => ({ id: JSON.stringify([n.id, p.id]), x: p.x - n.rect.x, y: p.y - n.rect.y })) }));
    return perpendicularRail(children, source, 6, padding, (core, planning) => structuredGroup('core', core, planning, 6, padding));
}
const unjoined = circuit();
// Incompatible physical rail directions must retain the general layout alternatives.
unjoined.pages[0].components.find(c => c.id === 'return1')!.symbolId = 't_piece_down';
assert.equal(specialized(unjoined), undefined);
const conflict = circuit();
for (const w of conflict.pages[0].wires) if (w.to.componentId === 'return0' && w.to.pinId === '3') w.to.componentId = 'return2';
else if (w.to.componentId === 'return2' && w.to.pinId === '3') w.to.componentId = 'return0';
assert.equal(specialized(conflict), undefined, 'Contradictory station orders must fall back without rewiring');
for (const vertical of [false, true]) {
    let positions: Map<string, { x: number; y: number }> | undefined;
    for (const reverse of [false, true]) {
        const project = circuit(vertical, reverse), saved = JSON.stringify(project), net = topology(project);
        const history = new ProjectHistory(); history.reset(project);
        const preview = await previewLayout(project, 'p', { multiPage: false });
        const candidate = preview.candidates.find(c => c.profile === 'structured');
        assert(candidate, `Paired rails must validate: vertical=${vertical}, reverse=${reverse}`);
        assert.equal(candidate.report.metrics.crossings, 0);
        assert.equal(candidate.report.metrics.bends, 0);
        assert.equal(JSON.stringify(project), saved);
        const geometry = snapshotPage(candidate.page, project);
        for (let i = 0; i < 3; i++) {
            const pin = (id: string, port: string) => geometry.nodes.find(n => n.id === id)!.pins.find(p => p.id === port)!;
            const path = [pin('supply' + i, '3'), pin('contact' + i, '13'), pin('coil' + i, 'A1'), pin('return' + i, '3')];
            assert(path.every(p => Math.abs((vertical ? p.y : p.x) - (vertical ? path[0].y : path[0].x)) < 1e-6));
            assert(path.every((p, j) => !j || (vertical ? p.x : p.y) > (vertical ? path[j - 1].x : path[j - 1].y)));
        }
        if (positions) for (const c of candidate.page.components) {
            const before = positions.get(c.id)!;
            assert(Math.abs(c.x - before.x) < 1e-6 && Math.abs(c.y - before.y) < 1e-6, 'Input order cannot change paired rail placement');
        }
        positions = new Map(candidate.page.components.map(c => [c.id, { x: c.x, y: c.y }]));
        assert.deepEqual(new Set(candidate.page.wires.map(w => w.id)), new Set(project.pages[0].wires.map(w => w.id)));
        applyLayout(project, candidate); history.record(project);
        assert.equal(topology(project), net);
        assert.deepEqual(history.undo(), JSON.parse(saved));
    }
}
console.log('✓ Paired supply/return rails, physical branch columns, both axes, input order, immutable topology and undo');
