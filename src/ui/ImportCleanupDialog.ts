import type { Project } from '../model/types';
import type { ComponentAddress } from '../model/ArticleTypes';
import { cleanupDefaults, ImportCleanupPlan, type CleanupIssue } from '../model/ImportCleanup';
import type { DataInterpretation } from '../model/ComponentSemantics';
import { escapeSvg as esc } from '../model/ImportedDrawing';
import { t, tr } from '../i18n';
import { bindArticleModalKeys, focusArticleModal } from './ArticleModal';
import { finishEngineeringDialog } from './EngineeringDialog';
import { articleError, downloadArticleFile } from './ArticleCatalogDialog';

const issueLabel = (kind: CleanupIssue['kind']) => ({
  graphic: tr('Reine Grafik', 'Pure graphics'),
  device_connection: tr('Geräteanschlüsse', 'Device connection points'),
  connector: tr('Steckdosen und Steckverbinder', 'Sockets and connectors'),
  terminal_number: tr('Klemmennummer ungeklärt', 'Unresolved terminal number'),
  device_candidate: tr('Betriebsmittel-Zuordnung prüfen', 'Review device ownership'),
  connection_conflict: tr('Widersprüchliche Verbindungsdaten', 'Conflicting connection data'),
  cable_core_count: tr('Kabeladern prüfen: Soll / Zuordnungen', 'Review cable cores: declared / represented'),
})[kind];

