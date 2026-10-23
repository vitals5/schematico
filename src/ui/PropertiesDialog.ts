import { deviceBoxFields, collectDeviceBoxFields } from './DeviceBoxFields';
// src/ui/PropertiesDialog.ts
// Component properties modal ("Eigenschaften (Schaltzeichen)")

import { referenceMarkup } from '../model/CrossReferenceNavigation';
import { PlacedComponent, Project, TextFormatConfig } from '../model/types';
import { escapeSvg } from '../model/ImportedDrawing';
import { getSymbolForComponent, getDrawingUnitsPerMm } from '../model/symbols';
import { MANUFACTURER_PARTS } from '../model/PartCatalogue';
import { computeBmkPosition, computeFunctionTextPosition, computeAdditionalTextPosition, computeTechnicalDataPosition, computeCrossReferencePosition, computePinLabelPosition, arePinLabelsVisible, setComponentLabelText } from '../model/LabelLayout';
import { componentInsertionPoint, positionAtInsertionPoint, rotatedLocalPoint } from '../model/SymbolGeometry';
import { isInterruptionSymbol } from '../model/ConnectionSymbols';
import { t, getLocalizedSymbol } from '../i18n';

export interface PropertiesDialogCallbacks {
  onSave: (updated: PlacedComponent) => void;
  onNavigateToPage?: (pageId: string) => void;
  onNavigateToReference?: (index: number) => void;
}

export class PropertiesDialog {
  private component: PlacedComponent;
  private project: Project;
  private callbacks: PropertiesDialogCallbacks;
  private activeTab: 'symbol' | 'display' | 'part' | 'crossref' | 'format' = 'symbol';

  constructor(component: PlacedComponent, project: Project, callbacks: PropertiesDialogCallbacks) {
    this.component = JSON.parse(JSON.stringify(component)); // deep clone for editing
    this.project = project;
    this.callbacks = callbacks;
  }

