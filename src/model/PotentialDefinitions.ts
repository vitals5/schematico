import type { Project } from './types';
import type { ComponentAddress } from './ArticleTypes';
import { ProjectIndex } from './ProjectIndex';
import {
  ElectricalNetService,
  type ElectricalNet,
} from './ElectricalNetService';
import { projectRevision } from '../layout/types';
export interface PotentialDefinition {
  id: string;
  name: string;
  plant: string;
  location: string;
  color?: string;
  crossSection?: string;
  anchors: (ComponentAddress & { pinId: string })[];
}
export interface PotentialFinding {
  code:
    | 'potential_anchor_invalid'
    | 'potential_definition_collision'
    | 'potential_policy_mismatch';
  definitionId: string;
  pageId?: string;
  componentId?: string;
  wireId?: string;
  netId?: string;
  details: string;
}
const normalize = (s: string | undefined) =>
  s?.trim().toUpperCase().replace(/\s+/g, '') ?? '';
const section = (s: string | undefined) =>
  normalize(s)
    .replace(/MM(?:²|2)/g, '')
    .replace(',', '.');
export const potentialDiff = (
  field: 'potential' | 'color' | 'crossSection',
  a: string | undefined,
  b: string | undefined,
) =>
  field === 'crossSection'
    ? section(a) !== section(b)
    : normalize(a) !== normalize(b);
export class PotentialIndex {
  readonly findings: PotentialFinding[] = [];
  readonly nets = new Map<string, ElectricalNet[]>();
  readonly assignments = new Map<string, PotentialDefinition[]>();
  constructor(
    readonly project: Project,
    readonly index = new ProjectIndex(project),
    readonly electrical = new ElectricalNetService(index),
  ) {
    const definitions = project.potentialDefinitions ?? [],
      ids = new Map<string, number>(),
      names = new Map<string, number>();
    for (const d of definitions) {
      ids.set(d.id, (ids.get(d.id) ?? 0) + 1);
      const key = JSON.stringify([normalize(d.name), d.plant, d.location]);
      names.set(key, (names.get(key) ?? 0) + 1);
    }
    for (const d of definitions) {
      const assigned = new Set<ElectricalNet>();
      if (
        ids.get(d.id) !== 1 ||
        names.get(JSON.stringify([normalize(d.name), d.plant, d.location])) !==
          1
      )
        this.findings.push({
          code: 'potential_definition_collision',
          definitionId: d.id,
          details: d.name,
        });
      for (const anchor of d.anchors) {
        const e =
            index.component(anchor.componentId, anchor.pageId) ??
            index.component(anchor.componentId),
          pin = e && index.pin(e, anchor.pinId),
          net = pin && electrical.netForPin(pin);
        if (
          !e ||
          !pin ||
          !pin.definition ||
          e.symbol?.unresolved ||
          index.componentsById.get(e.component.id)?.length !== 1 ||
          !net ||
          (d.plant && d.plant !== e.structure.plant) ||
          (d.location && d.location !== e.structure.location)
        ) {
          this.findings.push({
            code: 'potential_anchor_invalid',
            definitionId: d.id,
            pageId: anchor.pageId,
            componentId: anchor.componentId,
            details: anchor.pinId,
          });
          continue;
        }
        assigned.add(net);
      }
      this.nets.set(d.id, [...assigned]);
      for (const net of assigned)
        this.assignments.set(net.id, [
          ...(this.assignments.get(net.id) ?? []),
          d,
        ]);
    }
    for (const [netId, assigned] of this.assignments) {
      const net = electrical.nets.find((n) => n.id === netId)!;
      if (assigned.length > 1) {
        for (const d of assigned)
          this.findings.push({
            code: 'potential_definition_collision',
            definitionId: d.id,
            netId,
            pageId: net.ports[0]?.owner.page.id,
            componentId: net.ports[0]?.owner.component.id,
            details: assigned.map((d) => d.name).join(', '),
          });
        continue;
      }
      const d = assigned[0];
      for (const pin of net.ports) {
        const constraint =
          pin.owner.component.pins[pin.id]?.potentialConstraint ??
          pin.definition?.potentialConstraint;
        if (constraint && potentialDiff('potential', constraint, d.name))
          this.findings.push({
            code: 'potential_definition_collision',
            definitionId: d.id,
            netId,
            pageId: pin.owner.page.id,
            componentId: pin.owner.component.id,
            details: constraint + ' / ' + d.name,
          });
      }
      for (const connection of net.connections) {
        const w = connection.wire;
        for (const [field, expected] of Object.entries({
          potential: d.name,
          ...(d.color ? { color: d.color } : {}),
          ...(d.crossSection ? { crossSection: d.crossSection } : {}),
        }) as ['potential' | 'color' | 'crossSection', string][]) {
          if (potentialDiff(field, w[field], expected))
            this.findings.push({
              code: 'potential_policy_mismatch',
              definitionId: d.id,
              netId,
              pageId: connection.page?.id ?? connection.from?.owner.page.id,
              wireId: w.id,
              details: field + ': ' + (w[field] ?? '—') + ' → ' + expected,
            });
        }
      }
    }
  }
}
export type PotentialAction =
  | { kind: 'save'; definition: PotentialDefinition }
  | { kind: 'delete'; id: string }
  | { kind: 'propagate'; id: string; mode: 'fill' | 'replace' };