export class ImportCleanupDialog {
  private el = document.createElement('div');
  private source: Project;
  private profile: DataInterpretation;
  private plan?: ImportCleanupPlan;
  private busy = false;
  private generation = 0;
  private error = '';
  private filter = 'review';
  private search = '';
  private offset = 0;
  constructor(private getProject: () => Project, private onApply: (p: Project) => void,
    private onNavigate: (a: ComponentAddress) => void,
    private onArticles: (a: ComponentAddress[]) => void,
    private onWiring: (issue?: CleanupIssue) => void, private onConnections: () => void) {
    this.source=structuredClone(getProject());
    this.profile={...(this.source.dataInterpretation??cleanupDefaults)};
  }
  show() {
    if(document.getElementById('importCleanupDialog'))return;
    this.el.id='importCleanupDialog';this.el.className='modal-backdrop';
    this.el.style.cssText='position:fixed;inset:0;z-index:4200;display:flex;align-items:center;justify-content:center';
    document.body.append(this.el);
    bindArticleModalKeys(this.el,()=>this.el.remove());
    this.render();void this.calculate();
  }
  private async calculate() {
    const generation=++this.generation;
    this.busy=true;this.error='';this.plan=undefined;this.render();
    await new Promise(resolve=>setTimeout(resolve,0));
    if(!this.el.isConnected||generation!==this.generation)return;
    try { this.plan=new ImportCleanupPlan(this.source,this.profile); }
    catch(e) { this.error=articleError(e); }
    this.busy=false;this.render();
  }
  private render() {
    const preview=this.plan?.preview;
    const options: [keyof Omit<DataInterpretation,'version'>,string][]=[
      ['nativeRoles',tr('Objektrollen für Navigatoren und Klemmen korrigieren','Correct object roles in navigators and terminals')],
      ['assignedArticlesOnly',tr('Nur zugeordnete Artikel in der Stückliste zählen','Count only assigned articles in the BOM')],
      ['consolidateConnections',tr('Eindeutige gezeichnete/logische Verbindungen gemeinsam auswerten','Report unambiguous drawing/logical connections together')],
    ];
    const labels={navigator:tr('Navigator-Einträge','Navigator entries'),terminals:tr('Klemmen-Darstellungen','Terminal representations'),
      bom:tr('Stücklistenpositionen','BOM rows'),connections:tr('Verbindungszeilen','Connection rows')};
    this.el.innerHTML=`<section role="dialog" aria-modal="true"><h2>${t('cleanupTitle')}</h2>
      <p>${tr('Die Vorschau trennt Darstellungen von Betriebsmitteln. Übernehmen speichert die gewählten Auswertungsregeln im Projekt; Symbole, Anschluss-IDs, Texte, Leitungswege und Schaltschrankaufbauten bleiben erhalten.',
        'The preview separates representations from devices. Apply stores the chosen interpretation rules in the project; symbols, pin IDs, text, wire routes, and cabinet layouts are preserved.')}</p>
      <fieldset><legend>${tr('Auswertungsregeln','Interpretation rules')}</legend>${options.map(([key,label])=>`<label style="display:block;margin:8px 0"><input type="checkbox" data-option="${key}" ${this.profile[key]?'checked':''} ${this.busy?'disabled':''}> ${esc(label)}</label>`).join('')}</fieldset>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0"><button class="btn" data-compute ${this.busy?'disabled':''}>${tr('Vorschau berechnen','Calculate preview')}</button><button class="btn" data-refresh ${this.busy?'disabled':''}>${tr('Projektstand neu laden','Reload project state')}</button><button class="btn" data-report ${preview?'':'disabled'}>${tr('Prüfbericht als JSON','Audit report as JSON')}</button><button class="btn" data-connections>${tr('Verbindungen bearbeiten','Review connections')}</button><button class="btn" data-wiring>${tr('Klemmen und Kabel bearbeiten','Review terminals and cables')}</button></div>
      <p role="status" data-cleanup-status>${this.busy?tr('Bestand und Auswirkungen werden geprüft …','Checking inventory and impacts …'):preview?tr('Vorschau bereit. Noch nicht übernommen.','Preview ready. Not applied yet.'):tr('Die Regeln wurden geändert. Vorschau neu berechnen.','Rules changed. Recalculate the preview.')}</p>
      <div data-summary>${preview?`<table style="width:100%;text-align:left"><thead><tr><th>${tr('Auswertung','Inventory')}</th><th>${tr('Vorher','Before')}</th><th>${tr('Nachher','After')}</th></tr></thead><tbody>${(Object.keys(labels) as (keyof typeof labels)[]).map(k=>`<tr data-metric="${k}"><th>${labels[k]}</th><td>${preview.before[k]}</td><td>${preview.after[k]}</td></tr>`).join('')}</tbody></table><p>${preview.source.pages} ${tr('Seiten','sheets')} · ${preview.source.placements} ${tr('Darstellungen','placements')} · ${preview.source.drawnWires} ${tr('gezeichnete Leitungsabschnitte','drawn wire segments')} · ${preview.source.cabinets} ${tr('Schaltschrankaufbauten','cabinet layouts')} / ${preview.source.cabinetItems} ${tr('Aufbauobjekte','cabinet objects')}</p>
      ${preview.after.bom===0?`<p class="pdf-warning">${tr('Keine zugeordneten Artikel für die bereinigte Stückliste vorhanden. Ersatznummern werden nicht als Herstellerartikel gezählt. Zuordnungen anhand des ursprünglichen Projekts oder des Artikelkatalogs ergänzen.', 'No assigned articles are available for the cleaned BOM. Placeholder numbers are not counted as manufacturer articles. Complete assignments using the original project or article catalog.')}</p>`:''}
      <p>${tr('Betriebsmittel-Zuordnungen, fehlende Klemmennummern, Kabeladern und Widersprüche müssen geprüft werden. Gleiche BMKs werden nicht automatisch zu einem Gerät zusammengeführt; widersprüchliche Verbindungen bleiben separat sichtbar.', 'Device ownership, missing terminal numbers, cable cores and conflicts require review. Equal tags are not automatically merged into one device; conflicting connections remain separately visible.')}</p>`:''}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><select class="form-input" data-filter aria-label="${tr('Befunde filtern','Filter findings')}"><option value="review">${tr('Zu prüfen','Needs review')}</option><option value="all">${tr('Alle Befunde','All findings')}</option>${(['graphic','device_connection','connector','terminal_number','device_candidate','connection_conflict','cable_core_count'] as const).map(k=>`<option value="${k}">${issueLabel(k)}</option>`).join('')}</select><input class="form-input" data-search value="${esc(this.search)}" placeholder="${tr('BMK oder Objekt-ID suchen','Search tag or object ID')}"><button class="btn" data-prev>‹</button><span data-count></span><button class="btn" data-next>›</button></div>
      <div style="overflow:auto;max-height:30vh"><table style="width:100%;text-align:left;font-size:12px"><thead><tr><th>${tr('Befund','Finding')}</th><th>BMK / ID</th><th>${tr('Details','Details')}</th><th></th></tr></thead><tbody data-findings></tbody></table></div>
      <p role="alert" data-error>${esc(this.error)}</p><footer><span>${tr('Übernahme ist ein Rückgängig-Schritt. Die Vorschau verändert das Projekt nicht.','Applying is one undo step. The preview does not change the project.')}</span><button class="btn" data-close>${tr('Schließen','Close')}</button><button class="btn btn-primary" data-apply ${preview&&!this.busy?'':'disabled'}>${tr('Auswertungsregeln übernehmen','Apply interpretation rules')}</button></footer></section>`;
    for(const input of this.el.querySelectorAll<HTMLInputElement>('[data-option]'))input.onchange=()=>{
      this.profile[input.dataset.option as keyof Omit<DataInterpretation,'version'>]=input.checked;
      this.plan=undefined;this.render();
    };
    this.el.querySelector<HTMLButtonElement>('[data-compute]')!.onclick=()=>void this.calculate();
    this.el.querySelector<HTMLButtonElement>('[data-refresh]')!.onclick=()=>{
      this.source=structuredClone(this.getProject());void this.calculate();
    };
    this.el.querySelector<HTMLButtonElement>('[data-report]')!.onclick=()=>{
      if(this.plan)downloadArticleFile(JSON.stringify(this.plan.preview,null,2),'schematico-import-bereinigung.json','application/json');
    };
    this.el.querySelector<HTMLButtonElement>('[data-apply]')!.onclick=()=>{
      try { if(!this.plan)return;this.onApply(this.plan.apply(this.getProject()));this.el.remove(); }
      catch(e) { this.error=articleError(e);this.render(); }
    };
    this.el.querySelector<HTMLButtonElement>('[data-close]')!.onclick=()=>this.el.remove();
    this.el.querySelector<HTMLButtonElement>('[data-wiring]')!.onclick=()=>{this.el.remove();this.onWiring();};
    this.el.querySelector<HTMLButtonElement>('[data-connections]')!.onclick=()=>{this.el.remove();this.onConnections();};
    const filter=this.el.querySelector<HTMLSelectElement>('[data-filter]')!;filter.value=this.filter;
    filter.onchange=()=>{this.filter=filter.value;this.offset=0;this.renderFindings();};
    this.el.querySelector<HTMLInputElement>('[data-search]')!.oninput=e=>{
      this.search=(e.target as HTMLInputElement).value;this.offset=0;this.renderFindings();
    };
    this.el.querySelector<HTMLButtonElement>('[data-prev]')!.onclick=()=>{this.offset=Math.max(0,this.offset-50);this.renderFindings();};
    this.el.querySelector<HTMLButtonElement>('[data-next]')!.onclick=()=>{this.offset+=50;this.renderFindings();};
    this.renderFindings();
    this.el.setAttribute('aria-busy',String(this.busy));
    finishEngineeringDialog(this.el,{kind:'inspection',description:tr('Prüfbare Datenbereinigung bei unveränderter Zeichnung','Reviewable data cleanup with preserved drawings'),wide:true,closeSelector:'[data-close]'});
    focusArticleModal(this.el);
  }
  private renderFindings() {
    const word=this.search.trim().toLocaleLowerCase();
    const rows=(this.plan?.preview.issues??[]).filter(i=>
      (this.filter==='all'||(this.filter==='review'?!['graphic','device_connection','connector'].includes(i.kind):i.kind===this.filter))&&
      (!word||[i.label,i.details,...i.addresses.map(a=>a.componentId)].join(' ').toLocaleLowerCase().includes(word)));
    this.offset=Math.min(this.offset,Math.max(0,Math.floor((rows.length-1)/50)*50));
    this.el.querySelector('[data-count]')!.textContent=`${rows.length?this.offset+1:0}–${Math.min(this.offset+50,rows.length)} / ${rows.length}`;
    this.el.querySelector<HTMLButtonElement>('[data-prev]')!.disabled=this.offset===0;
    this.el.querySelector<HTMLButtonElement>('[data-next]')!.disabled=this.offset+50>=rows.length;
    this.el.querySelector('[data-findings]')!.innerHTML=rows.slice(this.offset,this.offset+50).map((i,n)=>`<tr><td>${esc(issueLabel(i.kind))}</td><td style="overflow-wrap:anywhere">${esc(i.label)}</td><td style="overflow-wrap:anywhere">${esc(i.details)}</td><td>${i.addresses.length?`<button class="btn" data-go="${n}">${tr('Im Plan','In drawing')}</button><button class="btn" data-articles="${n}">${tr('Zuordnen','Assign')}</button>`:''}${i.cableId?`<button class="btn" data-cable="${n}">${tr('Kabel prüfen','Review cable')}</button>`:''}</td></tr>`).join('');
    for(const b of this.el.querySelectorAll<HTMLButtonElement>('[data-go]'))b.onclick=()=>{
      const i=rows[this.offset+Number(b.dataset.go)];this.el.remove();this.onNavigate(i.addresses[0]);
    };
    for(const b of this.el.querySelectorAll<HTMLButtonElement>('[data-articles]'))b.onclick=()=>{
      const i=rows[this.offset+Number(b.dataset.articles)];this.el.remove();this.onArticles(i.addresses);
    };
    for(const b of this.el.querySelectorAll<HTMLButtonElement>('[data-cable]'))b.onclick=()=>{
      const i=rows[this.offset+Number(b.dataset.cable)];this.el.remove();this.onWiring(i);
    };
  }
}
