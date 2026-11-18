import type { Project } from "./types";
import type { ComponentAddress } from "./ArticleTypes";
import { deviceNavigator } from "./DeviceNavigator";
import { DeviceRegistry, addressKey } from "./DeviceRegistry";
import { effectiveArticles } from "./ArticleAssignments";
import { getSymbolForComponent } from "./symbols";
import { isConnectionSymbol } from "./ConnectionSymbols";
import { projectRevision } from "../layout/types";
export interface CabinetItem {
  id: string;
  kind: "device" | "rail" | "duct";
  label: string;
  x: number;
  y: number;
  widthMm: number;
  heightMm: number;
  rotation: 0 | 90;
  clearanceMm: number;
  railId?: string;
  source?: ComponentAddress;
  physicalDeviceId?: string;
  articleKey?: string;
  sizeOrigin?: "article" | "manual";
}
export interface CabinetLayout {
  schemaVersion: 1;
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  marginMm: number;
  gridMm: number;
  items: CabinetItem[];
}
export interface CabinetIssue {
  code:
    | "cabinetInvalid"
    | "cabinetOutside"
    | "cabinetOverlap"
    | "cabinetMissingDevice"
    | "cabinetDuplicateDevice"
    | "cabinetRailInvalid"
    | "cabinetArticleChanged"
    | "cabinetMembershipChanged";
  severity: "error" | "warning";
  ids: string[];
}
export function cabinetBounds(i: CabinetItem) {
  return {
    x: i.x,
    y: i.y,
    width: i.rotation === 90 ? i.heightMm : i.widthMm,
    height: i.rotation === 90 ? i.widthMm : i.heightMm,
  };
}
export function cabinetCandidates(project: Project) {
  const registry = new DeviceRegistry(project);
  return deviceNavigator(project, registry)
    .filter(
      (e) =>
        e.main &&
        registry.placement(e.main) &&
        (() => {
          const s = getSymbolForComponent(
            registry.placement(e.main)!.component,
            project,
          );
          return !s || !isConnectionSymbol(s);
        })(),
    )
    .map((e) => {
      const a = effectiveArticles(
        registry.placement(e.main)!.component,
        project,
      ).find((a) => a.role === "main");
      return {
        ...e,
        identity:
          e.state === "verified"
            ? "device:" + e.id
            : "placement:" + addressKey(e.main),
        articleKey: a
          ? JSON.stringify([a.manufacturer, a.articleNumber, a.variant])
          : undefined,
        dimensions: a?.snapshot?.dimensions,
      };
    });
}
const finite = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
export function cabinetSchemaValid(l: CabinetLayout) {
  return (
    !!l &&
    l.schemaVersion === 1 &&
    typeof l.id === "string" &&
    !!l.id &&
    typeof l.name === "string" &&
    !!l.name.trim() &&
    l.name.length <= 120 &&
    finite(l.widthMm, 50, 10000) &&
    finite(l.heightMm, 50, 10000) &&
    finite(l.marginMm, 0, 100) &&
    l.marginMm * 2 < Math.min(l.widthMm, l.heightMm) &&
    finite(l.gridMm, 1, 50) &&
    Array.isArray(l.items) &&
    l.items.length <= 1000
  );
}

/** Load only structurally valid data; malformed records remain untouched in the project. */
export function cabinetLayouts(project: Project): CabinetLayout[] {
  return (
    Array.isArray(project.cabinetLayouts) ? project.cabinetLayouts : []
  ).filter(
    (l) =>
      cabinetSchemaValid(l) &&
      l.items.every(
        (i) =>
          i &&
          typeof i.id === "string" &&
          typeof i.label === "string" &&
          i.label.length <= 160 &&
          ["device", "rail", "duct"].includes(i.kind) &&
          [0, 90].includes(i.rotation) &&
          finite(i.x, -10000, 10000) &&
          finite(i.y, -10000, 10000) &&
          finite(i.widthMm, 0.1, 10000) &&
          finite(i.heightMm, 0.1, 10000) &&
          finite(i.clearanceMm, 0, 200),
      ),
  );
}

