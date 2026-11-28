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
} from '../../model/Automation';
import {ProjectIndex} from '../../model/ProjectIndex';
import {escapeSvg as esc} from '../../model/ImportedDrawing';
import {tr} from '../../i18n';
import {renderPlcRackVisualizer} from './PlcRackVisualizer';
import {formatChannelBinding, renderPlcSignalMatrix} from './PlcSignalMatrix';
import {
  PLC_CONTROLLER_PRESETS,
  PLC_MODULE_TEMPLATES,
  PLC_RACK_STATION_PRESETS,
  calculateNextModulePlacement,
  instantiateDecentralizedStation,
  instantiatePlcControllerPreset,
  instantiatePlcModuleTemplate,
  type PlcTemplateCategory,
} from './PlcQuickTemplates';

export interface PlcHardwareWorkspaceCallbacks {
  onUpdateProject: (p: Project) => void;
  onNavigate: (pageId: string, componentId: string) => void;
  onError: (e: unknown) => void;
}

type BindingRole = 'signal' | 'supply' | 'common';

export class PlcHardwareWorkspace {
  private selectedControllerId = '';
  private selectedRackId = '0';
  private selectedModuleId = '';
  private selectedChannelId = '';
  private searchQuery = '';
  private issuesOnly = false;
  private templateMenuOpen = false;
  private cpuMenuOpen = false;
  private rackMenuOpen = false;
  private bindingModal?: {channelId: string; role: BindingRole};

