import type {Project} from '../../model/types';
import {automationData, type AutomationIssue} from '../../model/Automation';
import {escapeSvg as esc} from '../../model/ImportedDrawing';
import {tr} from '../../i18n';

export interface PlcRackVisualizerProps {
  project: Project;
  controllerId: string;
  rackId: string;
  selectedModuleId?: string;
  selectedChannelId?: string;
  issues: AutomationIssue[];
  onSelectModule?: (moduleId: string) => void;
  onSelectChannel?: (channelId: string) => void;
  onAddModulePrompt?: (rackId: string) => void;
}

function detectModuleVisualMeta(description: string, channels: {kind: string; address: string}[]) {
  const kindCount: Record<string, number> = {DI: 0, DO: 0, AI: 0, AO: 0};
  for (const ch of channels) {
    if (ch.kind in kindCount) kindCount[ch.kind]++;
  }
  const presentKinds = (['DI', 'DO', 'AI', 'AO'] as const).filter((k) => kindCount[k] > 0);
  let dominantKind = 'DI';
  let maxK = -1;
  for (const k of ['DI', 'DO', 'AI', 'AO'] as const) {
    if (kindCount[k] > maxK) {
      maxK = kindCount[k];
      dominantKind = k;
    }
  }

  const isSafety = /\bF-(?:DI|DQ|DO)|Fail-Safe|SIL\d|TwinSAFE/i.test(description);
  const isPs = channels.length === 0 && /\bPS\b|Stromversorgung|Power\s*Supply/i.test(description);
  const isCoupler = channels.length === 0 && /\bIM\b|\bBK\b|EK1100|AXL\s*F\s*BK|Koppler|Coupler|Interface/i.test(description);
  const isComm = channels.length === 0 && /\bCM\b|\bCP\b|IO-Link|Modbus|RS485|Ethernet|OPC/i.test(description);
  const isMixed = presentKinds.length > 1;

  const roleClass = isSafety
    ? `plc-role-safety plc-kind-${dominantKind.toLowerCase()}`
    : isPs
      ? 'plc-role-ps'
      : isCoupler
        ? 'plc-role-coupler'
        : isComm
          ? 'plc-role-comm'
          : isMixed
            ? 'plc-kind-mixed'
            : `plc-kind-${dominantKind.toLowerCase()}`;

  let footerSummary: string;
  if (channels.length > 0) {
    const breakdown = presentKinds.map((k) => `${kindCount[k]} ${k}`).join(' · ');
    const addrs = channels.map((c) => c.address.trim()).filter(Boolean);
    const span = addrs.length >= 2 ? ` · ${addrs[0]}..${addrs[addrs.length - 1]}` : addrs.length === 1 ? ` · ${addrs[0]}` : '';
    footerSummary = `${breakdown}${span}`;
  } else if (isPs) {
    footerSummary = '24V DC PS';
  } else if (isCoupler) {
    footerSummary = tr('Feldbuskoppler', 'Bus Coupler');
  } else if (isComm) {
    footerSummary = tr('Komm.-Modul', 'Comm Module');
  } else {
    footerSummary = `0 ${tr('Kanäle', 'Channels')}`;
  }

  return {
    dominantKind,
    roleClass,
    isSafety,
    isPs,
    isCoupler,
    isComm,
    footerSummary,
  };
}

