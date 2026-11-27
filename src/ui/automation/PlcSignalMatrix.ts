import type {Project} from '../../model/types';
import {automationData,type PlcChannel,type PlcModule,type AutomationIssue} from '../../model/Automation';
import {ProjectIndex} from '../../model/ProjectIndex';
import {escapeSvg as esc} from '../../model/ImportedDrawing';
import {tr} from '../../i18n';

export interface PlcSignalMatrixProps {
  project: Project;
  channels: PlcChannel[];
  modules: PlcModule[];
  issues: AutomationIssue[];
  selectedChannelId?: string;
  projectIndex: ProjectIndex;
}

export function formatChannelBinding(binding: {pageId: string; componentId: string; pinId?: string} | undefined, index: ProjectIndex): string {
  if (!binding) return '—';
  const c = index.component(binding.componentId, binding.pageId);
  const bmk = c?.component.bmk ?? binding.componentId;
  const pageNum = c?.page.pageNumber ? ` / Bl.${c.page.pageNumber}` : '';
  const pin = binding.pinId ? ` : ${binding.pinId}` : '';
  return `${bmk}${pageNum}${pin}`;
}

export function renderPlcSignalMatrix(props: PlcSignalMatrixProps): string {
  const {channels, modules, issues, selectedChannelId, projectIndex} = props;
  const modMap = new Map<string, PlcModule>(modules.map(m => [m.id, m]));

  if (channels.length === 0) {
    return `
      <div class="plc-matrix-empty">
        <p>${esc(tr('Keine E/A-Kanäle für die aktuelle Auswahl gefunden.', 'No I/O channels found for current selection.'))}</p>
        <p class="plc-matrix-empty-sub">${esc(tr('Wählen Sie eine andere Baugruppe oder fügen Sie über „+ Baugruppe“ neue Kanäle hinzu.', 'Select another module or add channels via "+ Module".'))}</p>
      </div>
    `;
  }

  let rowsHtml = '';
  for (const ch of channels) {
    const mod = modMap.get(ch.moduleId);
    const isSelected = selectedChannelId === ch.id;
    const chIssue = issues.find(i => i.entity === 'channels' && i.recordId === ch.id);
    const isBound = !!ch.signal;
    const isReserve = !!ch.reserve;

    let statusBadge = '';
    if (chIssue) {
      statusBadge = `<span class="plc-status-pill pill-error" title="${esc(chIssue.message)}">⚠ ${esc(tr('Fehler', 'Issue'))}</span>`;
    } else if (isReserve) {
      statusBadge = `<span class="plc-status-pill pill-reserve">${esc(tr('Reserve', 'Spare'))}</span>`;
    } else if (isBound) {
      statusBadge = `<span class="plc-status-pill pill-bound">${esc(tr('Belegt', 'Linked'))}</span>`;
    } else {
      statusBadge = `<span class="plc-status-pill pill-free">${esc(tr('Frei', 'Free'))}</span>`;
    }

    const kindClass = `plc-kind-badge kind-${ch.kind.toLowerCase()}`;
    const bindingText = formatChannelBinding(ch.signal, projectIndex);

    rowsHtml += `
      <tr class="plc-matrix-row ${isSelected ? 'is-selected' : ''} ${chIssue ? 'has-issue' : ''}" data-channel-row="${esc(ch.id)}">
        <td class="col-status">${statusBadge}</td>
        <td class="col-module" title="${esc(mod?.description || '')}">
          <strong>${esc(mod?.bmk || '—')}</strong>
          <small>Slot ${esc(mod?.slot || '?')}</small>
        </td>
        <td class="col-num">
          <span class="plc-chan-num">${esc(ch.number)}</span>
        </td>
        <td class="col-kind">
          <span class="${kindClass}">${esc(ch.kind)}</span>
        </td>
        <td class="col-address">
          <input class="plc-inline-input font-mono" 
                 type="text" 
                 value="${esc(ch.address || '')}" 
                 data-inplace-channel="${esc(ch.id)}" 
                 data-inplace-field="address" 
                 placeholder="%I0.0"
                 title="${esc(tr('E/A-Adresse bearbeiten', 'Edit I/O address'))}">
        </td>
        <td class="col-symbol">
          <input class="plc-inline-input" 
                 type="text" 
                 value="${esc(ch.symbolicName || '')}" 
                 data-inplace-channel="${esc(ch.id)}" 
                 data-inplace-field="symbolicName" 
                 placeholder="bSignal"
                 title="${esc(tr('Symbolischer Variablenname', 'Symbolic variable name'))}">
        </td>
        <td class="col-signaltext">
          <input class="plc-inline-input" 
                 type="text" 
                 value="${esc(ch.signalText || '')}" 
                 data-inplace-channel="${esc(ch.id)}" 
                 data-inplace-field="signalText" 
                 placeholder="${esc(tr('Funktionsbeschreibung…', 'Function text…'))}"
                 title="${esc(tr('Signalbeschreibung', 'Signal description'))}">
        </td>
        <td class="col-datatype">
          <input class="plc-inline-input font-mono plc-datatype-input" 
                 type="text" 
                 value="${esc(ch.dataType || (ch.kind === 'AI' || ch.kind === 'AO' ? 'INT' : 'BOOL'))}" 
                 data-inplace-channel="${esc(ch.id)}" 
                 data-inplace-field="dataType" 
                 title="${esc(tr('SPS-Datentyp', 'PLC data type'))}">
        </td>
        <td class="col-reserve text-center">
          <label class="plc-reserve-label" title="${esc(tr('Als Reserve markieren', 'Mark as spare'))}">
            <input type="checkbox" 
                   data-inplace-channel="${esc(ch.id)}" 
                   data-inplace-field="reserve" 
                   ${isReserve ? 'checked' : ''}>
          </label>
        </td>
        <td class="col-binding">
          <div class="plc-binding-wrap">
            <span class="plc-binding-text ${isBound ? 'is-bound' : 'is-unbound'}" title="${esc(bindingText)}">
              ${esc(bindingText)}
            </span>
            <div class="plc-binding-actions">
              ${isBound ? `
                <button class="btn btn-xs plc-btn-jump" 
                        data-jump-drawing="${esc(ch.id)}" 
                        title="${esc(tr('Im Schaltplan anzeigen & zentrieren', 'Jump to drawing & focus'))}">
                  ↗
                </button>
                <button class="btn btn-xs plc-btn-unbind" 
                        data-unbind-channel="${esc(ch.id)}" 
                        title="${esc(tr('Schaltplan-Verbindung lösen', 'Remove schematic binding'))}">
                  ✕
                </button>
              ` : `
                <button class="btn btn-xs btn-outline plc-btn-bind" 
                        data-bind-channel="${esc(ch.id)}" 
                        title="${esc(tr('Mit Bauteil-Pin im Schaltplan verknüpfen', 'Link with component pin in drawing'))}">
                  + ${esc(tr('Verknüpfen', 'Link'))}
                </button>
              `}
            </div>
          </div>
        </td>
        <td class="col-actions">
          <button class="btn btn-xs plc-btn-inspect" 
                  data-inspect-channel="${esc(ch.id)}" 
                  title="${esc(tr('Detaillierte Eigenschaften (Versorgung, Bezug etc.)', 'Full properties (Power, common etc.)'))}">
            ⚙
          </button>
          <button class="btn btn-xs plc-btn-delete" 
                  data-delete-channel="${esc(ch.id)}" 
                  title="${esc(tr('Kanal löschen', 'Delete channel'))}">
            🗑
          </button>
        </td>
      </tr>
    `;
  }

  return `
    <div class="plc-signal-matrix-container">
      <div class="plc-signal-matrix-table-wrap">
        <table class="plc-signal-matrix-table">
          <thead>
            <tr>
              <th class="col-status">${esc(tr('Status', 'Status'))}</th>
              <th class="col-module">${esc(tr('Baugruppe', 'Module'))}</th>
              <th class="col-num">${esc(tr('Nr.', 'No.'))}</th>
              <th class="col-kind">${esc(tr('Typ', 'Type'))}</th>
              <th class="col-address">${esc(tr('E/A-Adresse', 'Address'))}</th>
              <th class="col-symbol">${esc(tr('Symbolischer Name', 'Symbolic Name'))}</th>
              <th class="col-signaltext">${esc(tr('Signaltext', 'Signal Text'))}</th>
              <th class="col-datatype">${esc(tr('Datentyp', 'Data Type'))}</th>
              <th class="col-reserve text-center">${esc(tr('Reserve', 'Spare'))}</th>
              <th class="col-binding">${esc(tr('Schaltplan-Zuordnung', 'Schematic Binding'))}</th>
              <th class="col-actions">${esc(tr('Aktionen', 'Actions'))}</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
