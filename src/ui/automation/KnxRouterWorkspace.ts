import type {Project} from '../../model/types';
import {
  automationData,
  editAutomation,
  type KnxGroup,
  type KnxObject,
  type BusNode,
  type AutomationIssue
} from '../../model/Automation';
import {isKnx} from '../../model/BusProfiles';
import {
  decodeKnxGroupXml,
  previewKnxGroupXml,
  exportKnxGroupXml,
  knxXmlMaxBytes,
  type KnxXmlPreview
} from '../../model/KnxXmlExchange';
import {downloadArticleFile} from '../ArticleCatalogDialog';
import {ProjectIndex} from '../../model/ProjectIndex';
import {escapeSvg as esc} from '../../model/ImportedDrawing';
import {tr} from '../../i18n';

export interface KnxRouterWorkspaceCallbacks {
  onUpdateProject: (p: Project) => void;
  onNavigate: (pageId: string, componentId: string) => void;
  onError: (e: unknown) => void;
}

interface GroupTreeNode {
  key: string;
  label: string;
  children: (GroupTreeNode | KnxGroup)[];
  isLeaf?: boolean;
}

export class KnxRouterWorkspace {
  private selectedGroupId = '';
  private selectedObjectId = '';
  private searchQuery = '';
  private issuesOnly = false;
  private etsMenuOpen = false;

