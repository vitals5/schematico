import type {Project} from '../../model/types';
import {
  automationData,
  editAutomation,
  type BusNode,
  type BusLink,
  type AutomationIssue
} from '../../model/Automation';
import {
  automationBusGraph,
  automationBusRoutes,
  automationNetworkKey,
  type BusVisualGraph
} from '../AutomationVisuals';
import {busProtocols, busProtocolHelp, isLoxone, isKnx, type BusProtocol} from '../../model/BusProfiles';
import {ProjectIndex} from '../../model/ProjectIndex';
import {escapeSvg as esc} from '../../model/ImportedDrawing';
import {tr} from '../../i18n';

export interface BusTopologyWorkspaceCallbacks {
  onUpdateProject: (p: Project) => void;
  onNavigate: (pageId: string, componentId: string) => void;
  onError: (e: unknown) => void;
}

export class BusTopologyWorkspace {
  private selectedNetworkKey = '';
  private selectedNodeId = '';
  private selectedLinkId = '';
  private searchQuery = '';
  private issuesOnly = false;
  private pendingWire?: {fromNodeId: string; fromPort: string};

  constructor(
    private getProject: () => Project,
    private getIssues: () => AutomationIssue[],
    private getProjectIndex: () => ProjectIndex,
    private callbacks: BusTopologyWorkspaceCallbacks
  ) {
    this.initDefaultNetwork();
  }

  private initDefaultNetwork() {
    const d = automationData(this.getProject());
    if (d.nodes.length && !this.selectedNetworkKey) {
      this.selectedNetworkKey = automationNetworkKey(d.nodes[0]);
    }
  }

  public render(): string {
    const project = this.getProject();
    const data = automationData(project);
    const issues = this.getIssues();
    const index = this.getProjectIndex();

    // Group nodes by network key
    const networks = new Map<string, {network: string; protocol: string; count: number}>();
    for (const n of data.nodes) {
      const k = automationNetworkKey(n);
      const existing = networks.get(k);
      if (existing) {
        existing.count++;
      } else {
        networks.set(k, {network: n.network, protocol: n.protocol, count: 1});
      }
    }
    const networkList = [...networks.entries()].sort((a, b) => a[1].network.localeCompare(b[1].network));

    if (!networks.has(this.selectedNetworkKey) && networkList.length) {
      this.selectedNetworkKey = networkList[0][0];
    }

    const currentNet = networks.get(this.selectedNetworkKey) ?? {network: 'Default', protocol: 'Profinet', count: 0};
    const issueIds = this.issuesOnly ? new Set(issues.filter(i => i.entity === 'nodes' || i.entity === 'links').map(i => i.recordId)) : undefined;

    // Build Graph
    const graph: BusVisualGraph = this.selectedNetworkKey
      ? automationBusGraph(project, this.selectedNetworkKey, this.searchQuery, issueIds)
      : {nodes: [], edges: [], width: 900, height: 300, omitted: 0, omittedEdges: 0};

    const routes = automationBusRoutes(graph);

    return `
      <div class="bus-topo-workspace">
        <!-- Top Toolbar -->
        <div class="bus-topo-toolbar">
          <div class="bus-topo-toolbar-network">
            <label>${esc(tr('Netzwerk & Protokoll:', 'Network & Protocol:'))}</label>
            <select class="form-input" data-bus-action="select-network">
              ${networkList.length
                ? networkList.map(([k, net]) => `
                  <option value="${esc(k)}" ${k === this.selectedNetworkKey ? 'selected' : ''}>
                    ${esc(net.network)} · ${esc(net.protocol)} (${net.count})
                  </option>
                `).join('')
                : `<option value="">${esc(tr('Noch kein Netzwerk', 'No network yet'))}</option>`}
            </select>
          </div>

          <div class="bus-topo-toolbar-actions">
            <input class="form-input bus-search-input" 
                   type="search" 
                   placeholder="${esc(tr('Teilnehmer / Adresse suchen…', 'Search node / address…'))}" 
                   value="${esc(this.searchQuery)}" 
                   data-bus-filter="search">

            <label class="eng-check">
              <input type="checkbox" data-bus-filter="issues" ${this.issuesOnly ? 'checked' : ''}>
              ${esc(tr('Nur Hinweise', 'Only warnings'))}
            </label>

            <button class="btn btn-primary" data-bus-action="new-node">
              + ${esc(tr('Neuer Teilnehmer', 'New Node'))}
            </button>
            <button class="btn" data-bus-action="new-link">
              + ${esc(tr('Neue Verbindung', 'New Link'))}
            </button>
          </div>
        </div>

        ${this.pendingWire ? `
          <div class="bus-wire-prompt">
            <span>⚡ ${esc(tr('Port ausgewählt:', 'Port selected:'))} <strong>${esc(data.nodes.find(n => n.id === this.pendingWire!.fromNodeId)?.name || '?')} [${esc(this.pendingWire!.fromPort)}]</strong>. ${esc(tr('Klicken Sie auf den Zielport eines anderen Teilnehmers zum Verbinden.', 'Click target port on another node to connect.'))}</span>
            <button class="btn btn-xs" data-bus-action="cancel-wire">${esc(tr('Abbrechen', 'Cancel'))}</button>
          </div>
        ` : ''}

        <div class="bus-topo-main-area">
          <!-- Canvas Topologie Graph -->
          <div class="bus-topo-canvas-container">
            <div class="bus-topo-canvas-wrap">
              ${this.renderSvgCanvas(graph, routes, data, issues)}
            </div>

            <!-- Legende & Statuszeile -->
            <div class="bus-topo-legend">
              <span class="bus-legend-item"><span class="line-wire"></span> ${esc(tr('Busleitung (Kupfer/LWL)', 'Bus cable'))}</span>
              <span class="bus-legend-item"><span class="line-air"></span> ${esc(tr('Funkzuordnung (Air)', 'Wireless'))}</span>
              <span class="bus-legend-item"><span class="line-assign"></span> ${esc(tr('Segmentzuordnung', 'Segment link'))}</span>
              <span class="bus-legend-stats">
                ${graph.nodes.length} / ${currentNet.count} ${esc(tr('Teilnehmer', 'Nodes'))} · ${graph.edges.length} ${esc(tr('Verbindungen', 'Links'))}
              </span>
            </div>
          </div>

          <!-- Rechter Inspektor -->
          <aside class="bus-topo-inspector">
            <header class="bus-inspector-header">
              <h4>${esc(tr('Eigenschaften & Details', 'Properties & Details'))}</h4>
            </header>
            <div class="bus-inspector-body">
              ${this.renderInspector(data, index, issues)}
            </div>
          </aside>
        </div>
      </div>
    `;
  }

