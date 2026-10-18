import { Page, PageImage, Project } from '../model/types';
import { CoverPageData, coverPageFields, coverPageLogo, coverPageSvg } from '../model/CoverPage';
import { escapeSvg } from '../model/ImportedDrawing';
import { isBundledSupplierLogo } from '../model/PresentationNaming';

export interface CoverPageDialogCallbacks {
  onSave: (cover: CoverPageData) => void;
}

/** Edits page-specific cover values without changing shared project master data. */
export class CoverPageDialog {
  private readonly draft: CoverPageData;
  private logoRequest = 0;
  private logoLoading = false;

  constructor(private readonly page: Page, private readonly project: Project,
    private readonly callbacks: CoverPageDialogCallbacks) {
    this.draft = JSON.parse(JSON.stringify(page.coverPage ?? {}));
  }

  public show(): void {
    document.getElementById('coverPageModal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'coverPageModal';
    modal.className = 'modal-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'cover-title');
    modal.innerHTML = `
      <style>
        #coverPageModal { position:fixed; inset:0; padding:12px; z-index:2100; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.75); }
        #coverPageModal .cover-card { width:100%; max-width:1100px; max-height:94vh; display:flex; flex-direction:column; overflow:hidden; border:1px solid #4a5568; border-radius:6px; background:#232731; color:#edf2f7; box-shadow:0 20px 40px rgba(0,0,0,.8); }
        #coverPageModal .cover-header { display:flex; align-items:center; justify-content:space-between; padding:10px 16px; background:#2d323e; border-bottom:1px solid #3e4656; }
        #coverPageModal .cover-body { min-height:0; overflow:auto; display:grid; grid-template-columns:minmax(250px,1fr) minmax(300px,1.3fr); gap:20px; padding:16px; }
        #coverPageModal .cover-fields { display:flex; flex-direction:column; gap:10px; }
        #coverPageModal .cover-field label { display:block; font-size:12px; margin-bottom:4px; }
        #coverPageModal .form-input { width:100%; box-sizing:border-box; }
        #coverPageModal textarea { resize:vertical; min-height:52px; }
        #coverPageModal input[readonly] { color:#a0aec0; background:#181b22; }
        #coverPageModal .cover-preview-column { align-self:start; position:sticky; top:0; min-width:0; }
        #coverPageModal #cover-preview { overflow:hidden; border:1px solid #4a5568; background:#1a202c; }
        #coverPageModal #cover-preview svg { display:block; width:100%; height:auto; }
        #coverPageModal .cover-logo-controls { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
        #coverPageModal .cover-logo-position { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin-top:10px; }
        #coverPageModal .cover-note { color:#a0aec0; font-size:11px; margin:8px 0; }
        #coverPageModal .cover-footer { display:flex; justify-content:flex-end; gap:8px; padding:10px 16px; border-top:1px solid #3e4656; background:#1c1f26; }
        @media (max-width:760px) { #coverPageModal .cover-body { grid-template-columns:1fr; } #coverPageModal .cover-preview-column { position:static; } }
      </style>
      <div class="modal-card ecad-window cover-card">
        <div class="cover-header ecad-window-header">
          <strong id="cover-title">Titelseite bearbeiten</strong>
          <button id="cover-close" type="button" aria-label="Schließen" style="background:none;border:none;color:#a0aec0;font-size:22px;cursor:pointer;">&times;</button>
        </div>
        <div class="cover-body">
          <div class="cover-fields">${this.renderFields()}</div>
          <div class="cover-preview-column">
            <div id="cover-preview" aria-label="Vorschau der Titelseite"></div>
            <p class="cover-note">Die Vorschau zeigt die Titelseite im Seitenformat. Angaben gelten für diese Titelseite.</p>
            <strong style="font-size:12px;">Logo</strong>
            <div class="cover-logo-controls">
              <button id="cover-logo-upload" class="btn" type="button">Bild laden…</button>
              <button id="cover-logo-remove" class="btn" type="button">Entfernen</button>
              <button id="cover-logo-template" class="btn" type="button">Vorlagenlogo</button>
              <input id="cover-logo-file" type="file" accept="image/png,image/jpeg" hidden>
            </div>
            <div id="cover-logo-position" class="cover-logo-position"></div>
            <p id="cover-logo-error" role="alert" style="color:#fc8181;font-size:12px;"></p>
          </div>
        </div>
        <div class="cover-footer">
          <button id="cover-apply" class="btn" type="button">Übernehmen</button>
          <button id="cover-save" class="btn btn-primary" type="button">OK</button>
          <button id="cover-cancel" class="btn" type="button">Abbrechen</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const close = () => { this.logoRequest++; modal.remove(); };
    for (const id of ['cover-close', 'cover-cancel']) modal.querySelector<HTMLButtonElement>(`#${id}`)!.onclick = close;
    modal.addEventListener('keydown', event => {
      // Keep editor shortcuts away from the underlying document while editing.
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); close(); }
    });
    modal.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-cover-field]').forEach(input => {
      input.addEventListener('input', () => {
        (this.draft.values ??= {})[input.dataset.coverField!] = input.value;
        this.updatePreview(modal);
      });
    });
    modal.querySelector<HTMLButtonElement>('#cover-apply')!.onclick = () => this.save(modal);
    modal.querySelector<HTMLButtonElement>('#cover-save')!.onclick = () => { if (this.save(modal)) close(); };
    const fileInput = modal.querySelector<HTMLInputElement>('#cover-logo-file')!;
    modal.querySelector<HTMLButtonElement>('#cover-logo-upload')!.onclick = () => fileInput.click();
    fileInput.onchange = () => {
      const file = fileInput.files?.[0];
      fileInput.value = ''; // Selecting the same image after removal must work again.
      void this.loadLogo(modal, file);
    };
    modal.querySelector<HTMLButtonElement>('#cover-logo-remove')!.onclick = () => {
      this.logoRequest++;
      this.setLogoLoading(modal, false);
      this.draft.logo = null;
      this.setLogoError(modal, '');
      this.updateLogoPosition(modal);
      this.updatePreview(modal);
    };
    modal.querySelector<HTMLButtonElement>('#cover-logo-template')!.onclick = () => {
      this.logoRequest++;
      this.setLogoLoading(modal, false);
      delete this.draft.logo;
      this.setLogoError(modal, '');
      this.updateLogoPosition(modal);
      this.updatePreview(modal);
    };
    this.updateLogoPosition(modal);
    this.updatePreview(modal);
    modal.querySelector<HTMLInputElement | HTMLTextAreaElement>('[data-cover-field]')?.focus();
  }

  private editingPage(): Page { return { ...this.page, coverPage: this.draft }; }

  private renderFields(): string {
    return coverPageFields(this.editingPage(), this.project).map(field => {
      const id = `cover-field-${field.key}`;
      const attributes = `id="${escapeSvg(id)}" class="form-input" ${field.readOnly ? 'readonly' : `data-cover-field="${escapeSvg(field.key)}"`}`;
      const multiline = /beschreibung|beschreibungstext|anschrift|adresse|description|address/i.test(field.label) || field.value.includes('\n');
      return `<div class="cover-field"><label for="${escapeSvg(id)}">${escapeSvg(field.label)}</label>${multiline && !field.readOnly
        ? `<textarea ${attributes} rows="2">${escapeSvg(field.value)}</textarea>`
        : `<input type="text" ${attributes} value="${escapeSvg(field.value)}">`}</div>`;
    }).join('');
  }

  private updatePreview(modal: HTMLElement): void {
    modal.querySelector('#cover-preview')!.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${this.page.plotFrame.width} ${this.page.plotFrame.height}" aria-label="Titelseite">${coverPageSvg(this.editingPage(), this.project)}</svg>`;
  }

  private effectiveLogo(): PageImage | undefined {
    return coverPageLogo(this.editingPage(), this.project);
  }

  private updateLogoPosition(modal: HTMLElement): void {
    const logo = this.effectiveLogo();
    modal.querySelector('#cover-logo-position')!.innerHTML = (['x', 'y', 'width', 'height'] as const).map((key, index) => `<div class="cover-field"><label for="cover-logo-${key}">${['X (mm)', 'Y (mm)', 'Breite (mm)', 'Höhe (mm)'][index]}</label><input id="cover-logo-${key}" data-logo-coordinate="${key}" class="form-input" type="number" step="any" required ${key === 'width' || key === 'height' ? 'min="0.1"' : ''} ${logo ? `value="${logo[key]}"` : 'disabled'}></div>`).join('');
    modal.querySelectorAll<HTMLInputElement>('[data-logo-coordinate]').forEach(input => input.addEventListener('input', () => {
      if (!input.checkValidity() || input.value.trim() === '' || !Number.isFinite(input.valueAsNumber)) return;
      const current = this.effectiveLogo();
      if (!current) return;
      this.draft.logo = { ...current, [input.dataset.logoCoordinate!]: input.valueAsNumber };
      this.updatePreview(modal);
    }));
  }

  private async loadLogo(modal: HTMLElement, file?: File): Promise<void> {
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      this.setLogoError(modal, 'Bitte ein PNG- oder JPEG-Bild auswählen.');
      return;
    }
    const request = ++this.logoRequest;
    this.setLogoError(modal, '');
    this.setLogoLoading(modal, true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Die Bilddatei konnte nicht gelesen werden.'));
        reader.readAsDataURL(file);
      });
      // Decoding rejects damaged images before storing an inline project asset.
      await new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Die Bilddatei ist beschädigt oder wird nicht unterstützt.'));
        image.src = dataUrl;
      });
      if (!modal.isConnected || request !== this.logoRequest) return;
      const old = this.effectiveLogo();
      const logo = { ...(old ?? { id: 'cover-logo', x: 64, y: 24.346394, width: 29, height: 40.386 }), dataUrl, caption:file.name };
      if(isBundledSupplierLogo(logo))throw new Error('Bitte ein eigenes Firmenlogo verwenden.');
      this.draft.logo = logo;
      this.setLogoError(modal, '');
      this.updateLogoPosition(modal);
      this.updatePreview(modal);
    } catch (error) {
      if (modal.isConnected && request === this.logoRequest) this.setLogoError(modal, error instanceof Error ? error.message : 'Die Bilddatei konnte nicht geladen werden.');
    } finally {
      if (modal.isConnected && request === this.logoRequest) this.setLogoLoading(modal, false);
    }
  }

  private setLogoError(modal: HTMLElement, message: string): void {
    modal.querySelector('#cover-logo-error')!.textContent = message;
  }

  private setLogoLoading(modal: HTMLElement, loading: boolean): void {
    this.logoLoading = loading;
    for (const id of ['cover-apply', 'cover-save']) modal.querySelector<HTMLButtonElement>(`#${id}`)!.disabled = loading;
    modal.querySelector('#cover-logo-upload')!.textContent = loading ? 'Bild wird geladen…' : 'Bild laden…';
  }

  private save(modal: HTMLElement): boolean {
    if (this.logoLoading) return false;
    const invalid = [...modal.querySelectorAll<HTMLInputElement>('[data-logo-coordinate]:not(:disabled)')]
      .find(input => input.value.trim() === '' || !Number.isFinite(input.valueAsNumber) || !input.checkValidity());
    if (invalid) { invalid.reportValidity(); invalid.focus(); return false; }
    this.callbacks.onSave(JSON.parse(JSON.stringify(this.draft)));
    return true;
  }
}
