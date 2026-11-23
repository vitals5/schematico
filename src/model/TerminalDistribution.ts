import type {ComponentAddress} from './ArticleTypes';
import type {PlacedComponent,Project,SymbolDefinition,DrawingPrimitive,PinDefinition} from './types';
import {ProjectIndex} from './ProjectIndex';
import {addressKey} from './DeviceRegistry';
import {assertTerminalAssignments} from './TerminalEditValidation';
import {terminalAddressKey,terminalIdentity,terminalStripKey,terminalStripBindings} from './TerminalStripTypes';
import {TerminalStripEditPlan,terminalDrawingGroup} from './TerminalStrips';
import {terminalLevels,terminalLevelValues,terminalPinSide} from './TerminalFunctions';
import {terminalSettings} from './WiringManagement';
import {getSymbolForComponent,mergeProjectSymbolLibrary} from './symbols';
import {effectiveArticles,setArticleAssignment} from './ArticleAssignments';
import {electricalPinGroups} from './ElectricalDefinition';
import {ElectricalNetService,portIdentity,sameConductorTopology} from './ElectricalNetService';
import {terminalPortKey} from './DistributedTerminalTypes';
import {AutoconnectEngine} from './AutoconnectEngine';
import {drawingToSvg} from './ImportedDrawing';
import {rotatedLocalPoint,positionAtInsertionPoint} from './SymbolGeometry';
import {projectRevision} from '../layout/types';

export type TerminalDistributionEdit=
 |{kind:'split';target:ComponentAddress;mode:'levels'|'parts';mainLevel?:string}
 |{kind:'move';target:ComponentAddress;pageId:string;x:number;y:number};

/** Update live planning references only. Revision archives, inspection evidence
 * and imported source tables deliberately remain historical snapshots. */
function remapLiveReferences(p:Project,source:ComponentAddress,destinationPage:string,map?:Map<string,{componentId:string;pinId:string}>){
  const address=<T extends ComponentAddress&{pinId?:string}>(a:T):T=>{
    if(a.pageId!==source.pageId||a.componentId!==source.componentId)return a;
    const endpoint=a.pinId?map?.get(terminalPortKey(a.componentId,a.pinId)):undefined;
    return {...a,pageId:destinationPage,...endpoint};
  };
  for(const definition of p.potentialDefinitions??[])definition.anchors=definition.anchors.map(address);
  for(const connector of p.connectorAssemblies??[])for(const contact of connector.contacts)if(contact.binding)contact.binding=address(contact.binding);
  for(const channel of p.automation?.channels??[])for(const key of ['signal','supply','common'] as const)if(channel[key])channel[key]=address(channel[key]!);
  for(const node of p.automation?.nodes??[])if(node.binding)node.binding=address(node.binding);
  for(const layout of p.cabinetLayouts??[])for(const item of layout.items)if(item.source)item.source=address(item.source);
  for(const device of p.plannedDevices??[])if(device.placement)device.placement=address(device.placement);
  for(const page of p.pages)for(const c of page.components){if(c.deviceReference)c.deviceReference.targets=c.deviceReference.targets.map(address);if(c.articleFunctionRepresentation)c.articleFunctionRepresentation.primary=address(c.articleFunctionRepresentation.primary);}
  for(const circuit of p.dimensioning??[])if(circuit.reference)for(const key of ['from','to'] as const){const ep=circuit.reference[key];const target=map?.get(terminalPortKey(ep.componentId,ep.pinId));if(target)circuit.reference[key]={...ep,...target};}
  for(const circuit of p.dimensioning??[])for(const article of Object.values(circuit.articles??{}))if(article?.device)article.device=address(article.device);
}

