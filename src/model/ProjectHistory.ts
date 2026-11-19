import { Project } from "./types";

type Snapshot = {
  header: string;
  archive?: { records: NonNullable<Project["revisions"]>; metadata: string[] };
  library?: string;
  pages: { id: string; json: string }[];
  activePageId: string;
  modified: string;
};

/** Session history; unchanged pages and library data share their serialized state. */
export class ProjectHistory {
  private released = new Map<
    string,
    NonNullable<Project["revisions"]>[number]
  >();
  private present?: Snapshot;
  private past: Snapshot[] = [];
  private future: Snapshot[] = [];
  private group?: string;

  constructor(
    private limit = 100,
    private maxBytes = 32 * 1024 * 1024,
  ) {}
  get canUndo(): boolean {
    return this.past.length > 0;
  }
  get canRedo(): boolean {
    return this.future.length > 0;
  }

  reset(project: Project): void {
    this.released.clear();
    this.rememberReleases(project);
    this.present = this.capture(project);
    this.past = [];
    this.future = [];
    this.group = undefined;
  }

  breakGroup(): void {
    this.group = undefined;
  }

  record(project: Project, group?: string): boolean {
    if (!this.present) {
      this.reset(project);
      return false;
    }
    this.rememberReleases(project);
    const next = this.capture(project, this.present);
    if (this.sameData(next, this.present)) {
      if (!group) this.breakGroup();
      return false;
    }
    // Navigation is view state. Undo returns to the page on which the edit was
    // made, including an edit made immediately after changing pages.
    if (!group || group !== this.group)
      this.past.push({ ...this.present, activePageId: project.activePageId });
    const coalescing = group && group === this.group;
    this.present = next;
    this.future = [];
    this.group = group;
    if (
      coalescing &&
      this.past.length &&
      this.sameData(next, this.past.at(-1)!)
    ) {
      this.past.pop();
      this.breakGroup();
    }
    while (
      this.past.length > this.limit ||
      (this.past.length > 1 && this.retainedBytes() > this.maxBytes)
    )
      this.past.shift();
    return true;
  }

  undo(): Project | undefined {
    const previous = this.past.pop();
    if (!previous || !this.present) return;
    this.future.push({ ...this.present, activePageId: previous.activePageId });
    const restored = this.protectReleases(this.restore(previous));
    this.present = this.capture(restored);
    this.breakGroup();
    return restored;
  }

  redo(): Project | undefined {
    const next = this.future.pop();
    if (!next || !this.present) return;
    this.past.push({ ...this.present, activePageId: next.activePageId });
    const restored = this.protectReleases(this.restore(next));
    this.present = this.capture(restored);
    this.breakGroup();
    return restored;
  }

  private sameData(a: Snapshot, b: Snapshot): boolean {
    return (
      a.header === b.header &&
      a.archive === b.archive &&
      a.library === b.library &&
      a.pages.length === b.pages.length &&
      a.pages.every(
        (p, i) => p.id === b.pages[i].id && p.json === b.pages[i].json,
      )
    );
  }

  private capture(project: Project, previous?: Snapshot): Snapshot {
    const { pages, symbolLibrary, activePageId, modified, revisions, ...rest } =
      project;
    const header =
      revisions !== undefined && !Array.isArray(revisions)
        ? { ...rest, revisions }
        : rest;
    let archive: Snapshot["archive"];
    if (Array.isArray(revisions)) {
      // Never stringify compressed archive payloads during a drawing edit.
      // Copy records once per changed archive; immutable strings share storage.
      const metadata = revisions.map((r) =>
        JSON.stringify({ ...r, payload: undefined }),
      );
      const prior = previous?.archive;
      archive =
        prior &&
        metadata.length === prior.metadata.length &&
        metadata.every(
          (s, i) =>
            s === prior.metadata[i] &&
            revisions[i]?.payload === prior.records[i]?.payload,
        )
          ? prior
          : { records: structuredClone(revisions), metadata };
    }
    const share = (value: string, old?: string) =>
      value === old ? old! : value;
    const oldPages = new Map(previous?.pages.map((p) => [p.id, p]));
    return {
      header: share(JSON.stringify(header), previous?.header),
      archive,
      library: symbolLibrary
        ? share(JSON.stringify(symbolLibrary), previous?.library)
        : undefined,
      pages: pages.map((page) => ({
        id: page.id,
        json: share(JSON.stringify(page), oldPages.get(page.id)?.json),
      })),
      activePageId,
      modified,
    };
  }

  private restore(s: Snapshot): Project {
    return {
      ...JSON.parse(s.header),
      pages: s.pages.map((p) => JSON.parse(p.json)),
      ...(s.archive ? { revisions: structuredClone(s.archive.records) } : {}),
      ...(s.library ? { symbolLibrary: JSON.parse(s.library) } : {}),
      activePageId: s.pages.some((p) => p.id === s.activePageId)
        ? s.activePageId
        : (s.pages[0]?.id ?? s.activePageId),
      modified: s.modified,
    };
  }

  private retainedBytes(): number {
    const strings = new Set<string>();
    for (const s of [...this.past, ...this.future, this.present!]) {
      strings.add(s.header);
      if (s.archive) {
        for (const value of s.archive.metadata) strings.add(value);
        for (const r of s.archive.records)
          if (typeof r?.payload === "string") strings.add(r.payload);
      }
      if (s.library) strings.add(s.library);
      for (const p of s.pages) strings.add(p.json);
    }
    return [...strings].reduce((sum, s) => sum + s.length * 2, 0);
  }

  /** Released archive records survive drawing undo. Opening another project resets this registry. */
  private rememberReleases(project: Project) {
    if (Array.isArray(project.revisions))
      for (const r of project.revisions)
        if (r?.status === "released" && !this.released.has(r.id))
          this.released.set(r.id, structuredClone(r));
  }
  private protectReleases(project: Project): Project {
    if (!this.released.size) return project;
    const records = Array.isArray(project.revisions) ? project.revisions : [];
    const ids = new Set(records.map((r) => r.id));
    return {
      ...project,
      revisions: [
        ...records.map((r) =>
          this.released.has(r.id)
            ? structuredClone(this.released.get(r.id)!)
            : r,
        ),
        ...[...this.released.values()]
          .filter((r) => !ids.has(r.id))
          .map((r) => structuredClone(r)),
      ],
    };
  }
}
