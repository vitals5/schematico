import { externalMacroLibrary } from '../model/ExternalMacroLibrary';
import { escapeSvg } from '../model/ImportedDrawing';
import { t } from '../i18n';

function populate(panel: HTMLElement): void {
  const library = externalMacroLibrary, state = library.state, native = !!library.native;
  const picker = typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';
  const disabled = state.busy ? 'disabled' : '';
  panel.style.cssText = 'border:1px solid var(--border-color,#4a5568);border-radius:4px;padding:10px;margin:8px 0;font-size:12px';
  panel.innerHTML = `<strong>${escapeSvg(t('macroFolderExtHeading'))}</strong>
    <label style="display:block;margin:6px 0">${native ? escapeSvg(t('macroFolderPath')) : escapeSvg(t('macroFolderShared'))}<input class="form-input" data-folder-path aria-label="${escapeSvg(t('macroFolderLabel'))}" value="${escapeSvg(state.path)}" ${native ? '' : 'readonly'} placeholder="${native ? 'C:\\Macros' : escapeSvg(t('macroFolderNoneSelected'))}"></label>
    <div style="display:flex;gap:5px;flex-wrap:wrap"><button class="btn" data-folder-choose ${disabled}>${escapeSvg(t('macroFolderChoose'))}</button>${native ? `<button class="btn" data-folder-apply ${disabled}>${escapeSvg(t('macroFolderApply'))}</button>` : ''}
    <button class="btn" data-folder-refresh ${disabled || (!state.path ? 'disabled' : '')}>${state.needsAccess ? escapeSvg(t('macroFolderGrantAccess')) : escapeSvg(t('macroFolderRefresh'))}</button>
    <button class="btn" data-folder-disconnect ${disabled || (!state.path ? 'disabled' : '')}>${escapeSvg(t('macroFolderDisconnect'))}</button></div>
    <input type="file" data-folder-files webkitdirectory multiple style="display:none">
    <p data-folder-status role="status" style="margin:6px 0;overflow-wrap:anywhere">${escapeSvg(state.busy ? t('macroFolderReading') : state.error || (state.needsAccess ? t('macroFolderNeedsAccess') : state.path ? t('macroFolderLoaded', { macros: state.macroCount, files: state.fileCount }) : t('macroFolderDefaultHint')))}</p>
    ${!native ? `<p style="margin:4px 0;color:var(--text-muted,#a0aec0)">${picker ? escapeSvg(t('macroFolderBrowserPersistent')) : escapeSvg(t('macroFolderBrowserSession'))}</p>` : ''}
    ${state.issues.length ? `<details><summary>${escapeSvg(t('macroFolderIssues', { count: state.issues.length }))}</summary><ul style="max-height:140px;overflow:auto;padding-left:18px">${state.issues.map(issue => `<li>${escapeSvg(issue)}</li>`).join('')}</ul></details>` : ''}
    ${state.warnings?.length ? `<details data-folder-warnings><summary>${escapeSvg(t('macroFolderWarnings', { count: state.warnings.length }))}</summary><ul style="max-height:180px;overflow:auto;overflow-wrap:anywhere;padding-left:18px">${state.warnings.map(warning=>`<li>${escapeSvg(warning)}</li>`).join('')}</ul></details>`:''}`;
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
