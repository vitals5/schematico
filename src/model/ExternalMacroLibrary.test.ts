import assert from 'node:assert/strict';
import { ExternalMacroLibrary, MacroDirectory, FolderStore, NativeMacroLibrary } from './ExternalMacroLibrary';
import { BUILTIN_MACROS, MacroManager } from './MacroManager';
const template = BUILTIN_MACROS.find(m => m.type === 'ema')!;
const components = [0,1].map(i=>({id:`coil${i}`,symbolId:'contactor_coil',bmk:`-K${i+1}`,functionText:'Externe Spule',
  x:0,y:i*100,rotation:0 as const,pins:{A1:{},A2:{}}}));
const wires = [{id:'wire',from:{componentId:'coil0',pinId:'A2'},to:{componentId:'coil1',pinId:'A1'},potential:'L1' as const,waypoints:[{x:16,y:75}]}];
const windowMacro = { ...structuredClone(template), type:'ema' as const, components, wires, name: 'Fenster extern', unitsPerMm: 3, handlePoint: { x: 4, y: 5 } };
const pageMacro = { ...structuredClone(BUILTIN_MACROS.find(m => m.type === 'ems')!), name: 'Seite extern' };
if(pageMacro.type==='ems'){pageMacro.page.components=structuredClone(components);pageMacro.page.wires=structuredClone(wires);}
const file = (name: string, data: unknown) => new File([typeof data === 'string' ? data : JSON.stringify(data)], name);
const good = file('Fenster.EMA', windowMacro), page = file('Seite.ems', pageMacro);
function memoryStore(): FolderStore {
  let saved: Awaited<ReturnType<FolderStore['get']>>;
  return { get: async () => saved, put: async value => { saved = value; } };
}
let contents = [good, file('kaputt.ema', '\0unbekannte binäre Daten'), file('notiz.txt', 'ignorieren')];
let permission: PermissionState = 'granted', permissionRequests = 0;
const folder: MacroDirectory = { name: 'Meine Makros', kind: 'directory',
  queryPermission: async () => permission,
  requestPermission: async () => { permissionRequests++; return permission = 'granted'; },
  async *values() {
    for (const f of contents) yield { name: f.name, kind: 'file' as const, getFile: async () => f };
    yield { name: 'Unterordner', kind: 'directory' as const, async *values() {
      yield { name: page.name, kind: 'file' as const, getFile: async () => page };
      yield { name: 'gleich.ema', kind: 'file' as const, getFile: async () => good };
    } };
  }
};
const store = memoryStore(); await store.put({ name: folder.name, handle: folder });
const library = new ExternalMacroLibrary(undefined, store);
await library.restore();
assert.equal(library.state.macroCount, 3); assert.equal(library.state.fileCount, 4); assert.equal(library.state.issues.length, 1);
let external = MacroManager.getAllMacros().filter(m => m.externalPath);
assert.equal(new Set(external.map(m => m.id)).size, 3, 'Duplicate original IDs in different files stay distinct');
const first = external.find(m => m.externalPath === 'Fenster.EMA')!;
assert.equal(first.type, 'ema'); if (first.type !== 'ema') throw new Error();
assert.deepEqual(first.components, windowMacro.type === 'ema' ? windowMacro.components : []);
assert.deepEqual(first.wires, windowMacro.type === 'ema' ? windowMacro.wires : []);
assert.equal(first.unitsPerMm, 3); assert.deepEqual(first.handlePoint, { x: 4, y: 5 });
const stableId = first.id;
contents = [file('Fenster.EMA', { ...windowMacro, name: 'Geändert' })]; await library.refresh();
assert.equal(library.state.issues.length, 0); assert.equal(library.state.macroCount, 3);
assert.equal(MacroManager.getAllMacros().find(m => m.id === stableId)!.name, 'Geändert');
contents = []; await library.refresh(); assert.equal(library.state.macroCount, 2, 'Deleted file disappears on refresh');
contents = [file('empty.ema', {type:'ema',components:[]})]; await library.refresh(); assert.equal(library.state.issues.length,1);
permission = 'prompt'; const reopened = new ExternalMacroLibrary(undefined, store); await reopened.restore();
assert.equal(permissionRequests, 0, 'Startup must not prompt for permission'); assert.equal(reopened.state.needsAccess, true);
assert.equal(MacroManager.getAllMacros().filter(m => m.externalPath).length, 0);
await reopened.refresh(); assert.equal(permissionRequests, 1); assert.equal(reopened.state.macroCount, 2);
await reopened.disconnect(); assert.equal(await store.get(), undefined); assert(!MacroManager.getAllMacros().some(m => m.externalPath));
assert(BUILTIN_MACROS.every(m => MacroManager.getAllMacros().some(item => item.id === m.id)));

// Fallback folder inputs are session grants; do not promise persisted access.
const fallback = file('Fenster.ema', windowMacro); Object.defineProperty(fallback, 'webkitRelativePath', { value: 'Fallback/Fenster.ema' });
await library.selectFiles([fallback]); assert.equal(library.state.path, 'Fallback'); assert.equal(library.state.macroCount, 1);
const restarted = new ExternalMacroLibrary(undefined, store); await restarted.restore(); assert.equal(restarted.state.needsAccess, true);

// A late read from a disconnected folder cannot repopulate the library.
let complete!: (value: Awaited<ReturnType<NativeMacroLibrary['list']>>) => void;
let selected = '/macros';
const native: NativeMacroLibrary = { getFolder: async () => selected, setFolder: async p => selected = p,
  chooseFolder: async () => null, list: () => new Promise(resolve => { complete = resolve; }),
  read: async () => ({ name: good.name, data: new Uint8Array(await good.arrayBuffer()), lastModified: 0 }) };
const racing = new ExternalMacroLibrary(native); racing.state.path = '/macros';
const reading = racing.refresh(); await racing.disconnect(); complete({ path: '/macros', files: [{ relativePath: good.name, size: 10, lastModified: 0 }], issues: [] }); await reading;
assert.equal(racing.state.path, ''); assert.equal(racing.state.macroCount, 0); assert(!MacroManager.getAllMacros().some(m => m.externalPath));

for (const bad of ['<Macro/>', '<Broken', '\0invalid']) {
  await assert.rejects(() => MacroManager.parseMacroFile(file('kaputt.ema', bad), { allowHeuristic: false }));
}
const exported = MacroManager.exportMacro(first); const roundtrip = await MacroManager.parseMacroFile(new File([exported.blob], exported.filename), { allowHeuristic: false });
assert.equal(roundtrip.unitsPerMm, first.unitsPerMm);
assert.deepEqual(roundtrip.type === 'ema' ? roundtrip.wires : [], first.wires);
assert.equal(JSON.parse(await exported.blob.text()).externalPath, undefined);
assert(!roundtrip.id.startsWith('external:'),'Imported copies cannot shadow live folder entries');
console.log('External macro folders: nested EMA/EMS, stable IDs, refresh/removal, permission restoration, fallback, read races and lossless export passed');
