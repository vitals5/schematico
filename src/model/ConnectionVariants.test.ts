import assert from 'node:assert/strict';
import { CONNECTION_VARIANTS } from './ConnectionVariants';
import { getSymbolDefinitions, setProjectSymbolLibrary } from './symbols';
import { connectionFamily, isConnectionSymbol } from './ConnectionSymbols';
import { fixture, add } from '../layout/testing/fixture';
import { snapshotPage } from '../layout/geometry';
const project = fixture(); setProjectSymbolLibrary(project);
assert.equal(CONNECTION_VARIANTS.length,32);
assert.equal(new Set(CONNECTION_VARIANTS.map(s=>s.name)).size,32);
for (const s of CONNECTION_VARIANTS) {
    assert(isConnectionSymbol(s)); assert(getSymbolDefinitions().some(d=>d.id===s.id));
    assert(!/SPECIAL|native:|\[\d/.test(s.name));
    assert(!s.source && !s.importedGraphics, 'No private project definitions are bundled');
    assert.equal(s.defaultFunctionText,'');
    for(const p of s.pins) {
        assert([0,8,16].includes(p.x)&&[0,8,16].includes(p.y));
        assert(p.direction==='top'?p.y===0:p.direction==='bottom'?p.y===16:p.direction==='left'?p.x===0:p.x===16);
    }
    add(project,s.id,s.id);
}
const geometry=snapshotPage(project.pages[0],project);
for(const s of CONNECTION_VARIANTS){
    const n=geometry.nodes.find(n=>n.id===s.id)!;
    if(['tees','corners','interruptions'].includes(connectionFamily(s))||s.id.startsWith('cross_junction_bus_'))assert.equal(n.joinedPins?.[0].length,s.pins.length);
}
const fresh = fixture(); fresh.symbolLibrary=[{...CONNECTION_VARIANTS[0],id:'project-only',name:'Eigene Projektvariante'}];
const saved=JSON.stringify(fresh.symbolLibrary); setProjectSymbolLibrary(fresh);
assert.equal(JSON.stringify(fresh.symbolLibrary),saved);
assert(getSymbolDefinitions().some(s=>s.id==='project-only'));
setProjectSymbolLibrary(fixture());
assert(!getSymbolDefinitions().some(s=>s.id==='project-only'));
assert(CONNECTION_VARIANTS.every(s=>getSymbolDefinitions().some(d=>d.id===s.id)));
console.log('✓ 32 named standard connection variants, fresh projects, pin grid/directions, electrical joins and project-library isolation');
