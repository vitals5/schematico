import type {Project} from '../../model/types';
import {
  automationData,
  controllerLabel,
  editAutomation,
  plcAddress,
  type PlcController,
  type PlcModule,
  type PlcChannel,
  type AutomationIssue,
  type AutomationEdit
} from '../../model/Automation';
import {ProjectIndex} from '../../model/ProjectIndex';
import {escapeSvg as esc} from '../../model/ImportedDrawing';
import {tr} from '../../i18n';
import {renderPlcRackVisualizer} from './PlcRackVisualizer';
import {renderPlcSignalMatrix} from './PlcSignalMatrix';
import {PLC_MODULE_TEMPLATES, calculateNextModulePlacement, instantiatePlcModuleTemplate} from './PlcQuickTemplates';

export interface PlcHardwareWorkspaceCallbacks {
  onUpdateProject: (p: Project) => void;
  onNavigate: (pageId: string, componentId: string) => void;
  onError: (e: unknown) => void;
}

export class PlcHardwareWorkspace {
  private selectedControllerId = '';
  private selectedRackId = '0';
  private selectedModuleId = '';
  private selectedChannelId = '';
  private searchQuery = '';
  private issuesOnly = false;
  private templateMenuOpen = false;
  private bindingModalChannelId?: string;

  constructor(
    private getProject: () => Project,
    private getIssues: () => AutomationIssue[],
    private getProjectIndex: () => ProjectIndex,
    private callbacks: PlcHardwareWorkspaceCallbacks
  ) {
    this.initDefaultSelection();
  }

  private initDefaultSelection() {
    const d = automationData(this.getProject());
    if (d.controllers.length && !this.selectedControllerId) {
      this.selectedControllerId = d.controllers[0].id;
    }
  }

