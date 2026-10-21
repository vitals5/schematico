// src/ui/FloorPlanImportDialog.ts
// Modal dialog for importing architectural blueprints and photos with Gemini AI vectorization

import { Page, Project, FloorPlanData } from '../model/types';
import { hasGeminiApiKey, getGeminiApiKey } from '../ai/GeminiConfig';
import { vectorizeFloorPlanWithGemini } from '../ai/GeminiFloorPlanService';
import { floorPlanToSvg } from '../model/FloorPlanRenderer';
import { t, getUiLanguage } from '../i18n';
import { escapeSvg } from '../model/ImportedDrawing';
import { computeImageFitBounds } from '../ai/GeometrySanitizer';

export interface FloorPlanImportDialogCallbacks {
  onCreatePage: (page: Page) => void;
  onOpenSettings?: () => void;
  onImportFloorPlanPage?: () => void;
  onImportFloorPlanPageFromFile?: (file: File) => Promise<void>;
}

export class FloorPlanImportDialog {
  private rawImageDataUrl: string | null = null;
  private imageNaturalWidth: number = 0;
  private imageNaturalHeight: number = 0;
  private currentFloorPlan: FloorPlanData | null = null;
  private isProcessing: boolean = false;
  private selectedCalibWallId: string | null = null;

  constructor(
    private readonly project: Project,
    private readonly callbacks: FloorPlanImportDialogCallbacks
  ) {}