  private renderSvgCanvas(
    graph: BusVisualGraph,
    routes: ReturnType<typeof automationBusRoutes>,
    data: ReturnType<typeof automationData>,
    issues: AutomationIssue[]
  ): string {
    if (!graph.nodes.length) {
      return `
        <div class="bus-canvas-empty">
          <p>${esc(tr('Keine Busteilnehmer im aktuellen Netzwerk oder Filter gefunden.', 'No bus nodes found in current network or filter.'))}</p>
          <button class="btn btn-primary" data-bus-action="new-node">+ ${esc(tr('Ersten Busteilnehmer anlegen', 'Create first bus node'))}</button>
        </div>
      `;
    }

    const w = Math.max(graph.width, 900);
    const h = Math.max(graph.height, 400);

    let edgesSvg = '';
    for (const r of routes) {
      const isSelected = this.selectedLinkId === r.edge.id;
      const isAir = r.edge.kind === 'air';
      const isAssign = r.edge.kind === 'assignment';
      const edgeClass = isAir ? 'bus-svg-edge--air' : isAssign ? 'bus-svg-edge--assign' : 'bus-svg-edge--wire';

      edgesSvg += `
        <g class="bus-svg-edge ${edgeClass} ${isSelected ? 'is-selected' : ''}" 
           data-bus-select-link="${esc(r.edge.id)}"
           role="button" tabindex="0">
          <title>${esc(r.edge.label || 'Verbindung')}</title>
          <path d="${r.path}" class="bus-edge-hit-area" />
          <path d="${r.path}" class="bus-edge-line" />
        </g>
      `;
    }

    let nodesSvg = '';
    for (const n of graph.nodes) {
      const isSelected = this.selectedNodeId === n.id;
      const nIssues = issues.filter(i => i.entity === 'nodes' && i.recordId === n.id);
      const isInterface = n.interfaceRole === 'interface';
      const isPending = this.pendingWire?.fromNodeId === n.id;

      const defaultPorts = isLoxone(n.protocol)
        ? (n.protocol === 'Loxone Air' ? ['Air'] : ['Tree 1', 'Tree 2'])
        : isKnx(n.protocol)
        ? ['KNX TP']
        : ['X1P1', 'X1P2'];

      nodesSvg += `
        <g class="bus-svg-node ${isSelected ? 'is-selected' : ''} ${nIssues.length ? 'has-issues' : ''} ${isPending ? 'is-pending-source' : ''}"
           transform="translate(${n.x}, ${n.y})"
           data-bus-select-node="${esc(n.id)}"
           role="button" tabindex="0">
          <rect width="212" height="76" rx="8" class="bus-node-box" />
          <circle cx="16" cy="18" r="5" class="bus-node-status-dot" />
          <text x="28" y="22" class="bus-node-name">${esc(n.name.length > 20 ? n.name.slice(0, 19) + '…' : n.name)}</text>
          <text x="14" y="42" class="bus-node-addr">${esc(n.address || n.ipAddress || tr('Adresse unkonfiguriert', 'No address'))}</text>
          <text x="14" y="62" class="bus-node-meta">${esc(isInterface ? tr('Schnittstelle / Interface', 'Interface') : n.protocol)}</text>

          <!-- Ports for interactive wiring -->
          <g class="bus-node-ports" transform="translate(140, 48)">
            ${defaultPorts.map((pName, pIdx) => {
              const isPortPending = this.pendingWire?.fromNodeId === n.id && this.pendingWire?.fromPort === pName;
              return `
                <g class="bus-port-pin ${isPortPending ? 'is-active-port' : ''}" 
                   transform="translate(${pIdx * 32}, 0)" 
                   data-port-click-node="${esc(n.id)}" 
                   data-port-click-name="${esc(pName)}"
                   title="${esc(tr('Port:', 'Port:'))} ${esc(pName)}">
                  <rect x="-4" y="-8" width="28" height="18" rx="3" class="bus-port-bg" />
                  <text x="10" y="5" text-anchor="middle" class="bus-port-text">${esc(pName.slice(0, 4))}</text>
                </g>
              `;
            }).join('')}
          </g>
        </g>
      `;
    }

    return `
      <svg class="bus-topo-svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
        <defs>
          <pattern id="bus-topo-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#2d4257" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#bus-topo-grid)" />
        <g class="bus-edges-layer">${edgesSvg}</g>
        <g class="bus-nodes-layer">${nodesSvg}</g>
      </svg>
    `;
  }