  public render(): string {
    const project = this.getProject();
    const data = automationData(project);
    const issues = this.getIssues();
    const index = this.getProjectIndex();

    // Ensure selection is valid
    if (!data.controllers.some(c => c.id === this.selectedControllerId) && data.controllers.length) {
      this.selectedControllerId = data.controllers[0].id;
    }
    const controller = data.controllers.find(c => c.id === this.selectedControllerId);

    // Collect racks for current controller
    const modules = data.modules.filter(m => m.controllerId === this.selectedControllerId);
    const racks = [...new Set(['0', ...modules.map(m => m.rack || '0')])].sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));
    if (!racks.includes(this.selectedRackId)) {
      this.selectedRackId = racks[0] || '0';
    }

    // Filter channels for the Signal Matrix
    const query = this.searchQuery.trim().toLowerCase();
    const relevantModules = modules.filter(m => (m.rack || '0') === this.selectedRackId);
    const targetModuleIds = this.selectedModuleId
      ? [this.selectedModuleId]
      : relevantModules.map(m => m.id);

    let displayChannels = data.channels.filter(c => targetModuleIds.includes(c.moduleId));

    if (query) {
      const words = query.split(/\s+/).filter(Boolean);
      displayChannels = displayChannels.filter(c => {
        const mod = relevantModules.find(m => m.id === c.moduleId);
        const searchStr = `${c.address} ${c.symbolicName} ${c.signalText} ${c.number} ${c.dataType} ${mod?.bmk} ${mod?.description}`.toLowerCase();
        return words.every(w => searchStr.includes(w));
      });
    }

    if (this.issuesOnly) {
      const issueIds = new Set(issues.filter(i => i.entity === 'channels').map(i => i.recordId));
      displayChannels = displayChannels.filter(c => issueIds.has(c.id));
    }

    // Sort channels
    displayChannels.sort((a, b) => {
      const modA = relevantModules.find(m => m.id === a.moduleId);
      const modB = relevantModules.find(m => m.id === b.moduleId);
      const slotA = parseInt(modA?.slot || '0', 10);
      const slotB = parseInt(modB?.slot || '0', 10);
      if (slotA !== slotB) return slotA - slotB;
      const numA = parseInt(a.number, 10);
      const numB = parseInt(b.number, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.number.localeCompare(b.number);
    });

    return `
      <div class="plc-hw-workspace">
        <!-- Linke Navigationsspalte: Steuerungen & Racks -->
        <aside class="plc-hw-nav">
          <div class="plc-hw-nav-header">
            <h4>${esc(tr('Steuerungen & Racks', 'Controllers & Racks'))}</h4>
            <button class="btn btn-xs btn-primary" data-hw-action="new-controller" title="${esc(tr('Neue Steuerung / CPU anlegen', 'New Controller / CPU'))}">
              + ${esc(tr('CPU', 'CPU'))}
            </button>
          </div>
          <div class="plc-hw-tree">
            ${this.renderTree(data, issues)}
          </div>
        </aside>

        <!-- Hauptbereich: Baugruppenträger + Signalmatrix -->
        <section class="plc-hw-center">
          <div class="plc-hw-toolbar">
            <div class="plc-hw-toolbar-title">
              <h3>${esc(controller ? controllerLabel(controller) : tr('Keine Steuerung', 'No Controller'))}</h3>
              <span class="plc-rack-badge">Rack ${esc(this.selectedRackId)}</span>
            </div>

            <div class="plc-hw-toolbar-actions">
              <input class="form-input plc-hw-search" 
                     type="search" 
                     placeholder="${esc(tr('Kanäle suchen (Adresse, Name, BMK)…', 'Search channels (address, name, DT)…'))}" 
                     value="${esc(this.searchQuery)}" 
                     data-hw-filter="search">
              
              <label class="eng-check">
                <input type="checkbox" data-hw-filter="issues" ${this.issuesOnly ? 'checked' : ''}>
                ${esc(tr('Nur Hinweise', 'Only warnings'))}
              </label>

              <!-- Schnell-Vorlagen Dropdown-Button -->
              <div class="plc-template-dropdown-wrap">
                <button class="btn btn-primary plc-btn-template-toggle" data-hw-action="toggle-templates">
                  + ${esc(tr('Baugruppe', 'Module'))} ▾
                </button>
                <div class="plc-template-dropdown-menu ${this.templateMenuOpen ? 'is-open' : ''}">
                  <div class="plc-template-dropdown-header">${esc(tr('1-Klick-Modulvorlagen', '1-Click Module Presets'))}</div>
                  ${PLC_MODULE_TEMPLATES.map(tmpl => `
                    <button class="plc-template-item" data-template-id="${esc(tmpl.id)}">
                      <strong>${esc(tmpl.name)}</strong>
                      <small>${esc(tmpl.description)}</small>
                    </button>
                  `).join('')}
                  <div class="plc-template-divider"></div>
                  <button class="plc-template-item" data-hw-action="new-custom-module">
                    <strong>${esc(tr('Benutzerdefiniert…', 'Custom Module…'))}</strong>
                    <small>${esc(tr('Leere Baugruppe ohne Vorlage', 'Empty module without preset'))}</small>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Baugruppenträger (DIN-Rail) Visualisierung -->
          <div class="plc-hw-rack-view">
            ${renderPlcRackVisualizer({
              project,
              controllerId: this.selectedControllerId,
              rackId: this.selectedRackId,
              selectedModuleId: this.selectedModuleId,
              selectedChannelId: this.selectedChannelId,
              issues,
            })}
          </div>

          <!-- E/A-Signalmatrix -->
          <div class="plc-hw-matrix-wrap">
            <div class="plc-hw-matrix-header">
              <h4>${esc(tr('E/A-Signalmatrix & Schaltplan-Zuordnung', 'I/O Signal Matrix & Schematic Assignment'))}</h4>
              <span class="plc-hw-matrix-count">${displayChannels.length} ${esc(tr('Kanäle', 'Channels'))}</span>
              ${this.selectedModuleId ? `
                <button class="btn btn-xs btn-outline" data-hw-action="add-channel-to-module">
                  + ${esc(tr('Kanal hinzufügen', 'Add Channel'))}
                </button>
                <button class="btn btn-xs" data-hw-action="clear-module-filter">
                  ${esc(tr('Alle Baugruppen anzeigen', 'Show all modules'))}
                </button>
              ` : ''}
            </div>
            ${renderPlcSignalMatrix({
              project,
              channels: displayChannels,
              modules: relevantModules,
              issues,
              selectedChannelId: this.selectedChannelId,
              projectIndex: index,
            })}
          </div>
        </section>

        <!-- Rechte Schnell-Inspektor-Spalte -->
        <aside class="plc-hw-inspector">
          <header class="plc-inspector-header">
            <h4>${esc(tr('Eigenschaften & Details', 'Properties & Details'))}</h4>
          </header>
          <div class="plc-inspector-body">
            ${this.renderInspector(data, index, issues)}
          </div>
        </aside>

        <!-- Pin-Verknüpfungs-Modal (wenn aktiv) -->
        ${this.renderBindingModal(project, index)}
      </div>
    `;
  }

  private renderTree(data: ReturnType<typeof automationData>, issues: AutomationIssue[]): string {
    if (!data.controllers.length) {
      return `<p class="auto-muted" style="padding:10px">${esc(tr('Noch keine Steuerungen vorhanden.', 'No controllers created yet.'))}</p>`;
    }

    return data.controllers.map(c => {
      const isSelectedCpu = this.selectedControllerId === c.id;
      const cIssues = issues.filter(i => i.entity === 'controllers' && i.recordId === c.id);
      const cModules = data.modules.filter(m => m.controllerId === c.id);
      const cRacks = [...new Set(['0', ...cModules.map(m => m.rack || '0')])].sort((a, b) =>
        a.localeCompare(b, undefined, {numeric: true})
      );

      return `
        <div class="plc-tree-controller ${isSelectedCpu ? 'is-active-cpu' : ''}">
          <div class="plc-tree-item plc-tree-cpu" data-tree-select-cpu="${esc(c.id)}">
            <span class="plc-tree-icon">⚡</span>
            <span class="plc-tree-label"><strong>${esc(c.bmk)}</strong> <small>${esc(c.plant || '')} ${esc(c.location || '')}</small></span>
            ${cIssues.length ? `<span class="auto-nav-alert" title="${esc(cIssues.map(i => i.message).join('; '))}"></span>` : ''}
          </div>
          
          <div class="plc-tree-racks">
            ${cRacks.map(rack => {
              const isRackActive = isSelectedCpu && this.selectedRackId === rack;
              const rackMods = cModules.filter(m => (m.rack || '0') === rack);

              return `
                <div class="plc-tree-rack ${isRackActive ? 'is-active-rack' : ''}">
                  <div class="plc-tree-item plc-tree-rack-head" data-tree-select-rack="${esc(c.id)}" data-rack-val="${esc(rack)}">
                    <span class="plc-tree-rack-icon">▤</span>
                    <span class="plc-tree-label">Rack ${esc(rack)}</span>
                    <span class="plc-tree-count">${rackMods.length}</span>
                  </div>

                  <div class="plc-tree-modules">
                    ${rackMods.map(m => {
                      const isModActive = this.selectedModuleId === m.id;
                      const mIssues = issues.filter(i => i.entity === 'modules' && i.recordId === m.id);
                      return `
                        <div class="plc-tree-item plc-tree-module ${isModActive ? 'is-active-mod' : ''}" 
                             data-tree-select-mod="${esc(m.id)}">
                          <span class="plc-slot-bullet">${esc(m.slot)}</span>
                          <span class="plc-tree-label">${esc(m.bmk)}</span>
                          ${mIssues.length ? `<span class="auto-nav-alert" title="${esc(mIssues.map(i => i.message).join('; '))}"></span>` : ''}
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  private renderInspector(data: ReturnType<typeof automationData>, index: ProjectIndex, issues: AutomationIssue[]): string {
    // 1. Channel Selected
    if (this.selectedChannelId) {
      const channel = data.channels.find(c => c.id === this.selectedChannelId);
      if (channel) {
        const mod = data.modules.find(m => m.id === channel.moduleId);
        const chIssues = issues.filter(i => i.entity === 'channels' && i.recordId === channel.id);

        return `
          <div class="plc-inspector-section">
            <div class="plc-inspector-title">
              <span class="plc-kind-badge kind-${channel.kind.toLowerCase()}">${esc(channel.kind)}</span>
              <strong>${esc(tr('Kanal', 'Channel'))} ${esc(channel.number)}</strong>
              <small>${esc(mod?.bmk || '')} (Slot ${esc(mod?.slot || '?')})</small>
            </div>

            ${chIssues.map(i => `<div class="plc-inspector-alert">⚠ ${esc(i.message)}</div>`).join('')}

            <div class="plc-form-group">
              <label>${esc(tr('E/A-Adresse', 'I/O Address'))}</label>
              <input class="form-input font-mono" type="text" data-inspect-field="address" value="${esc(channel.address || '')}">
            </div>

            <div class="plc-form-group">
              <label>${esc(tr('Symbolischer Name', 'Symbolic Name'))}</label>
              <input class="form-input" type="text" data-inspect-field="symbolicName" value="${esc(channel.symbolicName || '')}">
            </div>

            <div class="plc-form-group">
              <label>${esc(tr('Signaltext', 'Signal Text'))}</label>
              <textarea class="form-input" rows="2" data-inspect-field="signalText">${esc(channel.signalText || '')}</textarea>
            </div>

            <div class="plc-form-group-row">
              <div class="plc-form-group">
                <label>${esc(tr('Datentyp', 'Data Type'))}</label>
                <input class="form-input font-mono" type="text" data-inspect-field="dataType" value="${esc(channel.dataType || '')}">
              </div>
              <div class="plc-form-group">
                <label>${esc(tr('Kanalart', 'Channel Kind'))}</label>
                <select class="form-input" data-inspect-field="kind">
                  <option value="DI" ${channel.kind === 'DI' ? 'selected' : ''}>DI (Digital In)</option>
                  <option value="DO" ${channel.kind === 'DO' ? 'selected' : ''}>DO (Digital Out)</option>
                  <option value="AI" ${channel.kind === 'AI' ? 'selected' : ''}>AI (Analog In)</option>
                  <option value="AO" ${channel.kind === 'AO' ? 'selected' : ''}>AO (Analog Out)</option>
                </select>
              </div>
            </div>

            <div class="plc-form-group">
              <label class="eng-check">
                <input type="checkbox" data-inspect-field="reserve" ${channel.reserve ? 'checked' : ''}>
                ${esc(tr('Als Reserve / unbeschaltet kennzeichnen', 'Mark as spare / unassigned'))}
              </label>
            </div>

            <hr class="plc-inspector-divider">

            <h5>${esc(tr('Schaltplan-Anschlüsse', 'Schematic Pins'))}</h5>
            
            <div class="plc-binding-item">
              <span class="plc-binding-role-label">${esc(tr('Signal-Anschluss', 'Signal Pin'))}:</span>
              <div class="plc-binding-current">
                ${channel.signal ? esc(index.component(channel.signal.componentId, channel.signal.pageId)?.component.bmk + ' : ' + (channel.signal.pinId || '')) : esc(tr('Nicht verknüpft', 'Unlinked'))}
              </div>
              <button class="btn btn-xs btn-outline" data-hw-action="open-binding-modal" data-binding-channel="${esc(channel.id)}">
                ${channel.signal ? esc(tr('Ändern…', 'Change…')) : esc(tr('Verknüpfen…', 'Link…'))}
              </button>
            </div>

            <div class="plc-inspector-actions">
              <button class="btn btn-sm btn-primary" data-hw-action="save-inspector-channel">${esc(tr('Speichern', 'Save'))}</button>
              <button class="btn btn-sm btn-outline" data-hw-action="delete-selected-channel">${esc(tr('Löschen', 'Delete'))}</button>
            </div>
          </div>
        `;
      }
    }

    // 2. Module Selected
    if (this.selectedModuleId) {
      const module = data.modules.find(m => m.id === this.selectedModuleId);
      if (module) {
        const mChannels = data.channels.filter(c => c.moduleId === module.id);
        const mIssues = issues.filter(i => i.entity === 'modules' && i.recordId === module.id);

        return `
          <div class="plc-inspector-section">
            <div class="plc-inspector-title">
              <strong>${esc(module.bmk)}</strong>
              <small>${esc(module.description || tr('Baugruppe', 'Module'))}</small>
            </div>

            ${mIssues.map(i => `<div class="plc-inspector-alert">⚠ ${esc(i.message)}</div>`).join('')}

            <div class="plc-form-group">
              <label>${esc(tr('Baugruppen-BMK', 'Module DT'))}</label>
              <input class="form-input" type="text" data-inspect-field="moduleBmk" value="${esc(module.bmk)}">
            </div>

            <div class="plc-form-group">
              <label>${esc(tr('Beschreibung / Typ', 'Description / Type'))}</label>
              <input class="form-input" type="text" data-inspect-field="moduleDescription" value="${esc(module.description || '')}">
            </div>

            <div class="plc-form-group-row">
              <div class="plc-form-group">
                <label>Rack</label>
                <input class="form-input" type="text" data-inspect-field="moduleRack" value="${esc(module.rack || '0')}">
              </div>
              <div class="plc-form-group">
                <label>${esc(tr('Steckplatz (Slot)', 'Slot'))}</label>
                <input class="form-input" type="text" data-inspect-field="moduleSlot" value="${esc(module.slot || '1')}">
              </div>
            </div>

            <div class="plc-inspector-stats">
              <span>${mChannels.length} ${esc(tr('Kanäle angelegt', 'Channels created'))}</span>
            </div>

            <div class="plc-inspector-actions">
              <button class="btn btn-sm btn-primary" data-hw-action="save-inspector-module">${esc(tr('Speichern', 'Save'))}</button>
              <button class="btn btn-sm btn-outline" data-hw-action="delete-selected-module">${esc(tr('Baugruppe löschen', 'Delete Module'))}</button>
            </div>
          </div>
        `;
      }
    }

    // 3. Controller Selected
    const controller = data.controllers.find(c => c.id === this.selectedControllerId);
    if (controller) {
      const cIssues = issues.filter(i => i.entity === 'controllers' && i.recordId === controller.id);
      const cMods = data.modules.filter(m => m.controllerId === controller.id);
      const cChans = data.channels.filter(c => cMods.some(m => m.id === c.moduleId));

      return `
        <div class="plc-inspector-section">
          <div class="plc-inspector-title">
            <strong>${esc(controller.bmk)}</strong>
            <small>${esc(tr('Zentralbaugruppe (CPU)', 'Central Processing Unit'))}</small>
          </div>

          ${cIssues.map(i => `<div class="plc-inspector-alert">⚠ ${esc(i.message)}</div>`).join('')}

          <div class="plc-form-group">
            <label>${esc(tr('CPU-BMK', 'CPU DT'))}</label>
            <input class="form-input" type="text" data-inspect-field="cpuBmk" value="${esc(controller.bmk)}">
          </div>

          <div class="plc-form-group">
            <label>${esc(tr('Beschreibung / Typ', 'Description / Type'))}</label>
            <input class="form-input" type="text" data-inspect-field="cpuDescription" value="${esc(controller.description || '')}">
          </div>

          <div class="plc-form-group-row">
            <div class="plc-form-group">
              <label>${esc(tr('Anlage', 'Plant'))}</label>
              <input class="form-input" type="text" data-inspect-field="cpuPlant" value="${esc(controller.plant || '')}">
            </div>
            <div class="plc-form-group">
              <label>${esc(tr('Ort', 'Location'))}</label>
              <input class="form-input" type="text" data-inspect-field="cpuLocation" value="${esc(controller.location || '')}">
            </div>
          </div>

          <div class="plc-inspector-stats">
            <div>${cMods.length} ${esc(tr('Baugruppen', 'Modules'))}</div>
            <div>${cChans.length} ${esc(tr('E/A-Kanäle gesamt', 'Total I/O Channels'))}</div>
          </div>

          <div class="plc-inspector-actions">
            <button class="btn btn-sm btn-primary" data-hw-action="save-inspector-cpu">${esc(tr('Speichern', 'Save'))}</button>
            <button class="btn btn-sm btn-outline" data-hw-action="delete-selected-cpu">${esc(tr('CPU löschen', 'Delete CPU'))}</button>
          </div>
        </div>
      `;
    }

    return `<p class="auto-muted" style="padding:15px">${esc(tr('Wählen Sie ein Element aus.', 'Select an element.'))}</p>`;
  }

  private renderBindingModal(project: Project, index: ProjectIndex): string {
    if (!this.bindingModalChannelId) return '';
    const d = automationData(project);
    const channel = d.channels.find(c => c.id === this.bindingModalChannelId);
    if (!channel) return '';

    return `
      <div class="modal-backdrop plc-binding-modal-backdrop" data-hw-action="close-binding-modal">
        <div class="plc-binding-modal">
          <header class="plc-binding-modal-header">
            <h4>${esc(tr('Schaltplan-Pin zuordnen', 'Assign Schematic Pin'))}</h4>
            <button class="btn-close" data-hw-action="close-binding-modal">×</button>
          </header>
          <div class="plc-binding-modal-body">
            <p>${esc(tr('Kanal:', 'Channel:'))} <strong>${esc(channel.number)} · ${esc(channel.address || '')} (${esc(channel.signalText || channel.symbolicName || channel.kind)})</strong></p>
            
            <div class="plc-form-group">
              <label>${esc(tr('Schaltplanblatt', 'Schematic Sheet'))}</label>
              <select class="form-input" data-bind-select="page">
                ${project.pages.map(p => `
                  <option value="${esc(p.id)}" ${channel.signal?.pageId === p.id ? 'selected' : ''}>
                    ${esc(p.pageNumber + ' · ' + p.title)}
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="plc-form-group">
              <label>${esc(tr('Bauteil / Sensor / Aktor', 'Component / Sensor / Actuator'))}</label>
              <select class="form-input" data-bind-select="component">
                <!-- Filled dynamically in bind() -->
              </select>
            </div>

            <div class="plc-form-group">
              <label>${esc(tr('Anschluss-Pin', 'Terminal Pin'))}</label>
              <select class="form-input" data-bind-select="pin">
                <!-- Filled dynamically in bind() -->
              </select>
            </div>
          </div>
          <footer class="plc-binding-modal-footer">
            <button class="btn btn-outline" data-hw-action="close-binding-modal">${esc(tr('Abbrechen', 'Cancel'))}</button>
            <button class="btn btn-primary" data-hw-action="apply-binding-modal">${esc(tr('Verknüpfen', 'Link Pin'))}</button>
          </footer>
        </div>
      </div>
    `;
  }

  public bind(root: HTMLElement) {
    // 1. Template Menu Toggle
    const templateWrap = root.querySelector('.plc-template-dropdown-wrap');
    root.onclick = e => {
      const target = e.target as HTMLElement;

      // Close template menu if clicked outside
      if (!target.closest('.plc-template-dropdown-wrap') && this.templateMenuOpen) {
        this.templateMenuOpen = false;
        root.querySelector('.plc-template-dropdown-menu')?.classList.remove('is-open');
      }

      // Template dropdown toggle
      if (target.closest('[data-hw-action="toggle-templates"]')) {
        this.templateMenuOpen = !this.templateMenuOpen;
        root.querySelector('.plc-template-dropdown-menu')?.classList.toggle('is-open', this.templateMenuOpen);
        return;
      }

      // Template selection
      const templateBtn = target.closest<HTMLElement>('[data-template-id]');
      if (templateBtn) {
        const tmplId = templateBtn.dataset.templateId!;
        const tmpl = PLC_MODULE_TEMPLATES.find(t => t.id === tmplId);
        if (tmpl) {
          this.applyModuleTemplate(tmpl);
        }
        return;
      }

      // Custom module creation
      if (target.closest('[data-hw-action="new-custom-module"]')) {
        this.createCustomModule();
        return;
      }

      // Tree CPU selection
      const treeCpu = target.closest<HTMLElement>('[data-tree-select-cpu]');
      if (treeCpu) {
        this.selectedControllerId = treeCpu.dataset.treeSelectCpu!;
        this.selectedModuleId = '';
        this.selectedChannelId = '';
        this.callbacks.onUpdateProject(this.getProject());
        return;
      }

      // Tree Rack selection
      const treeRack = target.closest<HTMLElement>('[data-tree-select-rack]');
      if (treeRack) {
        this.selectedControllerId = treeRack.dataset.treeSelectRack!;
        this.selectedRackId = treeRack.dataset.rackVal!;
        this.selectedModuleId = '';
        this.selectedChannelId = '';
        this.callbacks.onUpdateProject(this.getProject());
        return;
      }

      // Tree Module selection
      const treeMod = target.closest<HTMLElement>('[data-tree-select-mod]');
      if (treeMod) {
        const modId = treeMod.dataset.treeSelectMod!;
        this.selectModule(modId);
        return;
      }

      // Rack Visualizer - Controller Card click
      const selectController = target.closest<HTMLElement>('[data-select-controller]');
      if (selectController) {
        this.selectedControllerId = selectController.dataset.selectController!;
        this.selectedModuleId = '';
        this.selectedChannelId = '';
        this.callbacks.onUpdateProject(this.getProject());
        return;
      }

      // Rack Visualizer - Pin Dot click (check BEFORE module card so pin LED clicks aren't swallowed)
      const selectChannel = target.closest<HTMLElement>('[data-select-channel]');
      if (selectChannel) {
        const chanId = selectChannel.dataset.selectChannel!;
        this.selectChannel(chanId);
        return;
      }

      // Rack Visualizer - Module Card click
      const selectModule = target.closest<HTMLElement>('[data-select-module]');
      if (selectModule) {
        const modId = selectModule.dataset.selectModule!;
        this.selectModule(modId);
        return;
      }

      // Rack Visualizer - Add Module prompt slot
      const addPrompt = target.closest<HTMLElement>('[data-add-module-prompt]');
      if (addPrompt) {
        this.templateMenuOpen = true;
        root.querySelector('.plc-template-dropdown-menu')?.classList.add('is-open');
        root.querySelector('.plc-template-dropdown-wrap')?.scrollIntoView({block: 'nearest'});
        return;
      }

      // Signal Matrix Row click
      const channelRow = target.closest<HTMLElement>('[data-channel-row]');
      if (channelRow && !target.closest('input, button, select')) {
        this.selectChannel(channelRow.dataset.channelRow!);
        return;
      }

      // Signal Matrix - Jump to Drawing
      const jumpBtn = target.closest<HTMLElement>('[data-jump-drawing]');
      if (jumpBtn) {
        const chId = jumpBtn.dataset.jumpDrawing!;
        const d = automationData(this.getProject());
        const ch = d.channels.find(c => c.id === chId);
        if (ch?.signal) {
          this.callbacks.onNavigate(ch.signal.pageId, ch.signal.componentId);
        }
        return;
      }

      // Signal Matrix - Unbind Channel
      const unbindBtn = target.closest<HTMLElement>('[data-unbind-channel]');
      if (unbindBtn) {
        const chId = unbindBtn.dataset.unbindChannel!;
        this.unbindChannel(chId);
        return;
      }

      // Signal Matrix - Bind Channel Button
      const bindBtn = target.closest<HTMLElement>('[data-bind-channel]');
      if (bindBtn) {
        this.bindingModalChannelId = bindBtn.dataset.bindChannel!;
        this.callbacks.onUpdateProject(this.getProject());
        return;
      }

      // Open binding modal from inspector
      const openBindModal = target.closest<HTMLElement>('[data-hw-action="open-binding-modal"]');
      if (openBindModal) {
        this.bindingModalChannelId = openBindModal.dataset.bindingChannel!;
        this.callbacks.onUpdateProject(this.getProject());
        return;
      }

      // Close binding modal
      if (
        target.closest('button[data-hw-action="close-binding-modal"]') ||
        target.classList.contains('plc-binding-modal-backdrop')
      ) {
        this.bindingModalChannelId = undefined;
        this.callbacks.onUpdateProject(this.getProject());
        return;
      }

      // Apply binding modal
      if (target.closest('[data-hw-action="apply-binding-modal"]')) {
        this.applyBindingModal(root);
        return;
      }

      // Signal Matrix - Inspect Channel Button
      const inspectBtn = target.closest<HTMLElement>('[data-inspect-channel]');
      if (inspectBtn) {
        this.selectChannel(inspectBtn.dataset.inspectChannel!);
        return;
      }

      // Signal Matrix - Delete Channel Button
      const deleteChBtn = target.closest<HTMLElement>('[data-delete-channel]');
      if (deleteChBtn) {
        this.deleteChannel(deleteChBtn.dataset.deleteChannel!);
        return;
      }

      // Clear Module Filter
      if (target.closest('[data-hw-action="clear-module-filter"]')) {
        this.selectedModuleId = '';
        this.callbacks.onUpdateProject(this.getProject());
        return;
      }

      // Add Channel to Module
      if (target.closest('[data-hw-action="add-channel-to-module"]')) {
        this.addChannelToSelectedModule();
        return;
      }

      // New Controller Action
      if (target.closest('[data-hw-action="new-controller"]')) {
        this.createController();
        return;
      }

      // Save Inspector Actions
      if (target.closest('[data-hw-action="save-inspector-channel"]')) {
        this.saveInspectorChannel(root);
        return;
      }
      if (target.closest('[data-hw-action="save-inspector-module"]')) {
        this.saveInspectorModule(root);
        return;
      }
      if (target.closest('[data-hw-action="save-inspector-cpu"]')) {
        this.saveInspectorCpu(root);
        return;
      }

      // Delete Inspector Actions
      if (target.closest('[data-hw-action="delete-selected-channel"]')) {
        if (this.selectedChannelId) this.deleteChannel(this.selectedChannelId);
        return;
      }
      if (target.closest('[data-hw-action="delete-selected-module"]')) {
        if (this.selectedModuleId) this.deleteModule(this.selectedModuleId);
        return;
      }
      if (target.closest('[data-hw-action="delete-selected-cpu"]')) {
        if (this.selectedControllerId) this.deleteController(this.selectedControllerId);
        return;
      }
    };

    // Filter events
    const searchInput = root.querySelector<HTMLInputElement>('[data-hw-filter="search"]');
    if (searchInput) {
      searchInput.oninput = () => {
        this.searchQuery = searchInput.value;
        this.callbacks.onUpdateProject(this.getProject());
      };
    }

    const issuesCheck = root.querySelector<HTMLInputElement>('[data-hw-filter="issues"]');
    if (issuesCheck) {
      issuesCheck.onchange = () => {
        this.issuesOnly = issuesCheck.checked;
        this.callbacks.onUpdateProject(this.getProject());
      };
    }

    // In-place edits in Signal Matrix
    root.onchange = e => {
      const target = e.target as HTMLInputElement;
      if (target.hasAttribute('data-inplace-channel')) {
        const chId = target.dataset.inplaceChannel!;
        const field = target.dataset.inplaceField!;
        const value = target.type === 'checkbox' ? target.checked : target.value;
        this.updateChannelField(chId, field, value);
      }
    };

    // Binding modal dynamic selects setup
    this.setupBindingModalSelects(root);
  }

  private setupBindingModalSelects(root: HTMLElement) {
    if (!this.bindingModalChannelId) return;
    const pageSelect = root.querySelector<HTMLSelectElement>('[data-bind-select="page"]');
    const compSelect = root.querySelector<HTMLSelectElement>('[data-bind-select="component"]');
    const pinSelect = root.querySelector<HTMLSelectElement>('[data-bind-select="pin"]');
    if (!pageSelect || !compSelect || !pinSelect) return;

    const index = this.getProjectIndex();
    const project = this.getProject();
    const d = automationData(project);
    const channel = d.channels.find(c => c.id === this.bindingModalChannelId);

    const updatePins = () => {
      const comp = index.component(compSelect.value, pageSelect.value);
      if (!comp) {
        pinSelect.innerHTML = `<option value="">${esc(tr('Keine Anschlüsse', 'No pins'))}</option>`;
        return;
      }
      const pins = index.pinsFor(comp).filter(p => p.definition);
      pinSelect.innerHTML = pins.map(p => `
        <option value="${esc(p.id)}" ${channel?.signal?.pinId === p.id ? 'selected' : ''}>
          ${esc(p.label + ' [' + p.id + ']')}
        </option>
      `).join('') || `<option value="">${esc(tr('Standardanschluss', 'Default Pin'))}</option>`;
    };

    const updateComponents = () => {
      const pageId = pageSelect.value;
      const comps = index.components.filter(c => c.page.id === pageId);
      compSelect.innerHTML = comps.map(c => `
        <option value="${esc(c.component.id)}" ${channel?.signal?.componentId === c.component.id ? 'selected' : ''}>
          ${esc(c.component.bmk + ' · ' + (c.symbol?.name || c.component.id))}
        </option>
      `).join('') || `<option value="">${esc(tr('Keine Bauteile auf diesem Blatt', 'No components on sheet'))}</option>`;
      updatePins();
    };

    pageSelect.onchange = updateComponents;
    compSelect.onchange = updatePins;
    updateComponents();
  }

  private applyBindingModal(root: HTMLElement) {
    if (!this.bindingModalChannelId) return;
    const pageSelect = root.querySelector<HTMLSelectElement>('[data-bind-select="page"]');
    const compSelect = root.querySelector<HTMLSelectElement>('[data-bind-select="component"]');
    const pinSelect = root.querySelector<HTMLSelectElement>('[data-bind-select="pin"]');
    if (!pageSelect || !compSelect) return;

    const pageId = pageSelect.value;
    const componentId = compSelect.value;
    const pinId = pinSelect?.value || '';

    if (!pageId || !componentId || !pinId) {
      this.callbacks.onError(new Error(tr('Bitte ein Blatt, ein Bauteil und einen Anschluss-Pin auswählen.', 'Please select sheet, component, and terminal pin.')));
      return;
    }

    const d = automationData(this.getProject());
    const channel = d.channels.find(c => c.id === this.bindingModalChannelId);
    if (!channel) return;

    const updated: PlcChannel = {
      ...channel,
      signal: {pageId, componentId, pinId},
    };

    try {
      const nextProject = editAutomation(this.getProject(), {
        kind: 'save',
        entity: 'channels',
        value: updated,
      });
      this.bindingModalChannelId = undefined;
      this.callbacks.onUpdateProject(nextProject);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private selectModule(moduleId: string) {
    this.selectedModuleId = moduleId;
    this.selectedChannelId = '';
    const d = automationData(this.getProject());
    const mod = d.modules.find(m => m.id === moduleId);
    if (mod) {
      this.selectedControllerId = mod.controllerId;
      this.selectedRackId = mod.rack || '0';
    }
    this.callbacks.onUpdateProject(this.getProject());
  }

  private selectChannel(channelId: string) {
    this.selectedChannelId = channelId;
    const d = automationData(this.getProject());
    const ch = d.channels.find(c => c.id === channelId);
    if (ch) {
      this.selectedModuleId = ch.moduleId;
      const mod = d.modules.find(m => m.id === ch.moduleId);
      if (mod) {
        this.selectedControllerId = mod.controllerId;
        this.selectedRackId = mod.rack || '0';
      }
    }
    this.callbacks.onUpdateProject(this.getProject());
  }

  private applyModuleTemplate(template: any) {
    this.templateMenuOpen = false;
    const project = this.getProject();
    if (!this.selectedControllerId) {
      this.callbacks.onError(new Error(tr('Zuerst eine Steuerung anlegen.', 'Create a controller first.')));
      return;
    }

    try {
      const {module, channels} = instantiatePlcModuleTemplate(
        project,
        template,
        this.selectedControllerId,
        this.selectedRackId
      );

      // Save module
      let nextProject = editAutomation(project, {
        kind: 'save',
        entity: 'modules',
        value: module,
      });

      // Save channels
      for (const ch of channels) {
        nextProject = editAutomation(nextProject, {
          kind: 'save',
          entity: 'channels',
          value: ch,
        });
      }

      this.selectedModuleId = module.id;
      this.callbacks.onUpdateProject(nextProject);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private createCustomModule() {
    this.templateMenuOpen = false;
    const project = this.getProject();
    if (!this.selectedControllerId) {
      this.callbacks.onError(new Error(tr('Zuerst eine Steuerung anlegen.', 'Create a controller first.')));
      return;
    }

    const {nextSlot, nextBmk} = calculateNextModulePlacement(project, this.selectedControllerId, this.selectedRackId);

    const newModule: PlcModule = {
      id: crypto.randomUUID(),
      controllerId: this.selectedControllerId,
      rack: this.selectedRackId,
      slot: nextSlot,
      bmk: nextBmk,
      description: tr('Baugruppe', 'Module'),
    };

    try {
      const nextProject = editAutomation(project, {
        kind: 'save',
        entity: 'modules',
        value: newModule,
      });
      this.selectedModuleId = newModule.id;
      this.callbacks.onUpdateProject(nextProject);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private addChannelToSelectedModule() {
    if (!this.selectedModuleId) return;
    const project = this.getProject();
    const d = automationData(project);
    const mod = d.modules.find(m => m.id === this.selectedModuleId);
    if (!mod) return;

    const modChannels = d.channels.filter(c => c.moduleId === this.selectedModuleId);
    const kindCount: Record<'DI' | 'DO' | 'AI' | 'AO', number> = {DI: 0, DO: 0, AI: 0, AO: 0};
    for (const ch of modChannels) {
      if (ch.kind in kindCount) kindCount[ch.kind]++;
    }
    let kind: 'DI' | 'DO' | 'AI' | 'AO' = 'DI';
    let maxCount = 0;
    for (const k of ['DI', 'DO', 'AI', 'AO'] as const) {
      if (kindCount[k] > maxCount) {
        maxCount = kindCount[k];
        kind = k;
      }
    }

    let chNum = 1;
    while (modChannels.some(c => c.kind === kind && c.number === String(chNum))) chNum++;
    const nextNum = String(chNum);

    const area: 'I' | 'Q' = kind === 'DI' || kind === 'AI' ? 'I' : 'Q';
    const cpuModuleIds = new Set(d.modules.filter(m => m.controllerId === mod.controllerId).map(m => m.id));
    const existingRanges = d.channels
      .filter(c => cpuModuleIds.has(c.moduleId))
      .map(c => plcAddress(c.address))
      .filter((a): a is NonNullable<ReturnType<typeof plcAddress>> => !!a && a.area === area);

    const overlaps = (start: number, end: number) =>
      existingRanges.some(r => start < r.end && end > r.start);

    let address: string;
    if (kind === 'AI' || kind === 'AO') {
      let byte = 64;
      while (overlaps(byte * 8, byte * 8 + 16)) byte += 2;
      address = `%${area}W${byte}`;
    } else {
      let bitIndex = 0;
      while (overlaps(bitIndex, bitIndex + 1)) bitIndex++;
      address = `%${area}${Math.floor(bitIndex / 8)}.${bitIndex % 8}`;
    }

    const newChannel: PlcChannel = {
      id: crypto.randomUUID(),
      moduleId: this.selectedModuleId,
      number: nextNum,
      kind,
      address,
      signalText: `${tr('Signal', 'Signal')} ${nextNum}`,
      dataType: kind === 'AI' || kind === 'AO' ? 'INT' : 'BOOL',
      reserve: false,
    };

    try {
      const nextProject = editAutomation(project, {
        kind: 'save',
        entity: 'channels',
        value: newChannel,
      });
      this.selectedChannelId = newChannel.id;
      this.callbacks.onUpdateProject(nextProject);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private createController() {
    const project = this.getProject();
    const d = automationData(project);
    let num = 1;
    while (d.controllers.some(c => c.bmk === `-KF${num}`)) num++;
    const newCpu: PlcController = {
      id: crypto.randomUUID(),
      bmk: `-KF${num}`,
      description: tr('SPS-Steuerung', 'PLC Controller'),
      plant: '=ST01',
      location: '+SP01',
    };

    try {
      const nextProject = editAutomation(project, {
        kind: 'save',
        entity: 'controllers',
        value: newCpu,
      });
      this.selectedControllerId = newCpu.id;
      this.selectedRackId = '0';
      this.selectedModuleId = '';
      this.selectedChannelId = '';
      this.callbacks.onUpdateProject(nextProject);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private updateChannelField(channelId: string, field: string, value: any) {
    const project = this.getProject();
    const d = automationData(project);
    const channel = d.channels.find(c => c.id === channelId);
    if (!channel) return;

    const updated = {...channel, [field]: value};
    try {
      const nextProject = editAutomation(project, {
        kind: 'save',
        entity: 'channels',
        value: updated,
      });
      this.callbacks.onUpdateProject(nextProject);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private unbindChannel(channelId: string) {
    const project = this.getProject();
    const d = automationData(project);
    const channel = d.channels.find(c => c.id === channelId);
    if (!channel) return;

    const updated = {...channel};
    delete updated.signal;

    try {
      const nextProject = editAutomation(project, {
        kind: 'save',
        entity: 'channels',
        value: updated,
      });
      this.callbacks.onUpdateProject(nextProject);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private deleteChannel(channelId: string) {
    try {
      const nextProject = editAutomation(this.getProject(), {
        kind: 'remove',
        entity: 'channels',
        id: channelId,
      });
      if (this.selectedChannelId === channelId) this.selectedChannelId = '';
      this.callbacks.onUpdateProject(nextProject);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private deleteModule(moduleId: string) {
    try {
      const nextProject = editAutomation(this.getProject(), {
        kind: 'remove',
        entity: 'modules',
        id: moduleId,
      });
      if (this.selectedModuleId === moduleId) this.selectedModuleId = '';
      this.selectedChannelId = '';
      this.callbacks.onUpdateProject(nextProject);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private deleteController(controllerId: string) {
    try {
      const nextProject = editAutomation(this.getProject(), {
        kind: 'remove',
        entity: 'controllers',
        id: controllerId,
      });
      const d = automationData(nextProject);
      this.selectedControllerId = d.controllers[0]?.id || '';
      this.selectedRackId = '0';
      this.selectedModuleId = '';
      this.selectedChannelId = '';
      this.callbacks.onUpdateProject(nextProject);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private saveInspectorChannel(root: HTMLElement) {
    if (!this.selectedChannelId) return;
    const d = automationData(this.getProject());
    const channel = d.channels.find(c => c.id === this.selectedChannelId);
    if (!channel) return;

    const get = (f: string) => root.querySelector<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>(`[data-inspect-field="${f}"]`);
    const address = get('address')?.value || '';
    const symbolicName = get('symbolicName')?.value || '';
    const signalText = get('signalText')?.value || '';
    const dataType = get('dataType')?.value || '';
    const kind = (get('kind')?.value || 'DI') as any;
    const reserve = (get('reserve') as HTMLInputElement)?.checked ?? false;

    const updated: PlcChannel = {
      ...channel,
      address,
      symbolicName,
      signalText,
      dataType,
      kind,
      reserve,
    };

    try {
      const next = editAutomation(this.getProject(), {
        kind: 'save',
        entity: 'channels',
        value: updated,
      });
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private saveInspectorModule(root: HTMLElement) {
    if (!this.selectedModuleId) return;
    const d = automationData(this.getProject());
    const mod = d.modules.find(m => m.id === this.selectedModuleId);
    if (!mod) return;

    const get = (f: string) => root.querySelector<HTMLInputElement>(`[data-inspect-field="${f}"]`)?.value;
    const bmk = get('moduleBmk') || mod.bmk;
    const description = get('moduleDescription') || '';
    const rack = get('moduleRack') || '0';
    const slot = get('moduleSlot') || '1';

    const updated: PlcModule = {
      ...mod,
      bmk,
      description,
      rack,
      slot,
    };

    try {
      const next = editAutomation(this.getProject(), {
        kind: 'save',
        entity: 'modules',
        value: updated,
      });
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private saveInspectorCpu(root: HTMLElement) {
    if (!this.selectedControllerId) return;
    const d = automationData(this.getProject());
    const cpu = d.controllers.find(c => c.id === this.selectedControllerId);
    if (!cpu) return;

    const get = (f: string) => root.querySelector<HTMLInputElement>(`[data-inspect-field="${f}"]`)?.value;
    const bmk = get('cpuBmk') || cpu.bmk;
    const description = get('cpuDescription') || '';
    const plant = get('cpuPlant') || '';
    const location = get('cpuLocation') || '';

    const updated: PlcController = {
      ...cpu,
      bmk,
      description,
      plant,
      location,
    };

    try {
      const next = editAutomation(this.getProject(), {
        kind: 'save',
        entity: 'controllers',
        value: updated,
      });
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }
}
