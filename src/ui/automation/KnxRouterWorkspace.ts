import type {Project} from '../../model/types';
import {
  automationData,
  editAutomation,
  type KnxGroup,
  type KnxObject,
  type BusNode,
  type AutomationIssue,
} from '../../model/Automation';
import {
  isKnx,
  KNX_COMMON_DPTS,
  knxGroupAddress,
  knxDpt,
} from '../../model/BusProfiles';
import {
  decodeKnxGroupXml,
  exportKnxGroupXml,
  knxXmlMaxBytes,
  previewKnxGroupXml,
} from '../../model/KnxXmlExchange';
import {
  instantiateKnxDevicePreset,
  instantiateKnxStarterGroups,
  KNX_DEVICE_PRESETS,
  suggestedKnxTemplatesForNode,
  type KnxDevicePreset,
  type KnxObjectTemplate,
} from './AutomationDevicePresets';
import {ProjectIndex} from '../../model/ProjectIndex';
import {escapeSvg as esc} from '../../model/ImportedDrawing';
import {tr} from '../../i18n';

export interface KnxRouterWorkspaceCallbacks {
  onUpdateProject: (p: Project) => void;
  onNavigate: (pageId: string, componentId: string) => void;
  onError: (e: unknown) => void;
}

function formatDirectionShort(dir: KnxObject['direction']): string {
  if (dir === 'send') return 'S';
  if (dir === 'receive') return 'E';
  return 'S+E';
}

function nextUniqueObjectNumber(objects: readonly KnxObject[], nodeId: string): string {
  const used = new Set(
    objects
      .filter(o => o.nodeId === nodeId)
      .map(o => Number(o.number))
      .filter(n => Number.isFinite(n))
  );
  let candidate = 1;
  while (used.has(candidate)) candidate++;
  return String(candidate);
}

function nextFreeGroupAddress(groups: readonly KnxGroup[], network: string): string {
  const used = new Set(
    groups
      .filter(g => g.network === network)
      .map(g => knxGroupAddress(g.address))
      .filter((n): n is number => n !== undefined)
  );
  for (let sub = 1; sub <= 255; sub++) {
    const addr = `1/0/${sub}`;
    const num = knxGroupAddress(addr);
    if (num !== undefined && !used.has(num)) return addr;
  }
  return `1/1/${groups.length + 1}`;
}

export class KnxRouterWorkspace {
  private selectedNetwork = '';
  private selectedGroupId = '';
  private searchQuery = '';
  private issuesOnly = false;
  private etsMenuOpen = false;
  private presetMenuOpen = false;
  private xmlPreviewMsg = '';

  constructor(
    private getProject: () => Project,
    private getIssues: () => AutomationIssue[],
    private _getProjectIndex: () => ProjectIndex,
    private callbacks: KnxRouterWorkspaceCallbacks
  ) {
    this.initDefaultSelection();
  }

  private initDefaultSelection() {
    const d = automationData(this.getProject());
    if (d.knxGroups.length && !this.selectedGroupId) {
      this.selectedGroupId = d.knxGroups[0].id;
    }
  }

  private resolveNetworks(project: Project): string[] {
    const d = automationData(project);
    const set = new Set<string>();
    for (const g of d.knxGroups) {
      if (g.network?.trim()) set.add(g.network.trim());
    }
    for (const n of d.nodes) {
      if (isKnx(n.protocol) && n.network?.trim()) set.add(n.network.trim());
    }
    const sorted = Array.from(set).sort((a, b) => a.localeCompare(b));
    return sorted.length ? sorted : ['KNX'];
  }

  private resolveActiveNetwork(project: Project): string {
    const networks = this.resolveNetworks(project);
    if (!this.selectedNetwork || !networks.includes(this.selectedNetwork)) {
      this.selectedNetwork = networks[0];
    }
    return this.selectedNetwork;
  }

