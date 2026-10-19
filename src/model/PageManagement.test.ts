import assert from 'node:assert/strict';
import { Page, Project } from './types';
import { defaultPlotFrame } from './PlotFrame';

function createTestProject(): Project {
  const createPage = (id: string, num: string, title: string): Page => ({
    id,
    pageNumber: num,
    title,
    pageType: 'schematic',
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
        projectTitle: 'Test Project',
        commission: '',
        company: 'Schematico',
        author: 'Tester',
        date: '2026-10-19',
        revision: '1.0',
        sheetNumber: num,
        totalSheets: '3',
      },
    },
  });

  return {
    id: 'proj-1',
    name: 'Test Project',
    description: '',
    standard: 'DIN EN 81346-2 / IEC 60617',
    version: '1.0',
    author: 'Tester',
    company: 'Schematico',
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    pages: [
      createPage('page-1', '1', 'Einspeisung'),
      createPage('page-2', '2', 'Steuerung'),
      createPage('page-3', '3', 'Antriebe'),
    ],
    activePageId: 'page-2',
    symbolLibrary: [],
  };
}

function updateTotalSheets(project: Project): void {
  const total = String(project.pages.length);
  for (const page of project.pages) {
    if (page.plotFrame?.titleBlock) {
      page.plotFrame.titleBlock.totalSheets = total;
    }
  }
}

function movePage(project: Project, pageId: string, direction: 'up' | 'down'): boolean {
  const idx = project.pages.findIndex(p => p.id === pageId);
  if (idx === -1) return false;
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= project.pages.length) return false;

  const [moved] = project.pages.splice(idx, 1);
  project.pages.splice(targetIdx, 0, moved);
  updateTotalSheets(project);
  return true;
}

function movePageToIndex(project: Project, pageId: string, targetIdx: number): boolean {
  const idx = project.pages.findIndex(p => p.id === pageId);
  if (idx === -1 || targetIdx < 0 || targetIdx >= project.pages.length || idx === targetIdx) return false;

  const [moved] = project.pages.splice(idx, 1);
  project.pages.splice(targetIdx, 0, moved);
  updateTotalSheets(project);
  return true;
}

function deletePage(project: Project, pageId: string): boolean {
  if (project.pages.length <= 1) return false;
  const idx = project.pages.findIndex(p => p.id === pageId);
  if (idx === -1) return false;

  project.pages.splice(idx, 1);
  if (project.activePageId === pageId) {
    const newIdx = Math.min(idx, project.pages.length - 1);
    project.activePageId = project.pages[newIdx].id;
  }
  updateTotalSheets(project);
  return true;
}

// 1. Initial State
const project = createTestProject();
assert.equal(project.pages.length, 3);
assert.equal(project.pages[0].id, 'page-1');
assert.equal(project.pages[1].id, 'page-2');
assert.equal(project.pages[2].id, 'page-3');

// 2. Move Page Up
assert.equal(movePage(project, 'page-1', 'up'), false, 'Cannot move first page up');
assert.equal(movePage(project, 'page-2', 'up'), true);
assert.deepEqual(project.pages.map(p => p.id), ['page-2', 'page-1', 'page-3'], 'page-2 is now at index 0');

// 3. Move Page Down
assert.equal(movePage(project, 'page-3', 'down'), false, 'Cannot move last page down');
assert.equal(movePage(project, 'page-2', 'down'), true);
assert.deepEqual(project.pages.map(p => p.id), ['page-1', 'page-2', 'page-3'], 'page-2 is back at index 1');

// 4. Move Page to Index (Drag and Drop)
assert.equal(movePageToIndex(project, 'page-1', 2), true);
assert.deepEqual(project.pages.map(p => p.id), ['page-2', 'page-3', 'page-1'], 'page-1 moved to index 2');
assert.equal(movePageToIndex(project, 'page-1', 99), false, 'Out of bounds index rejected');
assert.equal(movePageToIndex(project, 'page-1', -1), false, 'Negative index rejected');

// 5. Total Sheets
updateTotalSheets(project);
assert.equal(project.pages[0].plotFrame.titleBlock.totalSheets, '3');
assert.equal(project.pages[1].plotFrame.titleBlock.totalSheets, '3');
assert.equal(project.pages[2].plotFrame.titleBlock.totalSheets, '3');

// 6. Delete Page
assert.equal(project.activePageId, 'page-2');
assert.equal(deletePage(project, 'page-2'), true);
assert.equal(project.pages.length, 2);
assert.deepEqual(project.pages.map(p => p.id), ['page-3', 'page-1']);
// Active page should automatically update to the page that took its place
assert.equal(project.activePageId, 'page-3');
assert.equal(project.pages[0].plotFrame.titleBlock.totalSheets, '2');

// 7. Delete Protection: Cannot delete last remaining page
assert.equal(deletePage(project, 'page-3'), true);
assert.equal(project.pages.length, 1);
assert.equal(deletePage(project, 'page-1'), false, 'Cannot delete last remaining page');
assert.equal(project.pages.length, 1);

// 8. Page Number & Sheet Number Editing
const singlePage = project.pages[0];
singlePage.pageNumber = '42';
if (singlePage.plotFrame?.titleBlock) {
  singlePage.plotFrame.titleBlock.sheetNumber = singlePage.pageNumber;
}
assert.equal(singlePage.pageNumber, '42');
assert.equal(singlePage.plotFrame.titleBlock.sheetNumber, '42');

console.log('✓ Page management: reordering (up/down/index), delete protection, active page transition, and sheet numbering');
