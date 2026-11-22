import assert from 'node:assert/strict';
import { fixture, add } from '../layout/testing/fixture';
import { inspectElectricalProject } from './ElectricalInspection';
import { findingFingerprint, inspectionTasks } from './InspectionWorkflow';
import { reviewInspection } from './InspectionReview';

// Reproduce the report shape: 66 unassigned representations in 11 groups.
const p=fixture();
for(let g=0;g<11;g++){
  const ids=Array.from({length:6},(_,i)=>add(p,`member-${g}-${i}`).id);
  (p.pages[0].groups??=[]).push({id:'group-'+g,members:ids.map(id=>({kind:'component',id}))});
}
add(p,'outside');
const before=structuredClone(p),report=inspectElectricalProject(p);
const missing=report.messages.filter(m=>m.ruleId==='missing_article');
const groups=missing.filter(m=>m.groupId);
assert.equal(groups.length,11);
assert.equal(missing.length,12,'66 group members produce 11 group notices plus the independent device');
assert(groups.every(g=>!g.componentId&&g.location.groupId===g.groupId&&g.relatedLocations.length===6));
assert(groups.every(g=>g.articleData?.role==='group'&&g.articleData.state==='unassigned'));
assert(groups.every(g=>(g.cause.details.groupedMembers as unknown[]).length===6));
assert.equal(new Set(groups.flatMap(g=>g.relatedLocations.map(l=>l.componentId))).size,66,'No missing member evidence is dropped');
assert(!missing.some(m=>m.componentId?.startsWith('member-')));
assert.equal(reviewInspection(report.messages,{rule:'missing_article'}).filtered.length,12);
assert.deepEqual(p,before,'Grouping the report never writes article assignments or drawing data');
const without=structuredClone(p);without.pages[0].groups=[];
const raw=inspectElectricalProject(without);
assert.equal(raw.messages.filter(m=>m.ruleId==='missing_article').length,67);
assert.deepEqual(report.messages.filter(m=>m.ruleId!=='missing_article'),raw.messages.filter(m=>m.ruleId!=='missing_article'),'All electrical member findings remain unchanged');

const one=fixture(),a=add(one,'a'),b=add(one,'b');
a.articleRequirement='required';
one.pages[0].groups=[{id:'child',members:[{kind:'component',id:a.id},{kind:'component',id:b.id}]},
  {id:'outer',members:[{kind:'group',id:'child'}]}];
const nested=inspectElectricalProject(one).messages.filter(m=>m.ruleId==='missing_article');
assert.equal(nested.length,1);assert.equal(nested[0].groupId,'outer');assert.equal(nested[0].severity,'warning');
assert.equal(nested[0].relatedLocations.length,2);
assert.equal(inspectionTasks(one).filter(t=>t.finding.ruleId==='missing_article'&&t.current).length,1);
const fingerprint=findingFingerprint(one,nested[0]);
one.pages[0].groups![1].name='Renamed';
assert.notEqual(findingFingerprint(one,nested[0]),fingerprint,'Group edits invalidate previous acknowledgements');
one.pages[0].groups![1].articleNumber='GROUP-ARTICLE';
assert.equal(inspectElectricalProject(one).messages.filter(m=>m.ruleId==='missing_article').length,0);
assert(one.pages[0].components.every(c=>!c.articleNumber),'The assembly article is not copied to individual members');

const overlap=structuredClone(before);overlap.pages[0].groups!.push({...structuredClone(overlap.pages[0].groups![0]),id:'overlap'});
const overlapMissing=inspectElectricalProject(overlap).messages.filter(m=>m.ruleId==='missing_article');
assert.equal(overlapMissing.filter(m=>m.componentId?.startsWith('member-0-')).length,6,'Ambiguous grouping does not hide individual evidence');
const cycle=structuredClone(one);delete cycle.pages[0].groups![1].articleNumber;
cycle.pages[0].groups![0].members.push({kind:'group',id:'outer'});
assert.equal(inspectElectricalProject(cycle).messages.filter(m=>m.ruleId==='missing_article').length,2,'Cyclic membership stays unaggregated');
console.log('✓ Group inspection: 66 members → 11 group notices, full evidence and severity, nested selection, group-aware workflow, independent devices, invalid membership and unchanged electrical findings');
