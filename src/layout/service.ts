import {sessionDiagnostics} from '../ai/SessionDiagnostics';
import {unverifiedAutoconnections} from './autoconnectPolicy';
import {projectWithPages} from './multipage';
import {pinStub} from './router';
import {union} from './rect';
import { alignBusInlet, markLayoutAutoconnections } from './draftConnections';
import { runLayoutWorker } from './WorkerClient';
import { applyMultiPage } from './multipage';
import { suggestSplit } from './split';
import { CrossReferenceEngine } from '../model/CrossReferenceEngine';
import type { Project, Page } from '../model/types';
import { getDrawingUnitsPerMm } from '../model/symbols';
import { snapshotPage } from './geometry';
import { validateLayout } from './validate';
import {
  clone,
  projectRevision,
  topology,
  type LayoutOptions,
  type LayoutPreview,
  type LayoutSolution,
  type LayoutCandidate,
  type LayoutSnapshot,
} from './types';
export async function computeSolutions(
  snapshot: LayoutSnapshot,
  signal?: AbortSignal,
): Promise<LayoutSolution[]> {
  if (signal?.aborted) throw new Error('Ausführung durch Benutzer abgebrochen.');
  if (typeof Worker === 'undefined' || (!snapshot.nodes.length && !snapshot.frames.length)) {
    const { solveLayouts } = await import('./engine');
    return solveLayouts(snapshot);
  }
  const worker = new Worker(new URL('./LayoutWorker.ts', import.meta.url), {
    type: 'module',
  });
  return runLayoutWorker(worker, snapshot, 15000, signal);
}
export async function previewLayout(
  project: Project,
  pageId: string,
  options: LayoutOptions = {},
  draft?: Project,
): Promise<LayoutPreview> {
  if (options.abortSignal?.aborted) throw new Error('Ausführung durch Benutzer abgebrochen.');
  sessionDiagnostics.record('layout_request',{pageId,options});
  sessionDiagnostics.record('layout_input_project',draft??project);
  if (typeof document !== 'undefined') await document.fonts.ready;
  const target = clone(draft ?? project);
  // Generated labels must exist before placement/routing, not appear only in final validation.
  CrossReferenceEngine.updateProjectCrossReferences(target);
  const page = target.pages.find((p) => p.id === pageId);
  if (!page) throw new Error('Seite nicht gefunden.');
  if (page.floorPlan || page.pageType !== 'schematic')
    throw new Error('Layout ist nur für Stromlaufplanseiten verfügbar.');
  // No spatial containment can be inferred from a coordinate-free draft. Keep the library
  // frames at their original size unless the caller supplied explicit container membership.
  if (
    !Object.keys(options.containerMembers ?? page.layoutConstraints?.containerMembers ?? {}).length &&
    page.components.length &&
    page.components.every((c) => c.x === 0 && c.y === 0)
  ) {
    const fixedFrameIds = page.components
      .filter((c) => c.deviceBox)
      .map((c) => c.id);
    if (fixedFrameIds.length)
      page.layoutConstraints = { ...page.layoutConstraints, fixedFrameIds };
  }
  if (
    !page.layoutConstraints?.draftPreparation &&
    page.layoutConstraints?.preferAutoconnect &&
    page.components.length &&
    page.components.every((c) => c.x === 0 && c.y === 0)
  ) {
    const { prepareSocketDistribution } = await import('./socketDistribution');
    const devIds = new Set(page.components.map((c) => c.id));
    const wireIds = new Set(page.wires.map((w) => w.id));
    prepareSocketDistribution(target, page, devIds, wireIds, (d) => {
      page.layoutConstraints = {
        ...page.layoutConstraints,
        draftPreparation: d,
      };
    });
  }
  const input = snapshotPage(page, target, options),
    before = validateLayout(
      draft
        ? snapshotPage(
            project.pages.find((p) => p.id === pageId)!,
            project,
            options,
          )
        : input,
    ),
    base = projectRevision(project),
    candidates: LayoutCandidate[] = [];
  // Imported, already aligned drawings should not be expanded into a new graph
  // merely to repair label positions. Keep cables and every physical contact.
  if(topology(target)===topology(project) && page.components.length && page.components.some(c=>c.x!==0||c.y!==0) && input.edges.length &&
      !before.issues.some(i=>i.severity==='error'&&!['text_overlap','wire_obstacle','sheet_overflow','group_overflow'].includes(i.type))){
    const {repairExistingLabels}=await import('./labelRepair');
    const repaired=await repairExistingLabels(target,pageId,options),next=repaired.project.pages.find(p=>p.id===pageId)!;
    markLayoutAutoconnections(repaired.project,next);
    if(repaired.report.valid&&!unverifiedAutoconnections(repaired.project,next).length&&topology(repaired.project)===topology(target)){
      next.connectionMode='explicit';
      next.layoutConstraints={...next.layoutConstraints,protectedComponentIds:next.components.map(c=>c.id)};
      const candidate:LayoutCandidate={id:'layout-label-repair',base,pageId,page:next,profile:'minimal_change',report:repaired.report,autoconnectRequired:true};
      sessionDiagnostics.record('layout_label_repair',{pageId,report:repaired.report});
      sessionDiagnostics.record('layout_candidate',candidate);
      return {pageId,before,status:'preview_ready',issues:[],candidates:[candidate]};
    }
  }
  // A construction grammar may already have produced a completely checked,
  // pin-aligned draft. Preserve that solution before generic graph placement.
  let preparedReport;
  if(draft || page.layoutConstraints?.draftPreparation?.status === 'applied'){
    const prepared=clone(page);
    for(const wire of prepared.wires)wire.isAutoconnect=false;
    markLayoutAutoconnections(target,prepared);
    if(input.edges.length>0 && prepared.wires.every(w=>w.isAutoconnect && !w.waypoints?.length)){
      const report=validateLayout(input);
      if(report.valid)preparedReport=report;
    }
  }
  if(!preparedReport&&page.layoutConstraints?.preferAutoconnect){
    const u=getDrawingUnitsPerMm(target),step=input.grid.spacing/2;
    input.autoconnectSpacing=Math.ceil((4+(page.grid?page.grid.spacing/4:8)/u)/step)*step;
    for(const node of input.nodes)node.rect=union([node.rect,...node.pins.map(pin=>{
      const p=pinStub(input,pin,node.id);return {x:p.x-6,y:p.y-6,width:12,height:12};
    })]);
  }
  sessionDiagnostics.record('layout_geometry_input',input);
  if (options.abortSignal?.aborted) throw new Error('Ausführung durch Benutzer abgebrochen.');
  const skipGenericOnOverflow = Boolean(
    !preparedReport &&
      page.layoutConstraints?.preferAutoconnect &&
      ['geometry_rejected', 'object_limit', 'autoconnect_unavailable', 'existing_content'].includes(
        page.layoutConstraints?.draftPreparation?.code ?? '',
      ),
  );
  const solutions:LayoutSolution[] = preparedReport
    ? [{profile:'structured',snapshot:input,report:preparedReport}]
    : skipGenericOnOverflow
      ? []
      : await computeSolutions(input, options.abortSignal);
  if (options.abortSignal?.aborted) throw new Error('Ausführung durch Benutzer abgebrochen.');
  // Optional connector reservations must not alone force extra sheets.
  // The route compiler will still independently validate every inserted glyph.
  if(!solutions.some(s=>s.report.valid)&&input.autoconnectSpacing&&!skipGenericOnOverflow){
    const compact=await computeSolutions(snapshotPage(page,target,options), options.abortSignal);
    solutions.push(...compact);
  }
  const rejections: LayoutPreview['issues'] = [];
  for (const solution of solutions) {
    if (options.abortSignal?.aborted) throw new Error('Ausführung durch Benutzer abgebrochen.');
    if (!solution.report.valid) continue;
    const next = clone(page),
      u = getDrawingUnitsPerMm(target);
    for (const n of solution.snapshot.nodes) {
      const old = input.nodes.find((o) => o.id === n.id)!,
        dx = (n.origin.x - old.origin.x) * u,
        dy = (n.origin.y - old.origin.y) * u;
      if (n.kind === 'component') {
        const c = next.components.find((c) => c.id === n.id)!;
        c.x += dx;
        c.y += dy;
      } else if (n.kind === 'text') {
        const t = next.texts!.find((t) => t.id === n.id)!;
        t.x += dx;
        t.y += dy;
      } else if (n.kind === 'image') {
        const t = next.images!.find((t) => t.id === n.id)!;
        t.x += dx;
        t.y += dy;
      } else {
        const t = next.cables!.find((t) => t.id === n.id)!;
        t.start.x += dx;
        t.start.y += dy;
        t.end.x += dx;
        t.end.y += dy;
      }
    }
    for (const f of solution.snapshot.frames) {
      if (f.fixed || f.kind === 'group') continue;
      if (f.kind === 'component') {
        const c = next.components.find((c) => c.id === f.id)!;
        const w = (c.rotation % 180 ? f.rect.height : f.rect.width) * u,
          h = (c.rotation % 180 ? f.rect.width : f.rect.height) * u;
        c.x = (f.rect.x + f.rect.width / 2) * u - w / 2;
        c.y = (f.rect.y + f.rect.height / 2) * u - h / 2;
        c.deviceBox!.width = w;
        c.deviceBox!.height = h;
      } else {
        const b = next.boxes!.find((b) => b.id === f.id)!;
        b.x = f.rect.x * u;
        b.y = f.rect.y * u;
        b.width = f.rect.width * u;
        b.height = f.rect.height * u;
      }
    }
    for (const edge of solution.snapshot.edges) {
      const wire = next.wires.find((w) => w.id === edge.id)!;
      wire.waypoints = edge.points
        .slice(1, -1)
        .map((p) => ({ x: p.x * u, y: p.y * u }));
      wire.isAutoconnect = false;
      wire.routingMode = 'auto';
    }
    next.connectionMode = 'explicit';
    next.layoutConstraints = {
      ...next.layoutConstraints,
      draftPreparation:draft ? next.layoutConstraints?.draftPreparation : undefined,
      protectedComponentIds: next.components.map(c => c.id),
      lockedIds: options.lockedIds ?? next.layoutConstraints?.lockedIds,
      containerMembers: Object.fromEntries(
        input.frames
          .filter((f) => f.kind !== 'group')
          .map((f) => [f.id, f.members]),
      ),
    };
    const copy = clone(target);
    copy.pages[copy.pages.findIndex((p) => p.id === pageId)] = next;
    if(!input.nodes.some(n=>n.fixed)&&!input.frames.some(f=>f.fixed)){
      const saved=clone(next);
      if(alignBusInlet(copy,next)&&!validateLayout(snapshotPage(next,copy,options)).valid)Object.assign(next,saved);
    }
    markLayoutAutoconnections(copy,next);
    CrossReferenceEngine.updateProjectCrossReferences(copy);
    const finalSnapshot = snapshotPage(next, copy, options);
    const report = validateLayout(finalSnapshot);
    sessionDiagnostics.record('layout_candidate_geometry',{profile:solution.profile,snapshot:finalSnapshot,report});
    report.issues.push(...solution.report.issues.filter(i=>i.type==='layout_timeout'&&i.severity==='warning'));
    report.metrics.displacement = finalSnapshot.nodes.reduce((sum,n)=>{
      const original=input.nodes.find(o=>o.id===n.id)!;
      return sum+Math.abs(n.origin.x-original.origin.x)+Math.abs(n.origin.y-original.origin.y);
    },0);
    if (topology(copy) !== topology(target))
      report.issues.push({
        type: 'topology_changed',
        severity: 'error',
        objectIds: [pageId],
        message: 'Elektrische Struktur oder Gruppen wurden verändert.',
      });
    report.valid = !report.issues.some((i) => i.severity === 'error');
    if (!report.valid) rejections.push(...report.issues);
    if (report.valid)
      candidates.push({
        id: `layout-${solution.profile}`,
        base,
        pageId,
        page: next,
        report,
        profile: solution.profile,
      });
  }
  const hasPureAutoconnect = candidates.some(
    (c) => c.profile === 'structured' || c.page.wires.every((w) => w.isAutoconnect),
  );
  if (
    (!candidates.length || (page.layoutConstraints?.preferAutoconnect && !hasPureAutoconnect)) &&
    options.multiPage !== false &&
    !options.abortSignal?.aborted &&
    !input.issues.some((i) => i.severity === 'error')
  ) {
    const { multiPageCandidate, multiPageBlockReason } = await import('./multipage');
    const reason = multiPageBlockReason(target.pages.find(p => p.id === pageId)!, options);
    if (reason) rejections.push({ type: 'multi_page_unavailable', severity: 'warning', objectIds: [pageId], message: reason });
    const multi = await multiPageCandidate(project, target, pageId, options);
    if (multi) candidates.unshift(multi);
  }
  // A warning about an unavailable fallback must not hide why placement failed.
  const failures = [
    ...solutions.filter(s=>!s.report.valid).flatMap(s=>s.report.issues),
    ...(page.layoutConstraints?.draftPreparation?.issues ?? []),
    ...rejections,
  ];
  const issues = candidates.length ? [] : failures.length
    ? failures.filter((issue,index)=>failures.findIndex(other=>other.type===issue.type&&other.message===issue.message&&JSON.stringify(other.objectIds)===JSON.stringify(issue.objectIds))===index)
    : before.issues;
  const effectivePreparation = draft
    ? page.layoutConstraints?.draftPreparation?.code === 'geometry_rejected' &&
      candidates[0]?.multiPage?.pages.every((p) => p.layoutConstraints?.draftPreparation?.status === 'applied')
      ? candidates[0].multiPage.pages[0].layoutConstraints?.draftPreparation
      : page.layoutConstraints?.draftPreparation
    : undefined;
  sessionDiagnostics.record('layout_report',{pageId,preparation:effectivePreparation,before,issues,rejectedAttempts:solutions.filter(s=>!s.report.valid).map(s=>({profile:s.profile,report:s.report})),storedModelRejections:rejections,candidates:candidates.map(c=>({id:c.id,profile:c.profile,report:c.report,multiPage:c.multiPage?{pages:c.multiPage.pages.map(p=>({id:p.id,title:p.title})),links:c.multiPage.links}:undefined}))});
  for(const candidate of candidates)sessionDiagnostics.record('layout_candidate',candidate);
  return {
    pageId,
    preparation: effectivePreparation,
    status: candidates.length ? 'preview_ready' : 'layout_invalid',
    before,
    candidates,
    issues,
    ...(!candidates.length
      ? { splitSuggestion: suggestSplit(input, solutions) }
      : {}),
  };
}
/** Only called by the user's preview confirmation; never exposed as an automatic AI mutation. */
export function applyLayout(
  project: Project,
  candidate: LayoutCandidate,
  draft?: Project,
): void {
  if (candidate.base !== projectRevision(project))
    throw new Error(
      'Das Projekt wurde seit der Vorschau verändert. Layout neu berechnen.',
    );
  if(candidate.autoconnectRequired){
    const context=candidate.multiPage?projectWithPages(draft??project,candidate.pageId,candidate.multiPage):(draft??project);
    if((candidate.multiPage?.pages??[candidate.page]).some(p=>unverifiedAutoconnections(context,p).length))
      throw new Error('Übernahme gesperrt: Alle Verbindungen müssen durch Autoconnect bestätigt sein.');
  }
  if (candidate.multiPage) {
    applyMultiPage(project, candidate, draft);
    sessionDiagnostics.record('layout_applied',{candidateId:candidate.id,pageIds:candidate.multiPage.pages.map(p=>p.id)});
    return;
  }
  const target = draft ?? project,
    copy = clone(target),
    index = copy.pages.findIndex((p) => p.id === candidate.pageId);
  if (index < 0) throw new Error('Seite fehlt.');
  copy.pages[index] = clone(candidate.page);
  CrossReferenceEngine.updateProjectCrossReferences(copy);
  const report = validateLayout(snapshotPage(copy.pages[index], copy));
  if (!report.valid || topology(copy) !== topology(target))
    throw new Error(
      'Layoutprüfung fehlgeschlagen; es wurden keine Änderungen übernommen.',
    );
  Object.assign(project, copy);
  sessionDiagnostics.record('layout_applied',{candidateId:candidate.id,pageId:candidate.pageId});
}
