import type { Project } from "./types";
import type { ComponentAddress } from "./ArticleTypes";
import { ProjectHistory } from "./ProjectHistory";
import { projectRevision } from "../layout/types";
import { WiringEditPlan, type WiringEdit } from "./WiringManagement";
import {
  TerminalStripEditPlan,
  terminalDrawingGroup,
  type TerminalStripEdit,
} from "./TerminalStrips";
import {
  TerminalDistributionPlan,
  type TerminalDistributionEdit,
} from "./TerminalDistribution";
import { ArticleEditPlan, type ArticleEdit } from "./ArticleEdit";
import { ArticleFunctionPlan } from "./ArticleFunctions";
import { validateTerminalComponentEdit } from "./TerminalEditValidation";

// History restores root fields in a different insertion order. Compare their
// sorted header keys so undoing all edits is recognised as the original draft.
const draftContent = (p: Project) =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(p)
        .filter(([key]) => key !== "activePageId" && key !== "modified")
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
  );

/** One isolated draft for every terminal operation. Applying it creates one
 * application history entry; cancelling it never changes the live project. */
export class TerminalEditorSession {
  readonly baseRevision: string;
  private original: Project;
  private draft: Project;
  private dirty = false;
  private history = new ProjectHistory(30, 16 * 1024 * 1024);
  constructor(project: Project) {
    this.baseRevision = projectRevision(project);
    this.original = structuredClone(project);
    this.draft = structuredClone(project);
    this.history.reset(this.draft);
  }
  get baseline(): Project {
    return this.original;
  }
  get project(): Project {
    return this.draft;
  }
  get changed() {
    return this.dirty;
  }
  get canUndo() {
    return this.history.canUndo;
  }
  get canRedo() {
    return this.history.canRedo;
  }
  private record(next: Project) {
    this.history.record(next);
    this.draft = next;
    this.dirty = draftContent(next) !== draftContent(this.original);
  }
  wiring(edit: WiringEdit, functionText?: string) {
    const next = new WiringEditPlan(this.draft, edit).apply(this.draft);
    if (edit.kind === "terminal" && functionText !== undefined) {
      const c = next.pages
        .find((p) => p.id === edit.target.pageId)!
        .components.find((c) => c.id === edit.target.componentId)!;
      c.functionText = functionText;
      validateTerminalComponentEdit(next, c);
    }
    this.record(next);
  }
  strip(edit: TerminalStripEdit) {
    this.record(new TerminalStripEditPlan(this.draft, edit).apply(this.draft));
  }
  distribution(edit: TerminalDistributionEdit) {
    this.record(
      new TerminalDistributionPlan(this.draft, edit).apply(this.draft),
    );
  }
  article(edit: ArticleEdit) {
    if (
      edit.kind !== "unlink" &&
      edit.targets.some((a) => terminalDrawingGroup(this.draft, a))
    )
      throw new Error("terminalStripDrawingGroup");
    this.record(new ArticleEditPlan(this.draft, edit).apply(this.draft));
  }
  functions(
    targets: ComponentAddress[],
    choices: Parameters<ArticleFunctionPlan["apply"]>[1],
    confirmType = false,
    confirmReplace = false,
  ) {
    if (targets.some((a) => terminalDrawingGroup(this.draft, a)))
      throw new Error("terminalStripDrawingGroup");
    this.record(
      new ArticleFunctionPlan(this.draft, targets).apply(
        this.draft,
        choices,
        confirmType,
        confirmReplace,
      ),
    );
  }
  /** Compound operations, e.g. initialise + split/group, are locally atomic. */
  transaction(change: (session: TerminalEditorSession) => void) {
    const temporary = new TerminalEditorSession(this.draft);
    change(temporary);
    this.record(temporary.project);
  }
  undo() {
    const p = this.history.undo();
    if (p) {
      this.draft = p;
      this.dirty = draftContent(p) !== draftContent(this.original);
    }
  }
  redo() {
    const p = this.history.redo();
    if (p) {
      this.draft = p;
      this.dirty = draftContent(p) !== draftContent(this.original);
    }
  }
  reset() {
    this.draft = structuredClone(this.original);
    this.history.reset(this.draft);
    this.dirty = false;
  }
  apply(live: Project) {
    if (projectRevision(live) !== this.baseRevision)
      throw new Error("articlesProjectStale");
    const next = structuredClone(this.draft);
    next.activePageId = live.activePageId;
    next.modified = new Date().toISOString();
    return next;
  }
}
