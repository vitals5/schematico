import type { ElementGroup, Page } from './types';
import type { AssignedArticle } from './ArticleTypes';
import { validateAssignments } from './ArticleAssignments';
import { groupSelection } from './ElementGroups';

/** Group article fields have the same explicit-clear and scalar-edit semantics
 * as component assignments. Generated BOM placeholders are not assignments. */
export function groupArticles(group: ElementGroup): AssignedArticle[] {
  if (group.articleAssignment) {
    if (group.articleAssignment.mode !== 'manual') return [];
    let items: AssignedArticle[];
    try { items = validateAssignments(group.articleAssignment.items); } catch { return []; }
    if(!items.length)return [];
    const main=items.find(a=>a.role==='main')??items[0];
    if ((group.articleNumber===undefined||group.articleNumber.trim()===main.articleNumber) &&
        (group.manufacturer===undefined||group.manufacturer.trim()===main.manufacturer)) return items;
  }
  return group.articleNumber?.trim() ? [{ articleNumber:group.articleNumber.trim(),
    manufacturer:group.manufacturer?.trim()??'',variant:group.variant??'',quantity:1,role:'main' }] : [];
}
export interface GroupArticleUnit {
  group: ElementGroup;
  items: AssignedArticle[];
  selection: ReturnType<typeof groupSelection>;
}
/** Outer assigned assemblies own their nested representations. Ambiguous,
 * missing and cyclic membership never establishes inherited article coverage. */
export function groupArticleUnits(page: Page) {
  const groups=page.groups??[],byId=new Map(groups.map(g=>[g.id,g]));
  const uniqueIds=new Set(groups.filter(g=>typeof g.id==='string'&&g.id.trim()&&groups.filter(v=>v.id===g.id).length===1).map(g=>g.id));
  const componentCounts=new Map<string,number>();
  for(const c of page.components)componentCounts.set(c.id,(componentCounts.get(c.id)??0)+1);
  const cache=new Map<string,Set<string>|undefined>(),active=new Set<string>();
  const expand=(id:string): Set<string>|undefined=>{
    if(cache.has(id))return cache.get(id);
    if(active.has(id)||!uniqueIds.has(id))return;
    active.add(id);
    const group=byId.get(id)!;const nested=new Set<string>([id]);
    const invalid=()=>{active.delete(id);cache.set(id,undefined);return undefined;};
    for(const member of group.members){
      if(member.kind==='component'&&componentCounts.get(member.id)!==1)return invalid();
      if(member.kind!=='group')continue;
      const child=expand(member.id);if(!child)return invalid();
      child.forEach(v=>nested.add(v));
    }
    active.delete(id);cache.set(id,nested);
    return nested;
  };
  const candidates=groups.flatMap(group=>{
    const items=groupArticles(group);if(!items.length)return [];
    const nested=expand(group.id);return nested?[{group,items,nested,selection:groupSelection(page,group.id)}]:[];
  });
  const units:GroupArticleUnit[]=candidates.filter(c=>!candidates.some(other=>other!==c&&other.nested.has(c.group.id)));
  const owners=new Map<string,GroupArticleUnit>();const ambiguous=new Set<string>();
  for(const unit of units)for(const id of unit.selection.componentIds??[]){
    if(owners.has(id)){owners.delete(id);ambiguous.add(id);}
    if(!ambiguous.has(id))owners.set(id,unit);
  }
  return {units,owners};
}