  constructor(
    private getProject: () => Project,
    private getIssues: () => AutomationIssue[],
    private getProjectIndex: () => ProjectIndex,
    private callbacks: PlcHardwareWorkspaceCallbacks,
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

    if (!data.controllers.some((c) => c.id === this.selectedControllerId) && data.controllers.length) {
      this.selectedControllerId = data.controllers[0].id;
    }
    const controller = data.controllers.find((c) => c.id === this.selectedControllerId);

    const modules = data.modules.filter((m) => m.controllerId === this.selectedControllerId);
    const racks = [...new Set(['0', ...modules.map((m) => m.rack || '0')])].sort((a, b) =>
      a.localeCompare(b, undefined, {numeric: true}),
    );
    if (!racks.includes(this.selectedRackId)) {
      this.selectedRackId = racks[0] || '0';
    }

    const query = this.searchQuery.trim().toLowerCase();
    const relevantModules = modules.filter((m) => (m.rack || '0') === this.selectedRackId);
    const targetModuleIds = this.selectedModuleId ? [this.selectedModuleId] : relevantModules.map((m) => m.id);

    let displayChannels = data.channels.filter((c) => targetModuleIds.includes(c.moduleId));

    if (query) {
      const words = query.split(/\s+/).filter(Boolean);
      displayChannels = displayChannels.filter((c) => {
        const mod = relevantModules.find((m) => m.id === c.moduleId);
        const searchStr = `${c.address} ${c.symbolicName} ${c.signalText} ${c.number} ${c.dataType} ${mod?.bmk} ${mod?.description}`.toLowerCase();
        return words.every((w) => searchStr.includes(w));
      });
    }

    if (this.issuesOnly) {
      const issueIds = new Set(issues.filter((i) => i.entity === 'channels').map((i) => i.recordId));
      displayChannels = displayChannels.filter((c) => issueIds.has(c.id));
    }

    displayChannels.sort((a, b) => {
      const modA = relevantModules.find((m) => m.id === a.moduleId);
      const modB = relevantModules.find((m) => m.id === b.moduleId);
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
            <div class="plc-cpu-dropdown-wrap">
              <button class="btn btn-xs btn-primary" data-hw-action="toggle-cpu-menu" title="${esc(tr('Neue Steuerung / CPU aus Vorlage anlegen', 'Create new Controller / CPU from preset'))}">
                + ${esc(tr('CPU', 'CPU'))} ▾
              </button>
              <div class="plc-template-dropdown-menu plc-preset-scroll ${this.cpuMenuOpen ? 'is-open' : ''}">
                <div class="plc-template-dropdown-header">${esc(tr('Reale SPS- & Gebäude-CPUs', 'Real PLC & Building Controllers'))}</div>
                ${PLC_CONTROLLER_PRESETS.map((p) => `
                  <button class="plc-template-item" data-cpu-preset-id="${esc(p.id)}">
                    <strong>${esc(p.name)}</strong>
                    <small>${esc(p.description)}</small>
                  </button>
                `).join('')}
              </div>
            </div>
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
              <span class="plc-rack-badge">${this.selectedRackId === '0' ? tr('Rack 0 · Zentral', 'Rack 0 · Central') : `${tr('Rack', 'Rack')} ${esc(this.selectedRackId)} · ${tr('Dezentral', 'Remote I/O')}`}</span>
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

              ${controller ? `
                <!-- Dezentrales Rack hinzufügen -->
                <div class="plc-rack-dropdown-wrap">
                  <button class="btn plc-btn-rack-toggle" data-hw-action="toggle-rack-menu" title="${esc(tr('Dezentrale E/A-Station (Rack 1+) anlegen', 'Add remote I/O station (Rack 1+)'))}">
                    + ${esc(tr('Rack / Station', 'Rack / Station'))} ▾
                  </button>
                  <div class="plc-template-dropdown-menu plc-preset-scroll ${this.rackMenuOpen ? 'is-open' : ''}">
                    <div class="plc-template-dropdown-header">${esc(tr('Dezentrale Peripherie-Stationen', 'Remote I/O Stations'))}</div>
                    ${PLC_RACK_STATION_PRESETS.map((r) => `
                      <button class="plc-template-item" data-rack-preset-id="${esc(r.id)}">
                        <strong>${esc(r.name)}</strong>
                        <small>${esc(r.description)}</small>
                      </button>
                    `).join('')}
                  </div>
                </div>
              ` : ''}

              <!-- Schnell-Vorlagen Dropdown-Button -->
              <div class="plc-template-dropdown-wrap">
                <button class="btn btn-primary plc-btn-template-toggle" data-hw-action="toggle-templates">
                  + ${esc(tr('Baugruppe', 'Module'))} ▾
                </button>
                <div class="plc-template-dropdown-menu plc-preset-scroll ${this.templateMenuOpen ? 'is-open' : ''}">
                  ${this.renderCategorizedTemplates()}
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

  private renderCategorizedTemplates(): string {
    const groups: {cat: PlcTemplateCategory; label: string}[] = [
      {cat: 'io_digital', label: tr('Digital E/A (DI / DQ / Relais)', 'Digital I/O (DI / DQ / Relay)')},
      {cat: 'io_combo', label: tr('Kombimodule (DI / DQ)', 'Combo Modules (DI / DQ)')},
      {cat: 'io_analog', label: tr('Analog & Technologie (AI / AQ / RTD / Zähler)', 'Analog & Tech (AI / AQ / RTD / Counter)')},
      {cat: 'safety', label: tr('Sicherheitstechnik (Fail-Safe SIL 3)', 'Safety Technology (Fail-Safe SIL 3)')},
      {cat: 'system', label: tr('Versorgung, Koppler & Kommunikation', 'Supply, Coupler & Communication')},
    ];

    return groups
      .map((g) => {
        const items = PLC_MODULE_TEMPLATES.filter((t) => (t.category || 'io_digital') === g.cat);
        if (!items.length) return '';
        return `
          <div class="plc-template-dropdown-header">${esc(g.label)}</div>
          ${items
            .map(
              (tmpl) => `
            <button class="plc-template-item" data-template-id="${esc(tmpl.id)}">
              <strong>${esc(tmpl.name)}</strong>
              <small>${esc(tmpl.description)}</small>
            </button>
          `,
            )
            .join('')}
        `;
      })
      .join('');
  }

  private renderTree(data: ReturnType<typeof automationData>, issues: AutomationIssue[]): string {
    const orphanModules = data.modules.filter((m) => !data.controllers.some((c) => c.id === m.controllerId));
    const orphanChannels = data.channels.filter((ch) => !data.modules.some((m) => m.id === ch.moduleId));

    const orphanAlert =
      orphanModules.length || orphanChannels.length
        ? `<div class="plc-inspector-alert" style="margin:6px">⚠ ${esc(tr('Unzugeordnete Hardware:', 'Orphaned hardware:'))} ${orphanModules.length} Mod · ${orphanChannels.length} E/A</div>`
        : '';

    if (!data.controllers.length) {
      return `${orphanAlert}<p class="auto-muted" style="padding:10px">${esc(tr('Noch keine Steuerungen vorhanden.', 'No controllers created yet.'))}</p>`;
    }

    return (
      orphanAlert +
      data.controllers
        .map((c) => {
          const isSelectedCpu = this.selectedControllerId === c.id;
          const cIssues = issues.filter((i) => i.entity === 'controllers' && i.recordId === c.id);
          const cModules = data.modules.filter((m) => m.controllerId === c.id);
          const cRacks = [...new Set(['0', ...cModules.map((m) => m.rack || '0')])].sort((a, b) =>
            a.localeCompare(b, undefined, {numeric: true}),
          );

          return `
            <div class="plc-tree-controller ${isSelectedCpu ? 'is-active-cpu' : ''}">
              <div class="plc-tree-item plc-tree-cpu" data-tree-select-cpu="${esc(c.id)}">
                <span class="plc-tree-icon">⚡</span>
                <span class="plc-tree-label"><strong>${esc(c.bmk)}</strong> <small>${esc(c.plant || '')} ${esc(c.location || '')}</small></span>
                ${cIssues.length ? `<span class="auto-nav-alert" title="${esc(cIssues.map((i) => i.message).join('; '))}"></span>` : ''}
              </div>
              
              <div class="plc-tree-racks">
                ${cRacks
                  .map((rack) => {
                    const isRackActive = isSelectedCpu && this.selectedRackId === rack;
                    const rackMods = cModules
                      .filter((m) => (m.rack || '0') === rack)
                      .sort((a, b) => parseInt(a.slot || '0', 10) - parseInt(b.slot || '0', 10));

                    return `
                      <div class="plc-tree-rack ${isRackActive ? 'is-active-rack' : ''}">
                        <div class="plc-tree-item plc-tree-rack-head" data-tree-select-rack="${esc(c.id)}" data-rack-val="${esc(rack)}">
                          <span class="plc-tree-rack-icon">▤</span>
                          <span class="plc-tree-label">Rack ${esc(rack)}</span>
                          <span class="plc-tree-count">${rackMods.length}</span>
                        </div>

                        <div class="plc-tree-modules">
                          ${rackMods
                            .map((m) => {
                              const isModActive = this.selectedModuleId === m.id;
                              const mIssues = issues.filter((i) => i.entity === 'modules' && i.recordId === m.id);
                              return `
                                <div class="plc-tree-item plc-tree-module ${isModActive ? 'is-active-mod' : ''}" 
                                     data-tree-select-mod="${esc(m.id)}">
                                  <span class="plc-slot-bullet">${esc(m.slot)}</span>
                                  <span class="plc-tree-label">${esc(m.bmk)}</span>
                                  ${mIssues.length ? `<span class="auto-nav-alert" title="${esc(mIssues.map((i) => i.message).join('; '))}"></span>` : ''}
                                </div>
                              `;
                            })
                            .join('')}
                        </div>
                      </div>
                    `;
                  })
                  .join('')}
              </div>
            </div>
          `;
        })
        .join('')
    );
  }

  private renderInspector(data: ReturnType<typeof automationData>, index: ProjectIndex, issues: AutomationIssue[]): string {
    // 1. Channel Selected
    if (this.selectedChannelId) {
      const channel = data.channels.find((c) => c.id === this.selectedChannelId);
      if (channel) {
        const mod = data.modules.find((m) => m.id === channel.moduleId);
        const chIssues = issues.filter((i) => i.entity === 'channels' && i.recordId === channel.id);
        const roles: {role: BindingRole; label: string}[] = [
          {role: 'signal', label: tr('Signal-Anschluss', 'Signal Pin')},
          {role: 'supply', label: tr('Versorgung (L+)', 'Supply (L+)')},
          {role: 'common', label: tr('Bezug / Masse (M)', 'Common / Ground')},
        ];

        return `
          <div class="plc-inspector-section">
            <div class="plc-inspector-title">
              <span class="plc-kind-badge kind-${channel.kind.toLowerCase()}">${esc(channel.kind)}</span>
              <strong>${esc(tr('Kanal', 'Channel'))} ${esc(channel.number)}</strong>
              <small>${esc(mod?.bmk || '')} (Slot ${esc(mod?.slot || '?')})</small>
            </div>

            ${chIssues.map((i) => `<div class="plc-inspector-alert">⚠ ${esc(i.message)}</div>`).join('')}

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
                ${esc(tr('Als Reserve kennzeichnen (löst Anschlüsse)', 'Mark as spare (clears pin links)'))}
              </label>
            </div>

            <hr class="plc-inspector-divider">

            <h5>${esc(tr('3-Leiter Schaltplan-Anschlüsse', '3-Wire Schematic Pins'))}</h5>
            
            ${roles
              .map(({role, label}) => {
                const current = channel[role];
                const text = current ? formatChannelBinding(current, index) : tr('Nicht verknüpft', 'Unlinked');
                return `
                  <div class="plc-binding-item">
                    <span class="plc-binding-role-label">${esc(label)}:</span>
                    <div class="plc-binding-current" title="${esc(text)}">${esc(text)}</div>
                    ${current ? `
                      <button class="btn btn-xs" data-hw-action="jump-binding-role" data-binding-channel="${esc(channel.id)}" data-binding-role="${role}" title="${esc(tr('Im Schaltplan anzeigen', 'View in drawing'))}">↗</button>
                      <button class="btn btn-xs" data-hw-action="clear-binding-role" data-binding-channel="${esc(channel.id)}" data-binding-role="${role}" title="${esc(tr('Zuordnung lösen', 'Unlink'))}">✕</button>
                    ` : ''}
                    <button class="btn btn-xs btn-outline" data-hw-action="open-binding-modal" data-binding-channel="${esc(channel.id)}" data-binding-role="${role}">
                      ${current ? esc(tr('Ändern…', 'Change…')) : esc(tr('Verknüpfen…', 'Link…'))}
                    </button>
                  </div>
                `;
              })
              .join('')}

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
      const module = data.modules.find((m) => m.id === this.selectedModuleId);
      if (module) {
        const mChannels = data.channels.filter((c) => c.moduleId === module.id);
        const mIssues = issues.filter((i) => i.entity === 'modules' && i.recordId === module.id);

        return `
          <div class="plc-inspector-section">
            <div class="plc-inspector-title">
              <strong>${esc(module.bmk)}</strong>
              <small>${esc(module.description || tr('Baugruppe', 'Module'))}</small>
            </div>

            ${mIssues.map((i) => `<div class="plc-inspector-alert">⚠ ${esc(i.message)}</div>`).join('')}

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
    const controller = data.controllers.find((c) => c.id === this.selectedControllerId);
    if (controller) {
      const cIssues = issues.filter((i) => i.entity === 'controllers' && i.recordId === controller.id);
      const cMods = data.modules.filter((m) => m.controllerId === controller.id);
      const cChans = data.channels.filter((c) => cMods.some((m) => m.id === c.moduleId));
      const cNodes = data.nodes.filter((n) => n.controllerId === controller.id);

      return `
        <div class="plc-inspector-section">
          <div class="plc-inspector-title">
            <strong>${esc(controller.bmk)}</strong>
            <small>${esc(tr('Zentralbaugruppe (CPU)', 'Central Processing Unit'))}</small>
          </div>

          ${cIssues.map((i) => `<div class="plc-inspector-alert">⚠ ${esc(i.message)}</div>`).join('')}

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
            <div>${cNodes.length} ${esc(tr('Verknüpfte Busschnittstellen', 'Linked Bus Interfaces'))}</div>
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

  private renderBindingModal(project: Project, _index: ProjectIndex): string {
    if (!this.bindingModal) return '';
    const d = automationData(project);
    const channel = d.channels.find((c) => c.id === this.bindingModal!.channelId);
    if (!channel) return '';
    const roleLabel =
      this.bindingModal.role === 'supply'
        ? tr('Versorgung (L+)', 'Supply (L+)')
        : this.bindingModal.role === 'common'
          ? tr('Bezug / Masse (M)', 'Common / Ground')
          : tr('Signal-Anschluss', 'Signal Pin');
    const existingBinding = channel[this.bindingModal.role];

    return `
      <div class="modal-backdrop plc-binding-modal-backdrop" data-hw-action="close-binding-modal">
        <div class="plc-binding-modal">
          <header class="plc-binding-modal-header">
            <h4>${esc(tr('Schaltplan-Pin zuordnen', 'Assign Schematic Pin'))} · ${esc(roleLabel)}</h4>
            <button class="btn-close" data-hw-action="close-binding-modal">×</button>
          </header>
          <div class="plc-binding-modal-body">
            <p>${esc(tr('Kanal:', 'Channel:'))} <strong>${esc(channel.number)} · ${esc(channel.address || '')} (${esc(channel.signalText || channel.symbolicName || channel.kind)})</strong></p>
            
            <div class="plc-form-group">
              <label>${esc(tr('Schaltplanblatt', 'Schematic Sheet'))}</label>
              <select class="form-input" data-bind-select="page">
                ${project.pages
                  .map(
                    (p) => `
                  <option value="${esc(p.id)}" ${existingBinding?.pageId === p.id ? 'selected' : ''}>
                    ${esc(p.pageNumber + ' · ' + p.title)}
                  </option>
                `,
                  )
                  .join('')}
              </select>
            </div>

            <div class="plc-form-group">
              <label>${esc(tr('Bauteil / Sensor / Aktor', 'Component / Sensor / Actuator'))}</label>
              <select class="form-input" data-bind-select="component"></select>
            </div>

            <div class="plc-form-group">
              <label>${esc(tr('Anschluss-Pin', 'Terminal Pin'))}</label>
              <select class="form-input" data-bind-select="pin"></select>
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

  private closeMenus(root: HTMLElement) {
    this.templateMenuOpen = false;
    this.cpuMenuOpen = false;
    this.rackMenuOpen = false;
    for (const el of root.querySelectorAll('.plc-template-dropdown-menu')) el.classList.remove('is-open');
  }

  public bind(root: HTMLElement) {
    root.onclick = (e) => {
      const target = e.target as HTMLElement;

      if (
        !target.closest('.plc-template-dropdown-wrap') &&
        !target.closest('.plc-cpu-dropdown-wrap') &&
        !target.closest('.plc-rack-dropdown-wrap') &&
        (this.templateMenuOpen || this.cpuMenuOpen || this.rackMenuOpen)
      ) {
        this.closeMenus(root);
      }

      if (target.closest('[data-hw-action="toggle-cpu-menu"]')) {
        const nextState = !this.cpuMenuOpen;
        this.closeMenus(root);
        this.cpuMenuOpen = nextState;
        root.querySelector('.plc-cpu-dropdown-wrap .plc-template-dropdown-menu')?.classList.toggle('is-open', nextState);
        return;
      }

      if (target.closest('[data-hw-action="toggle-rack-menu"]')) {
        const nextState = !this.rackMenuOpen;
        this.closeMenus(root);
        this.rackMenuOpen = nextState;
        root.querySelector('.plc-rack-dropdown-wrap .plc-template-dropdown-menu')?.classList.toggle('is-open', nextState);
        return;
      }

      if (target.closest('[data-hw-action="toggle-templates"]')) {
        const nextState = !this.templateMenuOpen;
        this.closeMenus(root);
        this.templateMenuOpen = nextState;
        root.querySelector('.plc-template-dropdown-wrap .plc-template-dropdown-menu')?.classList.toggle('is-open', nextState);
        return;
      }

      const cpuPresetBtn = target.closest<HTMLElement>('[data-cpu-preset-id]');
      if (cpuPresetBtn) {
        this.closeMenus(root);
        this.createController(cpuPresetBtn.dataset.cpuPresetId!);
        return;
      }

      const rackPresetBtn = target.closest<HTMLElement>('[data-rack-preset-id]');
      if (rackPresetBtn) {
        this.closeMenus(root);
        this.createDecentralizedRack(rackPresetBtn.dataset.rackPresetId!);
        return;
      }

      const templateBtn = target.closest<HTMLElement>('[data-template-id]');
      if (templateBtn) {
        const tmplId = templateBtn.dataset.templateId!;
        const tmpl = PLC_MODULE_TEMPLATES.find((t) => t.id === tmplId);
        if (tmpl) this.applyModuleTemplate(tmpl);
        return;
      }

      if (target.closest('[data-hw-action="new-custom-module"]')) {
        this.createCustomModule();
        return;
      }

      const treeCpu = target.closest<HTMLElement>('[data-tree-select-cpu]');
      if (treeCpu) {
        this.selectedControllerId = treeCpu.dataset.treeSelectCpu!;
        this.selectedRackId = '0';
        this.selectedModuleId = '';
        this.selectedChannelId = '';
        this.callbacks.onUpdateProject(this.getProject());
        return;
      }

      const treeRack = target.closest<HTMLElement>('[data-tree-select-rack]');
      if (treeRack) {
        this.selectedControllerId = treeRack.dataset.treeSelectRack!;
        this.selectedRackId = treeRack.dataset.rackVal!;
        this.selectedModuleId = '';
        this.selectedChannelId = '';
        this.callbacks.onUpdateProject(this.getProject());
        return;
      }

      const treeMod = target.closest<HTMLElement>('[data-tree-select-mod]');
      if (treeMod) {
        this.selectModule(treeMod.dataset.treeSelectMod!);
        return;
      }

      const selectController = target.closest<HTMLElement>('[data-select-controller]');
      if (selectController) {
        this.selectedControllerId = selectController.dataset.selectController!;
        this.selectedModuleId = '';
        this.selectedChannelId = '';
        this.callbacks.onUpdateProject(this.getProject());
        return;
      }

      // Check channel pin dot BEFORE module card
      const selectChannel = target.closest<HTMLElement>('[data-select-channel]');
      if (selectChannel) {
        this.selectChannel(selectChannel.dataset.selectChannel!);
        return;
      }

      const selectModule = target.closest<HTMLElement>('[data-select-module]');
      if (selectModule) {
        this.selectModule(selectModule.dataset.selectModule!);
        return;
      }

      const addPrompt = target.closest<HTMLElement>('[data-add-module-prompt]');
      if (addPrompt) {
        this.closeMenus(root);
        this.templateMenuOpen = true;
        root.querySelector('.plc-template-dropdown-wrap .plc-template-dropdown-menu')?.classList.add('is-open');
        root.querySelector('.plc-template-dropdown-wrap')?.scrollIntoView({block: 'nearest'});
        return;
      }

      const channelRow = target.closest<HTMLElement>('[data-channel-row]');
      if (channelRow && !target.closest('input, button, select')) {
        this.selectChannel(channelRow.dataset.channelRow!);
        return;
      }

      const jumpBtn = target.closest<HTMLElement>('[data-jump-drawing]');
      if (jumpBtn) {
        const d = automationData(this.getProject());
        const ch = d.channels.find((c) => c.id === jumpBtn.dataset.jumpDrawing!);
        if (ch?.signal) this.callbacks.onNavigate(ch.signal.pageId, ch.signal.componentId);
        return;
      }

      const jumpRoleBtn = target.closest<HTMLElement>('[data-hw-action="jump-binding-role"]');
      if (jumpRoleBtn) {
        const d = automationData(this.getProject());
        const ch = d.channels.find((c) => c.id === jumpRoleBtn.dataset.bindingChannel!);
        const role = (jumpRoleBtn.dataset.bindingRole || 'signal') as BindingRole;
        const pin = ch?.[role];
        if (pin) this.callbacks.onNavigate(pin.pageId, pin.componentId);
        return;
      }

      const clearRoleBtn = target.closest<HTMLElement>('[data-hw-action="clear-binding-role"]');
      if (clearRoleBtn) {
        const role = (clearRoleBtn.dataset.bindingRole || 'signal') as BindingRole;
        this.unbindChannelRole(clearRoleBtn.dataset.bindingChannel!, role);
        return;
      }

      const unbindBtn = target.closest<HTMLElement>('[data-unbind-channel]');
      if (unbindBtn) {
        this.unbindChannelRole(unbindBtn.dataset.unbindChannel!, 'signal');
        return;
      }

      const bindBtn = target.closest<HTMLElement>('[data-bind-channel]');
      if (bindBtn) {
        this.bindingModal = {channelId: bindBtn.dataset.bindChannel!, role: 'signal'};
        this.callbacks.onUpdateProject(this.getProject());
        return;
      }

      const openBindModal = target.closest<HTMLElement>('[data-hw-action="open-binding-modal"]');
      if (openBindModal) {
        const role = (openBindModal.dataset.bindingRole || 'signal') as BindingRole;
        this.bindingModal = {channelId: openBindModal.dataset.bindingChannel!, role};
        this.callbacks.onUpdateProject(this.getProject());
        return;
      }

      if (
        target.closest('button[data-hw-action="close-binding-modal"]') ||
        target.classList.contains('plc-binding-modal-backdrop')
      ) {
        this.bindingModal = undefined;
        this.callbacks.onUpdateProject(this.getProject());
        return;
      }

      if (target.closest('[data-hw-action="apply-binding-modal"]')) {
        this.applyBindingModal(root);
        return;
      }

      const inspectBtn = target.closest<HTMLElement>('[data-inspect-channel]');
      if (inspectBtn) {
        this.selectChannel(inspectBtn.dataset.inspectChannel!);
        return;
      }

      const deleteChBtn = target.closest<HTMLElement>('[data-delete-channel]');
      if (deleteChBtn) {
        this.deleteChannel(deleteChBtn.dataset.deleteChannel!);
        return;
      }

      if (target.closest('[data-hw-action="clear-module-filter"]')) {
        this.selectedModuleId = '';
        this.callbacks.onUpdateProject(this.getProject());
        return;
      }

      if (target.closest('[data-hw-action="add-channel-to-module"]')) {
        this.addChannelToSelectedModule();
        return;
      }

      if (target.closest('[data-hw-action="new-controller"]')) {
        this.createController('custom_cpu');
        return;
      }

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

    root.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      if (target.hasAttribute('data-inplace-channel')) {
        const chId = target.dataset.inplaceChannel!;
        const field = target.dataset.inplaceField!;
        const value = target.type === 'checkbox' ? target.checked : target.value;
        this.updateChannelField(chId, field, value);
      }
    };

    this.setupBindingModalSelects(root);
  }

  private setupBindingModalSelects(root: HTMLElement) {
    if (!this.bindingModal) return;
    const pageSelect = root.querySelector<HTMLSelectElement>('[data-bind-select="page"]');
    const compSelect = root.querySelector<HTMLSelectElement>('[data-bind-select="component"]');
    const pinSelect = root.querySelector<HTMLSelectElement>('[data-bind-select="pin"]');
    if (!pageSelect || !compSelect || !pinSelect) return;

    const index = this.getProjectIndex();
    const project = this.getProject();
    const d = automationData(project);
    const channel = d.channels.find((c) => c.id === this.bindingModal!.channelId);
    const current = channel?.[this.bindingModal.role];

    const updatePins = () => {
      const comp = index.component(compSelect.value, pageSelect.value);
      if (!comp) {
        pinSelect.innerHTML = `<option value="">${esc(tr('Keine Anschlüsse', 'No pins'))}</option>`;
        return;
      }
      const pins = index.pinsFor(comp).filter((p) => p.definition);
      pinSelect.innerHTML =
        pins
          .map(
            (p) => `
        <option value="${esc(p.id)}" ${current?.pinId === p.id ? 'selected' : ''}>
          ${esc(p.label + ' [' + p.id + ']')}
        </option>
      `,
          )
          .join('') || `<option value="">${esc(tr('Keine Anschlüsse', 'No pins'))}</option>`;
    };

    const updateComponents = () => {
      const pageId = pageSelect.value;
      const comps = index.components.filter((c) => c.page.id === pageId && c.symbol?.pins.length);
      compSelect.innerHTML =
        comps
          .map(
            (c) => `
        <option value="${esc(c.component.id)}" ${current?.componentId === c.component.id ? 'selected' : ''}>
          ${esc(c.component.bmk + ' · ' + (c.symbol?.name || c.component.id))}
        </option>
      `,
          )
          .join('') || `<option value="">${esc(tr('Keine Bauteile mit Anschlüssen', 'No components with pins'))}</option>`;
      updatePins();
    };

    pageSelect.onchange = updateComponents;
    compSelect.onchange = updatePins;
    updateComponents();
  }

  private applyBindingModal(root: HTMLElement) {
    if (!this.bindingModal) return;
    const pageSelect = root.querySelector<HTMLSelectElement>('[data-bind-select="page"]');
    const compSelect = root.querySelector<HTMLSelectElement>('[data-bind-select="component"]');
    const pinSelect = root.querySelector<HTMLSelectElement>('[data-bind-select="pin"]');
    if (!pageSelect || !compSelect) return;

    const pageId = pageSelect.value;
    const componentId = compSelect.value;
    const pinId = pinSelect?.value || '';

    if (!pageId || !componentId || !pinId) {
      this.callbacks.onError(
        new Error(tr('Bitte ein Blatt, ein Bauteil und einen Anschluss-Pin auswählen.', 'Please select sheet, component, and terminal pin.')),
      );
      return;
    }

    const d = automationData(this.getProject());
    const channel = d.channels.find((c) => c.id === this.bindingModal!.channelId);
    if (!channel) return;

    const updated: PlcChannel = {
      ...channel,
      reserve: false,
      [this.bindingModal.role]: {pageId, componentId, pinId},
    };

    try {
      const nextProject = editAutomation(this.getProject(), {
        kind: 'save',
        entity: 'channels',
        value: updated,
      });
      this.bindingModal = undefined;
      this.callbacks.onUpdateProject(nextProject);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private selectModule(moduleId: string) {
    this.selectedModuleId = moduleId;
    this.selectedChannelId = '';
    const d = automationData(this.getProject());
    const mod = d.modules.find((m) => m.id === moduleId);
    if (mod) {
      this.selectedControllerId = mod.controllerId;
      this.selectedRackId = mod.rack || '0';
    }
    this.callbacks.onUpdateProject(this.getProject());
  }

  private selectChannel(channelId: string) {
    this.selectedChannelId = channelId;
    const d = automationData(this.getProject());
    const ch = d.channels.find((c) => c.id === channelId);
    if (ch) {
      this.selectedModuleId = ch.moduleId;
      const mod = d.modules.find((m) => m.id === ch.moduleId);
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
        this.selectedRackId,
      );

      let nextProject = editAutomation(project, {
        kind: 'save',
        entity: 'modules',
        value: module,
      });

      for (const ch of channels) {
        nextProject = editAutomation(nextProject, {
          kind: 'save',
          entity: 'channels',
          value: ch,
        });
      }

      this.selectedModuleId = module.id;
      this.selectedChannelId = '';
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
      this.selectedChannelId = '';
      this.callbacks.onUpdateProject(nextProject);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private createDecentralizedRack(presetId: string) {
    if (!this.selectedControllerId) {
      this.callbacks.onError(new Error(tr('Zuerst eine Steuerung anlegen.', 'Create a controller first.')));
      return;
    }
    try {
      const result = instantiateDecentralizedStation(this.getProject(), this.selectedControllerId, presetId);
      this.selectedRackId = result.rack;
      this.selectedModuleId = result.coupler.id;
      this.selectedChannelId = '';
      this.callbacks.onUpdateProject(result.next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private addChannelToSelectedModule() {
    if (!this.selectedModuleId) return;
    const project = this.getProject();
    const d = automationData(project);
    const mod = d.modules.find((m) => m.id === this.selectedModuleId);
    if (!mod) return;

    const modChannels = d.channels.filter((c) => c.moduleId === this.selectedModuleId);
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
    while (modChannels.some((c) => c.kind === kind && c.number === String(chNum))) chNum++;
    const nextNum = String(chNum);

    const area: 'I' | 'Q' = kind === 'DI' || kind === 'AI' ? 'I' : 'Q';
    const cpuModuleIds = new Set(d.modules.filter((m) => m.controllerId === mod.controllerId).map((m) => m.id));
    const existingRanges = d.channels
      .filter((c) => cpuModuleIds.has(c.moduleId))
      .map((c) => plcAddress(c.address))
      .filter((a): a is NonNullable<ReturnType<typeof plcAddress>> => !!a && a.area === area);

    const overlaps = (start: number, end: number) => existingRanges.some((r) => start < r.end && end > r.start);

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

  private createController(presetId = 'custom_cpu') {
    try {
      const result = instantiatePlcControllerPreset(this.getProject(), presetId);
      this.selectedControllerId = result.controller.id;
      this.selectedRackId = '0';
      this.selectedModuleId = result.modules[0]?.id || '';
      this.selectedChannelId = '';
      this.callbacks.onUpdateProject(result.next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private updateChannelField(channelId: string, field: string, value: any) {
    const project = this.getProject();
    const d = automationData(project);
    const channel = d.channels.find((c) => c.id === channelId);
    if (!channel) return;

    const updated: PlcChannel = {...channel, [field]: value};
    if (field === 'reserve' && value === true) {
      delete updated.signal;
      delete updated.supply;
      delete updated.common;
    }

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

  private unbindChannelRole(channelId: string, role: BindingRole) {
    const project = this.getProject();
    const d = automationData(project);
    const channel = d.channels.find((c) => c.id === channelId);
    if (!channel) return;

    const updated = {...channel};
    delete updated[role];

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
    const channel = d.channels.find((c) => c.id === this.selectedChannelId);
    if (!channel) return;

    const get = (f: string) =>
      root.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[data-inspect-field="${f}"]`);
    const address = get('address')?.value || '';
    const symbolicName = get('symbolicName')?.value || '';
    const signalText = get('signalText')?.value || '';
    const dataType = get('dataType')?.value || '';
    const kind = (get('kind')?.value || 'DI') as PlcChannel['kind'];
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
    if (reserve) {
      delete updated.signal;
      delete updated.supply;
      delete updated.common;
    }

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
    const mod = d.modules.find((m) => m.id === this.selectedModuleId);
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
      this.selectedRackId = rack;
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private saveInspectorCpu(root: HTMLElement) {
    if (!this.selectedControllerId) return;
    const d = automationData(this.getProject());
    const cpu = d.controllers.find((c) => c.id === this.selectedControllerId);
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
