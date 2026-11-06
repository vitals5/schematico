import type {ComponentAddress} from '../model/ArticleTypes';
// src/ui/PlausibilityDialog.ts
// Plausibility Check & Message Management ("Prüflauf / Meldungsverwaltung")

import { Project } from '../model/types';
import { t } from '../i18n';
import { escapeSvg } from '../model/ImportedDrawing';

export type {PlausibilityMessage} from '../model/ProjectInspection';
import type {PlausibilityMessage} from '../model/ProjectInspection';
import {inspectElectricalProject} from '../model/ElectricalInspection';
import {reviewInspection,type ReviewFilters,type ReviewGrouping} from '../model/InspectionReview';
import {ARTICLE_DATA_STATES,type ArticleDataState} from '../model/ArticleDataAnalysis';

export class PlausibilityDialog {
  private onWiring?:(location:import('../model/ElectricalInspection').InspectionLocation)=>void;
  private onArticles?:(addresses:ComponentAddress[])=>void;
  private filters:ReviewFilters={};
  private grouping:ReviewGrouping='rule';
  private project: Project;
  private onNavigate: (pageId: string, componentId?: string) => void;
  private onFinding?: (finding:PlausibilityMessage)=>void;

  constructor(project: Project, onNavigateOrOptions: ((pageId: string, componentId?: string) => void) | { onManageWiring?:(location:import('../model/ElectricalInspection').InspectionLocation)=>void; onManageArticles?:(addresses:ComponentAddress[])=>void; onNavigateToPage: (pageId: string, componentId?: string) => void; onNavigateToFinding?:(finding:PlausibilityMessage)=>void }) {
    this.project = project;
    if (typeof onNavigateOrOptions === 'function') {
      this.onNavigate = onNavigateOrOptions;
    } else {
      this.onNavigate = onNavigateOrOptions.onNavigateToPage;
      this.onFinding=onNavigateOrOptions.onNavigateToFinding;this.onArticles=onNavigateOrOptions.onManageArticles;this.onWiring=onNavigateOrOptions.onManageWiring;
    }
  }

