import { CrossReferenceEngine } from './CrossReferenceEngine';
import type { ComponentAddress } from './ArticleTypes';
import type { Project } from './types';
import { DeviceRegistry, addressKey } from './DeviceRegistry';
import { effectiveArticles, primaryArticle } from './ArticleAssignments';
import { functionType } from './FunctionDefinitions';
import { getSymbolForComponent } from './symbols';
import { articleCompatibility } from './ArticleCompatibility';
import { projectRevision } from '../layout/types';
import {distributedTerminalBindings,terminalArticleFunction} from './DistributedTerminalTypes';
export interface FunctionSuggestion {
  address: ComponentAddress;
  bmk: string;
  article: string;
  actualType?: string;
  actualPins: string[];
  current?: string;
  sameFunctionAs?: ComponentAddress;
  devicePeers: { address: ComponentAddress; pageNumber: string; bmk: string }[];
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
  const terminals=targets.some(a=>registry.placement(a)?.component.terminal?.functionId)?distributedTerminalBindings(project):undefined;
  return targets.map((address) => {
    const e = registry.placement(address);
    if (!e) throw new Error('articlesSelectionInvalid');
    const s = getSymbolForComponent(e.component, project),
      owner = registry.owner(address)!,
      article = primaryArticle(effectiveArticles(owner.component, project)),
      logical=s?terminalArticleFunction(project,address,e.component,s,terminals):undefined,
      type = logical?.type,
      pins = logical?.pins??[];
    return {
      address: structuredClone(address),
      bmk: e.component.bmk,
      article: article?.articleNumber ?? '',
      actualType: type,
      actualPins: pins,
      current: logical?.current,
      sameFunctionAs: logical?.primary,
      devicePeers: (registry.forComponent(address)?.members ?? [])
        .filter((a) => addressKey(a) !== addressKey(address))
        .map((a) => {
          const peer = registry.placement(a)!;
          return {
            address: { ...a },
            pageNumber: peer.page.pageNumber,
            bmk: peer.component.bmk,
          };
        }),
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
    choices: {
      address: ComponentAddress;
      functionId: string;
      sameFunctionAs?: ComponentAddress;
    }[],
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
      if (choice.sameFunctionAs)
        c.articleFunctionRepresentation = {
          primary: structuredClone(choice.sameFunctionAs),
        };
      else delete c.articleFunctionRepresentation;
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
    const partials=choices.some(c=>registry.placement(c.address)?.component.terminal?.functionId)?distributedTerminalBindings(result):undefined;
    for(const f of partials?.valid.values()??[]){
      const selected=choices.filter(c=>f.placements.some(p=>addressKey(p.target)===addressKey(c.address)));if(!selected.length)continue;
      if(new Set(selected.map(c=>c.functionId)).size!==1)throw new Error('functionNoCandidate');
      const owner=registry.forComponent(selected[0].address)!.main;
      if(selected.some(c=>c.sameFunctionAs&&(addressKey(c.sameFunctionAs)!==addressKey(owner)||addressKey(c.address)===addressKey(owner))))throw new Error('functionRepresentationInvalid');
      const assignment=structuredClone(registry.placement(selected[0].address)!.component);
      for(const placement of f.placements){const c=registry.placement(placement.target)!.component;
        c.articleFunctionId=assignment.articleFunctionId;c.articleFunctionEvidence=structuredClone(assignment.articleFunctionEvidence);
        if(assignment.articleFunctionType===undefined)delete c.articleFunctionType;else c.articleFunctionType=assignment.articleFunctionType;
        if(addressKey(placement.target)===addressKey(owner))delete c.articleFunctionRepresentation;else c.articleFunctionRepresentation={primary:structuredClone(owner)};
      }
    }
    for (const choice of choices)
      if (choice.sameFunctionAs) {
        const review = articleCompatibility(
          result,
          choice.address,
          new DeviceRegistry(result),
        );
        if (
          review.issues.some(
            (i) =>
              i.code === 'function_representation_invalid' &&
              i.componentId === choice.address.componentId,
          )
        )
          throw new Error('functionRepresentationInvalid');
      }
    CrossReferenceEngine.updateDeviceCrossReferences(result);
    result.activePageId = project.activePageId;
    result.modified = new Date().toISOString();
    return result;
  }
}
