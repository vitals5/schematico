import type {Project} from '../../model/types';
import {
  automationData,
  editAutomation,
  type BusNode,
  type BusLink,
  type AutomationIssue,
} from '../../model/Automation';
import {
  automationBusGraph,
  automationBusRoutes,
  automationNetworkKey,
  type BusVisualGraph,
} from '../AutomationVisuals';
import {
  busProtocols,
  busProtocolHelp,
  defaultPortsForProtocol,
  isIpBus,
  isKnx,
  isLoxone,
  knxIndividualAddress,
  sharedBusPort,
  type BusProtocol,
} from '../../model/BusProfiles';
import {
  BUS_DEVICE_PRESETS,
  instantiateBusDevicePreset,
  type BusDevicePreset,
} from './AutomationDevicePresets';
import {ProjectIndex} from '../../model/ProjectIndex';
import {escapeSvg as esc} from '../../model/ImportedDrawing';
import {tr} from '../../i18n';

export interface BusTopologyWorkspaceCallbacks {
  onUpdateProject: (p: Project) => void;
  onNavigate: (pageId: string, componentId: string) => void;
  onError: (e: unknown) => void;
}

const PRESET_CATEGORIES: readonly {
  key: BusDevicePreset['category'];
  label: string;
}[] = [
  {key: 'industrial_eth', label: 'Industrial Ethernet (PROFINET / EtherCAT / Modbus TCP / OPC UA)'},
  {key: 'fieldbus_serial', label: 'Feldbus & Punkt-zu-Punkt (PROFIBUS DP / IO-Link / Modbus RTU)'},
  {key: 'building_bus', label: 'Gebäudebus & Licht (BACnet/IP / DALI / KNX)'},
  {key: 'loxone', label: 'Loxone (Link / Tree / Air)'},
];

const CABLE_LENGTH_LIMITS_M: Readonly<Partial<Record<BusProtocol, number>>> = {
  'IO-Link': 20,
  DALI: 300,
  'Loxone Link': 500,
  'Loxone Tree': 500,
};

function isAirProtocol(protocol: string | undefined): boolean {
  return protocol === 'Loxone Air';
}

function nodeIcon(node: BusNode): string {
  if (isLoxone(node.protocol)) {
    if (node.protocol === 'Loxone Air') return '📡';
    return node.interfaceRole === 'interface' ? '🟩' : '🌿';
  }
  if (isKnx(node.protocol)) return '🏢';
  if (node.protocol === 'EtherCAT') return '🔗';
  if (node.protocol === 'IO-Link') return '🎯';
  if (node.protocol === 'DALI') return '💡';
  if (node.protocol === 'PROFIBUS DP' || node.protocol === 'Modbus RTU') return '🔌';
  if (node.controllerId) return '⚡';
  return '🔌';
}

function collectUsedPorts(nodeId: string, links: readonly BusLink[]): Set<string> {
  const used = new Set<string>();
  for (const l of links) {
    if (l.from === nodeId && l.fromPort.trim()) used.add(l.fromPort.trim());
    if (l.to === nodeId && l.toPort.trim()) used.add(l.toPort.trim());
  }
  return used;
}

function visiblePortsForNode(node: BusNode, links: readonly BusLink[]): string[] {
  if (isAirProtocol(node.protocol)) {
    return [''];
  }
  const defaults = defaultPortsForProtocol(node.protocol, node.interfaceRole);
  const used = collectUsedPorts(node.id, links);
  const combined = [...new Set([...defaults, ...used])];
  if (!combined.length) return ['P1', 'P2'];
  return combined.slice(0, 4);
}

function pickAvailablePort(
  node: BusNode,
  preferredPort: string,
  links: readonly BusLink[]
): string {
  if (isAirProtocol(node.protocol)) return '';
  const defaults = defaultPortsForProtocol(node.protocol, node.interfaceRole);
  const pref = preferredPort.trim();
  if (sharedBusPort(node.protocol)) {
    return pref || defaults[0] || 'BUS';
  }
  const used = collectUsedPorts(node.id, links);
  if (pref && !used.has(pref)) return pref;
  for (const candidate of defaults) {
    if (!used.has(candidate)) return candidate;
  }
  const prefix = node.protocol === 'IO-Link' ? 'Port ' : 'P';
  let idx = defaults.length + 1;
  while (used.has(`${prefix}${idx}`)) idx++;
  return `${prefix}${idx}`;
}

function allocateValidAddressIfNeeded(
  allNodes: readonly BusNode[],
  record: BusNode,
  targetProtocol: BusProtocol
): string {
  const sameScope = allNodes.filter(
    v =>
      v.id !== record.id &&
      v.network === record.network &&
      (v.protocol === targetProtocol || (isKnx(v.protocol) && isKnx(targetProtocol)))
  );
  const cur = record.address.trim();

  if (targetProtocol === 'Modbus RTU') {
    const n = Number(cur);
    const conflict =
      !/^\d+$/.test(cur) ||
      n < 1 ||
      n > 247 ||
      sameScope.some(v => /^\d+$/.test(v.address.trim()) && Number(v.address) === n);
    if (!conflict) return cur;
    for (let i = 1; i <= 247; i++) {
      if (!sameScope.some(v => Number(v.address) === i)) return String(i);
    }
    return '1';
  }

  if (targetProtocol === 'PROFIBUS DP') {
    const n = Number(cur);
    const conflict =
      !/^\d+$/.test(cur) ||
      n < 0 ||
      n > 126 ||
      sameScope.some(v => /^\d+$/.test(v.address.trim()) && Number(v.address) === n);
    if (!conflict) return cur;
    for (let i = 2; i <= 126; i++) {
      if (!sameScope.some(v => Number(v.address) === i)) return String(i);
    }
    return '2';
  }

  if (targetProtocol === 'DALI') {
    const n = Number(cur);
    const conflict =
      !/^\d+$/.test(cur) ||
      n < 0 ||
      n > 63 ||
      sameScope.some(v => /^\d+$/.test(v.address.trim()) && Number(v.address) === n);
    if (!conflict) return cur;
    for (let i = 0; i <= 63; i++) {
      if (!sameScope.some(v => Number(v.address) === i)) return String(i);
    }
    return '0';
  }

  if (isKnx(targetProtocol)) {
    const parsed = knxIndividualAddress(cur);
    const conflict =
      !parsed ||
      sameScope.some(v => knxIndividualAddress(v.address) === parsed);
    if (!conflict) return cur;
    for (let i = 1; i <= 254; i++) {
      const candidate = `1.1.${i}`;
      const cVal = knxIndividualAddress(candidate);
      if (!sameScope.some(v => knxIndividualAddress(v.address) === cVal)) return candidate;
    }
    return '1.1.1';
  }

  return record.address;
}

