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
): Promise<LayoutSolution[]> {
  if (typeof Worker === 'undefined') {
    const { solveLayouts } = await import('./engine');
    return solveLayouts(snapshot);
  }
  const worker = new Worker(new URL('./LayoutWorker.ts', import.meta.url), {
    type: 'module',
  });
  return new Promise((resolve, reject) => {
    const finish = (solutions?: LayoutSolution[], error?: string) => {
      clearTimeout(timer);
      worker.terminate();
      if (solutions) resolve(solutions);
      else reject(new Error(error));
    };
    const timer = setTimeout(
      () =>
        finish(
          undefined,
          'Layout-Zeitlimit von 15 Sekunden überschritten. Es wurden keine Änderungen übernommen.',
        ),
      15000,
    );
    worker.onmessage = (e) => finish(e.data.solutions, e.data.error);
    worker.onerror = () => finish(undefined, 'Layout-Worker fehlgeschlagen.');
    worker.onmessageerror = () =>
      finish(undefined, 'Layoutdaten konnten nicht übertragen werden.');
    try {
      worker.postMessage(snapshot);
    } catch (e) {
      finish(undefined, String(e));
    }
  });
}
export async function previewLayout(
  project: Project,
  pageId: string,
  options: LayoutOptions = {},
  draft?: Project,
): Promise<LayoutPreview> {
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
  const solutions = await computeSolutions(input),
    rejections: LayoutPreview['issues'] = [];
  for (const solution of solutions) {
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
    }
    next.connectionMode = 'explicit';
    next.layoutConstraints = {
      ...next.layoutConstraints,
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
    CrossReferenceEngine.updateProjectCrossReferences(copy);
    const report = validateLayout(snapshotPage(next, copy, options));
    report.metrics.displacement = solution.report.metrics.displacement;
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
  if (
    !candidates.length &&
    options.multiPage !== false &&
    !input.issues.some((i) => i.severity === 'error')
  ) {
    const { multiPageCandidate } = await import('./multipage');
    const multi = await multiPageCandidate(project, target, pageId, options);
    if (multi) candidates.push(multi);
  }
  const issues = candidates.length
    ? []
    : rejections.length
      ? rejections
      : (solutions[0]?.report.issues ?? before.issues);
  return {
    pageId,
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
  if (candidate.multiPage) {
    applyMultiPage(project, candidate, draft);
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
}
