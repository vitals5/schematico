import {sessionDiagnostics} from '../ai/SessionDiagnostics';
import type {Project} from '../model/types';
import {clone,type LayoutPreview,type LayoutCandidate,type LayoutReport} from './types';
import {snapshotPage} from './geometry';
import {validateLayout} from './validate';
import {constructAutoconnectRoutes,contactPartition,type ConnectionConstruction} from './autoconnectRoutes';
import {auditMultiPage,projectWithPages} from './multipage';

/** Lower a checked, newly generated drawing into editable library connection
 * pieces before it becomes the immutable draft against which Apply is audited. */
export function preferDraftAutoconnect(project:Project,draft:Project,preview:LayoutPreview) {
  const source=project.pages.find(p=>p.id===preview.pageId);
  if(!source||source.components.length||source.wires.length||preview.status!=='preview_ready'||draft.pages.find(p=>p.id===preview.pageId)?.layoutConstraints?.draftPreparation?.status==='disabled')return {draft,preview};
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
  const best=prepared[0];
  if(!best)return {draft,preview};
  best.candidate.report.metrics.displacement=preview.candidates.find(c=>c.id===best.candidate.id)!.report.metrics.displacement;
  sessionDiagnostics.record('autoconnect_candidate',{candidate:best.candidate,construction:best.construction});
  return {draft:best.draft,preview:{...preview,candidates:[best.candidate],connectionConstruction:best.construction}};
}