  public show(): void {
    document.getElementById('floorPlanImportModal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'floorPlanImportModal';
    modal.className = 'modal-backdrop';
    modal.style.cssText = 'position:fixed;inset:0;padding:12px;z-index:2100;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.75);';

    const hasKey = hasGeminiApiKey();
    const defaultPageNum = String(this.project.pages.length + 1);

    modal.innerHTML = `
      <style>
        #floorPlanImportModal .fpi-card { width:100%; max-width:1050px; max-height:94vh; display:flex; flex-direction:column; overflow:hidden; border:1px solid #4a5568; border-radius:6px; background:#232731; color:#edf2f7; box-shadow:0 20px 40px rgba(0,0,0,.8); }
        #floorPlanImportModal .fpi-header { display:flex; align-items:center; justify-content:space-between; padding:12px 18px; background:#2d323e; border-bottom:1px solid #3e4656; }
        #floorPlanImportModal .fpi-body { min-height:0; overflow:auto; display:grid; grid-template-columns:minmax(320px, 1fr) minmax(360px, 1.4fr); gap:20px; padding:18px; }
        #floorPlanImportModal .fpi-controls { display:flex; flex-direction:column; gap:12px; }
        #floorPlanImportModal .fpi-field label { display:block; font-size:12px; font-weight:600; color:#e2e8f0; margin-bottom:4px; }
        #floorPlanImportModal .form-input { width:100%; box-sizing:border-box; background:#1a202c; border:1px solid #4a5568; color:#fff; padding:6px 10px; border-radius:4px; font-size:13px; }
        #floorPlanImportModal .dropzone { border:2px dashed #4a5568; border-radius:6px; padding:24px 16px; text-align:center; cursor:pointer; background:#1a202c; transition:border-color .2s, background .2s; }
        #floorPlanImportModal .dropzone:hover, #floorPlanImportModal .dropzone.dragover { border-color:#3182ce; background:#2a4365; }
        #floorPlanImportModal .preview-box { width:100%; height:460px; border:1px solid #4a5568; border-radius:6px; background:#181b22; display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative; }
        #floorPlanImportModal .preview-box svg { width:100%; height:100%; }
        #floorPlanImportModal .fpi-footer { display:flex; justify-content:flex-end; gap:8px; padding:12px 18px; border-top:1px solid #3e4656; background:#1c1f26; }
        @media (max-width:760px) { #floorPlanImportModal .fpi-body { grid-template-columns:1fr; } }
      </style>
      <div class="fpi-card">
        <div class="fpi-header">
          <strong>${t('importFloorPlanTitle')}</strong>
          <button id="fpi-close" type="button" style="background:none;border:none;color:#a0aec0;font-size:24px;cursor:pointer;">&times;</button>
        </div>

        <div class="fpi-body">
          <div class="fpi-controls">
            ${!hasKey ? `
              <div style="background:#2d3748;border:1px solid #4a5568;padding:10px 14px;border-radius:4px;font-size:12px;color:#edf2f7;">
                <div style="font-weight:600;color:#f6ad55;margin-bottom:4px;">💡 Kein Gemini API-Schlüssel hinterlegt</div>
                Du kannst das Foto/den Plan dennoch direkt als Zeichenvorlage importieren und Wände manuell zeichnen. Für automatische KI-Erkennung trage einen Gemini-Schlüssel ein.
                <button type="button" id="fpi-open-settings" class="btn" style="margin-top:6px;display:inline-block;font-size:11px;padding:3px 8px;background:#3182ce;color:#fff;border:none;border-radius:3px;cursor:pointer;">Einstellungen öffnen</button>
              </div>
            ` : ''}

            <!-- File Upload Dropzone -->
            <div class="dropzone" id="fpi-dropzone">
              <input type="file" id="fpi-file-input" accept="image/png,image/jpeg,image/webp,application/pdf,.json,.floorplan.json,.ems" style="display:none;" />
              <input type="file" id="fpi-json-file-input" accept=".json,.floorplan.json,.ems" style="display:none;" />
              <div style="font-size:28px;margin-bottom:6px;">📄</div>
              <div style="font-size:13px;font-weight:600;">${t('dropFloorPlanFile')}</div>
              <div style="font-size:11px;color:#a0aec0;margin-top:4px;">${t('supportedFormats')}</div>
              <div id="fpi-file-name" style="font-size:12px;color:#68d391;margin-top:8px;font-weight:bold;display:none;"></div>
            </div>

            <!-- Import existing floor plan page JSON button -->
            <div style="display:flex;align-items:center;gap:8px;margin:2px 0;">
              <div style="flex:1;height:1px;background:#3e4656;"></div>
              <span style="font-size:10px;color:#a0aec0;text-transform:uppercase;font-weight:600;">oder</span>
              <div style="flex:1;height:1px;background:#3e4656;"></div>
            </div>
            <button type="button" id="fpi-btn-import-json" class="btn" style="width:100%;padding:8px 12px;font-size:12px;font-weight:600;background:#2d3748;border:1px solid #4a5568;color:#edf2f7;border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:background .2s;">
              <span>📥</span>
              <span>${t('btnImportFloorPlanJson')}</span>
            </button>

            <div class="fpi-field">
              <label for="fpi-hint">${t('floorPlanHintLabel')}</label>
              <textarea id="fpi-hint" class="form-input" style="height:54px;resize:vertical;" placeholder="${t('floorPlanHintPlaceholder')}"></textarea>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div class="fpi-field">
                <label for="fpi-scale">${t('floorPlanScaleLabel')}</label>
                <select id="fpi-scale" class="form-input">
                  <option value="50">1 : 50 (Detail)</option>
                  <option value="100" selected>1 : 100 (Standard)</option>
                  <option value="200">1 : 200 (Übersicht)</option>
                  <option value="custom">Manuell (1 : X)</option>
                </select>
                <div id="fpi-custom-scale-wrap" style="display:none;margin-top:6px;align-items:center;gap:6px;">
                  <span style="font-size:11px;color:#cbd5e0;">1 :</span>
                  <input type="number" id="fpi-custom-scale" class="form-input" min="1" max="1000" value="75" style="width:80px;padding:3px 6px;font-size:11px;" />
                </div>
              </div>
              <div class="fpi-field">
                <label for="fpi-page-num">Blattnummer</label>
                <input type="text" id="fpi-page-num" class="form-input" value="${defaultPageNum}" />
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div class="fpi-field">
                <label for="fpi-level">=Anlage (Gebäude)</label>
                <input type="text" id="fpi-level" class="form-input" value="=Haus1" />
              </div>
              <div class="fpi-field">
                <label for="fpi-loc">+Ort (Geschoss/UV)</label>
                <input type="text" id="fpi-loc" class="form-input" value="+EG" />
              </div>
            </div>

            <div class="fpi-field">
              <label for="fpi-title">${t('floorPlanTitleLabel')}</label>
              <input type="text" id="fpi-title" class="form-input" value="Elektroinstallation Erdgeschoss" />
            </div>

            <div style="display:flex;flex-direction:column;gap:6px;">
              <button type="button" id="fpi-start-ai" class="btn btn-primary" style="padding:10px;font-size:13px;font-weight:bold;background:#3182ce;" ${!hasKey ? 'disabled' : ''}>
                ${t('btnStartVectorization')}
              </button>
              <button type="button" id="fpi-manual-import" class="btn" style="padding:9px;font-size:12px;font-weight:600;background:#2b6cb0;color:#fff;border:none;border-radius:4px;cursor:pointer;" disabled>
                📐 Als Zeichenvorlage übernehmen (ohne KI)
              </button>
            </div>

            <div id="fpi-progress-bar" style="display:none;background:#2d3748;border-radius:4px;overflow:hidden;height:6px;margin-top:4px;">
              <div id="fpi-progress-fill" style="background:#3182ce;height:100%;width:30%;transition:width .3s;"></div>
            </div>
            <div id="fpi-status-text" style="font-size:11px;color:#a0aec0;text-align:center;min-height:16px;"></div>
          </div>

          <!-- Preview Column -->
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <label style="font-size:12px;font-weight:600;color:#e2e8f0;">${t('previewVectorFloorPlan')}</label>
              <div id="fpi-opacity-control" style="display:none;align-items:center;gap:8px;font-size:11px;color:#a0aec0;">
                <span>${t('overlayOpacity')}:</span>
                <input type="range" id="fpi-opacity-slider" min="0" max="100" value="35" style="width:80px;accent-color:#3182ce;" />
                <span id="fpi-opacity-val">35%</span>
              </div>
            </div>

            <div class="preview-box" id="fpi-preview-container">
              <div id="fpi-preview-empty" style="color:#718096;font-size:13px;text-align:center;padding:20px;">
                Noch kein Grundriss geladen.<br/>
                <span style="font-size:11px;color:#a0aec0;">Lade links ein Bild oder Foto hoch. Es wird direkt als Zeichenvorlage angezeigt.</span>
              </div>
            </div>

            <!-- Reference Wall Scale Calibration Panel -->
            <div id="fpi-calibration-panel" style="display:none;background:#232731;border:1px solid #4a5568;border-radius:6px;padding:8px 12px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <span style="font-size:11px;font-weight:bold;color:#63b3ed;">📏 Maßstab über Referenzwand kalibrieren</span>
                <span id="fpi-calib-hint" style="font-size:10px;color:#90cdf4;">💡 Klick auf Wand in Vorschau wählt sie aus</span>
              </div>
              <div id="fpi-calib-inputs-row" style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end;">
                <div class="fpi-field" style="margin:0;">
                  <label for="fpi-calib-wall" style="font-size:10px;">Referenzwand:</label>
                  <select id="fpi-calib-wall" class="form-input" style="font-size:11px;padding:3px 6px;"></select>
                </div>
                <div class="fpi-field" style="margin:0;">
                  <label for="fpi-calib-len" style="font-size:10px;">Wahre Länge (m):</label>
                  <input type="number" id="fpi-calib-len" class="form-input" step="0.05" min="0.1" max="100" placeholder="z. B. 5.40" style="font-size:11px;padding:3px 6px;" />
                </div>
                <button type="button" id="fpi-btn-calibrate" class="btn btn-primary" style="font-size:11px;padding:5px 10px;background:#3182ce;height:28px;">
                  Kalibrieren
                </button>
              </div>
              <div id="fpi-calib-info" style="font-size:10px;color:#a0aec0;margin-top:4px;"></div>
            </div>

            <!-- Detected Rooms Summary -->
            <div id="fpi-rooms-list" style="display:none;background:#1a202c;border:1px solid #4a5568;border-radius:4px;padding:8px 12px;font-size:11px;max-height:80px;overflow-y:auto;">
            </div>
          </div>
        </div>

        <div class="fpi-footer">
          <button type="button" class="btn" id="fpi-cancel">${t('btnCancel')}</button>
          <button type="button" class="btn btn-primary" id="fpi-create-sheet" style="background:#38a169;" disabled>
            ${t('btnCreateInstallationPage')}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    const dropzone = modal.querySelector('#fpi-dropzone') as HTMLElement;
    const fileInput = modal.querySelector('#fpi-file-input') as HTMLInputElement;
    const fileNameDisplay = modal.querySelector('#fpi-file-name') as HTMLElement;
    const btnStartAi = modal.querySelector('#fpi-start-ai') as HTMLButtonElement;
    const btnManualImport = modal.querySelector('#fpi-manual-import') as HTMLButtonElement;
    const progressBar = modal.querySelector('#fpi-progress-bar') as HTMLElement;
    const progressFill = modal.querySelector('#fpi-progress-fill') as HTMLElement;
    const statusText = modal.querySelector('#fpi-status-text') as HTMLElement;
    const previewContainer = modal.querySelector('#fpi-preview-container') as HTMLElement;
    const opacityControl = modal.querySelector('#fpi-opacity-control') as HTMLElement;
    const opacitySlider = modal.querySelector('#fpi-opacity-slider') as HTMLInputElement;
    const opacityVal = modal.querySelector('#fpi-opacity-val') as HTMLElement;
    const roomsList = modal.querySelector('#fpi-rooms-list') as HTMLElement;
    const btnCreateSheet = modal.querySelector('#fpi-create-sheet') as HTMLButtonElement;

    modal.querySelector('#fpi-close')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#fpi-cancel')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#fpi-open-settings')?.addEventListener('click', () => {
      modal.remove();
      this.callbacks.onOpenSettings?.();
    });

    const scaleSelect = modal.querySelector('#fpi-scale') as HTMLSelectElement;
    const customScaleWrap = modal.querySelector('#fpi-custom-scale-wrap') as HTMLElement;
    const customScaleInput = modal.querySelector('#fpi-custom-scale') as HTMLInputElement;
    const calibPanel = modal.querySelector('#fpi-calibration-panel') as HTMLElement;
    const calibInputsRow = modal.querySelector('#fpi-calib-inputs-row') as HTMLElement;
    const calibHint = modal.querySelector('#fpi-calib-hint') as HTMLElement;
    const calibWallSelect = modal.querySelector('#fpi-calib-wall') as HTMLSelectElement;
    const calibLenInput = modal.querySelector('#fpi-calib-len') as HTMLInputElement;
    const btnCalibrate = modal.querySelector('#fpi-btn-calibrate') as HTMLButtonElement;
    const calibInfo = modal.querySelector('#fpi-calib-info') as HTMLElement;

    // Populate walls for calibration
    const updateCalibWalls = (plan: FloorPlanData) => {
      calibWallSelect.innerHTML = '';
      if (!plan.walls || plan.walls.length === 0) {
        calibPanel.style.display = 'block';
        if (calibInputsRow) calibInputsRow.style.display = 'none';
        if (calibHint) calibHint.style.display = 'none';
        calibInfo.style.display = 'block';
        calibInfo.innerHTML = `💡 <em>Noch keine Wände vorhanden. Du kannst nach dem Anlegen im Editor mit <strong>Wand zeichnen</strong> Wände über die Vorlage zeichnen und jede Wand mit <strong>Kalibrieren</strong> auf die exakte Originallänge anpassen.</em>`;
        return;
      }
      calibPanel.style.display = 'block';
      if (calibInputsRow) calibInputsRow.style.display = 'grid';
      if (calibHint) calibHint.style.display = 'inline';
      calibInfo.style.display = 'block';
      const ppm = plan.scale?.pixelPerMeter || 50;
      if (!this.selectedCalibWallId || !plan.walls.some(w => w.id === this.selectedCalibWallId)) {
        this.selectedCalibWallId = plan.walls[0].id;
      }
      plan.walls.forEach((w, idx) => {
        const lenPx = Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y);
        const lenM = (lenPx / ppm).toFixed(2);
        const opt = document.createElement('option');
        opt.value = w.id;
        opt.textContent = `Wand ${idx + 1} (${lenM} m, ${w.isExterior ? 'Außen' : 'Innen'})`;
        if (w.id === this.selectedCalibWallId) opt.selected = true;
        calibWallSelect.appendChild(opt);
      });
      syncCalibInput();
    };

    const jsonFileInput = modal.querySelector('#fpi-json-file-input') as HTMLInputElement;

    const onFileSelected = (file: File) => {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.json') || lower.endsWith('.ems')) {
        modal.remove();
        if (this.callbacks.onImportFloorPlanPageFromFile) {
          void this.callbacks.onImportFloorPlanPageFromFile(file);
        } else {
          this.callbacks.onImportFloorPlanPage?.();
        }
        return;
      }

      this.handleFile(
        file,
        fileNameDisplay,
        scaleSelect,
        customScaleInput,
        opacitySlider,
        opacityControl,
        previewContainer,
        btnCreateSheet,
        btnManualImport,
        statusText,
        updateCalibWalls
      );
    };

    modal.querySelector('#fpi-btn-import-json')?.addEventListener('click', (e) => {
      e.stopPropagation();
      jsonFileInput?.click();
    });

    jsonFileInput?.addEventListener('change', () => {
      if (jsonFileInput.files && jsonFileInput.files.length > 0) {
        onFileSelected(jsonFileInput.files[0]);
      }
    });

    // File selection
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        onFileSelected(files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        onFileSelected(fileInput.files[0]);
      }
    });

    btnManualImport.addEventListener('click', () => {
      btnCreateSheet.click();
    });

    // Opacity slider
    opacitySlider.addEventListener('input', () => {
      const val = Number(opacitySlider.value);
      opacityVal.textContent = `${val}%`;
      if (this.currentFloorPlan?.backgroundImage) {
        this.currentFloorPlan.backgroundImage.opacity = val / 100;
        this.updatePreview(previewContainer);
      }
    });

    scaleSelect.addEventListener('change', () => {
      customScaleWrap.style.display = scaleSelect.value === 'custom' ? 'flex' : 'none';
      if (this.currentFloorPlan) {
        const ratio = scaleSelect.value === 'custom' ? Number(customScaleInput.value) || 100 : Number(scaleSelect.value);
        this.currentFloorPlan.scale.scaleRatio = ratio;
        this.currentFloorPlan.scale.pixelPerMeter = Math.round((1000 * 2) / ratio);
        this.updatePreview(previewContainer);
        this.renderRoomsSummary(this.currentFloorPlan, roomsList);
        updateCalibWalls(this.currentFloorPlan);
      }
    });

    customScaleInput.addEventListener('input', () => {
      const ratio = Number(customScaleInput.value);
      if (ratio > 0 && this.currentFloorPlan) {
        this.currentFloorPlan.scale.scaleRatio = ratio;
        this.currentFloorPlan.scale.pixelPerMeter = Math.round((1000 * 2) / ratio);
        this.updatePreview(previewContainer);
        this.renderRoomsSummary(this.currentFloorPlan, roomsList);
        updateCalibWalls(this.currentFloorPlan);
      }
    });

    const syncCalibInput = () => {
      if (!this.currentFloorPlan) return;
      const wallId = calibWallSelect.value;
      this.selectedCalibWallId = wallId;
      const wall = this.currentFloorPlan.walls?.find(w => w.id === wallId);
      if (wall) {
        const ppm = this.currentFloorPlan.scale?.pixelPerMeter || 50;
        const lenPx = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
        calibLenInput.value = (lenPx / ppm).toFixed(2);
      }
    };

    calibWallSelect.addEventListener('change', () => {
      syncCalibInput();
      this.updatePreview(previewContainer);
    });

    previewContainer.addEventListener('click', (e) => {
      if (!this.currentFloorPlan?.walls?.length) return;
      const wallEl = (e.target as Element)?.closest?.('[data-wall-id]');
      const wallId = wallEl?.getAttribute('data-wall-id');
      const wall = wallId ? this.currentFloorPlan.walls.find(w => w.id === wallId) : null;
      if (wall) {
        this.selectedCalibWallId = wall.id;
        calibWallSelect.value = wall.id;
        const ppm = this.currentFloorPlan.scale?.pixelPerMeter || 50;
        const lenPx = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
        calibLenInput.value = (lenPx / ppm).toFixed(2);
        calibLenInput.focus();
        calibLenInput.select();
        calibInfo.textContent = `🎯 Wand ausgewählt (${(lenPx / ppm).toFixed(2)} m). Reale Länge eintragen & kalibrieren.`;
        this.updatePreview(previewContainer);
      }
    });

    btnCalibrate.addEventListener('click', () => {
      if (!this.currentFloorPlan) return;
      const wallId = calibWallSelect.value;
      const wall = this.currentFloorPlan.walls?.find(w => w.id === wallId);
      const realM = parseFloat(calibLenInput.value);
      if (!wall || isNaN(realM) || realM <= 0) return;

      const lenPx = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
      if (lenPx <= 0) return;

      const newPpm = lenPx / realM;
      const newRatio = Math.max(1, Math.round((1000 * 2) / newPpm));
      this.currentFloorPlan.scale.pixelPerMeter = newPpm;
      this.currentFloorPlan.scale.scaleRatio = newRatio;
      this.currentFloorPlan.scale.referenceDistance = {
        pointA: wall.start,
        pointB: wall.end,
        realLengthMeters: realM
      };

      scaleSelect.value = 'custom';
      customScaleWrap.style.display = 'flex';
      customScaleInput.value = String(newRatio);
      calibInfo.textContent = `✓ Maßstab kalibriert: 1 : ${newRatio} (${newPpm.toFixed(1)} px/m)`;

      updateCalibWalls(this.currentFloorPlan);
      this.updatePreview(previewContainer);
      this.renderRoomsSummary(this.currentFloorPlan, roomsList);
    });

    // AI Start
    btnStartAi.addEventListener('click', async () => {
      if (!this.rawImageDataUrl) {
        alert('Bitte wähle zuerst ein Bild aus.');
        return;
      }
      this.isProcessing = true;
      btnStartAi.disabled = true;
      progressBar.style.display = 'block';
      progressFill.style.width = '20%';
      statusText.textContent = t('vectorizingProgress');

      const hint = (modal.querySelector('#fpi-hint') as HTMLTextAreaElement).value.trim();
      const scaleVal = scaleSelect.value === 'custom'
        ? (Number(customScaleInput.value) || 100)
        : Number(scaleSelect.value);

      try {
        progressFill.style.width = '45%';
        const plan = await vectorizeFloorPlanWithGemini(this.rawImageDataUrl, {
          userPromptHint: hint,
          canvasWidth: 840,
          canvasHeight: 594,
          imageNaturalWidth: this.imageNaturalWidth,
          imageNaturalHeight: this.imageNaturalHeight,
          onProgress: (status) => {
            statusText.textContent = status;
            progressFill.style.width = '75%';
          }
        });

        plan.scale.scaleRatio = scaleVal;
        plan.scale.pixelPerMeter = Math.round((1000 * 2) / scaleVal);
        this.currentFloorPlan = plan;
        progressFill.style.width = '100%';
        statusText.style.color = '#68d391';
        statusText.textContent = 'Grundriss erfolgreich vektorisiert!';

        // Update preview & rooms
        opacityControl.style.display = 'flex';
        this.updatePreview(previewContainer);
        this.renderRoomsSummary(plan, roomsList);
        updateCalibWalls(plan);

        btnCreateSheet.disabled = false;
      } catch (err: any) {
        statusText.style.color = '#fc8181';
        statusText.textContent = err?.message || 'Fehler bei der KI-Vektorisierung.';
      } finally {
        this.isProcessing = false;
        btnStartAi.disabled = false;
      }
    });

    // Create Page
    btnCreateSheet.addEventListener('click', () => {
      if (!this.currentFloorPlan) return;

      const pageNum = (modal.querySelector('#fpi-page-num') as HTMLInputElement).value.trim() || defaultPageNum;
      const higherLevel = (modal.querySelector('#fpi-level') as HTMLInputElement).value.trim() || '=Haus1';
      const location = (modal.querySelector('#fpi-loc') as HTMLInputElement).value.trim() || '+EG';
      const title = (modal.querySelector('#fpi-title') as HTMLInputElement).value.trim() || 'Installationsplan';

      const newPage: Page = {
        id: `page_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        pageNumber: pageNum,
        pageType: 'installation',
        title,
        higherLevel,
        location,
        components: [],
        wires: [],
        floorPlan: this.currentFloorPlan,
        plotFrame: {
          type: 'DIN_A3_LANDSCAPE',
          width: 840,
          height: 594,
          columns: 10,
          rows: ['A', 'B', 'C', 'D', 'E', 'F'],
          titleBlock: {
            projectTitle: this.project.name,
            commission: '',
            company: this.project.company,
            author: this.project.author,
            date: new Date().toLocaleDateString('de-DE'),
            revision: '1.0',
            sheetNumber: pageNum,
            totalSheets: String(this.project.pages.length + 1)
          }
        }
      };

      modal.remove();
      this.callbacks.onCreatePage(newPage);
    });
  }

  private handleFile(
    file: File,
    displayElem: HTMLElement,
    scaleSelect: HTMLSelectElement,
    customScaleInput: HTMLInputElement,
    opacitySlider: HTMLInputElement,
    opacityControl: HTMLElement,
    previewContainer: HTMLElement,
    btnCreateSheet: HTMLButtonElement,
    btnManualImport: HTMLButtonElement,
    statusText: HTMLElement,
    updateCalibWalls: (plan: FloorPlanData) => void
  ): void {
    displayElem.style.display = 'block';
    displayElem.textContent = `Ausgewählt: ${file.name} (${Math.round(file.size / 1024)} KB)`;

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        this.rawImageDataUrl = result;
        const img = new Image();
        img.onload = () => {
          this.imageNaturalWidth = img.naturalWidth;
          this.imageNaturalHeight = img.naturalHeight;
          displayElem.textContent = `Ausgewählt: ${file.name} (${img.naturalWidth} × ${img.naturalHeight} px, ${Math.round(file.size / 1024)} KB)`;

          // Initialize floor plan with background image template immediately (Non-AI import ready)
          const targetBox = { x: 30, y: 25, width: 780, height: 530 };
          const bounds = computeImageFitBounds(img.naturalWidth, img.naturalHeight, targetBox);
          const ratio = scaleSelect.value === 'custom'
            ? (Number(customScaleInput.value) || 100)
            : Number(scaleSelect.value);
          const ppm = Math.round((1000 * 2) / ratio);
          const opacity = (Number(opacitySlider.value) || 35) / 100;

          this.currentFloorPlan = {
            walls: [],
            openings: [],
            rooms: [],
            scale: {
              scaleRatio: ratio,
              pixelPerMeter: ppm
            },
            backgroundImage: {
              dataUrl: result,
              bounds,
              opacity,
              visible: true
            }
          };

          opacityControl.style.display = 'flex';
          this.updatePreview(previewContainer);
          if (this.currentFloorPlan) {
            updateCalibWalls(this.currentFloorPlan);
          }
          btnCreateSheet.disabled = false;
          btnManualImport.disabled = false;
          statusText.style.color = '#68d391';
          statusText.textContent = 'Vorlage geladen. Du kannst sie direkt übernehmen oder per KI vektorisieren.';
        };
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
  }

  private updatePreview(container: HTMLElement): void {
    if (!this.currentFloorPlan) return;

    const svgContent = floorPlanToSvg(this.currentFloorPlan, {
      showBackground: true,
      showRooms: true,
      showWalls: true,
      showOpenings: true,
      showWires: true,
      selectedWallId: this.selectedCalibWallId ?? undefined,
      interactive: true
    });

    container.innerHTML = `
      <svg viewBox="0 0 840 594" xmlns="http://www.w3.org/2000/svg" style="cursor:pointer;">
        <rect width="840" height="594" fill="#181b22" />
        ${svgContent}
      </svg>
    `;
  }

  private renderRoomsSummary(plan: FloorPlanData, container: HTMLElement): void {
    if (!plan.rooms || plan.rooms.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    const roomTags = plan.rooms.map((r, idx) => {
      return `
        <div style="display:inline-flex;align-items:center;gap:4px;background:#2d3748;padding:2px 6px;border-radius:6px;margin:2px;border:1px solid #4a5568;">
          <span style="font-size:11px;">🏠</span>
          <input type="text" class="fpi-room-name-inp" data-room-index="${idx}" value="${escapeSvg(r.name)}" style="background:#1a202c;border:1px solid #4a5568;color:#e2e8f0;font-size:11px;padding:1px 5px;border-radius:3px;width:110px;" title="Raumnamen anpassen" />
        </div>
      `;
    }).join(' ');

    container.innerHTML = `
      <div style="font-weight:600;margin-bottom:6px;color:#cbd5e0;display:flex;justify-content:space-between;align-items:center;">
        <span>Erkannte Räume (${plan.rooms.length}):</span>
        <span style="font-size:10px;font-weight:normal;color:#a0aec0;">(Namen können hier direkt editiert werden)</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;">${roomTags}</div>
    `;

    container.querySelectorAll('.fpi-room-name-inp').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const idx = Number((e.target as HTMLElement).dataset.roomIndex);
        if (plan.rooms[idx]) {
          plan.rooms[idx].name = (e.target as HTMLInputElement).value;
        }
      });
    });
  }
}
