import type {PlacedComponent,Project} from './types';
import {terminalStripBindings} from './TerminalStripTypes';
import {distributedTerminalBindings} from './DistributedTerminalTypes';
import {DeviceRegistry} from './DeviceRegistry';

export function assertTerminalAssignments(before:Project,after:Project):void {
  const newIssues=(a:unknown[],b:unknown[])=>{const known=new Set(a.map(v=>JSON.stringify(v)));return b.some(v=>!known.has(JSON.stringify(v)));};
  if(newIssues(terminalStripBindings(before).issues,terminalStripBindings(after).issues))throw new Error('terminalStripLevelsInvalid');
  if(newIssues(distributedTerminalBindings(before).issues,distributedTerminalBindings(after).issues))throw new Error('terminalDistributionPartialOwnership');
  if(newIssues(new DeviceRegistry(before).issues,new DeviceRegistry(after).issues))throw new Error('terminalStripOwnership');
}

export function validateTerminalComponentEdit(project:Project,updated:PlacedComponent):void {
  if(!project.physicalDevices?.some(d=>d.terminalPositionId&&d.members.some(a=>a.componentId===updated.id)))return;
  if(updated.terminal&&updated.bmk!==updated.terminal.strip+(updated.terminal.number?':'+updated.terminal.number:''))throw new Error('terminalStripLevelsInvalid');
  const found=project.pages.flatMap(page=>page.components.filter(c=>c.id===updated.id).map(c=>({page,c})));if(found.length!==1)throw new Error('terminalStripMemberMissing');
  const identity=(c:PlacedComponent)=>JSON.stringify([c.bmk,c.higherLevelFunction,c.mountingLocation,c.terminal,c.articleNumber,c.manufacturer,c.articleAssignment,c.articleReferences]);
  if(identity(found[0].c)===identity(updated))return;
  const next=structuredClone(project),page=next.pages.find(p=>p.id===found[0].page.id)!;
  page.components[page.components.findIndex(c=>c.id===updated.id)]=structuredClone(updated);
  assertTerminalAssignments(project,next);
}
