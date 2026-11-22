import type { Project, ElementGroup } from './types';
import type { InspectionFinding } from './ElectricalInspection';
import { groupArticleUnits } from './GroupArticles';
import { t } from '../i18n';

/** Consolidate missing-article notices, not device identities or electrical
 * checks. Keep every underlying member and its evidence in the group finding. */
export function aggregateGroupArticleFindings(project: Project, findings: InspectionFinding[]): InspectionFinding[] {
  const grouped=new Map<string,{group:ElementGroup;findings:InspectionFinding[]}>();
  const retained:InspectionFinding[]=[];
  const owners=new Map(project.pages.filter(p=>project.pages.filter(v=>v.id===p.id).length===1)
    .map(p=>[p.id,groupArticleUnits(p,true).inspectionOwners]));
  for(const finding of findings){
    const owner=finding.ruleId==='missing_article'&&finding.componentId?owners.get(finding.pageId)?.get(finding.componentId):undefined;
    if(!owner){retained.push(finding);continue;}
    const key=JSON.stringify([finding.pageId,owner.group.id]);
    const bundle=grouped.get(key)??{group:owner.group,findings:[]};
    bundle.findings.push(finding);grouped.set(key,bundle);
  }
  for(const [key,{group,findings:members}] of grouped){
    members.sort((a,b)=>(a.componentId??'').localeCompare(b.componentId??''));
    const first=members[0],states=new Set(members.map(m=>m.articleData?.state));
    const location={...first.location,componentId:undefined,groupId:group.id};
    const label=group.bmk?.trim()||group.name?.trim()||t('inspectionGroup');
    retained.push({
      id:JSON.stringify(['missing_article','group',key]),ruleId:'missing_article',domain:'electrical',
      severity:members.some(m=>m.severity==='warning')?'warning':'info',category:first.category,
      pageId:first.pageId,pageNumber:first.pageNumber,groupId:group.id,bmk:label,
      articleData:{role:'group',symbolId:'group:'+group.id,
        plant:(group.higherLevelFunction??first.articleData?.plant??'').trim().replace(/^=+/,''),
        location:(group.mountingLocation??first.articleData?.location??'').trim().replace(/^\++/,''),
        state:states.size===1&&first.articleData?first.articleData.state:'unassigned',
        designationKey:JSON.stringify(['group',first.pageId,group.id])},
      message:t('plausMsgGroupArticle',{count:members.length}),recommendation:t('plausRecGroupArticle'),
      cause:{code:'missing_article',details:{groupId:group.id,groupedMembers:members.map(m=>({componentId:m.componentId,
        bmk:m.bmk,articleState:m.articleData?.state,articleData:m.articleData,requirement:m.cause.details.requirement,severity:m.severity}))}},
      location,relatedLocations:members.flatMap(m=>[m.location,...m.relatedLocations]),
    });
  }
  return retained;
}
