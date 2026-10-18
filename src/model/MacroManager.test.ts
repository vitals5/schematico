// src/model/MacroManager.test.ts
// Unit tests for CAE/CAD Macro Manager (.ema & .ems)

import { MacroManager, WindowMacro, PageMacro } from './MacroManager';
import { PlacedComponent, Page, Project } from './types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
}

async function runTests() {
  console.log('\n--- 1. Testing Built-in Standard Macros ---');
  const allMacros = MacroManager.getAllMacros();
  assert(allMacros.length >= 6, `Found ${allMacros.length} built-in macros (expected at least 6)`);
  
  const motorAbzweig = allMacros.find(m => m.id === 'macro_ema_motorabzweig_400v') as WindowMacro;
  assert(!!motorAbzweig, 'Found "Motorabzweig 400V AC" Window Macro (.ema)');
  assert(motorAbzweig.type === 'ema', 'Motorabzweig type is "ema"');
  assert(motorAbzweig.components.length === 6, `Motorabzweig has 6 components (got ${motorAbzweig.components.length})`);

  const pageMacro = allMacros.find(m => m.type === 'ems') as PageMacro;
  assert(!!pageMacro, 'Found Page Macro (.ems)');
  assert(pageMacro.page.components.length > 0, `Page macro contains ${pageMacro.page.components.length} components`);

  console.log('\n--- 2. Testing Window Macro Creation (.ema) ---');
  const dummyComps: PlacedComponent[] = [
    {
      id: 'c1',
      symbolId: 'motor_overload_switch',
      bmk: '-Q1',
      functionText: 'Motorschutz',
      x: 100,
      y: 150,
      rotation: 0,
      pins: {}
    },
    {
      id: 'c2',
      symbolId: 'contactor_power_3p',
      bmk: '-K1',
      functionText: 'Schütz',
      x: 100,
      y: 250,
      rotation: 0,
      pins: {}
    }
  ];

  const createdMacro = MacroManager.createMacroFromComponents(
    'Test_Motor_Feeder',
    'Antriebe',
    'Testbeschreibung',
    dummyComps
  );

  assert(createdMacro.name === 'Test_Motor_Feeder', 'Created macro has correct name');
  assert(createdMacro.components.length === 2, 'Created macro has 2 components');
  assert(createdMacro.components[0].x === 0, 'Component 1 normalized to relative x=0');
  assert(createdMacro.components[0].y === 0, 'Component 1 normalized to relative y=0');
  assert(createdMacro.components[1].y === 100, 'Component 2 relative y=100');

  console.log('\n--- 3. Testing Window Macro Instantiation & BMK Renumbering ---');
  const existingOnPage: PlacedComponent[] = [
    {
      id: 'ex1',
      symbolId: 'contactor_coil',
      bmk: '-K1',
      functionText: 'Bestehendes Schütz 1',
      x: 200,
      y: 200,
      rotation: 0,
      pins: {}
    },
    {
      id: 'ex2',
      symbolId: 'motor_overload_switch',
      bmk: '-Q1',
      functionText: 'Bestehender Motorschutz 1',
      x: 200,
      y: 100,
      rotation: 0,
      pins: {}
    }
  ];

  // Instantiating createdMacro at target (300, 400)
  const instantiated = MacroManager.instantiateWindowMacro(createdMacro, 300, 400, existingOnPage);
  assert(instantiated.components.length === 2, 'Instantiated 2 components');
  assert(instantiated.components[0].x === 300, 'Instantiated component 1 placed at x=300');
  assert(instantiated.components[0].y === 400, 'Instantiated component 1 placed at y=400');
  assert(instantiated.components[1].x === 300, 'Instantiated component 2 placed at x=300');
  assert(instantiated.components[1].y === 500, 'Instantiated component 2 placed at y=500');

  // BMK collision avoidance check: -Q1 was on page, so macro's -Q1 must become -Q2!
  assert(instantiated.components[0].bmk === '-Q2', `BMK -Q1 was auto-incremented to -Q2 (got ${instantiated.components[0].bmk})`);
  // -K1 was on page, so macro's -K1 must become -K2!
  assert(instantiated.components[1].bmk === '-K2', `BMK -K1 was auto-incremented to -K2 (got ${instantiated.components[1].bmk})`);

  console.log('\n--- 4. Testing Page Macro Instantiation (.ems) ---');
  const testProject: Project = {
    id: 'proj_1',
    name: 'Test_Project',
    description: 'Test Projekt',
    standard: 'DIN EN 81346-2 / IEC 60617',
    version: '1.0',
    created: '2026-10-14',
    modified: '2026-10-14',
    author: 'Tester',
    company: 'Test Co',
    pages: [
      {
        id: 'p1',
        pageNumber: '1',
        pageType: 'schematic',
        title: 'Seite 1',
        higherLevel: '=A1',
        location: '+S1',
        components: [],
        wires: [],
        plotFrame: {
          type: 'DIN_A3_LANDSCAPE',
          width: 1000,
          height: 700,
          columns: 10,
          rows: ['A', 'B', 'C', 'D', 'E', 'F'],
          titleBlock: {
            projectTitle: 'Test',
            commission: 'KOM-1',
            company: 'Test',
            author: 'Tester',
            date: '2026-10-14',
            revision: '1',
            sheetNumber: '1',
            totalSheets: '2'
          }
        }
      },
      {
        id: 'p2',
        pageNumber: '2',
        pageType: 'schematic',
        title: 'Seite 2',
        higherLevel: '=A1',
        location: '+S1',
        components: [],
        wires: [],
        plotFrame: {
          type: 'DIN_A3_LANDSCAPE',
          width: 1000,
          height: 700,
          columns: 10,
          rows: ['A', 'B', 'C', 'D', 'E', 'F'],
          titleBlock: {
            projectTitle: 'Test',
            commission: 'KOM-1',
            company: 'Test',
            author: 'Tester',
            date: '2026-10-14',
            revision: '1',
            sheetNumber: '2',
            totalSheets: '2'
          }
        }
      }
    ],
    activePageId: 'p2'
  };

  const newPage = MacroManager.instantiatePageMacro(pageMacro, testProject);
  assert(newPage.pageNumber === '3', `New page number auto-assigned to "3" (got ${newPage.pageNumber})`);
  assert(newPage.id !== pageMacro.page.id, 'New page has fresh unique ID');
  assert(newPage.components.length === pageMacro.page.components.length, 'All page components cloned');

  console.log('\n--- 5. Testing Lossless Macro Export & Import (.ema & .ems) ---');
  const exported = MacroManager.exportMacro(createdMacro);
  assert(exported.filename === 'Test_Motor_Feeder.ema', `Export filename is "Test_Motor_Feeder.ema" (got ${exported.filename})`);
  assert(exported.blob.size > 0, `Exported blob size is ${exported.blob.size} bytes`);

  const portable = JSON.parse(await exported.blob.text());
  assert(portable.type === 'ema', 'Portable macro preserves type');
  assert(JSON.stringify(portable.components) === JSON.stringify(createdMacro.components), 'Portable export preserves complete components');
  assert(JSON.stringify(portable.wires) === JSON.stringify(createdMacro.wires), 'Portable export preserves complete wires');

  const reimportedFile = new File([exported.blob], exported.filename, { type: 'application/json' });
  const reimportedMacro = await MacroManager.parseMacroFile(reimportedFile);
  assert(reimportedMacro.type === 'ema', 'Reimported macro type is "ema"');
  assert(reimportedMacro.name === 'Test_Motor_Feeder', `Reimported macro name matches (got ${reimportedMacro.name})`);
  assert((reimportedMacro as WindowMacro).components.length === 2, `Reimported macro has 2 components (got ${(reimportedMacro as WindowMacro).components.length})`);

  const legacyXml = new File(['<Macro name="Legacy"><Component id="c1" symbolId="contact_no" bmk="-K1" x="0" y="0" rotation="0"/></Macro>'], 'Legacy.ema');
  const legacy = await MacroManager.parseMacroFile(legacyXml, { allowHeuristic: false });
  assert(legacy.type === 'ema' && legacy.components[0].symbolId === 'contact_no', 'Legacy XML macros remain readable');
  console.log('\n--- 6. Testing JSON Macro Import ---');
  const jsonMacroStr = JSON.stringify({
    type: 'ema',
    name: 'JSON_Schütz_Makro',
    category: 'Steuerung',
    description: 'Importiert via JSON',
    components: [
      { id: 'c1', symbolId: 'contactor_coil', bmk: '-K1', x: 0, y: 0, rotation: 0, pins: {} }
    ]
  });
  const jsonFile = new File([jsonMacroStr], 'Schuetz.ema', { type: 'application/json' });
  const parsedJsonMacro = await MacroManager.parseMacroFile(jsonFile);
  assert(parsedJsonMacro.name === 'JSON_Schütz_Makro', 'Parsed JSON macro name correct');
  assert(parsedJsonMacro.type === 'ema', 'Parsed JSON macro type is "ema"');

  console.log('\n🎉 ALL MACRO MANAGER TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
