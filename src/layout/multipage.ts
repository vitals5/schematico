import type { Project, Page, Wire, PlacedComponent } from '../model/types';
import { getSymbolById, getSymbolForComponent } from '../model/symbols';
import { CrossReferenceEngine } from '../model/CrossReferenceEngine';
import {
  clone,
  projectRevision,
  type LayoutCandidate,
  type LayoutOptions,
} from './types';
import { previewLayout } from './service';
import { validateLayout } from './validate';
import { snapshotPage } from './geometry';
export interface PageLink {
  wire: Wire;
  fromArrowId: string;
  toArrowId: string;
  name: string;
}
export interface MultiPageLayout {
  pages: Page[];
  links: PageLink[];
}
function partitionBlocks(page: Page): string[][] {
  const parent = new Map(page.components.map((c) => [c.id, c.id]));
  const root = (id: string): string =>
    parent.get(id) === id ? id : root(parent.get(id)!);
  const members = (id: string, seen = new Set<string>()): string[] => {
    if (seen.has(id)) throw new Error('Zyklische Gruppe.');
    if (parent.has(id)) return [id];
    const wire = page.wires.find((w) => w.id === id);
    if (wire) return [wire.from.componentId, wire.to.componentId];
    const group = page.groups?.find((g) => g.id === id);
    if (!group) throw new Error('Unbekanntes Gruppenmitglied.');
    return group.members.flatMap((m) => members(m.id, new Set([...seen, id])));
  };
  for (const group of page.groups ?? []) {
    const ids = members(group.id);
    for (const id of ids.slice(1)) parent.set(root(id), root(ids[0]));
  }
  const blocks = new Map<string, string[]>();
  for (const c of page.components)
    blocks.set(root(c.id), [...(blocks.get(root(c.id)) ?? []), c.id]);
  return [...blocks.values()].sort(
    (a, b) => b.length - a.length || a[0].localeCompare(b[0]),
  );
}
function buildPages(
  project: Project,
  source: Page,
  bins: string[][],
): MultiPageLayout {
  const allocated = new Set(
    project.pages.flatMap((p) => [
      p.id,
      ...p.components.map((c) => c.id),
      ...p.wires.map((w) => w.id),
      ...(p.groups ?? []).map((g) => g.id),
    ]),
  );
  const fresh = (base: string) => {
    let id = base,
      suffix = 2;
    while (allocated.has(id)) id = `${base}-${suffix++}`;
    allocated.add(id);
    return id;
  };
  const occupied = new Set(
    project.pages
      .filter((p) => p.id !== source.id)
      .map((p) => `${p.higherLevel}|${p.location}|${p.pageNumber}`),
  );
  const pages = bins.map((ids, i) => {
    const p = clone(source);
    p.id = i === 0 ? source.id : fresh(`layout-page-${source.id}-${i + 1}`);
    if (i) {
      let n = 2;
      while (
        occupied.has(`${p.higherLevel}|${p.location}|${source.pageNumber}-${n}`)
      )
        n++;
      p.pageNumber = `${source.pageNumber}-${n}`;
    }
    occupied.add(`${p.higherLevel}|${p.location}|${p.pageNumber}`);
    p.title = `${source.title} · ${i + 1}/${bins.length}`;
    p.plotFrame.titleBlock.sheetNumber = p.pageNumber;
    p.components = p.components.filter((c) => ids.includes(c.id));
    p.wires = [];
    p.layoutConstraints = source.layoutConstraints
      ? {
          ...clone(source.layoutConstraints),
          fixedFrameIds: source.layoutConstraints.fixedFrameIds?.filter((id) =>
            ids.includes(id),
          ),
          containerMembers: Object.fromEntries(
            Object.entries(
              source.layoutConstraints.containerMembers ?? {},
            ).filter(([id]) => ids.includes(id)),
          ),
        }
      : undefined;
    p.suppressedAutoconnections = undefined;
    p.connectionMode = 'explicit';
    return p;
  });
  const owner = new Map(
    pages.flatMap((p) => p.components.map((c) => [c.id, p] as const)),
  );
  let token = 1;
  while (
    project.pages.some((p) =>
      p.components.some(
        (c) =>
          c.bmk.startsWith(`MP${token}.`) ||
          c.functionText.startsWith(`MP${token}.`),
      ),
    )
  )
    token++;
  const links: PageLink[] = [];
  const addArrow = (
    page: Page,
    id: string,
    name: string,
    right: boolean,
  ): PlacedComponent => {
    const symbol = getSymbolById(
      right ? 'potential_arrow_right' : 'potential_arrow_left',
      project,
    )!;
    const c: PlacedComponent = {
      id,
      symbolId: symbol.id,
      bmk: name,
      functionText: name,
      x: 0,
      y: 0,
      rotation: 0,
      higherLevelFunction: source.higherLevel,
      mountingLocation: source.location,
      pins: Object.fromEntries(symbol.pins.map((p) => [p.id, { wireIds: [] }])),
    };
    page.components.push(c);
    return c;
  };
  for (const wire of source.wires) {
    const a = owner.get(wire.from.componentId)!,
      b = owner.get(wire.to.componentId)!;
    if (a === b) {
      a.wires.push(clone(wire));
      continue;
    }
    const name = `MP${token}.${links.length + 1}`,
      fromArrowId = fresh(`layout-arrow-${source.id}-${wire.id}-from`),
      toArrowId = fresh(`layout-arrow-${source.id}-${wire.id}-to`);
    addArrow(a, fromArrowId, name, true);
    addArrow(b, toArrowId, name, false);
    a.wires.push({
      ...clone(wire),
      to: { componentId: fromArrowId, pinId: '1' },
      waypoints: [],
      isAutoconnect: false,
    });
    b.wires.push({
      ...clone(wire),
      id: fresh(wire.id + '-layout-' + token),
      from: { componentId: toArrowId, pinId: '1' },
      waypoints: [],
      isAutoconnect: false,
    });
    links.push({ wire: clone(wire), fromArrowId, toArrowId, name });
  }
  const groupOwner = (id: string): Page | undefined => {
    const g = source.groups?.find((g) => g.id === id);
    for (const m of g?.members ?? []) {
      const page =
        owner.get(m.id) ??
        pages.find((p) => p.wires.some((w) => w.id === m.id)) ??
        (m.kind === 'group' ? groupOwner(m.id) : undefined);
      if (page) return page;
    }
    return undefined;
  };
  for (const p of pages) {
    p.groups = clone(
      (source.groups ?? []).filter((g) => (groupOwner(g.id) ?? pages[0]) === p),
    );
    for (const c of p.components)
      for (const [id, pin] of Object.entries(c.pins))
        pin.wireIds = p.wires
          .filter(
            (w) =>
              (w.from.componentId === c.id && w.from.pinId === id) ||
              (w.to.componentId === c.id && w.to.pinId === id),
          )
          .map((w) => w.id);
  }
  return { pages, links };
}
export function projectWithPages(
  project: Project,
  sourceId: string,
  multi: MultiPageLayout,
): Project {
  const copy = clone(project),
    index = copy.pages.findIndex((p) => p.id === sourceId);
  if (index < 0) throw new Error('Ausgangsseite fehlt.');
  copy.pages.splice(index, 1, ...clone(multi.pages));
  const used = new Set((copy.logicalConnections ?? []).map((w) => w.id));
  for (const link of multi.links) {
    const id = 'layout-logical-' + link.fromArrowId;
    if (used.has(id)) throw new Error('Doppelte Verbindungs-ID.');
    (copy.logicalConnections ??= []).push({
      ...clone(link.wire),
      id,
      waypoints: [],
      isAutoconnect: false,
    });
  }
  for (const p of copy.pages)
    p.plotFrame.titleBlock.totalSheets = String(copy.pages.length);
  CrossReferenceEngine.updateProjectCrossReferences(copy);
  return copy;
}
/** Audit every original endpoint and wire; new arrows are the only permitted additions. */
export function auditMultiPage(
  project: Project,
  sourceId: string,
  multi: MultiPageLayout,
): void {
  const source = project.pages.find((p) => p.id === sourceId)!;
  if (!source || !multi.pages.length || multi.pages.length > 12)
    throw new Error('Ungültiger Mehrseitenvorschlag.');
  const pageNumbers = new Set<string>();
  for (const p of multi.pages) {
    const key = `${p.higherLevel}|${p.location}|${p.pageNumber}`;
    if (
      pageNumbers.has(key) ||
      project.pages.some(
        (q) =>
          q.id !== sourceId &&
          `${q.higherLevel}|${q.location}|${q.pageNumber}` === key,
      )
    )
      throw new Error('Blattnummer bereits belegt.');
    pageNumbers.add(key);
    if (
      p.plotFrame.width !== source.plotFrame.width ||
      p.plotFrame.height !== source.plotFrame.height ||
      p.higherLevel !== source.higherLevel ||
      p.location !== source.location ||
      p.floorPlan ||
      p.importedDrawing ||
      p.texts?.length ||
      p.images?.length ||
      p.boxes?.length ||
      p.cables?.length
    )
      throw new Error('Blattinhalt oder Format verändert.');
  }

  const components = multi.pages.flatMap((p) => p.components),
    wires = multi.pages.flatMap((p) => p.wires);
  const original = new Set(source.components.map((c) => c.id));
  const arrowIds = new Set(
    multi.links.flatMap((l) => [l.fromArrowId, l.toArrowId]),
  );
  const fixedFrames = new Set(
    multi.pages.flatMap((p) => p.layoutConstraints?.fixedFrameIds ?? []),
  );
  const signature = (c: PlacedComponent) => {
    const x = clone(c);
    delete (x as any).x;
    delete (x as any).y;
    delete x.crossRef;
    if (x.deviceBox && !fixedFrames.has(x.id)) {
      delete (x.deviceBox as any).width;
      delete (x.deviceBox as any).height;
    }
    for (const pin of Object.values(x.pins)) delete pin.wireIds;
    return JSON.stringify(x);
  };
  if (
    new Set(components.map((c) => c.id)).size !== components.length ||
    components.length !== original.size + arrowIds.size
  )
    throw new Error('Objektbestand verändert.');
  for (const c of source.components)
    if (signature(c) !== signature(components.find((x) => x.id === c.id)!))
      throw new Error('Betriebsmittel verändert.');
  if (
    new Set(multi.pages.map((p) => p.id)).size !== multi.pages.length ||
    multi.pages[0]?.id !== sourceId ||
    multi.pages.slice(1).some((p) => project.pages.some((q) => p.id === q.id))
  )
    throw new Error('Blatt-IDs verändert.');
  if (
    multi.links.some(
      (l, i) => multi.links.findIndex((x) => x.wire.id === l.wire.id) !== i,
    )
  )
    throw new Error('Verbindung doppelt aufgeteilt.');
  const endpoint = (p: Wire['from']) => JSON.stringify(p);
  const attributes = (w: Wire) => {
    const { id, from, to, waypoints, isAutoconnect, ...rest } = w;
    return JSON.stringify(rest);
  };
  const same = (a: Wire, b: Wire) =>
    attributes(a) === attributes(b) &&
    endpoint(a.from) === endpoint(b.from) &&
    endpoint(a.to) === endpoint(b.to);
  const claimed = new Set<string>();
  for (const w of source.wires) {
    const link = multi.links.find((l) => l.wire.id === w.id);
    if (!link) {
      const found = wires.find((x) => x.id === w.id);
      if (!found || !same(w, found)) throw new Error('Verbindung verändert.');
      claimed.add(found.id);
      continue;
    }
    if (!same(link.wire, w)) throw new Error('Blattverbindung verändert.');
    const a = wires.find((x) => x.id === w.id),
      b = wires.find((x) => x.from.componentId === link.toArrowId);
    if (
      !a ||
      !b ||
      attributes(a) !== attributes(w) ||
      attributes(b) !== attributes(w) ||
      endpoint(a.from) !== endpoint(w.from) ||
      a.to.componentId !== link.fromArrowId ||
      a.to.pinId !== '1' ||
      b.from.pinId !== '1' ||
      endpoint(b.to) !== endpoint(w.to)
    )
      throw new Error('Anschlüsse der Blattverbindung verändert.');
    for (const [id, symbol] of [
      [link.fromArrowId, 'potential_arrow_right'],
      [link.toArrowId, 'potential_arrow_left'],
    ]) {
      const c = components.find((x) => x.id === id);
      if (
        !c ||
        c.symbolId !== symbol ||
        c.bmk !== link.name ||
        c.functionText !== link.name
      )
        throw new Error('Abbruchstelle verändert.');
    }
    claimed.add(a.id);
    claimed.add(b.id);
  }
  if (
    claimed.size !== wires.length ||
    new Set(wires.map((w) => w.id)).size !== wires.length
  )
    throw new Error('Zusätzliche oder doppelte Verbindungen.');
  const groups = multi.pages.flatMap((p) => p.groups ?? []);
  if (
    JSON.stringify(groups.sort((a, b) => a.id.localeCompare(b.id))) !==
    JSON.stringify(
      clone(source.groups ?? []).sort((a, b) => a.id.localeCompare(b.id)),
    )
  )
    throw new Error('Gruppen verändert.');
  for (const p of multi.pages)
    for (const w of p.wires)
      if (
        !p.components.some((c) => c.id === w.from.componentId) ||
        !p.components.some((c) => c.id === w.to.componentId)
      )
        throw new Error('Leitung ohne lokale Anschlüsse.');
}
export async function multiPageCandidate(
  project: Project,
  target: Project,
  pageId: string,
  options: LayoutOptions,
): Promise<LayoutCandidate | undefined> {
  const source = target.pages.find((p) => p.id === pageId)!;
  if (
    options.selectedIds ||
    options.lockedIds?.length ||
    source.layoutConstraints?.lockedIds?.length ||
    source.texts?.length ||
    source.images?.length ||
    source.boxes?.length ||
    source.cables?.length ||
    source.importedDrawing
  )
    return;
  const failedInputs = new Set<string>();
  const blocks = partitionBlocks(source);
  if (blocks.length < 2) return;
  for (const count of Array.from(
    { length: Math.min(12, blocks.length) - 1 },
    (_, i) => i + 2,
  )) {
    const bins: string[][] = Array.from({ length: count }, () => []);
    for (const [index, block] of blocks.entries()) {
      if (index < count) {
        bins[index].push(...block);
        continue;
      }
      const affinity = (bin: string[]) =>
        source.wires.filter(
          (w) =>
            (block.includes(w.from.componentId) &&
              bin.includes(w.to.componentId)) ||
            (block.includes(w.to.componentId) &&
              bin.includes(w.from.componentId)),
        ).length;
      const bin = [...bins].sort(
        (a, b) => affinity(b) - affinity(a) || a.length - b.length,
      )[0];
      bin.push(...block);
    }
    const multi = buildPages(
      target,
      source,
      bins.filter((b) => b.length),
    );
    let copy = projectWithPages(target, pageId, multi),
      valid = true;
    for (const page of multi.pages) {
      const key = JSON.stringify(
        snapshotPage(
          copy.pages.find((p) => p.id === page.id)!,
          copy,
          options,
        ),
      );
      if (failedInputs.has(key)) {
        valid = false;
        break;
      }
      const preview = await previewLayout(copy, page.id, {
        ...options,
        multiPage: false,
      });
      const candidate = preview.candidates[0];
      if (!candidate) {
        failedInputs.add(key);
        valid = false;
        break;
      }
      multi.pages[multi.pages.findIndex((p) => p.id === page.id)] =
        candidate.page;
      copy.pages[copy.pages.findIndex((p) => p.id === page.id)] =
        candidate.page;
    }
    if (!valid) continue;
    auditMultiPage(target, pageId, multi);
    copy = projectWithPages(target, pageId, multi);
    const reports = multi.pages.map((page) =>
      validateLayout(
        snapshotPage(
          copy.pages.find((p) => p.id === page.id)!,
          copy,
        ),
      ),
    );
    if (reports.some((r) => !r.valid)) continue;
    multi.pages = multi.pages.map((p) =>
      copy.pages.find((x) => x.id === p.id)!,
    );
    const report = clone(reports[0]);
    for (const k of Object.keys(
      report.metrics,
    ) as (keyof typeof report.metrics)[])
      report.metrics[k] = reports.reduce((n, r) => n + r.metrics[k], 0);
    report.issues = reports.flatMap((r) => r.issues);
    return {
      id: 'layout-multipage',
      base: projectRevision(project),
      pageId,
      page: multi.pages[0],
      profile: 'multipage',
      report,
      multiPage: multi,
    };
  }
}
export function applyMultiPage(
  project: Project,
  candidate: LayoutCandidate,
  draft?: Project,
): void {
  const target = draft ?? project,
    multi = candidate.multiPage!;
  auditMultiPage(target, candidate.pageId, multi);
  const copy = projectWithPages(target, candidate.pageId, multi);
  for (const page of multi.pages)
    if (
      !validateLayout(
        snapshotPage(
          copy.pages.find((p) => p.id === page.id)!,
          copy,
        ),
      ).valid
    )
      throw new Error('Mehrseitenprüfung fehlgeschlagen.');
  Object.assign(project, copy);
}
