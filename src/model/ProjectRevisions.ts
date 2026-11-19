import { gzipSync, Gunzip, strToU8, strFromU8 } from "fflate";
import type { Project, Page } from "./types";
import { sha256 } from "./SourceIdentity";
import { projectRevision } from "../layout/types";

export interface SavedProjectRevision {
  schemaVersion: 1;
  id: string;
  name: string;
  author: string;
  reason: string;
  created: string;
  status: "draft" | "released";
  approval?: { author: string; reason: string; at: string };
  encoding: "gzip-base64";
  payload: string;
  digest: string;
  bytes: number;
  pages: number;
}
export interface RevisionFieldChange {
  path: string;
  before?: unknown;
  after?: unknown;
}
export interface RevisionChange {
  key: string;
  kind: string;
  id: string;
  pageId?: string;
  pageNumber?: string;
  label: string;
  status: "added" | "removed" | "changed";
  fields: RevisionFieldChange[];
}
export interface RevisionComparison {
  schemaVersion: 1;
  projectId: string;
  before: string;
  after: string;
  summary: { added: number; removed: number; changed: number };
  changes: RevisionChange[];
}
const MAX_SNAPSHOT = 128 * 1024 * 1024;
const MAX_ARCHIVE = 64 * 1024 * 1024;
/** Stable object keys; array order remains meaningful. */
export function stableProjectJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]]),
        )
      : v,
  );
}
function content(
  project: Project,
): Omit<Project, "revisions" | "revisionOriginId"> {
  const { revisions, revisionOriginId, ...rest } = project;
  return rest;
}
function validProject(p: Project) {
  if (
    !p ||
    typeof p.id !== "string" ||
    !p.id ||
    typeof p.name !== "string" ||
    !Array.isArray(p.pages) ||
    !p.pages.length ||
    new Set(p.pages.map((x) => x.id)).size !== p.pages.length ||
    p.pages.some(
      (x) =>
        !x ||
        typeof x.id !== "string" ||
        !x.id ||
        !Array.isArray(x.components) ||
        !Array.isArray(x.wires) ||
        !x.plotFrame,
    ) ||
    !p.pages.some((x) => x.id === p.activePageId)
  )
    throw Error("Ungültiger Projektstand.");
}
function text(v: string, max: number) {
  if (typeof v !== "string" || !v.trim() || v.length > max)
    throw Error("Name, Bearbeiter und Änderungsgrund müssen ausgefüllt sein.");
  return v.trim();
}
function metadata(r: SavedProjectRevision) {
  if (
    !r ||
    r.schemaVersion !== 1 ||
    r.encoding !== "gzip-base64" ||
    typeof r.id !== "string" ||
    !r.id ||
    !["draft", "released"].includes(r.status) ||
    !/^[a-f0-9]{64}$/.test(r.digest) ||
    !Number.isInteger(r.bytes) ||
    r.bytes < 1 ||
    r.bytes > MAX_SNAPSHOT ||
    !Number.isInteger(r.pages) ||
    r.pages < 1 ||
    typeof r.payload !== "string" ||
    r.payload.length > MAX_ARCHIVE ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(r.payload) ||
    !Number.isFinite(Date.parse(r.created))
  )
    throw Error("Ungültiger Revisionsdatensatz.");
  text(r.name, 120);
  text(r.author, 120);
  text(r.reason, 2000);
  if (r.status === "released") {
    if (!r.approval || !Number.isFinite(Date.parse(r.approval.at)))
      throw Error("Freigabenachweis fehlt.");
    text(r.approval.author, 120);
    text(r.approval.reason, 2000);
  } else if (r.approval) throw Error("Ungültiger Freigabestatus.");
}
export function savedRevisions(project: Project): SavedProjectRevision[] {
  if (project.revisions === undefined) return [];
  if (!Array.isArray(project.revisions) || project.revisions.length > 1000)
    throw Error("Ungültiges Revisionsarchiv.");
  const ids = new Set<string>();
  let bytes = 0;
  for (const r of project.revisions) {
    metadata(r);
    if (ids.has(r.id)) throw Error("Revisionskennung mehrfach vorhanden.");
    ids.add(r.id);
    bytes += r.payload.length;
  }
  if (bytes > MAX_ARCHIVE)
    throw Error(
      "Revisionsarchiv überschreitet 64 MiB. Stände vor weiteren Sicherungen als Projektdateien exportieren.",
    );
  return project.revisions;
}
function base64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 32768)
    s += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(s);
}
export async function readProjectRevision(
  record: SavedProjectRevision,
): Promise<Project> {
  metadata(record);
  const raw = atob(record.payload),
    chunks: Uint8Array[] = [];
  let size = 0;
  const unzip = new Gunzip((chunk) => {
    size += chunk.length;
    if (size > record.bytes || size > MAX_SNAPSHOT)
      throw Error("Beschädigter oder übergroßer Projektstand.");
    chunks.push(chunk);
  });
  const compressed = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  // Bound each expansion step before accepting another compressed chunk.
  for (let i = 0; i < compressed.length; i += 4096)
    unzip.push(compressed.subarray(i, i + 4096), i + 4096 >= compressed.length);
  if (size !== record.bytes)
    throw Error("Größe des Projektstands stimmt nicht überein.");
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  if ((await sha256(bytes)) !== record.digest)
    throw Error("Integritätsprüfung des Projektstands fehlgeschlagen.");
  const project = JSON.parse(strFromU8(bytes)) as Project;
  validProject(project);
  if (
    project.revisions !== undefined ||
    project.revisionOriginId !== undefined ||
    project.pages.length !== record.pages
  )
    throw Error("Ungültiger verschachtelter Projektstand.");
  return project;
}
export async function saveProjectRevision(
  project: Project,
  input: { name: string; author: string; reason: string },
): Promise<Project> {
  validProject(project);
  const existing = savedRevisions(project);
  const name = text(input.name, 120),
    author = text(input.author, 120),
    reason = text(input.reason, 2000);
  if (
    existing.some(
      (r) => r.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    )
  )
    throw Error("Dieser Revisionsname ist bereits vergeben.");
  const bytes = strToU8(stableProjectJson(content(project)));
  if (bytes.length > MAX_SNAPSHOT)
    throw Error("Projektstand überschreitet 128 MiB.");
  const record: SavedProjectRevision = {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name,
    author,
    reason,
    created: new Date().toISOString(),
    status: "draft",
    encoding: "gzip-base64",
    payload: base64(gzipSync(bytes)),
    digest: await sha256(bytes),
    bytes: bytes.length,
    pages: project.pages.length,
  };
  const next = { ...project, revisions: [...existing, record] };
  savedRevisions(next);
  return next;
}
function find(project: Project, id: string) {
  const record = savedRevisions(project).find((r) => r.id === id);
  if (!record) throw Error("Projektstand nicht gefunden.");
  return record;
}
/** Approval is an attributed workflow record, not a digital signature. The payload never changes. */
export async function releaseProjectRevision(
  project: Project,
  id: string,
  author: string,
  reason: string,
): Promise<Project> {
  const record = find(project, id);
  if (record.status === "released")
    throw Error("Freigegebene Stände können nicht geändert werden.");
  if ((await readProjectRevision(record)).id !== project.id)
    throw Error("Projektstand gehört zu einem anderen Projekt.");
  const approval = {
    author: text(author, 120),
    reason: text(reason, 2000),
    at: new Date().toISOString(),
  };
  return {
    ...project,
    revisions: project.revisions!.map((r) =>
      r.id === id ? { ...r, status: "released", approval } : r,
    ),
  };
}
export function removeProjectRevision(project: Project, id: string): Project {
  if (find(project, id).status === "released")
    throw Error("Freigegebene Stände können nicht gelöscht werden.");
  return {
    ...project,
    revisions: project.revisions!.filter((r) => r.id !== id),
  };
}
/** Restoring creates a working copy, keeps the archive and first saves the current drawing as a recovery revision. */
export async function restoreProjectRevision(
  project: Project,
  id: string,
  author: string,
  reason: string,
): Promise<Project> {
  const record = find(project, id),
    restored = await readProjectRevision(record);
  if (restored.id !== project.id)
    throw Error("Projektstand gehört zu einem anderen Projekt.");
  const backup = await saveProjectRevision(project, {
    name: `Vor Wiederherstellung ${new Date().toISOString()} ${crypto.randomUUID().slice(0, 6)}`,
    author,
    reason,
  });
  return {
    ...restored,
    revisions: backup.revisions,
    revisionOriginId: id,
    modified: new Date().toISOString(),
  };
}