export class BusTopologyWorkspace {
  private selectedNetworkKey = '';
  private selectedNodeId = '';
  private selectedLinkId = '';
  private searchQuery = '';
  private issuesOnly = false;
  private presetMenuOpen = false;
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

  render(): string {
    const project = this.getProject();
    const data = automationData(project);
    const issues = this.getIssues();
    const index = this.getProjectIndex();

    const issueMap = new Map<string, AutomationIssue[]>();
    for (const iss of issues) {
      if (iss.entity !== 'nodes' && iss.entity !== 'links') continue;
      const arr = issueMap.get(iss.recordId) ?? [];
      arr.push(iss);
      issueMap.set(iss.recordId, arr);
    }

    const networksMap = new Map<string, {protocol: BusProtocol; network: string; count: number}>();
    for (const n of data.nodes) {
      const key = automationNetworkKey(n);
      const existing = networksMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        networksMap.set(key, {
          protocol: n.protocol as BusProtocol,
          network: n.network || 'Standard',
          count: 1,
        });
      }
    }
    const networkList = [...networksMap.entries()].sort((a, b) =>
      a[1].network.localeCompare(b[1].network)
    );

    if (!this.selectedNetworkKey || !networksMap.has(this.selectedNetworkKey)) {
      this.selectedNetworkKey = networkList[0]?.[0] ?? '';
    }

    const activeNetKey = this.selectedNetworkKey;
    const activeNetInfo = activeNetKey ? networksMap.get(activeNetKey) : undefined;
    const issueIds = this.issuesOnly ? new Set(issueMap.keys()) : undefined;

    const graph: BusVisualGraph = activeNetKey
      ? automationBusGraph(project, activeNetKey, this.searchQuery, issueIds)
      : {nodes: [], edges: [], width: 900, height: 300, omitted: 0, omittedEdges: 0};

    const routes = automationBusRoutes(graph);

    if (this.selectedNodeId && !data.nodes.some(n => n.id === this.selectedNodeId)) {
      this.selectedNodeId = '';
    }
    if (this.selectedLinkId && !data.links.some(l => l.id === this.selectedLinkId)) {
      this.selectedLinkId = '';
    }
    if (!this.selectedNodeId && !this.selectedLinkId && graph.nodes.length) {
      this.selectedNodeId = graph.nodes[0].id;
    }

