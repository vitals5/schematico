import { CrossReferenceEngine } from './CrossReferenceEngine';
import type { ComponentAddress } from './ArticleTypes';
import type { Project } from './types';
import { DeviceRegistry, addressKey } from './DeviceRegistry';
import { effectiveArticles, primaryArticle } from './ArticleAssignments';
import { functionType } from './FunctionDefinitions';
import { getSymbolForComponent } from './symbols';
import { projectRevision } from '../layout/types';
export interface FunctionSuggestion {
  address: ComponentAddress;
  bmk: string;
  article: string;
  actualType?: string;
  actualPins: string[];
  current?: string;
  candidates: {
    id: string;
    type: string;
    pins: string[];
    needsTypeConfirmation: boolean;
    unverified: boolean;
  }[];
}
export function articleFunctions(
  project: Project,
  targets: ComponentAddress[],
): FunctionSuggestion[] {
  const registry = new DeviceRegistry(project);
  return targets.map((address) => {
    const e = registry.placement(address);
    if (!e) throw new Error('articlesSelectionInvalid');
    const s = getSymbolForComponent(e.component, project),
      owner = registry.owner(address)!,
      article = primaryArticle(effectiveArticles(owner.component, project)),
      type = e.component.articleFunctionType ?? (s && functionType(s)),
      pins =
        s?.pins
          .map((p) => (e.component.pins[p.id]?.customLabel ?? p.name).trim())
          .sort() ?? [];
    return {
      address: structuredClone(address),
      bmk: e.component.bmk,
      article: article?.articleNumber ?? '',
      actualType: type,
      actualPins: pins,
      current: e.component.articleFunctionId,
      candidates:
        (!s?.unresolved && pins.length
          ? article?.snapshot?.functions?.filter(
              (f) =>
                JSON.stringify([...f.pins].sort()) === JSON.stringify(pins) &&
                (!type || f.type === type),
            )
          : []
        )?.map((f) => ({
          ...structuredClone(f),
          needsTypeConfirmation: !type,
          unverified: article?.snapshot?.verification !== 'user_checked',
        })) ?? [],
    };
  });
}
export class ArticleFunctionPlan {
  readonly rows: readonly FunctionSuggestion[];
  readonly #source: Project;
  readonly #base: string;
  readonly #allowed: Set<string>;
  constructor(project: Project, targets: ComponentAddress[]) {
    if (
      !targets.length ||
      new Set(targets.map(addressKey)).size !== targets.length
    )
      throw new Error('articlesSelectionInvalid');
    this.#source = structuredClone(project);
    this.#base = projectRevision(project);
    this.rows = articleFunctions(this.#source, targets);
    this.#allowed = new Set(targets.map(addressKey));
  }
  apply(
    project: Project,
    choices: { address: ComponentAddress; functionId: string }[],
    confirmType = false,
    confirmReplace = false,
  ) {
    if (projectRevision(project) !== this.#base)
      throw new Error('articlesProjectStale');
    if (
      !choices.length ||
      new Set(choices.map((c) => addressKey(c.address))).size !== choices.length
    )
      throw new Error('articlesSelectionInvalid');
    const allowed = this.#allowed,
      rows = articleFunctions(
        this.#source,
        choices.map((c) => c.address),
      ),
      result = structuredClone(this.#source),
      registry = new DeviceRegistry(result);
    for (let i = 0; i < choices.length; i++) {
      const row = rows[i],
        choice = choices[i],
        candidate = row.candidates.find((f) => f.id === choice.functionId);
      if (!allowed.has(addressKey(choice.address)) || !candidate)
        throw new Error('functionNoCandidate');
      if (
        (candidate.needsTypeConfirmation && !confirmType) ||
        (row.current && row.current !== candidate.id && !confirmReplace)
      )
        throw new Error('repairConfirmation');
      const c = registry.placement(choice.address)!.component;
      c.articleFunctionId = candidate.id;
      if (candidate.needsTypeConfirmation)
        c.articleFunctionType = candidate.type;
      c.articleFunctionEvidence = {
        method: candidate.needsTypeConfirmation
          ? 'user_confirmed'
          : 'exact_type_and_pins',
        article: row.article,
        functionId: candidate.id,
        pins: [...row.actualPins],
      };
    }
    CrossReferenceEngine.updateDeviceCrossReferences(result);
    result.activePageId = project.activePageId;
    result.modified = new Date().toISOString();
    return result;
  }
}
