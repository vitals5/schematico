import type { Project, PlacedComponent, Wire } from './types';
import type { ComponentAddress } from './ArticleTypes';
import {
  ProjectIndex,
  displayDesignation,
  scopedDesignation,
} from './ProjectIndex';
import { ElectricalNetService } from './ElectricalNetService';
import { projectRevision } from '../layout/types';
export interface TerminalSettings {
  strip: string;
  number: string;
  level: string;
  pinSides: Record<string, 'internal' | 'external'>;
}
export interface WiringFinding {
  code:
    | 'terminal_number_duplicate'
    | 'cable_core_duplicate'
    | 'cable_wire_missing'
    | 'cable_wire_reused'
    | 'cable_reserve_connected'
    | 'cable_core_unassigned'
    | 'cable_count_mismatch';
  pageId: string;
  componentId?: string;
  cableId?: string;
  coreId?: string;
  details: string;
}
export function terminalSettings(c: PlacedComponent): TerminalSettings {
  if (c.terminal) return structuredClone(c.terminal);
  const colon = c.bmk.indexOf(':');
  return {
    strip: colon > 0 ? c.bmk.slice(0, colon) : c.bmk,
    number: colon > 0 ? c.bmk.slice(colon + 1) : '',
    level: '',
    pinSides: {},
  };
}
export function cableWires(project: Project, pageId: string, wireId: string) {
  const page = project.pages.find((p) => p.id === pageId),
    physical = page?.wires.filter((w) => w.id === wireId) ?? [];
  return physical.length
    ? physical
    : (project.logicalConnections ?? []).filter((w) => w.id === wireId);
}
export function inspectWiring(
  project: Project,
  index = new ProjectIndex(project),
): WiringFinding[] {
  const messages: WiringFinding[] = [],
    terminals = new Map<string, typeof index.components>();
  for (const e of index.components) {
    if (e.symbol?.category !== 'terminals') continue;
    const settings = terminalSettings(e.component);
    if (!settings.number) continue;
    const key = JSON.stringify([
      scopedDesignation(e.structure, settings.strip),
      settings.number,
      settings.level,
    ]);
    terminals.set(key, [...(terminals.get(key) ?? []), e]);
  }
  for (const [key, entries] of terminals)
    if (entries.length > 1)
      for (const e of entries)
        messages.push({
          code: 'terminal_number_duplicate',
          pageId: e.page.id,
          componentId: e.component.id,
          details: key,
        });
  for (const page of project.pages)
    for (const cable of page.cables ?? []) {
      const labels = new Map<string, number>(),
        wires = new Map<string, number>();
      for (const core of cable.cores) {
        if (core.designation?.trim())
          labels.set(
            core.designation.trim(),
            (labels.get(core.designation.trim()) ?? 0) + 1,
          );
        for (const id of core.wireIds ?? [])
          wires.set(id, (wires.get(id) ?? 0) + 1);
      }
      const add = (
        code: WiringFinding['code'],
        coreId?: string,
        details = '',
      ) =>
        messages.push({
          code,
          pageId: page.id,
          cableId: cable.id,
          coreId,
          details,
        });
      if (
        cable.coreCount !== undefined &&
        cable.coreCount !== cable.cores.length
      )
        add(
          'cable_count_mismatch',
          undefined,
          `${cable.coreCount} / ${cable.cores.length}`,
        );
      for (const core of cable.cores) {
        if (core.designation && labels.get(core.designation.trim())! > 1)
          add('cable_core_duplicate', core.id, core.designation);
        if (core.reserve && core.wireIds?.length)
          add('cable_reserve_connected', core.id);
        if (!core.reserve && !core.wireIds?.length)
          add('cable_core_unassigned', core.id);
        for (const id of core.wireIds ?? []) {
          if (cableWires(project, page.id, id).length !== 1)
            add('cable_wire_missing', core.id, id);
          if (wires.get(id)! > 1) add('cable_wire_reused', core.id, id);
        }
      }
    }
  return messages;
}
export function cableSchedule(project: Project) {
  const index = new ProjectIndex(project);
  return project.pages.flatMap((page) =>
    (page.cables ?? []).flatMap((cable) =>
      cable.cores.map((core) => ({
        pageId: page.id,
        pageNumber: page.pageNumber,
        cableId: cable.id,
        bmk: cable.bmk,
        type: cable.cableType,
        coreId: core.id,
        designation: core.designation ?? '',
        color: core.color ?? '',
        crossSection: core.crossSection ?? cable.crossSection,
        reserve: !!core.reserve,
        targets: (core.wireIds ?? [])
          .flatMap((id) => {
            const matches = cableWires(project, page.id, id);
            if (matches.length !== 1) return [];
            return [matches[0].from, matches[0].to].map((ep) => {
              const e = index.component(ep.componentId);
              const p = e && index.pin(e, ep.pinId);
              return e
                ? `${displayDesignation(e.structure, e.tag)}:${p?.label ?? ep.pinId}`
                : `?${ep.componentId}:${ep.pinId}`;
            });
          })
          .filter((s, i, a) => a.indexOf(s) === i),
      })),
    ),
  );
}
export type WiringEdit =
  | { kind: 'terminal'; target: ComponentAddress; settings: TerminalSettings }
  | {
      kind: 'core';
      pageId: string;
      cableId: string;
      coreId: string;
      designation: string;
      color: string;
      crossSection: string;
      reserve: boolean;
      wireIds: string[];
    }
  | {
      kind: 'cable';
      pageId: string;
      cableId: string;
      bmk: string;
      cableType: string;
      crossSection: string;
      coreCount?: number;
    }
  | { kind: 'reserves'; pageId: string; cableId: string }
  | {
      kind: 'bridge';
      from: ComponentAddress & { pinId: string };
      to: ComponentAddress & { pinId: string };
      bridgeType: 'plug' | 'wire';
    }
  | { kind: 'remove_bridge'; id: string };
