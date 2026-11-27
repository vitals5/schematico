import type {Project} from '../../model/types';
import {automationData,type PlcModule,type PlcChannel,type AutomationIssue,type PlcController} from '../../model/Automation';
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
  const controller = data.controllers.find(c => c.id === controllerId);
  const modules = data.modules
    .filter(m => m.controllerId === controllerId && (m.rack || '0') === rackId)
    .sort((a, b) => {
      const sa = parseInt(a.slot, 10);
      const sb = parseInt(b.slot, 10);
      if (isNaN(sa) && isNaN(sb)) return a.slot.localeCompare(b.slot);
      if (isNaN(sa)) return 1;
      if (isNaN(sb)) return -1;
      return sa - sb;
    });

  const controllerIssues = issues.filter(i => i.entity === 'controllers' && i.recordId === controllerId);

  let html = `
    <div class="plc-rack-container" data-rack-id="${esc(rackId)}">
      <div class="plc-din-rail">
        <div class="plc-din-rail-groove"></div>
      </div>
      <div class="plc-rack-slot-strip">
  `;

  // Render CPU / Head module if rack is '0' and controller exists
  if (rackId === '0' && controller) {
    const isSelected = !selectedModuleId || selectedModuleId === controller.id;
    const hasIssues = controllerIssues.length > 0;
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
            <div class="plc-led plc-led-error ${hasIssues ? 'on' : ''}" title="${hasIssues ? esc(controllerIssues.map(i => i.message).join('; ')) : 'SF / Error'}"><span></span>SF</div>
          </div>
          <div class="plc-cpu-ports">
            <div class="plc-port" title="PROFINET / Ethernet Port X1P1">X1 P1</div>
            <div class="plc-port" title="PROFINET / Ethernet Port X1P2">X1 P2</div>
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
      .filter(c => c.moduleId === module.id)
      .sort((a, b) => {
        const na = parseInt(a.number, 10);
        const nb = parseInt(b.number, 10);
        if (isNaN(na) && isNaN(nb)) return a.number.localeCompare(b.number);
        if (isNaN(na)) return 1;
        if (isNaN(nb)) return -1;
        return na - nb;
      });

    const moduleIssues = issues.filter(i => 
      (i.entity === 'modules' && i.recordId === module.id) ||
      (i.entity === 'channels' && moduleChannels.some(c => c.id === i.recordId))
    );
    const hasIssues = moduleIssues.length > 0;

    // Detect dominant module kind (DI, DO, AI, AO)
    const kindCount: Record<string, number> = {DI: 0, DO: 0, AI: 0, AO: 0};
    for (const ch of moduleChannels) {
      if (ch.kind in kindCount) kindCount[ch.kind]++;
    }
    let dominantKind = 'DI';
    let maxK = -1;
    for (const [k, count] of Object.entries(kindCount)) {
      if (count > maxK) {
        maxK = count;
        dominantKind = k;
      }
    }

    html += `
      <div class="plc-module-card plc-module-io plc-kind-${dominantKind.toLowerCase()} ${isSelected ? 'is-selected' : ''} ${hasIssues ? 'has-issues' : ''}"
           role="button" tabindex="0"
           data-select-module="${esc(module.id)}"
           title="${esc(module.bmk + ' · ' + (module.description || dominantKind))}">
        <div class="plc-module-header">
          <span class="plc-slot-badge">Slot ${esc(module.slot || '?')}</span>
          <span class="plc-module-bmk">${esc(module.bmk)}</span>
        </div>
        <div class="plc-module-body">
          <div class="plc-module-desc" title="${esc(module.description || '')}">
            ${esc(module.description || `${dominantKind} ${moduleChannels.length}x`)}
          </div>
          <div class="plc-status-leds mini">
            <div class="plc-led plc-led-run on" title="RUN"><span></span></div>
            <div class="plc-led plc-led-error ${hasIssues ? 'on' : ''}" title="${hasIssues ? esc(moduleIssues.map(i => i.message).join('; ')) : 'OK'}"><span></span></div>
          </div>
          <div class="plc-pin-matrix" title="${esc(tr('Klemmen & Signalstatus', 'Terminals & Signal Status'))}">
    `;

    // Render Pin Indicators on Module
    for (const ch of moduleChannels) {
      const isChSelected = selectedChannelId === ch.id;
      const isBound = !!ch.signal;
      const isReserve = !!ch.reserve;
      const chIssue = issues.find(i => i.entity === 'channels' && i.recordId === ch.id);

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

    if (moduleChannels.length === 0) {
      html += `<div class="plc-no-channels">${esc(tr('Keine Kanäle', 'No channels'))}</div>`;
    }

    html += `
          </div>
        </div>
        <div class="plc-module-footer">
          <span class="plc-channel-count">${moduleChannels.length} ${dominantKind}</span>
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
