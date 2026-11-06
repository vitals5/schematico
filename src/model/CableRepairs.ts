import { ProjectIndex } from './ProjectIndex';
import { ElectricalNetService } from './ElectricalNetService';
import type { Project } from './types';
import { cableCrossings } from './CableDefinition';
import { gridForPage } from './DrawingGrid';
import { cableWires } from './WiringManagement';
import { projectRevision } from '../layout/types';
export interface CableRepair {
  id: string;
  kind: 'bind' | 'reserve' | 'add_reserves' | 'count';
  pageId: string;
  cableId: string;
  coreId?: string;
  bmk: string;
  label: string;
  wireIds?: string[];
  count?: number;
  evidence: {
    method:
      | 'drawing_intersection'
      | 'manual_reserve'
      | 'declared_count'
      | 'defined_core_count';
    distance?: number;
    position?: number;
    source?: unknown;
    before: unknown;
    after: unknown;
  };
  requiresReserve: boolean;
  requiresCount: boolean;
  requiresOverwrite: boolean;
}
export function cableRepairs(project: Project): CableRepair[] {
  const result: CableRepair[] = [],
    index = new ProjectIndex(project),
    nets = new ElectricalNetService(index);
  for (const page of project.pages) {
    if (project.pages.filter((p) => p.id === page.id).length !== 1) continue;
    for (const cable of page.cables ?? []) {
      if (page.cables!.filter((c) => c.id === cable.id).length !== 1) continue;
      const crossings = cableCrossings(cable, page, project),
        length = Math.hypot(
          cable.end.x - cable.start.x,
          cable.end.y - cable.start.y,
        ),
        tolerance = Math.max(
          1e-5,
          Math.min(1, gridForPage(page).spacing / 4) / Math.max(length, 1),
        );
      const add = (
        entry: Omit<CableRepair, 'id' | 'pageId' | 'cableId' | 'bmk'>,
      ) =>
        result.push({
          ...entry,
          pageId: page.id,
          cableId: cable.id,
          bmk: cable.bmk,
          id: JSON.stringify([
            page.id,
            cable.id,
            entry.coreId,
            entry.kind,
            entry.wireIds ?? entry.count,
          ]),
        });
      for (const core of cable.cores) {
        if (cable.cores.filter((c) => c.id === core.id).length !== 1) continue;
        const ids = core.wireIds ?? [],
          valid = ids.filter(
            (id) => cableWires(project, page.id, id).length === 1,
          );
        if (
          core.reserve ||
          (ids.length &&
            valid.length === ids.length &&
            new Set(ids).size === ids.length)
        )
          continue;
        if (
          Number.isFinite(core.t) &&
          core.t >= 0 &&
          core.t <= 1 &&
          length > 0
        ) {
          const near = crossings.filter(
              (p) => Math.abs(p.t - core.t) <= tolerance,
            ),
            exact = near.filter((p) => Math.abs(p.t - core.t) < 1e-5),
            candidates = exact.length ? exact : near;
          for (const candidate of candidates) {
            const connections = candidate.wireIds.map((id) =>
              index.connections.filter(
                (c) => !c.logical && c.page?.id === page.id && c.wire.id === id,
              ),
            );
            if (
              connections.some(
                (c) =>
                  c.length !== 1 || !c[0].from || !nets.netForPin(c[0].from),
              )
            )
              continue;
            const netIds = new Set(
              connections.map((c) => nets.netForPin(c[0].from!)!.id),
            );
            if (netIds.size !== 1) continue;
            if (
              candidate.wireIds.some(
                (id) =>
                  cableWires(project, page.id, id).length !== 1 ||
                  cable.cores.some(
                    (other) =>
                      other.id !== core.id && other.wireIds?.includes(id),
                  ),
              )
            )
              continue;
            const competing = cable.cores.filter(
              (other) =>
                other.id !== core.id &&
                !other.reserve &&
                Math.abs(other.t - candidate.t) <= tolerance,
            );
            if (competing.length) continue;
            add({
              kind: 'bind',
              coreId: core.id,
              label: core.designation ?? core.id,
              wireIds: [...candidate.wireIds],
              evidence: {
                method: 'drawing_intersection',
                distance: Math.abs(candidate.t - core.t) * length,
                position: candidate.t,
                source: core.source,
                before: ids,
                after: candidate.wireIds,
              },
              requiresReserve: false,
              requiresCount: false,
              requiresOverwrite: ids.length > 0,
            });
          }
        }
        if (!valid.length)
          add({
            kind: 'reserve',
            coreId: core.id,
            label: core.designation ?? core.id,
            evidence: {
              method: 'manual_reserve',
              source: core.source,
              before: { reserve: core.reserve, wireIds: ids },
              after: { reserve: true, wireIds: [] },
            },
            requiresReserve: true,
            requiresCount: false,
            requiresOverwrite: ids.length > 0,
          });
      }
      if (
        cable.coreCount !== undefined &&
        Number.isInteger(cable.coreCount) &&
        cable.coreCount > cable.cores.length &&
        cable.coreCount <= 1000
      )
        add({
          kind: 'add_reserves',
          label: String(cable.coreCount - cable.cores.length),
          count: cable.coreCount,
          evidence: {
            method: 'declared_count',
            source: cable.source,
            before: cable.cores.length,
            after: cable.coreCount,
          },
          requiresReserve: true,
          requiresCount: false,
          requiresOverwrite: false,
        });
      if (cable.cores.length && cable.coreCount !== cable.cores.length)
        add({
          kind: 'count',
          label: String(cable.cores.length),
          count: cable.cores.length,
          evidence: {
            method: 'defined_core_count',
            source: cable.source,
            before: cable.coreCount,
            after: cable.cores.length,
          },
          requiresReserve: false,
          requiresCount: true,
          requiresOverwrite: false,
        });
    }
  }
  return result;
}
export class CableRepairPlan {
  readonly rows: readonly CableRepair[];
  readonly #base: string;
  readonly #source: Project;
  constructor(project: Project) {
    this.#source = structuredClone(project);
    this.#base = projectRevision(project);
    this.rows = cableRepairs(this.#source);
  }
  apply(
    project: Project,
    selected: string[],
    confirm: { reserve?: boolean; count?: boolean; overwrite?: boolean } = {},
  ) {
    if (projectRevision(project) !== this.#base)
      throw new Error('articlesProjectStale');
    if (!selected.length || new Set(selected).size !== selected.length)
      throw new Error('repairSelection');
    const proposals = new Map(cableRepairs(this.#source).map((r) => [r.id, r])),
      chosen = selected.map((id) => {
        const row = proposals.get(id);
        if (!row) throw new Error('repairSelection');
        return row;
      });
    const touched = new Set<string>();
    for (const r of chosen) {
      if (
        (r.requiresReserve && !confirm.reserve) ||
        (r.requiresCount && !confirm.count) ||
        (r.requiresOverwrite && !confirm.overwrite)
      )
        throw new Error('repairConfirmation');
      const key = JSON.stringify([r.pageId, r.cableId, r.coreId ?? 'count']);
      if (touched.has(key)) throw new Error('repairExclusive');
      touched.add(key);
    }
    const result = structuredClone(this.#source);
    for (const r of chosen) {
      const page = result.pages.find((p) => p.id === r.pageId)!,
        cable = page.cables!.find((c) => c.id === r.cableId)!;
      const record = {
        kind: r.kind,
        confirmed: true as const,
        evidence: structuredClone(r.evidence),
        at: new Date().toISOString(),
      };
      if (r.kind === 'count') {
        cable.coreCount = r.count;
        (cable.repairHistory ??= []).push(record);
        continue;
      }
      if (r.kind === 'add_reserves') {
        for (let i = cable.cores.length; i < r.count!; i++) {
          let n = i + 1;
          while (cable.cores.some((c) => c.designation === `R${n}`)) n++;
          cable.cores.push({
            id: crypto.randomUUID(),
            t: (i + 1) / (r.count! + 1),
            designation: `R${n}`,
            reserve: true,
            wireIds: [],
            repairHistory: [record],
          });
        }
        continue;
      }
      const core = cable.cores.find((c) => c.id === r.coreId)!;
      if (r.kind === 'bind') {
        if (
          r.wireIds!.some((id) =>
            cable.cores.some(
              (c) => c.id !== core.id && c.wireIds?.includes(id),
            ),
          )
        )
          throw new Error('repairExclusive');
        core.wireIds = [...r.wireIds!];
        core.reserve = false;
      } else {
        core.wireIds = [];
        core.reserve = true;
      }
      (core.repairHistory ??= []).push(record);
    }
    result.activePageId = project.activePageId;
    result.modified = new Date().toISOString();
    return result;
  }
}
