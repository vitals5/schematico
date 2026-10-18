import { externalMacroLibrary } from '../model/ExternalMacroLibrary';
import { escapeSvg } from '../model/ImportedDrawing';

function populate(panel: HTMLElement): void {
  const library = externalMacroLibrary, state = library.state, native = !!library.native;
  const picker = typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';
  const disabled = state.busy ? 'disabled' : '';
  panel.style.cssText = 'border:1px solid var(--border-color,#4a5568);border-radius:4px;padding:10px;margin:8px 0;font-size:12px';
  panel.innerHTML = `<strong>Externer Makroordner</strong>
    <label style="display:block;margin:6px 0">${native ? 'Ordnerpfad' : 'Freigegebener Ordner'}<input class="form-input" data-folder-path aria-label="Makroordner" value="${escapeSvg(state.path)}" ${native ? '' : 'readonly'} placeholder="${native ? 'C:\\Makros' : 'Kein Ordner gewählt'}"></label>
    <div style="display:flex;gap:5px;flex-wrap:wrap"><button class="btn" data-folder-choose ${disabled}>Ordner wählen…</button>${native ? `<button class="btn" data-folder-apply ${disabled}>Pfad übernehmen</button>` : ''}
    <button class="btn" data-folder-refresh ${disabled || (!state.path ? 'disabled' : '')}>${state.needsAccess ? 'Zugriff freigeben' : 'Aktualisieren'}</button>
    <button class="btn" data-folder-disconnect ${disabled || (!state.path ? 'disabled' : '')}>Trennen</button></div>
    <input type="file" data-folder-files webkitdirectory multiple style="display:none">
    <p data-folder-status role="status" style="margin:6px 0;overflow-wrap:anywhere">${escapeSvg(state.busy ? 'Makroordner wird gelesen…' : state.error || (state.needsAccess ? 'Bitte den gespeicherten Ordner erneut freigeben oder auswählen.' : state.path ? `${state.macroCount} Makros aus ${state.fileCount} Dateien geladen.` : 'Makros (.ema / .ems), einschließlich Unterordnern.'))}</p>
    ${!native ? `<p style="margin:4px 0;color:var(--text-muted,#a0aec0)">${picker ? 'Der Browser speichert die Ordnerfreigabe. Falls nötig, den Zugriff beim nächsten Start erneut freigeben.' : 'Dieser Browser benötigt nach einem Neustart eine erneute Ordnerauswahl. Neue oder geänderte Dateien durch erneute Auswahl laden.'}</p>` : ''}
    ${state.issues.length ? `<details><summary>${state.issues.length} Dateien oder Unterordner nicht geladen</summary><ul style="max-height:140px;overflow:auto;padding-left:18px">${state.issues.map(issue => `<li>${escapeSvg(issue)}</li>`).join('')}</ul></details>` : ''}`;
  panel.querySelector('[data-folder-choose]')?.addEventListener('click', () => {
    if (native || picker) void library.choose(); else (panel.querySelector('[data-folder-files]') as HTMLInputElement).click();
  });
  panel.querySelector('[data-folder-files]')?.addEventListener('change', event => void library.selectFiles(Array.from((event.target as HTMLInputElement).files || [])));
  panel.querySelector('[data-folder-refresh]')?.addEventListener('click', () => {
    if (!native && !picker) (panel.querySelector('[data-folder-files]') as HTMLInputElement).click(); else void library.refresh();
  });
  panel.querySelector('[data-folder-disconnect]')?.addEventListener('click', () => void library.disconnect());
  if (native) panel.querySelector('[data-folder-path]')?.addEventListener('keydown', event => { if ((event as KeyboardEvent).key === 'Enter') { event.preventDefault(); event.stopPropagation(); void library.setNativeFolder((event.target as HTMLInputElement).value); } });
  panel.querySelector('[data-folder-apply]')?.addEventListener('click', () => void library.setNativeFolder((panel.querySelector('[data-folder-path]') as HTMLInputElement).value));
}
export function createMacroFolderPanel(): HTMLElement {
  const panel = document.createElement('div'); panel.dataset.externalMacroFolder = ''; populate(panel); return panel;
}
export function refreshMacroFolderPanels(): void {
  document.querySelectorAll<HTMLElement>('[data-external-macro-folder]').forEach(populate);
}
