import { deviceBoxFields, collectDeviceBoxFields } from './DeviceBoxFields';
// src/ui/PropertiesDialog.ts
// Component properties modal ("Eigenschaften (Schaltzeichen)")

import { referenceMarkup } from '../model/CrossReferenceNavigation';
import { Page, PlacedComponent, Project, TextFormatConfig } from '../model/types';
import { escapeSvg } from '../model/ImportedDrawing';
import { getSymbolForComponent, getDrawingUnitsPerMm } from '../model/symbols';
import { MANUFACTURER_PARTS } from '../model/PartCatalogue';
import { computeBmkPosition, computeFunctionTextPosition, computeAdditionalTextPosition, computeTechnicalDataPosition, computeCrossReferencePosition, computePinLabelPosition, arePinLabelsVisible, setComponentLabelText } from '../model/LabelLayout';
import { componentInsertionPoint, positionAtInsertionPoint, rotatedLocalPoint } from '../model/SymbolGeometry';
import { isInterruptionSymbol } from '../model/ConnectionSymbols';
import { resizeDeviceBox } from '../model/DeviceBoxElement';
import { t, getLocalizedSymbol } from '../i18n';
import { ElementSelection, selectionCount } from '../model/ElementSelection';
import { SharedProperty, SelectionPatch, sharedPropertyValue, applySelectionProperties, propertyExistsOnAllSelected } from '../model/SelectionProperties';

export interface PropertiesDialogCallbacks {
  onSave: (updated: PlacedComponent) => void;
  onSaveMultiple?: (updatedList: PlacedComponent[]) => void;
  components?: PlacedComponent[];
  onNavigateToPage?: (pageId: string) => void;
  onNavigateToReference?: (index: number) => void;
}

export class PropertiesDialog {
  public component: PlacedComponent;
  public components: PlacedComponent[];
  public isMulti: boolean;
  private project: Project;
  private callbacks: PropertiesDialogCallbacks;
  private activeTab: 'symbol' | 'display' | 'part' | 'crossref' | 'format' = 'symbol';
  private dirtyFields = new Set<string>();
  private differingFields = new Set<string>();
  private resetPositionsTriggered = false;

  constructor(componentOrComponents: PlacedComponent | PlacedComponent[], project: Project, callbacks: PropertiesDialogCallbacks) {
    if (Array.isArray(componentOrComponents) && componentOrComponents.length > 0) {
      this.components = JSON.parse(JSON.stringify(componentOrComponents));
      this.isMulti = this.components.length > 1;
    } else if (callbacks.components && callbacks.components.length > 1) {
      this.components = JSON.parse(JSON.stringify(callbacks.components));
      this.isMulti = true;
    } else {
      const single = Array.isArray(componentOrComponents) ? componentOrComponents[0] : componentOrComponents;
      this.components = [JSON.parse(JSON.stringify(single))];
      this.isMulti = false;
    }

    this.project = project;
    this.callbacks = callbacks;
    this.component = JSON.parse(JSON.stringify(this.components[0]));

    if (this.isMulti) {
      this.initMultiComponentState();
    }
  }

  private initMultiComponentState(): void {
    const fieldsToCheck: (keyof PlacedComponent)[] = [
      'bmk', 'deviceTag', 'functionText', 'additionalText', 'technicalCharacteristics',
      'higherLevelFunction', 'mountingLocation', 'manufacturer', 'articleNumber',
      'rotation', 'x', 'y'
    ];

    for (const field of fieldsToCheck) {
      const firstVal = this.components[0][field];
      const allSame = this.components.every(c => c[field] === firstVal);
      if (!allSame) {
        this.differingFields.add(field as string);
        if (field === 'x' || field === 'y') {
          (this.component as any)[field] = NaN;
        } else if (field === 'rotation') {
          // keep component rotation as 0 fallback
        } else {
          (this.component as any)[field] = '';
        }
      }
    }

    // Check deviceBox: only retain deviceBox on this.component if ALL components have deviceBox
    const allHaveBox = this.components.every(c => !!c.deviceBox);
    if (!allHaveBox) {
      delete this.component.deviceBox;
    } else {
      for (const boxField of ['lineWidth', 'lineStyle', 'width', 'height', 'color'] as const) {
        const firstVal = this.components[0].deviceBox?.[boxField];
        if (!this.components.every(c => c.deviceBox?.[boxField] === firstVal)) {
          this.differingFields.add('box' + boxField);
        }
      }
    }
  }