export class PotentialPlan {
  readonly #base: string;
  readonly #result: Project;
  readonly #needsConfirmation: boolean;
  readonly changes: {
    pageId?: string;
    wireId: string;
    field: string;
    before?: string;
    after: string;
    replaces: boolean;
    skipped: boolean;
  }[] = [];
  readonly findings: PotentialFinding[];
  constructor(project: Project, action: PotentialAction) {
    this.#base = projectRevision(project);
    const p = structuredClone(project);
    if (action.kind === 'save') {
      const d = structuredClone(action.definition);
      if (
        !d.id ||
        !d.name.trim() ||
        !Array.isArray(d.anchors) ||
        new Set(d.anchors.map((a) => JSON.stringify([a.componentId, a.pinId])))
          .size !== d.anchors.length
      )
        throw new Error('potentialInvalid');
      d.name = d.name.trim();
      d.plant = d.plant.trim().replace(/^=+/, '').trim();
      d.location = d.location.trim().replace(/^\++/, '').trim();
      d.color = d.color?.trim();
      d.crossSection = d.crossSection?.trim();
      const records = (p.potentialDefinitions ??= []);
      if (records.filter((a) => a.id === d.id).length > 1)
        throw new Error('potentialInvalid');
      const old = records.findIndex((a) => a.id === d.id);
      if (old < 0) records.push(d);
      else records[old] = d;
      const inspected = new PotentialIndex(p);
      if (
        inspected.findings.some(
          (i) =>
            i.definitionId === d.id && i.code !== 'potential_policy_mismatch',
        )
      )
        throw new Error('potentialConflict');
    } else {
      const definitions = p.potentialDefinitions?.filter(
        (d) => d.id === action.id,
      );
      if (definitions?.length !== 1) throw new Error('potentialInvalid');
      if (action.kind === 'delete')
        p.potentialDefinitions = p.potentialDefinitions?.filter(
          (d) => d.id !== action.id,
        );
      else {
        if (!['fill', 'replace'].includes(action.mode))
          throw new Error('potentialInvalid');
        const inspected = new PotentialIndex(p),
          definition = definitions[0];
        if (
          inspected.findings.some(
            (i) =>
              i.definitionId === action.id &&
              i.code !== 'potential_policy_mismatch',
          )
        )
          throw new Error('potentialConflict');
        const nets = inspected.nets.get(action.id) ?? [];
        if (!nets.length) throw new Error('potentialNoAnchors');
        const seen = new Set<object>();
        for (const net of nets)
          for (const conn of net.connections) {
            if (seen.has(conn.wire)) continue;
            seen.add(conn.wire);
            for (const [field, value] of Object.entries({
              potential: definition.name,
              ...(definition.color ? { color: definition.color } : {}),
              ...(definition.crossSection
                ? { crossSection: definition.crossSection }
                : {}),
            }) as ['potential' | 'color' | 'crossSection', string][]) {
              if (!potentialDiff(field, conn.wire[field], value)) continue;
              const before = conn.wire[field],
                replaces = !!before?.trim(),
                skipped = action.mode === 'fill' && replaces;
              this.changes.push({
                pageId: conn.page?.id ?? conn.from?.owner.page.id,
                wireId: conn.wire.id,
                field,
                before,
                after: value,
                replaces,
                skipped,
              });
              if (!skipped) conn.wire[field] = value;
            }
          }
        for (const anchor of definition.anchors) {
          const e = inspected.index.component(anchor.componentId);
          if (e) anchor.pageId = e.page.id;
        }
      }
    }
    this.findings = new PotentialIndex(p).findings;
    this.#result = p;
    this.#needsConfirmation = this.changes.some(
      (c) => c.replaces && !c.skipped,
    );
  }
  apply(project: Project, confirmReplace = false) {
    if (projectRevision(project) !== this.#base)
      throw new Error('articlesProjectStale');
    if (this.#needsConfirmation && !confirmReplace)
      throw new Error('repairConfirmation');
    const p = structuredClone(this.#result);
    p.activePageId = project.activePageId;
    p.modified = new Date().toISOString();
    return p;
  }
}
