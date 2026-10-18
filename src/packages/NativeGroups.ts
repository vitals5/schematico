import type { Page, ElementGroup } from '../model/types';
import { pruneElementGroups, type GroupMember } from '../model/ElementGroups';
import { EodRecord } from './EodReader';

/** O26 is an actual group. O37 macro frames and common BMKs are not groups.
 * Ownership EBF1 is a typed reference shared by electrical and graphic tables. */
export function readNativeGroups(page:Page,records:readonly EodRecord[]):void {
  const groups=new Map<number,ElementGroup>();
  for(const r of records)if(r.type===26)groups.set(r.id,{id:`native-group-${page.id}-${r.id}`,members:[],source:{format:'NATIVE_CAD',objectType:r.type,objectId:r.id}});
  const objects=new Map<string,GroupMember>();
  for(const c of page.components)if(c.source)objects.set(`${c.source.objectType}:${c.source.objectId}`,{kind:'component',id:c.id});
  for(const c of page.cables??[])if(c.source)objects.set(`${c.source.objectType}:${c.source.objectId}`,{kind:'cable',id:c.id});
  for(const r of records)if(r.type===91&&page.images?.some(i=>i.id===`native-image-${r.id}`))objects.set(`91:${r.id}`,{kind:'image',id:`native-image-${r.id}`});
  for(const r of records){
    if(r.number(0xebf1)!==26)continue;
    const parent=groups.get(r.number(0xebf1,4,4)??-1);if(!parent)continue;
    const member=r.type===26&&groups.has(r.id)?{kind:'group' as const,id:groups.get(r.id)!.id}:objects.get(`${r.type}:${r.id}`);
    if(member)parent.members.push(member);
  }
  page.groups=[...groups.values()];pruneElementGroups(page);
}
