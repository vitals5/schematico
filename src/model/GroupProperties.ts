import type {ElementGroup,Page,Project,PlacedComponent,SymbolDefinition} from './types';
import {effectiveArticles} from './ArticleAssignments';
import {groupSelection} from './ElementGroups';
import {selectionBounds} from './ElementSelection';
import {rotatedLocalPoint,componentInsertionPoint} from './SymbolGeometry';
import {getSymbolForComponent} from './symbols';
import {AutoconnectEngine} from './AutoconnectEngine';

const identity=['bmk','deviceTag','functionText','additionalText','technicalCharacteristics','higherLevelFunction','mountingLocation','manufacturer','articleNumber','articleAssignment'] as const;
const settings=['bmkPosition','functionTextPosition','additionalTextPosition','technicalDataPosition','crossRefPosition','pinLabelPosition','crossRefFontSize','pinLabelFontSize','showLabels','articleRequirement','referenceRequirement'] as const;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
/** A detached component-shaped editing view. It is never inserted into the project or BOM. */
export function groupPropertiesSession(page:Page,project:Project,group:ElementGroup){
  const selection=groupSelection(page,group.id);
  const other=selectionBounds(page,project,{...selection,componentIds:[]});
  const all=page.components.filter(c=>selection.componentIds.includes(c.id)).flatMap(c=>{const s=getSymbolForComponent(c,project);if(!s)return [];const w=s.width*(c.scale??1),h=s.height*(c.scale??1),turn=c.rotation===90||c.rotation===270;return [{left:c.x+w/2-(turn?h:w)/2,top:c.y+h/2-(turn?w:h)/2,right:c.x+w/2+(turn?h:w)/2,bottom:c.y+h/2+(turn?w:h)/2}];});
  if(other)all.push(other);
  const bounds=all.length?{left:Math.min(...all.map(b=>b.left)),top:Math.min(...all.map(b=>b.top)),right:Math.max(...all.map(b=>b.right)),bottom:Math.max(...all.map(b=>b.bottom))}:undefined;
  if(!bounds)throw new Error('Die Gruppe enthält keine bearbeitbaren Elemente.');
  const members=page.components.filter(c=>selection.componentIds.includes(c.id));
  const primary=members.find(c=>c.bmk===group.bmk)??members[0];
  const proxy:PlacedComponent={id:group.id,symbolId:'group-properties:'+group.id,x:bounds.left,y:bounds.top,rotation:group.propertySettings?.rotation??0,scale:group.propertySettings?.scale,bmk:'',functionText:'',pins:{}};
  for(const key of identity)(proxy as any)[key]=structuredClone(group[key]??(key==='articleAssignment'?undefined:''));
  for(const key of settings)if(group.propertySettings?.[key]!==undefined||primary?.[key]!==undefined)(proxy as any)[key]=structuredClone(group.propertySettings?.[key]??primary?.[key]);
  proxy.crossRef=primary?.crossRef;
  const refs=new Map<string,{componentId:string;pinId:string;initial:PlacedComponent['pins'][string]}>(),pins:SymbolDefinition['pins']=[],svg:string[]=[];
  for(const member of members){const symbol=getSymbolForComponent(member,project);if(!symbol)continue;
    const scale=member.scale??1;
    svg.push(`<g transform="translate(${member.x-bounds.left},${member.y-bounds.top}) rotate(${member.rotation},${symbol.width*scale/2},${symbol.height*scale/2}) scale(${scale})">${symbol.svgContent}</g>`);
    for(const pin of symbol.pins){const id='gpin:'+encodeURIComponent(member.id)+':'+encodeURIComponent(pin.id),info=AutoconnectEngine.getRotatedPinInfo(member,pin,symbol);
      pins.push({...pin,id,name:(member.bmk?member.bmk+' · ':'')+pin.name,x:info.worldX-bounds.left,y:info.worldY-bounds.top,direction:info.direction});
      proxy.pins[id]={...structuredClone(member.pins[pin.id]??{}),customLabel:member.pins[pin.id]?.customLabel??pin.name};
      refs.set(id,{componentId:member.id,pinId:pin.id,initial:structuredClone(proxy.pins[id])});
    }
  }
  const symbol:SymbolDefinition={id:proxy.symbolId,name:group.name||group.bmk||'Baugruppe',category:'structure',standard:'',defaultBmkPrefix:'',defaultFunctionText:proxy.functionText,width:Math.max(1,bounds.right-bounds.left),height:Math.max(1,bounds.bottom-bounds.top),pins,svgContent:svg.join('')||`<rect width="${bounds.right-bounds.left}" height="${bounds.bottom-bounds.top}" fill="none" stroke="currentColor"/>`,description:group.description??'',insertionPoint:{x:0,y:0}};
  const localRotation=proxy.rotation;
  const local=(p:{x:number;y:number})=>rotatedLocalPoint(p,symbol,-localRotation);
  const anchor=localRotation===90?{x:symbol.width,y:0}:localRotation===180?{x:symbol.width,y:symbol.height}:localRotation===270?{x:0,y:symbol.height}:{x:0,y:0};
  symbol.insertionPoint=local(anchor);
  symbol.svgContent=`<g transform="rotate(${-localRotation},${symbol.width/2},${symbol.height/2})">${symbol.svgContent}</g>`;
  for(const pin of symbol.pins){Object.assign(pin,local(pin));const dirs=['top','right','bottom','left'] as const;pin.direction=dirs[(dirs.indexOf(pin.direction)-localRotation/90+4)%4];}
  proxy.importedSymbol=symbol;
  const original=structuredClone({components:members,
    wires:page.wires.filter(w=>selection.wireIds?.includes(w.id)||selection.componentIds.includes(w.from.componentId)&&selection.componentIds.includes(w.to.componentId)),
    cables:page.cables?.filter(c=>selection.cableIds.includes(c.id)),texts:page.texts?.filter(c=>selection.textIds?.includes(c.id)),
    boxes:page.boxes?.filter(c=>selection.boxIds?.includes(c.id)),images:page.images?.filter(c=>selection.imageIds?.includes(c.id))});
  const initial=structuredClone(proxy),appliedPinFields=new Set<string>(),appliedIdentity=new Set<string>();
  return {component:proxy,primary,apply(updated:PlacedComponent,dirty?:ReadonlySet<string>){
    if(![0,90,180,270].includes(updated.rotation)||![updated.x,updated.y,updated.rotation,updated.scale??1].every(Number.isFinite)||(updated.scale??1)<=0)throw new Error('Ungültige Gruppenposition oder Skalierung.');
    if(!page.groups?.some(g=>g.id===group.id))return;
    const rotation=(updated.rotation-initial.rotation+360)%360,angle=rotation*Math.PI/180,factor=(updated.scale??1)/(initial.scale??1),cos=[1,0,-1,0][rotation/90],sin=[0,1,0,-1][rotation/90];
    const oldAnchor=componentInsertionPoint(initial,symbol),newAnchor=componentInsertionPoint(updated,symbol);
    const unchanged=rotation===0&&factor===1&&oldAnchor.x===newAnchor.x&&oldAnchor.y===newAnchor.y;
    const transform=(p:{x:number;y:number})=>{if(unchanged)return {...p};const x=(p.x-oldAnchor.x)*factor,y=(p.y-oldAnchor.y)*factor;return {x:newAnchor.x+x*cos-y*sin,y:newAnchor.y+x*sin+y*cos};};
    for(const source of original.components.filter(c=>selection.componentIds.includes(c.id))){const target=page.components.find(c=>c.id===source.id);if(!target)continue;const s=getSymbolForComponent(source,project);if(!s)continue;
      const oldScale=source.scale??1,newScale=oldScale*factor,center=transform({x:source.x+s.width*oldScale/2,y:source.y+s.height*oldScale/2});
      target.x=unchanged?source.x:center.x-s.width*newScale/2;target.y=unchanged?source.y:center.y-s.height*newScale/2;target.rotation=((source.rotation+rotation)%360) as PlacedComponent['rotation'];
      if(factor!==1)target.scale=newScale;else if(source.scale===undefined)delete target.scale;else target.scale=source.scale;
      for(const key of settings){
        const prefixes:Record<string,string>={bmkPosition:'Bmk',functionTextPosition:'Fn',additionalTextPosition:'Additional',technicalDataPosition:'Tech',crossRefPosition:'CrossRef',pinLabelPosition:'Pin'};
        const prefix=prefixes[key];
        if(prefix){
          const from=(initial[key]??{}) as Record<string,unknown>,to=(updated[key]??{}) as Record<string,unknown>,state={...(dirty?.has('resetPositions')?{}:source[key] as object??{})} as Record<string,unknown>;
          for(const field of new Set([...Object.keys(from),...Object.keys(to)]))if(dirty?dirty.has('prop'+prefix+field[0].toUpperCase()+field.slice(1))||(['visible','visibilityExplicit'].includes(field)&&dirty.has(({Bmk:'propBmk',Fn:'propFunctionText',Additional:'propAdditionalText',Tech:'propTechChar'} as Record<string,string>)[prefix])):!same(from[field],to[field])){if(to[field]===undefined)delete state[field];else state[field]=structuredClone(to[field]);}
          if(Object.keys(state).length)(target as any)[key]=state;else delete (target as any)[key];
        }else if(!same(updated[key],initial[key]))(target as any)[key]=structuredClone(updated[key]);else (target as any)[key]=structuredClone(source[key]);
      }
    }
    for(const source of original.cables??[])if(selection.cableIds.includes(source.id)){const target=page.cables?.find(c=>c.id===source.id);if(target){target.start=transform(source.start);target.end=transform(source.end);}}
    for(const source of original.wires)if(selection.wireIds?.includes(source.id)||selection.componentIds.includes(source.from.componentId)&&selection.componentIds.includes(source.to.componentId)){const target=page.wires.find(c=>c.id===source.id);if(target&&source.waypoints)target.waypoints=source.waypoints.map(transform);}
    for(const source of original.texts??[])if(selection.textIds?.includes(source.id)){const target=page.texts?.find(c=>c.id===source.id);if(target){Object.assign(target,transform(source));target.rotation=(source.rotation??0)+rotation;target.fontSize=(source.fontSize??9)*factor;}}
    for(const kind of ['boxes','images'] as const)for(const source of original[kind]??[]){const ids=kind==='boxes'?selection.boxIds:selection.imageIds;if(!ids?.includes(source.id))continue;const target=page[kind]?.find(c=>c.id===source.id);if(target){if(unchanged){Object.assign(target,{x:source.x,y:source.y,width:source.width,height:source.height});continue;}const points=[source,{x:source.x+source.width,y:source.y},{x:source.x,y:source.y+source.height},{x:source.x+source.width,y:source.y+source.height}].map(transform);target.x=Math.min(...points.map(p=>p.x));target.y=Math.min(...points.map(p=>p.y));target.width=Math.max(...points.map(p=>p.x))-target.x;target.height=Math.max(...points.map(p=>p.y))-target.y;}}
    for(const key of identity)(group as any)[key]=structuredClone(updated[key]);
    if(updated.articleAssignment||updated.articleNumber!==initial.articleNumber||updated.manufacturer!==initial.manufacturer)group.articleAssignment={mode:'manual',items:effectiveArticles(updated,project)};
    const assignment=group.articleAssignment?.items.find(a=>a.role==='main')??group.articleAssignment?.items[0];group.variant=assignment?.variant??(group.articleAssignment?'':group.variant);
    if(assignment?.snapshot)group.description=assignment.snapshot.description;
    group.propertySettings={rotation:updated.rotation,scale:updated.scale};for(const key of settings)if(updated[key]!==undefined)(group.propertySettings as any)[key]=structuredClone(updated[key]);
    for(const source of original.components.filter(c=>selection.componentIds.includes(c.id))){const target=page.components.find(c=>c.id===source.id);if(!target)continue;
      // Keep distinct member identities. Group article assignment belongs to the group only.
      if(source.id===primary?.id||source.bmk===initial.bmk)for(const key of ['bmk','deviceTag','functionText','additionalText','technicalCharacteristics','higherLevelFunction','mountingLocation'] as const)if((source.id===primary?.id||same(source[key],initial[key]))&&(!same(updated[key],initial[key])||appliedIdentity.has(key))){(target as any)[key]=structuredClone(same(updated[key],initial[key])?source[key]:updated[key]);appliedIdentity.add(key);}
    }
    for(const [id,ref]of refs){const target=page.components.find(c=>c.id===ref.componentId);if(!target)continue;const state=updated.pins[id]??{};
      for(const key of ['customLabel','connectionRequirement','potentialConstraint','labelPosition'] as const){const token=id+':'+key;if(!same(state[key],ref.initial[key])||appliedPinFields.has(token)){target.pins[ref.pinId]??={};const value=same(state[key],ref.initial[key])?original.components.find(c=>c.id===ref.componentId)?.pins[ref.pinId]?.[key]:state[key];if(value===undefined)delete target.pins[ref.pinId][key];else (target.pins[ref.pinId] as any)[key]=structuredClone(value);appliedPinFields.add(token);}}
    }
  }};
}