  private renderInspector(data: ReturnType<typeof automationData>, index: ProjectIndex, issues: AutomationIssue[]): string {
    // 1. Link Selected
    if (this.selectedLinkId) {
      const link = data.links.find(l => l.id === this.selectedLinkId);
      if (link) {
        const fromNode = data.nodes.find(n => n.id === link.from);
        const toNode = data.nodes.find(n => n.id === link.to);
        const lIssues = issues.filter(i => i.entity === 'links' && i.recordId === link.id);

        return `
          <div class="bus-inspector-section">
            <div class="bus-inspector-title">
              <strong>${esc(tr('Busverbindung', 'Bus Link'))}</strong>
              <small>${esc(fromNode?.name || '?')} ↔ ${esc(toNode?.name || '?')}</small>
            </div>

            ${lIssues.map(i => `<div class="plc-inspector-alert">⚠ ${esc(i.message)}</div>`).join('')}

            <div class="plc-form-group">
              <label>${esc(tr('Von Teilnehmer', 'From Node'))}</label>
              <select class="form-input" data-inspect-link="from">
                ${data.nodes.map(n => `<option value="${esc(n.id)}" ${n.id === link.from ? 'selected' : ''}>${esc(n.name)}</option>`).join('')}
              </select>
            </div>

            <div class="plc-form-group">
              <label>${esc(tr('Von Port', 'From Port'))}</label>
              <input class="form-input" type="text" data-inspect-link="fromPort" value="${esc(link.fromPort || '')}">
            </div>

            <div class="plc-form-group">
              <label>${esc(tr('Zu Teilnehmer', 'To Node'))}</label>
              <select class="form-input" data-inspect-link="to">
                ${data.nodes.map(n => `<option value="${esc(n.id)}" ${n.id === link.to ? 'selected' : ''}>${esc(n.name)}</option>`).join('')}
              </select>
            </div>

            <div class="plc-form-group">
              <label>${esc(tr('Zu Port', 'To Port'))}</label>
              <input class="form-input" type="text" data-inspect-link="toPort" value="${esc(link.toPort || '')}">
            </div>

            <div class="plc-form-group">
              <label>${esc(tr('Kabellänge (m)', 'Cable length (m)'))}</label>
              <input class="form-input" type="number" min="0" step="any" data-inspect-link="lengthM" value="${esc(String(link.lengthM ?? ''))}">
            </div>

            <div class="plc-inspector-actions">
              <button class="btn btn-sm btn-primary" data-bus-action="save-inspector-link">${esc(tr('Speichern', 'Save'))}</button>
              <button class="btn btn-sm btn-outline" data-bus-action="delete-selected-link">${esc(tr('Löschen', 'Delete'))}</button>
            </div>
          </div>
        `;
      }
    }

    // 2. Node Selected
    if (this.selectedNodeId) {
      const node = data.nodes.find(n => n.id === this.selectedNodeId);
      if (node) {
        const nIssues = issues.filter(i => i.entity === 'nodes' && i.recordId === node.id);
        const loxone = isLoxone(node.protocol);

        return `
          <div class="bus-inspector-section">
            <div class="bus-inspector-title">
              <strong>${esc(node.name)}</strong>
              <small>${esc(node.network)} · ${esc(node.protocol)}</small>
            </div>

            ${nIssues.map(i => `<div class="plc-inspector-alert">⚠ ${esc(i.message)}</div>`).join('')}

            <div class="plc-form-group">
              <label>${esc(tr('Teilnehmername', 'Node Name'))}</label>
              <input class="form-input" type="text" data-inspect-node="name" value="${esc(node.name)}">
            </div>

            <div class="plc-form-group">
              <label>${esc(tr('Netzname', 'Network Name'))}</label>
              <input class="form-input" type="text" data-inspect-node="network" value="${esc(node.network)}">
            </div>

            <div class="plc-form-group">
              <label>${esc(tr('Protokoll', 'Protocol'))}</label>
              <select class="form-input" data-inspect-node="protocol">
                ${busProtocols.map(p => `<option value="${esc(p)}" ${p === node.protocol ? 'selected' : ''}>${esc(p)}</option>`).join('')}
              </select>
            </div>

            <div class="plc-form-group">
              <label>${esc(tr('Busadresse', 'Bus Address'))}</label>
              <input class="form-input" type="text" data-inspect-node="address" value="${esc(node.address || '')}">
            </div>

            ${!loxone ? `
              <div class="plc-form-group">
                <label>${esc(tr('IP-Adresse', 'IP Address'))}</label>
                <input class="form-input font-mono" type="text" data-inspect-node="ipAddress" value="${esc(node.ipAddress || '')}">
              </div>
            ` : ''}

            <div class="plc-form-group">
              <label>${esc(tr('Zugeordnete CPU (optional)', 'Assigned CPU (optional)'))}</label>
              <select class="form-input" data-inspect-node="controllerId">
                <option value="">${esc(tr('Keine CPU', 'None'))}</option>
                ${data.controllers.map(c => `<option value="${esc(c.id)}" ${c.id === node.controllerId ? 'selected' : ''}>${esc(c.bmk)}</option>`).join('')}
              </select>
            </div>

            <p class="auto-muted" style="margin:8px 0;font-size:10px">${esc(busProtocolHelp(node.protocol))}</p>

            <div class="plc-inspector-actions">
              <button class="btn btn-sm btn-primary" data-bus-action="save-inspector-node">${esc(tr('Speichern', 'Save'))}</button>
              <button class="btn btn-sm btn-outline" data-bus-action="delete-selected-node">${esc(tr('Teilnehmer löschen', 'Delete Node'))}</button>
            </div>
          </div>
        `;
      }
    }

    return `<p class="auto-muted" style="padding:15px">${esc(tr('Wählen Sie einen Teilnehmer oder eine Verbindung im Topologie-Graph aus.', 'Select a node or link on the topology canvas.'))}</p>`;
  }

