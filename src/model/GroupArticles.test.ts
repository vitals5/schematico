import assert from 'node:assert/strict';
import { fixture, add } from '../layout/testing/fixture';
import type { ElementGroup, Project } from './types';
import { ProjectIndex } from './ProjectIndex';
import { articleDataContext } from './ArticleDataAnalysis';
import { groupArticles,groupArticleUnits } from './GroupArticles';
import { inspectElectricalProject } from './ElectricalInspection';
import { PartsListGenerator } from '../reports/PartsList';
import { cleanupDefaults } from './ImportCleanup';

const p=fixture(),a=add(p,'a'),b=add(p,'b'),outside=add(p,'outside');
a.articleRequirement=b.articleRequirement=outside.articleRequirement='required';
const group:ElementGroup={id:'assembly',bmk:'-Q1',name:'Assembly',
  members:[{kind:'component',id:a.id},{kind:'component',id:b.id}],
  articleNumber:'ASSEMBLY-1',manufacturer:'Synthetic',
  articleAssignment:{mode:'manual',items:[{articleNumber:'ASSEMBLY-1',manufacturer:'Synthetic',variant:'V',quantity:2,role:'main'}]}};
p.pages[0].groups=[group];
const before=structuredClone(p);
function context(p:Project,id:string){const index=new ProjectIndex(p);return articleDataContext(index.component(id)!,index);}
const missing=(p:Project)=>inspectElectricalProject(p).messages.filter(m=>m.ruleId==='missing_article').map(m=>m.componentId);
assert.equal(context(p,a.id).state,'inherited');
assert.equal(context(p,a.id).inheritedFromGroupId,group.id);
assert.equal(context(p,a.id).inheritedFromGroupBmk,'-Q1');
assert.deepEqual(context(p,a.id).articleNumbers,['ASSEMBLY-1']);
assert.deepEqual(missing(p),[outside.id],'Assigned assembly covers its members but not independent devices');
assert(inspectElectricalProject(p).messages.some(m=>m.ruleId==='unwired'&&m.componentId===a.id),'Electrical checks on grouped members remain active');
assert.equal(PartsListGenerator.generatePartsList(p).find(r=>r.articleNumber==='ASSEMBLY-1')!.quantity,2);
assert.deepEqual(p,before,'Inspection never writes group articles onto member components');

const clearedMember=structuredClone(p);
clearedMember.pages[0].components[0].articleAssignment={mode:'manual',items:[]};
assert.equal(context(clearedMember,a.id).state,'inherited','An empty individual assignment does not require a separate purchased part');
const standalone=structuredClone(p);standalone.pages[0].groups=[];
assert(missing(standalone).includes(a.id),'Dissolving the assembly removes inherited coverage immediately');
const graphic=structuredClone(p);delete graphic.pages[0].groups![0].articleAssignment;delete graphic.pages[0].groups![0].articleNumber;
assert(missing(graphic).includes(a.id),'Mere graphic grouping does not cover missing articles');
const empty=structuredClone(p);empty.pages[0].groups![0].articleAssignment!.items=[];empty.pages[0].groups![0].articleNumber='';
assert(missing(empty).includes(a.id),'Clearing a group assignment must not revive prior articles');
const invalid=structuredClone(p);invalid.pages[0].groups![0].articleAssignment!.items[0].quantity=-1;
assert(missing(invalid).includes(a.id),'Invalid group assignment does not mask missing articles');

const nested=structuredClone(p);
nested.pages[0].groups!.push({id:'wrapper',members:[{kind:'group',id:group.id}]});
assert.equal(context(nested,a.id).inheritedFromGroupId,group.id);
assert.equal(PartsListGenerator.generatePartsList(nested).find(r=>r.articleNumber==='ASSEMBLY-1')!.quantity,2,'Assigned child under a graphical wrapper is included once');
const nestedClean=structuredClone(nested);nestedClean.dataInterpretation=cleanupDefaults;
assert.equal(PartsListGenerator.generatePartsList(nestedClean).length,1);
assert.equal(PartsListGenerator.generatePartsList(nestedClean)[0].articleNumber,'ASSEMBLY-1');
const outer=nested.pages[0].groups![1];outer.articleNumber='OUTER-1';outer.manufacturer='Synthetic';
assert.equal(context(nested,a.id).articleNumber,'OUTER-1','Outer assigned assembly owns nested representations');
const nestedBom=PartsListGenerator.generatePartsList(nested);
assert(nestedBom.some(r=>r.articleNumber==='OUTER-1')&&!nestedBom.some(r=>r.articleNumber==='ASSEMBLY-1'),'Nested parts are not double counted');

const overlap=structuredClone(p);overlap.pages[0].groups!.push({...structuredClone(group),id:'overlap'});
assert.equal(groupArticleUnits(overlap.pages[0]).owners.size,0,'Overlapping owners remain ambiguous');
assert(missing(overlap).includes(a.id));
const cycle=structuredClone(p);cycle.pages[0].groups![0].members.push({kind:'group',id:group.id});
assert.equal(groupArticleUnits(cycle.pages[0]).owners.size,0);
const duplicate=structuredClone(p);duplicate.pages[0].groups!.push(structuredClone(group));
assert.equal(groupArticleUnits(duplicate.pages[0]).owners.size,0);
const broken=structuredClone(p);broken.pages[0].groups![0].members.push({kind:'component',id:'missing'});
assert.equal(groupArticleUnits(broken.pages[0]).owners.size,0);
const otherPage=structuredClone(p);const second=structuredClone(p.pages[0]);second.id='second';second.components.forEach(c=>c.id='other-'+c.id);
second.groups![0].members=second.groups![0].members.map(m=>({...m,id:'other-'+m.id}));otherPage.pages.push(second);
assert.equal(context(otherPage,'other-a').inheritedFromGroupId,group.id,'Group identities are page scoped');
const scalar={...group,articleAssignment:undefined,variant:'SCALAR'};
assert.equal(groupArticles(scalar)[0].variant,'SCALAR');
assert.equal(groupArticles({...group,articleNumber:'EDITED'})[0].articleNumber,'EDITED','Scalar edits do not revive stale assignment items');
const imported=structuredClone(group);delete imported.articleNumber;delete imported.manufacturer;
assert.equal(groupArticles(imported)[0].articleNumber,'ASSEMBLY-1','Assignments without optional scalar mirrors remain valid');
assert.deepEqual(groupArticles({...group,articleAssignment:{mode:'manual',items:[]}}),[],'Explicit empty assignment overrides obsolete scalar fields');
console.log('✓ Group articles: inherited inspection coverage, independent electrical checks, nested/outer BOM ownership, explicit clears, invalid/overlapping/cyclic membership, page scope and immutable drawings');
