import type {
  Project,
  PlacedComponent,
  ImportedArticleReference,
} from './types';
import { ProjectIndex } from './ProjectIndex';
import { projectRevision } from '../layout/types';
import { sha256 } from './SourceIdentity';
export type ArticleSyncStatus =
  | 'fill'
  | 'enrich'
  | 'evidence'
  | 'unchanged'
  | 'conflict'
  | 'ambiguous'
  | 'missing_source'
  | 'missing_identity'
  | 'different_source'
  | 'source_unread'
  | 'identity_conflict'
  | 'excluded';
export interface ArticleSyncRow {
  id: string;
  pageId: string;
  pageNumber: string;
  componentId: string;
  bmk: string;
  status: ArticleSyncStatus;
  sourceComponentId?: string;
  needsSourceConfirmation: boolean;
  reasons: string[];
  current: {
    number?: string;
    manufacturer?: string;
    references: number;
    items: ImportedArticleReference[];
  };
  incoming: {
    number?: string;
    manufacturer?: string;
    references: number;
    items: ImportedArticleReference[];
  };
}
const identity = (c: PlacedComponent) =>
  c.source
    ? JSON.stringify([c.source.objectType, c.source.objectId])
    : undefined;
const normal = (value: string | undefined) => value?.trim() ?? '';
const referenceValue = (r: ImportedArticleReference) => ({
  sourceId: r.sourceId,
  ownerType: r.ownerType,
  ownerId: r.ownerId,
  articleNumber: r.articleNumber,
  variant: r.variant,
  position: r.position,
  quantity: r.quantity,
  manufacturer: r.manufacturer,
});
const referenceList = (c: PlacedComponent) =>
  JSON.stringify(
    (c.articleReferences ?? [])
      .map(referenceValue)
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  );
const editable = (status: ArticleSyncStatus) =>
  ['fill', 'enrich', 'evidence'].includes(status);