  render(): string {
    const project = this.getProject();
    const data = automationData(project);
    const issues = this.getIssues();
    const networks = this.resolveNetworks(project);
    const activeNetwork = this.resolveActiveNetwork(project);

    const netGroups = data.knxGroups
      .filter(g => g.network === activeNetwork)
      .slice()
      .sort((a, b) => (knxGroupAddress(a.address) ?? 999999) - (knxGroupAddress(b.address) ?? 999999));

    if (!netGroups.some(g => g.id === this.selectedGroupId) && netGroups.length) {
      this.selectedGroupId = netGroups[0].id;
    } else if (!netGroups.length) {
      this.selectedGroupId = '';
    }
    const selectedGroup = netGroups.find(g => g.id === this.selectedGroupId);

    const query = this.searchQuery.trim().toLowerCase();
    let filteredGroups = netGroups;
    if (query) {
      const words = query.split(/\s+/).filter(Boolean);
      filteredGroups = filteredGroups.filter(g => {
        const text = `${g.address} ${g.name} ${g.dpt} ${g.network} ${g.description || ''}`.toLowerCase();
        return words.every(w => text.includes(w));
      });
    }
    if (this.issuesOnly) {
      const issueGroupIds = new Set(issues.filter(i => i.entity === 'knxGroups').map(i => i.recordId));
      const issueObjGroups = new Set(
        data.knxObjects
          .filter(o => issues.some(i => i.entity === 'knxObjects' && i.recordId === o.id))
          .map(o => o.groupId)
      );
      filteredGroups = filteredGroups.filter(g => issueGroupIds.has(g.id) || issueObjGroups.has(g.id));
    }

    const linkedObjects = selectedGroup
      ? data.knxObjects.filter(o => o.groupId === selectedGroup.id)
      : [];
    const sendObjects = linkedObjects.filter(o => o.direction === 'send' || o.direction === 'both');
    const recvObjects = linkedObjects.filter(o => o.direction === 'receive' || o.direction === 'both');

    const knxNodes = data.nodes
      .filter(n => isKnx(n.protocol) && n.network === activeNetwork)
      .slice()
      .sort((a, b) => a.address.localeCompare(b.address) || a.name.localeCompare(b.name));

    const netObjCount = data.knxObjects.filter(o => netGroups.some(g => g.id === o.groupId)).length;

    return `
      <div class="knx-router-workspace">
        <datalist id="knxCommonDpts">
          ${KNX_COMMON_DPTS.map(item => `<option value="${esc(item.code)}">${esc(item.label)}</option>`).join('')}
        </datalist>

        <!-- Top Toolbar -->
        <div class="knx-router-toolbar">
          <div class="knx-router-toolbar-title">
            <h3>${esc(tr('Gebäudeautomation & KNX-Router', 'Building Automation & KNX Router'))}</h3>
            <select class="form-input knx-network-select" data-knx-network aria-label="${esc(tr('KNX-Netzwerk wählen', 'Select KNX Network'))}">
              ${networks.map(net => `<option value="${esc(net)}" ${net === activeNetwork ? 'selected' : ''}>${esc(net)}</option>`).join('')}
            </select>
            <span class="knx-stats-badge">${netGroups.length} ${esc(tr('Gruppenadressen', 'Group Addresses'))} · ${netObjCount} ${esc(tr('K.O.s', 'Comm Objects'))}</span>
          </div>

          <div class="knx-router-toolbar-actions">
            <input class="form-input knx-search-input"
                   type="search"
                   placeholder="${esc(tr('Gruppe, Adresse, DPT suchen…', 'Search group, address, DPT…'))}"
                   value="${esc(this.searchQuery)}"
                   data-knx-filter="search">

            <label class="eng-check">
              <input type="checkbox" data-knx-filter="issues" ${this.issuesOnly ? 'checked' : ''}>
              ${esc(tr('Nur Hinweise', 'Only warnings'))}
            </label>

            <button class="btn btn-primary" data-knx-action="new-group">
              + ${esc(tr('Neue Gruppenadresse', 'New Group Address'))}
            </button>
            <button class="btn" data-knx-action="add-starter-groups">
              + ${esc(tr('ETS-Vorlagen', 'Starter Groups'))}
            </button>

            <div class="knx-preset-dropdown-wrap">
              <button class="btn" data-knx-action="toggle-preset-menu">+ ${esc(tr('KNX-Gerät ▾', 'KNX Device ▾'))}</button>
              <div class="plc-template-dropdown-menu plc-preset-scroll knx-preset-menu ${this.presetMenuOpen ? 'is-open' : ''}">
                <div class="plc-template-dropdown-header">${esc(tr('Reale KNX-Geräte mit K.O.-Vorlagen', 'Real KNX Devices with Object Templates'))}</div>
                ${KNX_DEVICE_PRESETS.map(preset => `
                  <button type="button" class="plc-template-item" data-knx-preset="${esc(preset.id)}">
                    <strong>${esc(preset.name)}</strong>
                    <small>${esc(preset.protocol)} · ${preset.objects.length} ${esc(tr('K.O.-Vorlagen', 'Object Templates'))} · ${esc(preset.description)}</small>
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- ETS XML Dropdown -->
            <div class="knx-ets-dropdown-wrap">
              <button class="btn plc-btn-ets-toggle" data-knx-action="toggle-ets-menu">
                ${esc(tr('ETS-XML Austausch', 'ETS XML Exchange'))} ▾
              </button>
              <div class="knx-ets-dropdown-menu ${this.etsMenuOpen ? 'is-open' : ''}">
                <button class="knx-ets-item" data-knx-action="import-ets-xml">
                  <strong>${esc(tr('ETS-XML importieren…', 'Import ETS XML…'))}</strong>
                  <small>${esc(tr('Gruppenadressen aus ETS einlesen', 'Load group addresses from ETS'))}</small>
                </button>
                <button class="knx-ets-item" data-knx-action="export-ets-xml">
                  <strong>${esc(tr('ETS-XML exportieren', 'Export ETS XML'))}</strong>
                  <small>${esc(tr('Gruppenadressen für ETS speichern', 'Save group addresses for ETS'))}</small>
                </button>
              </div>
              <input type="file" data-knx-ets-file accept=".xml,application/xml,text/xml" hidden>
            </div>
          </div>
        </div>

        ${this.xmlPreviewMsg ? `
          <div class="knx-status-banner">
            <span>${esc(this.xmlPreviewMsg)}</span>
            <button class="btn btn-xs" data-knx-action="dismiss-banner">✕</button>
          </div>
        ` : ''}

        <!-- 3-Spalten-Layout -->
        <div class="knx-3col-layout">
          <!-- Spalte 1: 3-stufiger Gruppenadressbaum -->
          <div class="knx-col knx-col-tree">
            <div class="knx-col-header">
              <h4>${esc(tr('1. Gruppenadressen (Baum)', '1. Group Addresses (Tree)'))}</h4>
              <span class="knx-col-count">${filteredGroups.length}</span>
            </div>
            <div class="knx-tree-body">
              ${this.renderGroupTree(filteredGroups, issues)}
            </div>
          </div>

          <!-- Spalte 2: K.O.-Signalfluss Matrix (Router) -->
          <div class="knx-col knx-col-router">
            <div class="knx-col-header">
              <h4>${esc(tr('2. Verknüpfte Kommunikationsobjekte (Signalfluss)', '2. Linked Comm Objects (Signal Flow)'))}</h4>
            </div>
            <div class="knx-router-body">
              ${selectedGroup ? this.renderRouterView(selectedGroup, sendObjects, recvObjects, data, issues) : `
                <div class="knx-col-empty">
                  <p>${esc(tr('Wählen Sie links eine Gruppenadresse aus.', 'Select a group address on the left.'))}</p>
                </div>
              `}
            </div>
          </div>

          <!-- Spalte 3: Verfügbare Geräte & K.O.s -->
          <div class="knx-col knx-col-devices">
            <div class="knx-col-header">
              <h4>${esc(tr('3. KNX-Geräte & K.O.-Pool', '3. KNX Devices & Comm Objects'))}</h4>
              <div style="display:flex;align-items:center;gap:6px">
                <span class="knx-col-count">${knxNodes.length} ${esc(tr('Geräte', 'Devices'))}</span>
                <button class="btn btn-xs" data-knx-action="new-knx-node">+ ${esc(tr('Gerät', 'Device'))}</button>
              </div>
            </div>
            <div class="knx-devices-body">
              ${this.renderDevicesView(knxNodes, selectedGroup, data, issues)}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderGroupTree(groups: KnxGroup[], issues: AutomationIssue[]): string {
    if (!groups.length) {
      return `
        <div class="knx-col-empty">
          <p class="auto-muted">${esc(tr('Keine Gruppenadressen im Filter.', 'No group addresses in filter.'))}</p>
          <button class="btn btn-xs btn-primary" data-knx-action="new-group">+ ${esc(tr('Erste GA anlegen', 'Create first GA'))}</button>
        </div>
      `;
    }

    const tree: Record<string, Record<string, KnxGroup[]>> = {};
    for (const g of groups) {
      const parts = g.address.split('/').map(p => p.trim());
      const main = parts[0] || '0';
      const middle = parts.length > 2 ? parts[1] || '0' : '0';
      if (!tree[main]) tree[main] = {};
      if (!tree[main][middle]) tree[main][middle] = [];
      tree[main][middle].push(g);
    }

    const mainKeys = Object.keys(tree).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));

