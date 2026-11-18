import type { Project } from "./types";
import type { ComponentAddress } from "./ArticleTypes";
import { DeviceRegistry, addressKey } from "./DeviceRegistry";
import {
  inspectElectricalProject,
  type ElectricalInspectionReport,
  type InspectionFinding,
} from "./ElectricalInspection";
import { projectRevision } from "../layout/types";
export const articleRepairRules = new Set([
  "missing_article",
  "invalid_article_assignment",
  "article_incompatible",
  "article_spec_unknown",
  "invalid_physical_device",
]);
const evidence = (f: InspectionFinding) =>
  JSON.stringify([f.ruleId, f.severity, f.cause, f.articleData]);
export function compareRepairReports(
  before: ElectricalInspectionReport,
  after: ElectricalInspectionReport,
) {
  const a = new Map(before.messages.map((f) => [f.id, f])),
    b = new Map(after.messages.map((f) => [f.id, f]));
  return {
    removed: before.messages.filter((f) => !b.has(f.id)),
    added: after.messages.filter((f) => !a.has(f.id)),
    changed: after.messages.filter(
      (f) => a.has(f.id) && evidence(a.get(f.id)!) !== evidence(f),
    ),
    changedDetails: after.messages
      .filter((f) => a.has(f.id) && evidence(a.get(f.id)!) !== evidence(f))
      .map((f) => ({ before: a.get(f.id)!, after: f })),
    remaining: after.messages.filter(
      (f) => a.has(f.id) && evidence(a.get(f.id)!) === evidence(f),
    ),
  };
}
/** Confirmed physical devices are the only source of multi-placement work units. */
export function repairUnits(
  project: Project,
  addresses: ComponentAddress[],
  report: ElectricalInspectionReport,
) {
  const findingsByAddress = new Map<string, Map<string, InspectionFinding>>();
  for (const finding of report.messages)
    for (const l of [finding.location, ...finding.relatedLocations])
      if (l.componentId) {
        const key = addressKey({
            pageId: l.pageId,
            componentId: l.componentId,
          }),
          matches = findingsByAddress.get(key) ?? new Map();
        matches.set(finding.id, finding);
        findingsByAddress.set(key, matches);
      }
  const registry = new DeviceRegistry(project),
    units = new Map<
      string,
      {
        id: string;
        label: string;
        members: ComponentAddress[];
        confirmed: boolean;
        findings: InspectionFinding[];
      }
    >();
  for (const address of addresses) {
    const placement = registry.placement(address);
    if (!placement) continue;
    const device = registry.forComponent(address),
      members = device?.members ?? [address],
      main = device ? registry.placement(device.main) : placement;
    if (!main) continue;
    const id = addressKey(device?.main ?? address);
    if (units.has(id)) continue;
    const keys = new Set(members.map(addressKey));
    units.set(id, {
      id,
      label: [
        main.page.higherLevel,
        main.page.location,
        main.component.bmk || main.component.id,
      ]
        .filter(Boolean)
        .join(" · "),
      members: structuredClone(members),
      confirmed: !!device,
      findings: [
        ...new Map(
          [...keys]
            .flatMap((key) => [...(findingsByAddress.get(key)?.values() ?? [])])
            .map((f) => [f.id, f]),
        ).values(),
      ],
    });
  }
  return [...units.values()];
}
/** Isolated multi-editor draft. Only the final apply writes to the live project. */
export class InspectionRepairSession {
  readonly #base: string;
  readonly #source: Project;
  #draft: Project;
  readonly #before: ElectricalInspectionReport;
  #after: ElectricalInspectionReport;
  #changed = false;
  constructor(project: Project) {
    this.#source = structuredClone(project);
    this.#draft = structuredClone(project);
    this.#base = projectRevision(project);
    this.#before = inspectElectricalProject(this.#source);
    this.#after = this.#before;
  }
  project() {
    return structuredClone(this.#draft);
  }
  get changed() {
    return this.#changed;
  }
  stage(project: Project) {
    const next = structuredClone(project),
      report = inspectElectricalProject(next);
    this.#changed = projectRevision(next) !== this.#base;
    this.#draft = next;
    this.#after = report;
  }
  report() {
    return structuredClone(this.#after);
  }
  comparison() {
    return structuredClone(compareRepairReports(this.#before, this.#after));
  }
  modifiedPlacements() {
    const before = new Map(
      this.#source.pages.flatMap((p) =>
        p.components.map(
          (c) =>
            [
              addressKey({ pageId: p.id, componentId: c.id }),
              JSON.stringify(c),
            ] as const,
        ),
      ),
    );
    return this.#draft.pages.flatMap((p) =>
      p.components
        .filter(
          (c) =>
            before.get(addressKey({ pageId: p.id, componentId: c.id })) !==
            JSON.stringify(c),
        )
        .map((c) => ({ pageId: p.id, componentId: c.id })),
    );
  }
  reset() {
    this.#changed = false;
    this.#draft = structuredClone(this.#source);
    this.#after = this.#before;
  }
  apply(current: Project) {
    if (projectRevision(current) !== this.#base)
      throw new Error("articlesProjectStale");
    if (!this.changed) throw new Error("articlesPreviewRequired");
    const next = structuredClone(this.#draft);
    next.activePageId = current.activePageId;
    next.modified = new Date().toISOString();
    return next;
  }
}
