import {isTerminalComponent} from './ComponentSemantics';
import type {Project} from './types';
import type {AssignedArticle,ComponentAddress} from './ArticleTypes';
import {ProjectIndex} from './ProjectIndex';
import {DeviceRegistry,addressKey,designationContext} from './DeviceRegistry';
import {effectiveArticles,articleSignature,validateAssignments,setArticleAssignment} from './ArticleAssignments';
import {terminalSettings} from './WiringManagement';
import {projectRevision} from '../layout/types';
import {terminalStripBindings,terminalStripKey,terminalIdentity,type TerminalStripIdentity,type TerminalStripConfiguration,type TerminalMountingPosition} from './TerminalStripTypes';
export type TerminalStripEdit=
 |{kind:'initialize';identity:TerminalStripIdentity}
 |{kind:'move';stripId:string;positionId:string;beforeId?:string}
 |{kind:'group';stripId:string;positionIds:string[];levels:{target:ComponentAddress;level:string}[]}
 |{kind:'ungroup';stripId:string;positionId:string}
 |{kind:'main';stripId:string;positionId:string;target:ComponentAddress}
 |{kind:'sort';stripId:string}
 |{kind:'accessory';stripId:string;positionId?:string;description:string;article:AssignedArticle;beforeId?:string}
 |{kind:'remove_accessory';stripId:string;positionId:string}
 |{kind:'reset';stripId:string};