/** Only a coherent, unchanged native article snapshot can supply assignments. */
function readableSource(c: PlacedComponent, digest: string) {
  const refs = c.articleReferences ?? [],
    first = refs.filter((r) => r.position === 1);
  const primary =
    first.length === 1 ? first[0] : refs.length === 1 ? refs[0] : undefined;
  return (
    c.source?.datasetId === digest &&
    c.articleImport?.source === 'native_project' &&
    c.articleImport.status === 'record_read' &&
    normal(c.articleNumber) === normal(primary?.articleNumber) &&
    normal(c.manufacturer) === normal(primary?.manufacturer) &&
    c.articleImport.observedArticleNumber ===
      (refs.length ? primary?.articleNumber : '') &&
    refs.every(
      (r) =>
        r.sourceDatasetId === digest &&
        r.ownerType === c.source!.objectType &&
        r.ownerId === c.source!.objectId,
    )
  );
}
async function revision(p: Project) {
  return sha256(new TextEncoder().encode(projectRevision(p)));
}
function rowsFor(target: Project, source: Project): ArticleSyncRow[] {
  const src = new ProjectIndex(source),
    dest = new ProjectIndex(target),
    digest = source.nativeSourceIdentity?.digest;
  if (
    source.nativeSourceIdentity?.algorithm !== 'sha256-native-tables-v1' ||
    !digest ||
    !/^[0-9a-f]{64}$/.test(digest)
  )
    throw new Error('articleSyncInvalidSource');
  const bySource = new Map<string, typeof src.components>();
  for (const e of src.components) {
    const key = identity(e.component);
    if (key) bySource.set(key, [...(bySource.get(key) ?? []), e]);
  }
  const byTarget = new Map<string, typeof dest.components>();
  for (const e of dest.components) {
    const key = identity(e.component);
    if (
      key &&
      (!e.component.source?.datasetId ||
        e.component.source.datasetId === digest)
    )
      byTarget.set(key, [...(byTarget.get(key) ?? []), e]);
  }
  return dest.components.map((entry) => {
    const c = entry.component,
      key = identity(c),
      matches = key ? (bySource.get(key) ?? []) : [],
      s = matches[0];
    const row: ArticleSyncRow = {
      id: JSON.stringify([entry.page.id, c.id]),
      pageId: entry.page.id,
      pageNumber: entry.page.pageNumber,
      componentId: c.id,
      bmk: entry.tag,
      status: 'missing_identity',
      needsSourceConfirmation: !c.source?.datasetId,
      reasons: [],
      current: {
        number: c.articleNumber,
        manufacturer: c.manufacturer,
        references: c.articleReferences?.length ?? 0,
        items: structuredClone(c.articleReferences ?? []),
      },
      incoming: { references: 0, items: [] },
    };
    if (!key) return row;
    if (c.source?.datasetId && c.source.datasetId !== digest) {
      row.status = 'different_source';
      return row;
    }
    if (
      matches.length > 1 ||
      (byTarget.get(key)?.length ?? 0) > 1 ||
      dest.componentsById.get(c.id)?.length !== 1
    ) {
      row.status = 'ambiguous';
      return row;
    }
    if (!s) {
      row.status = 'missing_source';
      return row;
    }
    if (src.componentsById.get(s.component.id)?.length !== 1) {
      row.status = 'ambiguous';
      return row;
    }
    row.sourceComponentId = s.component.id;
    row.incoming = {
      number: s.component.articleNumber,
      manufacturer: s.component.manufacturer,
      references: s.component.articleReferences?.length ?? 0,
      items: structuredClone(s.component.articleReferences ?? []),
    };
    if (c.articleRequirement === 'none') {
      row.status = 'excluded';
      return row;
    }
    if (!readableSource(s.component, digest)) {
      row.status = 'source_unread';
      return row;
    }
    if (row.needsSourceConfirmation) {
      const a = entry.symbol?.source,
        b = s.symbol?.source;
      if (
        !a ||
        !b ||
        a.library !== b.library ||
        a.number !== b.number ||
        a.variant !== b.variant
      )
        row.reasons.push('symbol');
      if (entry.structure.plant !== s.structure.plant)
        row.reasons.push('plant');
      if (entry.structure.location !== s.structure.location)
        row.reasons.push('location');
      if (entry.tag !== s.tag) row.reasons.push('designation');
      if (row.reasons.length) {
        row.status = 'identity_conflict';
        return row;
      }
    }
    if(c.articleAssignment){row.status='conflict';row.reasons.push('manual_assignment');return row;}
    const observed = c.articleImport?.observedArticleNumber;
    if (observed !== undefined && normal(c.articleNumber) !== normal(observed))
      row.reasons.push('manual_assignment');
    if (
      normal(c.articleNumber) &&
      normal(c.articleNumber) !== normal(s.component.articleNumber)
    )
      row.reasons.push('article_number');
    if (
      normal(s.component.manufacturer) &&
      ((normal(c.manufacturer) &&
        normal(c.manufacturer) !== normal(s.component.manufacturer)) ||
        (c.articleImport?.status === 'record_read' && c.manufacturer === ''))
    )
      row.reasons.push('manufacturer');
    if (
      c.articleReferences?.length &&
      referenceList(c) !== referenceList(s.component)
    )
      row.reasons.push('reference_list');
    if (row.reasons.length) {
      row.status = 'conflict';
      return row;
    }
    if (
      JSON.stringify(c.articleImport) ===
        JSON.stringify(s.component.articleImport) &&
      referenceList(c) === referenceList(s.component) &&
      normal(c.articleNumber) === normal(s.component.articleNumber) &&
      (!normal(s.component.manufacturer) ||
        normal(c.manufacturer) === normal(s.component.manufacturer)) &&
      !row.needsSourceConfirmation
    ) {
      row.status = 'unchanged';
      return row;
    }
    row.status = s.component.articleReferences?.length
      ? normal(c.articleNumber)
        ? 'enrich'
        : 'fill'
      : 'evidence';
    return row;
  });
}
/** A detached source and a target revision bind the preview to its inputs. Public
 * row DTOs are presentation only; Apply derives all proposed values again. */
