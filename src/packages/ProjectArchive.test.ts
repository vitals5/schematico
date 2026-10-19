import assert from 'node:assert/strict';
import fs from 'node:fs';
import SevenZip from '7z-wasm';
import JSZip from 'jszip';
import { PackageHandler } from './PackageHandler';
import { readProjectArchive } from './ProjectArchive';
import type { Project } from '../model/types';

const project: Project = {
  id: 'backup-project', name: 'Prüfprojekt Büro', author: '', company: '', description: '',
  version: '1', created: '', modified: '', standard: 'DIN EN 81346-2 / IEC 60617', activePageId: 'sheet',
  symbolLibrary: [{ id: 'fixture-symbol', name: 'Prüfsymbol', category: 'connections',
    standard: 'IEC', description: '', defaultBmkPrefix: '-X', defaultFunctionText: '',
    width: 20, height: 20, pins: [{ id: '0', name: '1', x: 10, y: 0, direction: 'top' }],
    svgContent: '<circle cx="10" cy="10" r="5" fill="none" stroke="currentColor"/>' }],
  pages: [{ id: 'sheet', title: 'Prüfung', pageNumber: '1', pageType: 'schematic',
    higherLevel: '', location: '', wires: [], plotFrame: {
      type: 'DIN_A3_LANDSCAPE', width: 1000, height: 700, columns: 10, rows: ['A'],
      titleBlock: { projectTitle: '', commission: '', company: '', author: '', date: '', revision: '', sheetNumber: '1', totalSheets: '1' }
    },
    components: [{ id: 'object', symbolId: 'fixture-symbol', x: 100, y: 200,
      bmk: '-X1', functionText: 'Quelle', rotation: 0, pins: { '0': { wireIds: [] } } }] }]
};

async function sevenZip(files: Record<string, string>, options: string[] = []): Promise<Uint8Array> {
  const engine = await SevenZip({ print: () => {}, printErr: () => {}, quit: (_code, status) => { throw status; } });
  for (const [path, data] of Object.entries(files)) engine.FS.writeFile(path, data);
  engine.callMain(['a', '-t7z', '-m0=lzma2', '-mx=1', ...options, '/test.7z', ...Object.keys(files)]);
  return engine.FS.readFile('/test.7z');
}
const contents = { 'project_data.json': JSON.stringify(project), 'Grüße.txt': 'unveränderte Quelldaten äöü' };
const compressed = await sevenZip(contents);
const file = new File([new Uint8Array(compressed)], 'Projekt.zw1');
const archive = await readProjectArchive(file);
assert.equal(archive.compression, '7z');
assert.equal(archive.sizes.get('Grüße.txt'), new TextEncoder().encode(contents['Grüße.txt']).length);
assert.equal(await archive.zip.file('Grüße.txt')!.async('text'), contents['Grüße.txt']);

const zip = new JSZip();
for (const [path, data] of Object.entries(contents)) zip.file(path, data);
const zipFile = new File([new Uint8Array(await zip.generateAsync({ type: 'uint8array' }))], 'Projekt.zw1');
const baseline = await PackageHandler.inspectFile(zipFile), actual = await PackageHandler.inspectFile(file);
assert.equal(actual.filename, 'Projekt.zw1');
assert.equal(actual.format, 'ZW1_PROJECT_BACKUP');
assert.deepEqual(actual.extractedProject, baseline.extractedProject, '7z and ZIP must use the same project decoder');
assert.equal(actual.extractedProject!.pages[0].components[0].functionText, 'Quelle');
assert.equal(actual.entries.find(e => e.path === 'project_data.json')!.size, new TextEncoder().encode(contents['project_data.json']).length);
assert(actual.messages[0].includes('7z'));

const invalid = new File([compressed.slice(0, 40)], 'beschädigt.zw1');
await assert.rejects(PackageHandler.inspectFile(invalid), /beschädigt|7z/);
const encrypted = await sevenZip(contents, ['-psecret', '-mhe=on']);
await assert.rejects(PackageHandler.inspectFile(new File([new Uint8Array(encrypted)], 'geschützt.zw1')), /verschlüsselt/);
const unrelated = await sevenZip({ 'readme.txt': 'Keine Projektdaten' });
await assert.rejects(PackageHandler.inspectFile(new File([new Uint8Array(unrelated)], 'leer.zw1')), /keine unterstützten Projektdaten/);
const unrelatedZip = new JSZip().file('readme.txt', 'Keine Projektdaten');
await assert.rejects(PackageHandler.inspectFile(new File([new Uint8Array(await unrelatedZip.generateAsync({ type: 'uint8array' }))], 'leer.zip')), /keine unterstützten Projektdaten/);
console.log('✓ Direct 7z/ZIP project backups, source bytes and sizes, shared editable project decoding, corrupt/encrypted files and no fabricated fallback');

// Private native backups are never bundled with the repository.
const fixture = process.env.SCHEMATICO_BACKUP_FIXTURE;
if (fixture) {
  const imported = await PackageHandler.inspectFile(new File([fs.readFileSync(fixture)], 'reference.zw1'));
  const native = imported.extractedProject!;
  assert(native.pages.length > 0 && native.symbolLibrary!.length > 0);
  const symbols = new Map(native.symbolLibrary!.map(s => [s.id, s]));
  const components = native.pages.flatMap(p => p.components);
  assert(components.some(c => c.source), 'actual indexed native objects must be imported');
  for (const page of native.pages) {
    const objects = new Map(page.components.map(c => [c.id, c]));
    for (const component of page.components) assert(symbols.has(component.symbolId));
    for (const wire of page.wires) for (const end of [wire.from, wire.to]) assert(objects.get(end.componentId)?.pins[end.pinId]);
  }
  console.log(`✓ Private native backup: ${native.pages.length} pages, ${components.length} editable objects, ${symbols.size} source definitions`);
}
