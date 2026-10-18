import { Project } from './types';

type Snapshot = {
  header: string;
  library?: string;
  pages: { id: string; json: string }[];
  activePageId: string;
  modified: string;
};

/** Session history; unchanged pages and library data share their serialized state. */
export class ProjectHistory {
  private present?: Snapshot;
  private past: Snapshot[] = [];
  private future: Snapshot[] = [];
  private group?: string;

  constructor(private limit = 100, private maxBytes = 32 * 1024 * 1024) {}
  get canUndo(): boolean { return this.past.length > 0; }
  get canRedo(): boolean { return this.future.length > 0; }

  reset(project: Project): void {
    this.present = this.capture(project);
    this.past = []; this.future = []; this.group = undefined;
  }

  breakGroup(): void { this.group = undefined; }

  record(project: Project, group?: string): boolean {
    if (!this.present) { this.reset(project); return false; }
    const next = this.capture(project, this.present);
    if (this.sameData(next, this.present)) { if (!group) this.breakGroup(); return false; }
    // Navigation is view state. Undo returns to the page on which the edit was
    // made, including an edit made immediately after changing pages.
    if (!group || group !== this.group) this.past.push({ ...this.present, activePageId: project.activePageId });
    const coalescing = group && group === this.group;
    this.present = next; this.future = []; this.group = group;
    if (coalescing && this.past.length && this.sameData(next, this.past.at(-1)!)) {
      this.past.pop(); this.breakGroup();
    }
    while (this.past.length > this.limit || this.past.length > 1 && this.retainedBytes() > this.maxBytes) this.past.shift();
    return true;
  }

  undo(): Project | undefined {
    const previous = this.past.pop();
    if (!previous || !this.present) return;
    this.future.push({ ...this.present, activePageId: previous.activePageId }); this.present = previous; this.breakGroup();
    return this.restore(previous);
  }

  redo(): Project | undefined {
    const next = this.future.pop();
    if (!next || !this.present) return;
    this.past.push({ ...this.present, activePageId: next.activePageId }); this.present = next; this.breakGroup();
    return this.restore(next);
  }

  private sameData(a: Snapshot, b: Snapshot): boolean {
    return a.header === b.header && a.library === b.library && a.pages.length === b.pages.length
      && a.pages.every((p, i) => p.id === b.pages[i].id && p.json === b.pages[i].json);
  }

  private capture(project: Project, previous?: Snapshot): Snapshot {
    const { pages, symbolLibrary, activePageId, modified, ...header } = project;
    const share = (value: string, old?: string) => value === old ? old! : value;
    const oldPages = new Map(previous?.pages.map(p => [p.id, p]));
    return {
      header: share(JSON.stringify(header), previous?.header),
      library: symbolLibrary ? share(JSON.stringify(symbolLibrary), previous?.library) : undefined,
      pages: pages.map(page => ({ id: page.id, json: share(JSON.stringify(page), oldPages.get(page.id)?.json) })),
      activePageId, modified
    };
  }

  private restore(s: Snapshot): Project {
    return { ...JSON.parse(s.header), pages: s.pages.map(p => JSON.parse(p.json)),
      ...(s.library ? { symbolLibrary: JSON.parse(s.library) } : {}), activePageId: s.activePageId, modified: s.modified };
  }

  private retainedBytes(): number {
    const strings = new Set<string>();
    for (const s of [...this.past, ...this.future, this.present!]) {
      strings.add(s.header);
      if (s.library) strings.add(s.library);
      for (const p of s.pages) strings.add(p.json);
    }
    return [...strings].reduce((sum, s) => sum + s.length * 2, 0);
  }
}