function functionSymbol(source:SymbolDefinition,ids:string[],level:ReturnType<typeof terminalLevelValues>[number],partial:boolean,units:number):SymbolDefinition {
  const u=units/2,width=12*u,height=partial?20*u:source.height;
  const sourcePins=source.pins.filter(p=>ids.includes(p.id));
  if(!partial&&(sourcePins.length!==2||sourcePins[0].x!==sourcePins[1].x||
    !sourcePins.some(p=>p.direction==='top'&&p.y===0)||!sourcePins.some(p=>p.direction==='bottom'&&p.y===source.height)))throw new Error('terminalDistributionUnsupported');
  const pins=sourcePins.map((p):PinDefinition=>({...structuredClone(p),
    x:p.direction==='left'?0:p.direction==='right'?width:width/2,
    y:p.direction==='top'?0:p.direction==='bottom'?height:height/2,
    labelPosition:{x:p.direction==='left'?-4*u:p.direction==='right'?width+4*u:width/2,
      y:p.direction==='top'?-4*u:p.direction==='bottom'?height+7*u:height/2+1.5*u,fontSize:4*u,
      alignment:p.direction==='left'?'end':p.direction==='right'?'start':'middle'}}));
  const graphics:DrawingPrimitive[]=[{kind:'circle',x:width/2,y:height/2,radius:2*u,color:'currentColor',width:u,
    ...(level.potential==='PE'?{fill:'currentColor'}:{})}];
  for(const p of pins){const vertical=p.direction==='top'||p.direction==='bottom',sign=p.direction==='top'||p.direction==='left'?-1:1;
    graphics.push({kind:'line',x1:p.x,y1:p.y,x2:vertical?width/2:width/2+sign*2*u,y2:vertical?height/2+sign*2*u:height/2,color:'currentColor',width:u});}
  // An open disconnect must not look like an unbroken through conductor.
  if(!partial&&level.disconnectable){graphics.splice(0,graphics.length,
    {kind:'line',x1:width/2,y1:0,x2:width/2,y2:height/2-3*u,color:'currentColor',width:u},
    {kind:'line',x1:width/2,y1:height/2-3*u,x2:width/2+4*u,y2:height/2+2*u,color:'currentColor',width:u},
    {kind:'line',x1:width/2,y1:height/2+3*u,x2:width/2,y2:height,color:'currentColor',width:u});}
  const electrical=electricalPinGroups(source),owned=new Set(ids),groups=(values:string[][])=>values.filter(group=>group.every(id=>owned.has(id)));
  return {id:`terminal_${partial?'part':'level'}:${source.id}:${partial?ids[0]:level.id}`,name:source.name+' · '+level.designation,
    category:'terminals',standard:source.standard,defaultBmkPrefix:'-X',defaultFunctionText:'',unitsPerMm:units,width,height,pins,
    insertionPoint:{x:pins[0].x,y:pins[0].y},svgContent:drawingToSvg(graphics),importedGraphics:graphics,description:source.description,
    functionDefinition:partial||source.source||source.functionDefinition!==`symbol:${source.id}`?source.functionDefinition:
      level.potential==='PE'?'symbol:terminal_pe':level.disconnectable?'symbol:catalog_disconnect_terminal_knife':'symbol:terminal_single',
    terminalDefinition:{kind:level.potential==='PE'?'pe':level.disconnectable?'disconnect':'feed_through',mainLevel:level.id,
      levels:[{id:level.id,designation:level.designation,potential:level.potential,pinIds:ids,...(level.disconnectable?{disconnectable:true}:{})}]},
    electrical:{permanentConnections:partial?[]:groups(electrical.permanent),conditionalConnections:partial?[]:groups(electrical.conditional)}};
}

/** An isolated transaction. The source project, devices, wires and article data
 * are changed only when the independently checked preview is applied. */
