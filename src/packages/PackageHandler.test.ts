import { nativeFixtureFiles } from './testing/NativeFixture';
// src/packages/PackageHandler.test.ts
// Unit tests for CAD Project Archive Import and EDB Project Reconstruction

import fs from 'fs';
import { PackageHandler } from './PackageHandler';

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
}

async function runTests() {
  console.log('\n=== 1. Testing Split Multi-Part Archive Loading (*.001, *.002) ===');

  const paths=nativeFixtureFiles();
  if(!paths.length){console.log('↷ Optionaler Splitarchiv-Test: SCHEMATICO_NATIVE_FIXTURE ist nicht gesetzt.');return;}
  const files=paths.map((file,index)=>new File([fs.readFileSync(file)],paths.length>1?'house.zip.'+String(index+1).padStart(3,'0'):'house.zip'));
  // Test inspectFiles with multi-part files
  const inspectionResult = await PackageHandler.inspectFiles(files);

  assert(inspectionResult.format === 'ZW1_PROJECT_BACKUP', `Format is ZW1_PROJECT_BACKUP (got ${inspectionResult.format})`);
  assert(inspectionResult.extractedProject !== undefined, 'Project successfully extracted from split archive');

  const project = inspectionResult.extractedProject!;

  console.log('\n=== 2. Testing Project Metadata Extraction ===');
  assert(project.name === 'Haus', `Example project uses a neutral display name (got "${project.name}")`);
  assert(project.description.includes('Einfamilienhaus mit Garage'), `Description matches "Einfamilienhaus mit Garage" (got "${project.description}")`);
  assert(project.company === 'Viktor Steckler', `Company is "Viktor Steckler" (got "${project.company}")`);
  assert(project.author === 'VITAL', `Author is "VITAL" (got "${project.author}")`);

  console.log('\n=== 3. Testing Indexed Active Project Structure ===');
  assert(project.pages.length === 48, `Extracted 48 indexed active pages (got ${project.pages.length})`);
  assert(new Set(project.pages.map(p => p.id)).size === project.pages.length, 'No duplicate or deleted page records');

  // Verify Cover Sheet
  const coverPage = project.pages.find(p => p.pageNumber === '1' && p.location === '+EAA');
  assert(coverPage !== undefined, 'Cover sheet found (+EAA / 1)');
  assert(coverPage?.title === 'Titelblatt', `Cover title is "Titelblatt" (got "${coverPage?.title}")`);
  assert(coverPage?.pageType === 'cover', `Cover pageType is "cover" (got "${coverPage?.pageType}")`);

  // Verify Key Schematic Pages
  const einspeisungPage = project.pages.find(p => p.pageNumber === '1' && p.location === '+ET1');
  assert(einspeisungPage !== undefined, 'Page 1 "Einspeisung" found');
  assert(einspeisungPage?.title === 'Einspeisung', `Page 1 title is "Einspeisung" (got "${einspeisungPage?.title}")`);
  assert(einspeisungPage!.components.length > 0, `Page 1 has placed components (got ${einspeisungPage!.components.length})`);

  const pvPage = project.pages.find(p => p.pageNumber === '1-2');
  assert(pvPage !== undefined, 'Page 1-2 "PV-Anlage" found');
  assert(pvPage?.title === 'PV-Anlage', `Page 1-2 title is "PV-Anlage" (got "${pvPage?.title}")`);

  const fiPage = project.pages.find(p => p.pageNumber === '4');
  assert(fiPage !== undefined, 'Page 4 "FI-Schalter Haus" found');
  assert(fiPage?.title === 'FI-Schalter Haus', `Page 4 title is "FI-Schalter Haus" (got "${fiPage?.title}")`);

  const relaisPage = project.pages.find(p => p.pageNumber === '8');
  assert(relaisPage !== undefined, 'Page 8 "Stromstoßrelais 1" found');
  assert(relaisPage?.title === 'Stromstoßrelais 1', `Page 8 title is "Stromstoßrelais 1" (got "${relaisPage?.title}")`);
  assert(relaisPage!.components.length > 0, `Page 8 has components (got ${relaisPage!.components.length})`);

  // Verify that function texts like "Zentral Aus" / "Gruppe Ein" are attached
  const hasZentralAus = relaisPage?.components.some(c => c.functionText.includes('Zentral Aus') || c.functionText.includes('Zentral Ein'));
  assert(hasZentralAus === true, 'Page 8 contains "Zentral Aus" or "Zentral Ein" function');

  const wohnzimmer1 = project.pages.find(p => p.pageNumber === '21-1');
  assert(wohnzimmer1 !== undefined, 'Page 21-1 "Wohnzimmer 1" found');
  assert(wohnzimmer1?.title === 'Wohnzimmer 1', `Page 21-1 title is "Wohnzimmer 1" (got "${wohnzimmer1?.title}")`);

  const schlafzimmer = project.pages.find(p => p.pageNumber === '28');
  assert(schlafzimmer !== undefined, 'Page 28 "Schlafzimmer" found');
  assert(schlafzimmer?.title === 'Schlafzimmer', `Page 28 title is "Schlafzimmer" (got "${schlafzimmer?.title}")`);

  const terminalReports = project.pages.filter(p => p.location === '+TERM_KL');
  assert(terminalReports.length === 2, `Found 2 active terminal reports (got ${terminalReports.length})`);
  assert(terminalReports.every(p => p.pageType === 'terminal_diagram'), 'Terminal reports have pageType "terminal_diagram"');
  assert(!project.pages.some(p => p.location === '+PLG_ST'), 'Deleted connector reports do not reappear');

  console.log('\n=== 4. Testing Autoconnection and Title Block Integration ===');
  assert(project.activePageId === einspeisungPage?.id, `Active page initialized to first schematic page (${project.activePageId})`);

  const samplePage = einspeisungPage!;
  assert(samplePage.plotFrame.titleBlock.company === 'Viktor Steckler', `Title block company is "${samplePage.plotFrame.titleBlock.company}"`);
  assert(samplePage.plotFrame.titleBlock.author === 'VITAL', `Title block author is "${samplePage.plotFrame.titleBlock.author}"`);
  assert(samplePage.plotFrame.titleBlock.totalSheets === '48', `Total sheets in title block is 48 (got "${samplePage.plotFrame.titleBlock.totalSheets}")`);

  console.log('\n🎉 ALL PACKAGE HANDLER & EDB IMPORT TESTS PASSED SUCCESSFULLY! 100% VERIFIED!\n');
}

runTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