  public show(): void {
    const existing = document.getElementById('propertiesModal');
    if (existing) existing.remove();

    const sym = getSymbolForComponent(this.component, this.project);
    const symName = sym ? getLocalizedSymbol(sym).name : t('symbol');
    const titleText = this.isMulti
      ? `Gemeinsame Eigenschaften (${this.components.length} Betriebsmittel ausgewählt)`
      : t('propDialogTitle', { bmk: this.component.bmk, name: symName });

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
            <span>${escapeSvg(titleText)}</span>
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

  private getCommonPins(): { id: string; name: string }[] {
    if (!this.isMulti) {
      const sym = getSymbolForComponent(this.component, this.project);
      return sym ? sym.pins.map(p => ({ id: p.id, name: p.name })) : [];
    }
    const pinCounts = new Map<string, { count: number; name: string }>();
    for (const c of this.components) {
      const s = getSymbolForComponent(c, this.project);
      if (!s) continue;
      const seen = new Set<string>();
      for (const p of s.pins) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          const entry = pinCounts.get(p.id) ?? { count: 0, name: p.name };
          entry.count++;
          pinCounts.set(p.id, entry);
        }
      }
    }
    const result: { id: string; name: string }[] = [];
    for (const [id, entry] of pinCounts.entries()) {
      if (entry.count === this.components.length) {
        result.push({ id, name: entry.name });
      }
    }
    return result;
  }

  private renderActiveTabContent(): string {
    const sym = getSymbolForComponent(this.component, this.project);

    const fieldMeta = (field: keyof PlacedComponent, inputId: string, val: string, defaultPlaceholder: string) => {
      if (this.isMulti && this.differingFields.has(field as string) && !this.dirtyFields.has(inputId)) {
        return { value: '', placeholder: t('sharedDifferentValues') };
      }
      return { value: val, placeholder: defaultPlaceholder };
    };

    if (this.activeTab === 'symbol') {
      const bmkMeta = fieldMeta('bmk', 'propBmk', this.component.bmk, '-K1');
      const tagMeta = fieldMeta('deviceTag', 'propDeviceTag', this.component.deviceTag || '', t('propDeviceTagPlaceholder'));
      const fnMeta = fieldMeta('functionText', 'propFunctionText', this.component.functionText || '', t('propFunctionPlaceholder'));
      const addMeta = fieldMeta('additionalText', 'propAdditionalText', this.component.additionalText || '', t('propAdditionalPlaceholder'));
      const hlMeta = fieldMeta('higherLevelFunction', 'propHigherLevel', this.component.higherLevelFunction ?? '=A1', '=A1');
      const locMeta = fieldMeta('mountingLocation', 'propLocation', this.component.mountingLocation ?? '+S1', '+S1');
      const techMeta = fieldMeta('technicalCharacteristics', 'propTechChar', this.component.technicalCharacteristics || '', t('propTechnicalPlaceholder'));

      const commonPins = this.getCommonPins();

      return `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label class="form-label">${escapeSvg(t('propVisibleBmk'))}</label>
              <input type="text" id="propBmk" class="form-input" value="${escapeSvg(bmkMeta.value)}" placeholder="${escapeSvg(bmkMeta.placeholder)}">
            </div>
            <div>
              <label class="form-label">${escapeSvg(t('propFullBmkPreview'))}</label>
              <input type="text" class="form-input" disabled value="${this.isMulti ? '—' : escapeSvg(this.component.higherLevelFunction ?? '=A1') + escapeSvg(this.component.mountingLocation ?? '+S1') + escapeSvg(this.component.bmk)}" style="background: #181b22; color: #a0aec0;">
            </div>
          </div>

          <div>
            <label class="form-label">${escapeSvg(t('propDeviceTag'))}</label>
            <input type="text" id="propDeviceTag" class="form-input" value="${escapeSvg(tagMeta.value)}" placeholder="${escapeSvg(tagMeta.placeholder)}">
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label class="form-label">${escapeSvg(t('propFunctionText'))}</label>
              <textarea id="propFunctionText" class="form-input" rows="2" placeholder="${escapeSvg(fnMeta.placeholder)}">${escapeSvg(fnMeta.value)}</textarea>
            </div>
            <div>
              <label class="form-label">${escapeSvg(t('propAdditionalText'))}</label>
              <textarea id="propAdditionalText" class="form-input" rows="2" placeholder="${escapeSvg(addMeta.placeholder)}">${escapeSvg(addMeta.value)}</textarea>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label class="form-label">${escapeSvg(t('propPlant'))}</label>
              <input type="text" id="propHigherLevel" class="form-input" value="${escapeSvg(hlMeta.value)}" placeholder="${escapeSvg(hlMeta.placeholder)}">
            </div>
            <div>
              <label class="form-label">${escapeSvg(t('propLocation'))}</label>
              <input type="text" id="propLocation" class="form-input" value="${escapeSvg(locMeta.value)}" placeholder="${escapeSvg(locMeta.placeholder)}">
            </div>
          </div>

          <div>
            <label class="form-label">${escapeSvg(t('propTechnicalData'))}</label>
            <textarea id="propTechChar" class="form-input" rows="2" placeholder="${escapeSvg(techMeta.placeholder)}">${escapeSvg(techMeta.value)}</textarea>
          </div>

          <div>
            <label class="form-label">${escapeSvg(t('propPinLabel'))}</label>
            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px;">
              ${commonPins.length > 0 ? commonPins.map(p => {
                let pinVal = this.component.pins[p.id]?.customLabel ?? p.name;
                let placeholder = '';
                if (this.isMulti && !this.dirtyFields.has('pin:' + p.id)) {
                  const firstPinVal = this.components[0].pins[p.id]?.customLabel ?? p.name;
                  const allPinsSame = this.components.every(c => (c.pins[p.id]?.customLabel ?? p.name) === firstPinVal);
                  if (!allPinsSame) {
                    pinVal = '';
                    placeholder = t('sharedDifferentValues');
                  }
                }
                return `
                  <div style="display: flex; align-items: center; gap: 4px; background: #1a202c; border: 1px solid #3e4656; padding: 4px 8px; border-radius: 4px; font-size: 11px;">
                    <span style="color: #63b3ed; font-family: monospace;">${escapeSvg(t('propPinPrefix'))} ${p.id}:</span>
                    <input type="text" class="prop-pin-label" data-pin-id="${p.id}" value="${escapeSvg(pinVal)}" placeholder="${escapeSvg(placeholder)}" style="width: ${placeholder ? '65px' : '45px'}; background: #2d3748; border: 1px solid #4a5568; color: white; padding: 2px 4px; border-radius: 2px; font-size: 11px; text-align: center;">
                  </div>
                `;
              }).join('') : `<span style="font-size: 11px; color: #a0aec0;">${this.isMulti ? 'Keine gemeinsamen Anschlüsse auf allen Elementen' : escapeSvg(t('propPinsNone'))}</span>`}
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
      const mfrMeta = fieldMeta('manufacturer', 'propManufacturer', this.component.manufacturer || '', 'z.B. Siemens / Hager / Finder');
      const artMeta = fieldMeta('articleNumber', 'propArticleNumber', this.component.articleNumber || '', 'z.B. 3RT2016-1BB41');
      const partDescMeta = fieldMeta('technicalCharacteristics', 'propPartDesc', this.component.technicalCharacteristics || '', t('propPartDescPlaceholder'));

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
              <input type="text" id="propManufacturer" class="form-input" value="${escapeSvg(mfrMeta.value)}" placeholder="${escapeSvg(mfrMeta.placeholder)}">
            </div>
            <div>
              <label class="form-label">${escapeSvg(t('propOrderNumber'))}</label>
              <input type="text" id="propArticleNumber" class="form-input" value="${escapeSvg(artMeta.value)}" placeholder="${escapeSvg(artMeta.placeholder)}">
            </div>
          </div>

          <div>
            <label class="form-label">${escapeSvg(t('propPartShortDesc'))}</label>
            <input type="text" id="propPartDesc" class="form-input" value="${escapeSvg(partDescMeta.value)}" placeholder="${escapeSvg(partDescMeta.placeholder)}">
          </div>
        </div>
      `;
    }

    if (this.activeTab === 'crossref') {
      const crossRefText = this.isMulti
        ? `Gemeinsame Querverweise für ${this.components.length} Betriebsmittel`
        : (referenceMarkup(this.project, this.component) || t('propCrossRefNone'));
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
      const isXDiff = this.isMulti && this.differingFields.has('x') && !this.dirtyFields.has('propPosX');
      const isYDiff = this.isMulti && this.differingFields.has('y') && !this.dirtyFields.has('propPosY');
      const isRotDiff = this.isMulti && this.differingFields.has('rotation') && !this.dirtyFields.has('propRotation');

      const activePage = this.project.pages.find(p => p.id === this.project.activePageId);
      const isFloorPlan = !!activePage?.floorPlan;

      return `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${this.component.deviceBox ? deviceBoxFields(this.component, getDrawingUnitsPerMm(this.project)) : ''}
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label class="form-label">${escapeSvg(t('propPosX'))}</label>
              <input type="number" step="any" id="propPosX" class="form-input" value="${isXDiff ? '' : insertion.x}" placeholder="${isXDiff ? escapeSvg(t('sharedDifferentValues')) : ''}">
            </div>
            <div>
              <label class="form-label">${escapeSvg(t('propPosY'))}</label>
              <input type="number" step="any" id="propPosY" class="form-input" value="${isYDiff ? '' : insertion.y}" placeholder="${isYDiff ? escapeSvg(t('sharedDifferentValues')) : ''}">
            </div>
          </div>

          <div>
            <label class="form-label">${escapeSvg(t('propRotationAngle'))}</label>
            <select id="propRotation" class="form-input">
              ${isRotDiff ? `<option value="" selected disabled>— (${escapeSvg(t('sharedDifferentValues'))}) —</option>` : ''}
              <option value="0" ${!isRotDiff && this.component.rotation === 0 ? 'selected' : ''}>${escapeSvg(t('propRot0'))}</option>
              <option value="90" ${!isRotDiff && this.component.rotation === 90 ? 'selected' : ''}>${escapeSvg(t('propRot90'))}</option>
              <option value="180" ${!isRotDiff && this.component.rotation === 180 ? 'selected' : ''}>${escapeSvg(t('propRot180'))}</option>
              <option value="270" ${!isRotDiff && this.component.rotation === 270 ? 'selected' : ''}>${escapeSvg(t('propRot270'))}</option>
            </select>
          </div>

          ${isFloorPlan ? `
            <div style="background:#1a202c;border:1px solid #4a5568;border-radius:4px;padding:10px;margin-top:6px;">
              <div style="font-size:11px;font-weight:bold;color:#63b3ed;text-transform:uppercase;margin-bottom:8px;">${escapeSvg(t('fpCompDisplayHeading'))}</div>
              <label style="display:flex;align-items:center;gap:8px;font-size:11px;cursor:pointer;margin-bottom:8px;color:#cbd5e0;">
                <input type="checkbox" id="propCompShowLabel" ${this.component.showLabels ? 'checked' : ''} style="accent-color:#3182ce;" />
                <span>${escapeSvg(t('fpCompShowBmkLabel'))}</span>
              </label>
              <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;">
                <span style="font-size:11px;color:#a0aec0;">${escapeSvg(t('fpCompScaleLabel'))}</span>
                <select id="propCompScale" class="form-input" style="font-size:11px;padding:3px 6px;width:140px;">
                  <option value="inherit" ${!this.component.scale ? 'selected' : ''}>${escapeSvg(t('fpCompScaleInherit'))}</option>
                  <option value="0.35" ${this.component.scale === 0.35 ? 'selected' : ''}>${escapeSvg(t('fpCompScale35'))}</option>
                  <option value="0.45" ${this.component.scale === 0.45 ? 'selected' : ''}>${escapeSvg(t('fpCompScale45'))}</option>
                  <option value="0.6" ${this.component.scale === 0.6 ? 'selected' : ''}>${escapeSvg(t('fpCompScale60'))}</option>
                  <option value="0.75" ${this.component.scale === 0.75 ? 'selected' : ''}>${escapeSvg(t('fpCompScale75'))}</option>
                  <option value="1.0" ${this.component.scale === 1.0 ? 'selected' : ''}>${escapeSvg(t('fpCompScale100'))}</option>
                </select>
              </div>
            </div>
          ` : ''}
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
        ${this.component.crossRef && refPos.visible ? `<text class="cross-reference" x="${refPos.x}" y="${refPos.y}" text-anchor="${refPos.anchor}" font-size="${refPos.fontSize}" ${refPos.transform} fill="#f6ad55">${referenceMarkup(this.project, this.component, true, refPos)}</text>` : ''}
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

    // Track user edits across all inputs in modal
    const markDirty = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target?.id) this.dirtyFields.add(target.id);
      if (target?.dataset?.pinId) this.dirtyFields.add('pin:' + target.dataset.pinId);
      if (target?.dataset?.sharedProperty) this.dirtyFields.add(target.dataset.sharedProperty);
    };
    modal.addEventListener('input', markDirty);
    modal.addEventListener('change', markDirty);

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
        if (this.saveChanges(modal) === false) return;
        closeModal();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      }
    });

    // Apply & Save
    modal.querySelector('#btnApplyProp')?.addEventListener('click', () => {
      if (this.saveChanges(modal) === false) return;
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
      if (this.saveChanges(modal) === false) return;
      closeModal();
    });

    this.bindTabInternalEvents(modal);
  }

  private saveChanges(modal: HTMLElement): boolean | void {
    if (this.collectFormData(modal) === false) return false;
    if (!this.isMulti) {
      this.callbacks.onSave(structuredClone(this.component));
      return true;
    }

    // Apply dirty fields across all components
    const units = getDrawingUnitsPerMm(this.project);
    for (const c of this.components) {
      const sym = getSymbolForComponent(c, this.project);
      const isInterruption = sym && isInterruptionSymbol(sym);

      if (this.dirtyFields.has('propBmk')) {
        c.bmk = this.component.bmk;
        if (isInterruption) c.functionText = c.bmk;
      }
      if (this.dirtyFields.has('propDeviceTag')) {
        setComponentLabelText(c, 'deviceTag', this.component.deviceTag || '');
      }
      if (this.dirtyFields.has('propFunctionText')) {
        setComponentLabelText(c, 'functionText', this.component.functionText || '');
        if (isInterruption && (!c.bmk || !c.bmk.trim())) c.bmk = c.functionText;
      }
      if (this.dirtyFields.has('propAdditionalText')) {
        setComponentLabelText(c, 'additionalText', this.component.additionalText || '');
      }
      if (this.dirtyFields.has('propTechChar') || this.dirtyFields.has('propPartDesc')) {
        setComponentLabelText(c, 'technicalCharacteristics', this.component.technicalCharacteristics || '');
      }
      if (this.dirtyFields.has('propHigherLevel')) {
        c.higherLevelFunction = this.component.higherLevelFunction;
      }
      if (this.dirtyFields.has('propLocation')) {
        c.mountingLocation = this.component.mountingLocation;
      }
      if (this.dirtyFields.has('propManufacturer')) {
        c.manufacturer = this.component.manufacturer;
      }
      if (this.dirtyFields.has('propArticleNumber')) {
        c.articleNumber = this.component.articleNumber;
      }
      if (this.dirtyFields.has('propRotation')) {
        c.rotation = this.component.rotation;
      }
      if (this.dirtyFields.has('propPosX')) {
        c.x = this.component.x;
      }
      if (this.dirtyFields.has('propPosY')) {
        c.y = this.component.y;
      }

      // Pin labels
      for (const field of this.dirtyFields) {
        if (field.startsWith('pin:')) {
          const pinId = field.substring(4);
          if (this.component.pins[pinId]) {
            c.pins[pinId] = { ...c.pins[pinId], customLabel: this.component.pins[pinId]?.customLabel };
          }
        }
      }

      // Font sizes
      if (this.dirtyFields.has('propBmkFontSize') && this.component.bmkPosition?.fontSize) {
        c.bmkPosition = { ...c.bmkPosition, fontSize: this.component.bmkPosition.fontSize };
      }
      if (this.dirtyFields.has('propFnFontSize') && this.component.functionTextPosition?.fontSize) {
        c.functionTextPosition = { ...c.functionTextPosition, fontSize: this.component.functionTextPosition.fontSize };
      }
      if (this.dirtyFields.has('propAdditionalFontSize') && this.component.additionalTextPosition?.fontSize) {
        c.additionalTextPosition = { ...c.additionalTextPosition, fontSize: this.component.additionalTextPosition.fontSize };
      }
      if (this.dirtyFields.has('propTechFontSize') && this.component.technicalDataPosition?.fontSize) {
        c.technicalDataPosition = { ...c.technicalDataPosition, fontSize: this.component.technicalDataPosition.fontSize };
      }
      if (this.dirtyFields.has('propCrossRefFontSize') && this.component.crossRefFontSize) {
        c.crossRefFontSize = this.component.crossRefFontSize;
      }
      if (this.dirtyFields.has('propPinFontSize') && this.component.pinLabelFontSize) {
        c.pinLabelFontSize = this.component.pinLabelFontSize;
      }

      // Positions & Presets & Visibilities
      if ([...this.dirtyFields].some(f => f.startsWith('propBmk') && f !== 'propBmk' && f !== 'propBmkFontSize')) {
        c.bmkPosition = { ...c.bmkPosition, ...this.component.bmkPosition };
      }
      if ([...this.dirtyFields].some(f => f.startsWith('propFn') && f !== 'propFn' && f !== 'propFnFontSize')) {
        c.functionTextPosition = { ...c.functionTextPosition, ...this.component.functionTextPosition };
      }
      if ([...this.dirtyFields].some(f => f.startsWith('propTech') && f !== 'propTech' && f !== 'propTechFontSize')) {
        c.technicalDataPosition = { ...c.technicalDataPosition, ...this.component.technicalDataPosition };
      }
      if ([...this.dirtyFields].some(f => f.startsWith('propAdditional') && f !== 'propAdditional' && f !== 'propAdditionalFontSize')) {
        c.additionalTextPosition = { ...c.additionalTextPosition, ...this.component.additionalTextPosition };
      }
      if ([...this.dirtyFields].some(f => f.startsWith('propCrossRef') && f !== 'propCrossRef' && f !== 'propCrossRefFontSize')) {
        c.crossRefPosition = { ...c.crossRefPosition, ...this.component.crossRefPosition };
      }
      if ([...this.dirtyFields].some(f => f.startsWith('propPin') && f !== 'propPin' && f !== 'propPinFontSize')) {
        c.pinLabelPosition = { ...c.pinLabelPosition, ...this.component.pinLabelPosition };
      }

      // DeviceBox
      if (c.deviceBox && this.component.deviceBox) {
        if (this.dirtyFields.has('boxWidth')) resizeDeviceBox(c, this.component.deviceBox.width, c.deviceBox.height);
        if (this.dirtyFields.has('boxHeight')) resizeDeviceBox(c, c.deviceBox.width, this.component.deviceBox.height);
        if (this.dirtyFields.has('boxLineWidth')) c.deviceBox.lineWidth = this.component.deviceBox.lineWidth;
        if (this.dirtyFields.has('boxLineStyle')) c.deviceBox.lineStyle = this.component.deviceBox.lineStyle;
        if (this.dirtyFields.has('boxOwnColor') || this.dirtyFields.has('boxColor')) {
          if (this.component.deviceBox.color) c.deviceBox.color = this.component.deviceBox.color;
          else delete c.deviceBox.color;
        }
      }

      if (this.dirtyFields.has('propCompShowLabel')) {
        c.showLabels = this.component.showLabels;
      }
      if (this.dirtyFields.has('propCompScale')) {
        if (this.component.scale !== undefined) c.scale = this.component.scale;
        else delete c.scale;
      }

      if (this.resetPositionsTriggered) {
        delete c.bmkPosition;
        delete c.functionTextPosition;
        delete c.additionalTextPosition;
        delete c.technicalDataPosition;
        delete c.crossRefPosition;
        delete c.pinLabelPosition;
      }
    }

    if (this.callbacks.onSaveMultiple) {
      this.callbacks.onSaveMultiple(this.components.map(c => structuredClone(c)));
    } else {
      this.components.forEach(c => this.callbacks.onSave(structuredClone(c)));
    }
    return true;
  }

  /**
   * Opens a general shared properties modal for any multi-selection
   * (e.g. multiple cables, boxes, wires, texts, images, or mixed element types).
   */
  public static showSelectionModal(page: Page, project: Project, selection: ElementSelection, onApply: () => void): void {
    const existing = document.getElementById('propertiesModal');
    if (existing) existing.remove();

    const count = selectionCount(selection);
    const units = getDrawingUnitsPerMm(project);

    // Filter available shared properties that exist on ALL selected elements
    const allCandidateKeys: { key: SharedProperty; label: string; group: string; type: 'text' | 'number' | 'select' | 'checkbox'; options?: [string, string][] }[] = [
      // Identifikation & Texte
      { key: 'bmk', label: t('labelBmk'), group: 'id', type: 'text' },
      { key: 'deviceTag', label: t('labelDeviceTag'), group: 'id', type: 'text' },
      { key: 'functionText', label: t('labelFunctionText'), group: 'id', type: 'text' },
      { key: 'additionalText', label: t('labelAdditionalText'), group: 'id', type: 'text' },
      { key: 'technicalCharacteristics', label: t('labelTechnical'), group: 'id', type: 'text' },
      { key: 'higherLevel', label: t('labelStructure') + ' (=Anlage)', group: 'id', type: 'text' },
      { key: 'location', label: t('labelStructure') + ' (+Ort)', group: 'id', type: 'text' },
      { key: 'manufacturer', label: t('labelManufacturer'), group: 'id', type: 'text' },
      { key: 'articleNumber', label: t('labelArticleNumber'), group: 'id', type: 'text' },

      // Kabel & Leitungen
      { key: 'cableType', label: t('cableType'), group: 'cable', type: 'text' },
      { key: 'crossSection', label: t('cableSection'), group: 'cable', type: 'text' },
      { key: 'coreCount', label: t('cableCoreCount'), group: 'cable', type: 'number' },
      { key: 'cableDescription', label: t('cableDescription'), group: 'cable', type: 'text' },
      { key: 'cableMarkStyle', label: t('cableMarkStyle'), group: 'cable', type: 'select', options: [['slash', t('cableMarkSlash')], ['none', t('cableMarkNone')]] },
      { key: 'wirePotential', label: t('wirePotential'), group: 'wire', type: 'text' },
      { key: 'wireColor', label: t('wireColor'), group: 'wire', type: 'select', options: [['BK', t('wireColorBk')], ['BU', t('wireColorBu')], ['GNYE', t('wireColorGnye')], ['RD', t('wireColorRd')], ['DBU', t('wireColorDbu')]] },
      { key: 'wireNumber', label: 'Adernummer', group: 'wire', type: 'text' },

      // Freier Text
      { key: 'textContent', label: t('textContent'), group: 'text', type: 'text' },
      { key: 'textFontSize', label: t('textFontSize'), group: 'text', type: 'number' },
      { key: 'textAlign', label: t('textAlign'), group: 'text', type: 'select', options: [['start', t('textAlignLeft')], ['center', t('textAlignCenter')], ['end', t('textAlignRight')]] },
      { key: 'textFontWeight', label: 'Schriftschnitt', group: 'text', type: 'select', options: [['normal', 'Normal'], ['bold', 'Fett']] },
      { key: 'textFontStyle', label: 'Schriftstil', group: 'text', type: 'select', options: [['normal', 'Normal'], ['italic', 'Kursiv']] },

      // Schriftgrößen & Anzeige
      { key: 'bmkFontSize', label: 'BMK / Kabel-Schriftgröße (mm)', group: 'font', type: 'number' },
      { key: 'functionFontSize', label: 'Funktionstext / Text-Größe (mm)', group: 'font', type: 'number' },
      { key: 'additionalFontSize', label: 'Zusatztext-Größe (mm)', group: 'font', type: 'number' },
      { key: 'technicalFontSize', label: 'Technische-Daten-Größe (mm)', group: 'font', type: 'number' },
      { key: 'crossRefFontSize', label: 'Querverweis-Größe (mm)', group: 'font', type: 'number' },
      { key: 'pinFontSize', label: 'Anschluss- / Ader-Größe (mm)', group: 'font', type: 'number' },
      { key: 'boxFontSize', label: 'Kasten-Schriftgröße (mm)', group: 'font', type: 'number' },
      { key: 'bmkVisible', label: 'BMK / Beschriftung sichtbar', group: 'vis', type: 'checkbox' },
      { key: 'fnVisible', label: 'Funktionstext sichtbar', group: 'vis', type: 'checkbox' },
      { key: 'techVisible', label: 'Technische Daten sichtbar', group: 'vis', type: 'checkbox' },
      { key: 'additionalVisible', label: 'Zusatztext sichtbar', group: 'vis', type: 'checkbox' },
      { key: 'crossRefVisible', label: 'Querverweise sichtbar', group: 'vis', type: 'checkbox' },
      { key: 'pinVisible', label: 'Anschlüsse / Adern sichtbar', group: 'vis', type: 'checkbox' },

      // Kasten / Rahmen
      { key: 'boxLineWidth', label: t('boxLabelLineWidth') + ' (mm)', group: 'box', type: 'number' },
      { key: 'boxLineStyle', label: t('boxLabelLineStyle'), group: 'box', type: 'select', options: [['solid', t('boxStyleSolid')], ['dashed', t('boxStyleDashed')]] },

      // Geometrie & Position
      { key: 'posX', label: t('boxLabelPosX') + ' (mm)', group: 'geom', type: 'number' },
      { key: 'posY', label: t('boxLabelPosY') + ' (mm)', group: 'geom', type: 'number' },
      { key: 'width', label: t('boxLabelWidth') + ' (mm)', group: 'geom', type: 'number' },
      { key: 'height', label: t('boxLabelHeight') + ' (mm)', group: 'geom', type: 'number' },
      { key: 'rotation', label: t('propRotationAngle'), group: 'geom', type: 'select', options: [['0', '0°'], ['90', '90°'], ['180', '180°'], ['270', '270°']] },
    ];

    const validProps = allCandidateKeys.filter(item => propertyExistsOnAllSelected(page, selection, item.key));

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

    const renderInput = (item: typeof allCandidateKeys[0]) => {
      const val = sharedPropertyValue(page, project, selection, item.key);
      const isMixed = val === undefined;
      const placeholder = isMixed ? `placeholder="${t('sharedDifferentValues')}"` : '';

      if (item.type === 'checkbox') {
        return `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;">
            <label style="font-size:12px;color:#cbd5e0;cursor:pointer;" for="shared-${item.key}">${escapeSvg(item.label)}</label>
            <input type="checkbox" id="shared-${item.key}" data-shared-property="${item.key}" ${val === 'true' ? 'checked' : ''} style="width:16px;height:16px;accent-color:#3182ce;">
          </div>
        `;
      }
      if (item.type === 'select' && item.options) {
        return `
          <div style="margin-bottom:10px;">
            <label class="form-label" style="font-size:11px;">${escapeSvg(item.label)}</label>
            <select class="form-input" id="shared-${item.key}" data-shared-property="${item.key}">
              <option value="" ${isMixed ? 'selected' : ''} disabled>— (${t('sharedDifferentValues')}) —</option>
              ${item.options.map(([optVal, optLabel]) => `
                <option value="${optVal}" ${!isMixed && String(val) === optVal ? 'selected' : ''}>${escapeSvg(optLabel)}</option>
              `).join('')}
            </select>
          </div>
        `;
      }
      const numAttrs = item.type === 'number' ? 'type="number" step="any"' : 'type="text"';
      const displayVal = val === undefined ? '' : typeof val === 'number' ? Number(val.toFixed(4)) : val;
      return `
        <div style="margin-bottom:10px;">
          <label class="form-label" style="font-size:11px;">${escapeSvg(item.label)}</label>
          <input class="form-input" id="shared-${item.key}" data-shared-property="${item.key}" ${numAttrs} value="${escapeSvg(String(displayVal))}" ${placeholder}>
        </div>
      `;
    };

    const countDetails = [];
    if (selection.componentIds.length) countDetails.push(`${selection.componentIds.length} ${t('legendComponents')}`);
    if (selection.cableIds.length) countDetails.push(`${selection.cableIds.length} ${t('legendCableDefs')}`);
    if (selection.boxIds?.length) countDetails.push(`${selection.boxIds.length} ${t('legendDeviceBoxes')}`);
    if (selection.imageIds?.length) countDetails.push(`${selection.imageIds.length} ${t('imageHeading')}`);
    if (selection.wireIds?.length) countDetails.push(`${selection.wireIds.length} Verbindungen`);
    if (selection.textIds?.length) countDetails.push(`${selection.textIds.length} Texte`);

    modal.innerHTML = `
      <div class="modal-card ecad-window" style="
        background: #232731;
        border: 1px solid #4a5568;
        border-radius: 6px;
        width: 100%;
        max-width: 680px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.8);
        color: #edf2f7;
        font-family: inherit;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      ">
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
            <span style="color: #63b3ed; font-weight: bold;">⚙️</span>
            <span>Gemeinsame Eigenschaften (${count} Elemente ausgewählt: ${countDetails.join(', ')})</span>
          </div>
          <button id="btnClosePropModal" style="background: none; border: none; color: #a0aec0; font-size: 20px; cursor: pointer; line-height: 1;">&times;</button>
        </div>

        <div style="padding: 16px; max-height: 70vh; overflow-y: auto;">
          <p style="font-size: 11px; color: var(--text-muted); margin-top: 0; margin-bottom: 14px;">
            Hier werden alle Eigenschaften angezeigt, die bei <strong>allen</strong> markierten Elementen existieren. Nur geänderte Felder werden gemeinsam übertragen.
          </p>

          ${validProps.length === 0 ? `
            <div style="padding: 24px; text-align: center; color: #a0aec0; font-size: 13px;">
              Die ausgewählten Elemente teilen keine gemeinsamen Eigenschaften.
            </div>
          ` : `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              ${validProps.map(p => renderInput(p)).join('')}
            </div>
          `}
        </div>

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

    const closeModal = () => modal.remove();
    modal.querySelector('#btnClosePropModal')?.addEventListener('click', closeModal);
    modal.querySelector('#btnCancelProp')?.addEventListener('click', closeModal);

    const patch: SelectionPatch = {};
    modal.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-shared-property]').forEach(input => {
      const key = input.dataset.sharedProperty as SharedProperty;
      const handler = () => {
        if (input.type === 'checkbox') {
          patch[key] = (input as HTMLInputElement).checked ? 'true' : 'false';
        } else if (input.type === 'number') {
          if (input.value === '') delete patch[key];
          else patch[key] = Number(input.value);
        } else {
          patch[key] = input.value;
        }
      };
      input.addEventListener('input', handler);
      input.addEventListener('change', handler);
    });

    const executeApply = () => {
      if (Object.keys(patch).length > 0) {
        applySelectionProperties(page, project, selection, patch);
        onApply();
      }
    };

    modal.querySelector('#btnApplyProp')?.addEventListener('click', () => {
      executeApply();
      const applyBtn = modal.querySelector('#btnApplyProp') as HTMLElement;
      if (applyBtn) {
        const origText = applyBtn.textContent || t('propBtnApply');
        applyBtn.textContent = t('propAppliedBadge');
        setTimeout(() => { applyBtn.textContent = origText; }, 1200);
      }
    });

    modal.querySelector('#btnSaveProp')?.addEventListener('click', () => {
      executeApply();
      closeModal();
    });

    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        executeApply();
        closeModal();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      }
    });
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

    const compShowLabel = modal.querySelector('#propCompShowLabel') as HTMLInputElement | null;
    if (compShowLabel) {
      this.component.showLabels = compShowLabel.checked;
    }
    const compScale = modal.querySelector('#propCompScale') as HTMLSelectElement | null;
    if (compScale) {
      if (compScale.value === 'inherit') delete this.component.scale;
      else {
        const sc = parseFloat(compScale.value);
        if (!isNaN(sc)) this.component.scale = sc;
      }
    }
  }
}
