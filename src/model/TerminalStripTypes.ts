import {isTerminalComponent} from './ComponentSemantics';
import type {AssignedArticle,ComponentAddress,PhysicalDevice} from './ArticleTypes';
import type {Page,PlacedComponent,Project} from './types';
import {getSymbolForComponent} from './symbols';
import {validateAssignments} from './ArticleAssignments';

export interface TerminalStripIdentity {plant:string;location:string;strip:string}
export interface TerminalMountingPosition {id:string;kind:'terminal';members:ComponentAddress[];deviceId?:string;inheritedDevice?:boolean}
export interface TerminalAccessoryPosition {id:string;kind:'accessory';description:string;article:AssignedArticle}
export type TerminalStripPosition=TerminalMountingPosition|TerminalAccessoryPosition;
export interface TerminalStripConfiguration extends TerminalStripIdentity {id:string;positions:TerminalStripPosition[]}
export const terminalAddressKey=(a:ComponentAddress)=>JSON.stringify([a.pageId,a.componentId]);
export function terminalLevelDefaults(records:{target:ComponentAddress;level:string}[],previous:ReadonlyMap<string,string>=new Map()){
 const result=new Map(previous),used=new Set(records.map(r=>previous.get(terminalAddressKey(r.target))??r.level).filter(Boolean));
 for(const r of records){const key=terminalAddressKey(r.target);if(result.has(key))continue;let level=r.level;if(!level){let n=1;while(used.has(String(n)))n++;level=String(n);}used.add(level);result.set(key,level);}return result;
}
export const terminalStripKey=(s:TerminalStripIdentity)=>JSON.stringify([s.plant.trim().replace(/^=+/,'').trim(),s.location.trim().replace(/^\++/,'').trim(),s.strip.trim()]);
export function terminalIdentity(page:Page,c:PlacedComponent):TerminalStripIdentity {
 const tag=c.bmk.trim(),colon=tag.indexOf(':');return {plant:(c.higherLevelFunction??page.higherLevel??'').trim().replace(/^=+/,''),location:(c.mountingLocation??page.location??'').trim().replace(/^\++/,''),strip:c.terminal?.strip.trim()||(colon>0?tag.slice(0,colon):tag)};
}
export interface TerminalStripIssue {stripId:string;positionId?:string;members:ComponentAddress[];reason:string}
export interface TerminalStripBinding {strip:TerminalStripConfiguration;position:TerminalStripPosition;valid:boolean}
/** Independent of ProjectIndex/DeviceRegistry so device ownership cannot recurse. */
export function terminalStripBindings(project:Project){
 if(!project.terminalStrips?.length)return {bindings:new Map<string,TerminalStripBinding>(),issues:[] as TerminalStripIssue[]};
 const strips=project.terminalStrips,issues:TerminalStripIssue[]=[],bindings=new Map<string,TerminalStripBinding>(),placements=new Map<string,{page:Page;component:PlacedComponent}[]>(),componentIds=new Map<string,number>(),pages=new Map<string,number>(),ids=new Map<string,number>(),scopes=new Map<string,number>(),positionIds=new Map<string,number>(),membership=new Map<string,number>();
 for(const page of project.pages){pages.set(page.id,(pages.get(page.id)??0)+1);for(const component of page.components){const k=terminalAddressKey({pageId:page.id,componentId:component.id});placements.set(k,[...placements.get(k)??[],{page,component}]);componentIds.set(component.id,(componentIds.get(component.id)??0)+1);}}
 for(const strip of strips){ids.set(strip.id,(ids.get(strip.id)??0)+1);scopes.set(terminalStripKey(strip),(scopes.get(terminalStripKey(strip))??0)+1);for(const pos of strip.positions){positionIds.set(pos.id,(positionIds.get(pos.id)??0)+1);if(pos.kind==='terminal')for(const a of pos.members)membership.set(terminalAddressKey(a),(membership.get(terminalAddressKey(a))??0)+1);}}
 const ownersByMember=new Map<string,PhysicalDevice[]>();for(const device of project.physicalDevices??[])for(const a of device.members){const key=terminalAddressKey(a);ownersByMember.set(key,[...ownersByMember.get(key)??[],device]);}
 for(const strip of strips){const scopeOK=!!strip.id&&!!strip.strip.trim()&&ids.get(strip.id)===1&&scopes.get(terminalStripKey(strip))===1;if(!scopeOK)issues.push({stripId:strip.id,members:[],reason:'terminalStripScopeInvalid'});
  for(const position of strip.positions){const members=position.kind==='terminal'?position.members:[],reasons=new Set<string>();if(!scopeOK||!position.id||positionIds.get(position.id)!==1)reasons.add('terminalStripPositionInvalid');
   if(position.kind==='terminal'){
    if(!members.length||new Set(members.map(terminalAddressKey)).size!==members.length)reasons.add('terminalStripPositionInvalid');
    for(const a of members){const found=placements.get(terminalAddressKey(a));if(pages.get(a.pageId)!==1||componentIds.get(a.componentId)!==1||found?.length!==1){reasons.add('terminalStripMemberMissing');continue;}const {page,component}=found[0];if(!isTerminalComponent(project,component,getSymbolForComponent(component,project))||terminalStripKey(terminalIdentity(page,component))!==terminalStripKey(strip))reasons.add('terminalStripMemberScope');if(membership.get(terminalAddressKey(a))!==1)reasons.add('terminalStripMemberOverlap');}
    if(members.length>1){const levels=new Map<string,string>();for(const a of members){const c=placements.get(terminalAddressKey(a))?.[0]?.component;if(!c)continue;const level=c.terminal?.level??'',identity=c.terminal?.functionId??terminalAddressKey(a);if(!level&&!c.terminal?.functionId||levels.has(level)&&levels.get(level)!==identity)reasons.add('terminalStripLevelsInvalid');levels.set(level,identity);}}
    const owners=[...new Set(members.flatMap(a=>ownersByMember.get(terminalAddressKey(a))??[]))];
    if(position.deviceId){const own=owners.filter(d=>d.id===position.deviceId);if(owners.length!==1||own.length!==1||own[0].terminalPositionId!==position.id||own[0].verification!=='user_confirmed'||own[0].members.length!==members.length||!own[0].members.every(a=>members.some(m=>terminalAddressKey(a)===terminalAddressKey(m)))||!members.some(a=>terminalAddressKey(a)===terminalAddressKey(own[0].main)))reasons.add('terminalStripOwnership');}
    else if(members.length!==1||owners.length)reasons.add('terminalStripOwnership');
   }else if(position.kind==='accessory'){try{const [a]=validateAssignments([position.article]);if(!a||a.quantity===undefined||!Number.isSafeInteger(a.quantity)||a.quantity<=0)throw new Error();}catch{reasons.add('terminalStripArticleInvalid');}}
   else reasons.add('terminalStripPositionInvalid');
   for(const reason of reasons)issues.push({stripId:strip.id,positionId:position.id,members,reason});bindings.set(position.id,{strip,position,valid:reasons.size===0});
  }
 }
 return {bindings,issues};
}
export function terminalDeviceBinding(device:PhysicalDevice,bindings:ReturnType<typeof terminalStripBindings>['bindings']){
 const b=device.terminalPositionId?bindings.get(device.terminalPositionId):undefined;return b?.valid&&b.position.kind==='terminal'&&b.position.deviceId===device.id?b:undefined;
}
/** Unknown/new placements retain their existing relative order after configured positions. */
export function orderedTerminalEntries<T extends {pageId?:string;componentId?:string}>(project:Project,identity:TerminalStripIdentity,entries:T[],data=terminalStripBindings(project)){
 const strips=(project.terminalStrips??[]).filter(s=>terminalStripKey(s)===terminalStripKey(identity));if(strips.length!==1){
  const keys=new Map(project.pages.flatMap(page=>page.components.flatMap(c=>c.terminal?.sortingKey?[[terminalAddressKey({pageId:page.id,componentId:c.id}),c.terminal.sortingKey] as const]:[])));
  const collator=new Intl.Collator('en',{numeric:true});return entries.map((entry,i)=>({entry,i,key:keys.get(terminalAddressKey({pageId:entry.pageId??'',componentId:entry.componentId??''}))})).sort((a,b)=>a.key&&b.key?collator.compare(a.key,b.key)||a.i-b.i:a.key?-1:b.key?1:a.i-b.i).map(r=>r.entry);
 }
 const order=new Map<string,number>();strips[0].positions.forEach((p,i)=>{if(p.kind==='terminal'&&data.bindings.get(p.id)?.valid)p.members.forEach((a,j)=>order.set(terminalAddressKey(a),i*10000+j));});
 return entries.map((entry,i)=>({entry,i,rank:order.get(terminalAddressKey({pageId:entry.pageId??'',componentId:entry.componentId??''}))??Infinity})).sort((a,b)=>a.rank-b.rank||a.i-b.i).map(r=>r.entry);
}