  public bind(root: HTMLElement) {
    // Network selector change
    const netSelect = root.querySelector<HTMLSelectElement>('[data-bus-action="select-network"]');
    if (netSelect) {
      netSelect.onchange = () => {
        this.selectedNetworkKey = netSelect.value;
        this.selectedNodeId = '';
        this.selectedLinkId = '';
        this.callbacks.onUpdateProject(this.getProject());
      };
    }

    // Search filter
    const searchInput = root.querySelector<HTMLInputElement>('[data-bus-filter="search"]');
    if (searchInput) {
      searchInput.oninput = () => {
        this.searchQuery = searchInput.value;
        this.callbacks.onUpdateProject(this.getProject());
      };
    }

    // Issues only check
    const issuesCheck = root.querySelector<HTMLInputElement>('[data-bus-filter="issues"]');
    if (issuesCheck) {
      issuesCheck.onchange = () => {
        this.issuesOnly = issuesCheck.checked;
        this.callbacks.onUpdateProject(this.getProject());
      };
    }

    // Canvas click events
    root.onclick = e => {
      const target = e.target as HTMLElement;

      // Cancel wire creation
      if (target.closest('[data-bus-action="cancel-wire"]')) {
        this.pendingWire = undefined;
        this.callbacks.onUpdateProject(this.getProject());
        return;
      }

      // Port click on node (interactive wiring)
      const portPin = target.closest<Element>('[data-port-click-node]');
      if (portPin) {
        const nodeId = portPin.getAttribute('data-port-click-node')!;
        const portName = portPin.getAttribute('data-port-click-name')!;

        if (!this.pendingWire) {
          // Start wiring
          this.pendingWire = {fromNodeId: nodeId, fromPort: portName};
          this.callbacks.onUpdateProject(this.getProject());
        } else {
          // Complete wiring if different node
          if (this.pendingWire.fromNodeId === nodeId) {
            this.pendingWire = undefined;
            this.callbacks.onUpdateProject(this.getProject());
          } else {
            this.connectPorts(this.pendingWire.fromNodeId, this.pendingWire.fromPort, nodeId, portName);
          }
        }
        return;
      }

      // Select node
      const nodeEl = target.closest<Element>('[data-bus-select-node]');
      if (nodeEl) {
        this.selectedNodeId = nodeEl.getAttribute('data-bus-select-node')!;
        this.selectedLinkId = '';
        this.callbacks.onUpdateProject(this.getProject());
        return;
      }

      // Select link
      const linkEl = target.closest<Element>('[data-bus-select-link]');
      if (linkEl) {
        this.selectedLinkId = linkEl.getAttribute('data-bus-select-link')!;
        this.selectedNodeId = '';
        this.callbacks.onUpdateProject(this.getProject());
        return;
      }

      // New Node Action
      if (target.closest('[data-bus-action="new-node"]')) {
        this.createNewNode();
        return;
      }

      // New Link Action
      if (target.closest('[data-bus-action="new-link"]')) {
        this.createNewLink();
        return;
      }

      // Save Inspector Actions
      if (target.closest('[data-bus-action="save-inspector-node"]')) {
        this.saveInspectorNode(root);
        return;
      }
      if (target.closest('[data-bus-action="save-inspector-link"]')) {
        this.saveInspectorLink(root);
        return;
      }

      // Delete Actions
      if (target.closest('[data-bus-action="delete-selected-node"]')) {
        if (this.selectedNodeId) this.deleteNode(this.selectedNodeId);
        return;
      }
      if (target.closest('[data-bus-action="delete-selected-link"]')) {
        if (this.selectedLinkId) this.deleteLink(this.selectedLinkId);
        return;
      }
    };
  }