export function inspectCabinet(
  project: Project,
  l: CabinetLayout,
): CabinetIssue[] {
  if (!cabinetSchemaValid(l))
    return [{ code: "cabinetInvalid", severity: "error", ids: [] }];
  const issues: CabinetIssue[] = [],
    registry = new DeviceRegistry(project),
    identities = new Map<string, string[]>(),
    valid: CabinetItem[] = [];
  const add = (
    code: CabinetIssue["code"],
    ids: string[],
    severity: CabinetIssue["severity"] = "error",
  ) => issues.push({ code, severity, ids });
  const identity = (i: CabinetItem) => {
    if (!i.source) return;
    const found = registry.placement(i.source);
    if (
      !found ||
      project.pages.filter((p) => p.id === i.source!.pageId).length !== 1
    )
      return;
    return registry.forComponent(i.source)?.id
      ? "device:" + registry.forComponent(i.source)!.id
      : "placement:" + addressKey(i.source);
  };
  for (const i of l.items) {
    if (
      !i ||
      typeof i.id !== "string" ||
      !i.id ||
      typeof i.label !== "string" ||
      i.label.length > 160 ||
      !["device", "rail", "duct"].includes(i.kind) ||
      ![0, 90].includes(i.rotation) ||
      !finite(i.x, -10000, 10000) ||
      !finite(i.y, -10000, 10000) ||
      !finite(i.widthMm, 0.1, 10000) ||
      !finite(i.heightMm, 0.1, 10000) ||
      !finite(i.clearanceMm, 0, 200) ||
      l.items.filter((j) => j?.id === i.id).length !== 1
    ) {
      add("cabinetInvalid", [i?.id ?? ""]);
      continue;
    }
    valid.push(i);
    const b = cabinetBounds(i);
    if (
      b.x - i.clearanceMm < l.marginMm - 0.001 ||
      b.y - i.clearanceMm < l.marginMm - 0.001 ||
      b.x + b.width + i.clearanceMm > l.widthMm - l.marginMm + 0.001 ||
      b.y + b.height + i.clearanceMm > l.heightMm - l.marginMm + 0.001
    )
      add("cabinetOutside", [i.id]);
    if (i.kind === "device") {
      const key = identity(i);
      if (!key) add("cabinetMissingDevice", [i.id]);
      else {
        identities.set(key, [...(identities.get(key) ?? []), i.id]);
        const current = registry.forComponent(i.source!);
        if (i.physicalDeviceId && current?.id !== i.physicalDeviceId)
          add("cabinetMembershipChanged", [i.id], "warning");
        const p = registry.placement(i.source!)!,
          a = effectiveArticles(p.component, project).find(
            (a) => a.role === "main",
          ),
          signature = a
            ? JSON.stringify([a.manufacturer, a.articleNumber, a.variant])
            : undefined;
        if (
          signature !== i.articleKey ||
          (i.sizeOrigin === "article" &&
            (!a?.snapshot?.dimensions ||
              a.snapshot.dimensions.widthMm !== i.widthMm ||
              a.snapshot.dimensions.heightMm !== i.heightMm))
        )
          add("cabinetArticleChanged", [i.id], "warning");
      }
      if (i.railId) {
        const r = l.items.filter(
          (r) => r.id === i.railId && r.kind === "rail" && r.rotation === 0,
        );
        if (
          r.length !== 1 ||
          Math.abs(b.y + b.height / 2 - r[0].y - r[0].heightMm / 2) > 0.01 ||
          b.x < r[0].x - 0.001 ||
          b.x + b.width > r[0].x + r[0].widthMm + 0.001
        )
          add("cabinetRailInvalid", [i.id, i.railId]);
      }
    }
  }
  for (const [key, ids] of identities) {
    const elsewhere = cabinetLayouts(project)
      .filter((b) => b.id !== l.id)
      .flatMap((b) =>
        (b.items ?? []).filter(
          (i) => i.kind === "device" && identity(i) === key,
        ),
      );
    if (ids.length > 1 || elsewhere.length) add("cabinetDuplicateDevice", ids);
  }
  for (let a = 0; a < valid.length; a++)
    for (let b = a + 1; b < valid.length; b++) {
      const i = valid[a],
        j = valid[b];
      if (
        (i.kind === "device" && i.railId === j.id && j.kind === "rail") ||
        (j.kind === "device" && j.railId === i.id && i.kind === "rail")
      )
        continue;
      const x = cabinetBounds(i),
        y = cabinetBounds(j),
        gap = Math.max(i.clearanceMm, j.clearanceMm);
      if (
        x.x + x.width + gap > y.x + 0.001 &&
        y.x + y.width + gap > x.x + 0.001 &&
        x.y + x.height + gap > y.y + 0.001 &&
        y.y + y.height + gap > x.y + 0.001
      )
        add("cabinetOverlap", [i.id, j.id]);
    }
  return issues;
}
export function moveCabinetItem(
  layout: CabinetLayout,
  id: string,
  x: number,
  y: number,
) {
  const l = structuredClone(layout),
    item = l.items.find((i) => i.id === id);
  if (!item) return l;
  const snap = (n: number) => Math.round(n / l.gridMm) * l.gridMm,
    dx = snap(x) - item.x,
    dy = snap(y) - item.y;
  item.x += dx;
  item.y += dy;
  if (item.kind === "device" && item.railId) {
    const rail = l.items.find((i) => i.id === item.railId && i.kind === "rail");
    if (rail)
      item.y = rail.y + rail.heightMm / 2 - cabinetBounds(item).height / 2;
  }
  if (item.kind === "rail")
    for (const i of l.items)
      if (i.kind === "device" && i.railId === item.id) {
        i.x += dx;
        i.y += dy;
      }
  return l;
}
export function railCapacity(l: CabinetLayout, id: string) {
  const rail = l.items.find((i) => i.id === id && i.kind === "rail");
  if (!rail) return undefined;
  const intervals = l.items
    .filter((i) => i.kind === "device" && i.railId === id)
    .map((i) => {
      const b = cabinetBounds(i);
      return [
        Math.max(rail.x, b.x),
        Math.min(rail.x + rail.widthMm, b.x + b.width),
      ];
    })
    .filter((a) => a[1] > a[0])
    .sort((a, b) => a[0] - b[0]);
  let used = 0,
    end = -Infinity;
  for (const [a, b] of intervals) {
    used += Math.max(0, b - Math.max(a, end));
    end = Math.max(end, b);
  }
  return { used, free: Math.max(0, rail.widthMm - used) };
}
export class CabinetLayoutEdit {
  readonly #base: string;
  readonly #layout: CabinetLayout;
  constructor(
    project: Project,
    layout: CabinetLayout,
    private remove = false,
  ) {
    this.#base = projectRevision(project);
    this.#layout = structuredClone(layout);
  }
  apply(project: Project) {
    if (projectRevision(project) !== this.#base)
      throw Error("articlesProjectStale");
    if (
      !this.remove &&
      inspectCabinet(project, this.#layout).some((i) => i.severity === "error")
    )
      throw Error("cabinetInvalid");
    const next = structuredClone(project);
    if (
      next.cabinetLayouts !== undefined &&
      !Array.isArray(next.cabinetLayouts)
    )
      throw Error("cabinetInvalid");
    if (
      (next.cabinetLayouts?.filter((l) => l?.id === this.#layout.id).length ??
        0) > 1
    )
      throw Error("cabinetInvalid");
    next.cabinetLayouts = [
      ...(next.cabinetLayouts ?? []).filter((l) => l?.id !== this.#layout.id),
      ...(this.remove ? [] : [structuredClone(this.#layout)]),
    ];
    next.modified = new Date().toISOString();
    return next;
  }
}

/** First free grid-aligned gap, using obstacle edges rather than scanning every square millimetre. */
export function findCabinetPlacement(
  l: CabinetLayout,
  width: number,
  height: number,
  railId?: string,
) {
  if (
    !cabinetSchemaValid(l) ||
    !finite(width, 0.1, 10000) ||
    !finite(height, 0.1, 10000)
  )
    return;
  const rail = railId
    ? l.items.find(
        (i) => i.id === railId && i.kind === "rail" && i.rotation === 0,
      )
    : undefined;
  if (railId && !rail) return;
  const snap = (v: number) => Math.ceil(v / l.gridMm) * l.gridMm,
    obstacles = l.items
      .filter((i) => i.id !== railId)
      .map((i) => {
        const b = cabinetBounds(i),
          gap = i.clearanceMm;
        return {
          left: b.x - gap,
          right: b.x + b.width + gap,
          top: b.y - gap,
          bottom: b.y + b.height + gap,
        };
      })
      .filter((b) => Object.values(b).every(Number.isFinite));
  const minX = rail ? Math.max(l.marginMm, rail.x) : l.marginMm,
    maxX = rail
      ? Math.min(l.widthMm - l.marginMm, rail.x + rail.widthMm)
      : l.widthMm - l.marginMm;
  const ys = rail
    ? [rail.y + rail.heightMm / 2 - height / 2]
    : [
        ...new Set([snap(l.marginMm), ...obstacles.map((b) => snap(b.bottom))]),
      ].sort((a, b) => a - b);
  for (const y of ys) {
    if (y < l.marginMm - 0.001 || y + height > l.heightMm - l.marginMm + 0.001)
      continue;
    let x = snap(minX);
    const blocks = obstacles
      .filter((b) => b.bottom > y + 0.001 && b.top < y + height - 0.001)
      .sort((a, b) => a.left - b.left);
    for (const b of blocks) {
      if (x + width <= b.left + 0.001) break;
      if (x < b.right - 0.001) x = snap(b.right);
    }
    if (x + width <= maxX + 0.001) return { x, y };
  }
}
