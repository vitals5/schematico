import {terminalSettings} from '../model/WiringManagement';
import {orderedTerminalEntries,terminalStripBindings,terminalStripKey,type TerminalStripIdentity} from '../model/TerminalStripTypes';
// src/reports/TerminalDiagram.ts
// Generates terminal diagrams (Klemmenplan) according to DIN EN 81346 standards

import { Project } from '../model/types';
import {ProjectIndex,scopedDesignation,displayDesignation,type ProjectStructure} from '../model/ProjectIndex';
import {ElectricalNetService} from '../model/ElectricalNetService';
import {isTerminalComponent,interpretationEnabled} from '../model/ComponentSemantics';
import {terminalLevelValues,terminalPinSide} from '../model/TerminalFunctions';
import {distributedTerminalBindings} from '../model/DistributedTerminalTypes';
import type {ComponentAddress} from '../model/ArticleTypes';

export interface TerminalEntry {
  representations?:ComponentAddress[];
  functionId?:string;
  physicalDeviceId?:string;
  sortingKey?:string;
  levelId?:string;
  levelDesignation?:string;
  pinIds?:string[];
  mainFunction?:boolean;
  stripIdentity?:TerminalStripIdentity;
  assemblyPosition?:number;
  terminalStrip: string;      // e.g. "-X1"
  terminalNumber: string;     // e.g. "1", "2", "PE"
  internalTarget: string;     // e.g. "-K1:2"
  externalTarget: string;     // e.g. "-M1:U1"
  functionText: string;
  pageId?:string; componentId?:string; numberSource?:'designation'|'legacy_text'|'sequence'|'unresolved';
  wireColor?: string;
  crossSection?: string;
}

export interface TerminalPdfStripChunk {
  stripName: string;
  continued: boolean;
  entries: TerminalEntry[];
}

export type TerminalPdfPage = TerminalPdfStripChunk[];

export const TERMINAL_PDF_START_Y = 40;
export const TERMINAL_PDF_STRIP_HEADER_HEIGHT = 12; // 5mm strip title + 7mm table header
export const TERMINAL_PDF_ROW_HEIGHT = 6;
export const TERMINAL_PDF_STRIP_GAP = 10;

export function layoutTerminalDiagramPdf(
  strips: Map<string, TerminalEntry[]>,
  pageHeightMm: number
): TerminalPdfPage[] {
  const bottom = pageHeightMm - 25;
  const pages: TerminalPdfPage[] = [[]];
  let curY = TERMINAL_PDF_START_Y;

  const startNextPage = () => {
    pages.push([]);
    curY = TERMINAL_PDF_START_Y;
  };

  for (const [stripName, entries] of strips.entries()) {
    if (entries.length === 0) continue;

    const minStripStartHeight = TERMINAL_PDF_STRIP_HEADER_HEIGHT + TERMINAL_PDF_ROW_HEIGHT;
    if (pages.at(-1)!.length > 0 && curY + minStripStartHeight > bottom + 1e-8) {
      startNextPage();
    }

    let currentChunk: TerminalPdfStripChunk = {
      stripName,
      continued: false,
      entries: [],
    };
    pages.at(-1)!.push(currentChunk);
    curY += TERMINAL_PDF_STRIP_HEADER_HEIGHT;

    for (const entry of entries) {
      if (currentChunk.entries.length > 0 && curY + TERMINAL_PDF_ROW_HEIGHT > bottom + 1e-8) {
        startNextPage();
        currentChunk = {
          stripName,
          continued: true,
          entries: [],
        };
        pages.at(-1)!.push(currentChunk);
        curY += TERMINAL_PDF_STRIP_HEADER_HEIGHT;
      }
      currentChunk.entries.push(entry);
      curY += TERMINAL_PDF_ROW_HEIGHT;
    }

    curY += TERMINAL_PDF_STRIP_GAP;
  }

  return pages;
}