export function terminalDrawingGroup(project:Project,a:ComponentAddress){return project.pages.find(p=>p.id===a.pageId)?.groups?.some(g=>g.members.some(m=>m.kind==='component'&&m.id===a.componentId))??false;}
export class TerminalStripEditPlan {
 readonly #base:string;readonly #next:Project;
 constructor(project:Project,readonly edit:TerminalStripEdit){
  this.#base=projectRevision(project);const p=structuredClone(project),index=new ProjectIndex(p),registry=index.devices;
  const strips=p.terminalStrips??=[],unique=(id:string)=>{const found=strips.filter(s=>s.id===id);if(found.length!==1)throw new Error('terminalStripScopeInvalid');return found[0];};
  const removeOwnedDevices=(s:TerminalStripConfiguration,ids:Set<string>,restoreInherited=false)=>{p.physicalDevices=p.physicalDevices?.filter(d=>{const pos=s.positions.find(pos=>pos.kind==='terminal'&&ids.has(pos.id)&&pos.deviceId===d.id&&d.terminalPositionId===pos.id);if(pos?.kind!=='terminal')return true;const main=registry.placement(d.main);if(restoreInherited&&pos.inheritedDevice&&main&&d.members.every(a=>{const e=registry.placement(a);return !!e&&designationContext(e.page,e.component)===designationContext(main.page,main.component);})){delete d.terminalPositionId;return true;}return false;});};
  let changed:TerminalStripConfiguration;
  if(edit.kind==='initialize'){
   const identity={plant:edit.identity.plant.trim().replace(/^=+/,''),location:edit.identity.location.trim().replace(/^\++/,''),strip:edit.identity.strip.trim()};if(!identity.strip||strips.some(s=>terminalStripKey(s)===terminalStripKey(identity)))throw new Error('terminalStripScopeInvalid');
   const entries=index.components.filter(e=>isTerminalComponent(p,e.component,e.symbol)&&terminalStripKey(terminalIdentity(e.page,e.component))===terminalStripKey(identity));if(!entries.length)throw new Error('terminalStripMemberMissing');
   changed={...identity,id:crypto.randomUUID(),positions:[]};const seen=new Set<string>();
   for(const e of entries){const a={pageId:e.page.id,componentId:e.component.id};if(seen.has(addressKey(a)))continue;if(index.componentsById.get(e.component.id)?.length!==1)throw new Error('terminalStripMemberMissing');
    const owner=registry.forComponent(a),members=owner?owner.members:[a];if((p.physicalDevices??[]).some(d=>!registry.valid.has(d.id)&&d.members.some(m=>addressKey(m)===addressKey(a))))throw new Error('terminalStripOwnership');
    if(members.some(m=>!entries.some(v=>v.page.id===m.pageId&&v.component.id===m.componentId)))throw new Error('terminalStripOwnership');
    const pos:TerminalMountingPosition={id:crypto.randomUUID(),kind:'terminal',members:structuredClone(members)};if(owner){pos.deviceId=owner.id;pos.inheritedDevice=true;owner.terminalPositionId=pos.id;}changed.positions.push(pos);members.forEach(m=>seen.add(addressKey(m)));
   }
   (p.terminalStrips??=[]).push(changed);
  }else{
   changed=unique(edit.stripId);const find=(id:string)=>{const found=changed.positions.filter(pos=>pos.id===id);if(found.length!==1)throw new Error('terminalStripPositionInvalid');return found[0];};
   if(edit.kind==='reset'){if(changed.positions.some(pos=>pos.kind==='terminal'&&pos.members.some(a=>registry.placement(a)?.component.terminal?.functionId)))throw new Error('terminalDistributionPartialOwnership');removeOwnedDevices(changed,new Set(changed.positions.map(pos=>pos.id)),true);p.terminalStrips=strips.filter(s=>s.id!==changed.id);this.#next=p;return;}
   if(terminalStripBindings(p).issues.some(i=>i.stripId===changed.id))throw new Error('terminalStripRepairFirst');
   if(edit.kind==='sort'){
    const key=(pos:typeof changed.positions[number])=>pos.kind==='terminal'?pos.members.map(a=>registry.placement(a)?.component.terminal?.sortingKey??'').filter(Boolean).sort(new Intl.Collator('en',{numeric:true}).compare)[0]??'':'';
    const compare=new Intl.Collator('en',{numeric:true}).compare,sorted=changed.positions.filter(pos=>pos.kind==='terminal').map((pos,i)=>({pos,i,key:key(pos)})).sort((a,b)=>a.key&&b.key?compare(a.key,b.key)||a.i-b.i:a.key?-1:b.key?1:a.i-b.i).map(row=>row.pos);
    let next=0;changed.positions=changed.positions.map(pos=>pos.kind==='terminal'?sorted[next++]:pos);
   }else if(edit.kind==='main'){
    const pos=find(edit.positionId);if(pos.kind!=='terminal'||!pos.deviceId||!pos.members.some(a=>addressKey(a)===addressKey(edit.target)))throw new Error('terminalStripOwnership');
    const device=registry.valid.get(pos.deviceId);if(!device)throw new Error('terminalStripOwnership');
    const order=[...pos.members].sort((a,b)=>new Intl.Collator('en',{numeric:true}).compare(registry.placement(a)?.component.terminal?.level??'',registry.placement(b)?.component.terminal?.level??''));
    const level=registry.placement(edit.target)!.component.terminal?.level??'',low=registry.placement(order[0])!.component.terminal?.level??'',high=registry.placement(order.at(-1)!)!.component.terminal?.level??'';
    if(level!==low&&level!==high)throw new Error('terminalStripLevelsInvalid');
    const articles=effectiveArticles(registry.placement(device.main)!.component,p);
    for(const a of pos.members)setArticleAssignment(registry.placement(a)!.component,addressKey(a)===addressKey(edit.target)?articles:[]);
    device.main=structuredClone(edit.target);pos.members=level===low?order:order.reverse();
    // Partial placements share one article function; its primary follows the
    // explicit main terminal, including after reassignment to another sheet.
    const functions=(p.distributedTerminalFunctions??[]).filter(f=>f.deviceId===device.id);
    for(const f of functions)for(const placement of f.placements){const c=registry.placement(placement.target)!.component;
      if(addressKey(placement.target)===addressKey(device.main))delete c.articleFunctionRepresentation;
      else c.articleFunctionRepresentation={primary:structuredClone(device.main)};
    }
   }else if(edit.kind==='move'){const pos=find(edit.positionId);if(edit.beforeId===pos.id)throw new Error('terminalStripPositionInvalid');if(edit.beforeId)find(edit.beforeId);changed.positions=changed.positions.filter(v=>v.id!==pos.id);const at=edit.beforeId?changed.positions.findIndex(v=>v.id===edit.beforeId):changed.positions.length;changed.positions.splice(at,0,pos);
   }else if(edit.kind==='group'){
    if(edit.positionIds.length<2||new Set(edit.positionIds).size!==edit.positionIds.length)throw new Error('terminalStripGroupInvalid');const selected=changed.positions.filter(pos=>edit.positionIds.includes(pos.id));if(selected.length!==edit.positionIds.length||selected.some(pos=>pos.kind!=='terminal'))throw new Error('terminalStripGroupInvalid');
    const members=selected.flatMap(pos=>pos.kind==='terminal'?pos.members:[]);if(members.some(a=>registry.placement(a)?.component.terminal?.functionId))throw new Error('terminalDistributionPartialOwnership');if(members.some(a=>terminalDrawingGroup(p,a)))throw new Error('terminalStripDrawingGroup');
    if(edit.levels.length!==members.length||new Set(edit.levels.map(v=>addressKey(v.target))).size!==members.length||new Set(edit.levels.map(v=>v.level.trim())).size!==members.length||edit.levels.some(v=>!v.level.trim()||!members.some(a=>addressKey(a)===addressKey(v.target))))throw new Error('terminalStripLevelsInvalid');
    const withArticles=members.filter(a=>effectiveArticles(registry.placement(a)!.component,p).length),main=withArticles[0]??members[0],signature=articleSignature(registry.placement(main)!.component,p);if(withArticles.some(a=>articleSignature(registry.placement(a)!.component,p)!==signature))throw new Error('terminalStripArticleConflict');
    for(const a of members){const e=registry.placement(a)!;const settings=terminalSettings(e.component);if(!settings.number.trim())throw new Error('terminalStripNumberRequired');settings.level=edit.levels.find(v=>addressKey(v.target)===addressKey(a))!.level.trim();e.component.terminal=settings;}
    const pos:TerminalMountingPosition={id:crypto.randomUUID(),kind:'terminal',members:structuredClone(members),deviceId:crypto.randomUUID()},at=changed.positions.findIndex(v=>v.id===selected[0].id);removeOwnedDevices(changed,new Set(selected.map(v=>v.id)));changed.positions=changed.positions.filter(v=>!edit.positionIds.includes(v.id));changed.positions.splice(at,0,pos);(p.physicalDevices??=[]).push({id:pos.deviceId!,main:structuredClone(main),members:structuredClone(members),verification:'user_confirmed',terminalPositionId:pos.id});
   }else if(edit.kind==='ungroup'){
    const pos=find(edit.positionId);if(pos.kind!=='terminal'||pos.members.length<2)throw new Error('terminalStripGroupInvalid');if(pos.members.some(a=>registry.placement(a)?.component.terminal?.functionId))throw new Error('terminalDistributionPartialOwnership');const at=changed.positions.indexOf(pos);removeOwnedDevices(changed,new Set([pos.id]));changed.positions.splice(at,1,...pos.members.map(a=>({id:crypto.randomUUID(),kind:'terminal' as const,members:[structuredClone(a)]})));
   }else if(edit.kind==='accessory'){
    const [article]=validateAssignments([edit.article]);if(article.quantity===undefined||!Number.isSafeInteger(article.quantity)||article.quantity<=0)throw new Error('terminalStripArticleInvalid');const pos={id:edit.positionId??crypto.randomUUID(),kind:'accessory' as const,description:edit.description.trim(),article};
    if(edit.positionId){const old=find(edit.positionId);if(old.kind!=='accessory')throw new Error('terminalStripPositionInvalid');changed.positions[changed.positions.indexOf(old)]=pos;}else{if(edit.beforeId)find(edit.beforeId);const at=edit.beforeId?changed.positions.findIndex(v=>v.id===edit.beforeId):changed.positions.length;changed.positions.splice(at,0,pos);}
   }else if(edit.kind==='remove_accessory'){const pos=find(edit.positionId);if(pos.kind!=='accessory')throw new Error('terminalStripPositionInvalid');changed.positions=changed.positions.filter(v=>v.id!==pos.id);}
  }
  if(terminalStripBindings(p).issues.some(i=>i.stripId===changed.id))throw new Error('terminalStripPositionInvalid');const oldIssues=new Set(registry.issues.map(i=>JSON.stringify([i.deviceId,i.code])));if(new DeviceRegistry(p).issues.some(i=>!oldIssues.has(JSON.stringify([i.deviceId,i.code]))))throw new Error('terminalStripOwnership');this.#next=p;
 }
 preview(){return structuredClone(this.#next);}
 apply(project:Project){if(projectRevision(project)!==this.#base)throw new Error('articlesProjectStale');const p=structuredClone(this.#next);p.activePageId=project.activePageId;p.modified=new Date().toISOString();return p;}
}
