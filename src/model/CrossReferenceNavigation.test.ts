import assert from 'node:assert/strict';
import { referenceTargets, referenceMarkup } from './CrossReferenceNavigation';
import { CrossReferenceEngine } from './CrossReferenceEngine';
import { Page, PlacedComponent, Project } from './types';
const placed = (id: string, symbolId: string, x: number, bmk = '-K1') => ({ id, symbolId, bmk, functionText: '', x, y: 100,
  rotation: 0, pins: {}, higherLevelFunction: '=A', mountingLocation: '+L' } as PlacedComponent);
const page = (id: string, number: string, components: PlacedComponent[], location = '+L') => ({ id, pageNumber: number,
  pageType: 'schematic', higherLevel: '=A', location, components, wires: [],
  plotFrame: { width: 1000, height: 700, columns: 10 } } as unknown as Page);
const coil = placed('coil', 'coil', 50), contact = placed('contact', 'contact', 250);
const contact2 = placed('other-contact', 'contact', 750);
const sourcePage = page('source', '1', [coil]), targetPage = page('target', '21-3', [contact, contact2]);
const project = { pages: [page('wrong-location', '21-3', [placed('wrong', 'coil', 250)], '+Other'), sourcePage, targetPage],
  symbolLibrary: [ { id: 'coil', width: 20, height: 20, pins: [], isMaster: true },
    { id: 'contact', width: 20, height: 20, insertionPoint: { x: 0, y: 0 }, pins: [{ id: 'a', name: '13', x: 10, y: 0, direction: 'top' }, { id: 'b', name: '14', x: 10, y: 20, direction: 'bottom' }], isContact: true } ] } as unknown as Project;
coil.crossRef = '13-14: /21-3.2 | 23-24: /21-3.7';
let targets = referenceTargets(project, coil);
assert.equal(targets.length, 2); assert.equal(targets[0].pageId, 'target');
assert.equal(targets[0].componentId, 'contact'); assert.equal(targets[1].componentId, 'other-contact');
assert.equal(targets[0].x, 250);
const html = referenceMarkup(project, coil), svg = referenceMarkup(project, coil, true, { x: -8, fontSize: 8 });
assert.equal((html.match(/data-crossref-source=/g) ?? []).length, 2); assert.match(html, /13-14: /);
assert.match(html, /<br>23-24: /); assert.doesNotMatch(html, /\|/);
assert.match(svg, /<tspan.*role="link"/); assert.match(svg, /data-crossref-index="1"/);
assert.match(svg, /<tspan x="-8" dy="0">13-14: /);
assert.match(svg, /<tspan x="-8" dy="10">23-24: /);
assert.doesNotMatch(svg, /\|/);
const sameColumn = placed('third-contact', 'contact', 760);
sameColumn.pins = { a: { customLabel: '23' }, b: { customLabel: '24' } };
targetPage.components.push(sameColumn);
coil.crossRef = '23-24: /21-3.7';
assert.equal(referenceTargets(project, coil)[0].componentId, 'third-contact', 'A mirror designation disambiguates contacts in the same column');
coil.crossRef = '/21-3.5'; coil.bmk = '-No-match'; targets = referenceTargets(project, coil);
assert.equal(targets[0].componentId, undefined); assert.equal(targets[0].x, 550, 'Unresolved component navigates to the column');
coil.crossRef = '/missing.2, /21-3.99'; assert.equal(referenceTargets(project, coil).length, 0);
coil.crossRef = '<script>/missing.2</script>'; assert(!referenceMarkup(project, coil).includes('<script>'));
const arrowA = placed('arrow-a', 'coil', 0, ''), arrowB = placed('arrow-b', 'coil', 500, '');
arrowA.functionText = arrowB.functionText = 'TV.L'; arrowA.crossRef = '/21-3.5';
sourcePage.components.push(arrowA); targetPage.components.push(arrowB);
assert.equal(referenceTargets(project, arrowA)[0].componentId, 'arrow-b');
contact.crossRef = '/1.0'; contact.bmk = '-K1'; coil.bmk = '-K1';
assert.equal(referenceTargets(project, contact)[0].componentId, 'coil', 'Contact navigates back to its coil');
contact.source = { format: 'NATIVE_CAD', objectType: 17, objectId: 1 };
contact.x = 200; assert.equal(CrossReferenceEngine.componentPath(contact, targetPage, project), 2, 'Native column uses its source insertion');

// Test interruption symbol cross-reference calculation and bidirectional navigation
const intSymRight = { id: 'potential_arrow_right', width: 20, height: 20, pins: [], category: 'connections', isInterruption: true };
const intSymLeft = { id: 'potential_arrow_left', width: 20, height: 20, pins: [], category: 'connections', isInterruption: true };
(project.symbolLibrary as any[]).push(intSymRight, intSymLeft);

const pArrow1 = placed('p-arrow-1', 'potential_arrow_right', 150, 'L1');
pArrow1.functionText = 'L1';
pArrow1.mountingLocation = '+S1';

const pArrow2 = placed('p-arrow-2', 'potential_arrow_left', 350, '');
pArrow2.functionText = 'L1';
pArrow2.mountingLocation = '+S2'; // Different location still pairs

sourcePage.components.push(pArrow1);
targetPage.components.push(pArrow2);

CrossReferenceEngine.updateProjectCrossReferences(project);
assert.equal(pArrow1.crossRef, '/21-3.3', 'Interruption point 1 points to target page and column');
assert.equal(pArrow2.crossRef, '/1.1', 'Interruption point 2 points to source page and column');

const targets1 = referenceTargets(project, pArrow1);
assert.equal(targets1.length, 1);
assert.equal(targets1[0].pageId, 'target');
assert.equal(targets1[0].componentId, 'p-arrow-2');

const targets2 = referenceTargets(project, pArrow2);
assert.equal(targets2.length, 1);
assert.equal(targets2[0].pageId, 'source');
assert.equal(targets2[0].componentId, 'p-arrow-1');

console.log('✓ Reference links: split pages, structure, per-contact targets, reverse navigation, interruption points across locations, fallback and escaping');
