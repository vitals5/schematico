import assert from 'node:assert/strict';
import { fixture, add } from './testing/fixture';
import { handoverSymbol } from './handoverSymbol';
import { getSymbolById } from '../model/symbols';
import { snapshotPage } from './geometry';

const p = fixture(), c = add(p, 'device', 'contact_no');
for (const [rotation, up, down] of [[0,'up','down'], [90,'right','left'], [180,'down','up'], [270,'left','right']] as const) {
    c.rotation = rotation;
    for (const [pin, direction] of [['13', up], ['14', down]]) {
        const original = JSON.stringify(p);
        const id = handoverSymbol(p, p.pages[0], { componentId: c.id, pinId: pin }, 'right');
        assert.equal(id, 'potential_arrow_' + direction);
        const sym = getSymbolById(id, p)!;
        const originalPin = snapshotPage(p.pages[0], p).nodes[0].pins.find(q => q.id === pin)!;
        assert.equal(sym.pins.find(q => q.id === '1')!.direction, ({ top:'bottom', bottom:'top', left:'right', right:'left' } as const)[originalPin.direction]);
        assert.equal(JSON.stringify(p), original);
    }
}
assert.equal(handoverSymbol(p, p.pages[0], { componentId:'missing', pinId:'1' }, 'left'), 'potential_arrow_left');
console.log('✓ Physical handover orientation for all device rotations and both terminals, opposing pin directions and immutable project');
