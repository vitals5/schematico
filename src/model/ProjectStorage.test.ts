import assert from 'node:assert/strict';
import { legacyAppName } from './LegacyCompatibility';
import {
  saveLastProject,
  loadLastProject,
  clearLastProject,
  isAutoLoadProjectEnabled,
  setAutoLoadProjectEnabled,
  STORAGE_KEY_LAST_PROJECT,
  STORAGE_KEY_AUTOLOAD
} from './ProjectStorage';
import type { Project } from './types';

// Mock localStorage
const values = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
    removeItem: (k: string) => values.delete(k)
  }
});

const sampleProject: Project = {
  id: 'proj_test_001',
  name: 'Test_Schaltplan_Projekt',
  description: 'Automatischer Speichertest',
  standard: 'DIN EN 81346-2 / IEC 60617',
  version: '1.0',
  created: '2026-10-19',
  modified: '2026-10-19',
  author: 'Ingenieur',
  company: 'CAD Systems GmbH',
  pages: [
    {
      id: 'p_101',
      pageNumber: '1',
      pageType: 'schematic',
      title: 'Einspeisung',
      higherLevel: '=A1',
      location: '+S1',
      components: [],
      wires: [],
      plotFrame: {
        type: 'DIN_A3_LANDSCAPE',
        width: 1000,
        height: 700,
        columns: 10,
        rows: ['A', 'B', 'C', 'D'],
        titleBlock: {
          projectTitle: 'Test_Schaltplan_Projekt',
          commission: 'KOMP-01',
          company: 'CAD Systems GmbH',
          author: 'Ingenieur',
          date: '2026-10-19',
          revision: '1.0',
          sheetNumber: '1',
          totalSheets: '1'
        }
      }
    }
  ],
  activePageId: 'p_101'
};

// --- Test 1: Preference defaults to true and can be toggled ---
values.clear();
assert.equal(isAutoLoadProjectEnabled(), true, 'Auto-load should default to true');
setAutoLoadProjectEnabled(false);
assert.equal(isAutoLoadProjectEnabled(), false, 'Auto-load should be false after setAutoLoadProjectEnabled(false)');
assert.equal(values.get(STORAGE_KEY_AUTOLOAD), 'false');
setAutoLoadProjectEnabled(true);
assert.equal(isAutoLoadProjectEnabled(), true, 'Auto-load should be true after setAutoLoadProjectEnabled(true)');
assert.equal(values.get(STORAGE_KEY_AUTOLOAD), 'true');

// --- Test 2: Save and Load Project ---
values.clear();
assert.equal(loadLastProject(), null, 'Should return null when storage is empty');

const saveResult = saveLastProject(sampleProject);
assert.equal(saveResult, true, 'saveLastProject should return true for valid project');
assert(values.has(STORAGE_KEY_LAST_PROJECT), 'Project should be stored under schematico_last_project');

const loaded = loadLastProject();
assert(loaded !== null, 'loadLastProject should return parsed project');
assert.equal(loaded?.id, sampleProject.id);
assert.equal(loaded?.name, sampleProject.name);
assert.equal(loaded?.pages.length, 1);
assert.equal(loaded?.activePageId, 'p_101');

// --- Test 3: Auto-load disabled prevents loading ---
setAutoLoadProjectEnabled(false);
assert.equal(loadLastProject(), null, 'loadLastProject should return null when autoload is disabled');
setAutoLoadProjectEnabled(true);
assert.notEqual(loadLastProject(), null, 'loadLastProject should work again when autoload is re-enabled');

// --- Test 4: activePageId fixup if invalid ---
const projectWithInvalidPageId = {
  ...sampleProject,
  activePageId: 'non_existent_page'
};
saveLastProject(projectWithInvalidPageId);
const loadedFixed = loadLastProject();
assert.equal(loadedFixed?.activePageId, 'p_101', 'Should fall back to first page ID when activePageId is invalid');

// --- Test 5: Corrupt and Invalid data handling ---
values.set(STORAGE_KEY_LAST_PROJECT, 'NOT_VALID_JSON{[');
assert.equal(loadLastProject(), null, 'Corrupt JSON should safely return null without throwing');

values.set(STORAGE_KEY_LAST_PROJECT, JSON.stringify({ id: 'proj', pages: [] }));
assert.equal(loadLastProject(), null, 'Project with empty pages array should safely return null');

assert.equal(saveLastProject(null as any), false, 'saveLastProject(null) should safely return false');
assert.equal(saveLastProject({} as any), false, 'saveLastProject({}) should safely return false');

// --- Test 6: Clear Last Project ---
saveLastProject(sampleProject);
assert(values.has(STORAGE_KEY_LAST_PROJECT));
clearLastProject();
assert.equal(values.has(STORAGE_KEY_LAST_PROJECT), false, 'clearLastProject should remove the key');
assert.equal(loadLastProject(), null);

// --- Test 7: Migration of legacy setting key ---
values.clear();
const legacyKey = legacyAppName + '_last_project';
values.set(legacyKey, JSON.stringify(sampleProject));
const loadedFromLegacy = loadLastProject();
assert(loadedFromLegacy !== null, 'Should load from legacy key and migrate');
assert.equal(loadedFromLegacy?.name, sampleProject.name);
assert(values.has(STORAGE_KEY_LAST_PROJECT), 'Should have migrated key to schematico_last_project');
assert(!values.has(legacyKey), 'Legacy key should have been removed after migration');

delete (globalThis as { localStorage?: unknown }).localStorage;

console.log('✓ ProjectStorage: Auto-load preference, project saving, loading, validation, and legacy migration verified');