  public show(): void {
    const existing = document.getElementById('propertiesModal');
    if (existing) existing.remove();

    const sym = getSymbolForComponent(this.component, this.project);
    const symName = sym ? getLocalizedSymbol(sym).name : t('symbol');

    const modal = document.createElement('div');
    modal.id = 'propertiesModal';
    modal.className = 'modal-backdrop';
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.backgroundColor = 'rgba(0,0,0,0.75)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '2100';
    modal.style.padding = '12px';

    modal.innerHTML = `
      <div class="modal-card ecad-window" style="
        background: #232731;
        border: 1px solid #4a5568;
        border-radius: 6px;
        width: 100%;
        max-width: 760px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.8);
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
            <span style="color: #dd6b20; font-weight: bold;">⚡</span>
            <span>${escapeSvg(t('propDialogTitle', { bmk: this.component.bmk, name: symName }))}</span>
          </div>
          <button id="btnClosePropModal" style="background: none; border: none; color: #a0aec0; font-size: 20px; cursor: pointer; line-height: 1;">&times;</button>
        </div>

        <!-- Tab Navigation -->
        <div class="ecad-tab-bar" style="
          display: flex;
          background: #1c1f26;
          border-bottom: 1px solid #3e4656;
          padding: 0 8px;
          overflow-x: auto;
        ">
          <button class="ecad-tab-btn ${this.activeTab === 'symbol' ? 'active' : ''}" data-tab="symbol">${escapeSvg(t('propTabSymbol'))}</button>
          <button class="ecad-tab-btn ${this.activeTab === 'display' ? 'active' : ''}" data-tab="display">${escapeSvg(t('propTabDisplay'))}</button>
          <button class="ecad-tab-btn ${this.activeTab === 'part' ? 'active' : ''}" data-tab="part">${escapeSvg(t('propTabPart'))}</button>
          <button class="ecad-tab-btn ${this.activeTab === 'crossref' ? 'active' : ''}" data-tab="crossref">${escapeSvg(t('propTabCrossRef'))}</button>
          <button class="ecad-tab-btn ${this.activeTab === 'format' ? 'active' : ''}" data-tab="format">${escapeSvg(t('propTabFormat'))}</button>
        </div>

        <!-- Tab Body Content -->
        <div id="propTabContent" style="padding: 16px; max-height: 72vh; overflow-y: auto;">
          ${this.renderActiveTabContent()}
        </div>

        <!-- Footer Action Buttons -->
        <div style="
          padding: 10px 16px;
          border-top: 1px solid #3e4656;
          background: #1c1f26;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        ">
          <button id="btnApplyProp" class="btn" style="padding: 6px 14px; font-size: 12px;">${escapeSvg(t('propBtnApply'))}</button>
          <button id="btnSaveProp" class="btn btn-primary" style="padding: 6px 16px; font-size: 12px; font-weight: 600;">${escapeSvg(t('propBtnOk'))}</button>
          <button id="btnCancelProp" class="btn" style="padding: 6px 14px; font-size: 12px;">${escapeSvg(t('propBtnCancel'))}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    this.bindEvents(modal);
  }

  private renderActiveTabContent(): string {
    const sym = getSymbolForComponent(this.component, this.project);

    if (this.activeTab === 'symbol') {
      return `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label class="form-label">${escapeSvg(t('propVisibleBmk'))}</label>
              <input type="text" id="propBmk" class="form-input" value="${escapeSvg(this.component.bmk)}" placeholder="-K1">
            </div>
            <div>
              <label class="form-label">${escapeSvg(t('propFullBmkPreview'))}</label>
              <input type="text" class="form-input" disabled value="${escapeSvg(this.component.higherLevelFunction ?? '=A1')}${escapeSvg(this.component.mountingLocation ?? '+S1')}${escapeSvg(this.component.bmk)}" style="background: #181b22; color: #a0aec0;">
            </div>
          </div>

          <div>
            <label class="form-label">${escapeSvg(t('propDeviceTag'))}</label>
            <input type="text" id="propDeviceTag" class="form-input" value="${escapeSvg(this.component.deviceTag || '')}" placeholder="${escapeSvg(t('propDeviceTagPlaceholder'))}">
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label class="form-label">${escapeSvg(t('propFunctionText'))}</label>
              <textarea id="propFunctionText" class="form-input" rows="2" placeholder="${escapeSvg(t('propFunctionPlaceholder'))}">${escapeSvg(this.component.functionText || '')}</textarea>
            </div>
            <div>
              <label class="form-label">${escapeSvg(t('propAdditionalText'))}</label>
              <textarea id="propAdditionalText" class="form-input" rows="2" placeholder="${escapeSvg(t('propAdditionalPlaceholder'))}">${escapeSvg(this.component.additionalText || '')}</textarea>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label class="form-label">${escapeSvg(t('propPlant'))}</label>
              <input type="text" id="propHigherLevel" class="form-input" value="${escapeSvg(this.component.higherLevelFunction ?? '=A1')}">
            </div>
            <div>
              <label class="form-label">${escapeSvg(t('propLocation'))}</label>
              <input type="text" id="propLocation" class="form-input" value="${escapeSvg(this.component.mountingLocation ?? '+S1')}">
            </div>
          </div>

          <div>
            <label class="form-label">${escapeSvg(t('propTechnicalData'))}</label>
            <textarea id="propTechChar" class="form-input" rows="2" placeholder="${escapeSvg(t('propTechnicalPlaceholder'))}">${escapeSvg(this.component.technicalCharacteristics || '')}</textarea>
          </div>

          <div>
            <label class="form-label">${escapeSvg(t('propPinLabel'))}</label>
            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px;">
              ${sym?.pins.map(p => `
                <div style="display: flex; align-items: center; gap: 4px; background: #1a202c; border: 1px solid #3e4656; padding: 4px 8px; border-radius: 4px; font-size: 11px;">
                  <span style="color: #63b3ed; font-family: monospace;">${escapeSvg(t('propPinPrefix'))} ${p.id}:</span>
                  <input type="text" class="prop-pin-label" data-pin-id="${p.id}" value="${escapeSvg(this.component.pins[p.id]?.customLabel ?? p.name)}" style="width: 45px; background: #2d3748; border: 1px solid #4a5568; color: white; padding: 2px 4px; border-radius: 2px; font-size: 11px; text-align: center;">
                </div>
              `).join('') || `<span style="font-size: 11px; color: #a0aec0;">${escapeSvg(t('propPinsNone'))}</span>`}
            </div>
          </div>
        </div>
      `;
    }

    if (this.activeTab === 'display') {
      const units = getDrawingUnitsPerMm(this.project);
      const bmkPos = { preset: 'auto', visible: true, alignment: sym ? computeBmkPosition(this.component, sym).anchor : 'end', rotation: 0, fontSize: 10, offsetX: 0, offsetY: 0, ...this.component.bmkPosition };
      const fnPos = { preset: 'auto', visible: true, alignment: sym ? computeFunctionTextPosition(this.component, sym).anchor : 'end', rotation: 0, fontSize: 8, offsetX: 0, offsetY: 0, ...this.component.functionTextPosition };
      const techPos = { preset: 'auto', visible: !!(this.component.deviceTag || this.component.technicalCharacteristics), alignment: sym ? computeTechnicalDataPosition(this.component, sym).anchor : 'end', rotation: 0, fontSize: 8, offsetX: 0, offsetY: 0, ...this.component.technicalDataPosition };
      const bmkFontVal = Number(((sym ? computeBmkPosition(this.component, sym).fontSize : bmkPos.fontSize) / units).toFixed(4));
      const fnFontVal = Number(((sym ? computeFunctionTextPosition(this.component, sym).fontSize : fnPos.fontSize) / units).toFixed(4));
      const techFontVal = Number(((sym ? computeTechnicalDataPosition(this.component, sym).fontSize : techPos.fontSize) / units).toFixed(4));
      const rowGridStyle = 'display: grid; grid-template-columns: 1.7fr 0.85fr 0.85fr 1.15fr 0.8fr 0.9fr; gap: 8px; align-items: end;';

      return `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <!-- Description Header -->
          <div style="font-size: 11px; color: #a0aec0; background: #1a202c; border: 1px solid #3e4656; border-radius: 4px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;">
            <span>${escapeSvg(t('propDisplayDesc'))}</span>
            <button id="btnResetPositions" class="btn" style="padding: 2px 8px; font-size: 10px; white-space: nowrap;">${escapeSvg(t('propResetPositions'))}</button>
          </div>

          <!-- Section 1: BMK Position -->
          <div style="background: #1f242e; border: 1px solid #3e4656; border-radius: 6px; padding: 10px 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-weight: 600; font-size: 12px; color: #f6e05e;">${escapeSvg(t('propBmkHeading'))}</span>
              <label style="font-size: 11px; display: flex; align-items: center; gap: 6px; cursor: pointer;">
                <input type="checkbox" id="propBmkVisible" ${bmkPos.visible !== false ? 'checked' : ''}>
                ${escapeSvg(t('propVisible'))}
              </label>
            </div>

            <div style="${rowGridStyle}">
              <div>
                <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propPositionPreset'))}</label>
                <select id="propBmkPreset" class="form-input" style="font-size: 11px; padding: 4px 6px;">
                  <option value="auto" ${bmkPos.preset === 'auto' ? 'selected' : ''}>${escapeSvg(t('propPresetAuto'))}</option>
                  <option value="top" ${bmkPos.preset === 'top' ? 'selected' : ''}>${escapeSvg(t('propPresetTop'))}</option>
                  <option value="top_left" ${bmkPos.preset === 'top_left' ? 'selected' : ''}>${escapeSvg(t('propPresetTopLeft'))}</option>
                  <option value="top_right" ${bmkPos.preset === 'top_right' ? 'selected' : ''}>${escapeSvg(t('propPresetTopRight'))}</option>
                  <option value="bottom" ${bmkPos.preset === 'bottom' ? 'selected' : ''}>${escapeSvg(t('propPresetBottom'))}</option>
                  <option value="bottom_left" ${bmkPos.preset === 'bottom_left' ? 'selected' : ''}>${escapeSvg(t('propPresetBottomLeft'))}</option>
                  <option value="bottom_right" ${bmkPos.preset === 'bottom_right' ? 'selected' : ''}>${escapeSvg(t('propPresetBottomRight'))}</option>
                  <option value="left" ${bmkPos.preset === 'left' ? 'selected' : ''}>${escapeSvg(t('propPresetLeft'))}</option>
                  <option value="right" ${bmkPos.preset === 'right' ? 'selected' : ''}>${escapeSvg(t('propPresetRight'))}</option>
                  <option value="custom" ${bmkPos.preset === 'custom' ? 'selected' : ''}>${escapeSvg(t('propPresetCustom'))}</option>
                </select>
              </div>

              <div>
                <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propOffsetX'))}</label>
                <input type="number" step="any" id="propBmkOffsetX" class="form-input" value="${bmkPos.offsetX || 0}" style="font-size: 11px; padding: 4px 6px;">
              </div>

              <div>
                <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propOffsetY'))}</label>
                <input type="number" step="any" id="propBmkOffsetY" class="form-input" value="${bmkPos.offsetY || 0}" style="font-size: 11px; padding: 4px 6px;">
              </div>

              <div>
                <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propAlignment'))}</label>
                <select id="propBmkAlignment" class="form-input" style="font-size: 11px; padding: 4px 6px;">
                  <option value="middle" ${bmkPos.alignment === 'middle' ? 'selected' : ''}>${escapeSvg(t('propAlignMiddle'))}</option>
                  <option value="start" ${bmkPos.alignment === 'start' ? 'selected' : ''}>${escapeSvg(t('propAlignStart'))}</option>
                  <option value="end" ${bmkPos.alignment === 'end' ? 'selected' : ''}>${escapeSvg(t('propAlignEnd'))}</option>
                </select>
              </div>

              <div>
                <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propRotation'))}</label>
                <select id="propBmkRotation" class="form-input" style="font-size: 11px; padding: 4px 6px;">
                  <option value="0" ${bmkPos.rotation === 0 ? 'selected' : ''}>0°</option>
                  <option value="90" ${bmkPos.rotation === 90 ? 'selected' : ''}>90°</option>
                  <option value="180" ${bmkPos.rotation === 180 ? 'selected' : ''}>180°</option>
                  <option value="270" ${bmkPos.rotation === 270 ? 'selected' : ''}>270°</option>
                </select>
              </div>

              <div>
                <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propFontSize'))}</label>
                <input type="number" min="0.1" max="20" step="0.1" id="propBmkFontSize" class="form-input" value="${bmkFontVal}" style="font-size: 11px; padding: 4px 6px;">
              </div>
            </div>
          </div>

          <!-- Section 2: Funktionstext Position -->
          <div style="background: #1f242e; border: 1px solid #3e4656; border-radius: 6px; padding: 10px 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-weight: 600; font-size: 12px; color: #e2e8f0;">${escapeSvg(t('propFnHeading'))}</span>
              <label style="font-size: 11px; display: flex; align-items: center; gap: 6px; cursor: pointer;">
                <input type="checkbox" id="propFnVisible" ${fnPos.visible !== false ? 'checked' : ''}>
                ${escapeSvg(t('propVisible'))}
              </label>
            </div>

            <div style="${rowGridStyle}">
              <div>
                <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propPositionPreset'))}</label>
                <select id="propFnPreset" class="form-input" style="font-size: 11px; padding: 4px 6px;">
                  <option value="auto" ${fnPos.preset === 'auto' ? 'selected' : ''}>${escapeSvg(t('propPresetAuto'))}</option>
                  <option value="bottom" ${fnPos.preset === 'bottom' ? 'selected' : ''}>${escapeSvg(t('propPresetBottom'))}</option>
                  <option value="bottom_left" ${fnPos.preset === 'bottom_left' ? 'selected' : ''}>${escapeSvg(t('propPresetBottomLeft'))}</option>
                  <option value="bottom_right" ${fnPos.preset === 'bottom_right' ? 'selected' : ''}>${escapeSvg(t('propPresetBottomRight'))}</option>
                  <option value="top" ${fnPos.preset === 'top' ? 'selected' : ''}>${escapeSvg(t('propPresetTop'))}</option>
                  <option value="top_left" ${fnPos.preset === 'top_left' ? 'selected' : ''}>${escapeSvg(t('propPresetTopLeft'))}</option>
                  <option value="top_right" ${fnPos.preset === 'top_right' ? 'selected' : ''}>${escapeSvg(t('propPresetTopRight'))}</option>
                  <option value="left" ${fnPos.preset === 'left' ? 'selected' : ''}>${escapeSvg(t('propPresetLeft'))}</option>
                  <option value="right" ${fnPos.preset === 'right' ? 'selected' : ''}>${escapeSvg(t('propPresetRight'))}</option>
                  <option value="custom" ${fnPos.preset === 'custom' ? 'selected' : ''}>${escapeSvg(t('propPresetCustom'))}</option>
                </select>
              </div>

              <div>
                <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propOffsetX'))}</label>
                <input type="number" step="any" id="propFnOffsetX" class="form-input" value="${fnPos.offsetX || 0}" style="font-size: 11px; padding: 4px 6px;">
              </div>

              <div>
                <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propOffsetY'))}</label>
                <input type="number" step="any" id="propFnOffsetY" class="form-input" value="${fnPos.offsetY || 0}" style="font-size: 11px; padding: 4px 6px;">
              </div>

              <div>
                <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propAlignment'))}</label>
                <select id="propFnAlignment" class="form-input" style="font-size: 11px; padding: 4px 6px;">
                  <option value="middle" ${fnPos.alignment === 'middle' ? 'selected' : ''}>${escapeSvg(t('propAlignMiddle'))}</option>
                  <option value="start" ${fnPos.alignment === 'start' ? 'selected' : ''}>${escapeSvg(t('propAlignStart'))}</option>
                  <option value="end" ${fnPos.alignment === 'end' ? 'selected' : ''}>${escapeSvg(t('propAlignEnd'))}</option>
                </select>
              </div>

              <div>
                <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propRotation'))}</label>
                <select id="propFnRotation" class="form-input" style="font-size: 11px; padding: 4px 6px;">
                  <option value="0" ${fnPos.rotation === 0 ? 'selected' : ''}>0°</option>
                  <option value="90" ${fnPos.rotation === 90 ? 'selected' : ''}>90°</option>
                  <option value="180" ${fnPos.rotation === 180 ? 'selected' : ''}>180°</option>
                  <option value="270" ${fnPos.rotation === 270 ? 'selected' : ''}>270°</option>
                </select>
              </div>

              <div>
                <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propFontSize'))}</label>
                <input type="number" min="0.1" max="20" step="0.1" id="propFnFontSize" class="form-input" value="${fnFontVal}" style="font-size: 11px; padding: 4px 6px;">
              </div>
            </div>
          </div>

          <!-- Section 3: Gerätebezeichnung & Technische Daten -->
          <div style="background: #1f242e; border: 1px solid #3e4656; border-radius: 6px; padding: 10px 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-weight: 600; font-size: 12px; color: #68d391;">${escapeSvg(t('propTechHeading'))}</span>
              <label style="font-size: 11px; display: flex; align-items: center; gap: 6px; cursor: pointer;">
                <input type="checkbox" id="propTechVisible" ${techPos.visible ? 'checked' : ''}>
                ${escapeSvg(t('propVisible'))}
              </label>
            </div>

            <div style="${rowGridStyle}">
              <div>
                <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propPositionPreset'))}</label>
                <select id="propTechPreset" class="form-input" style="font-size: 11px; padding: 4px 6px;">
                  <option value="auto" ${techPos.preset === 'auto' ? 'selected' : ''}>${escapeSvg(t('propPresetAuto'))}</option>
                  <option value="bottom" ${techPos.preset === 'bottom' ? 'selected' : ''}>${escapeSvg(t('propPresetBottomUnderFn'))}</option>
                  <option value="top" ${techPos.preset === 'top' ? 'selected' : ''}>${escapeSvg(t('propPresetTop'))}</option>
                  <option value="right" ${techPos.preset === 'right' ? 'selected' : ''}>${escapeSvg(t('propPresetRight'))}</option>
                  <option value="left" ${techPos.preset === 'left' ? 'selected' : ''}>${escapeSvg(t('propPresetLeft'))}</option>
                  <option value="custom" ${techPos.preset === 'custom' ? 'selected' : ''}>${escapeSvg(t('propPresetCustom'))}</option>
                </select>
              </div>

              <div>
                <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propOffsetX'))}</label>
                <input type="number" step="any" id="propTechOffsetX" class="form-input" value="${techPos.offsetX || 0}" style="font-size: 11px; padding: 4px 6px;">
              </div>

              <div>
                <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propOffsetY'))}</label>
                <input type="number" step="any" id="propTechOffsetY" class="form-input" value="${techPos.offsetY || 0}" style="font-size: 11px; padding: 4px 6px;">
              </div>

              <div>
                <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propAlignment'))}</label>
                <select id="propTechAlignment" class="form-input" style="font-size: 11px; padding: 4px 6px;">
                  <option value="middle" ${techPos.alignment === 'middle' ? 'selected' : ''}>${escapeSvg(t('propAlignMiddle'))}</option>
                  <option value="start" ${techPos.alignment === 'start' ? 'selected' : ''}>${escapeSvg(t('propAlignStart'))}</option>
                  <option value="end" ${techPos.alignment === 'end' ? 'selected' : ''}>${escapeSvg(t('propAlignEnd'))}</option>
                </select>
              </div>

              <div>
                <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propRotation'))}</label>
                <select id="propTechRotation" class="form-input" style="font-size: 11px; padding: 4px 6px;">
                  <option value="0" ${techPos.rotation === 0 ? 'selected' : ''}>0°</option>
                  <option value="90" ${techPos.rotation === 90 ? 'selected' : ''}>90°</option>
                  <option value="180" ${techPos.rotation === 180 ? 'selected' : ''}>180°</option>
                  <option value="270" ${techPos.rotation === 270 ? 'selected' : ''}>270°</option>
                </select>
              </div>

              <div>
                <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propFontSize'))}</label>
                <input type="number" min="0.1" max="20" step="0.1" id="propTechFontSize" class="form-input" value="${techFontVal}" style="font-size: 11px; padding: 4px 6px;">
              </div>
            </div>
          </div>

          ${this.additionalTextPositionFields()}
          ${this.crossReferencePositionFields()}
          ${this.pinLabelPositionFields()}

          <!-- Section 4: Live Interactive Preview -->
          <div style="background: #181d26; border: 1px solid #3e4656; border-radius: 6px; padding: 12px;">
            <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #63b3ed; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
              <span>${escapeSvg(t('propLivePreview'))}</span>
            </div>
            <div id="previewSvgWrapper" style="display: flex; justify-content: center; align-items: center; background: #13171f; border: 1px dashed #4a5568; border-radius: 4px; padding: 12px; min-height: 140px; overflow: hidden;">
              ${this.generatePreviewSvg()}
            </div>
          </div>
        </div>
      `;
    }

    if (this.activeTab === 'part') {
      return `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div style="background: #1c212c; border: 1px solid #3e4656; border-radius: 6px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 12px; font-weight: 600; color: #63b3ed;">${escapeSvg(t('propPartHeading'))}</div>
              <div style="font-size: 11px; color: #a0aec0;">${escapeSvg(t('propPartDesc'))}</div>
            </div>
            <select id="quickPartSelect" class="form-input" style="width: auto; max-width: 260px;">
              <option value="">${escapeSvg(t('propPartSelectQuick'))}</option>
              ${MANUFACTURER_PARTS.map(p => `
                <option value="${p.id}" ${this.component.articleNumber === p.articleNumber ? 'selected' : ''}>
                  ${p.manufacturer}: ${p.articleNumber} (${escapeSvg(p.name)})
                </option>
              `).join('')}
            </select>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label class="form-label">${escapeSvg(t('propManufacturer'))}</label>
              <input type="text" id="propManufacturer" class="form-input" value="${escapeSvg(this.component.manufacturer || '')}" placeholder="z.B. Siemens / Hager / Finder">
            </div>
            <div>
              <label class="form-label">${escapeSvg(t('propOrderNumber'))}</label>
              <input type="text" id="propArticleNumber" class="form-input" value="${escapeSvg(this.component.articleNumber || '')}" placeholder="z.B. 3RT2016-1BB41">
            </div>
          </div>

          <div>
            <label class="form-label">${escapeSvg(t('propPartShortDesc'))}</label>
            <input type="text" id="propPartDesc" class="form-input" value="${escapeSvg(this.component.technicalCharacteristics || '')}" placeholder="${escapeSvg(t('propPartDescPlaceholder'))}">
          </div>
        </div>
      `;
    }

    if (this.activeTab === 'crossref') {
      const crossRefText = referenceMarkup(this.project, this.component) || t('propCrossRefNone');
      return `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div style="background: #181d26; border: 1px solid #3e4656; border-radius: 6px; padding: 12px;">
            <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #f6ad55; margin-bottom: 6px;">
              ${escapeSvg(t('propCrossRefStatus'))}
            </div>
            <div style="font-size: 14px; font-family: monospace; color: #edf2f7; font-weight: bold; margin-bottom: 6px;">
              ${crossRefText}
            </div>
            <div style="font-size: 11px; color: #a0aec0; line-height: 1.5;">
              ${t('propCrossRefInfo')}
            </div>
          </div>

          <div style="border-top: 1px solid #3e4656; padding-top: 10px;">
            <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px;">${escapeSvg(t('propCrossRefLinks'))}</div>
            <ul style="font-size: 11px; color: #cbd5e0; padding-left: 18px; line-height: 1.6;">
              ${this.getRelatedComponentsHtml()}
            </ul>
          </div>
        </div>
      `;
    }

    if (this.activeTab === 'format') {
      const insertion = sym ? componentInsertionPoint(this.component, sym) : this.component;
      return `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${deviceBoxFields(this.component,getDrawingUnitsPerMm(this.project))}
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label class="form-label">${escapeSvg(t('propPosX'))}</label>
              <input type="number" step="any" id="propPosX" class="form-input" value="${insertion.x}">
            </div>
            <div>
              <label class="form-label">${escapeSvg(t('propPosY'))}</label>
              <input type="number" step="any" id="propPosY" class="form-input" value="${insertion.y}">
            </div>
          </div>

          <div>
            <label class="form-label">${escapeSvg(t('propRotationAngle'))}</label>
            <select id="propRotation" class="form-input">
              <option value="0" ${this.component.rotation === 0 ? 'selected' : ''}>${escapeSvg(t('propRot0'))}</option>
              <option value="90" ${this.component.rotation === 90 ? 'selected' : ''}>${escapeSvg(t('propRot90'))}</option>
              <option value="180" ${this.component.rotation === 180 ? 'selected' : ''}>${escapeSvg(t('propRot180'))}</option>
              <option value="270" ${this.component.rotation === 270 ? 'selected' : ''}>${escapeSvg(t('propRot270'))}</option>
            </select>
          </div>
        </div>
      `;
    }

    return '';
  }

  private crossReferencePositionFields(): string {
    const cfg = this.component.crossRefPosition;
    const units = getDrawingUnitsPerMm(this.project);
    const fontVal = Number(((this.component.crossRefFontSize ?? cfg?.fontSize ?? 8) / units).toFixed(4));
    const rowGridStyle = 'display: grid; grid-template-columns: 1.7fr 0.85fr 0.85fr 1.15fr 0.8fr 0.9fr; gap: 8px; align-items: end;';
    return `<div style="background: #1f242e; border: 1px solid #3e4656; border-radius: 6px; padding: 10px 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-weight: 600; font-size: 12px; color: #f6ad55;">${escapeSvg(t('propCrossRefHeading'))}</span>
        <label style="font-size: 11px; display: flex; align-items: center; gap: 6px; cursor: pointer;">
          <input type="checkbox" id="propCrossRefVisible" ${cfg?.visible !== false ? 'checked' : ''}>
          ${escapeSvg(t('propVisible'))}
        </label>
      </div>
      <div style="${rowGridStyle}">
        <div>
          <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propPositionPreset'))}</label>
          <select class="form-input" id="propCrossRefPreset" style="font-size: 11px; padding: 4px 6px;">${[
            ['auto',t('propPresetAutoStandard')],['custom',t('propPresetCustomWithOffset')],['top',t('propPresetTop')],['top_left',t('propPresetTopLeft')],['top_right',t('propPresetTopRight')],
            ['bottom',t('propPresetBottom')],['bottom_left',t('propPresetBottomLeft')],['bottom_right',t('propPresetBottomRight')],['left',t('propPresetLeft')],['right',t('propPresetRight')]
          ].map(([value,label])=>`<option value="${value}" ${(cfg?.preset ?? 'auto')===value?'selected':''}>${label}</option>`).join('')}</select>
        </div>
        <div>
          <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propOffsetX'))}</label>
          <input type="number" step="any" class="form-input" id="propCrossRefOffsetX" value="${(cfg?.offsetX ?? 0)/units}" style="font-size: 11px; padding: 4px 6px;">
        </div>
        <div>
          <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propOffsetY'))}</label>
          <input type="number" step="any" class="form-input" id="propCrossRefOffsetY" value="${(cfg?.offsetY ?? 0)/units}" style="font-size: 11px; padding: 4px 6px;">
        </div>
        <div>
          <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propAlignment'))}</label>
          <select class="form-input" id="propCrossRefAlignment" style="font-size: 11px; padding: 4px 6px;">${[
            ['',t('propAlignAuto')],['start',t('propAlignStart')],['middle',t('propAlignMiddle')],['end',t('propAlignEnd')]
          ].map(([value,label])=>`<option value="${value}" ${(cfg?.alignment ?? '')===value?'selected':''}>${label}</option>`).join('')}</select>
        </div>
        <div>
          <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propRotation'))}</label>
          <select class="form-input" id="propCrossRefRotation" style="font-size: 11px; padding: 4px 6px;">${[0,90,180,270].map(value=>`<option value="${value}" ${(cfg?.rotation ?? 0)===value?'selected':''}>${value}°</option>`).join('')}</select>
        </div>
        <div>
          <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propFontSize'))}</label>
          <input type="number" min="0.1" max="20" step="0.1" id="propCrossRefFontSize" class="form-input" value="${fontVal}" style="font-size: 11px; padding: 4px 6px;">
        </div>
      </div>
    </div>`;
  }

  private additionalTextPositionFields(): string {
    const symbol = getSymbolForComponent(this.component, this.project);
    const cfg = { alignment: symbol ? computeAdditionalTextPosition(this.component, symbol).anchor : 'end', ...this.component.additionalTextPosition };
    const units = getDrawingUnitsPerMm(this.project);
    const fontVal = Number(((symbol ? computeAdditionalTextPosition(this.component, symbol).fontSize : (cfg.fontSize ?? 8)) / units).toFixed(4));
    const presets = [['auto',t('propPresetAuto')],['bottom',t('propPresetBottom')],['bottom_left',t('propPresetBottomLeft')],['bottom_right',t('propPresetBottomRight')],['top',t('propPresetTop')],['top_left',t('propPresetTopLeft')],['top_right',t('propPresetTopRight')],['left',t('propPresetLeft')],['right',t('propPresetRight')],['custom',t('propPresetCustom')]];
    const rowGridStyle = 'display: grid; grid-template-columns: 1.7fr 0.85fr 0.85fr 1.15fr 0.8fr 0.9fr; gap: 8px; align-items: end;';
    return `<div style="background: #1f242e; border: 1px solid #3e4656; border-radius: 6px; padding: 10px 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-weight: 600; font-size: 12px; color: #cbd5e0;">${escapeSvg(t('propAdditionalHeading'))}</span>
        <label style="font-size: 11px; display: flex; align-items: center; gap: 6px; cursor: pointer;">
          <input id="propAdditionalVisible" type="checkbox" ${cfg.visible !== false ? 'checked' : ''}>
          ${escapeSvg(t('propVisible'))}
        </label>
      </div>
      <div style="${rowGridStyle}">
        <div>
          <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propPositionPreset'))}</label>
          <select class="form-input" id="propAdditionalPreset" style="font-size: 11px; padding: 4px 6px;">${presets.map(([key,label])=>`<option value="${key}" ${(cfg.preset || 'auto')===key?'selected':''}>${label}</option>`).join('')}</select>
        </div>
        <div>
          <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propOffsetX'))}</label>
          <input class="form-input" id="propAdditionalOffsetX" type="number" step="any" value="${(cfg.offsetX || 0)/units}" style="font-size: 11px; padding: 4px 6px;">
        </div>
        <div>
          <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propOffsetY'))}</label>
          <input class="form-input" id="propAdditionalOffsetY" type="number" step="any" value="${(cfg.offsetY || 0)/units}" style="font-size: 11px; padding: 4px 6px;">
        </div>
        <div>
          <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propAlignment'))}</label>
          <select class="form-input" id="propAdditionalAlignment" style="font-size: 11px; padding: 4px 6px;">${[['middle',t('propAlignMiddle')],['start',t('propAlignStart')],['end',t('propAlignEnd')]].map(([key,label])=>`<option value="${key}" ${(cfg.alignment || 'middle')===key?'selected':''}>${label}</option>`).join('')}</select>
        </div>
        <div>
          <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propRotation'))}</label>
          <select class="form-input" id="propAdditionalRotation" style="font-size: 11px; padding: 4px 6px;">${[0,90,180,270].map(angle=>`<option value="${angle}" ${(cfg.rotation || 0)===angle?'selected':''}>${angle}°</option>`).join('')}</select>
        </div>
        <div>
          <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propFontSize'))}</label>
          <input type="number" min="0.1" max="20" step="0.1" id="propAdditionalFontSize" class="form-input" value="${fontVal}" style="font-size: 11px; padding: 4px 6px;">
        </div>
      </div>
    </div>`;
  }

  private pinLabelPositionFields(): string {
    const sym = getSymbolForComponent(this.component, this.project);
    const cfg = this.component.pinLabelPosition;
    const units = getDrawingUnitsPerMm(this.project);
    const visible = arePinLabelsVisible(this.component, sym);
    const baseSize = this.component.pinLabelFontSize
      ?? cfg?.fontSize
      ?? Object.values(this.component.pins).find(p => p.labelPosition)?.labelPosition?.fontSize
      ?? sym?.pins.find(p => p.labelPosition)?.labelPosition?.fontSize
      ?? 6.5;
    const fontVal = Number((Number(baseSize) / units).toFixed(4));
    const rowGridStyle = 'display: grid; grid-template-columns: 1.7fr 0.85fr 0.85fr 1.15fr 0.8fr 0.9fr; gap: 8px; align-items: end;';
    return `<div style="background: #1f242e; border: 1px solid #3e4656; border-radius: 6px; padding: 10px 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-weight: 600; font-size: 12px; color: #63b3ed;">${escapeSvg(t('propPinHeading'))}</span>
        <label style="font-size: 11px; display: flex; align-items: center; gap: 6px; cursor: pointer;">
          <input type="checkbox" id="propPinVisible" ${visible ? 'checked' : ''}>
          ${escapeSvg(t('propVisible'))}
        </label>
      </div>
      <div style="${rowGridStyle}">
        <div>
          <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propPositionPreset'))}</label>
          <select class="form-input" id="propPinPreset" style="font-size: 11px; padding: 4px 6px;">${[
            ['auto',t('propPresetAutoStandard')],['custom',t('propPresetCustomWithOffset')],['top',t('propPresetTop')],['top_left',t('propPresetTopLeft')],['top_right',t('propPresetTopRight')],
            ['bottom',t('propPresetBottom')],['bottom_left',t('propPresetBottomLeft')],['bottom_right',t('propPresetBottomRight')],['left',t('propPresetLeft')],['right',t('propPresetRight')]
          ].map(([value,label])=>`<option value="${value}" ${(cfg?.preset ?? 'auto')===value?'selected':''}>${label}</option>`).join('')}</select>
        </div>
        <div>
          <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propOffsetX'))}</label>
          <input type="number" step="any" class="form-input" id="propPinOffsetX" value="${(cfg?.offsetX ?? 0)/units}" style="font-size: 11px; padding: 4px 6px;">
        </div>
        <div>
          <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propOffsetY'))}</label>
          <input type="number" step="any" class="form-input" id="propPinOffsetY" value="${(cfg?.offsetY ?? 0)/units}" style="font-size: 11px; padding: 4px 6px;">
        </div>
        <div>
          <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propAlignment'))}</label>
          <select class="form-input" id="propPinAlignment" style="font-size: 11px; padding: 4px 6px;">${[
            ['',t('propAlignAuto')],['start',t('propAlignStart')],['middle',t('propAlignMiddle')],['end',t('propAlignEnd')]
          ].map(([value,label])=>`<option value="${value}" ${(cfg?.alignment ?? '')===value?'selected':''}>${label}</option>`).join('')}</select>
        </div>
        <div>
          <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propRotation'))}</label>
          <select class="form-input" id="propPinRotation" style="font-size: 11px; padding: 4px 6px;">${[0,90,180,270].map(value=>`<option value="${value}" ${(cfg?.rotation ?? 0)===value?'selected':''}>${value}°</option>`).join('')}</select>
        </div>
        <div>
          <label class="form-label" style="font-size: 10px;">${escapeSvg(t('propFontSize'))}</label>
          <input type="number" min="0.1" max="20" step="0.1" id="propPinFontSize" class="form-input" value="${fontVal}" style="font-size: 11px; padding: 4px 6px;">
        </div>
      </div>
    </div>`;
  }

  private generatePreviewSvg(): string {
    const sym = getSymbolForComponent(this.component, this.project);
    if (!sym) return `<span style="color:#a0aec0;">${escapeSvg(t('propNoSymbolFound'))}</span>`;

    const bmkPos = computeBmkPosition(this.component, sym);
    const fnPos = computeFunctionTextPosition(this.component, sym);
    const techPos = computeTechnicalDataPosition(this.component, sym);
    const additionalPos = computeAdditionalTextPosition(this.component, sym);
    const refPos = computeCrossReferencePosition(this.component, sym, this.project);

    const isConn = !sym.importedGraphics && sym.category === 'connections';

    const techText = this.component.deviceTag
      ? (this.component.deviceTag + (this.component.technicalCharacteristics ? ' · ' + this.component.technicalCharacteristics : ''))
      : (this.component.technicalCharacteristics || '');

    // Include moved reference anchors and the rotated symbol in the preview.
    const points = [{x:0,y:0},{x:sym.width,y:0},{x:0,y:sym.height},{x:sym.width,y:sym.height},
      ...[bmkPos,fnPos,techPos,additionalPos,refPos].filter(p=>p.visible)].map(p=>rotatedLocalPoint(p,sym,this.component.rotation));
    const vbX = Math.min(...points.map(p=>p.x))-70;
    const vbY = Math.min(...points.map(p=>p.y))-45;
    const vbW = Math.max(...points.map(p=>p.x))-vbX+70;
    const vbH = Math.max(...points.map(p=>p.y))-vbY+45;

    const bmkSvg = (!isConn && bmkPos.visible) ? `
      <text x="${bmkPos.x}" y="${bmkPos.y}" font-size="${bmkPos.fontSize}" font-weight="bold" font-family="monospace" fill="${escapeSvg(bmkPos.fontColor || '#f6e05e')}" text-anchor="${bmkPos.anchor}" ${bmkPos.transform}>${escapeSvg(this.component.bmk)}</text>
    ` : '';

    const fnSvg = (!isConn && fnPos.visible) ? `
      <text x="${fnPos.x}" y="${fnPos.y}" font-size="${fnPos.fontSize}" font-weight="${fnPos.fontWeight || 'normal'}" font-family="sans-serif" fill="${escapeSvg(fnPos.fontColor || '#e2e8f0')}" text-anchor="${fnPos.anchor}" ${fnPos.transform}>${escapeSvg(this.component.functionText || t('labelFunctionText'))}</text>
    ` : '';

    const techSvg = (!isConn && techPos.visible && (techText || this.activeTab === 'display')) ? `
      <text x="${techPos.x}" y="${techPos.y}" font-size="${techPos.fontSize}" font-family="sans-serif" fill="${escapeSvg(techPos.fontColor || '#68d391')}" text-anchor="${techPos.anchor}" ${techPos.transform}>${escapeSvg(techText || t('labelDeviceTag'))}</text>
    ` : '';

    const pinsSvg = sym.pins.map(pin => {
      const pinPos = computePinLabelPosition(this.component, sym, pin);
      const pinText = this.component.pins[pin.id]?.customLabel ?? pin.name;
      return `
        <circle cx="${pin.x}" cy="${pin.y}" r="3" fill="#2d3748" stroke="#63b3ed" stroke-width="1.2"/>
        ${pinPos.visible && pinText ? `<text class="source-pin-label" x="${pinPos.x}" y="${pinPos.y}" font-size="${pinPos.fontSize}" font-family="sans-serif" fill="#cbd5e0" text-anchor="${pinPos.anchor}" ${pinPos.transform}>${escapeSvg(pinText)}</text>` : ''}
      `;
    }).join('');

    return `
      <svg width="100%" height="160" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" style="max-height: 160px; overflow: visible;">
        <!-- Light grid background in preview -->
        <line x1="${vbX}" y1="${sym.height / 2}" x2="${vbX + vbW}" y2="${sym.height / 2}" stroke="#2a3240" stroke-width="0.8" stroke-dasharray="2,2"/>
        <line x1="${sym.width / 2}" y1="${vbY}" x2="${sym.width / 2}" y2="${vbY + vbH}" stroke="#2a3240" stroke-width="0.8" stroke-dasharray="2,2"/>

        <g transform="rotate(${this.component.rotation},${sym.width/2},${sym.height/2})">
        <!-- Symbol Graphics -->
        <g color="#e2e8f0">
          ${sym.svgContent}
        </g>
        
        <!-- Pins -->
        ${pinsSvg}

        <!-- Labels -->
        ${bmkSvg}
        ${fnSvg}
        ${techSvg}
        ${additionalPos.visible && this.component.additionalText ? `<text class="additional-text" x="${additionalPos.x}" y="${additionalPos.y}" font-size="${additionalPos.fontSize}" font-family="sans-serif" fill="${escapeSvg(additionalPos.fontColor || '#e2e8f0')}" text-anchor="${additionalPos.anchor}" ${additionalPos.transform}>${escapeSvg(this.component.additionalText)}</text>` : ''}
        ${this.component.crossRef && refPos.visible ? `<text class="cross-reference" x="${refPos.x}" y="${refPos.y}" text-anchor="${refPos.anchor}" font-size="${refPos.fontSize}" ${refPos.transform} fill="#f6ad55">${escapeSvg(this.component.crossRef)}</text>` : ''}
        </g>
      </svg>
    `;
  }

  private updatePreviewSvg(): void {
    const wrapper = document.getElementById('previewSvgWrapper');
    if (wrapper) {
      wrapper.innerHTML = this.generatePreviewSvg();
    }
  }

  private getRelatedComponentsHtml(): string {
    const related: string[] = [];
    for (const p of this.project.pages) {
      for (const c of p.components) {
        if (c.bmk === this.component.bmk && c.id !== this.component.id) {
          const sym = getSymbolForComponent(c);
          const symName = sym ? getLocalizedSymbol(sym).name : t('symbol');
          related.push(`
            <li style="margin-bottom: 4px;">
              <strong>${escapeSvg(t('sheet'))} ${p.pageNumber}:</strong> ${escapeSvg(symName)} (${escapeSvg(c.functionText || t('propNoFunctionText'))})
              <span style="font-family: monospace; color: #f6e05e; margin-left: 6px;">[X: ${c.x}, Y: ${c.y}]</span>
            </li>
          `);
        }
      }
    }
    if (related.length === 0) {
      return `<li style="color: #a0aec0;">${escapeSvg(t('propCrossRefNoneInProject'))}</li>`;
    }
    return related.join('');
  }

  private bindEvents(modal: HTMLElement): void {
    const closeModal = () => modal.remove();

    // Close buttons
    modal.querySelector('#btnClosePropModal')?.addEventListener('click', closeModal);
    modal.querySelector('#btnCancelProp')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      const link = (e.target as Element)?.closest?.('[data-crossref-source]');
      if (link && this.callbacks.onNavigateToReference) {
        closeModal();
        this.callbacks.onNavigateToReference(Number(link.getAttribute('data-crossref-index') ?? 0));
        return;
      }
      if (e.target === modal) closeModal();
    });

    // Tab buttons
    modal.querySelectorAll('.ecad-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if(this.collectFormData(modal)===false)return;
        const target = e.currentTarget as HTMLElement;
        this.activeTab = target.dataset.tab as any;
        modal.querySelectorAll('.ecad-tab-btn').forEach(b => b.classList.remove('active'));
        target.classList.add('active');

        const content = modal.querySelector('#propTabContent');
        if (content) {
          content.innerHTML = this.renderActiveTabContent();
          this.bindTabInternalEvents(modal);
        }
      });
    });

    // Modal keyboard shortcuts (Enter = OK, Escape = Cancel)
    modal.addEventListener('keydown', (e) => {
      const link = (e.target as Element)?.closest?.('[data-crossref-source]');
      if (e.key === 'Enter' && link && this.callbacks.onNavigateToReference) {
        e.preventDefault(); closeModal();
        this.callbacks.onNavigateToReference(Number(link.getAttribute('data-crossref-index') ?? 0));
        return;
      }
      if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        if(this.collectFormData(modal)===false)return;
        this.callbacks.onSave(structuredClone(this.component));
        closeModal();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      }
    });

    // Apply & Save
    modal.querySelector('#btnApplyProp')?.addEventListener('click', () => {
      if(this.collectFormData(modal)===false)return;
      this.callbacks.onSave(structuredClone(this.component));
      const applyBtn = modal.querySelector('#btnApplyProp') as HTMLElement;
      if (applyBtn) {
        const origText = applyBtn.textContent || t('propBtnApply');
        applyBtn.textContent = t('propAppliedBadge');
        setTimeout(() => {
          applyBtn.textContent = origText;
        }, 1200);
      }
    });

    modal.querySelector('#btnSaveProp')?.addEventListener('click', () => {
      if(this.collectFormData(modal)===false)return;
      this.callbacks.onSave(structuredClone(this.component));
      closeModal();
    });

    this.bindTabInternalEvents(modal);
  }

  private bindTabInternalEvents(modal: HTMLElement): void {
    // Article quick select
    const quickPart = modal.querySelector('#quickPartSelect') as HTMLSelectElement;
    quickPart?.addEventListener('change', () => {
      const partId = quickPart.value;
      const part = MANUFACTURER_PARTS.find(p => p.id === partId);
      if (part) {
        const mfrInput = modal.querySelector('#propManufacturer') as HTMLInputElement;
        const artInput = modal.querySelector('#propArticleNumber') as HTMLInputElement;
        const descInput = modal.querySelector('#propPartDesc') as HTMLInputElement;
        if (mfrInput) mfrInput.value = part.manufacturer;
        if (artInput) artInput.value = part.articleNumber;
        if (descInput) descInput.value = `${part.name} - ${part.technicalData}`;

        this.component.manufacturer = part.manufacturer;
        this.component.articleNumber = part.articleNumber;
        setComponentLabelText(this.component, 'technicalCharacteristics', part.technicalData);
        setComponentLabelText(this.component, 'deviceTag', part.name);
      }
    });

    // Live update on display tab controls
    if (this.activeTab === 'display') {
      const liveInputs = modal.querySelectorAll('input, select, textarea');
      liveInputs.forEach(input => {
        const refresh = () => {
          if (input.id.endsWith('Preset') && (input as HTMLSelectElement).value === 'auto') {
            const alignment = modal.querySelector(`#${input.id.replace('Preset', 'Alignment')}`) as HTMLSelectElement | null;
            if (alignment) alignment.value = (input.id === 'propCrossRefPreset' || input.id === 'propPinPreset') ? '' : 'end';
          }
          if(this.collectFormData(modal)===false)return;
          this.updatePreviewSvg();
        };
        input.addEventListener('input', refresh);
        input.addEventListener('change', refresh);
      });

      // Reset positions button
      modal.querySelector('#btnResetPositions')?.addEventListener('click', () => {
        delete this.component.bmkPosition;
        delete this.component.functionTextPosition;
        delete this.component.additionalTextPosition;
        delete this.component.technicalDataPosition;
        delete this.component.crossRefPosition;
        delete this.component.pinLabelPosition;
        const content = modal.querySelector('#propTabContent');
        if (content) {
          content.innerHTML = this.renderActiveTabContent();
          this.bindTabInternalEvents(modal);
        }
      });
    }
  }

  private collectFormData(modal: HTMLElement): boolean | void {
    const sym = getSymbolForComponent(this.component, this.project);
    const isInterruption = sym && isInterruptionSymbol(sym);

    // Symbol tab fields
    const bmk = modal.querySelector('#propBmk') as HTMLInputElement;
    if (bmk) {
      this.component.bmk = bmk.value.trim();
      if (isInterruption) this.component.functionText = this.component.bmk;
    }

    const deviceTag = modal.querySelector('#propDeviceTag') as HTMLInputElement;
    if (deviceTag) setComponentLabelText(this.component, 'deviceTag', deviceTag.value.trim());

    const fnText = modal.querySelector('#propFunctionText') as HTMLInputElement;
    if (fnText) {
      setComponentLabelText(this.component, 'functionText', fnText.value.trim());
      if (isInterruption && (!bmk || !bmk.value.trim())) this.component.bmk = this.component.functionText;
    }

    const additionalText = modal.querySelector('#propAdditionalText') as HTMLInputElement;
    if (additionalText) setComponentLabelText(this.component, 'additionalText', additionalText.value.trim());

    const techChar = modal.querySelector('#propTechChar') as HTMLInputElement;
    if (techChar) setComponentLabelText(this.component, 'technicalCharacteristics', techChar.value.trim());

    const higherLevel = modal.querySelector('#propHigherLevel') as HTMLInputElement;
    if (higherLevel) this.component.higherLevelFunction = higherLevel.value.trim();

    const loc = modal.querySelector('#propLocation') as HTMLInputElement;
    if (loc) this.component.mountingLocation = loc.value.trim();

    // Part tab fields
    const mfr = modal.querySelector('#propManufacturer') as HTMLInputElement;
    if (mfr) this.component.manufacturer = mfr.value.trim();

    const art = modal.querySelector('#propArticleNumber') as HTMLInputElement;
    if (art) this.component.articleNumber = art.value.trim();

    // Format / Layout tab fields
    const rot = modal.querySelector('#propRotation') as HTMLSelectElement;
    const symbol = getSymbolForComponent(this.component, this.project);
    const insertion = symbol ? componentInsertionPoint(this.component, symbol) : { x: this.component.x, y: this.component.y };
    if (rot) this.component.rotation = parseInt(rot.value, 10) as any;

    const posX = modal.querySelector('#propPosX') as HTMLInputElement;
    if (posX && Number.isFinite(parseFloat(posX.value))) {
      insertion.x = parseFloat(posX.value);
    }

    const posY = modal.querySelector('#propPosY') as HTMLInputElement;
    if (posY && Number.isFinite(parseFloat(posY.value))) {
      insertion.y = parseFloat(posY.value);
    }
    if (rot || posX || posY) Object.assign(this.component,
      symbol ? positionAtInsertionPoint(insertion, symbol, this.component.rotation) : insertion);

    // Pin labels
    modal.querySelectorAll('.prop-pin-label').forEach(input => {
      const pinId = (input as HTMLElement).dataset.pinId!;
      const val = (input as HTMLInputElement).value.trim();
      if (!this.component.pins[pinId]) {
        this.component.pins[pinId] = {};
      }
      this.component.pins[pinId].customLabel = val;
    });

    const units = getDrawingUnitsPerMm(this.project);
    for (const [key, property] of [['Bmk','bmkPosition'],['Fn','functionTextPosition'],['Additional','additionalTextPosition'],['Tech','technicalDataPosition']] as const) {
      const input = modal.querySelector(`#prop${key}FontSize`) as HTMLInputElement | null;
      if (input && input.value !== '' && input.validity.valid && Number(input.value)>0)
        this.component[property] = { ...this.component[property], fontSize: Number(input.value)*units };
    }
    for (const [key, property] of [['CrossRef','crossRefFontSize'],['Pin','pinLabelFontSize']] as const) {
      const input = modal.querySelector(`#prop${key}FontSize`) as HTMLInputElement | null;
      if (input && input.value !== '' && input.validity.valid && Number(input.value)>0) this.component[property] = Number(input.value)*units;
    }

    // Display / Label positioning tab fields
    const refPreset = modal.querySelector('#propCrossRefPreset') as HTMLSelectElement | null;
    if (refPreset) {
      const value = (id: string) => (modal.querySelector(`#propCrossRef${id}`) as HTMLInputElement | HTMLSelectElement | null)?.value;
      const number = (id: string, fallback = 0) => { const n = Number(value(id)); return Number.isFinite(n) ? n : fallback; };
      this.component.crossRefPosition = {
        ...this.component.crossRefPosition,
        preset: refPreset.value as TextFormatConfig['preset'],
        offsetX: number('OffsetX', (this.component.crossRefPosition?.offsetX ?? 0)/units)*units,
        offsetY: number('OffsetY', (this.component.crossRefPosition?.offsetY ?? 0)/units)*units,
        alignment: (value('Alignment') || undefined) as TextFormatConfig['alignment'],
        rotation: number('Rotation') as TextFormatConfig['rotation'],
        visible: (modal.querySelector('#propCrossRefVisible') as HTMLInputElement | null)?.checked !== false,
      };
    }
    for (const [prefix, property] of [['Bmk','bmkPosition'],['Fn','functionTextPosition'],['Additional','additionalTextPosition'],['Tech','technicalDataPosition']] as const) {
      const input = modal.querySelector(`#prop${prefix}Visible`) as HTMLInputElement | null;
      const currentVisible = property === 'technicalDataPosition' && this.component[property]?.visible === undefined
        ? !!(this.component.deviceTag || this.component.technicalCharacteristics) : this.component[property]?.visible !== false;
      if (input && input.checked !== currentVisible)
        this.component[property] = { ...this.component[property], visible: input.checked, visibilityExplicit: true };
    }
    const additionalPreset = modal.querySelector('#propAdditionalPreset') as HTMLSelectElement | null;
    if (additionalPreset) {
      const value = (key:string) => (modal.querySelector(`#propAdditional${key}`) as HTMLInputElement | HTMLSelectElement | null)?.value;
      const number = (key:string) => { const n = Number(value(key)); return Number.isFinite(n) ? n : 0; };
      this.component.additionalTextPosition = { ...this.component.additionalTextPosition,
        preset: additionalPreset.value as TextFormatConfig['preset'], offsetX:number('OffsetX')*units,offsetY:number('OffsetY')*units,
        alignment:(value('Alignment') || 'middle') as TextFormatConfig['alignment'],rotation:number('Rotation') as TextFormatConfig['rotation'],
        visible:(modal.querySelector('#propAdditionalVisible') as HTMLInputElement | null)?.checked !== false };
    }
    const bmkPreset = modal.querySelector('#propBmkPreset') as HTMLSelectElement;
    if (bmkPreset) {
      const bmkOffsetX = modal.querySelector('#propBmkOffsetX') as HTMLInputElement;
      const bmkOffsetY = modal.querySelector('#propBmkOffsetY') as HTMLInputElement;
      const bmkAlign = modal.querySelector('#propBmkAlignment') as HTMLSelectElement;
      const bmkRot = modal.querySelector('#propBmkRotation') as HTMLSelectElement;
      const bmkVis = modal.querySelector('#propBmkVisible') as HTMLInputElement;

      this.component.bmkPosition = {
        ...this.component.bmkPosition,
        preset: bmkPreset.value as any,
        offsetX: parseFloat(bmkOffsetX?.value || '0') || 0,
        offsetY: parseFloat(bmkOffsetY?.value || '0') || 0,
        alignment: bmkAlign?.value as any || 'middle',
        rotation: parseInt(bmkRot?.value || '0', 10) as any || 0,
        visible: bmkVis ? bmkVis.checked : true,
      };
    }

    const fnPreset = modal.querySelector('#propFnPreset') as HTMLSelectElement;
    if (fnPreset) {
      const fnOffsetX = modal.querySelector('#propFnOffsetX') as HTMLInputElement;
      const fnOffsetY = modal.querySelector('#propFnOffsetY') as HTMLInputElement;
      const fnAlign = modal.querySelector('#propFnAlignment') as HTMLSelectElement;
      const fnRot = modal.querySelector('#propFnRotation') as HTMLSelectElement;
      const fnVis = modal.querySelector('#propFnVisible') as HTMLInputElement;

      this.component.functionTextPosition = {
        ...this.component.functionTextPosition,
        preset: fnPreset.value as any,
        offsetX: parseFloat(fnOffsetX?.value || '0') || 0,
        offsetY: parseFloat(fnOffsetY?.value || '0') || 0,
        alignment: fnAlign?.value as any || 'middle',
        rotation: parseInt(fnRot?.value || '0', 10) as any || 0,
        visible: fnVis ? fnVis.checked : true,
      };
    }

    const techPreset = modal.querySelector('#propTechPreset') as HTMLSelectElement;
    if (techPreset) {
      const techOffsetX = modal.querySelector('#propTechOffsetX') as HTMLInputElement;
      const techOffsetY = modal.querySelector('#propTechOffsetY') as HTMLInputElement;
      const techAlign = modal.querySelector('#propTechAlignment') as HTMLSelectElement;
      const techRot = modal.querySelector('#propTechRotation') as HTMLSelectElement;
      const techVis = modal.querySelector('#propTechVisible') as HTMLInputElement;

      this.component.technicalDataPosition = {
        ...this.component.technicalDataPosition,
        preset: techPreset.value as any,
        offsetX: parseFloat(techOffsetX?.value || '0') || 0,
        offsetY: parseFloat(techOffsetY?.value || '0') || 0,
        alignment: techAlign?.value as any || 'middle',
        rotation: parseInt(techRot?.value || '0', 10) as any || 0,
        visible: techVis ? techVis.checked : false,
      };
    }

    const pinPreset = modal.querySelector('#propPinPreset') as HTMLSelectElement | null;
    const pinVis = modal.querySelector('#propPinVisible') as HTMLInputElement | null;
    if (pinPreset || pinVis) {
      const value = (id: string) => (modal.querySelector(`#propPin${id}`) as HTMLInputElement | HTMLSelectElement | null)?.value;
      const number = (id: string, fallback = 0) => { const n = Number(value(id)); return Number.isFinite(n) ? n : fallback; };
      const currentVisible = arePinLabelsVisible(this.component, sym);
      const nextVisible = pinVis ? pinVis.checked : currentVisible;
      const visExplicit = (pinVis && pinVis.checked !== currentVisible) || !!this.component.pinLabelPosition?.visibilityExplicit;
      const preset = (pinPreset?.value ?? this.component.pinLabelPosition?.preset ?? 'auto') as TextFormatConfig['preset'];
      const offsetX = pinPreset ? number('OffsetX', (this.component.pinLabelPosition?.offsetX ?? 0) / units) * units : (this.component.pinLabelPosition?.offsetX ?? 0);
      const offsetY = pinPreset ? number('OffsetY', (this.component.pinLabelPosition?.offsetY ?? 0) / units) * units : (this.component.pinLabelPosition?.offsetY ?? 0);
      const alignment = (pinPreset ? (value('Alignment') || undefined) : this.component.pinLabelPosition?.alignment) as TextFormatConfig['alignment'];
      const rotation = (pinPreset ? number('Rotation') : (this.component.pinLabelPosition?.rotation ?? 0)) as TextFormatConfig['rotation'];
      if (visExplicit || preset !== 'auto' || offsetX !== 0 || offsetY !== 0 || alignment || rotation || this.component.pinLabelPosition) {
        this.component.pinLabelPosition = {
          ...this.component.pinLabelPosition,
          preset,
          offsetX,
          offsetY,
          alignment,
          rotation,
          visible: nextVisible,
          ...(visExplicit ? { visibilityExplicit: true } : {})
        };
      }
    }
  }
}
