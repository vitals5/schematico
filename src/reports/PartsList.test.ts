import assert from 'node:assert/strict';
import { PartsListGenerator, isConnectionComponent } from './PartsList';
import type { Project, Page } from '../model/types';

const testPage: Page = {
  id: 'page_1',
  pageNumber: '1',
  pageType: 'schematic',
  title: 'Testseite',
  higherLevel: '=A1',
  location: '+S1',
  wires: [],
  plotFrame: {
    type: 'DIN_A3_LANDSCAPE',
    width: 1000,
    height: 700,
    columns: 10,
    rows: ['A'],
    titleBlock: {
      projectTitle: 'BOM Test',
      commission: '',
      company: '',
      author: '',
      date: '2026-10-19',
      revision: '1.0',
      sheetNumber: '1',
      totalSheets: '1'
    }
  },
  components: [
    // Real electrical parts that MUST appear in the BOM:
    {
      id: 'comp_m1',
      symbolId: 'motor_3p',
      bmk: '-M1',
      functionText: 'Förderbandantrieb',
      articleNumber: '1LE1001-0DB22',
      manufacturer: 'Siemens',
      x: 100,
      y: 100,
      rotation: 0,
      pins: {}
    },
    {
      id: 'comp_k1',
      symbolId: 'contactor_power_3p',
      bmk: '-K1',
      functionText: 'Hauptschütz',
      articleNumber: '3RT2016-1BB41',
      manufacturer: 'Siemens',
      x: 100,
      y: 200,
      rotation: 0,
      pins: {}
    },
    {
      id: 'comp_x1',
      symbolId: 'terminal_single',
      bmk: '-X1',
      functionText: '1',
      x: 100,
      y: 300,
      rotation: 0,
      pins: {}
    },

    // Connection elements that MUST NOT appear in the BOM:
    {
      id: 'conn_t1',
      symbolId: 't_piece_right',
      bmk: 'T1',
      functionText: 'T-Stück rechts',
      x: 50,
      y: 50,
      rotation: 0,
      pins: {}
    },
    {
      id: 'conn_w1',
      symbolId: 'corner_top_left',
      bmk: 'W1',
      functionText: 'Winkel rechts-unten',
      x: 60,
      y: 60,
      rotation: 0,
      pins: {}
    },
    {
      id: 'conn_w2',
      symbolId: 'corner_top_right',
      bmk: 'W2',
      functionText: 'Winkel links-unten',
      x: 70,
      y: 70,
      rotation: 0,
      pins: {}
    },
    {
      id: 'conn_pf1',
      symbolId: 'potential_arrow',
      bmk: 'PF1',
      functionText: 'L3',
      x: 80,
      y: 80,
      rotation: 0,
      pins: {}
    },
    {
      id: 'conn_pf2',
      symbolId: 'potential_arrow_down',
      bmk: '/1.1',
      functionText: 'L1',
      x: 90,
      y: 90,
      rotation: 0,
      pins: {}
    },
    {
      id: 'conn_pf3',
      symbolId: 'potential_arrow_up',
      bmk: '/2.1',
      functionText: '0V',
      x: 95,
      y: 95,
      rotation: 0,
      pins: {}
    },
    {
      id: 'conn_cross',
      symbolId: 'cross_junction',
      bmk: 'X1',
      functionText: 'Kreuzungsverbindung',
      x: 110,
      y: 110,
      rotation: 0,
      pins: {}
    },
    {
      id: 'conn_bridge',
      symbolId: 'cross_bridge',
      bmk: 'X2',
      functionText: 'Überbrückung',
      x: 120,
      y: 120,
      rotation: 0,
      pins: {}
    }
  ]
};

const testProject: Project = {
  id: 'proj_bom_test',
  name: 'BOM Filter Test',
  description: '',
  standard: 'DIN EN 81346-2 / IEC 60617',
  version: '1.0',
  created: '2026-10-19',
  modified: '2026-10-19',
  author: '',
  company: '',
  pages: [testPage],
  activePageId: 'page_1'
};

// --- Test 1: Connection elements are excluded from parts list ---
const parts = PartsListGenerator.generatePartsList(testProject);

// Only 3 real parts should be in the list: motor, contactor, and terminal
assert.equal(parts.length, 3, `Expected 3 parts in BOM, but found ${parts.length}`);

const articles = parts.map(p => p.articleNumber);
assert(articles.includes('1LE1001-0DB22'), 'Motor should be in BOM');
assert(articles.includes('3RT2016-1BB41'), 'Contactor should be in BOM');
assert(articles.includes('STD-TERMINAL_SINGLE'), 'Terminal should be in BOM');

// Ensure NO connection element is present:
assert(!articles.includes('STD-T_PIECE_RIGHT'), 'T-piece must NOT be in BOM');
assert(!articles.includes('STD-CORNER_TOP_LEFT'), 'Corner top-left must NOT be in BOM');
assert(!articles.includes('STD-CORNER_TOP_RIGHT'), 'Corner top-right must NOT be in BOM');
assert(!articles.includes('STD-POTENTIAL_ARROW'), 'Potential arrow must NOT be in BOM');
assert(!articles.includes('STD-POTENTIAL_ARROW_DOWN'), 'Potential arrow down must NOT be in BOM');
assert(!articles.includes('STD-POTENTIAL_ARROW_UP'), 'Potential arrow up must NOT be in BOM');
assert(!articles.includes('STD-CROSS_JUNCTION'), 'Cross junction must NOT be in BOM');
assert(!articles.includes('STD-CROSS_BRIDGE'), 'Cross bridge must NOT be in BOM');

// Ensure no BMKs of connection elements are leaked:
const allBmks = parts.flatMap(p => p.bmkList);
assert(!allBmks.includes('T1'), 'Connection BMK T1 must not be in BOM');
assert(!allBmks.includes('W1'), 'Connection BMK W1 must not be in BOM');
assert(!allBmks.includes('W2'), 'Connection BMK W2 must not be in BOM');
assert(!allBmks.includes('PF1'), 'Connection BMK PF1 must not be in BOM');
assert(!allBmks.includes('/1.1'), 'Connection BMK /1.1 must not be in BOM');
assert(!allBmks.includes('/2.1'), 'Connection BMK /2.1 must not be in BOM');

// --- Test 3: Device boxes and structure components are excluded from BOM ---
const projectWithDeviceBox: Project = {
  ...testProject,
  pages: [
    {
      ...testPage,
      components: [
        ...testPage.components,
        {
          id: 'box_plc',
          symbolId: 'device_box',
          bmk: '-KF1',
          functionText: 'PLC Controller',
          x: 100,
          y: 400,
          rotation: 0,
          pins: {}
        }
      ]
    }
  ]
};
const partsWithBox = PartsListGenerator.generatePartsList(projectWithDeviceBox);
assert.equal(partsWithBox.length, 3, 'Device box must NOT be included in BOM');
assert(!partsWithBox.some(p => p.articleNumber.includes('DEVICE_BOX')), 'No DEVICE_BOX article in BOM');

console.log('✓ PartsList: Connection elements and device boxes are successfully filtered out of the Bill of Materials');
