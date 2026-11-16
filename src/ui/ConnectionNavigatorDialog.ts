import type {Project} from '../model/types';
import {connectionList,filterConnections,connectionColumns,connectionCells,withConnectionLength,type ConnectionRow} from '../reports/ConnectionList';
import {connectionListPdf} from '../export/ConnectionListPdf';
import {connectionCsv} from '../reports/ConnectionList';
import {escapeSvg as esc} from '../model/ImportedDrawing';
import {bindArticleModalKeys,focusArticleModal} from './ArticleModal';
import {finishEngineeringDialog} from './EngineeringDialog';
import {downloadArticleFile} from './ArticleCatalogDialog';
import {projectRevision} from '../layout/types';
export class ConnectionNavigatorDialog{
  private el=document.createElement('div');
  private rows:ConnectionRow[]=[];private revision='';private offset=0;private search='';private pageId='';private issuesOnly=false;
  constructor(private getProject:()=>Project,private onApply:(p:Project)=>void,private navigate:(pageId:string,componentId?:string,wireId?:string)=>void){}
  show():void{
    if(document.getElementById('connectionNavigator'))return;
    this.el.id='connectionNavigator';this.el.className='modal-backdrop';this.el.style.cssText='position:fixed;inset:0;z-index:4200;display:flex;align-items:center;justify-content:center;background:#000a';
    document.body.append(this.el);bindArticleModalKeys(this.el,()=>this.el.remove());this.refresh();
  }
  private filtered(){return filterConnections(this.rows,this.search,this.pageId,this.issuesOnly);}
  private refresh(){const p=this.getProject();this.rows=connectionList(p);this.revision=projectRevision(p);this.offset=0;this.render();}
  private render(){
    this.el.innerHTML=`<section role="dialog" aria-modal="true" aria-labelledby="connectionTitle" style="width:96vw;max-height:94vh;overflow:auto;background:#17202d;color:#eee;padding:20px"><h2 id="connectionTitle">Verbindungsliste & Verdrahtungsnavigator</h2>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><input class="form-input" data-search aria-label="Verbindungen suchen" placeholder="BMK, Anschluss, Potenzial, Kabel oder Ader suchen" value="${esc(this.search)}" style="min-width:300px;flex:1"><select class="form-input" data-page aria-label="Blattfilter"><option value="">Alle Blätter</option>${this.getProject().pages.map(p=>`<option value="${esc(p.id)}" ${p.id===this.pageId?'selected':''}>${esc(p.pageNumber+' · '+p.title)}</option>`).join('')}</select><label><input type="checkbox" data-issues ${this.issuesOnly?'checked':''}> Nur mit Hinweisen</label><button class="btn" data-refresh>Aktualisieren</button></div>
    <p>Stand beim Öffnen/Aktualisieren. Eine Zeile je erfasster Verbindung. Netzteilnehmer werden zusätzlich angezeigt. Leere Werte sind nicht erfasst; reale Längen werden nicht aus dem Planmaßstab berechnet.</p>
    <div style="display:flex;gap:8px;align-items:center"><span data-count role="status" style="flex:1"></span><button class="btn" data-prev>Zurück</button><button class="btn" data-next>Weiter</button></div>
    <div style="overflow:auto;max-height:49vh;margin-top:12px"><table style="width:100%;font-size:12px;border-collapse:collapse"><thead><tr>${connectionColumns.map(c=>`<th style="text-align:left;padding:7px">${esc(c)}</th>`).join('')}<th>Aktionen</th></tr></thead><tbody data-rows></tbody></table></div>
    <div data-detail style="padding-top:12px"></div><p data-error role="alert" style="color:#fca5a5"></p>
    <footer style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn" data-csv>CSV: gefilterte Liste</button><button class="btn" data-pdf>PDF: gefilterte Liste</button><button class="btn" data-close>Schließen</button></footer></section>`;
    const q=(s:string)=>this.el.querySelector<HTMLElement>(s)!;
    q('[data-search]').addEventListener('input',e=>{this.search=(e.target as HTMLInputElement).value;this.offset=0;this.renderRows();});
    q('[data-page]').addEventListener('change',e=>{this.pageId=(e.target as HTMLSelectElement).value;this.offset=0;this.renderRows();});
    q('[data-issues]').addEventListener('change',e=>{this.issuesOnly=(e.target as HTMLInputElement).checked;this.offset=0;this.renderRows();});
    q('[data-prev]').onclick=()=>{this.offset=Math.max(0,this.offset-100);this.renderRows();};q('[data-next]').onclick=()=>{this.offset+=100;this.renderRows();};
    q('[data-refresh]').onclick=()=>this.refresh();q('[data-close]').onclick=()=>this.el.remove();
    q('[data-csv]').onclick=()=>downloadArticleFile(connectionCsv(this.filtered()),'schematico-verbindungen.csv','text/csv;charset=utf-8');
    q('[data-pdf]').onclick=()=>connectionListPdf(this.filtered(),this.getProject().name).save('schematico-verbindungen.pdf');
    q('[data-rows]').onclick=e=>{const button=(e.target as Element).closest<HTMLButtonElement>('button[data-row]');if(button)this.detail(this.rows[Number(button.dataset.row)]);};
    this.renderRows();finishEngineeringDialog(this.el,{kind:'wiring',description:'Projektweite Verbindungen, Netzteilnehmer und Fertigungsdaten',wide:true});focusArticleModal(this.el);
  }
  private renderRows(){const rows=this.filtered();this.offset=Math.min(this.offset,Math.max(0,Math.floor((rows.length-1)/100)*100));
    this.el.querySelector('[data-count]')!.textContent=`${rows.length} von ${this.rows.length} Verbindungen · ${rows.length?this.offset+1:0}–${Math.min(this.offset+100,rows.length)}`;
    (this.el.querySelector('[data-prev]') as HTMLButtonElement).disabled=this.offset===0;(this.el.querySelector('[data-next]') as HTMLButtonElement).disabled=this.offset+100>=rows.length;
    this.el.querySelector('[data-rows]')!.innerHTML=rows.slice(this.offset,this.offset+100).map(r=>`<tr>${connectionCells(r).map(c=>`<td style="padding:7px;border-top:1px solid #394555;max-width:240px;overflow-wrap:anywhere">${esc(c||'—')}</td>`).join('')}<td><button class="btn" data-row="${this.rows.indexOf(r)}">Details</button></td></tr>`).join('')||'<tr><td colspan="13">Keine Verbindungen gefunden.</td></tr>';
    this.el.querySelector('[data-detail]')!.innerHTML='';
  }
  private detail(row:ConnectionRow){const detail=this.el.querySelector<HTMLElement>('[data-detail]')!;
    detail.innerHTML=`<fieldset><legend>${esc(row.from+' → '+row.to)}</legend><p>Netzteilnehmer: ${esc(row.targets.join(' · ')||'nicht auflösbar')}</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-source ${row.fromPageId?'':'disabled'}>Zur Quelle</button><button class="btn" data-target ${row.toPageId?'':'disabled'}>Zum Ziel</button><button class="btn" data-wire ${row.pageId?'':'disabled'}>Zur Verbindung</button><label>Reale Länge [mm] <input type="number" data-length class="form-input" min="0" step="any" value="${esc(String(row.lengthMm??''))}" placeholder="nicht erfasst"></label><button class="btn" data-save>Länge übernehmen</button></div></fieldset>`;
    const jump=(p?:string,c?:string,w?:string)=>{if(p){this.el.remove();this.navigate(p,c,w);}};
    detail.querySelector<HTMLButtonElement>('[data-source]')!.onclick=()=>jump(row.fromPageId,row.fromComponentId);
    detail.querySelector<HTMLButtonElement>('[data-target]')!.onclick=()=>jump(row.toPageId,row.toComponentId);
    detail.querySelector<HTMLButtonElement>('[data-wire]')!.onclick=()=>jump(row.pageId,undefined,row.wireId);
    detail.querySelector<HTMLButtonElement>('[data-save]')!.onclick=()=>{try{const p=this.getProject();if(projectRevision(p)!==this.revision)throw new Error('Projekt wurde verändert. Bitte zuerst aktualisieren.');const input=detail.querySelector<HTMLInputElement>('[data-length]')!;if(!input.validity.valid)throw new Error('Bitte eine gültige Länge eingeben.');this.onApply(withConnectionLength(p,row,input.value===''?undefined:Number(input.value)));this.refresh();}catch(e){this.el.querySelector('[data-error]')!.textContent=e instanceof Error?e.message:String(e);}};
  }
}