  public show(): void {
    const existing = document.getElementById('plausibilityModal');
    if (existing) existing.remove();

    const report=inspectElectricalProject(this.project),messages=report.messages;

    const modal = document.createElement('div');
    modal.id = 'plausibilityModal';
    modal.className = 'modal-backdrop';
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.backgroundColor = 'rgba(0,0,0,0.75)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '2100';
    modal.style.padding = '12px';

    const errors = messages.filter(m => m.severity === 'error').length;
    const warnings = messages.filter(m => m.severity === 'warning').length;
    const infos = messages.filter(m => m.severity === 'info').length;

    const options=(values:string[],selected?:string,label=(v:string)=>v,prefix='')=>`<option value="">${escapeSvg(prefix?prefix+': ':'')}${t('reviewAll')}</option>`+values.map(v=>`<option value="${escapeSvg(v)}" ${v===selected?'selected':''}>${escapeSvg(label(v))}</option>`).join('');
    modal.innerHTML = `
      <div class="modal-card ecad-window" style="
        background: #232731;
        border: 1px solid #4a5568;
        border-radius: 6px;
        width: 100%;
        max-width: 1100px;
        height: 85vh;
        max-height: 840px;
        box-shadow: 0 16px 40px rgba(0,0,0,0.8);
        color: #edf2f7;
        font-family: inherit;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      ">
        <!-- Titlebar -->
        <div class="ecad-window-header" style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 14px;
          background: #2d323e;
          border-bottom: 1px solid #3e4656;
          user-select: none;
        ">
          <div style="display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 13px;">
            <span style="color: #68d391;">📋</span>
            <span>${t('plausModalTitle')}</span>
          </div>
          <button id="btnClosePlausModal" style="background: none; border: none; color: #a0aec0; font-size: 18px; cursor: pointer;">&times;</button>
        </div>

        <!-- Summary Bar -->
        <div style="
          padding: 8px 16px;
          background: #1c1f26;
          border-bottom: 1px solid #3e4656;
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 12px;
        ">
          <div>${t('plausStatusDone')}</div>
          <div style="display: flex; gap: 12px; margin-left: auto;">
            <span style="color: #fc8181;">❌ ${t('plausErrors', { count: errors })}</span>
            <span style="color: #f6ad55;">⚠️ ${t('plausWarnings', { count: warnings })}</span>
            <span style="color: #63b3ed;">ℹ️ ${t('plausInfos', { count: infos })}</span>
          </div>
        </div>

        <div style="display:flex;flex-wrap:wrap;gap:5px;padding:8px">
          <input id="reviewSearch" class="form-input" style="flex:1;min-width:180px" placeholder="${escapeSvg(t('reviewSearch'))}">
          <select style="max-width:230px;min-width:0" id="reviewRule" aria-label="${t('reviewRule')}">${options([...new Set(messages.map(m=>m.ruleId))],this.filters.rule,v=>v,t('reviewRule'))}</select>
          <select style="max-width:230px;min-width:0" id="reviewSeverity" aria-label="${t('plausColSeverity')}">${options(['error','warning','info'],this.filters.severity,v=>t(({error:'plausSeverityError',warning:'plausSeverityWarning',info:'plausSeverityInfo'} as const)[v as 'error'|'warning'|'info']),t('plausColSeverity'))}</select>
          <select style="max-width:230px;min-width:0" id="reviewPage" aria-label="${t('reviewPage')}">${options(this.project.pages.map(p=>p.id),this.filters.pageId,id=>{const p=this.project.pages.find(p=>p.id===id);return p?`${p.pageNumber} · ${p.higherLevel??''} ${p.location??''} · ${p.title}`:id;},t('reviewPage'))}</select>
          <select style="max-width:230px;min-width:0" id="reviewOrigin" aria-label="${t('reviewOrigin')}">${options([...ARTICLE_DATA_STATES],this.filters.articleState,state=>t(('articleState_'+state) as any),t('reviewOrigin'))}</select>
          <select style="max-width:230px;min-width:0" id="reviewGrouping" aria-label="${t('reviewGrouping')}">${(['rule','designation','page','none'] as const).map(g=>`<option value="${g}" ${g===this.grouping?'selected':''}>${t(({rule:'reviewRule',designation:'reviewDesignation',page:'reviewPage',none:'reviewNone'} as const)[g])}</option>`).join('')}</select>
          <span id="reviewCount" style="width:100%;font-size:11px"></span>
          <span style="font-size:10px;color:#a0aec0">${t('reviewNoMerge')}</span>
        </div>
        <!-- Messages Table -->
        <div style="flex: 1; overflow-y: auto; padding: 10px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 11px;table-layout:fixed;overflow-wrap:anywhere;">
            <colgroup><col style="width:10%"><col style="width:8%"><col style="width:14%"><col style="width:48%"><col style="width:20%"></colgroup>
            <thead>
              <tr style="background: #181b22; color: #a0aec0; text-align: left; border-bottom: 1px solid #3e4656;">
                <th style="padding: 6px 8px;">${t('plausColSeverity')}</th>
                <th style="padding: 6px 8px;">${t('plausColPage')}</th>
                <th style="padding: 6px 8px;">${t('plausColBmk')}</th>
                <th style="padding: 6px 8px;">${t('plausColMessage')}</th>
                <th style="padding: 6px 8px;">${t('plausColAction')}</th>
              </tr>
            </thead>
            <tbody id="reviewBody">
            </tbody>
          </table>
        </div>

        <div style="display:flex;justify-content:center;gap:12px"><button id="reviewPrevious" class="btn">${t('reviewPrevious')}</button><span id="reviewPagination"></span><button id="reviewNext" class="btn">${t('reviewNext')}</button></div>
        <!-- Footer -->
        <div style="
          padding: 10px 16px;
          border-top: 1px solid #3e4656;
          background: #1c1f26;
          display: flex;
          justify-content: flex-end;flex-wrap:wrap;gap:4px;
        ">
          <span style="font-size:10px;flex:1">${escapeSvg(t('plausCoverage',{count:report.coverage.unknownInternalConnections}))}</span>
          ${this.onArticles?`<button id="btnArticlesPlaus" class="btn">${t('articlesReviewFiltered')}</button>`:''}
          <button id="btnRerunPlaus" class="btn">${t('plausRerun')}</button>
          <button id="btnExportPlaus" class="btn">${t('plausExport')}</button>
          <button id="btnConfirmPlaus" class="btn btn-primary" style="padding: 6px 16px; font-size: 12px;">${t('close')}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    let page=0;
    const collapsed=new Set<string>(),limits=new Map<string,number>(),byId=new Map(messages.map((m,index)=>[m.id,{m,index}]));
    const body=modal.querySelector('#reviewBody')!;
    const originLabel=(m:PlausibilityMessage)=>m.articleData?t(('articleState_'+m.articleData.state) as any):t('articleState_import_unknown');
    const row=(m:PlausibilityMessage,index:number)=>`<tr class="plaus-row" data-finding-index="${index}" data-page-id="${escapeSvg(m.pageId)}" data-comp-id="${escapeSvg(m.componentId??'')}" style="border-bottom:1px solid #3e4656;cursor:pointer">
      <td style="padding:6px">${escapeSvg(t(({error:'plausSeverityError',warning:'plausSeverityWarning',info:'plausSeverityInfo'} as const)[m.severity]))}</td><td>${escapeSvg(m.pageNumber)}</td><td>${escapeSvg(m.bmk||'-')}</td>
      <td style="padding:6px"><div>${escapeSvg(m.message)}</div><div style="font-size:10px;color:#90cdf4">${escapeSvg(m.ruleId)} · ${escapeSvg(m.location.pinId??m.location.wireId??'')}</div>
      <div style="font-size:10px">${escapeSvg(originLabel(m))} · ${escapeSvg(t(('articleRole_'+(m.articleData?.role??'unknown')) as any))} · ${escapeSvg(m.articleData?.symbolId??'')}</div>
      <div style="font-size:10px;color:#a0aec0">${escapeSvg(m.recommendation)}</div></td><td><button class="btn btn-jump">${t('plausBtnNavigate')} ➔</button>${this.onArticles&&['missing_article','invalid_article_assignment','article_incompatible','article_spec_unknown','invalid_physical_device'].includes(m.ruleId)?`<button class="btn" data-edit-article>${t('articlesReviewOne')}</button>`:''}${this.onWiring&&(m.ruleId.startsWith('cable_')||m.ruleId==='terminal_number_duplicate')?`<button class="btn" data-edit-wiring>${t('wiringManage')}</button>`:''}</td></tr>`;
    const addressesFor=(findings:PlausibilityMessage[])=>[...new Map(findings.filter(m=>['missing_article','invalid_article_assignment','article_incompatible','article_spec_unknown','invalid_physical_device'].includes(m.ruleId)).flatMap(m=>[m.location,...m.relatedLocations]).filter(l=>l.componentId).map(l=>[JSON.stringify([l.pageId,l.componentId]),{pageId:l.pageId,componentId:l.componentId!}])).values()];
    const render=()=>{
      const view=reviewInspection(messages,this.filters,this.grouping),pages=Math.max(1,Math.ceil(view.groups.length/30));page=Math.min(page,pages-1);
      modal.querySelector('#reviewCount')!.textContent=t('reviewCount',{shown:view.filtered.length,total:messages.length});
      modal.querySelector('#reviewPagination')!.textContent=`${page+1} / ${pages}`;
      (modal.querySelector('#reviewPrevious') as HTMLButtonElement).disabled=page===0;
      (modal.querySelector('#reviewNext') as HTMLButtonElement).disabled=page>=pages-1;
      const articlesButton=modal.querySelector<HTMLButtonElement>('#btnArticlesPlaus');if(articlesButton)articlesButton.disabled=!addressesFor(view.filtered).length;
      body.innerHTML=view.groups.slice(page*30,(page+1)*30).map(group=>{
        const limit=limits.get(group.id)??50;
        return `${this.grouping==='none'?'':`<tr><td colspan="5"><button class="btn" data-group-toggle="${escapeSvg(group.id)}">${collapsed.has(group.id)?'▸':'▾'} ${escapeSvg(group.label)} (${group.messageIds.length})</button></td></tr>`}`+
          (collapsed.has(group.id)?'':group.messageIds.slice(0,limit).map(id=>{const item=byId.get(id)!;return row(item.m,item.index);}).join('')+(group.messageIds.length>limit?`<tr><td colspan="5"><button class="btn" data-group-more="${escapeSvg(group.id)}">${t('reviewMore')} (${Math.min(limit,group.messageIds.length)} / ${group.messageIds.length})</button></td></tr>`:''));
      }).join('')||`<tr><td colspan="5">${t('plausEmpty')}</td></tr>`;
    };
    (modal.querySelector('#reviewSearch') as HTMLInputElement).value=this.filters.search??'';
    modal.querySelector('#reviewSearch')!.addEventListener('input',e=>{this.filters.search=(e.target as HTMLInputElement).value;page=0;render();});
    for(const [id,key] of [['reviewRule','rule'],['reviewSeverity','severity'],['reviewPage','pageId'],['reviewOrigin','articleState']] as const)
      modal.querySelector('#'+id)!.addEventListener('change',e=>{this.filters[key]=(e.target as HTMLSelectElement).value as any;page=0;render();});
    modal.querySelector('#reviewGrouping')!.addEventListener('change',e=>{this.grouping=(e.target as HTMLSelectElement).value as ReviewGrouping;page=0;render();});
    modal.querySelector('#reviewPrevious')!.addEventListener('click',()=>{page--;render();});
    modal.querySelector('#reviewNext')!.addEventListener('click',()=>{page++;render();});
    const closeModal = () => modal.remove();
    body.addEventListener('click',e=>{
      const el=e.target as Element,toggle=el.closest<HTMLElement>('[data-group-toggle]'),more=el.closest<HTMLElement>('[data-group-more]');
      if(toggle){const id=toggle.dataset.groupToggle!;collapsed.has(id)?collapsed.delete(id):collapsed.add(id);render();return;}
      if(more){const id=more.dataset.groupMore!;limits.set(id,(limits.get(id)??50)+50);render();return;}
      const selected=el.closest<HTMLElement>('.plaus-row');if(!selected)return;
      const finding=messages[Number(selected.dataset.findingIndex)];
      if(el.closest('[data-edit-wiring]')){this.onWiring?.(finding.location);closeModal();return;}
      if(el.closest('[data-edit-article]')){this.onArticles?.(addressesFor([finding]));closeModal();return;}
      if(this.onFinding)this.onFinding(finding);else this.onNavigate(finding.pageId,finding.componentId);closeModal();
    });
    render();
    modal.querySelector('#btnArticlesPlaus')?.addEventListener('click',()=>{const addresses=addressesFor(reviewInspection(messages,this.filters,this.grouping).filtered);if(addresses.length){closeModal();this.onArticles?.(addresses);}});
    modal.querySelector('#btnRerunPlaus')?.addEventListener('click',()=>this.show());
    modal.querySelector('#btnExportPlaus')?.addEventListener('click',()=>{
      const url=URL.createObjectURL(new Blob([JSON.stringify({...report,review:{filters:this.filters,grouping:this.grouping,matchingMessageIds:reviewInspection(messages,this.filters,this.grouping).filtered.map(m=>m.id)}},null,2)],{type:'application/json'}));
      const a=document.createElement('a');a.href=url;a.download='schematico-electrical-inspection.json';a.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
    modal.querySelector('#btnClosePlausModal')?.addEventListener('click', closeModal);
    modal.querySelector('#btnConfirmPlaus')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });


  }

}
