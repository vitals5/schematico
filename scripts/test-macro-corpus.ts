import assert from 'node:assert/strict';
import fs from 'node:fs';
import JSZip from 'jszip';
import { MacroManager } from '../src/model/MacroManager';
import { ExternalMacroLibrary } from '../src/model/ExternalMacroLibrary';
import type { Project } from '../src/model/types';

const fixture = process.env.SCHEMATICO_MACRO_FIXTURE;
if (!fixture) {
  console.log('Optionaler Makro-Archivtest übersprungen: SCHEMATICO_MACRO_FIXTURE ist nicht gesetzt.');
  process.exit(0);
}
const files: File[] = [];
async function collect(data: Uint8Array, prefix = '', depth = 0): Promise<void> {
  assert(depth <= 3, 'Zu viele verschachtelte Archive');
  const zip = await JSZip.loadAsync(data);
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    if (/\.(ema|ems)$/i.test(entry.name)) {
      const name = entry.name.split('/').at(-1)!;
      files.push(Object.defineProperty(new File([new Uint8Array(await entry.async('uint8array'))], name),
        'webkitRelativePath', { value: prefix + entry.name }));
    } else if (/\.zip$/i.test(entry.name)) await collect(await entry.async('uint8array'), prefix + entry.name + '/', depth + 1);
  }
}
await collect(fs.readFileSync(fixture));
assert(files.length, 'Keine Makrodateien im Archiv');
let components = 0, connections = 0, groups = 0;
for (const file of files) {
  const macro = MacroManager.forPlacement(await MacroManager.parseMacroFile(file, { allowHeuristic: false }));
  assert(macro.width > 0 && macro.height > 0 && Number.isFinite(macro.width) && Number.isFinite(macro.height), file.name);
  assert(macro.components.every(c => Number.isFinite(c.x) && Number.isFinite(c.y)
    && macro.symbolLibrary?.some(s => s.id === c.symbolId)), file.name);
  const before = JSON.stringify(macro);
  const target = { drawingUnitsPerMm: 3, symbolLibrary: [], pages: [] } as unknown as Project;
  const placed = MacroManager.instantiateWindowMacro(macro, 240, 320, [], target);
  assert.equal(JSON.stringify(macro), before, file.name);
  assert.equal(placed.components.length, macro.components.length, file.name);
  for (const wire of placed.wires) for (const end of [wire.from, wire.to]) {
    const c = placed.components.find(c => c.id === end.componentId);
    assert(c?.pins[end.pinId]?.wireIds?.includes(wire.id), file.name);
  }
  for (const group of placed.groups) for (const member of group.members) {
    assert(member.kind === 'group' ? placed.groups.some(g => g.id === member.id)
      : member.kind === 'component' && placed.components.some(c => c.id === member.id), file.name);
  }
  const exported = MacroManager.exportMacro(macro);
  const restored = await MacroManager.parseMacroFile(new File([exported.blob], exported.filename), { allowHeuristic: false });
  assert.equal(JSON.stringify(restored.symbolLibrary), JSON.stringify(macro.symbolLibrary), file.name);
  assert.equal(JSON.stringify(restored.type === 'ema' && restored.components), JSON.stringify(macro.components), file.name);
  components += macro.components.length; connections += placed.wires.length; groups += placed.groups.length;
}
const library = new ExternalMacroLibrary(undefined, { get: async () => undefined, put: async () => {} });
await library.selectFiles(files);
assert.equal(library.state.macroCount, files.length);
assert.deepEqual(library.state.issues, []);
await library.disconnect();
console.log(JSON.stringify({ macros: files.length, components, connections, groups,
  strictImport: true, externalLibrary: true, scaledPlacement: true, roundTrip: true }));