  private connectPorts(fromNodeId: string, fromPort: string, toNodeId: string, toPort: string) {
    this.pendingWire = undefined;
    const project = this.getProject();
    const newLink: BusLink = {
      id: crypto.randomUUID(),
      from: fromNodeId,
      to: toNodeId,
      fromPort,
      toPort,
    };

    try {
      const next = editAutomation(project, {
        kind: 'save',
        entity: 'links',
        value: newLink,
      });
      this.selectedLinkId = newLink.id;
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private createNewNode() {
    const project = this.getProject();
    const d = automationData(project);
    let net = 'PROFINET-1';
    let proto: BusProtocol = 'PROFINET';
    if (this.selectedNetworkKey) {
      try {
        const parsed = JSON.parse(this.selectedNetworkKey);
        if (busProtocols.includes(parsed[0])) {
          proto = parsed[0] as BusProtocol;
        }
        net = parsed[1] || net;
      } catch {}
    }

    const sameNet = d.nodes.filter(n => n.network === net);
    let n = 1;
    const makeAddr = (idx: number) => (isKnx(proto) ? `1.1.${idx}` : String(idx));
    while (
      sameNet.some(
        node =>
          node.name === `${proto}-Device-${n}` ||
          (node.address && node.address.trim().toLowerCase() === makeAddr(n).toLowerCase())
      )
    ) {
      n++;
    }
    const addr = makeAddr(n);
    const newNode: BusNode = {
      id: crypto.randomUUID(),
      name: `${proto}-Device-${n}`,
      network: net,
      protocol: proto,
      address: addr,
      ...(isLoxone(proto) ? {} : {ipAddress: `192.168.1.${Math.min(254, 10 + n)}`}),
      interfaceRole: 'device',
    };

    try {
      const next = editAutomation(project, {
        kind: 'save',
        entity: 'nodes',
        value: newNode,
      });
      this.selectedNodeId = newNode.id;
      this.selectedNetworkKey = automationNetworkKey(newNode);
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private createNewLink() {
    const project = this.getProject();
    const d = automationData(project);
    let nodesInNet = d.nodes;
    if (this.selectedNetworkKey) {
      nodesInNet = d.nodes.filter(n => automationNetworkKey(n) === this.selectedNetworkKey);
    }

    if (nodesInNet.length < 2) {
      this.callbacks.onError(new Error(tr('Mindestens zwei Teilnehmer im Netzwerk erforderlich.', 'At least two nodes in the network required.')));
      return;
    }

    const newLink: BusLink = {
      id: crypto.randomUUID(),
      from: nodesInNet[0].id,
      to: nodesInNet[1].id,
      fromPort: 'X1P1',
      toPort: 'X1P1',
    };

    try {
      const next = editAutomation(project, {
        kind: 'save',
        entity: 'links',
        value: newLink,
      });
      this.selectedLinkId = newLink.id;
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private saveInspectorNode(root: HTMLElement) {
    if (!this.selectedNodeId) return;
    const d = automationData(this.getProject());
    const node = d.nodes.find(n => n.id === this.selectedNodeId);
    if (!node) return;

    const get = (f: string) => root.querySelector<HTMLInputElement|HTMLSelectElement>(`[data-inspect-node="${f}"]`)?.value;
    const name = get('name') || node.name;
    const network = get('network') || node.network;
    const protocol = (get('protocol') || node.protocol) as BusProtocol;
    const address = get('address') || '';
    const ipAddress = get('ipAddress') || '';
    const controllerId = get('controllerId') || undefined;

    const updated: BusNode = {
      ...node,
      name,
      network,
      protocol,
      address,
      ipAddress,
      controllerId,
    };

    try {
      const next = editAutomation(this.getProject(), {
        kind: 'save',
        entity: 'nodes',
        value: updated,
      });
      this.selectedNetworkKey = automationNetworkKey(updated);
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private saveInspectorLink(root: HTMLElement) {
    if (!this.selectedLinkId) return;
    const d = automationData(this.getProject());
    const link = d.links.find(l => l.id === this.selectedLinkId);
    if (!link) return;

    const get = (f: string) => root.querySelector<HTMLInputElement|HTMLSelectElement>(`[data-inspect-link="${f}"]`)?.value;
    const from = get('from') || link.from;
    const to = get('to') || link.to;
    const fromPort = get('fromPort') || '';
    const toPort = get('toPort') || '';
    const lenVal = get('lengthM');
    const lengthM = lenVal ? Number(lenVal) : undefined;

    const updated: BusLink = {
      ...link,
      from,
      to,
      fromPort,
      toPort,
      lengthM,
    };

    try {
      const next = editAutomation(this.getProject(), {
        kind: 'save',
        entity: 'links',
        value: updated,
      });
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private deleteNode(nodeId: string) {
    try {
      const next = editAutomation(this.getProject(), {
        kind: 'remove',
        entity: 'nodes',
        id: nodeId,
      });
      if (this.selectedNodeId === nodeId) this.selectedNodeId = '';
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private deleteLink(linkId: string) {
    try {
      const next = editAutomation(this.getProject(), {
        kind: 'remove',
        entity: 'links',
        id: linkId,
      });
      if (this.selectedLinkId === linkId) this.selectedLinkId = '';
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }
}