export class ArticleSyncPlan {
  readonly rows: readonly ArticleSyncRow[];
  get sourceName() {
    return this.#source.name;
  }
  get sourceDigest() {
    return this.#source.nativeSourceIdentity!.digest;
  }
  #source: Project;
  #base: string;
  private constructor(source: Project, base: string, rows: ArticleSyncRow[]) {
    this.#source = source;
    this.#base = base;
    this.rows = rows;
  }
  static async create(target: Project, source: Project) {
    const snapshot = structuredClone(source),
      base = structuredClone(target);
    return new ArticleSyncPlan(
      snapshot,
      await revision(base),
      rowsFor(base, snapshot),
    );
  }
  async apply(
    target: Project,
    selected: readonly string[],
    confirmedSource = false,
  ): Promise<Project> {
    const base = structuredClone(target);
    if (
      (await revision(base)) !== this.#base ||
      projectRevision(base) !== projectRevision(target)
    )
      throw new Error('articleSyncStale');
    const rows = rowsFor(base, this.#source),
      byId = new Map(rows.map((r) => [r.id, r]));
    if (!selected.length || new Set(selected).size !== selected.length)
      throw new Error('articleSyncSelection');
    for (const id of selected) {
      const row = byId.get(id);
      if (!row || !editable(row.status))
        throw new Error('articleSyncSelection');
      if (row.needsSourceConfirmation && !confirmedSource)
        throw new Error('articleSyncConfirmRequired');
    }
    const result = base,
      sourceIndex = new ProjectIndex(this.#source),
      dest = new ProjectIndex(result);
    const remapped = new Map<string, string>(),
      library = (result.importedArticleLibrary ??= []),
      existing = new Map(library.map((m) => [m.id, m]));
    for (const master of this.#source.importedArticleLibrary ?? []) {
      let id = master.id,
        index = 1;
      while (
        existing.has(id) &&
        JSON.stringify({ ...existing.get(id), id: master.id }) !==
          JSON.stringify(master)
      )
        id =
          master.id + ':sync:' + this.sourceDigest.slice(0, 12) + ':' + index++;
      remapped.set(master.id, id);
      if (!existing.has(id)) {
        const copy = { ...structuredClone(master), id };
        library.push(copy);
        existing.set(id, copy);
      }
    }
    const copyRef = (r: ImportedArticleReference) => ({
      ...structuredClone(r),
      ...(r.masterDataId
        ? { masterDataId: remapped.get(r.masterDataId) ?? r.masterDataId }
        : {}),
    });
    for (const id of selected) {
      const row = byId.get(id)!,
        c = dest.component(row.componentId, row.pageId)!.component,
        s = sourceIndex.component(row.sourceComponentId!)!.component;
      if (!normal(c.articleNumber) && s.articleNumber !== undefined)
        c.articleNumber = s.articleNumber;
      if (!normal(c.manufacturer) && s.manufacturer !== undefined)
        c.manufacturer = s.manufacturer;
      c.articleReferences = (s.articleReferences ?? []).map(copyRef);
      c.articleImport = structuredClone(s.articleImport);
      if (c.source)
        c.source = {
          ...c.source,
          datasetId: this.sourceDigest,
          datasetVerification:
            c.source.datasetId === this.sourceDigest
              ? (c.source.datasetVerification ?? 'user_confirmed')
              : 'user_confirmed',
        };
    }
    result.importedArticleLibrary = library;
    const references = result.sourceArticleReferences ?? [],
      seen = new Set(references.map((r) => JSON.stringify(r)));
    for (const ref of this.#source.sourceArticleReferences ?? []) {
      const copy = copyRef(ref),
        key = JSON.stringify(copy);
      if (!seen.has(key)) {
        references.push(copy);
        seen.add(key);
      }
    }
    result.sourceArticleReferences = references;
    result.articleImportDiagnostics = [
      ...new Set([
        ...(result.articleImportDiagnostics ?? []),
        ...(this.#source.articleImportDiagnostics ?? []),
      ]),
    ];
    result.activePageId = target.activePageId;
    result.modified = new Date().toISOString();
    return result;
  }
}
export function isArticleSyncSelectable(row: ArticleSyncRow) {
  return editable(row.status);
}
