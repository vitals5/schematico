// src/ui/SymbolSelectionDialog.ts
// Symbol Selection modal ("Symbolauswahl")

import { ELEMENT_CATEGORIES, symbolMatchesQuery } from '../model/SymbolCatalogue';
import { escapeSvg } from '../model/ImportedDrawing';
import { isConnectionSymbol, connectionFamily } from '../model/ConnectionSymbols';
import { SymbolDefinition } from '../model/types';
import { getSymbolDefinitions, getSymbolById } from '../model/symbols';

export interface SymbolSelectionCallbacks {
  onSelect: (symbol: SymbolDefinition) => void;
}

export class SymbolSelectionDialog {
  private callbacks: SymbolSelectionCallbacks;
  private selectedCategory: string = 'all';
  private searchQuery: string = '';
  private selectedSymbolId: string = getSymbolDefinitions()[0].id;

  constructor(callbacks: SymbolSelectionCallbacks, private kind: 'elements' | 'connections' = 'elements') {
    this.callbacks = callbacks;
    this.selectedSymbolId = getSymbolDefinitions().find(s => !s.annotationKind && isConnectionSymbol(s) === (kind === 'connections'))?.id ?? '';
  }

  public show(): void {
    const existing = document.getElementById('symbolSelectionModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'symbolSelectionModal';
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
        max-width: 900px;
        height: 85vh;
        max-height: 700px;
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
            <span style="color: #63b3ed;">📐</span>
            <span>${this.kind === 'connections' ? 'Verbindungselemente' : 'Elementauswahl'} (DIN EN 60617 / IEC 81346)</span>
          </div>
          <button id="btnCloseSymModal" style="background: none; border: none; color: #a0aec0; font-size: 18px; cursor: pointer;">&times;</button>
        </div>

        <!-- Filter Bar -->
        <div style="
          padding: 8px 14px;
          background: #1c1f26;
          border-bottom: 1px solid #3e4656;
          display: flex;
          align-items: center;
          gap: 12px;
        ">
          <div style="flex: 1; display: flex; align-items: center; gap: 6px; background: #232731; border: 1px solid #3e4656; border-radius: 4px; padding: 4px 8px;">
            <span style="color: #a0aec0; font-size: 12px;">🔍</span>
            <input type="text" id="symSearchInput" placeholder="Symbol suchen (z.B. Schütz, FI, Stromstoß, Taster, Motor)..." style="
              background: none;
              border: none;
              color: white;
              font-size: 12px;
              width: 100%;
              outline: none;
            " value="${escapeSvg(this.searchQuery)}">
          </div>
          <span style="font-size: 11px; color: #a0aec0;" id="symCountBadge">
            ${getSymbolDefinitions().length} Symbole verfügbar
          </span>
        </div>

        <!-- Main Body: 3-Column Layout (Tree | Grid | Details) -->
        <div style="flex: 1; display: flex; overflow: hidden;">
          <!-- Left Column: Category Tree -->
          <div style="
            width: 210px;
            background: #181b22;
            border-right: 1px solid #3e4656;
            padding: 10px;
            overflow-y: auto;
          ">
            <div style="font-size: 10px; font-weight: bold; color: #a0aec0; text-transform: uppercase; margin-bottom: 6px;">Bibliotheken</div>
            
            ${(this.kind === 'connections'
              ? [['all','Alle Verbindungselemente'],['interruptions','Abbruchstellen'],['tees','T-Stücke'],['corners','Winkel'],['crossings','Kreuzungen'],['other','Weitere'],['project','Projektbibliothek']]
              : [['all','Alle Elemente'],['project','Projektbibliothek'],...ELEMENT_CATEGORIES.map(c=>[c.id,c.label])])
              .map(([id,label])=>`<div class="sym-tree-node ${id===this.selectedCategory?'active':''}" data-cat="${id}" style="padding:6px;cursor:pointer;font-size:11px">${escapeSvg(label)}</div>`).join('')}

          </div>

          <!-- Middle Column: Symbol Cards Grid -->
          <div id="symGridContainer" style="
            flex: 1;
            padding: 12px;
            overflow-y: auto;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
            gap: 10px;
            align-content: flex-start;
          ">
            ${this.renderSymbolsGrid()}
          </div>

          <!-- Right Column: Detail & Pin Inspector -->
          <div id="symDetailsContainer" style="
            width: 250px;
            background: #181b22;
            border-left: 1px solid #3e4656;
            padding: 14px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
          ">
            ${this.renderSymbolDetails()}
          </div>
        </div>

        <!-- Footer Bar with OK / Cancel -->
        <div style="
          padding: 10px 16px;
          border-top: 1px solid #3e4656;
          background: #1c1f26;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <div style="font-size: 11px; color: #a0aec0;">
            Tipp: Mit <strong>Tab</strong> können Sie das Bauteil beim Platzieren drehen.
          </div>
          <div style="display: flex; gap: 8px;">
            <button id="btnInsertSym" class="btn btn-primary" style="padding: 6px 16px; font-size: 12px; font-weight: 600;">Einfügen (Enter)</button>
            <button id="btnCancelSym" class="btn" style="padding: 6px 14px; font-size: 12px;">Abbrechen (Esc)</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    this.bindEvents(modal);
    this.updateGrid(modal);
  }

  private getFilteredSymbols(): SymbolDefinition[] {
    return getSymbolDefinitions().filter(s => {
      if (s.annotationKind) return false;
      if (isConnectionSymbol(s) !== (this.kind === 'connections')) return false;
      const matchCat = this.selectedCategory === 'all' || this.kind === 'connections' && connectionFamily(s) === this.selectedCategory || s.category === this.selectedCategory
        || (this.selectedCategory === 'project' && !!s.source);
      const matchQuery = symbolMatchesQuery(s,this.searchQuery);
      return matchCat && matchQuery;
    });
  }

  private renderSymbolsGrid(): string {
    const list = this.getFilteredSymbols();
    if (list.length === 0) {
      return `
        <div style="grid-column: 1 / -1; padding: 40px 20px; text-align: center; color: #a0aec0;">
          Keine Symbole für diesen Suchbegriff gefunden.
        </div>
      `;
    }

    return list.map(sym => {
      const isSelected = sym.id === this.selectedSymbolId;
      return `
        <div class="sym-dialog-card ${isSelected ? 'selected' : ''}" data-sym-id="${sym.id}" style="
          background: #232731;
          border: 1px solid ${isSelected ? '#63b3ed' : '#3e4656'};
          border-radius: 4px;
          padding: 8px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          transition: all 0.12s ease;
          position: relative;
        ">
          <div style="
            width: 50px;
            height: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 6px;
          ">
            <svg width="44" height="44" viewBox="0 0 ${sym.width} ${sym.height}">
              <g color="#e2e8f0">${sym.svgContent}</g>
            </svg>
          </div>
          <div style="font-size: 11px; font-weight: 500; color: #edf2f7; line-height: 1.2;">${escapeSvg(sym.name)}</div>
          <div style="font-size: 9px; font-family: monospace; color: #f6e05e; margin-top: 4px;">BMK: ${sym.defaultBmkPrefix}</div>
        </div>
      `;
    }).join('');
  }

  private renderSymbolDetails(): string {
    const sym = getSymbolById(this.selectedSymbolId);
    if (!sym) return '<div>Kein Element ausgewählt.</div>';

    return `
      <div>
        <div style="font-size: 10px; font-weight: bold; color: #a0aec0; text-transform: uppercase; margin-bottom: 4px;">Vorschau</div>
        <div style="
          background: #1c212c;
          border: 1px solid #3e4656;
          border-radius: 4px;
          padding: 12px;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 80px;
        ">
          <svg width="60" height="60" viewBox="0 0 ${sym.width} ${sym.height}">
            <g color="#63b3ed">${sym.svgContent}</g>
          </svg>
        </div>
      </div>

      <div>
        <div style="font-size: 12px; font-weight: 600; color: #edf2f7;">${escapeSvg(sym.name)}</div>
        <div style="font-size: 11px; color: #a0aec0; margin-top: 2px;">${escapeSvg(sym.description)}</div>
      </div>

      <div style="border-top: 1px solid #2d3748; padding-top: 8px;">
        <div style="font-size: 10px; font-weight: bold; color: #a0aec0; text-transform: uppercase; margin-bottom: 4px;">Kenndaten</div>
        <div style="font-size: 11px; line-height: 1.6;">
          <div><strong style="color: #cbd5e0;">Norm:</strong> ${sym.standard}</div>
          <div><strong style="color: #cbd5e0;">Präfix:</strong> <code>${escapeSvg((sym.bmkPrefixes?.join(' / ') ?? sym.defaultBmkPrefix) || '–')}</code></div>
          <div><strong style="color: #cbd5e0;">Rastermaß:</strong> ${sym.width}x${sym.height}</div>
          <div><strong style="color: #cbd5e0;">Standardtext:</strong> ${escapeSvg(sym.defaultFunctionText)}</div>
          ${Object.entries(sym.variantProperties??{}).map(([key,value])=>`<div><strong style="color:#cbd5e0">${escapeSvg(key)}:</strong> ${escapeSvg(value)}</div>`).join('')}
          ${sym.family?'<div style="margin-top:6px;color:#a0aec0">Generische Vorlage · Kennwerte und BMK sind nach dem Einfügen editierbar.</div>':''}
        </div>
      </div>

      <div style="border-top: 1px solid #2d3748; padding-top: 8px;">
        <div style="font-size: 10px; font-weight: bold; color: #a0aec0; text-transform: uppercase; margin-bottom: 4px;">Anschlüsse (${sym.pins.length})</div>
        <div style="display: flex; flex-direction: column; gap: 4px;">
          ${sym.pins.map(p => `
            <div style="display: flex; justify-content: space-between; font-size: 10px; font-family: monospace; background: #232731; padding: 2px 6px; border-radius: 3px;">
              <span style="color: #63b3ed;">Pin ${p.name}</span>
              <span style="color: #a0aec0;">[${p.x}, ${p.y}] ${p.direction}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  private bindEvents(modal: HTMLElement): void {
    const closeModal = () => modal.remove();

    // Close buttons
    modal.querySelector('#btnCloseSymModal')?.addEventListener('click', closeModal);
    modal.querySelector('#btnCancelSym')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Search input
    const searchInput = modal.querySelector('#symSearchInput') as HTMLInputElement;
    searchInput?.addEventListener('input', () => {
      this.searchQuery = searchInput.value.trim();
      this.updateGrid(modal);
    });

    // Category tree nodes
    modal.querySelectorAll('.sym-tree-node').forEach(node => {
      node.addEventListener('click', (e) => {
        modal.querySelectorAll('.sym-tree-node').forEach(n => n.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        this.selectedCategory = target.dataset.cat || 'all';
        this.updateGrid(modal);
      });
    });

    // Insert on click or enter
    const insertSelected = () => {
      const sym = getSymbolById(this.selectedSymbolId);
      if (sym) {
        this.callbacks.onSelect(sym);
        closeModal();
      }
    };

    modal.querySelector('#btnInsertSym')?.addEventListener('click', insertSelected);

    // Keyboard navigation
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
        window.removeEventListener('keydown', keyHandler);
      } else if (e.key === 'Enter') {
        insertSelected();
        window.removeEventListener('keydown', keyHandler);
      }
    };
    window.addEventListener('keydown', keyHandler);

    this.bindCardClicks(modal, insertSelected);
  }

  private updateGrid(modal: HTMLElement): void {
    const filtered = this.getFilteredSymbols();
    if (!filtered.some(s => s.id === this.selectedSymbolId)) this.selectedSymbolId = filtered[0]?.id ?? '';
    const insert = modal.querySelector('#btnInsertSym') as HTMLButtonElement;
    if (insert) insert.disabled = !this.selectedSymbolId;
    const detail = modal.querySelector('#symDetailsContainer');
    if (detail) detail.innerHTML = this.renderSymbolDetails();
    const grid = modal.querySelector('#symGridContainer');
    if (grid) {
      grid.innerHTML = this.renderSymbolsGrid();
      this.bindCardClicks(modal, () => {
        const sym = getSymbolById(this.selectedSymbolId);
        if (sym) {
          this.callbacks.onSelect(sym);
          modal.remove();
        }
      });
    }

    const count = this.getFilteredSymbols().length;
    const badge = modal.querySelector('#symCountBadge');
    if (badge) badge.textContent = `${count} Symbole gefunden`;
  }

  private bindCardClicks(modal: HTMLElement, onDoubleSelect: () => void): void {
    modal.querySelectorAll('.sym-dialog-card').forEach(card => {
      card.addEventListener('click', (e) => {
        modal.querySelectorAll('.sym-dialog-card').forEach(c => (c as HTMLElement).style.borderColor = '#3e4656');
        const target = e.currentTarget as HTMLElement;
        target.style.borderColor = '#63b3ed';
        this.selectedSymbolId = target.dataset.symId!;
        const details = modal.querySelector('#symDetailsContainer');
        if (details) details.innerHTML = this.renderSymbolDetails();
      });

      card.addEventListener('dblclick', (e) => {
        this.selectedSymbolId = (e.currentTarget as HTMLElement).dataset.symId!;
        onDoubleSelect();
      });
    });
  }
}