  constructor(
    private getProject: () => Project,
    private getIssues: () => AutomationIssue[],
    private getProjectIndex: () => ProjectIndex,
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

  public render(): string {
    const project = this.getProject();
    const data = automationData(project);
    const issues = this.getIssues();
    const index = this.getProjectIndex();

    if (!data.knxGroups.some(g => g.id === this.selectedGroupId) && data.knxGroups.length) {
      this.selectedGroupId = data.knxGroups[0].id;
    }
    const selectedGroup = data.knxGroups.find(g => g.id === this.selectedGroupId);

    // Filter groups
    const query = this.searchQuery.trim().toLowerCase();
    let filteredGroups = data.knxGroups;
    if (query) {
      const words = query.split(/\s+/).filter(Boolean);
      filteredGroups = filteredGroups.filter(g => {
        const text = `${g.address} ${g.name} ${g.dpt} ${g.network} ${g.description}`.toLowerCase();
        return words.every(w => text.includes(w));
      });
    }
    if (this.issuesOnly) {
      const issueGroupIds = new Set(issues.filter(i => i.entity === 'knxGroups').map(i => i.recordId));
      filteredGroups = filteredGroups.filter(g => issueGroupIds.has(g.id));
    }

    // Objects linked to current group
    const linkedObjects = selectedGroup
      ? data.knxObjects.filter(o => o.groupId === selectedGroup.id)
      : [];

    const sendObjects = linkedObjects.filter(o => o.direction === 'send' || o.direction === 'both');
    const recvObjects = linkedObjects.filter(o => o.direction === 'receive' || o.direction === 'both');

    // Available KNX Nodes & Objects
    const knxNodes = data.nodes.filter(n => isKnx(n.protocol));

    return `
      <div class="knx-router-workspace">
        <!-- Top Toolbar -->
        <div class="knx-router-toolbar">
          <div class="knx-router-toolbar-title">
            <h3>${esc(tr('Gebäudeautomation & KNX-Router', 'Building Automation & KNX Router'))}</h3>
            <span class="knx-stats-badge">${data.knxGroups.length} ${esc(tr('Gruppenadressen', 'Group Addresses'))} · ${data.knxObjects.length} ${esc(tr('K.O.s', 'Comm Objects'))}</span>
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
              <span class="knx-col-count">${knxNodes.length} ${esc(tr('Geräte', 'Devices'))}</span>
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
      return `<p class="auto-muted" style="padding:15px">${esc(tr('Keine Gruppenadressen im Filter.', 'No group addresses in filter.'))}</p>`;
    }

    // Build 3-level tree structure (Main/Middle/Sub)
    const tree: Record<string, Record<string, KnxGroup[]>> = {};

    for (const g of groups) {
      const parts = g.address.split('/').map(p => p.trim());
      const main = parts[0] || '0';
      const middle = parts.length > 2 ? parts[1] || '0' : '0';

      if (!tree[main]) tree[main] = {};
      if (!tree[main][middle]) tree[main][middle] = [];
      tree[main][middle].push(g);
    }

    const mainKeys = Object.keys(tree).sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });

    return mainKeys.map(main => {
      const middles = tree[main];
      const middleKeys = Object.keys(middles).sort((a, b) => {
        const na = parseInt(a, 10);
        const nb = parseInt(b, 10);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.localeCompare(b);
      });

      return `
        <div class="knx-tree-main">
          <div class="knx-tree-node knx-node-main">
            <span class="knx-tree-arrow">▾</span>
            <span class="knx-tree-folder-icon">📁</span>
            <strong>${esc(tr('Hauptgruppe', 'Main Group'))} ${esc(main)}</strong>
          </div>
          <div class="knx-tree-children">
            ${middleKeys.map(mid => {
              const subGroups = middles[mid].sort((a, b) => a.address.localeCompare(b.address, undefined, {numeric: true}));
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
                     value="${esc(group.dpt || '')}" 
                     placeholder="1.001" 
                     data-inplace-group="${esc(group.id)}" 
                     data-group-field="dpt">
            </label>
            <button class="btn btn-xs btn-outline" data-knx-action="delete-group" data-group-id="${esc(group.id)}">
              🗑 ${esc(tr('Gruppe löschen', 'Delete Group'))}
            </button>
          </div>

          ${gIssues.map(i => `<div class="plc-inspector-alert">⚠ ${esc(i.message)}</div>`).join('')}
        </div>

        <!-- Signalfluss: Senden (Sensoren / Taster) -> Gruppenadresse -> Empfangen (Aktoren) -->
        <div class="knx-flow-container">
          <!-- Senden -->
          <div class="knx-flow-lane knx-lane-send">
            <div class="knx-lane-header">
              <span class="knx-lane-badge send">S</span>
              <h5>${esc(tr('Senden (Sensoren / Taster)', 'Sending (Sensors / Inputs)'))}</h5>
              <span class="knx-lane-count">${sendObjects.length}</span>
            </div>
            <div class="knx-lane-items">
              ${sendObjects.length ? sendObjects.map(o => this.renderObjectCard(o, data, issues)).join('') : `
                <div class="knx-lane-empty">${esc(tr('Keine sendenden Objekte zugeordnet.', 'No sending objects linked.'))}</div>
              `}
            </div>
          </div>

          <!-- Flow Arrow Visualizer -->
          <div class="knx-flow-arrow">
            <div class="knx-arrow-line"></div>
            <span class="knx-arrow-badge">⇄</span>
          </div>

          <!-- Empfangen -->
          <div class="knx-flow-lane knx-lane-recv">
            <div class="knx-lane-header">
              <span class="knx-lane-badge recv">E</span>
              <h5>${esc(tr('Empfangen (Aktoren / Ausgänge)', 'Receiving (Actuators / Outputs)'))}</h5>
              <span class="knx-lane-count">${recvObjects.length}</span>
            </div>
            <div class="knx-lane-items">
              ${recvObjects.length ? recvObjects.map(o => this.renderObjectCard(o, data, issues)).join('') : `
                <div class="knx-lane-empty">${esc(tr('Keine empfangenden Objekte zugeordnet.', 'No receiving objects linked.'))}</div>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderObjectCard(
    obj: KnxObject,
    data: ReturnType<typeof automationData>,
    issues: AutomationIssue[]
  ): string {
    const node = data.nodes.find(n => n.id === obj.nodeId);
    const oIssues = issues.filter(i => i.entity === 'knxObjects' && i.recordId === obj.id);

    return `
      <div class="knx-object-card ${oIssues.length ? 'has-issue' : ''}">
        <div class="knx-obj-top">
          <span class="knx-obj-num">K.O. ${esc(obj.number)}</span>
          <span class="knx-obj-device" title="${esc(node?.name || '')}">${esc(node?.name || tr('Gerät fehlt', 'Device missing'))}</span>
          <button class="btn btn-xs knx-btn-unlink" 
                  data-knx-action="unlink-object" 
                  data-object-id="${esc(obj.id)}" 
                  title="${esc(tr('Verknüpfung zur Gruppenadresse lösen', 'Unlink from group address'))}">
            ✕
          </button>
        </div>
        <div class="knx-obj-name">${esc(obj.name || `Objekt ${obj.number}`)}</div>
        <div class="knx-obj-bottom">
          <span class="knx-obj-dir ${obj.direction}">
            ${obj.direction === 'both' ? 'Senden & Empfangen' : obj.direction === 'send' ? 'Senden' : 'Empfangen'}
          </span>
          ${obj.dpt ? `<span class="knx-obj-dpt">${esc(obj.dpt)}</span>` : ''}
        </div>
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

    return knxNodes.map(node => {
      const objects = data.knxObjects.filter(o => o.nodeId === node.id);
      return `
        <div class="knx-device-card">
          <div class="knx-dev-header">
            <div>
              <strong>${esc(node.name)}</strong>
              <small class="font-mono">${esc(node.address || '—')}</small>
            </div>
            <button class="btn btn-xs" data-knx-action="add-object-to-device" data-node-id="${esc(node.id)}" title="${esc(tr('Neues K.O. anlegen', 'Create comm object'))}">
              + K.O.
            </button>
          </div>

          <div class="knx-dev-objects">
            ${objects.map(obj => {
              const isLinkedToActive = selectedGroup && obj.groupId === selectedGroup.id;
              const linkedGroup = data.knxGroups.find(g => g.id === obj.groupId);

              return `
                <div class="knx-dev-obj-row ${isLinkedToActive ? 'is-linked-current' : ''}">
                  <span class="knx-dev-obj-badge font-mono">${esc(obj.number)}</span>
                  <span class="knx-dev-obj-name" title="${esc(obj.name)}">${esc(obj.name || `K.O. ${obj.number}`)}</span>
                  
                  ${selectedGroup ? `
                    ${isLinkedToActive ? `
                      <span class="knx-linked-badge">✓ ${esc(tr('Verknüpft', 'Linked'))}</span>
                    ` : `
                      <button class="btn btn-xs btn-outline knx-btn-assign" 
                              data-knx-action="assign-object-to-group" 
                              data-object-id="${esc(obj.id)}" 
                              title="${esc(tr('Diesem K.O. die aktive Gruppenadresse zuweisen', 'Assign active group address'))}">
                        + ${esc(tr('Zuordnen', 'Assign'))}
                      </button>
                    `}
                  ` : ''}
                </div>
              `;
            }).join('')}
            ${!objects.length ? `<div class="knx-dev-no-objects">${esc(tr('Keine K.O.s vorhanden.', 'No comm objects.'))}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  public bind(root: HTMLElement) {
    // Search input
    const searchInput = root.querySelector<HTMLInputElement>('[data-knx-filter="search"]');
    if (searchInput) {
      searchInput.oninput = () => {
        this.searchQuery = searchInput.value;
        this.callbacks.onUpdateProject(this.getProject());
      };
    }

    // Issues filter
    const issuesCheck = root.querySelector<HTMLInputElement>('[data-knx-filter="issues"]');
    if (issuesCheck) {
      issuesCheck.onchange = () => {
        this.issuesOnly = issuesCheck.checked;
        this.callbacks.onUpdateProject(this.getProject());
      };
    }

    // In-place group edits
    root.onchange = e => {
      const target = e.target as HTMLInputElement;
      if (target.hasAttribute('data-inplace-group')) {
        const gId = target.dataset.inplaceGroup!;
        const field = target.dataset.groupField!;
        this.updateGroupField(gId, field, target.value);
      }
    };

    // Click events
    root.onclick = async e => {
      const target = e.target as HTMLElement;

      // Toggle ETS Menu
      if (target.closest('[data-knx-action="toggle-ets-menu"]')) {
        this.etsMenuOpen = !this.etsMenuOpen;
        root.querySelector('.knx-ets-dropdown-menu')?.classList.toggle('is-open', this.etsMenuOpen);
        return;
      }
      if (!target.closest('.knx-ets-dropdown-wrap') && this.etsMenuOpen) {
        this.etsMenuOpen = false;
        root.querySelector('.knx-ets-dropdown-menu')?.classList.remove('is-open');
      }

      // Group Selection in Tree
      const groupLeaf = target.closest<HTMLElement>('[data-select-knx-group]');
      if (groupLeaf) {
        this.selectedGroupId = groupLeaf.dataset.selectKnxGroup!;
        this.callbacks.onUpdateProject(this.getProject());
        return;
      }

      // New Group Action
      if (target.closest('[data-knx-action="new-group"]')) {
        this.createNewGroup();
        return;
      }

      // Delete Group Action
      const delGroup = target.closest<HTMLElement>('[data-knx-action="delete-group"]');
      if (delGroup) {
        this.deleteGroup(delGroup.dataset.groupId!);
        return;
      }

      // Unlink Object Action
      const unlinkBtn = target.closest<HTMLElement>('[data-knx-action="unlink-object"]');
      if (unlinkBtn) {
        this.unlinkObject(unlinkBtn.dataset.objectId!);
        return;
      }

      // Assign Object to Active Group
      const assignBtn = target.closest<HTMLElement>('[data-knx-action="assign-object-to-group"]');
      if (assignBtn && this.selectedGroupId) {
        this.assignObjectToGroup(assignBtn.dataset.objectId!, this.selectedGroupId);
        return;
      }

      // Add Object to Device
      const addObjBtn = target.closest<HTMLElement>('[data-knx-action="add-object-to-device"]');
      if (addObjBtn) {
        this.addObjectToDevice(addObjBtn.dataset.nodeId!);
        return;
      }

      // Create new KNX Node
      if (target.closest('[data-knx-action="new-knx-node"]')) {
        this.createNewKnxNode();
        return;
      }

      // ETS XML Import Action
      if (target.closest('[data-knx-action="import-ets-xml"]')) {
        this.etsMenuOpen = false;
        root.querySelector<HTMLInputElement>('[data-knx-ets-file]')?.click();
        return;
      }

      // ETS XML Export Action
      if (target.closest('[data-knx-action="export-ets-xml"]')) {
        this.etsMenuOpen = false;
        this.exportEtsXml();
        return;
      }
    };

    // ETS File Input
    const fileInput = root.querySelector<HTMLInputElement>('[data-knx-ets-file]');
    if (fileInput) {
      fileInput.onchange = async () => {
        const file = fileInput.files?.[0];
        fileInput.value = '';
        if (!file) return;

        try {
          if (file.size > knxXmlMaxBytes) {
            throw new Error(tr('Datei ist größer als 4 MiB.', 'File exceeds 4 MiB.'));
          }
          const xml = decodeKnxGroupXml(new Uint8Array(await file.arrayBuffer()));
          const preview = previewKnxGroupXml(this.getProject(), xml, 'KNX', true);
          if (preview.next) {
            this.callbacks.onUpdateProject(preview.next);
          }
        } catch (err) {
          this.callbacks.onError(err);
        }
      };
    }
  }

  private updateGroupField(groupId: string, field: string, value: string) {
    const project = this.getProject();
    const d = automationData(project);
    const group = d.knxGroups.find(g => g.id === groupId);
    if (!group) return;

    const updated: KnxGroup = {
      ...group,
      [field]: value.trim(),
    };

    try {
      const next = editAutomation(project, {
        kind: 'save',
        entity: 'knxGroups',
        value: updated,
      });
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private createNewGroup() {
    const project = this.getProject();
    const d = automationData(project);
    let n = 1;
    const makeAddr = (idx: number) => `1/${1 + Math.floor((idx - 1) / 255)}/${((idx - 1) % 255) + 1}`;
    while (
      d.knxGroups.some(
        g =>
          g.network === 'KNX' &&
          (g.address === makeAddr(n) || g.name === `${tr('Gruppenadresse', 'Group Address')} ${n}`)
      )
    ) {
      n++;
    }
    const newGroup: KnxGroup = {
      id: crypto.randomUUID(),
      network: 'KNX',
      name: `${tr('Gruppenadresse', 'Group Address')} ${n}`,
      address: makeAddr(n),
      dpt: '1.001',
    };

    try {
      const next = editAutomation(project, {
        kind: 'save',
        entity: 'knxGroups',
        value: newGroup,
      });
      this.selectedGroupId = newGroup.id;
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private deleteGroup(groupId: string) {
    try {
      const next = editAutomation(this.getProject(), {
        kind: 'remove',
        entity: 'knxGroups',
        id: groupId,
      });
      const d = automationData(next);
      this.selectedGroupId = d.knxGroups[0]?.id || '';
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private unlinkObject(objectId: string) {
    try {
      const next = editAutomation(this.getProject(), {
        kind: 'remove',
        entity: 'knxObjects',
        id: objectId,
      });
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private assignObjectToGroup(objectId: string, groupId: string) {
    const project = this.getProject();
    const d = automationData(project);
    const obj = d.knxObjects.find(o => o.id === objectId);
    if (!obj) return;

    const updated: KnxObject = {
      ...obj,
      groupId,
    };

    try {
      const next = editAutomation(project, {
        kind: 'save',
        entity: 'knxObjects',
        value: updated,
      });
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private addObjectToDevice(nodeId: string) {
    const project = this.getProject();
    const d = automationData(project);
    const targetGroupId = this.selectedGroupId || d.knxGroups[0]?.id || '';
    if (!targetGroupId) {
      this.callbacks.onError(new Error(tr('Zuerst eine KNX-Gruppenadresse anlegen.', 'Create a KNX group address first.')));
      return;
    }

    const existing = d.knxObjects.filter(o => o.nodeId === nodeId);
    let n = 1;
    while (existing.some(o => Number(o.number) === n)) n++;
    const num = String(n);

    const newObj: KnxObject = {
      id: crypto.randomUUID(),
      nodeId,
      number: num,
      name: `${tr('Objekt', 'Object')} ${num}`,
      groupId: targetGroupId,
      direction: 'send',
      dpt: '1.001',
    };

    try {
      const next = editAutomation(project, {
        kind: 'save',
        entity: 'knxObjects',
        value: newObj,
      });
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private createNewKnxNode() {
    const project = this.getProject();
    const d = automationData(project);
    let n = 1;
    while (
      d.nodes.some(
        node => node.network === 'KNX' && (node.name === `KNX-Gerät-${n}` || node.address === `1.1.${n}`)
      )
    ) {
      n++;
    }

    const newNode: BusNode = {
      id: crypto.randomUUID(),
      name: `KNX-Gerät-${n}`,
      network: 'KNX',
      protocol: 'KNX TP',
      address: `1.1.${n}`,
      interfaceRole: 'device',
    };

    try {
      const next = editAutomation(project, {
        kind: 'save',
        entity: 'nodes',
        value: newNode,
      });
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private exportEtsXml() {
    try {
      const project = this.getProject();
      const d = automationData(project);
      const allIds = new Set(d.knxGroups.map(g => g.id));
      const result = exportKnxGroupXml(project, 'KNX', allIds, true);
      downloadArticleFile(result.xml, 'schematico-knx-gruppenadressen.xml', 'application/xml;charset=utf-8');
    } catch (e) {
      this.callbacks.onError(e);
    }
  }
}
