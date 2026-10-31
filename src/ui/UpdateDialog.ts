import { version } from '../../package.json';
import { getUiLanguage } from '../i18n';
import { checkForUpdates, RELEASES_URL, UpdateCheckError } from '../model/Updates';

export class UpdateDialog {
  static show(): void {
    const existing=document.getElementById('updateDialog') as HTMLDialogElement|null;
    if(existing){existing.focus();return;}
    const en=getUiLanguage()==='en', previous=document.activeElement;
    const dialog=document.createElement('dialog');dialog.id='updateDialog';dialog.className='about-dialog modal-backdrop';
    dialog.setAttribute('aria-labelledby','update-title');
    dialog.innerHTML=`<div class="about-heading"><h2 id="update-title">${en?'Check for updates':'Nach Updates suchen'}</h2><button type="button" class="btn" data-close aria-label="${en?'Close':'Schließen'}" autofocus>×</button></div>
      <div class="about-body"><p>${en?'Current version':'Aktuelle Version'}: <strong>${version}</strong></p><p>${en?'Latest stable version':'Neueste stabile Version'}: <strong data-latest>—</strong></p><p data-status role="status" aria-live="polite"></p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px"><button type="button" class="btn" data-check>${en?'Check again':'Erneut prüfen'}</button><a class="btn" data-download href="${RELEASES_URL}" target="_blank" rel="noopener noreferrer">${en?'Open GitHub releases':'GitHub-Releases öffnen'}</a></div></div>`;
    let active:AbortController|undefined, tag='latest';
    const status=dialog.querySelector<HTMLElement>('[data-status]')!, latest=dialog.querySelector<HTMLElement>('[data-latest]')!, button=dialog.querySelector<HTMLButtonElement>('[data-check]')!, download=dialog.querySelector<HTMLAnchorElement>('[data-download]')!;
    const check=async()=>{
      if(button.disabled)return;
      active=new AbortController();button.disabled=true;latest.textContent='—';tag='latest';download.href=RELEASES_URL;download.classList.remove('btn-primary');download.textContent=en?'Open GitHub releases':'GitHub-Releases öffnen';
      status.textContent=en?'Checking latest release …':'Neueste Veröffentlichung wird geprüft …';
      try {
        const result=await checkForUpdates(version,fetch,active.signal);
        if(!dialog.isConnected)return;
        latest.textContent=result.latestVersion;tag=result.tag;download.href=result.url;
        status.textContent=result.status==='available'?(en?'A new version is available.':'Eine neue Version ist verfügbar.'):result.status==='ahead'?(en?'Your version is newer than the latest stable release.':'Deine Version ist neuer als die letzte stabile Veröffentlichung.'):(en?'Your version is up to date.':'Deine Version ist aktuell.');
        if(result.status==='available'){download.textContent=en?'Open download page':'Downloadseite öffnen';download.classList.add('btn-primary');}
      } catch(error) {
        if(!dialog.isConnected)return;
        const reason=error instanceof UpdateCheckError?error.reason:'network';
        status.textContent=reason==='limit'?(en?'GitHub request limit reached. Try later or open the release page.':'GitHub-Anfragelimit erreicht. Bitte später erneut prüfen oder die Release-Seite öffnen.'):reason==='timeout'?(en?'The update check timed out. Please try again.':'Die Updateprüfung hat zu lange gedauert. Bitte erneut versuchen.'):(en?'Updates could not be checked. Check your internet connection or open the release page.':'Updates konnten nicht geprüft werden. Bitte Internetverbindung prüfen oder die Release-Seite öffnen.');
      } finally {if(dialog.isConnected)button.disabled=false;}
    };
    download.addEventListener('click',event=>{
      const native=(window as unknown as {electronAPI?:{updates?:{openRelease:(tag:string)=>Promise<boolean>}}}).electronAPI?.updates;
      if(!native)return;
      event.preventDefault();native.openRelease(tag).catch(()=>{status.textContent=en?'The browser could not be opened. Please try again.':'Der Browser konnte nicht geöffnet werden. Bitte erneut versuchen.';});
    });
    dialog.querySelector('[data-close]')!.addEventListener('click',()=>dialog.close());
    button.addEventListener('click',()=>void check());
    dialog.addEventListener('close',()=>{active?.abort();dialog.remove();if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();},{once:true});
    document.body.append(dialog);dialog.showModal();void check();
  }
}