export class TerminalDiagramGenerator {
  public static generateTerminalReport(project: Project): Map<string, TerminalEntry[]> {
    const index=new ProjectIndex(project);
    const nets=new ElectricalNetService(index);
    const distributed=distributedTerminalBindings(project),seenFunctions=new Set<string>();
    const records=new Map<string,{tag:string;structure:ProjectStructure;entries:TerminalEntry[];count:number}>(),lastStrip=new Map<string,string>();
    for(const candidate of index.components){
      let entry=candidate;
      if(!isTerminalComponent(project,entry.component,entry.symbol))continue;
      const partial=distributed.byPlacement.get(JSON.stringify([entry.page.id,entry.component.id]));
      if(partial){if(seenFunctions.has(partial.id))continue;seenFunctions.add(partial.id);
        const main=index.devices.valid.get(partial.deviceId)?.main;if(main)entry=index.component(main.componentId,main.pageId)??entry;}
      const functionEntries=partial?partial.placements.flatMap(p=>{const e=index.component(p.target.componentId,p.target.pageId);return e?[e]:[];}):[entry];
      const functionIds=new Set(functionEntries.map(e=>e.component.id));
      const {component:comp,page,structure}=entry,scope=JSON.stringify([page.id,structure]);
      const configured=comp.terminal,colon=entry.tag.indexOf(':'),tag=configured?.strip|| (entry.tag?(colon>0?entry.tag.slice(0,colon):entry.tag):lastStrip.get(scope)??'-X1');
      if(entry.tag)lastStrip.set(scope,tag);
      const key=scopedDesignation(structure,tag);
      const record=records.get(key)??{tag,structure,entries:[],count:0};records.set(key,record);
      const levels=terminalLevelValues(comp,entry.symbol);
      const sequence=String(++record.count);
      for(const level of levels.length>1?levels:[undefined]) {
      const internal=new Set<string>(),external=new Set<string>(),colors=new Set<string>(),sections=new Set<string>();
      for(const functionEntry of functionEntries)for(const own of index.pinsFor(functionEntry)){
        if(level&&!level.pinIds.includes(own.id))continue;
        const trace=nets.traceTargets(own);
        for(const other of trace.targets){
        const targetScope=other.owner.structure;
        const targetTag=targetScope.plant===structure.plant&&targetScope.location===structure.location?other.owner.tag:displayDesignation(targetScope,other.owner.tag);
        const target=(partial||levels.length===1&&levels[0].pinIds.length>2?own.label+': ':'')+(targetTag||'-')+':'+other.label;
        (terminalPinSide(functionEntry.component,functionEntry.symbol,own.id)==='internal'?internal:external).add(target);
        }
        for(const connection of trace.connections){
        if(connection.wire.color)colors.add(connection.wire.color);
        if(connection.wire.crossSection)sections.add(connection.wire.crossSection);
        }
      }
      const designation=colon>0?entry.tag.slice(colon+1).trim():'',legacy=comp.functionText.match(/\b(U1|V1|W1|PE|\d+)\b/)?.[0];
      const clean=interpretationEnabled(project,'nativeRoles');
      const number=clean?(configured?.number||designation||'?'):configured?configured.number:designation||legacy||sequence;
      const levelName=level?.designation||configured?.levelDesignation||configured?.level;
      const hasBridge=(project.logicalConnections??[]).some(w=>w.terminalBridge&&(
        functionIds.has(w.from.componentId)&&(!level||level.pinIds.includes(w.from.pinId))||
        functionIds.has(w.to.componentId)&&(!level||level.pinIds.includes(w.to.pinId))));
      const owner=index.devices.forComponent({pageId:page.id,componentId:comp.id});
      record.entries.push({...(level?{levelId:level.id,levelDesignation:level.designation,pinIds:level.pinIds,mainFunction:level.id===entry.symbol?.terminalDefinition?.mainLevel}:{}),
        ...(owner?{physicalDeviceId:owner.id,...(!level?{mainFunction:owner.main.componentId===comp.id&&owner.main.pageId===page.id}:{})}:{}),
        ...(partial?{functionId:partial.id,representations:partial.placements.map(p=>p.target),pinIds:[...new Set(partial.placements.flatMap(p=>Object.keys(p.pinMap)))]}:{}),sortingKey:configured?.sortingKey,
        terminalStrip:tag,terminalNumber:levelName?number+'/'+levelName:number,numberSource:clean?(configured?.number||designation?'designation':'unresolved'):designation?'designation':legacy?'legacy_text':'sequence',pageId:page.id,componentId:comp.id,internalTarget:[...internal].join(', ')||'-',externalTarget:[...external].join(', ')||'-',functionText:(level?(level.functionText||''):(comp.functionText||''))+(hasBridge?' · Brücke':''),wireColor:[...colors].join(', '),crossSection:[...sections].join(', ')});
      }
    }
    const strips=new Map<string,TerminalEntry[]>(),configuration=terminalStripBindings(project);
    for(const record of records.values()){
      const repeated=[...records.values()].filter(r=>r.tag===record.tag).length>1;
      const name=repeated?displayDesignation(record.structure,record.tag):record.tag;
      const identity={...record.structure,strip:record.tag};
      for(const entry of record.entries){entry.terminalStrip=name;entry.stripIdentity=identity;}
      const ordered=orderedTerminalEntries(project,identity,record.entries,configuration),config=project.terminalStrips?.find(s=>terminalStripKey(s)===terminalStripKey(identity));
      if(config)for(const entry of ordered){const at=config.positions.findIndex(pos=>pos.kind==='terminal'&&configuration.bindings.get(pos.id)?.valid&&pos.members.some(a=>a.pageId===entry.pageId&&a.componentId===entry.componentId));if(at>=0)entry.assemblyPosition=at+1;}
      strips.set(name,ordered);
    }
    return strips;
  }
}
