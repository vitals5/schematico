import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { EdbProjectParser } from '../src/packages/EdbProjectParser';
import { PdfExporter } from '../src/export/PdfExporter';

const source=process.argv[2];if(!source)throw new Error('Aufruf: npx tsx scripts/export-einspeisung.ts /pfad/projekt.zip');
const archive=fs.readFileSync(source);
const { project, messages } = await EdbProjectParser.parseEdbProject(await JSZip.loadAsync(archive));
const page = project.pages.find(p => p.title === 'Einspeisung');
if (!page || !project.symbolLibrary?.length) throw new Error('Einspeisung wurde nicht mit Projektbibliotheken importiert.');
const output = process.argv[3] || '/tmp/einspeisung-import.pdf';
if(path.resolve(output)===path.resolve(source))throw new Error('Die Ausgabedatei muss sich von der Quelldatei unterscheiden.');
const pdf = await PdfExporter.exportToPdf(project, {
  paperFormat: 'a3', colorMode: 'color', pageRange: 'current', currentPageId: page.id,
  interactiveCrossReferences: false, includeBookmarks: false, includeTerminalDiagram: false,
  includePartsList: false, plotFrame: true
});
fs.writeFileSync(output, new Uint8Array(await pdf.arrayBuffer()));
console.log(messages.join('\n'));
console.log(`PDF: ${output}`);
