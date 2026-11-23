import type {ComponentAddress} from './ArticleTypes';
import type {Project} from './types';
import type {TerminalDefinition} from './TerminalFunctions';
import {getSymbolForComponent} from './symbols';
import {terminalStripBindings,terminalAddressKey} from './TerminalStripTypes';
import {functionType} from './FunctionDefinitions';
import type {PlacedComponent,SymbolDefinition} from './types';

export interface DistributedTerminalFunction {
  functionDefinition?:string;
  id:string;
  deviceId:string;
  kind:TerminalDefinition['kind'];
  logicalPins:string[];
  permanentConnections:string[][];
  conditionalConnections?:string[][];
  placements:{target:ComponentAddress;pinMap:Record<string,string>}[];
}
export interface DistributedTerminalIssue {functionId:string;members:ComponentAddress[];reason:string}
export const terminalPortKey=(componentId:string,pinId:string)=>JSON.stringify([componentId,pinId]);

/** A designation never establishes electrical equivalence. Only a complete,
 * unambiguous, explicitly owned function may link distributed connection points. */
export function distributedTerminalBindings(project:Project){
  const functions=project.distributedTerminalFunctions??[],valid=new Map<string,DistributedTerminalFunction>(),
    byPlacement=new Map<string,DistributedTerminalFunction>(),issues:DistributedTerminalIssue[]=[];
  const placements=new Map<string,{page:Project['pages'][number];component:Project['pages'][number]['components'][number]}[]>(),ids=new Map<string,number>(),claims=new Map<string,number>();
  const globalIds=new Map<string,number>(),devices=new Map<string,NonNullable<Project['physicalDevices']>>();
  for(const page of project.pages)for(const component of page.components){const key=terminalAddressKey({pageId:page.id,componentId:component.id});placements.set(key,[...(placements.get(key)??[]),{page,component}]);globalIds.set(component.id,(globalIds.get(component.id)??0)+1);}
  for(const device of project.physicalDevices??[])devices.set(device.id,[...(devices.get(device.id)??[]),device]);
  for(const f of functions){ids.set(f.id,(ids.get(f.id)??0)+1);for(const p of f.placements??[])claims.set(terminalAddressKey(p.target),(claims.get(terminalAddressKey(p.target))??0)+1);}
  const bindings=functions.length?terminalStripBindings(project):undefined;
  for(const f of functions){
    const members=(f.placements??[]).map(p=>p.target),fail=(reason:string)=>issues.push({functionId:f.id,members,reason});
    if(!f.id||ids.get(f.id)!==1||!Array.isArray(f.logicalPins)||f.logicalPins.length<2||f.logicalPins.length>64||
      new Set(f.logicalPins).size!==f.logicalPins.length||f.logicalPins.some(id=>typeof id!=='string'||!id)||!Array.isArray(f.placements)||f.placements.length<2){fail('terminalStripLevelsInvalid');continue;}
    const ds=devices.get(f.deviceId),device=ds?.length===1?ds[0]:undefined,binding=device?.terminalPositionId?bindings?.bindings.get(device.terminalPositionId):undefined;
    if(!device||!binding?.valid||binding.position.kind!=='terminal'||binding.position.deviceId!==device.id||device.verification!=='user_confirmed'||
      !members.some(a=>terminalAddressKey(a)===terminalAddressKey(device.main))||
      members.some(a=>!device.members.some(b=>terminalAddressKey(a)===terminalAddressKey(b)))){fail('terminalStripOwnership');continue;}
    let bad=false;const covered=new Set<string>(),roles=new Map<string,string>(),levels=new Set<string>();
    for(const p of f.placements){
      const found=placements.get(terminalAddressKey(p.target)),e=found?.length===1?found[0]:undefined,s=e&&getSymbolForComponent(e.component,project);
      if(!e||globalIds.get(p.target.componentId)!==1||claims.get(terminalAddressKey(p.target))!==1||e.component.terminal?.functionId!==f.id||
        !s||s.unresolved||!p.pinMap||typeof p.pinMap!=='object'||Array.isArray(p.pinMap)||Object.keys(p.pinMap).length!==s.pins.length){bad=true;break;}
      levels.add(JSON.stringify([e.component.terminal.strip,e.component.terminal.number,e.component.terminal.level]));
      for(const pin of s.pins){const logical=p.pinMap[pin.id];if(!f.logicalPins.includes(logical)){bad=true;break;}
        covered.add(logical);const role=pin.electricalRole??'unknown',old=roles.get(logical);if(old&&old!==role){bad=true;break;}roles.set(logical,role);}
    }
    const groups=[f.permanentConnections,f.conditionalConnections??[]];
    if(groups.some(list=>!Array.isArray(list)||list.some(group=>!Array.isArray(group)||!group.length||new Set(group).size!==group.length||group.some(id=>!f.logicalPins.includes(id)))))bad=true;
    if(bad||covered.size!==f.logicalPins.length||levels.size!==1){fail('terminalStripLevelsInvalid');continue;}
    valid.set(f.id,f);for(const p of f.placements)byPlacement.set(terminalAddressKey(p.target),f);
  }
  for(const [key,found] of placements)for(const e of found)if(e.component.terminal?.functionId&&!byPlacement.has(key)&&!issues.some(i=>i.members.some(a=>terminalAddressKey(a)===key)))
    issues.push({functionId:e.component.terminal.functionId,members:[{pageId:e.page.id,componentId:e.component.id}],reason:'terminalStripMemberMissing'});
  return {valid,byPlacement,issues};
}

/** Article templates describe the logical function, not its individual drawn
 * connection-point fragments. Keep exact pin names; never infer template IDs. */
export function terminalArticleFunction(project:Project,address:ComponentAddress,c:PlacedComponent,s:SymbolDefinition,
  bindings?:ReturnType<typeof distributedTerminalBindings>){
  const f=bindings?.byPlacement.get(terminalAddressKey(address));
  if(!f)return {type:c.articleFunctionType??functionType(s),pins:s.pins.map(p=>(c.pins[p.id]?.customLabel??p.name).trim()).sort(),current:c.articleFunctionId,primary:c.articleFunctionRepresentation?.primary};
  const names=new Map<string,Set<string>>();
  for(const placement of f.placements){const component=project.pages.find(page=>page.id===placement.target.pageId)?.components.find(c=>c.id===placement.target.componentId),symbol=component&&getSymbolForComponent(component,project);if(!component||!symbol)continue;
    for(const [pinId,logical] of Object.entries(placement.pinMap)){const pin=symbol.pins.find(p=>p.id===pinId);if(!pin)continue;const values=names.get(logical)??new Set<string>();values.add((component.pins[pinId]?.customLabel??pin.name).trim());names.set(logical,values);}
  }
  const main=project.physicalDevices?.find(d=>d.id===f.deviceId)?.main,
    owner=main&&project.pages.find(page=>page.id===main.pageId)?.components.find(c=>c.id===main.componentId);
  return {type:c.articleFunctionType??f.functionDefinition??functionType(s),pins:f.logicalPins.map(id=>names.get(id)?.size===1?[...names.get(id)!][0]:'').sort(),
    current:c.articleFunctionId??owner?.articleFunctionId,primary:main&&terminalAddressKey(main)!==terminalAddressKey(address)?main:undefined};
}
