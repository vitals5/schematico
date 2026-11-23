import type { Project } from './types';
import type { ComponentAddress } from './ArticleTypes';
import { componentRole, type ComponentRole, type DataInterpretation } from './ComponentSemantics';
import { ProjectIndex } from './ProjectIndex';
import { componentAddress } from './DeviceRegistry';
import { effectiveArticles } from './ArticleAssignments';
import { deviceNavigator } from './DeviceNavigator';
import { PartsListGenerator } from '../reports/PartsList';
import { TerminalDiagramGenerator } from '../reports/TerminalDiagram';
import { connectionList } from '../reports/ConnectionList';
import { connectionRepresentationPairs } from './ConnectionRepresentations';
import { projectRevision } from '../layout/types';
import { structureImportedTerminals, type TerminalStructurePreview } from './ImportedTerminalStructure';

export const cleanupDefaults: DataInterpretation = {
  version: 1, nativeRoles: true, assignedArticlesOnly: true, consolidateConnections: true,
};
export interface CleanupIssue {
  id: string;
  kind: 'graphic' | 'device_connection' | 'connector' | 'terminal_number' | 'terminal_structure' | 'device_candidate' | 'connection_conflict' | 'cable_core_count';
  addresses: ComponentAddress[];
  label: string;
  details: string;
  wireIds?: string[];
  cableId?: string;
  pageId?: string;
  terminalReason?: import('./ImportedTerminalStructure').TerminalRecognitionReason;
}
export interface ImportCleanupOptions { structureTerminals?: boolean }
export interface CleanupMetrics {
  navigator: number;
  terminals: number;
  bom: number;
  connections: number;
}
function metrics(p: Project, connectionCount?: number): CleanupMetrics {
  return {
    navigator: deviceNavigator(p).length,
    terminals: [...TerminalDiagramGenerator.generateTerminalReport(p).values()].reduce((n,a)=>n+a.length,0),
    bom: PartsListGenerator.generatePartsList(p).length,
    connections: connectionCount ?? connectionList(p).length,
  };
}
function validateProfile(profile: DataInterpretation): DataInterpretation {
  if (profile?.version !== 1 || ['nativeRoles','assignedArticlesOnly','consolidateConnections'].some(k=>
    typeof profile[k as keyof DataInterpretation] !== 'boolean')) throw Error('cleanupInvalid');
  return { version: 1, nativeRoles: profile.nativeRoles,
    assignedArticlesOnly: profile.assignedArticlesOnly, consolidateConnections: profile.consolidateConnections };
}
function calculateCleanup(project: Project, input: DataInterpretation, options: ImportCleanupOptions) {
  const profile = validateProfile(input);
  const initial: Project = { ...project, dataInterpretation: structuredClone(profile) };
  const structured = options.structureTerminals ? structureImportedTerminals(initial) : undefined;
  const interpreted = structured?.project ?? initial;
  const index = new ProjectIndex(project);
  const roles: Partial<Record<ComponentRole, number>> = {};
  const issues: CleanupIssue[] = [];
  for (const issue of structured?.preview.issues ?? []) issues.push({
    id: 'terminal-structure:' + JSON.stringify(issue.addresses), kind: 'terminal_structure',
    addresses: issue.addresses, label: [issue.strip, issue.number].filter(Boolean).join(':'),
    details: issue.reason, terminalReason: issue.reason,
  });
  const groups = new Map<string, typeof index.components>();
  let assignedPlacements = 0;
  for (const e of index.components) {
    const role = componentRole(e.component, e.symbol), a = componentAddress(e.page,e.component);
    roles[role] = (roles[role] ?? 0) + 1;
    if(effectiveArticles(e.component,project).length)assignedPlacements++;
    if (['graphic','device_connection','connector'].includes(role))
      issues.push({ id:JSON.stringify([role,a]),kind:role as 'graphic'|'device_connection'|'connector',addresses:[a],
        label:e.tag||e.symbol?.name||e.component.id,details:e.component.symbolId });
    if(e.deviceKey && !['graphic','connection','annotation'].includes(role)) {
      const group=groups.get(e.deviceKey)??[];group.push(e);groups.set(e.deviceKey,group);
    }
  }
  for(const [key,entries] of groups) {
    if(entries.length<2||entries.every(e=>componentRole(e.component,e.symbol)==='terminal'))continue;
    const devices=entries.map(e=>index.devices.forComponent(componentAddress(e.page,e.component))?.id);
    if(devices[0]&&devices.every(d=>d===devices[0]))continue;
    issues.push({id:'device:'+key,kind:'device_candidate',addresses:entries.map(e=>componentAddress(e.page,e.component)),
      label:entries[0].tag,details:entries.length+' · '+entries.map(e=>e.page.pageNumber).filter((p,i,a)=>a.indexOf(p)===i).join(', ')});
  }
  const terminals = TerminalDiagramGenerator.generateTerminalReport(interpreted);
  const reviewedTerminals=new Set(issues.filter(i=>i.kind==='terminal_structure').flatMap(i=>i.addresses.map(a=>JSON.stringify([a.pageId,a.componentId]))));
  for(const entries of terminals.values())for(const t of entries)if(t.numberSource==='unresolved'&&!reviewedTerminals.has(JSON.stringify([t.pageId,t.componentId])))
    issues.push({id:'terminal:'+JSON.stringify([t.pageId,t.componentId]),kind:'terminal_number',
      addresses:[{pageId:t.pageId!,componentId:t.componentId!}],label:t.terminalStrip,details:t.componentId!});
  const pairs=connectionRepresentationPairs(index.connections);
  const connectionRows=connectionList(interpreted);
  const byWire=new Map(connectionRows.map(r=>[r.wireId,r]));
  for(const pair of pairs) {
    const drawing=byWire.get(pair.drawing.wire.id),logical=byWire.get(pair.logical.wire.id);
    const conflicts=[...pair.conflicts,...(['cable','core'] as const).filter(k=>drawing?.[k]&&logical?.[k]&&drawing[k]!==logical[k])];
    if(conflicts.length)issues.push({
    id:'connection:'+pair.drawing.wire.id,kind:'connection_conflict',
    addresses:[pair.drawing.from!,pair.drawing.to!].map(p=>componentAddress(p.owner.page,p.owner.component)),
    label:pair.drawing.wire.id,details:conflicts.join(', '),wireIds:[pair.drawing.wire.id,pair.logical.wire.id],
  });
  }
  for(const page of project.pages)for(const cable of page.cables??[])if(
    Number.isInteger(cable.coreCount)&&cable.coreCount!==cable.cores.length
  )issues.push({id:'cable:'+JSON.stringify([page.id,cable.id]),kind:'cable_core_count',addresses:[],
    label:cable.bmk||cable.id,details:cable.coreCount+' / '+cable.cores.length,cableId:cable.id,pageId:page.id});
  const preview = {
    schema:'schematico-import-cleanup-preview' as const,version:1 as const,
    projectId:project.id,profile,before:metrics(project),after:metrics(interpreted,connectionRows.length),roles,assignedPlacements,
    source:{pages:project.pages.length,placements:index.components.length,
      drawnWires:project.pages.reduce((n,p)=>n+p.wires.length,0),logicalConnections:project.logicalConnections?.length??0,
      cabinets:project.cabinetLayouts?.length??0,cabinetItems:project.cabinetLayouts?.reduce((n,b)=>n+b.items.length,0)??0},
    representationPairs:pairs.length,issues,
    terminalStructure: structured?.preview as TerminalStructurePreview | undefined,
  };
  return { project: interpreted, preview };
}
export function importCleanupPreview(project: Project, input = cleanupDefaults, options: ImportCleanupOptions = {}) {
  return calculateCleanup(project, input, options).preview;
}
export type ImportCleanupPreview = ReturnType<typeof importCleanupPreview>;

/** The profile and optional evidenced terminal metadata change. Source symbols,
 * geometry, pins, articles, routes and cabinet data remain intact. */
export class ImportCleanupPlan {
  readonly #base: string;
  readonly #next: Project;
  readonly preview: ImportCleanupPreview;
  constructor(project: Project, profile = cleanupDefaults, options: ImportCleanupOptions = {}) {
    this.#base=projectRevision(project);
    const result=calculateCleanup(project,profile,options);
    this.#next=structuredClone(result.project);
    this.preview=result.preview;
  }
  apply(current: Project): Project {
    if(projectRevision(current)!==this.#base)throw Error('articlesProjectStale');
    const next=structuredClone(this.#next);
    next.activePageId=current.activePageId;
    next.modified=new Date().toISOString();
    return next;
  }
}