function fields(
  a: unknown,
  b: unknown,
  path = "",
  depth = 0,
): RevisionFieldChange[] {
  if (stableProjectJson(a) === stableProjectJson(b)) return [];
  if (
    depth < 4 &&
    a &&
    b &&
    typeof a === "object" &&
    typeof b === "object" &&
    !Array.isArray(a) &&
    !Array.isArray(b)
  ) {
    const x = a as Record<string, unknown>,
      y = b as Record<string, unknown>;
    return [...new Set([...Object.keys(x), ...Object.keys(y)])]
      .sort()
      .flatMap((k) => fields(x[k], y[k], path ? `${path}.${k}` : k, depth + 1));
  }
  return [
    {
      path: path || "$",
      before: structuredClone(a),
      after: structuredClone(b),
    },
  ];
}
/** Identity-based comparison; navigation, timestamps and derived pin wire caches are not engineering changes. */
export function compareProjectRevisions(
  before: Project,
  after: Project,
  beforeName = "Vorher",
  afterName = "Arbeitsstand",
): RevisionComparison {
  if (before.id !== after.id)
    throw Error("Nur Stände desselben Projekts können verglichen werden.");
  validProject(before);
  validProject(after);
  const changes: RevisionChange[] = [];
  const add = (
    kind: string,
    id: string,
    a: unknown,
    b: unknown,
    page?: Page,
    label = id,
  ) => {
    const diff = fields(a, b);
    if (!diff.length) return;
    changes.push({
      key: JSON.stringify([kind, page?.id, id]),
      kind,
      id,
      pageId: page?.id,
      pageNumber: page?.pageNumber,
      label,
      status:
        a === undefined ? "added" : b === undefined ? "removed" : "changed",
      fields: diff,
    });
  };
  const records = (kind: string, a: any[] = [], b: any[] = [], page?: Page) => {
    for (const list of [a, b])
      if (new Set(list.map((x) => x.id)).size !== list.length)
        throw Error(`Mehrdeutige Objektkennungen: ${kind}`);
    const x = new Map(a.map((x) => [x.id, x])),
      y = new Map(b.map((x) => [x.id, x]));
    for (const id of new Set([...x.keys(), ...y.keys()])) {
      const left = x.get(id),
        right = y.get(id),
        obj = right ?? left;
      const clean = (v: any) => {
        if (kind !== "component" || !v?.pins) return v;
        return {
          ...v,
          pins: Object.fromEntries(
            Object.entries(v.pins).map(([k, p]) => {
              const { wireIds, ...rest } = p as any;
              return [k, rest];
            }),
          ),
        };
      };
      add(
        kind,
        id,
        clean(left),
        clean(right),
        page,
        obj.bmk || obj.name || obj.title || obj.wireNumber || obj.text || id,
      );
    }
  };
  const collections = [
    "components",
    "wires",
    "texts",
    "cables",
    "boxes",
    "images",
    "groups",
  ] as const;
  const kinds = ["component", "wire", "text", "cable", "box", "image", "group"];
  const p1 = new Map(before.pages.map((p) => [p.id, p])),
    p2 = new Map(after.pages.map((p) => [p.id, p]));
  for (const id of new Set([...p1.keys(), ...p2.keys()])) {
    const a = p1.get(id),
      b = p2.get(id),
      page = b ?? a!;
    const header = (p?: Page) =>
      p &&
      Object.fromEntries(
        Object.entries(p).filter(([k]) => !collections.includes(k as any)),
      );
    add(
      "page",
      id,
      header(a),
      header(b),
      page,
      page.pageNumber + " · " + page.title,
    );
    collections.forEach((key, i) =>
      records(kinds[i], a?.[key], b?.[key], page),
    );
  }
  const projectCollections = [
    "symbolLibrary",
    "logicalConnections",
    "dimensioning",
    "cabinetLayouts",
    "plannedDevices",
    "physicalDevices",
    "manufacturingReportTemplates",
  ] as const;
  projectCollections.forEach((key) =>
    records(key, before[key] as any[], after[key] as any[]),
  );
  const header = (p: Project) => ({
    ...Object.fromEntries(
      Object.entries(content(p)).filter(
        ([k]) =>
          ![
            "pages",
            "activePageId",
            "modified",
            ...projectCollections,
          ].includes(k),
      ),
    ),
    pageOrder: p.pages.map((p) => p.id),
  });
  add(
    "project",
    before.id,
    header(before),
    header(after),
    undefined,
    after.name,
  );
  return {
    schemaVersion: 1,
    projectId: after.id,
    before: beforeName,
    after: afterName,
    summary: {
      added: changes.filter((c) => c.status === "added").length,
      removed: changes.filter((c) => c.status === "removed").length,
      changed: changes.filter((c) => c.status === "changed").length,
    },
    changes,
  };
}
/** Async dialogs must recheck the whole project after compression/hash/decode finishes. */
export function assertRevisionSource(project: Project, baseline: string) {
  if (projectRevision(project) !== baseline)
    throw Error("Projekt wurde verändert. Bitte den Dialog aktualisieren.");
}
