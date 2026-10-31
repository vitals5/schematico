import {RecentFiles,type RecentEntry} from '../model/RecentFiles';
import {escapeSvg} from '../model/ImportedDrawing';
import {t,getUiLanguage} from '../i18n';
export class RecentFilesDialog {
 private el=document.createElement('div');private closed=false;private busy=false;private restore=document.activeElement as HTMLElement|null;
 constructor(private history:RecentFiles,private onOpen:(entry:RecentEntry)=>Promise<boolean>,private onBrowse:()=>void){}
 show(){document.getElementById('recentFilesDialog')?.remove();this.el.id='recentFilesDialog';this.el.className='modal-backdrop';this.el.style.cssText='position:fixed;inset:0;z-index:4000;display:flex;align-items:center;justify-content:center;background:#0009;padding:16px';document.body.append(this.el);this.el.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'&&!this.busy)this.close();if(e.key==='Tab'){const all=[...this.el.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];if(e.shiftKey&&document.activeElement===all[0]){e.preventDefault();all.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===all.at(-1)){e.preventDefault();all[0]?.focus();}}});void this.render();}
 private close(){this.closed=true;this.el.remove();(this.restore?.isConnected&&this.restore.getClientRects().length?this.restore:document.getElementById('menuProjectTrigger'))?.focus();}
 private async render(){
  let entries:RecentEntry[]=[];let error='';try{entries=await this.history.list();}catch(e){error=t('recentHistoryError');}if(this.closed)return;
  this.el.innerHTML=`<section role="dialog" aria-modal="true" aria-labelledby="recentFilesTitle" style="width:min(680px,100%);max-height:88vh;overflow:auto;background:var(--bg-primary,#17202d);color:var(--text-primary,#eee);border:1px solid #526170;border-radius:8px;padding:20px"><h2 id="recentFilesTitle">${t('menuRecentFiles')}</h2><p style="color:var(--text-muted);font-size:12px">${t('recentFilesHint')}</p><div role="alert" data-error style="color:#fca5a5">${escapeSvg(error)}</div><div data-recent-list>${entries.length?entries.map(e=>`<div style="display:flex;gap:8px;align-items:center;margin:8px 0"><button type="button" class="btn" data-recent="${escapeSvg(e.id)}" style="display:block;flex:1;min-width:0;text-align:left;white-space:normal;overflow-wrap:anywhere;padding:10px"><strong>${escapeSvg(e.name)}</strong><small style="display:block;color:var(--text-muted);white-space:pre-wrap">${escapeSvg(e.kind==='native'?e.path??'':t(e.kind==='handle'?'recentDirectFile':e.kind==='copy'?'recentLocalCopy':'recentReselect'))}</small><small style="display:block;color:var(--text-muted)">${escapeSvg(new Date(e.openedAt).toLocaleString(getUiLanguage()))}</small></button><button type="button" class="btn" data-remove="${escapeSvg(e.id)}" aria-label="${escapeSvg(t('recentRemove')+': '+e.name)}" title="${t('recentRemove')}">×</button></div>`).join(''):`<p data-empty>${t('recentEmpty')}</p>`}</div><footer style="display:flex;gap:8px;flex-wrap:wrap;margin-top:18px"><button class="btn" data-clear ${entries.length?'':'disabled'}>${t('recentClear')}</button><button class="btn" data-browse>${t('menuOpen')}</button><button class="btn" data-close style="margin-left:auto">${t('close')}</button></footer></section>`;
  this.el.querySelector('[data-close]')?.addEventListener('click',()=>this.close());
  this.el.querySelector('[data-browse]')?.addEventListener('click',()=>{this.close();this.onBrowse();});
  const fail=(message:string)=>{const target=this.el.querySelector('[data-error]');if(target)target.textContent=message;};
  this.el.querySelector('[data-clear]')?.addEventListener('click',async()=>{try{await this.history.clear();await this.render();}catch{fail(t('recentHistoryError'));}});
  for(const button of this.el.querySelectorAll<HTMLButtonElement>('[data-remove]'))button.addEventListener('click',async()=>{try{await this.history.remove(button.dataset.remove!);await this.render();}catch{fail(t('recentHistoryError'));}});
  for(const button of this.el.querySelectorAll<HTMLButtonElement>('[data-recent]'))button.addEventListener('click',async()=>{
   if(this.busy)return;this.busy=true;for(const b of this.el.querySelectorAll<HTMLButtonElement>('button'))b.disabled=true;
   try{if(await this.onOpen(entries.find(e=>e.id===button.dataset.recent)!)){this.close();return;}}catch{fail(t('recentOpenError'));}
   finally{this.busy=false;if(!this.closed){for(const b of this.el.querySelectorAll<HTMLButtonElement>('button'))b.disabled=false;button.focus();}}
  });
  this.el.querySelector<HTMLButtonElement>('[data-recent],[data-close]')?.focus();
 }
}
