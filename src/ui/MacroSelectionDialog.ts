import { externalMacroLibrary } from '../model/ExternalMacroLibrary';
import { createMacroFolderPanel } from './MacroFolderPanel';
import { escapeSvg } from '../model/ImportedDrawing';
import { t, getMacroCategoryLabel } from '../i18n';
// src/ui/MacroSelectionDialog.ts
// Dialog for browsing, importing, previewing, and placing macros (.ema / .ems)

import { MacroManager, MacroItem, WindowMacro, PageMacro } from '../model/MacroManager';

export interface MacroSelectionCallbacks {
  onSelectWindowMacro?: (macro: WindowMacro) => void;
  onSelectPageMacro?: (macro: PageMacro) => void;
}

export class MacroSelectionDialog {
  private callbacks: MacroSelectionCallbacks;
  private selectedCategory: string = 'all';
  private searchQuery: string = '';
  private page = 0;
  private selectedMacroId: string = '';
  private unsubscribe?: () => void;
  private keyHandler?: (event: KeyboardEvent) => void;
  private modal?: HTMLElement;
  private close(): void {
    this.unsubscribe?.(); this.unsubscribe = undefined;
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.modal?.remove(); this.modal = undefined;
  }

  constructor(callbacks: MacroSelectionCallbacks, defaultCategory = 'all') {
    this.callbacks = callbacks; this.selectedCategory = defaultCategory;
    const all = this.getFilteredMacros();
    if (all.length > 0) {
      this.selectedMacroId = all[0].id;
    }
  }

