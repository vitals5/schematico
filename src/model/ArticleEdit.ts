import {CrossReferenceEngine} from './CrossReferenceEngine';
import type { AssignedArticle, ComponentAddress } from './ArticleTypes';
import type { Project } from './types';
import { projectRevision } from '../layout/types';
import {
  DeviceRegistry,
  addressKey,
  linkPhysicalDevice,
} from './DeviceRegistry';
import {
  effectiveArticles,
  setArticleAssignment,
  validateAssignments,
} from './ArticleAssignments';
import { articleCompatibility } from './ArticleCompatibility';
export type ArticleEdit =
  | { kind: 'assign'; targets: ComponentAddress[]; items: AssignedArticle[] }
  | { kind: 'link'; targets: ComponentAddress[]; main: ComponentAddress }
  | { kind: 'unlink'; deviceIds: string[] }
  | {
      kind: 'function';
      targets: ComponentAddress[];
      functionId: string;
      functionType: string;
    };
export class ArticleEditPlan {
  readonly #base: string;
  readonly #result: Project;
  readonly changes: {
    address: ComponentAddress;
    before: AssignedArticle[];
    after: AssignedArticle[];
    compatibility: ReturnType<typeof articleCompatibility>;
  }[];
  constructor(project: Project, edit: ArticleEdit) {
    this.#base = projectRevision(project);
    const result = structuredClone(project),
      registry = new DeviceRegistry(result);
    if (edit.kind === 'unlink') {
      if (
        !edit.deviceIds.length ||
        new Set(edit.deviceIds).size !== edit.deviceIds.length ||
        edit.deviceIds.some(
          (id) => !result.physicalDevices?.some((d) => d.id === id),
        )
      )
        throw new Error('articlesSelectionInvalid');
      result.physicalDevices = result.physicalDevices?.filter(
        (d) => !edit.deviceIds.includes(d.id),
      );
    } else {
      if (
        !edit.targets.length ||
        new Set(edit.targets.map(addressKey)).size !== edit.targets.length ||
        edit.targets.some((a) => !registry.placement(a))
      )
        throw new Error('articlesSelectionInvalid');
      if (edit.kind === 'link')
        linkPhysicalDevice(result, edit.targets, edit.main);
      if (edit.kind === 'assign') {
        const items = validateAssignments(edit.items);
        for (const a of edit.targets)
          setArticleAssignment(registry.placement(a)!.component, items);
      }
      if (edit.kind === 'function')
        for (const a of edit.targets) {
          const c = registry.placement(a)!.component;
          c.articleFunctionId = edit.functionId.trim();
          c.articleFunctionType = edit.functionType.trim();
        }
    }
    if(edit.kind==='link'||edit.kind==='unlink')CrossReferenceEngine.updateDeviceCrossReferences(result);
    const afterRegistry = new DeviceRegistry(result);
    // Assignment changes must not silently invalidate an existing verified device.
    if (edit.kind === 'assign' || edit.kind === 'function') {
      const oldIssues = new Set(
        registry.issues.map((i) => JSON.stringify([i.deviceId, i.code])),
      );
      if (
        afterRegistry.issues.some(
          (i) => !oldIssues.has(JSON.stringify([i.deviceId, i.code])),
        )
      )
        throw new Error('articlesDeviceConflict');
    }
    this.changes = (
      edit.kind === 'unlink'
        ? (project.physicalDevices
            ?.filter((d) => edit.deviceIds.includes(d.id))
            .flatMap((d) => d.members) ?? [])
        : edit.targets
    )
      .filter((address) => afterRegistry.placement(address))
      .map((address) => ({
        address,
        before: effectiveArticles(
          registry.placement(address)!.component,
          project,
        ),
        after: effectiveArticles(
          afterRegistry.placement(address)!.component,
          result,
        ),
        compatibility: articleCompatibility(result, address, afterRegistry),
      }));
    // Comparison rows use the original target, not the mutated working clone.
    const original = new DeviceRegistry(project);
    for (const row of this.changes)
      row.before = effectiveArticles(
        original.placement(row.address)!.component,
        project,
      );
    this.#result = result;
  }
  apply(project: Project) {
    if (projectRevision(project) !== this.#base)
      throw new Error('articlesProjectStale');
    const result = structuredClone(this.#result);
    result.activePageId = project.activePageId;
    result.modified = new Date().toISOString();
    return result;
  }
}