export class TerminalDistributionPlan {
 readonly #base:string;readonly #next:Project;
 readonly members:ComponentAddress[]=[];
 constructor(project:Project,readonly edit:TerminalDistributionEdit){
  this.#base=projectRevision(project);let p=structuredClone(project);const index=new ProjectIndex(p),e=index.component(edit.target.componentId,edit.target.pageId);
  if(!e||index.componentsById.get(e.component.id)?.length!==1||index.pagesById.get(e.page.id)?.length!==1)throw new Error('terminalStripMemberMissing');
  if(terminalDrawingGroup(p,edit.target))throw new Error('terminalStripDrawingGroup');
  if(edit.kind==='move'){
    const target=p.pages.filter(page=>page.id===edit.pageId);if(target.length!==1||target[0].pageType!=='schematic'||!Number.isFinite(edit.x)||!Number.isFinite(edit.y))throw new Error('terminalDistributionMoveInvalid');
    if([...p.pages.flatMap(page=>page.wires),...(p.logicalConnections??[])].some(w=>w.from.componentId===e.component.id||w.to.componentId===e.component.id))throw new Error('terminalDistributionConnected');
    if(!e.component.terminal||!getSymbolForComponent(e.component,p)?.terminalDefinition)throw new Error('terminalDistributionUnsupported');
    const c=e.component,s=e.symbol!,scale=c.scale??1,scaled={...s,width:s.width*scale,height:s.height*scale};
    const origin=positionAtInsertionPoint({x:edit.x,y:edit.y},s,c.rotation,scale);
    const corners=[{x:0,y:0},{x:scaled.width,y:0},{x:scaled.width,y:scaled.height},{x:0,y:scaled.height}].map(v=>rotatedLocalPoint(v,scaled,c.rotation));
    if(corners.some(v=>v.x+origin.x<0||v.y+origin.y<0||v.x+origin.x>target[0].plotFrame.width||v.y+origin.y>target[0].plotFrame.height))throw new Error('terminalDistributionMoveInvalid');
    c.higherLevelFunction??=e.page.higherLevel;c.mountingLocation??=e.page.location;
    if(e.page!==target[0]){e.page.components=e.page.components.filter(v=>v.id!==c.id);target[0].components.push(c);}
    c.x=origin.x;c.y=origin.y;
    const address={pageId:edit.pageId,componentId:c.id};
    const remap=(a:ComponentAddress)=>addressKey(a)===addressKey(edit.target)?{...address}:a;
    for(const strip of p.terminalStrips??[])for(const pos of strip.positions)if(pos.kind==='terminal')pos.members=pos.members.map(remap);
    for(const device of p.physicalDevices??[]){device.main=remap(device.main);device.members=device.members.map(remap);}
    for(const f of p.distributedTerminalFunctions??[])for(const placement of f.placements)placement.target=remap(placement.target);
    remapLiveReferences(p,edit.target,edit.pageId);
    if(!sameConductorTopology(project,p))throw new Error('terminalDistributionTopology');
    this.members.push(address);
  }else{
    const symbol=e.symbol,levels=terminalLevelValues(e.component,symbol),settings=terminalSettings(e.component);
    if(!symbol||symbol.unresolved||!levels.length||e.component.terminal?.functionId||e.component.source?.routingUsed===false||
      edit.mode==='levels'&&levels.length<2||edit.mode==='parts'&&(levels.length!==1||!['feed_through','pe'].includes(symbol.terminalDefinition!.kind)||symbol.pins.length<2))throw new Error('terminalDistributionUnsupported');
    if(!settings.strip.trim()||!settings.number.trim())throw new Error('terminalDistributionNumberRequired');
    if(index.devices.forComponent(edit.target)||(p.physicalDevices??[]).some(d=>d.members.some(a=>addressKey(a)===addressKey(edit.target))))throw new Error('terminalStripOwnership');
    const identity=terminalIdentity(e.page,e.component);
    if(!p.terminalStrips?.some(s=>terminalStripKey(s)===terminalStripKey(identity)))p=new TerminalStripEditPlan(p,{kind:'initialize',identity}).apply(p);
    const page=p.pages.find(page=>page.id===e.page.id)!,original=page.components.find(c=>c.id===e.component.id)!;
    const strip=p.terminalStrips!.find(s=>terminalStripKey(s)===terminalStripKey(identity))!,position=strip.positions.find(pos=>pos.kind==='terminal'&&pos.members.some(a=>addressKey(a)===addressKey(edit.target)));
    if(!position||position.kind!=='terminal'||position.members.length!==1||!terminalStripBindings(p).bindings.get(position.id)?.valid)throw new Error('terminalStripRepairFirst');
    const partial=edit.mode==='parts',plans=partial?symbol.pins.map(pin=>({level:levels[0],ids:[pin.id]})):levels.map(level=>({level,ids:level.pinIds}));
    const electrical=electricalPinGroups(symbol);
    if(electrical.knowledge==='unknown'||electrical.invalid.length||!partial&&[...electrical.permanent,...electrical.conditional].some(group=>!plans.some(plan=>group.every(id=>plan.ids.includes(id)))))throw new Error('terminalDistributionUnsupported');
    const mainIndex=partial?0:plans.findIndex(plan=>plan.level.id===(edit.mainLevel??symbol.terminalDefinition!.mainLevel));
    if(mainIndex<0||!partial&&mainIndex!==0&&mainIndex!==plans.length-1)throw new Error('terminalStripLevelsInvalid');
    const endpointMap=new Map<string,{componentId:string;pinId:string}>(),created:PlacedComponent[]=[],functionId=partial?crypto.randomUUID():undefined;
    for(const [i,plan] of plans.entries()){
      const definition=functionSymbol(symbol,plan.ids,plan.level,partial,p.drawingUnitsPerMm??2),main=i===mainIndex;
      const c:PlacedComponent={...structuredClone(original),id:main?original.id:'terminal_'+crypto.randomUUID(),symbolId:definition.id,
        higherLevelFunction:original.higherLevelFunction??page.higherLevel,mountingLocation:original.mountingLocation??page.location,
        functionText:plan.level.functionText,pins:Object.fromEntries(Object.entries(original.pins).filter(([id])=>plan.ids.includes(id))),
        terminal:{...settings,...(settings.rowDisplay?{rowDisplay:settings.rowDisplay==='start'&&i===0?'start' as const:'continuation' as const}:{}),...(functionId?{functionId}:{}),levels:undefined,
          level:partial?settings.level:String(i+1),levelDesignation:partial?settings.levelDesignation:plan.level.designation,
          sortingKey:settings.sortingKey?settings.sortingKey+'.'+String(i+1).padStart(3,'0'):String(i+1).padStart(3,'0'),
          pinSides:Object.fromEntries(plan.ids.map(id=>[id,terminalPinSide(original,symbol,id)]))}};
      delete c.importedSymbol;delete c.deviceBox;
      delete c.terminal!.levels;if(c.terminal!.levelDesignation===undefined)delete c.terminal!.levelDesignation;
      if(!main){delete c.source;delete c.articleReferences;delete c.crossRef;delete c.articleFunctionId;delete c.articleFunctionEvidence;delete c.articleFunctionRepresentation;setArticleAssignment(c,[]);}
      const first=symbol.pins.find(pin=>pin.id===plan.ids[0])!,old=AutoconnectEngine.getRotatedPinInfo(original,first,symbol),local=AutoconnectEngine.getRotatedPinInfo({...c,x:0,y:0},definition.pins.find(pin=>pin.id===first.id)!,definition);
      c.x=old.worldX-local.worldX;c.y=old.worldY-local.worldY;
      for(const id of plan.ids)endpointMap.set(terminalPortKey(original.id,id),{componentId:c.id,pinId:id});
      mergeProjectSymbolLibrary(p,[definition],[c]);created.push(c);this.members.push({pageId:page.id,componentId:c.id});
    }
    page.components.splice(page.components.indexOf(original),1,...created);
    for(const wire of [...p.pages.flatMap(page=>page.wires),...(p.logicalConnections??[])])for(const key of ['from','to'] as const){const mapped=endpointMap.get(terminalPortKey(wire[key].componentId,wire[key].pinId));if(mapped)wire[key]={...wire[key],...mapped};}
    remapLiveReferences(p,edit.target,page.id,endpointMap);
    position.members=structuredClone(mainIndex===plans.length-1?[...this.members].reverse():this.members);position.deviceId=crypto.randomUUID();
    (p.physicalDevices??=[]).push({id:position.deviceId,main:this.members[mainIndex],members:structuredClone(this.members),verification:'user_confirmed',terminalPositionId:position.id});
    if(partial)(p.distributedTerminalFunctions??=[]).push({id:functionId!,deviceId:position.deviceId,kind:symbol.terminalDefinition!.kind,functionDefinition:symbol.functionDefinition,
      logicalPins:symbol.pins.map(pin=>pin.id),permanentConnections:electrical.permanent,conditionalConnections:electrical.conditional,
      placements:this.members.map((target,i)=>({target,pinMap:Object.fromEntries(plans[i].ids.map(id=>[id,id]))}))});
    for(const pin of symbol.pins){const mapping=endpointMap.get(terminalPortKey(original.id,pin.id))!,c=created.find(c=>c.id===mapping.componentId)!,s=getSymbolForComponent(c,p)!,a=AutoconnectEngine.getRotatedPinInfo(original,pin,symbol),b=AutoconnectEngine.getRotatedPinInfo(c,s.pins.find(p=>p.id===pin.id)!,s);
      if(Math.abs(a.worldX-b.worldX)>1e-8||Math.abs(a.worldY-b.worldY)>1e-8)throw new Error('terminalDistributionTopology');}
    const before=new ElectricalNetService(new ProjectIndex(project)),after=new ElectricalNetService(new ProjectIndex(p));
    const canonical=(nets:ElectricalNetService,remap:boolean)=>JSON.stringify(nets.nets.map(net=>net.ports.map(pin=>{
      const mapped=remap?endpointMap.get(portIdentity(pin)):undefined;return mapped?terminalPortKey(mapped.componentId,mapped.pinId):portIdentity(pin);
    }).sort()).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
    if(canonical(before,true)!==canonical(after,false))throw new Error('terminalDistributionTopology');
  }
  assertTerminalAssignments(project,p);
  this.#next=p;
 }
 preview(){return structuredClone(this.#next);}
 apply(project:Project){if(projectRevision(project)!==this.#base)throw new Error('articlesProjectStale');const p=structuredClone(this.#next);p.activePageId=project.activePageId;p.modified=new Date().toISOString();return p;}
}
