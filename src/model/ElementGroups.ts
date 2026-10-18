import type { ElementGroup, Page } from './types';
import { emptySelection, normalizeSelection, selectionCount, type ElementSelection } from './ElementSelection';

export const memberKeys = {component:'componentIds',cable:'cableIds',image:'imageIds',box:'boxIds',wire:'wireIds',text:'textIds'} as const;
export type GroupMember = ElementGroup['members'][number];
export function selectionMembers(selection:ElementSelection):GroupMember[] {
  return Object.entries(memberKeys).flatMap(([kind,key])=>(selection[key as keyof ElementSelection]??[]).map(id=>({kind:kind as keyof typeof memberKeys,id})));
}
export function membersSelection(members:GroupMember[]):ElementSelection {
  const result=emptySelection();
  for(const member of members)if(member.kind!=='group'){
    const key=memberKeys[member.kind];(result[key]??=[]).push(member.id);
  }
  return result;
}
/** Cycle-safe expansion also tolerates older files containing deleted members. */
export function groupSelection(page:Page,groupId:string):ElementSelection {
  const seen=new Set<string>(),members:GroupMember[]=[];
  const visit=(id:string)=>{if(seen.has(id))return;seen.add(id);for(const member of page.groups?.find(g=>g.id===id)?.members??[])if(member.kind==='group')visit(member.id);else members.push(member);};
  visit(groupId);return normalizeSelection(page,membersSelection(members));
}
export function selectedRootGroups(page:Page,selection:ElementSelection):ElementGroup[] {
  const picked=new Set(selectionMembers(selection).map(m=>`${m.kind}:${m.id}`));
  const roots=(page.groups??[]).filter(g=>!(page.groups??[]).some(parent=>parent.members.some(m=>m.kind==='group'&&m.id===g.id)));
  return roots.filter(g=>selectionMembers(groupSelection(page,g.id)).some(m=>picked.has(`${m.kind}:${m.id}`)));
}
export function expandGroupedSelection(page:Page,selection:ElementSelection):ElementSelection {
  const all=[...selectionMembers(selection),...selectedRootGroups(page,selection).flatMap(g=>selectionMembers(groupSelection(page,g.id)))];
  return normalizeSelection(page,membersSelection(all));
}
export function canGroupSelection(page:Page,selection:ElementSelection):boolean {
  const expanded=expandGroupedSelection(page,selection);
  if(selectionCount(expanded)<2)return false;
  const roots=selectedRootGroups(page,expanded);
  return !(roots.length===1&&selectionCount(groupSelection(page,roots[0].id))===selectionCount(expanded));
}
export function createElementGroup(page:Page,selection:ElementSelection):ElementGroup|undefined {
  if(!canGroupSelection(page,selection))return;
  const expanded=expandGroupedSelection(page,selection),roots=selectedRootGroups(page,expanded);
  const grouped=new Set(roots.flatMap(g=>selectionMembers(groupSelection(page,g.id))).map(m=>`${m.kind}:${m.id}`));
  const members:GroupMember[]=[...roots.map(g=>({kind:'group' as const,id:g.id})),...selectionMembers(expanded).filter(m=>!grouped.has(`${m.kind}:${m.id}`))];
  const group:ElementGroup={id:'group_'+crypto.randomUUID(),members};
  (page.groups??=[]).push(group);return group;
}
/** Dissolve only the selected outer layer. Nested groups remain independently selectable. */
export function dissolveElementGroups(page:Page,selection:ElementSelection):boolean {
  const ids=new Set(selectedRootGroups(page,selection).map(g=>g.id));
  if(!ids.size)return false;
  page.groups=page.groups?.filter(g=>!ids.has(g.id));return true;
}
/** Remove stale links after deletion; dissolve empty and one-member wrappers. */
export function pruneElementGroups(page:Page):void {
  if(!page.groups)return;
  const byId=new Map<string,ElementGroup>(),owned=new Set<string>();
  for(const group of page.groups)if(group.id&&!byId.has(group.id))byId.set(group.id,{...group,members:[]});
  const path=new Set<string>(),done=new Set<string>();
  const visit=(id:string)=>{
    if(path.has(id)||done.has(id))return;
    path.add(id);const target=byId.get(id)!;
    for(const member of page.groups!.find(g=>g.id===id)?.members??[]){
      const key=`${member.kind}:${member.id}`;
      if(owned.has(key))continue;
      if(member.kind==='group'){
        if(!byId.has(member.id)||path.has(member.id))continue;
        owned.add(key);visit(member.id);target.members.push({...member});
      }else if(selectionCount(normalizeSelection(page,membersSelection([member])))){
        owned.add(key);target.members.push({...member});
      }
    }
    path.delete(id);done.add(id);
  };
  for(const id of byId.keys())visit(id);
  let changed=true;
  while(changed){changed=false;for(const [id,group]of byId)if(group.members.length<2){
    for(const parent of byId.values())parent.members=parent.members.flatMap(m=>m.kind==='group'&&m.id===id?group.members:[m]);
    byId.delete(id);changed=true;
  }}
  page.groups=[...byId.values()];
}
/** Copies groups into a new ID space (macro insertion/export), omitting external links. */
export function remapElementGroups(groups:ElementGroup[]|undefined,ids:Partial<Record<keyof typeof memberKeys,Map<string,string>>>):ElementGroup[] {
  if(!groups)return [];
  const groupIds=new Map(groups.map(g=>[g.id,'group_'+crypto.randomUUID()]));
  const mapped:ElementGroup[]=groups.map(g=>({...structuredClone(g),id:groupIds.get(g.id)!,members:g.members.flatMap(m=>{
    const id=m.kind==='group'?groupIds.get(m.id):ids[m.kind]?.get(m.id);return id?[{...m,id}]:[];
  })}));
  // Retain valid subgroups, even if their outer group was only partially exported.
  let changed=true;
  while(changed){changed=false;for(let i=mapped.length-1;i>=0;i--)if(mapped[i].members.length<2){
    const removed=mapped.splice(i,1)[0];for(const parent of mapped)parent.members=parent.members.flatMap(m=>m.kind==='group'&&m.id===removed.id?removed.members:[m]);changed=true;
  }}
  return mapped;
}