    return `
      <div class="bus-topo-workspace">
        <!-- Top Toolbar -->
        <div class="bus-topo-toolbar">
          <div class="bus-topo-toolbar-network">
            <label>${esc(tr('Netzwerk & Protokoll:', 'Network & Protocol:'))}</label>
            <select class="form-input" data-bus-action="select-network">
              ${networkList.length
                ? networkList.map(([k, net]) => `
                  <option value="${esc(k)}" ${k === activeNetKey ? 'selected' : ''}>
                    ${esc(net.network)} · ${esc(net.protocol)} (${net.count})
                  </option>
                `).join('')
                : `<option value="">${esc(tr('Noch kein Netzwerk', 'No network yet'))}</option>`}
            </select>
          </div>

          <div class="bus-topo-toolbar-actions">
            <input class="form-input bus-search-input"
                   type="search"
                   placeholder="${esc(tr('Teilnehmer, IP oder Adresse suchen…', 'Search node, IP or address…'))}"
                   value="${esc(this.searchQuery)}"
                   data-bus-filter="search">

            <label class="eng-check">
              <input type="checkbox" data-bus-filter="issues" ${this.issuesOnly ? 'checked' : ''}>
              ${esc(tr('Nur Hinweise', 'Only warnings'))}
            </label>

            <div class="bus-preset-dropdown-wrap">
              <button class="btn btn-primary" data-bus-action="toggle-preset-menu">
                + ${esc(tr('Gerät / Vorlage ▾', 'Device / Preset ▾'))}
              </button>
              <div class="plc-template-dropdown-menu plc-preset-scroll bus-preset-menu ${this.presetMenuOpen ? 'is-open' : ''}">
                ${PRESET_CATEGORIES.map((cat, idx) => {
                  const items = BUS_DEVICE_PRESETS.filter(p => p.category === cat.key);
                  if (!items.length) return '';
                  return `
                    ${idx > 0 ? '<div class="plc-template-divider"></div>' : ''}
                    <div class="plc-template-dropdown-header">${esc(cat.label)}</div>
                    ${items.map(preset => `
                      <button type="button" class="plc-template-item" data-bus-preset="${esc(preset.id)}">
                        <strong>${esc(preset.name)}</strong>
                        <small>${esc(preset.protocol)} · ${esc(preset.description)}</small>
                      </button>
                    `).join('')}
                  `;
                }).join('')}
              </div>
            </div>

            <button class="btn" data-bus-action="new-node">
              + ${esc(tr('Teilnehmer', 'Node'))}
            </button>
            <button class="btn" data-bus-action="new-link">
              + ${esc(tr('Verbindung', 'Link'))}
            </button>
          </div>
        </div>

        ${activeNetInfo ? this.renderStatusBar(activeNetKey, activeNetInfo, data.nodes, data.links, issueMap) : ''}

        ${this.pendingWire ? `
          <div class="bus-wire-prompt">
            <span>⚡ ${esc(tr('Port ausgewählt:', 'Port selected:'))} <strong>${esc(data.nodes.find(n => n.id === this.pendingWire!.fromNodeId)?.name || '?')} [${esc(this.pendingWire!.fromPort || 'Funk')}]</strong>. ${esc(tr('Klicken Sie auf den Zielport eines anderen Teilnehmers zum Verbinden.', 'Click target port on another node to connect.'))}</span>
            <button class="btn btn-xs" data-bus-action="cancel-wire">${esc(tr('Abbrechen', 'Cancel'))}</button>
          </div>
        ` : ''}

        <div class="bus-topo-main-area">
          <!-- Canvas Topologie Graph -->
          <div class="bus-topo-canvas-container">
            <div class="bus-topo-canvas-wrap">
              ${this.renderSvgCanvas(graph, routes, data, issueMap, activeNetInfo)}
            </div>

            <!-- Legende & Statuszeile -->
            <div class="bus-topo-legend">
              <span class="bus-legend-item"><span class="line-wire"></span> ${esc(tr('Busleitung (Kupfer/LWL)', 'Bus cable'))}</span>
              <span class="bus-legend-item"><span class="line-air"></span> ${esc(tr('Funkzuordnung (Air)', 'Wireless'))}</span>
              <span class="bus-legend-item"><span class="line-assign"></span> ${esc(tr('Segmentzuordnung', 'Segment link'))}</span>
              <span class="bus-legend-stats">
                ${graph.nodes.length} / ${activeNetInfo?.count ?? 0} ${esc(tr('Teilnehmer', 'Nodes'))} · ${graph.edges.length} ${esc(tr('Verbindungen', 'Links'))}
              </span>
            </div>
          </div>

          <!-- Rechter Inspektor -->
          <aside class="bus-topo-inspector">
            <header class="bus-inspector-header">
              <h4>${esc(tr('Eigenschaften & Details', 'Properties & Details'))}</h4>
            </header>
            <div class="bus-inspector-body">
              ${this.renderInspector(data, index, issueMap)}
            </div>
          </aside>
        </div>
      </div>
    `;
  }

  private renderStatusBar(
    networkKey: string,
    netInfo: {protocol: BusProtocol; network: string; count: number},
    allNodes: readonly BusNode[],
    allLinks: readonly BusLink[],
    issueMap: Map<string, AutomationIssue[]>
  ): string {
    const netNodes = allNodes.filter(n => automationNetworkKey(n) === networkKey);
    const nodeIds = new Set(netNodes.map(n => n.id));
    const netLinks = allLinks.filter(l => nodeIds.has(l.from) || nodeIds.has(l.to));
    const totalLengthM = netLinks.reduce((sum, l) => sum + (l.lengthM ?? 0), 0);
    const maxSingleLengthM = netLinks.reduce((mx, l) => Math.max(mx, l.lengthM ?? 0), 0);
    const netIssuesCount =
      netNodes.reduce((sum, n) => sum + (issueMap.get(n.id)?.length ?? 0), 0) +
      netLinks.reduce((sum, l) => sum + (issueMap.get(l.id)?.length ?? 0), 0);

    const chips: {text: string; cls: string}[] = [
      {
        text: `${netNodes.length} Teilnehmer · ${netLinks.length} Verbindungen`,
        cls: 'is-neutral',
      },
    ];

    const limitM = CABLE_LENGTH_LIMITS_M[netInfo.protocol];
    if (netInfo.protocol === 'IO-Link') {
      const over = maxSingleLengthM > 20;
      chips.push({
        text: `Max. Stichleitung: ${maxSingleLengthM.toFixed(0)} / 20 m`,
        cls: over ? 'is-warn' : 'is-ok',
      });
    } else if (netInfo.protocol === 'DALI') {
      const overLen = totalLengthM > 300;
      chips.push({
        text: `EVG/Teilnehmer: ${netNodes.length} / 64`,
        cls: netNodes.length > 64 ? 'is-warn' : 'is-ok',
      });
      chips.push({
        text: `Gesamt-Buslänge: ${totalLengthM.toFixed(0)} / 300 m`,
        cls: overLen ? 'is-warn' : 'is-ok',
      });
    } else if (limitM !== undefined) {
      chips.push({
        text: `Gesamtlänge: ${totalLengthM.toFixed(0)} / ${limitM} m`,
        cls: totalLengthM > limitM ? 'is-warn' : 'is-ok',
      });
    } else if (totalLengthM > 0) {
      chips.push({
        text: `Dokumentierte Länge: ${totalLengthM.toFixed(0)} m`,
        cls: 'is-neutral',
      });
    }

    if (isLoxone(netInfo.protocol)) {
      const interfaces = netNodes.filter(n => n.interfaceRole === 'interface').length;
      const devices = netNodes.length - interfaces;
      chips.push({
        text: `${interfaces} Schnittstelle(n) · ${devices} Gerät(e)`,
        cls: interfaces === 0 ? 'is-warn' : 'is-ok',
      });
    }

    chips.push({
      text: netIssuesCount ? `⚠ ${netIssuesCount} Protokoll-Hinweis(e)` : '✓ Protokollregeln eingehalten',
      cls: netIssuesCount ? 'is-warn' : 'is-ok',
    });

    return `
      <div class="bus-status-bar">
        <div class="bus-status-chips">
          ${chips.map(c => `<span class="bus-status-chip ${c.cls}">${esc(c.text)}</span>`).join('')}
        </div>
        <span class="bus-status-help">${esc(busProtocolHelp(netInfo.protocol))}</span>
      </div>
    `;
  }

  private renderSvgCanvas(
    graph: BusVisualGraph,
    routes: ReturnType<typeof automationBusRoutes>,
    data: ReturnType<typeof automationData>,
    issueMap: Map<string, AutomationIssue[]>,
    activeNetInfo?: {protocol: BusProtocol; network: string; count: number}
  ): string {
    if (!graph.nodes.length) {
      return `
        <div class="bus-canvas-empty">
          <p>${esc(tr('Keine Busteilnehmer im aktuellen Netzwerk oder Filter gefunden.', 'No bus nodes found in current network or filter.'))}</p>
          ${activeNetInfo ? `<small class="bus-protocol-hint">${esc(busProtocolHelp(activeNetInfo.protocol))}</small>` : ''}
          <button class="btn btn-primary" data-bus-action="new-node">+ ${esc(tr('Ersten Busteilnehmer anlegen', 'Create first bus node'))}</button>
        </div>
      `;
    }

    const w = Math.max(graph.width, 900);
    const h = Math.max(graph.height, 400);
    const linksById = new Map(data.links.map(l => [l.id, l]));

    let edgesSvg = '';
    for (const r of routes) {
      const isSelected = r.edge.entity === 'links' && this.selectedLinkId === r.edge.id;
      const isAir = r.edge.kind === 'air';
      const isAssign = r.edge.kind === 'assignment';
      const hasIssue = r.edge.entity === 'links' && (issueMap.get(r.edge.id)?.length ?? 0) > 0;
      const edgeClass = isAir ? 'bus-svg-edge--air' : isAssign ? 'bus-svg-edge--assign' : 'bus-svg-edge--wire';
      const linkRecord = r.edge.entity === 'links' ? linksById.get(r.edge.id) : undefined;
      const lengthText = linkRecord?.lengthM !== undefined ? `${linkRecord.lengthM} m` : '';
      const pillText = isAir
        ? 'Funk (Air)'
        : [r.edge.label, lengthText].filter(Boolean).join(' · ');
      const midX = r.points[1]?.x ?? (r.points[0].x + r.points[r.points.length - 1].x) / 2;
      const midY =
        r.points.length >= 3
          ? (r.points[1].y + r.points[2].y) / 2
          : (r.points[0].y + r.points[r.points.length - 1].y) / 2;
      const pillWidth = Math.min(148, Math.max(46, pillText.length * 5.6 + 14));

      edgesSvg += `
        <g class="bus-svg-edge ${edgeClass} ${isSelected ? 'is-selected' : ''} ${hasIssue ? 'has-issues' : ''}"
           ${r.edge.entity === 'links' ? `data-bus-select-link="${esc(r.edge.id)}"` : ''}
           role="button" tabindex="0">
          <title>${esc(pillText || r.edge.label || 'Verbindung')}</title>
          <path d="${esc(r.path)}" class="bus-edge-hit-area" />
          <path d="${esc(r.path)}" class="bus-edge-line" />
          ${pillText ? `
            <g class="bus-edge-pill" transform="translate(${midX}, ${midY})">
              <rect class="bus-edge-pill-bg" x="${-pillWidth / 2}" y="-9" width="${pillWidth}" height="18" rx="9" />
              <text class="bus-edge-pill-text" x="0" y="3" text-anchor="middle">${esc(pillText.slice(0, 24))}</text>
            </g>
          ` : ''}
        </g>
      `;
    }

    let nodesSvg = '';
    for (const n of graph.nodes) {
      const isSelected = this.selectedNodeId === n.id;
      const nIssues = issueMap.get(n.id) ?? [];
      const isPending = this.pendingWire?.fromNodeId === n.id;
      const ports = visiblePortsForNode(n, data.links);
      const nodeIsAir = isAirProtocol(n.protocol);
      const isBound = !!(n.binding?.pageId && n.binding?.componentId);
      const roleLabel =
        n.interfaceRole === 'interface'
          ? 'Interface'
          : n.controllerId
            ? 'SPS'
            : n.protocol.split(' ')[0];
      const addrLine = [n.address, n.ipAddress].filter(Boolean).join(' · ') || tr('Adresse unkonfiguriert', 'No address');

      nodesSvg += `
        <g class="bus-svg-node ${isSelected ? 'is-selected' : ''} ${nIssues.length ? 'has-issues' : ''} ${isPending ? 'is-pending-source' : ''}"
           transform="translate(${n.x}, ${n.y})"
           data-bus-select-node="${esc(n.id)}"
           role="button" tabindex="0">
          <rect width="212" height="84" rx="8" class="bus-node-box" />
          <circle cx="14" cy="18" r="5" class="bus-node-status-dot" />
          <text x="24" y="22" class="bus-node-name">${esc(nodeIcon(n))} ${esc(n.name.length > 16 ? n.name.slice(0, 15) + '…' : n.name)}</text>
          <rect class="bus-node-role-pill" x="150" y="10" width="54" height="15" rx="4" />
          <text class="bus-node-role-text" x="177" y="21" text-anchor="middle">${esc(roleLabel.slice(0, 8))}</text>
          <text x="12" y="40" class="bus-node-addr">${esc(addrLine.slice(0, 26))}${isBound ? ' · 📐' : ''}</text>

          <!-- Ports for interactive wiring -->
          <g class="bus-node-ports" transform="translate(10, 54)">
            ${ports.map((pName, pIdx) => {
              const isPortPending = isPending && this.pendingWire?.fromPort === pName;
              const pillLabel = nodeIsAir ? 'Funk' : pName;
              return `
                <g class="bus-port-pin ${isPortPending ? 'is-active-port' : ''}"
                   transform="translate(${pIdx * 48}, 0)"
                   data-port-click-node="${esc(n.id)}"
                   data-port-click-name="${esc(pName)}"
                   title="${esc(tr('Port:', 'Port:'))} ${esc(pillLabel)}">
                  <rect x="0" y="0" width="44" height="19" rx="4" class="bus-port-bg" />
                  <circle class="bus-port-dot" cx="7" cy="9.5" r="2.8" />
                  <text x="13" y="12.5" class="bus-port-text">${esc(pillLabel.slice(0, 6))}</text>
                </g>
              `;
            }).join('')}
          </g>

          ${nIssues.length ? `
            <g transform="translate(204, 4)">
              <circle r="8" fill="#ef4444" stroke="#0b121c" stroke-width="2" />
              <text y="3" text-anchor="middle" fill="#fff" font-size="9" font-weight="bold">!</text>
            </g>
          ` : ''}
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

  private renderInspector(
    data: ReturnType<typeof automationData>,
    index: ProjectIndex,
    issueMap: Map<string, AutomationIssue[]>
  ): string {
    if (this.selectedLinkId) {
      const link = data.links.find(l => l.id === this.selectedLinkId);
      if (link) {
        const fromNode = data.nodes.find(n => n.id === link.from);
        const toNode = data.nodes.find(n => n.id === link.to);
        const lIssues = issueMap.get(link.id) ?? [];
        const isAir = isAirProtocol(fromNode?.protocol) || isAirProtocol(toNode?.protocol);
        const proto = (fromNode?.protocol || toNode?.protocol || 'Other') as BusProtocol;
        const limitM = CABLE_LENGTH_LIMITS_M[proto];

        return `
          <div class="bus-inspector-section">
            <div class="bus-inspector-title">
              <strong>🔗 ${esc(tr('Busverbindung', 'Bus Link'))}</strong>
              <small>${esc(fromNode?.name || '?')} ↔ ${esc(toNode?.name || '?')}</small>
            </div>

            ${lIssues.map(i => `<div class="plc-inspector-alert">⚠ ${esc(i.message)}</div>`).join('')}

            ${isAir ? `
              <div class="insp-loxone-air-note">
                📡 ${esc(tr(
                  'Loxone Air Funkzuordnung: Keine Kabel-Ports oder Kabellängen zulässig.',
                  'Loxone Air wireless association: Physical ports and cable lengths are not permitted.'
                ))}
              </div>
              <div class="plc-inspector-actions">
                <button class="btn btn-sm btn-outline" data-bus-action="delete-selected-link">${esc(tr('Löschen', 'Delete'))}</button>
              </div>
            ` : `
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
                ${limitM !== undefined ? `<small class="insp-help">${esc(proto)}: max. ${limitM} m</small>` : ''}
              </div>

              <div class="plc-inspector-actions">
                <button class="btn btn-sm btn-primary" data-bus-action="save-inspector-link">${esc(tr('Speichern', 'Save'))}</button>
                <button class="btn btn-sm btn-outline" data-bus-action="delete-selected-link">${esc(tr('Löschen', 'Delete'))}</button>
              </div>
            `}
          </div>
        `;
      }
    }

    if (this.selectedNodeId) {
      const node = data.nodes.find(n => n.id === this.selectedNodeId);
      if (node) {
        const nIssues = issueMap.get(node.id) ?? [];
        const loxone = isLoxone(node.protocol);
        const showIp = isIpBus(node.protocol);
        const sameNetInterfaces = data.nodes.filter(
          n =>
            n.id !== node.id &&
            n.interfaceRole === 'interface' &&
            n.protocol === node.protocol &&
            n.network === node.network
        );
        const bindingValue =
          node.binding?.pageId && node.binding?.componentId
            ? `${node.binding.pageId}::${node.binding.componentId}`
            : '';

        return `
          <div class="bus-inspector-section">
            <div class="bus-inspector-title">
              <strong>${esc(nodeIcon(node))} ${esc(node.name)}</strong>
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
              <label>${esc(tr('Bus- / Stationsadresse', 'Bus / Station Address'))}</label>
              <input class="form-input" type="text" data-inspect-node="address" value="${esc(node.address || '')}">
            </div>

            ${showIp ? `
              <div class="plc-form-group">
                <label>${esc(tr('IPv4-Adresse', 'IPv4 Address'))}</label>
                <input class="form-input font-mono" type="text" data-inspect-node="ipAddress" value="${esc(node.ipAddress || '')}" placeholder="192.168.0.10">
              </div>
            ` : ''}

            <div class="plc-form-group">
              <label>${esc(tr('Zugeordnete CPU (optional)', 'Assigned CPU (optional)'))}</label>
              <select class="form-input" data-inspect-node="controllerId">
                <option value="">${esc(tr('Keine CPU', 'None'))}</option>
                ${data.controllers.map(c => `<option value="${esc(c.id)}" ${c.id === node.controllerId ? 'selected' : ''}>${esc(c.bmk)}</option>`).join('')}
              </select>
            </div>

            ${loxone ? `
              <div class="insp-loxone-box">
                <div class="insp-loxone-title">🟩 ${esc(tr('Loxone Schnittstelle / Zweig', 'Loxone Interface / Branch'))}</div>
                <div class="plc-form-group">
                  <label>${esc(tr('Rolle im Bus', 'Bus Role'))}</label>
                  <select class="form-input" data-inspect-node="interfaceRole">
                    <option value="device" ${node.interfaceRole !== 'interface' ? 'selected' : ''}>Loxone Teilnehmer (Device)</option>
                    <option value="interface" ${node.interfaceRole === 'interface' ? 'selected' : ''}>Schnittstelle (Miniserver / Extension)</option>
                  </select>
                </div>
                ${node.interfaceRole === 'interface' ? `
                  <div class="plc-form-group">
                    <label>${esc(tr('Schnittstellenprofil', 'Interface Profile'))}</label>
                    <select class="form-input" data-inspect-node="interfaceProfile">
                      <option value="generic" ${(node.interfaceProfile || 'generic') === 'generic' ? 'selected' : ''}>Standard (${esc(node.protocol)})</option>
                      ${node.protocol === 'Loxone Air' ? `
                        <option value="air-base" ${node.interfaceProfile === 'air-base' ? 'selected' : ''}>Air Base / Miniserver Air (max. 128 Geräte)</option>
                      ` : ''}
                    </select>
                  </div>
                  <div class="plc-form-group">
                    <label>${esc(tr('Teilnehmergrenze (optional)', 'Capacity Limit (optional)'))}</label>
                    <input class="form-input" type="number" min="1" data-inspect-node="capacity" value="${esc(String(node.capacity ?? ''))}" placeholder="Standard laut Protokoll">
                  </div>
                ` : `
                  <div class="plc-form-group">
                    <label>${esc(tr('Zugeordnete Schnittstelle', 'Parent Interface'))}</label>
                    <select class="form-input" data-inspect-node="interfaceId">
                      <option value="">-- Schnittstelle wählen --</option>
                      ${sameNetInterfaces.map(iface => `
                        <option value="${esc(iface.id)}" ${node.interfaceId === iface.id ? 'selected' : ''}>${esc(iface.name)} (${esc(iface.address || 'ohne Addr')})</option>
                      `).join('')}
                    </select>
                    ${!sameNetInterfaces.length ? `<small class="insp-warn">${esc(tr('Keine passende Schnittstelle in diesem Netz vorhanden.', 'No matching interface in this network.'))}</small>` : ''}
                  </div>
                `}
              </div>
            ` : ''}

            <!-- Schematic Device Binding -->
            <div class="insp-binding-box">
              <div class="insp-binding-title">📐 ${esc(tr('Schaltplan-Gerät', 'Schematic Device'))}</div>
              <div class="plc-form-group">
                <select class="form-input" data-bus-node-binding="${esc(node.id)}">
                  <option value="">-- Nicht im Schaltplan verknüpft --</option>
                  ${index.components.map(entry => {
                    const key = `${entry.page.id}::${entry.component.id}`;
                    const pageLabel = entry.page.title || entry.page.pageNumber || entry.page.id;
                    const compLabel = entry.tag || entry.symbol?.name || entry.component.id;
                    const fnText = entry.component.functionText ? ` · ${entry.component.functionText}` : '';
                    return `<option value="${esc(key)}" ${bindingValue === key ? 'selected' : ''}>[${esc(pageLabel)}] ${esc(compLabel)}${esc(fnText)}</option>`;
                  }).join('')}
                </select>
              </div>
              ${node.binding?.pageId && node.binding?.componentId ? `
                <div class="insp-binding-actions">
                  <button type="button" class="btn btn-xs" data-bus-action="jump-binding" data-page-id="${esc(node.binding.pageId)}" data-component-id="${esc(node.binding.componentId)}">↗ ${esc(tr('Zur Zeichnung', 'Go to Drawing'))}</button>
                  <button type="button" class="btn btn-xs btn-outline" data-bus-action="clear-binding" data-id="${esc(node.id)}">✕ ${esc(tr('Lösen', 'Unlink'))}</button>
                </div>
              ` : ''}
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

  bind(root: HTMLElement) {
    const netSelect = root.querySelector<HTMLSelectElement>('[data-bus-action="select-network"]');
    if (netSelect) {
      netSelect.onchange = () => {
        this.selectedNetworkKey = netSelect.value;
        this.selectedNodeId = '';
        this.selectedLinkId = '';
        this.pendingWire = undefined;
        this.presetMenuOpen = false;
        this.callbacks.onUpdateProject(this.getProject());
      };
    }

    const searchInput = root.querySelector<HTMLInputElement>('[data-bus-filter="search"]');
    if (searchInput) {
      searchInput.oninput = () => {
        this.searchQuery = searchInput.value;
        this.callbacks.onUpdateProject(this.getProject());
      };
    }

    const issuesCheck = root.querySelector<HTMLInputElement>('[data-bus-filter="issues"]');
    if (issuesCheck) {
      issuesCheck.onchange = () => {
        this.issuesOnly = issuesCheck.checked;
        this.callbacks.onUpdateProject(this.getProject());
      };
    }

    // Auto-apply protocol / role / binding changes cleanly
    root.querySelectorAll<HTMLSelectElement>('[data-inspect-node="protocol"], [data-inspect-node="interfaceRole"]').forEach(sel => {
      sel.onchange = () => {
        if (!this.selectedNodeId) return;
        const field = sel.getAttribute('data-inspect-node')!;
        this.updateNodeField(this.selectedNodeId, field, sel.value);
      };
    });

    root.querySelectorAll<HTMLSelectElement>('[data-bus-node-binding]').forEach(sel => {
      sel.onchange = () => {
        const id = sel.dataset.busNodeBinding!;
        const val = sel.value;
        if (!val) {
          this.updateNodeBinding(id, undefined);
        } else {
          const [pageId, componentId] = val.split('::');
          if (pageId && componentId) this.updateNodeBinding(id, {pageId, componentId});
        }
      };
    });

    root.onclick = e => {
      const target = e.target as HTMLElement;

      const presetBtn = target.closest<HTMLElement>('[data-bus-preset]');
      if (presetBtn) {
        const preset = BUS_DEVICE_PRESETS.find(p => p.id === presetBtn.dataset.busPreset);
        this.presetMenuOpen = false;
        if (preset) this.applyDevicePreset(preset);
        return;
      }

      if (target.closest('[data-bus-action="toggle-preset-menu"]')) {
        this.presetMenuOpen = !this.presetMenuOpen;
        this.callbacks.onUpdateProject(this.getProject());
        return;
      }

      if (target.closest('[data-bus-action="cancel-wire"]')) {
        this.pendingWire = undefined;
        this.callbacks.onUpdateProject(this.getProject());
        return;
      }

      const jumpBtn = target.closest<HTMLElement>('[data-bus-action="jump-binding"]');
      if (jumpBtn) {
        const pageId = jumpBtn.dataset.pageId;
        const compId = jumpBtn.dataset.componentId;
        if (pageId && compId) this.callbacks.onNavigate(pageId, compId);
        return;
      }

      const clearBindBtn = target.closest<HTMLElement>('[data-bus-action="clear-binding"]');
      if (clearBindBtn && clearBindBtn.dataset.id) {
        this.updateNodeBinding(clearBindBtn.dataset.id, undefined);
        return;
      }

      const portPin = target.closest<Element>('[data-port-click-node]');
      if (portPin) {
        const nodeId = portPin.getAttribute('data-port-click-node') ?? '';
        const portName = portPin.getAttribute('data-port-click-name') ?? '';
        if (!nodeId) return;
        if (!this.pendingWire) {
          this.pendingWire = {fromNodeId: nodeId, fromPort: portName};
          this.callbacks.onUpdateProject(this.getProject());
        } else if (this.pendingWire.fromNodeId === nodeId) {
          this.pendingWire = undefined;
          this.callbacks.onUpdateProject(this.getProject());
        } else {
          this.connectPorts(this.pendingWire.fromNodeId, this.pendingWire.fromPort, nodeId, portName);
          this.pendingWire = undefined;
        }
        return;
      }

      const nodeEl = target.closest<Element>('[data-bus-select-node]');
      if (nodeEl) {
        this.selectedNodeId = nodeEl.getAttribute('data-bus-select-node')!;
        this.selectedLinkId = '';
        this.presetMenuOpen = false;
        this.callbacks.onUpdateProject(this.getProject());
        return;
      }

      const linkEl = target.closest<Element>('[data-bus-select-link]');
      if (linkEl) {
        this.selectedLinkId = linkEl.getAttribute('data-bus-select-link')!;
        this.selectedNodeId = '';
        this.presetMenuOpen = false;
        this.callbacks.onUpdateProject(this.getProject());
        return;
      }

      if (target.closest('[data-bus-action="new-node"]')) {
        this.presetMenuOpen = false;
        this.createNewNode();
        return;
      }

      if (target.closest('[data-bus-action="new-link"]')) {
        this.presetMenuOpen = false;
        this.createNewLink();
        return;
      }

      if (target.closest('[data-bus-action="save-inspector-node"]')) {
        this.saveInspectorNode(root);
        return;
      }

      if (target.closest('[data-bus-action="save-inspector-link"]')) {
        this.saveInspectorLink(root);
        return;
      }

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

  private applyDevicePreset(preset: BusDevicePreset) {
    try {
      const result = instantiateBusDevicePreset(this.getProject(), preset, this.selectedNetworkKey);
      this.selectedNetworkKey = automationNetworkKey(result.node);
      this.selectedNodeId = result.node.id;
      this.selectedLinkId = '';
      this.callbacks.onUpdateProject(result.next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private createNewNode() {
    const project = this.getProject();
    const d = automationData(project);
    let protocol: BusProtocol = 'PROFINET';
    let network = 'Automationsnetz';
    if (this.selectedNetworkKey) {
      try {
        const parsed = JSON.parse(this.selectedNetworkKey);
        if (Array.isArray(parsed) && busProtocols.includes(parsed[0])) {
          protocol = parsed[0] as BusProtocol;
          network = parsed[1] || network;
        }
      } catch {}
    }

    const existingCount = d.nodes.length + 1;
    const id = crypto.randomUUID();
    const nodeIsLox = isLoxone(protocol);
    const parentInterface = nodeIsLox
      ? d.nodes.find(n => n.protocol === protocol && n.network === network && n.interfaceRole === 'interface')
      : undefined;

    let address = `node-${existingCount}`;
    if (protocol === 'DALI') address = String(existingCount % 64);
    else if (protocol === 'PROFIBUS DP') address = String(Math.min(125, existingCount + 1));
    else if (protocol === 'Modbus RTU') address = String(Math.min(247, existingCount));
    else if (isKnx(protocol)) address = `1.1.${Math.min(254, existingCount)}`;

    const record: BusNode = {
      id,
      name: `${protocol.split(' ')[0]}-Node ${existingCount}`,
      network,
      protocol,
      address,
      ...(isIpBus(protocol) ? {ipAddress: `192.168.0.${Math.min(254, 10 + existingCount)}`} : {}),
      ...(nodeIsLox
        ? parentInterface
          ? {interfaceRole: 'device' as const, interfaceId: parentInterface.id}
          : {interfaceRole: 'interface' as const, interfaceProfile: 'generic' as const}
        : {}),
    };

    try {
      const next = editAutomation(project, {kind: 'save', entity: 'nodes', value: record});
      this.selectedNetworkKey = automationNetworkKey(record);
      this.selectedNodeId = id;
      this.selectedLinkId = '';
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private createNewLink() {
    const project = this.getProject();
    const d = automationData(project);
    const netNodes = this.selectedNetworkKey
      ? d.nodes.filter(n => automationNetworkKey(n) === this.selectedNetworkKey)
      : d.nodes;
    if (netNodes.length < 2) {
      this.callbacks.onError(
        new Error(
          tr(
            'Mindestens 2 Teilnehmer im Netz nötig, um eine Verbindung zu ziehen.',
            'Need at least 2 nodes in network to link.'
          )
        )
      );
      return;
    }

    const fromNode =
      netNodes.find(n => n.id === this.selectedNodeId) ??
      netNodes.find(n => n.interfaceRole === 'interface') ??
      netNodes[0];

    const linkedPeers = new Set(
      d.links
        .filter(l => l.from === fromNode.id || l.to === fromNode.id)
        .map(l => (l.from === fromNode.id ? l.to : l.from))
    );
    const toNode =
      netNodes.find(n => n.id !== fromNode.id && !linkedPeers.has(n.id)) ??
      netNodes.find(n => n.id !== fromNode.id);

    if (!toNode) return;
    this.connectPorts(fromNode.id, '', toNode.id, '');
  }

  private connectPorts(fromNodeId: string, fromPort: string, toNodeId: string, toPort: string) {
    this.pendingWire = undefined;
    if (fromNodeId === toNodeId) return;
    const project = this.getProject();
    const d = automationData(project);
    const fromNode = d.nodes.find(n => n.id === fromNodeId);
    const toNode = d.nodes.find(n => n.id === toNodeId);
    if (!fromNode || !toNode) return;

    const air = isAirProtocol(fromNode.protocol) || isAirProtocol(toNode.protocol);
    let actualFrom = fromNode;
    let actualTo = toNode;
    let actualFromPort = fromPort;
    let actualToPort = toPort;

    if (air) {
      if (toNode.interfaceRole === 'interface' && fromNode.interfaceRole !== 'interface') {
        actualFrom = toNode;
        actualTo = fromNode;
      }
      if (actualFrom.interfaceRole !== 'interface' || actualTo.interfaceRole === 'interface') {
        this.callbacks.onError(
          new Error(
            tr(
              'Loxone Air benötigt genau eine Air-Basis (Interface) und ein Air-Gerät.',
              'Loxone Air links must connect one interface and one device.'
            )
          )
        );
        return;
      }
      actualFromPort = '';
      actualToPort = '';
    } else {
      actualFromPort = pickAvailablePort(actualFrom, fromPort, d.links);
      actualToPort = pickAvailablePort(actualTo, toPort, d.links);
    }

    const id = crypto.randomUUID();
    const record: BusLink = {
      id,
      from: actualFrom.id,
      fromPort: actualFromPort,
      to: actualTo.id,
      toPort: actualToPort,
      ...(air ? {} : {lengthM: actualFrom.protocol === 'IO-Link' ? 10 : 15}),
    };

    try {
      const next = editAutomation(project, {kind: 'save', entity: 'links', value: record});
      this.selectedLinkId = id;
      this.selectedNodeId = '';
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private applyProtocolSanitization(
    allNodes: readonly BusNode[],
    record: BusNode,
    nextProto: BusProtocol
  ): BusNode {
    const updated: BusNode = {...record, protocol: nextProto};
    updated.address = allocateValidAddressIfNeeded(allNodes, updated, nextProto);

    if (!isIpBus(nextProto) || isLoxone(nextProto)) {
      delete updated.ipAddress;
    }

    if (isLoxone(nextProto)) {
      if (!updated.interfaceRole) {
        const siblingIface = allNodes.find(
          n =>
            n.id !== updated.id &&
            n.protocol === nextProto &&
            n.network === updated.network &&
            n.interfaceRole === 'interface'
        );
        if (siblingIface) {
          updated.interfaceRole = 'device';
          updated.interfaceId = siblingIface.id;
        } else {
          updated.interfaceRole = 'interface';
          updated.interfaceProfile = 'generic';
        }
      }
      if (updated.interfaceRole === 'interface') {
        delete updated.interfaceId;
        if (updated.interfaceProfile === 'air-base' && nextProto !== 'Loxone Air') {
          updated.interfaceProfile = 'generic';
        }
      } else {
        delete updated.interfaceProfile;
        delete updated.capacity;
        const matching = allNodes.find(
          n =>
            n.id === updated.interfaceId &&
            n.protocol === nextProto &&
            n.network === updated.network &&
            n.interfaceRole === 'interface'
        );
        if (!matching) {
          const fallback = allNodes.find(
            n =>
              n.id !== updated.id &&
              n.protocol === nextProto &&
              n.network === updated.network &&
              n.interfaceRole === 'interface'
          );
          if (fallback) updated.interfaceId = fallback.id;
          else delete updated.interfaceId;
        }
      }
    } else {
      delete updated.interfaceRole;
      delete updated.interfaceId;
      delete updated.interfaceProfile;
      delete updated.capacity;
    }

    return updated;
  }

  private saveInspectorNode(root: HTMLElement) {
    if (!this.selectedNodeId) return;
    const project = this.getProject();
    const d = automationData(project);
    const existing = d.nodes.find(n => n.id === this.selectedNodeId);
    if (!existing) return;

    const getVal = (f: string): string | undefined => {
      const el = root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-inspect-node="${f}"]`);
      return el ? el.value : undefined;
    };

    const nextProto = (getVal('protocol') || existing.protocol) as BusProtocol;
    let updated: BusNode = {
      ...existing,
      name: getVal('name') ?? existing.name,
      network: getVal('network') ?? existing.network,
      address: getVal('address') ?? existing.address,
      controllerId: getVal('controllerId') || undefined,
    };

    const ipVal = getVal('ipAddress');
    if (ipVal !== undefined) {
      if (ipVal.trim()) updated.ipAddress = ipVal.trim();
      else delete updated.ipAddress;
    }

    const roleVal = getVal('interfaceRole');
    if (roleVal !== undefined) {
      updated.interfaceRole = roleVal === 'interface' ? 'interface' : 'device';
    }
    const profileVal = getVal('interfaceProfile');
    if (profileVal !== undefined) {
      updated.interfaceProfile = profileVal === 'air-base' ? 'air-base' : 'generic';
    }
    const ifaceIdVal = getVal('interfaceId');
    if (ifaceIdVal !== undefined) {
      if (ifaceIdVal.trim()) updated.interfaceId = ifaceIdVal.trim();
      else delete updated.interfaceId;
    }
    const capVal = getVal('capacity');
    if (capVal !== undefined) {
      const num = Number(capVal);
      if (capVal.trim() && Number.isFinite(num) && num > 0) updated.capacity = Math.round(num);
      else delete updated.capacity;
    }

    updated = this.applyProtocolSanitization(d.nodes, updated, nextProto);
    if (!updated.controllerId) delete updated.controllerId;

    try {
      const next = editAutomation(project, {kind: 'save', entity: 'nodes', value: updated});
      this.selectedNetworkKey = automationNetworkKey(updated);
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private saveInspectorLink(root: HTMLElement) {
    if (!this.selectedLinkId) return;
    const project = this.getProject();
    const existing = automationData(project).links.find(l => l.id === this.selectedLinkId);
    if (!existing) return;

    const getVal = (f: string) =>
      root.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-inspect-link="${f}"]`)?.value ?? '';
    const lenRaw = getVal('lengthM').trim();

    const updated: BusLink = {
      ...existing,
      from: getVal('from') || existing.from,
      to: getVal('to') || existing.to,
      fromPort: getVal('fromPort'),
      toPort: getVal('toPort'),
      ...(lenRaw ? {lengthM: Number(lenRaw)} : {}),
    };
    if (!lenRaw) delete updated.lengthM;

    try {
      const next = editAutomation(project, {kind: 'save', entity: 'links', value: updated});
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private updateNodeField(id: string, field: string, value: string) {
    const project = this.getProject();
    const d = automationData(project);
    const existing = d.nodes.find(n => n.id === id);
    if (!existing) return;

    let record: BusNode = {...existing};
    if (field === 'protocol') {
      record = this.applyProtocolSanitization(d.nodes, record, value as BusProtocol);
    } else if (field === 'interfaceRole') {
      record.interfaceRole = value === 'interface' ? 'interface' : 'device';
      record = this.applyProtocolSanitization(d.nodes, record, record.protocol);
    } else {
      (record as unknown as Record<string, unknown>)[field] = value;
    }

    try {
      const next = editAutomation(project, {kind: 'save', entity: 'nodes', value: record});
      this.selectedNetworkKey = automationNetworkKey(record);
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private updateNodeBinding(id: string, binding: BusNode['binding'] | undefined) {
    const project = this.getProject();
    const existing = automationData(project).nodes.find(n => n.id === id);
    if (!existing) return;
    const record: BusNode = {...existing};
    if (binding) record.binding = binding;
    else delete record.binding;

    try {
      const next = editAutomation(project, {kind: 'save', entity: 'nodes', value: record});
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private deleteNode(id: string) {
    try {
      const next = editAutomation(this.getProject(), {kind: 'remove', entity: 'nodes', id});
      if (this.selectedNodeId === id) this.selectedNodeId = '';
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }

  private deleteLink(id: string) {
    try {
      const next = editAutomation(this.getProject(), {kind: 'remove', entity: 'links', id});
      if (this.selectedLinkId === id) this.selectedLinkId = '';
      this.callbacks.onUpdateProject(next);
    } catch (e) {
      this.callbacks.onError(e);
    }
  }
}