    return mainKeys.map(main => {
      const middles = tree[main];
      const middleKeys = Object.keys(middles).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));

      return `
        <div class="knx-tree-main">
          <div class="knx-tree-node knx-node-main">
            <span class="knx-tree-arrow">▾</span>
            <span class="knx-tree-folder-icon">📁</span>
            <strong>${esc(tr('Hauptgruppe', 'Main Group'))} ${esc(main)}</strong>
          </div>
          <div class="knx-tree-children">
            ${middleKeys.map(mid => {
              const subGroups = middles[mid].sort(
                (a, b) => (knxGroupAddress(a.address) ?? 0) - (knxGroupAddress(b.address) ?? 0)
              );
              return `
                <div class="knx-tree-middle">
                  <div class="knx-tree-node knx-node-mid">
                    <span class="knx-tree-arrow">▾</span>
                    <span class="knx-tree-folder-icon">📂</span>
                    <span>${esc(tr('Mittelgruppe', 'Middle Group'))} ${esc(main)}/${esc(mid)}</span>
                  </div>
                  <div class="knx-tree-subgroups">
                    ${subGroups.map(g => {
                      const isSelected = this.selectedGroupId === g.id;
                      const gIssues = issues.filter(i => i.entity === 'knxGroups' && i.recordId === g.id);
                      return `
                        <div class="knx-tree-leaf ${isSelected ? 'is-selected' : ''}"
                             data-select-knx-group="${esc(g.id)}"
                             role="button" tabindex="0">
                          <span class="knx-addr-badge font-mono">${esc(g.address)}</span>
                          <span class="knx-leaf-name">${esc(g.name)}</span>
                          ${g.dpt ? `<span class="knx-dpt-badge">${esc(g.dpt)}</span>` : ''}
                          ${gIssues.length ? `<span class="auto-nav-alert" title="${esc(gIssues.map(i => i.message).join('; '))}"></span>` : ''}
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

  private renderRouterView(
    group: KnxGroup,
    sendObjects: KnxObject[],
    recvObjects: KnxObject[],
    data: ReturnType<typeof automationData>,
    issues: AutomationIssue[]
  ): string {
    const gIssues = issues.filter(i => i.entity === 'knxGroups' && i.recordId === group.id);
    const groupsById = new Map(data.knxGroups.map(g => [g.id, g]));

    return `
      <div class="knx-router-card">
        <!-- Aktive Gruppenadresse Header -->
        <div class="knx-group-detail-header">
          <div class="knx-group-main-meta">
            <input class="form-input knx-group-addr-input font-mono"
                   type="text"
                   value="${esc(group.address)}"
                   data-inplace-group="${esc(group.id)}"
                   data-group-field="address"
                   aria-label="${esc(tr('Gruppenadresse', 'Group Address'))}">
            <div class="knx-group-name-box">
              <input class="form-input knx-group-name-input"
                     type="text"
                     value="${esc(group.name)}"
                     data-inplace-group="${esc(group.id)}"
                     data-group-field="name">
              <span class="knx-network-tag">${esc(group.network)}</span>
            </div>
          </div>

          <div class="knx-group-sub-meta">
            <label class="knx-meta-inline">
              <span>DPT:</span>
              <input class="form-input font-mono"
                     type="text"
                     list="knxCommonDpts"
                     value="${esc(group.dpt || '')}"
                     placeholder="1.001"
                     data-inplace-group="${esc(group.id)}"
                     data-group-field="dpt">
            </label>
            <button class="btn btn-xs btn-outline" data-knx-action="delete-group" data-group-id="${esc(group.id)}">
              🗑 ${esc(tr('Gruppe löschen', 'Delete Group'))}
            </button>
          </div>
        </div>

        ${gIssues.map(i => `<div class="plc-inspector-alert">⚠ ${esc(i.message)}</div>`).join('')}

        <!-- Signal Flow Visualization (Sender -> Bus -> Empfänger) -->
        <div class="knx-flow-container">
          <!-- Sendende K.O.s -->
          <div class="knx-flow-lane knx-lane-send">
            <div class="knx-lane-header">
              <span class="knx-lane-badge send">S</span>
              <h5>${esc(tr('Sender (Sensoren/Taster)', 'Senders (Sensors/Switches)'))}</h5>
              <span class="knx-lane-count">${sendObjects.length}</span>
            </div>
            <div class="knx-lane-items">
              ${sendObjects.length
                ? sendObjects.map(o => this.renderObjectCard(o, data, groupsById, issues)).join('')
                : `<div class="knx-lane-empty">${esc(tr('Keine sendenden Objekte zugewiesen', 'No sending objects linked'))}</div>`}
            </div>
          </div>

          <!-- Center Bus Arrow -->
          <div class="knx-flow-arrow">
            <div class="knx-arrow-line"></div>
            <span class="knx-arrow-badge" title="KNX Telegramm">⟶</span>
          </div>

          <!-- Empfangende K.O.s -->
          <div class="knx-flow-lane knx-lane-recv">
            <div class="knx-lane-header">
              <span class="knx-lane-badge recv">E</span>
              <h5>${esc(tr('Empfänger (Aktoren/Status)', 'Receivers (Actuators/Status)'))}</h5>
              <span class="knx-lane-count">${recvObjects.length}</span>
            </div>
            <div class="knx-lane-items">
              ${recvObjects.length
                ? recvObjects.map(o => this.renderObjectCard(o, data, groupsById, issues)).join('')
                : `<div class="knx-lane-empty">${esc(tr('Keine empfangenden Objekte zugewiesen', 'No receiving objects linked'))}</div>`}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderObjectCard(
    obj: KnxObject,
    data: ReturnType<typeof automationData>,
    groupsById: Map<string, KnxGroup>,
    issues: AutomationIssue[]
  ): string {
    const node = data.nodes.find(n => n.id === obj.nodeId);
    const oIssues = issues.filter(i => i.entity === 'knxObjects' && i.recordId === obj.id);
    const otherGroupAddrs = data.knxObjects
      .filter(
        other =>
          other.id !== obj.id &&
          other.nodeId === obj.nodeId &&
          Number(other.number) === Number(obj.number)
      )
      .map(other => groupsById.get(other.groupId)?.address)
      .filter((addr): addr is string => !!addr);

    return `
      <div class="knx-object-card ${oIssues.length ? 'has-issue' : ''}">
        <div class="knx-obj-top">
          <span class="knx-obj-num">K.O. ${esc(obj.number)}</span>
          <span class="knx-obj-device" title="${esc(node?.name || '')}">${esc(node?.name || tr('Gerät fehlt', 'Device missing'))} <small>(${esc(node?.address || '—')})</small></span>
          <button class="btn btn-xs knx-btn-unlink"
                  data-knx-action="unlink-object"
                  data-object-id="${esc(obj.id)}"
                  title="${esc(tr('Verknüpfung zur Gruppenadresse lösen', 'Unlink from group address'))}">
            ✕
          </button>
        </div>

        <div class="knx-obj-edit-row">
          <input type="text"
                 class="knx-obj-edit-name"
                 data-knx-obj-field="name"
                 data-object-id="${esc(obj.id)}"
                 value="${esc(obj.name || `Objekt ${obj.number}`)}"
                 aria-label="${esc(tr('Objektname', 'Object Name'))}">
          <input type="text"
                 list="knxCommonDpts"
                 class="knx-obj-edit-dpt font-mono"
                 data-knx-obj-field="dpt"
                 data-object-id="${esc(obj.id)}"
                 value="${esc(obj.dpt)}"
                 placeholder="DPT"
                 aria-label="DPT">
          <select class="knx-obj-edit-dir"
                  data-knx-obj-field="direction"
                  data-object-id="${esc(obj.id)}"
                  aria-label="${esc(tr('K.O.-Richtung', 'Object Direction'))}">
            <option value="send" ${obj.direction === 'send' ? 'selected' : ''}>S · Senden</option>
            <option value="receive" ${obj.direction === 'receive' ? 'selected' : ''}>E · Empfangen</option>
            <option value="both" ${obj.direction === 'both' ? 'selected' : ''}>S/E · Beides</option>
          </select>
        </div>

        ${otherGroupAddrs.length ? `
          <div class="knx-obj-also-in">auch in: ${otherGroupAddrs.map(a => `<span>${esc(a)}</span>`).join(' ')}</div>
        ` : ''}
        ${oIssues.map(i => `<div class="knx-obj-issue-text">⚠ ${esc(i.message)}</div>`).join('')}
      </div>
    `;
  }

  private renderDevicesView(
    knxNodes: BusNode[],
    selectedGroup: KnxGroup | undefined,
    data: ReturnType<typeof automationData>,
    issues: AutomationIssue[]
  ): string {
    if (!knxNodes.length) {
      return `
        <div class="knx-col-empty">
          <p>${esc(tr('Noch keine KNX-Busteilnehmer angelegt.', 'No KNX bus nodes created yet.'))}</p>
          <button class="btn btn-primary" data-knx-action="new-knx-node">+ ${esc(tr('KNX-Gerät anlegen', 'Create KNX Device'))}</button>
        </div>
      `;
    }

    const groupsById = new Map(data.knxGroups.map(g => [g.id, g]));

    return knxNodes.map(node => {
      const objects = data.knxObjects.filter(o => o.nodeId === node.id);
      const nIssues = issues.filter(i => i.entity === 'nodes' && i.recordId === node.id);

      const byNumber = new Map<string, KnxObject[]>();
      for (const o of objects) {
        const key = String(Number.isFinite(Number(o.number)) ? Number(o.number) : o.number);
        const list = byNumber.get(key) ?? [];
        list.push(o);
        byNumber.set(key, list);
      }
      const uniqueObjects = Array.from(byNumber.entries())
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([, list]) => list);

      const suggested: KnxObjectTemplate[] = selectedGroup
        ? suggestedKnxTemplatesForNode(node, objects).slice(0, 6)
        : [];

      return `
        <div class="knx-device-card">
          <div class="knx-dev-header">
            <div>
              <strong>${esc(node.name)}</strong>
              <small class="font-mono">${esc(node.address || '—')} · ${esc(node.protocol)}</small>
            </div>
            <div class="knx-dev-add-row">
              <select class="knx-dir-mini" data-knx-new-obj-dir="${esc(node.id)}" aria-label="${esc(tr('Standardrichtung', 'Default direction'))}">
                <option value="both">S+E</option>
                <option value="send">S</option>
                <option value="receive">E</option>
              </select>
              <button class="btn btn-xs" data-knx-action="add-object-to-device" data-node-id="${esc(node.id)}" title="${esc(tr('Neues K.O. anlegen', 'Create comm object'))}">
                + K.O.
              </button>
            </div>
          </div>

          ${nIssues.map(i => `<div class="knx-obj-issue-text" style="padding:4px 8px">⚠ ${esc(i.message)}</div>`).join('')}

          <div class="knx-dev-objects">
            ${uniqueObjects.map(groupLinks => {
              const rep = groupLinks.find(o => selectedGroup && o.groupId === selectedGroup.id) ?? groupLinks[0];
              const isLinkedToActive = !!selectedGroup && groupLinks.some(o => o.groupId === selectedGroup.id);

              return `
                <div class="knx-dev-obj-row ${isLinkedToActive ? 'is-linked-current' : ''}">
                  <div class="knx-dev-obj-main">
                    <span class="knx-dev-obj-badge font-mono">#${esc(rep.number)}</span>
                    <span class="knx-dev-dir-pill dir-${esc(rep.direction)}">${esc(formatDirectionShort(rep.direction))}</span>
                    <span class="knx-dev-obj-name" title="${esc(rep.name)}">${esc(rep.name || `K.O. ${rep.number}`)}</span>
                    ${rep.dpt ? `<span class="knx-dev-obj-dpt">${esc(rep.dpt)}</span>` : ''}

                    ${selectedGroup ? (
                      isLinkedToActive
                        ? `<span class="knx-linked-badge">✓ ${esc(selectedGroup.address)}</span>`
                        : `<button class="btn btn-xs btn-outline knx-btn-assign" data-knx-action="assign-object-to-group" data-object-id="${esc(rep.id)}" title="${esc(tr('Diesem K.O. zusätzlich die aktive Gruppenadresse zuweisen', 'Link this object to active group address'))}">+ ${esc(tr('Zuordnen', 'Assign'))}</button>`
                    ) : ''}
                  </div>
                  <div class="knx-dev-group-chips">
                    ${groupLinks.map(link => {
                      const grp = groupsById.get(link.groupId);
                      if (!grp) return '';
                      const active = selectedGroup?.id === grp.id;
                      return `<span class="knx-dev-group-chip ${active ? 'is-active' : ''}">${esc(grp.address)}</span>`;
                    }).join('')}
                  </div>
                </div>
              `;
            }).join('')}
            ${!uniqueObjects.length ? `<div class="knx-dev-no-objects">${esc(tr('Keine K.O.s vorhanden.', 'No comm objects.'))}</div>` : ''}

            ${selectedGroup && suggested.length ? `
              <div class="knx-suggested-list">
                <div class="knx-suggested-title">${esc(tr('Vorgeschlagene Geräte-K.O. anlegen:', 'Quick-add suggested device objects:'))}</div>
                ${suggested.map(tpl => `
                  <button type="button"
                          class="knx-suggested-btn"
                          data-knx-suggest-node="${esc(node.id)}"
                          data-knx-suggest-num="${esc(tpl.number)}"
                          data-knx-suggest-name="${esc(tpl.name)}"
                          data-knx-suggest-dpt="${esc(tpl.dpt)}"
                          data-knx-suggest-dir="${esc(tpl.direction)}">
                    <span>+ #${esc(tpl.number)} ${esc(tpl.name)}</span>
                    <small>${esc(tpl.dpt)} · ${esc(formatDirectionShort(tpl.direction))}</small>
                  </button>
                `).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  bind(root: HTMLElement) {
    const netSel = root.querySelector<HTMLSelectElement>('[data-knx-network]');
    if (netSel) {
      netSel.onchange = () => {
        this.selectedNetwork = netSel.value;
        this.selectedGroupId = '';
        this.presetMenuOpen = false;
        this.etsMenuOpen = false;
        this.callbacks.onUpdateProject(this.getProject());
      };
    }

    const searchInput = root.querySelector<HTMLInputElement>('[data-knx-filter="search"]');
    if (searchInput) {
      searchInput.oninput = () => {
        this.searchQuery = searchInput.value;
        this.callbacks.onUpdateProject(this.getProject());
      };
    }

    const issuesCheck = root.querySelector<HTMLInputElement>('[data-knx-filter="issues"]');
    if (issuesCheck) {
      issuesCheck.onchange = () => {
        this.issuesOnly = issuesCheck.checked;
        this.callbacks.onUpdateProject(this.getProject());
      };
    }

    root.querySelectorAll<HTMLInputElement>('[data-inplace-group]').forEach(input => {
      input.onchange = () => {
        const gid = input.getAttribute('data-inplace-group')!;
        const field = input.getAttribute('data-group-field')!;
        this.updateGroupField(gid, field, input.value);
      };
    });

    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-knx-obj-field]').forEach(el => {
      el.onchange = () => {
        const oid = el.getAttribute('data-object-id')!;
        const field = el.getAttribute('data-knx-obj-field')!;
        this.updateObjectField(oid, field, el.value);
      };
    });

    const xmlInput = root.querySelector<HTMLInputElement>('[data-knx-ets-file]');
    if (xmlInput) {
      xmlInput.onchange = async () => {
        const file = xmlInput.files?.[0];
        xmlInput.value = '';
        if (!file) return;
        await this.handleXmlImport(file);
      };
    }

    root.onclick = e => {
      const target = e.target as HTMLElement;

      const presetBtn = target.closest<HTMLElement>('[data-knx-preset]');
      if (presetBtn) {
        const preset = KNX_DEVICE_PRESETS.find(p => p.id === presetBtn.dataset.knxPreset);
        this.presetMenuOpen = false;
        if (preset) this.applyKnxDevicePreset(preset);
        return;
      }

      const suggestBtn = target.closest<HTMLElement>('[data-knx-suggest-node]');
      if (suggestBtn) {
        const nodeId = suggestBtn.dataset.knxSuggestNode;
        const number = suggestBtn.dataset.knxSuggestNum;
        const name = suggestBtn.dataset.knxSuggestName;
        const dpt = suggestBtn.dataset.knxSuggestDpt ?? '';
        const direction = (suggestBtn.dataset.knxSuggestDir as KnxObject['direction']) ?? 'both';
        if (nodeId && number && name) {
          this.addSuggestedObjectToDevice(nodeId, {number, name, dpt, direction});
        }
        return;
      }

      if (target.closest('[data-knx-action="dismiss-banner"]')) {
        this.xmlPreviewMsg = '';
        this.callbacks.onUpdateProject(this.getProject());
        return;
      }

      const groupLeaf = target.closest<HTMLElement>('[data-select-knx-group]');
      if (groupLeaf) {
        this.selectedGroupId = groupLeaf.getAttribute('data-select-knx-group')!;
        this.presetMenuOpen = false;
        this.etsMenuOpen = false;
        this.callbacks.onUpdateProject(this.getProject());
        return;
      }

      if (target.closest('[data-knx-action="toggle-ets-menu"]')) {
        this.etsMenuOpen = !this.etsMenuOpen;
        this.presetMenuOpen = false;
        this.callbacks.onUpdateProject(this.getProject());
        return;
      }

      if (target.closest('[data-knx-action="toggle-preset-menu"]')) {
        this.presetMenuOpen = !this.presetMenuOpen;
        this.etsMenuOpen = false;
        this.callbacks.onUpdateProject(this.getProject());
        return;
      }

      if (target.closest('[data-knx-action="new-group"]')) {
        this.createNewGroup();
        return;
      }

      if (target.closest('[data-knx-action="add-starter-groups"]')) {
        this.addStarterGroups();
        return;
      }

      const delBtn = target.closest<HTMLElement>('[data-knx-action="delete-group"]');
      if (delBtn) {
        this.deleteGroup(delBtn.getAttribute('data-group-id')!);
        return;
      }

      const unlinkBtn = target.closest<HTMLElement>('[data-knx-action="unlink-object"]');
      if (unlinkBtn) {
        this.unlinkObject(unlinkBtn.getAttribute('data-object-id')!);
        return;
      }

      const assignBtn = target.closest<HTMLElement>('[data-knx-action="assign-object-to-group"]');
      if (assignBtn) {
        this.assignObjectToGroup(assignBtn.getAttribute('data-object-id')!);
        return;
      }

      const addObjBtn = target.closest<HTMLElement>('[data-knx-action="add-object-to-device"]');
      if (addObjBtn) {
        const nodeId = addObjBtn.getAttribute('data-node-id')!;
        const dirSel = root.querySelector<HTMLSelectElement>(
          `[data-knx-new-obj-dir="${CSS.escape(nodeId)}"]`
        );
        const dir = (dirSel?.value as KnxObject['direction']) || 'both';
        this.addObjectToDevice(nodeId, dir);
        return;
      }

      if (target.closest('[data-knx-action="new-knx-node"]')) {
        this.createNewKnxNode();
        return;
      }

      if (target.closest('[data-knx-action="export-ets-xml"]')) {
        this.etsMenuOpen = false;
        this.exportEtsXml();
        return;
      }

      if (target.closest('[data-knx-action="import-ets-xml"]')) {
        this.etsMenuOpen = false;
        root.querySelector<HTMLInputElement>('[data-knx-ets-file]')?.click();
        return;
      }
    };
  }

  private applyKnxDevicePreset(preset: KnxDevicePreset) {
    try {
      const network = this.resolveActiveNetwork(this.getProject());
      const res = instantiateKnxDevicePreset(this.getProject(), preset, network);
      this.selectedNetwork = network;
      this.callbacks.onUpdateProject(res.next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private addStarterGroups() {
    try {
      const project = this.getProject();
      const network = this.resolveActiveNetwork(project);
      const res = instantiateKnxStarterGroups(project, network);
      if (res.added.length) {
        this.selectedGroupId = res.added[0].id;
        this.xmlPreviewMsg = `${res.added.length} ${tr('ETS-Standardgruppen in Netz', 'ETS starter groups added to')} "${network}" ${tr('angelegt.', 'network.')}`;
      } else {
        this.xmlPreviewMsg = tr(
          'Alle ETS-Standardgruppenadressen sind in diesem Netz bereits vorhanden.',
          'All ETS starter group addresses already exist in this network.'
        );
      }
      this.callbacks.onUpdateProject(res.next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private createNewGroup() {
    const project = this.getProject();
    const d = automationData(project);
    const network = this.resolveActiveNetwork(project);
    const id = crypto.randomUUID();
    const addr = nextFreeGroupAddress(d.knxGroups, network);

    const record: KnxGroup = {
      id,
      network,
      name: `Gruppe ${d.knxGroups.length + 1}`,
      address: addr,
      dpt: '1.001',
    };

    try {
      const next = editAutomation(project, {kind: 'save', entity: 'knxGroups', value: record});
      this.selectedGroupId = id;
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private deleteGroup(id: string) {
    try {
      const next = editAutomation(this.getProject(), {kind: 'remove', entity: 'knxGroups', id});
      if (this.selectedGroupId === id) this.selectedGroupId = '';
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private updateGroupField(id: string, field: string, value: string) {
    const existing = automationData(this.getProject()).knxGroups.find(g => g.id === id);
    if (!existing) return;
    const record: KnxGroup = {...existing, [field]: value};
    try {
      const next = editAutomation(this.getProject(), {kind: 'save', entity: 'knxGroups', value: record});
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private updateObjectField(id: string, field: string, value: string) {
    const existing = automationData(this.getProject()).knxObjects.find(o => o.id === id);
    if (!existing) return;
    const record: KnxObject = {
      ...existing,
      [field]: value,
    };
    try {
      const next = editAutomation(this.getProject(), {kind: 'save', entity: 'knxObjects', value: record});
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private unlinkObject(objId: string) {
    try {
      const next = editAutomation(this.getProject(), {kind: 'remove', entity: 'knxObjects', id: objId});
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private assignObjectToGroup(objId: string) {
    const project = this.getProject();
    const d = automationData(project);
    const activeNetwork = this.resolveActiveNetwork(project);
    const selectedGroup = d.knxGroups.find(
      g => g.id === this.selectedGroupId && g.network === activeNetwork
    );
    if (!selectedGroup) return;

    const source = d.knxObjects.find(o => o.id === objId);
    if (!source) return;

    const existingForGroup = d.knxObjects.find(
      o =>
        o.nodeId === source.nodeId &&
        Number(o.number) === Number(source.number) &&
        o.groupId === selectedGroup.id
    );
    if (existingForGroup) {
      this.callbacks.onUpdateProject(project);
      return;
    }

    const record: KnxObject = {
      id: crypto.randomUUID(),
      nodeId: source.nodeId,
      number: source.number,
      name: source.name,
      groupId: selectedGroup.id,
      dpt: source.dpt || selectedGroup.dpt || '1.001',
      direction: source.direction,
    };

    try {
      const next = editAutomation(project, {kind: 'save', entity: 'knxObjects', value: record});
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private addObjectToDevice(nodeId: string, direction: KnxObject['direction'] = 'both') {
    const project = this.getProject();
    const d = automationData(project);
    const activeNetwork = this.resolveActiveNetwork(project);
    const targetGroupId =
      this.selectedGroupId ||
      d.knxGroups.find(g => g.network === activeNetwork)?.id ||
      '';
    const grp = d.knxGroups.find(g => g.id === targetGroupId);
    if (!grp) {
      this.callbacks.onError(
        new Error(
          tr(
            'Bitte legen Sie zuerst mindestens eine KNX-Gruppenadresse in diesem Netz an, um Kommunikationsobjekte zuzuordnen.',
            'Please create a KNX group address first before adding communication objects.'
          )
        )
      );
      return;
    }

    const objNum = nextUniqueObjectNumber(d.knxObjects, nodeId);
    const record: KnxObject = {
      id: crypto.randomUUID(),
      nodeId,
      number: objNum,
      name: `Objekt ${objNum}`,
      groupId: grp.id,
      dpt: grp.dpt || '1.001',
      direction,
    };

    try {
      const next = editAutomation(project, {kind: 'save', entity: 'knxObjects', value: record});
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private addSuggestedObjectToDevice(nodeId: string, tpl: KnxObjectTemplate) {
    const project = this.getProject();
    const d = automationData(project);
    const grp = d.knxGroups.find(g => g.id === this.selectedGroupId);
    if (!grp) {
      this.callbacks.onError(
        new Error(
          tr(
            'Bitte wählen Sie zuerst links eine Gruppenadresse aus.',
            'Please select a target group address on the left first.'
          )
        )
      );
      return;
    }

    const resolvedDpt = grp.dpt
      ? !tpl.dpt || knxDpt(tpl.dpt) === knxDpt(grp.dpt)
        ? tpl.dpt || grp.dpt
        : tpl.dpt
      : tpl.dpt || '1.001';

    const record: KnxObject = {
      id: crypto.randomUUID(),
      nodeId,
      number: tpl.number,
      name: tpl.name,
      groupId: grp.id,
      dpt: resolvedDpt,
      direction: tpl.direction,
    };

    try {
      const next = editAutomation(project, {kind: 'save', entity: 'knxObjects', value: record});
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private createNewKnxNode() {
    const project = this.getProject();
    const d = automationData(project);
    const network = this.resolveActiveNetwork(project);
    const knxNodes = d.nodes.filter(n => isKnx(n.protocol));
    const idx = knxNodes.length + 1;
    const record: BusNode = {
      id: crypto.randomUUID(),
      name: `KNX-Gerät ${idx}`,
      network,
      protocol: 'KNX TP',
      address: `1.1.${Math.min(254, idx)}`,
    };

    try {
      const next = editAutomation(project, {kind: 'save', entity: 'nodes', value: record});
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private exportEtsXml() {
    try {
      const project = this.getProject();
      const network = this.resolveActiveNetwork(project);
      const {xml, notes} = exportKnxGroupXml(project, network, undefined, true);
      const blob = new Blob([xml], {type: 'application/xml;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name || 'schematico'}-${network}-grupppenadressen.xml`.replace(/[^a-zA-Z0-9._-]/g, '_');
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.xmlPreviewMsg = `✓ ETS-XML (${network}) exportiert.${notes.length ? ' ' + notes.join(' ') : ''}`;
      this.callbacks.onUpdateProject(project);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private async handleXmlImport(file: File) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.byteLength > knxXmlMaxBytes) {
        throw new Error('ETS-XML Datei ist größer als 4 MiB.');
      }
      const xml = decodeKnxGroupXml(bytes);
      const project = this.getProject();
      const network = this.resolveActiveNetwork(project);
      const preview = previewKnxGroupXml(project, xml, network, true);
      if (preview.issues.length || !preview.next) {
        const msg = preview.issues.map(i => `${i.address ? i.address + ': ' : ''}${i.message}`).join('\n');
        throw new Error(msg || 'Import abgebrochen.');
      }
      this.xmlPreviewMsg = `✓ ${preview.changes.length} Änderungen aus ETS-XML (${network}) übernommen (${preview.unchanged} unverändert).`;
      this.callbacks.onUpdateProject(preview.next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }
}