  public show(): void {
    const existing = document.getElementById('macroSelectionModal');
    if (existing) existing.dispatchEvent(new Event('macro-close'));
    this.close();

    const all = MacroManager.getAllMacros();
    if (!this.selectedMacroId && all.length > 0) {
      this.selectedMacroId = all[0].id;
    }

    const modal = document.createElement('div');
    modal.id = 'macroSelectionModal';
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
        max-width: 950px;
        height: 85vh;
        max-height: 720px;
        box-shadow: 0 16px 40px rgba(0,0,0,0.8);
        color: #edf2f7;
        font-family: inherit;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      ">
        <!-- Window Titlebar -->
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
            <span style="color: #63b3ed;">📦</span>
            <span>${escapeSvg(t('macroModalTitle'))}</span>
          </div>
          <button id="btnCloseMacroModal" style="background: none; border: none; color: #a0aec0; font-size: 18px; cursor: pointer;">&times;</button>
        </div>

        <!-- Filter Bar -->
        <div style="
          padding: 8px 14px;
          background: #1c1f26;
          border-bottom: 1px solid #3e4656;
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        ">
          <div style="flex: 1; min-width: 200px; display: flex; align-items: center; gap: 6px; background: #232731; border: 1px solid #3e4656; border-radius: 4px; padding: 4px 8px;">
            <span style="color: #a0aec0; font-size: 12px;">🔍</span>
            <input type="text" id="macroSearchInput" placeholder="${escapeSvg(t('searchMacrosPlaceholder'))}" style="
              background: none;
              border: none;
              color: white;
              font-size: 12px;
              width: 100%;
              outline: none;
            " value="${escapeSvg(this.searchQuery)}">
          </div>

          <label class="btn btn-primary" style="padding: 4px 10px; font-size: 11px; margin: 0; cursor: pointer; display: flex; align-items: center; gap: 5px;">
            <span>${escapeSvg(t('macroImportBtn'))}</span>
            <input type="file" id="macroDialogFileInput" accept=".ema,.ems,.emp,.fp1,.edz,.xml,.json" style="display: none;">
          </label>

          <span style="font-size: 11px; color: #a0aec0;" id="macroCountBadge">
            ${escapeSvg(t('macroCountAvailable', { count: all.length }))}
          </span>
        </div>

        <div id="macroFolderPanelHost" style="padding:0 14px;max-height:220px;overflow:auto;flex-shrink:0"></div>
        <!-- Main Body: 3-Column Layout (Category Tree | Macro Cards Grid | Preview Details) -->
        <div style="flex: 1; display: flex; overflow: hidden;">
          <!-- Left Column: Category Tree -->
          <div style="
            width: 200px;
            background: #181b22;
            border-right: 1px solid #3e4656;
            padding: 8px 0;
            overflow-y: auto;
            flex-shrink: 0;
          ">
            <div style="font-size: 10px; font-weight: bold; color: #718096; text-transform: uppercase; padding: 4px 12px; margin-bottom: 2px;">${escapeSvg(t('categories'))}</div>
            <div class="macro-tree-node ${this.selectedCategory === 'all' ? 'active' : ''}" data-cat="all" style="padding: 6px 12px; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 6px;">
              <span>📁</span> ${escapeSvg(getMacroCategoryLabel('all'))}
            </div>
            <div class="macro-tree-node ${this.selectedCategory === 'window' ? 'active' : ''}" data-cat="window" style="padding: 6px 12px; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 6px;">
              <span>📦</span> ${escapeSvg(getMacroCategoryLabel('window'))}
            </div>
            <div class="macro-tree-node ${this.selectedCategory === 'page' ? 'active' : ''}" data-cat="page" style="padding: 6px 12px; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 6px;">
              <span>📄</span> ${escapeSvg(getMacroCategoryLabel('page'))}
            </div>
            
            <div style="font-size: 10px; font-weight: bold; color: #718096; text-transform: uppercase; padding: 8px 12px 2px 12px; margin-top: 4px; border-top: 1px solid #2d3748;">${escapeSvg(t('macroCatTopics'))}</div>
            <div class="macro-tree-node ${this.selectedCategory === 'motor' ? 'active' : ''}" data-cat="motor" style="padding: 6px 12px; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 6px;">
              <span>⚙️</span> ${escapeSvg(getMacroCategoryLabel('motor'))}
            </div>
            <div class="macro-tree-node ${this.selectedCategory === 'power' ? 'active' : ''}" data-cat="power" style="padding: 6px 12px; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 6px;">
              <span>⚡</span> ${escapeSvg(getMacroCategoryLabel('power'))}
            </div>
            <div class="macro-tree-node ${this.selectedCategory === 'safety' ? 'active' : ''}" data-cat="safety" style="padding: 6px 12px; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 6px;">
              <span>🛡️</span> ${escapeSvg(getMacroCategoryLabel('safety'))}
            </div>
            <div class="macro-tree-node" data-cat="external" style="padding:6px 12px;cursor:pointer;font-size:12px">📁 ${escapeSvg(getMacroCategoryLabel('external'))}</div>
            <div class="macro-tree-node ${this.selectedCategory === 'user' ? 'active' : ''}" data-cat="user" style="padding: 6px 12px; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 6px;">
              <span>⭐</span> ${escapeSvg(getMacroCategoryLabel('user'))}
            </div>
          </div>

          <!-- Middle Column: Macro Cards Grid -->
          <div style="
            flex: 1;
            padding: 12px;
            overflow-y: auto;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
            gap: 10px;
            align-content: start;
            background: #1c1f26;
          " id="macroGridContainer">
            ${this.renderMacroGrid()}
          </div>

          <!-- Right Column: Detail Inspector & Actions -->
          <div style="
            width: 290px;
            background: #232731;
            border-left: 1px solid #3e4656;
            padding: 14px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            overflow-y: auto;
            flex-shrink: 0;
          " id="macroDetailsContainer">
            ${this.renderMacroDetails()}
          </div>
        </div>

        <!-- Window Footer -->
        <div style="
          padding: 8px 14px;
          background: #2d323e;
          border-top: 1px solid #3e4656;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <div style="font-size: 11px; color: #a0aec0;">
            ${escapeSvg(t('macroTipDblClick'))}
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn" id="btnCancelMacro">${escapeSvg(t('macroBtnClose'))}</button>
            <button class="btn btn-primary" id="btnApplyMacroAction">${escapeSvg(t('macroBtnExecute'))}</button>
          </div>
        </div>
        </div>
      </div>
    `;

    this.modal = modal;
    document.body.appendChild(modal);
    modal.querySelector('#macroFolderPanelHost')!.appendChild(createMacroFolderPanel());
    this.unsubscribe = externalMacroLibrary.subscribe(() => this.updateGrid(modal));
    modal.addEventListener('macro-close', () => this.close());
    this.bindEvents(modal);
  }

  private getFilteredMacros(): MacroItem[] {
    let list = MacroManager.getAllMacros();

    if (this.selectedCategory === 'window') {
      list = list.filter(m => m.type === 'ema');
    } else if (this.selectedCategory === 'page') {
      list = list.filter(m => m.type === 'ems');
    } else if (this.selectedCategory === 'external') {
      list = list.filter(m => !!m.externalPath);
    } else if (this.selectedCategory === 'user') {
      list = list.filter(m => !m.isBuiltIn && !m.externalPath);
    } else if (this.selectedCategory === 'motor') {
      list = list.filter(m => m.category.includes('Motor') || m.name.includes('Motor'));
    } else if (this.selectedCategory === 'power') {
      list = list.filter(m => m.category.includes('Strom') || m.category.includes('Versorgung') || m.name.includes('24V'));
    } else if (this.selectedCategory === 'safety') {
      list = list.filter(m => m.category.includes('Sicherheit') || m.name.includes('HALT'));
    } else if (this.selectedCategory !== 'all') {
      list = list.filter(m => m.category.toLowerCase().includes(this.selectedCategory.toLowerCase()));
    }

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(m => {
        const titleMatch = m.name.toLowerCase().includes(q) || (m.externalPath || '').toLowerCase().includes(q);
        const descMatch = (m.description || '').toLowerCase().includes(q);
        const catMatch = (m.category || '').toLowerCase().includes(q);
        const bmkMatch = m.type === 'ema'
          ? (m as WindowMacro).components.some(c => c.bmk.toLowerCase().includes(q) || (c.functionText || '').toLowerCase().includes(q))
          : (m as PageMacro).page.components.some(c => c.bmk.toLowerCase().includes(q));
        return titleMatch || descMatch || catMatch || bmkMatch;
      });
    }

    return list;
  }

  private renderMacroGrid(): string {
    const list = this.getFilteredMacros();
    if (list.length === 0) {
      return `
        <div style="grid-column: 1 / -1; padding: 40px 20px; text-align: center; color: #a0aec0;">
          ${t('macroEmptySearch')}
        </div>
      `;
    }

    const pageSize=48,pageCount=Math.max(1,Math.ceil(list.length/pageSize));
    this.page=Math.max(0,Math.min(this.page,pageCount-1));
    const pager=pageCount>1?`<div data-macro-pager style="grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:11px"><button class="btn" data-macro-page="-1" ${this.page===0?'disabled':''} aria-label="${escapeSvg(t('macroPagePrev'))}">←</button><span>${escapeSvg(t('foundMacros', { count: list.length }))} · ${this.page+1}/${pageCount}</span><button class="btn" data-macro-page="1" ${this.page===pageCount-1?'disabled':''} aria-label="${escapeSvg(t('macroPageNext'))}">→</button></div>`:'';
    return pager+list.slice(this.page*pageSize,(this.page+1)*pageSize).map(m => {
      const isSelected = m.id === this.selectedMacroId;
      const isWindow = m.type === 'ema';
      const typeBadge = isWindow
        ? '<span style="background: rgba(66, 153, 225, 0.25); color: #63b3ed; border: 1px solid #3182ce; font-size: 9px; padding: 1px 4px; border-radius: 3px; font-weight: bold;">.EMA</span>'
        : '<span style="background: rgba(159, 122, 234, 0.25); color: #b794f4; border: 1px solid #805ad5; font-size: 9px; padding: 1px 4px; border-radius: 3px; font-weight: bold;">.EMS</span>';

      const thumbSvg = MacroManager.generateMacroSvgThumbnail(m);

      return `
        <div class="macro-dialog-card ${isSelected ? 'selected' : ''}" data-macro-id="${m.id}" style="
          background: #232731;
          border: 1px solid ${isSelected ? '#63b3ed' : '#3e4656'};
          border-radius: 4px;
          padding: 8px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 6px;
          transition: all 0.12s ease;
          position: relative;
        ">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 11px; font-weight: 600; color: #edf2f7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
              ${escapeSvg(m.name)}
            </div>
            ${typeBadge}
          </div>

          <div style="
            background: #181b22;
            border: 1px solid #2d3748;
            border-radius: 3px;
            height: 90px;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
          ">
            ${thumbSvg}
          </div>

          <div style="font-size: 10px; color: #a0aec0; height: 26px; overflow: hidden; line-height: 1.3;">
            ${escapeSvg(m.description || t('macroCircuitMacro'))}
          </div>
        </div>
      `;
    }).join('');
  }

  private renderMacroDetails(): string {
    const all = this.getFilteredMacros();
    const m = all.find(item => item.id === this.selectedMacroId) || all[0];
    if (!m) {
      return `<div style="color: #a0aec0; font-size: 12px;">${escapeSvg(t('macroNoSelection'))}</div>`;
    }

    const isWindow = m.type === 'ema';
    const typeLabel = isWindow ? getMacroCategoryLabel('window') : getMacroCategoryLabel('page');
    const typeColor = isWindow ? '#63b3ed' : '#b794f4';
    const thumbSvg = MacroManager.generateMacroSvgThumbnail(m);

    let componentsCount = 0;
    let wiresCount = 0;
    let compListHtml = '';

    if (isWindow) {
      const wm = m as WindowMacro;
      componentsCount = wm.components.length;
      wiresCount = wm.wires ? wm.wires.length : 0;
      compListHtml = wm.components.map(c => `
        <div style="display: flex; justify-content: space-between; font-size: 10px; font-family: monospace; background: #1c1f26; padding: 2px 6px; border-radius: 3px;">
          <span style="color: #f6e05e; font-weight: bold;">${escapeSvg(c.bmk)}</span>
          <span style="color: #cbd5e0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px;">${escapeSvg(c.functionText || c.symbolId)}</span>
        </div>
      `).join('');
    } else {
      const pm = m as PageMacro;
      componentsCount = pm.page.components.length;
      wiresCount = pm.page.wires.length;
      compListHtml = pm.page.components.slice(0, 8).map(c => `
        <div style="display: flex; justify-content: space-between; font-size: 10px; font-family: monospace; background: #1c1f26; padding: 2px 6px; border-radius: 3px;">
          <span style="color: #f6e05e; font-weight: bold;">${escapeSvg(c.bmk)}</span>
          <span style="color: #cbd5e0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px;">${escapeSvg(c.functionText || c.symbolId)}</span>
        </div>
      `).join('');
      if (pm.page.components.length > 8) {
        compListHtml += `<div style="font-size: 9px; color: #a0aec0; text-align: center;">${escapeSvg(t('macroMoreComponents', { count: pm.page.components.length - 8 }))}</div>`;
      }
    }

    return `
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="font-size: 10px; font-weight: bold; color: #a0aec0; text-transform: uppercase;">${escapeSvg(t('macroPreviewHeading'))}</span>
          <span style="font-size: 10px; font-weight: bold; color: ${typeColor};">${escapeSvg(typeLabel)}</span>
        </div>
        <div style="
          background: #181b22;
          border: 1px solid #3e4656;
          border-radius: 4px;
          height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        ">
          ${thumbSvg}
        </div>
      </div>

      <div>
        <div style="font-size: 13px; font-weight: 600; color: #edf2f7;">${escapeSvg(m.name)}</div>
        <div style="font-size: 11px; color: #a0aec0; margin-top: 3px; line-height: 1.4;">${escapeSvg(m.description || '')}</div>
        ${m.importDiagnostics?.length?`<details><summary>${escapeSvg(t('macroDiagnostics', { count: m.importDiagnostics.length }))}</summary><ul style="padding-left:16px;font-size:11px;overflow-wrap:anywhere">${m.importDiagnostics.map(note=>`<li>${escapeSvg(note)}</li>`).join('')}</ul></details>`:''}
      </div>

      <div style="border-top: 1px solid #2d3748; padding-top: 8px;">
        <div style="font-size: 10px; font-weight: bold; color: #a0aec0; text-transform: uppercase; margin-bottom: 4px;">${escapeSvg(t('macroInfoHeading'))}</div>
        <div style="font-size: 11px; line-height: 1.6;">
          <div><strong style="color: #cbd5e0;">${escapeSvg(t('macroTypeLabel'))}</strong> ${escapeSvg(typeLabel)}</div>
          <div><strong style="color: #cbd5e0;">${escapeSvg(t('macroComponentsLabel'))}</strong> ${escapeSvg(t('macroComponentsVal', { count: componentsCount }))}</div>
          <div><strong style="color: #cbd5e0;">${escapeSvg(t('macroConnectionsLabel'))}</strong> ${escapeSvg(t('macroConnectionsVal', { count: wiresCount }))}</div>
          <div><strong style="color: #cbd5e0;">${escapeSvg(t('macroOriginLabel'))}</strong> ${m.externalPath ? escapeSvg(t('macroOriginExternal', { path: m.externalPath })) : m.isBuiltIn ? escapeSvg(t('macroOriginBuiltin')) : escapeSvg(t('macroOriginUser'))}</div>
        </div>
      </div>

      <div style="border-top: 1px solid #2d3748; padding-top: 8px; flex: 1; display: flex; flex-direction: column; overflow: hidden;">
        <div style="font-size: 10px; font-weight: bold; color: #a0aec0; text-transform: uppercase; margin-bottom: 4px;">${escapeSvg(t('macroContainedHeading', { count: componentsCount }))}</div>
        <div style="display: flex; flex-direction: column; gap: 4px; overflow-y: auto; max-height: 130px;">
          ${compListHtml}
        </div>
      </div>

      <div style="border-top: 1px solid #2d3748; padding-top: 8px; display: flex; flex-direction: column; gap: 6px;">
        <button class="btn btn-primary" id="btnActionPrimary" style="width: 100%; justify-content: center; padding: 6px 12px; font-size: 11px; font-weight: 600;">
          ${escapeSvg(t('macroPlaceOnPlan'))}
        </button>
        <div style="display: flex; gap: 6px;">
          <button class="btn" id="btnExportMacroItem" style="flex: 1; justify-content: center; font-size: 11px;" title="${escapeSvg(t('export'))}">
            ${escapeSvg(t('macroExportBtn'))}
          </button>
          ${!m.isBuiltIn && !m.externalPath ? `
            <button class="btn" id="btnDeleteMacroItem" style="color: #fc8181; border-color: #e53e3e; font-size: 11px;" title="${escapeSvg(t('macroDeleteMacro'))}">
              🗑️
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  private bindEvents(modal: HTMLElement): void {
    const closeModal = () => this.close();

    // Close buttons
    modal.querySelector('#btnCloseMacroModal')?.addEventListener('click', closeModal);
    modal.querySelector('#btnCancelMacro')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Search input
    const searchInput = modal.querySelector('#macroSearchInput') as HTMLInputElement;
    searchInput?.addEventListener('input', () => {
      this.searchQuery = searchInput.value.trim();
      this.page=0;
      this.updateGrid(modal);
    });

    // File input for import
    const fileInput = modal.querySelector('#macroDialogFileInput') as HTMLInputElement;
    fileInput?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        await this.handleImport(file, modal);
      }
    });

    // Category tree nodes
    modal.querySelectorAll('.macro-tree-node').forEach(node => {
      node.addEventListener('click', (e) => {
        modal.querySelectorAll('.macro-tree-node').forEach(n => {
          (n as HTMLElement).style.background = 'none';
          (n as HTMLElement).style.color = '#edf2f7';
        });
        const target = e.currentTarget as HTMLElement;
        target.style.background = 'rgba(99, 179, 237, 0.15)';
        target.style.color = '#63b3ed';
        this.selectedCategory = target.dataset.cat || 'all';
        this.page=0;
        this.updateGrid(modal);
      });
    });

    // Primary action execution
    const executePrimary = () => {
      const all = MacroManager.getAllMacros();
      const m = all.find(item => item.id === this.selectedMacroId);
      if (!m) return;

      if (m.type === 'ema' && this.callbacks.onSelectWindowMacro) {
        this.callbacks.onSelectWindowMacro(m as WindowMacro);
        closeModal();
      } else if (m.type === 'ems' && this.callbacks.onSelectPageMacro) {
        this.callbacks.onSelectPageMacro(m as PageMacro);
        closeModal();
      }
    };

    modal.querySelector('#btnApplyMacroAction')?.addEventListener('click', executePrimary);

    // Keyboard navigation
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
        window.removeEventListener('keydown', keyHandler);
      } else if (e.key === 'Enter') {
        executePrimary();
        window.removeEventListener('keydown', keyHandler);
      }
    };
    this.keyHandler = keyHandler;
    window.addEventListener('keydown', keyHandler);

    this.bindDetailEvents(modal, executePrimary);
    this.bindCardClicks(modal, executePrimary);
  }

  private bindDetailEvents(modal: HTMLElement, onExecute: () => void): void {
    modal.querySelector('#btnActionPrimary')?.addEventListener('click', onExecute);

    modal.querySelector('#btnExportMacroItem')?.addEventListener('click', () => {
      const all = MacroManager.getAllMacros();
      const m = all.find(item => item.id === this.selectedMacroId);
      if (m) {
        const { blob, filename } = MacroManager.exportMacro(m);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    });

    modal.querySelector('#btnDeleteMacroItem')?.addEventListener('click', () => {
      if (confirm(t('macroDeleteConfirm'))) {
        MacroManager.deleteMacro(this.selectedMacroId);
        const remaining = MacroManager.getAllMacros();
        this.selectedMacroId = remaining.length > 0 ? remaining[0].id : '';
        this.updateGrid(modal);
      }
    });
  }

  private updateGrid(modal: HTMLElement): void {
    const filtered = this.getFilteredMacros();
    if (!filtered.some(m => m.id === this.selectedMacroId)) this.selectedMacroId = filtered[0]?.id || '';
    const grid = modal.querySelector('#macroGridContainer');
    if (grid) {
      grid.innerHTML = this.renderMacroGrid();
    }

    const count = this.getFilteredMacros().length;
    const badge = modal.querySelector('#macroCountBadge');
    if (badge) badge.textContent = t('foundMacros', { count });

    const details = modal.querySelector('#macroDetailsContainer');
    if (details) {
      details.innerHTML = this.renderMacroDetails();
      this.bindDetailEvents(modal, () => {
        const all = MacroManager.getAllMacros();
        const m = all.find(item => item.id === this.selectedMacroId);
        if (m) {
          if (m.type === 'ema') this.callbacks.onSelectWindowMacro?.(m as WindowMacro);
          else this.callbacks.onSelectPageMacro?.(m as PageMacro);
          this.close();
        }
      });
    }

    this.bindCardClicks(modal, () => {
      const all = MacroManager.getAllMacros();
      const m = all.find(item => item.id === this.selectedMacroId);
      if (m) {
        if (m.type === 'ema') this.callbacks.onSelectWindowMacro?.(m as WindowMacro);
        else this.callbacks.onSelectPageMacro?.(m as PageMacro);
        this.close();
      }
    });
  }

  private bindCardClicks(modal: HTMLElement, onDoubleSelect: () => void): void {
    modal.querySelectorAll<HTMLElement>('[data-macro-page]').forEach(button=>button.addEventListener('click',()=>{
      this.page+=Number(button.dataset.macroPage);
      this.selectedMacroId=this.getFilteredMacros()[this.page*48]?.id??'';
      this.updateGrid(modal);modal.querySelector('#macroGridContainer')?.scrollTo(0,0);
    }));
    modal.querySelectorAll('.macro-dialog-card').forEach(card => {
      card.addEventListener('click', (e) => {
        modal.querySelectorAll('.macro-dialog-card').forEach(c => (c as HTMLElement).style.borderColor = '#3e4656');
        const target = e.currentTarget as HTMLElement;
        target.style.borderColor = '#63b3ed';
        this.selectedMacroId = target.dataset.macroId!;
        const details = modal.querySelector('#macroDetailsContainer');
        if (details) {
          details.innerHTML = this.renderMacroDetails();
          this.bindDetailEvents(modal, onDoubleSelect);
        }
      });

      card.addEventListener('dblclick', (e) => {
        this.selectedMacroId = (e.currentTarget as HTMLElement).dataset.macroId!;
        onDoubleSelect();
      });
    });
  }

  private async handleImport(file: File, modal: HTMLElement): Promise<void> {
    try {
      const imported = await MacroManager.parseMacroFile(file,{allowMissingDependencies:true});
      MacroManager.addMacro(imported);
      this.selectedMacroId = imported.id;
      this.updateGrid(modal);
      alert(t('macroImportSuccess', { name: imported.name, type: imported.type === 'ema' ? '.ema' : '.ems' }));
    } catch (err: any) {
      alert(t('macroImportError', { error: err.message }));
    }
  }
}