export class WiringEditPlan {
  readonly #base: string;
  readonly #result: Project;
  readonly findings: WiringFinding[];
  constructor(project: Project, edit: WiringEdit) {
    this.#base = projectRevision(project);
    const p = structuredClone(project),
      index = new ProjectIndex(p);
    if (edit.kind === 'terminal') {
      const e = index.component(edit.target.componentId, edit.target.pageId);
      if (
        index.pagesById.get(edit.target.pageId)?.length !== 1 ||
        e?.symbol?.category !== 'terminals' ||
        !edit.settings.strip.trim() ||
        !edit.settings.number.trim() ||
        Object.entries(edit.settings.pinSides).some(
          ([id, side]) =>
            !index.pin(e, id) || !['internal', 'external'].includes(side),
        )
      )
        throw new Error('wiringInvalid');
      e.component.terminal = structuredClone(edit.settings);
      e.component.terminal.strip = edit.settings.strip.trim();
      e.component.terminal.number = edit.settings.number.trim();
      e.component.terminal.level = edit.settings.level.trim();
      e.component.bmk =
        e.component.terminal.strip + ':' + e.component.terminal.number;
    } else if (edit.kind === 'bridge') {
      const a = index.component(edit.from.componentId, edit.from.pageId),
        b = index.component(edit.to.componentId, edit.to.pageId),
        pa = a && index.pin(a, edit.from.pinId),
        pb = b && index.pin(b, edit.to.pinId);
      if (
        a?.symbol?.category !== 'terminals' ||
        b?.symbol?.category !== 'terminals' ||
        !pa ||
        !pb ||
        JSON.stringify(edit.from) === JSON.stringify(edit.to) ||
        index.componentsById.get(a.component.id)?.length !== 1 ||
        index.componentsById.get(b.component.id)?.length !== 1 ||
        !['plug', 'wire'].includes(edit.bridgeType)
      )
        throw new Error('wiringInvalid');
      const existing = new ElectricalNetService(index),
        netA = existing.netForPin(pa),
        netB = existing.netForPin(pb);
      if (netA && netB && netA.id === netB.id)
        throw new Error('wiringAlreadyConnected');
      const wire: Wire = {
        id: 'bridge_' + crypto.randomUUID(),
        from: { componentId: a.component.id, pinId: pa.id },
        to: { componentId: b.component.id, pinId: pb.id },
        potential: 'Signal',
        terminalBridge: edit.bridgeType,
      };
      (p.logicalConnections ??= []).push(wire);
      const next = new ElectricalNetService(new ProjectIndex(p));
      if (
        next.issues.some(
          (i) =>
            i.code === 'neutral_pe_connection' &&
            !existing.issues.some(
              (old) => old.netId === i.netId && old.code === i.code,
            ),
        )
      )
        throw new Error('wiringPotentialConflict');
      const constraints = new Set(
        [...(netA?.ports ?? []), ...(netB?.ports ?? [])]
          .map(
            (pin) =>
              pin.owner.component.pins[pin.id]?.potentialConstraint ??
              pin.definition?.potentialConstraint ??
              '',
          )
          .filter(Boolean),
      );
      if (constraints.size > 1) throw new Error('wiringPotentialConflict');
    } else if (edit.kind === 'remove_bridge') {
      const found = p.logicalConnections?.filter(
        (w) => w.id === edit.id && w.terminalBridge,
      );
      if (found?.length !== 1) throw new Error('wiringInvalid');
      p.logicalConnections = p.logicalConnections?.filter(
        (w) => w.id !== edit.id,
      );
    } else {
      const page = p.pages.find((page) => page.id === edit.pageId),
        matches = page?.cables?.filter((c) => c.id === edit.cableId);
      if (
        index.pagesById.get(edit.pageId)?.length !== 1 ||
        matches?.length !== 1
      )
        throw new Error('wiringInvalid');
      const cable = matches[0];
      if (edit.kind === 'cable') {
        if (
          !edit.bmk.trim() ||
          (edit.coreCount !== undefined &&
            (!Number.isInteger(edit.coreCount) ||
              edit.coreCount < 0 ||
              edit.coreCount > 1000))
        )
          throw new Error('wiringInvalid');
        Object.assign(cable, {
          bmk: edit.bmk.trim(),
          cableType: edit.cableType.trim(),
          crossSection: edit.crossSection.trim(),
          coreCount: edit.coreCount,
        });
      } else if (edit.kind === 'reserves') {
        const count = cable.coreCount;
        if (count === undefined || count < cable.cores.length || count > 1000)
          throw new Error('wiringInvalid');
        for (let i = cable.cores.length; i < count; i++) {
          let n = i + 1;
          while (cable.cores.some((c) => c.designation === `R${n}`)) n++;
          cable.cores.push({
            id: crypto.randomUUID(),
            t: (i + 1) / (count + 1),
            designation: `R${n}`,
            reserve: true,
            wireIds: [],
          });
        }
      } else {
        const cores = cable.cores.filter((c) => c.id === edit.coreId);
        if (
          cores.length !== 1 ||
          new Set(edit.wireIds).size !== edit.wireIds.length ||
          (edit.reserve && edit.wireIds.length) ||
          edit.wireIds.some(
            (id) =>
              cableWires(p, page!.id, id).length !== 1 ||
              cable.cores.some(
                (c) => c.id !== edit.coreId && c.wireIds?.includes(id),
              ),
          )
        )
          throw new Error('wiringInvalid');
        Object.assign(cores[0], {
          designation: edit.designation.trim(),
          color: edit.color.trim(),
          crossSection: edit.crossSection.trim(),
          reserve: edit.reserve,
          wireIds: [...edit.wireIds],
        });
      }
    }
    this.findings = inspectWiring(p);
    if (edit.kind === 'terminal' || edit.kind === 'core') {
      const before = new Set(
        inspectWiring(project)
          .filter(
            (i) =>
              i.code === 'terminal_number_duplicate' ||
              i.code === 'cable_core_duplicate',
          )
          .map((i) => JSON.stringify(i)),
      );
      if (
        this.findings.some(
          (i) =>
            (i.code === 'terminal_number_duplicate' ||
              i.code === 'cable_core_duplicate') &&
            !before.has(JSON.stringify(i)),
        )
      )
        throw new Error('wiringDuplicate');
    }
    this.#result = p;
  }
  apply(project: Project) {
    if (projectRevision(project) !== this.#base)
      throw new Error('articlesProjectStale');
    const p = structuredClone(this.#result);
    p.activePageId = project.activePageId;
    p.modified = new Date().toISOString();
    return p;
  }
}
