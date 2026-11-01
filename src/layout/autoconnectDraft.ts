import {sessionDiagnostics} from '../ai/SessionDiagnostics';
import type {Project, Wire} from '../model/types';
import {clone,type LayoutPreview,type LayoutCandidate,type LayoutReport} from './types';
import {snapshotPage} from './geometry';
import {validateLayout} from './validate';
import {constructAutoconnectRoutes,contactPartition,type ConnectionConstruction} from './autoconnectRoutes';
import {auditMultiPage,projectWithPages} from './multipage';
import {unverifiedAutoconnections} from './autoconnectPolicy';

/** Lower a checked drawing into editable library connection pieces before it
 * becomes the immutable draft against which Apply is audited. Required mode
 * also covers existing pages and rejects partially compiled proposals. */
export function preferDraftAutoconnect(project:Project,draft:Project,preview:LayoutPreview,required=false) {
  const source=project.pages.find(p=>p.id===preview.pageId);
  if(!source||preview.status!=='preview_ready'||!required&&(source.components.length||source.wires.length||draft.pages.find(p=>p.id===preview.pageId)?.layoutConstraints?.draftPreparation?.status==='disabled'))return {draft,preview};
  const prepared:{draft:Project;candidate:LayoutCandidate;construction:ConnectionConstruction}[]=[];
  for(const candidate of preview.candidates){
    let work=clone(draft),next=clone(candidate);
    const construction:ConnectionConstruction={status:'complete',autoconnect:0,routed:0,addedSymbols:0,convertedNets:0,issues:[]};
    const merge=(report:ConnectionConstruction)=>{
      construction.autoconnect+=report.autoconnect;construction.routed+=report.routed;construction.addedSymbols+=report.addedSymbols;construction.convertedNets+=report.convertedNets;construction.issues.push(...report.issues);
    };
    if(!next.multiPage){
      work.pages[work.pages.findIndex(p=>p.id===next.pageId)]=next.page;
      const built=constructAutoconnectRoutes(work,next.pageId);work=built.project;merge(built.report);
      next.page=work.pages.find(p=>p.id===next.pageId)!;next.report=validateLayout(snapshotPage(next.page,work));
    }else{
      // Page-link wires retain their exact audited endpoints. Local nets can be
      // lowered independently, then folded back into the virtual source draft.
      const multi=next.multiPage,virtual=work.pages.find(p=>p.id===next.pageId)!;
      const originals=new Set(virtual.components.map(c=>c.id)),partition=contactPartition(snapshotPage(virtual,work),originals);
      let expanded=projectWithPages(work,next.pageId,multi);
      for(let i=0;i<multi.pages.length;i++){
        const p=multi.pages[i];
        const blocked=new Set(p.wires.filter(w=>!originals.has(w.from.componentId)||!originals.has(w.to.componentId)).map(w=>w.id));
        const built=constructAutoconnectRoutes(expanded,p.id,blocked);merge(built.report);expanded=built.project;
        const newPage=expanded.pages.find(q=>q.id===p.id)!;
        if(built.added.size||built.replaced.size){
          const oldIds=new Set(p.wires.map(w=>w.id));
          virtual.components.push(...clone(newPage.components.filter(c=>built.added.has(c.id))));
          virtual.wires=virtual.wires.filter(w=>!built.replaced.has(w.id)).concat(clone(newPage.wires.filter(w=>built.replaced.has(w.id)||!oldIds.has(w.id))));
          for(const group of newPage.groups??[]){const g=virtual.groups?.find(g=>g.id===group.id);if(g)g.members=clone(group.members);}
        }
        multi.pages[i]=clone(newPage);
      }
      if(contactPartition(snapshotPage(virtual,work),originals)!==partition)continue;
      try{auditMultiPage(work,next.pageId,multi);}catch{continue;}
      next.page=multi.pages[0];
      const reports=multi.pages.map(p=>validateLayout(snapshotPage(p,expanded)));
      const metrics={...reports[0].metrics};for(const k of Object.keys(metrics) as (keyof LayoutReport['metrics'])[])metrics[k]=reports.reduce((sum,r)=>sum+r.metrics[k],0);
      next.report={valid:reports.every(r=>r.valid),issues:reports.flatMap(r=>r.issues),metrics};
    }
    construction.status=construction.routed?'partial':'complete';construction.issues=construction.issues.slice(0,40);
    sessionDiagnostics.record('autoconnect_construction',{candidateId:next.id,...construction});
    if(next.report.valid)prepared.push({draft:work,candidate:next,construction});
  }
  // Prefer fewer manual sections, then fewer bends/crossings. This is based on
  // the actual detector and independent validator, never on model assertions.
  prepared.sort((a,b)=>a.construction.routed-b.construction.routed||a.candidate.report.metrics.bends-b.candidate.report.metrics.bends||a.candidate.report.metrics.crossings-b.candidate.report.metrics.crossings);
  const best=prepared.find(p=>{
    if(!required)return true;
    if(!p.candidate.multiPage){
      return p.construction.routed===0&&!unverifiedAutoconnections(p.draft,p.candidate.page).length;
    }
    const virtual=p.draft.pages.find(pg=>pg.id===p.candidate.pageId);
    const originals=virtual?new Set(virtual.components.map(c=>c.id)):new Set<string>();
    const isLocalWire=(w:Wire)=>originals.has(w.from.componentId)&&originals.has(w.to.componentId);
    const localRouted=p.candidate.multiPage.pages.flatMap(pg=>pg.wires).filter(w=>isLocalWire(w)&&!w.isAutoconnect).length;
    const localUnverified=p.candidate.multiPage.pages.some(pg=>unverifiedAutoconnections(p.draft,pg).filter(id=>{
      const w=pg.wires.find(wire=>wire.id===id);
      return w&&isLocalWire(w);
    }).length>0);
    return localRouted===0&&!localUnverified;
  });
  if(required&&!best){
    const partial=prepared[0]?.construction;
    const issues=[{type:'autoconnect_required',severity:'error' as const,objectIds:[preview.pageId],message:'Kein vollständig mit Autoconnect aufgebautes Layout gefunden. Geroutete Restverbindungen werden nicht übernommen.'},...(partial?.issues??[])];
    sessionDiagnostics.record('autoconnect_required_rejection',{pageId:preview.pageId,issues,construction:partial});
    return {draft,preview:{...preview,status:'layout_invalid' as const,candidates:[],issues,connectionConstruction:partial}};
  }
  if(!best)return {draft,preview};
  if(required)best.candidate.autoconnectRequired=true;
  best.candidate.report.metrics.displacement=preview.candidates.find(c=>c.id===best.candidate.id)!.report.metrics.displacement;
  sessionDiagnostics.record('autoconnect_candidate',{candidate:best.candidate,construction:best.construction});
  return {draft:best.draft,preview:{...preview,candidates:[best.candidate],connectionConstruction:best.construction}};
}
