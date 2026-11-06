import {terminalSettings} from '../model/WiringManagement';
// src/reports/TerminalDiagram.ts
// Generates terminal diagrams (Klemmenplan) according to DIN EN 81346 standards

import { Project } from '../model/types';
import {ProjectIndex,scopedDesignation,displayDesignation,type ProjectStructure} from '../model/ProjectIndex';
import {ElectricalNetService} from '../model/ElectricalNetService';

export interface TerminalEntry {
  terminalStrip: string;      // e.g. "-X1"
  terminalNumber: string;     // e.g. "1", "2", "PE"
  internalTarget: string;     // e.g. "-K1:2"
  externalTarget: string;     // e.g. "-M1:U1"
  functionText: string;
  pageId?:string; componentId?:string; numberSource?:'designation'|'legacy_text'|'sequence';
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
    const records=new Map<string,{tag:string;structure:ProjectStructure;entries:TerminalEntry[]}>(),lastStrip=new Map<string,string>();
    for(const entry of index.components){
      if(entry.symbol?.category!=='terminals')continue;
      const {component:comp,page,structure}=entry,scope=JSON.stringify([page.id,structure]);
      const configured=comp.terminal,colon=entry.tag.indexOf(':'),tag=configured?.strip|| (entry.tag?(colon>0?entry.tag.slice(0,colon):entry.tag):lastStrip.get(scope)??'-X1');
      if(entry.tag)lastStrip.set(scope,tag);
      const key=scopedDesignation(structure,tag);
      const record=records.get(key)??{tag,structure,entries:[]};records.set(key,record);
      const internal=new Set<string>(),external=new Set<string>(),colors=new Set<string>(),sections=new Set<string>();
      for(const own of index.pinsFor(entry)){
        const trace=nets.traceTargets(own);
        for(const other of trace.targets){
        const targetScope=other.owner.structure;
        const targetTag=targetScope.plant===structure.plant&&targetScope.location===structure.location?other.owner.tag:displayDesignation(targetScope,other.owner.tag);
        const target=(targetTag||'-')+':'+other.label;
        ((configured?.pinSides[own.id]??(own.id==='1'?'internal':'external'))==='internal'?internal:external).add(target);
        }
        for(const connection of trace.connections){
        if(connection.wire.color)colors.add(connection.wire.color);
        if(connection.wire.crossSection)sections.add(connection.wire.crossSection);
        }
      }
      const designation=colon>0?entry.tag.slice(colon+1).trim():'',legacy=comp.functionText.match(/\b(U1|V1|W1|PE|\d+)\b/)?.[0];
      record.entries.push({terminalStrip:tag,terminalNumber:configured?(configured.number+(configured.level?'/'+configured.level:'')):designation||legacy||String(record.entries.length+1),numberSource:designation?'designation':legacy?'legacy_text':'sequence',pageId:page.id,componentId:comp.id,internalTarget:[...internal].join(', ')||'-',externalTarget:[...external].join(', ')||'-',functionText:(comp.functionText||'Durchgangsklemme')+((project.logicalConnections??[]).some(w=>w.terminalBridge&&(w.from.componentId===comp.id||w.to.componentId===comp.id))?' · Brücke':''),wireColor:[...colors].join(', '),crossSection:[...sections].join(', ')});
    }
    const strips=new Map<string,TerminalEntry[]>();
    for(const record of records.values()){
      const repeated=[...records.values()].filter(r=>r.tag===record.tag).length>1;
      const name=repeated?displayDesignation(record.structure,record.tag):record.tag;
      for(const entry of record.entries)entry.terminalStrip=name;
      strips.set(name,record.entries);
    }
    return strips;
  }
}