export function renderPlcRackVisualizer(props: PlcRackVisualizerProps): string {
  const {
    project,
    controllerId,
    rackId,
    selectedModuleId,
    selectedChannelId,
    issues,
  } = props;

  const data = automationData(project);
  const controller = data.controllers.find((c) => c.id === controllerId);
  const modules = data.modules
    .filter((m) => m.controllerId === controllerId && (m.rack || '0') === rackId)
    .sort((a, b) => {
      const sa = parseInt(a.slot, 10);
      const sb = parseInt(b.slot, 10);
      if (isNaN(sa) && isNaN(sb)) return a.slot.localeCompare(b.slot);
      if (isNaN(sa)) return 1;
      if (isNaN(sb)) return -1;
      return sa - sb;
    });

  const controllerIssues = issues.filter((i) => i.entity === 'controllers' && i.recordId === controllerId);
  const controllerNodes = controller ? data.nodes.filter((n) => n.controllerId === controller.id) : [];

  let html = `
    <div class="plc-rack-container" data-rack-id="${esc(rackId)}">
      <div class="plc-din-rail">
        <div class="plc-din-rail-groove"></div>
      </div>
      <div class="plc-rack-slot-strip">
  `;

  // Render CPU / Head module on Rack 0 when controller exists
  if (rackId === '0' && controller) {
    const isSelected = !selectedModuleId || selectedModuleId === controller.id;
    const hasIssues = controllerIssues.length > 0;
    const portsHtml = controllerNodes.length
      ? controllerNodes
          .slice(0, 3)
          .map(
            (n) => `
          <div class="plc-port" title="${esc(`${n.name} (${n.protocol}${n.ipAddress ? ' · ' + n.ipAddress : n.address ? ' · ' + n.address : ''})`)}">
            ${esc(n.protocol)}
          </div>
        `,
          )
          .join('')
      : `<div class="plc-port" title="${esc(tr('Keine Busschnittstelle verknüpft', 'No bus interface linked'))}">BUS</div>`;

    html += `
      <div class="plc-module-card plc-module-cpu ${isSelected ? 'is-selected' : ''} ${hasIssues ? 'has-issues' : ''}"
           role="button" tabindex="0"
           data-select-controller="${esc(controller.id)}"
           title="${esc(controller.bmk + ' - ' + (controller.description || tr('Zentralbaugruppe (CPU)', 'Central Processing Unit')))}">
        <div class="plc-module-header">
          <span class="plc-slot-badge">Slot 0</span>
          <span class="plc-module-bmk">${esc(controller.bmk)}</span>
        </div>
        <div class="plc-module-body">
          <div class="plc-cpu-display">
            <span class="plc-cpu-title">${esc(controller.bmk)}</span>
            <span class="plc-cpu-sub">${esc(controller.description || 'CPU')}</span>
          </div>
          <div class="plc-status-leds">
            <div class="plc-led plc-led-run on" title="RUN"><span></span>RUN</div>
            <div class="plc-led plc-led-stop" title="STOP"><span></span>STOP</div>
            <div class="plc-led plc-led-error ${hasIssues ? 'on' : ''}" title="${hasIssues ? esc(controllerIssues.map((i) => i.message).join('; ')) : 'SF / Error'}"><span></span>SF</div>
          </div>
          <div class="plc-cpu-ports">
            ${portsHtml}
          </div>
        </div>
        <div class="plc-module-footer">
          <span class="plc-module-tag">${esc(controller.plant || '')} ${esc(controller.location || '')}</span>
        </div>
      </div>
    `;
  }

  // Render Modules in Rack
  for (const module of modules) {
    const isSelected = selectedModuleId === module.id;
    const moduleChannels = data.channels
      .filter((c) => c.moduleId === module.id)
      .sort((a, b) => {
        const na = parseInt(a.number, 10);
        const nb = parseInt(b.number, 10);
        if (isNaN(na) && isNaN(nb)) return a.number.localeCompare(b.number);
        if (isNaN(na)) return 1;
        if (isNaN(nb)) return -1;
        return na - nb;
      });

    const moduleIssues = issues.filter(
      (i) =>
        (i.entity === 'modules' && i.recordId === module.id) ||
        (i.entity === 'channels' && moduleChannels.some((c) => c.id === i.recordId)),
    );
    const hasIssues = moduleIssues.length > 0;
    const meta = detectModuleVisualMeta(module.description || '', moduleChannels);

    html += `
      <div class="plc-module-card plc-module-io ${meta.roleClass} ${isSelected ? 'is-selected' : ''} ${hasIssues ? 'has-issues' : ''}"
           role="button" tabindex="0"
           data-select-module="${esc(module.id)}"
           title="${esc(module.bmk + ' · ' + (module.description || meta.dominantKind))}">
        <div class="plc-module-header">
          <span class="plc-slot-badge">Slot ${esc(module.slot || '?')}</span>
          ${meta.isSafety ? `<span class="plc-safety-pill" title="Fail-Safe SIL 3 / PL e">F-SIL3</span>` : ''}
          <span class="plc-module-bmk">${esc(module.bmk)}</span>
        </div>
        <div class="plc-module-body">
          <div class="plc-module-desc" title="${esc(module.description || '')}">
            ${esc(module.description || `${meta.dominantKind} ${moduleChannels.length}x`)}
          </div>
          <div class="plc-status-leds mini">
            <div class="plc-led plc-led-run on" title="RUN / PWR"><span></span></div>
            <div class="plc-led plc-led-error ${hasIssues ? 'on' : ''}" title="${hasIssues ? esc(moduleIssues.map((i) => i.message).join('; ')) : 'OK'}"><span></span></div>
          </div>
    `;

    if (moduleChannels.length > 0) {
      html += `<div class="plc-pin-matrix ${moduleChannels.length > 16 ? 'is-dense' : ''}" title="${esc(tr('Klemmen & Signalstatus', 'Terminals & Signal Status'))}">`;
      for (const ch of moduleChannels) {
        const isChSelected = selectedChannelId === ch.id;
        const isBound = !!ch.signal;
        const isReserve = !!ch.reserve;
        const chIssue = issues.find((i) => i.entity === 'channels' && i.recordId === ch.id);

        let pinStateClass = 'state-unbound';
        let pinTooltip = `${ch.address || ch.number}: ${ch.signalText || ch.symbolicName || tr('Unbelegt', 'Unassigned')}`;
        if (chIssue) {
          pinStateClass = 'state-error';
          pinTooltip += ` [${chIssue.message}]`;
        } else if (isReserve) {
          pinStateClass = 'state-reserve';
          pinTooltip += ` (${tr('Reserve', 'Spare')})`;
        } else if (isBound) {
          pinStateClass = 'state-bound';
          pinTooltip += ` (${tr('Im Schaltplan verknüpft', 'Linked in schematic')})`;
        }

        html += `
          <div class="plc-pin-dot ${pinStateClass} ${isChSelected ? 'is-selected' : ''} ch-${ch.kind.toLowerCase()}"
               role="button" tabindex="0"
               data-select-channel="${esc(ch.id)}"
               data-channel-num="${esc(ch.number)}"
               title="${esc(pinTooltip)}">
            <span class="plc-pin-light"></span>
            <span class="plc-pin-num">${esc(ch.number)}</span>
          </div>
        `;
      }
      html += `</div>`;
    } else if (meta.isPs) {
      html += `
        <div class="plc-sys-faceplate">
          <strong>24V DC</strong>
          <span>${esc(tr('Systemversorgung', 'System Supply'))}</span>
        </div>
      `;
    } else if (meta.isCoupler) {
      html += `
        <div class="plc-sys-faceplate">
          <strong>BUS / PN</strong>
          <span>${esc(tr('Dezentraler Koppler', 'Remote Bus Coupler'))}</span>
        </div>
      `;
    } else if (meta.isComm) {
      html += `
        <div class="plc-sys-faceplate">
          <strong>⇄ COM</strong>
          <span>${esc(tr('Kommunikation', 'Communication'))}</span>
        </div>
      `;
    } else {
      html += `<div class="plc-pin-matrix"><div class="plc-no-channels">${esc(tr('Keine Kanäle', 'No channels'))}</div></div>`;
    }

    html += `
        </div>
        <div class="plc-module-footer">
          <span class="plc-channel-count" title="${esc(meta.footerSummary)}">${esc(meta.footerSummary)}</span>
        </div>
      </div>
    `;
  }

  // Empty state or "+ Baugruppe" placeholder slot
  if (!controller) {
    html += `
      <div class="plc-module-card plc-module-add-card"
           role="button" tabindex="0"
           data-hw-action="new-controller"
           title="${esc(tr('Erste Steuerung (CPU) anlegen', 'Create first controller (CPU)'))}">
        <div class="plc-add-card-inner">
          <span class="plc-add-card-icon">+</span>
          <span class="plc-add-card-text">${esc(tr('Erste Steuerung (CPU) anlegen', 'Create First Controller (CPU)'))}</span>
        </div>
      </div>
    `;
  } else {
    html += `
      <div class="plc-module-card plc-module-add-card"
           role="button" tabindex="0"
           data-add-module-prompt="${esc(rackId)}"
           title="${esc(tr('Baugruppe zu diesem Rack hinzufügen', 'Add module to this rack'))}">
        <div class="plc-add-card-inner">
          <span class="plc-add-card-icon">+</span>
          <span class="plc-add-card-text">${esc(tr('Baugruppe hinzufügen…', 'Add Module…'))}</span>
        </div>
      </div>
    `;
  }

  html += `
      </div>
    </div>
  `;

  return html;
}
