import './AutomationWorkspace.css';
import {AutomationMlDialog} from './AutomationMlDialog';
import {decodeKnxGroupXml, previewKnxGroupXml, exportKnxGroupXml, knxXmlMaxBytes} from '../model/KnxXmlExchange';
import {exportAutomationExchange, previewAutomationExchange, automationExchangeMaxBytes, automationExchangeIssueReport, type AutomationExchangePreview} from '../model/AutomationExchange';
import type {Project} from '../model/types';
import {automationData, inspectAutomation, type AutomationIssue} from '../model/Automation';
import {automationPlan, automationCsv} from '../reports/AutomationPlan';
import {automationPlanPdf} from '../export/AutomationPlanPdf';
import {ProjectIndex} from '../model/ProjectIndex';
import {projectRevision} from '../layout/types';
import {escapeSvg as esc} from '../model/ImportedDrawing';
import {bindArticleModalKeys, focusArticleModal} from './ArticleModal';
import {finishEngineeringDialog} from './EngineeringDialog';
import {downloadArticleFile, articleError} from './ArticleCatalogDialog';
import {tr} from '../i18n';

import {PlcHardwareWorkspace} from './automation/PlcHardwareWorkspace';
import {BusTopologyWorkspace} from './automation/BusTopologyWorkspace';
import {KnxRouterWorkspace} from './automation/KnxRouterWorkspace';

export type AutomationWorkspaceTab = 'plc' | 'bus' | 'knx';

export class AutomationDialog {
  private el = document.createElement('div');
  private workingProject!: Project;
  private initialRevision = '';
  private currentRevision = '';
  private activeTab: AutomationWorkspaceTab = 'plc';
  private issues: AutomationIssue[] = [];
  private plan: ReturnType<typeof automationPlan> = [];
  private index!: ProjectIndex;

  private plcWorkspace?: PlcHardwareWorkspace;
  private busWorkspace?: BusTopologyWorkspace;
  private knxWorkspace?: KnxRouterWorkspace;

  constructor(
    private getProject: () => Project,
    private onApply: (p: Project) => void,
    private navigate: (pageId: string, componentId: string) => void
  ) {}

  show() {
    if (document.getElementById('automationDialog')) return;
    this.el.id = 'automationDialog';
    this.el.className = 'modal-backdrop';
    this.el.style.cssText = 'position:fixed;inset:0;z-index:4200;display:flex;align-items:center;justify-content:center;background:#000a';
    document.body.append(this.el);

    bindArticleModalKeys(this.el, () => this.handleClose());
    this.refresh();
  }

  private handleClose() {
    this.el.remove();
  }

  private refresh() {
    this.workingProject = structuredClone(this.getProject());
    this.initialRevision = projectRevision(this.workingProject);
    this.currentRevision = this.initialRevision;
    this.updateAnalysis();
    this.initWorkspaces();
    this.render();
  }

  private updateAnalysis() {
    this.index = new ProjectIndex(this.workingProject);
    this.issues = inspectAutomation(this.workingProject, this.index);
    this.plan = automationPlan(this.workingProject, {index: this.index, issues: this.issues});
    this.currentRevision = projectRevision(this.workingProject);
  }

  private initWorkspaces() {
    const callbacks = {
      onUpdateProject: (p: Project) => {
        this.workingProject = p;
        this.updateAnalysis();
        this.clearError();
        this.renderWorkspaceOnly();
        this.updateHeaderTabs();
        this.updateFooter();
      },
      onNavigate: (pageId: string, componentId: string) => {
        if (this.isDirty()) {
          this.onApply(this.workingProject);
        }
        this.el.remove();
        this.navigate(pageId, componentId);
      },
      onError: (e: unknown) => {
        this.showError(e);
      },
    };

    this.plcWorkspace = new PlcHardwareWorkspace(
      () => this.workingProject,
      () => this.issues,
      () => this.index,
      callbacks
    );

    this.busWorkspace = new BusTopologyWorkspace(
      () => this.workingProject,
      () => this.issues,
      () => this.index,
      callbacks
    );

    this.knxWorkspace = new KnxRouterWorkspace(
      () => this.workingProject,
      () => this.issues,
      () => this.index,
      callbacks
    );
  }

  private isDirty(): boolean {
    return this.currentRevision !== this.initialRevision;
  }

  private showError(e: unknown) {
    const errEl = this.el.querySelector<HTMLElement>('[data-error]');
    if (errEl) {
      errEl.textContent = e instanceof Error ? e.message : String(e);
      errEl.scrollIntoView({block: 'nearest'});
    }
  }

  private clearError() {
    const errEl = this.el.querySelector<HTMLElement>('[data-error]');
    if (errEl) errEl.textContent = '';
  }

  private render() {
    const d = automationData(this.workingProject);
    const plcIssues = this.issues.filter(i => ['controllers', 'modules', 'channels'].includes(i.entity));
    const busIssues = this.issues.filter(i => ['nodes', 'links'].includes(i.entity));
    const knxIssues = this.issues.filter(i => ['knxGroups', 'knxObjects'].includes(i.entity));

    this.el.innerHTML = `
      <section role="dialog" aria-modal="true" class="auto-dialog-shell">
        <!-- Top Dialog Header -->
        <header class="auto-dialog-header">
          <div class="auto-header-title">
            <h2>⚡ ${esc(tr('SPS- & Bus-Navigator', 'PLC & Bus Navigator'))}</h2>
            <span class="auto-header-sub">${esc(tr('Hardware, Baugruppen, Feldbusse & Gebäudeautomation', 'Hardware, Modules, Fieldbuses & Building Automation'))}</span>
          </div>

          <!-- 3 Hauptreiter-Navigation -->
          <nav class="auto-top-tabs" role="tablist">
            <button class="auto-top-tab ${this.activeTab === 'plc' ? 'is-active' : ''}" 
                    data-tab-switch="plc" 
                    role="tab" 
                    aria-selected="${this.activeTab === 'plc'}">
              <span class="tab-icon">⚡</span>
              <span class="tab-label">${esc(tr('SPS & E/A-Hardware', 'PLC & I/O Hardware'))}</span>
              ${plcIssues.length ? `<span class="tab-alert-badge" title="${plcIssues.length} Hinweise">⚠ ${plcIssues.length}</span>` : ''}
              <span class="tab-count">${d.controllers.length} CPU · ${d.modules.length} Mod · ${d.channels.length} E/A</span>
            </button>

            <button class="auto-top-tab ${this.activeTab === 'bus' ? 'is-active' : ''}" 
                    data-tab-switch="bus" 
                    role="tab" 
                    aria-selected="${this.activeTab === 'bus'}">
              <span class="tab-icon">🌐</span>
              <span class="tab-label">${esc(tr('Bus- & Netzwerktopologie', 'Bus & Network Topology'))}</span>
              ${busIssues.length ? `<span class="tab-alert-badge" title="${busIssues.length} Hinweise">⚠ ${busIssues.length}</span>` : ''}
              <span class="tab-count">${d.nodes.length} Nodes · ${d.links.length} Links</span>
            </button>

            <button class="auto-top-tab ${this.activeTab === 'knx' ? 'is-active' : ''}" 
                    data-tab-switch="knx" 
                    role="tab" 
                    aria-selected="${this.activeTab === 'knx'}">
              <span class="tab-icon">🏢</span>
              <span class="tab-label">${esc(tr('Gebäudeautomation & KNX', 'Building Automation & KNX'))}</span>
              ${knxIssues.length ? `<span class="tab-alert-badge" title="${knxIssues.length} Hinweise">⚠ ${knxIssues.length}</span>` : ''}
              <span class="tab-count">${d.knxGroups.length} GA · ${d.knxObjects.length} KO</span>
            </button>
          </nav>

          <!-- Dropdown für Tools & Export/Import -->
          <div class="auto-header-tools">
            <details class="eng-tools-menu auto-tools">
              <summary class="btn">${esc(tr('Daten & Export', 'Data & Export'))}</summary>
              <div class="eng-tools-items">
                <span class="auto-tools-label">${esc(tr('AutomationML Austausch', 'AutomationML Exchange'))}</span>
                <button class="btn" data-aml>AutomationML…</button>
                <span class="auto-tools-label">${esc(tr('Berichte & Dokumente', 'Reports & Documents'))}</span>
                <button class="btn" data-pdf>${esc(tr('PDF-Übersicht exportieren', 'Export PDF Overview'))}</button>
                <button class="btn" data-csv>${esc(tr('CSV-Übersicht exportieren', 'Export CSV Overview'))}</button>
                <span class="auto-tools-label">${esc(tr('Tabellarischer CSV-Austausch', 'Tabular CSV Exchange'))}</span>
                <button class="btn" data-exchange-export>${esc(tr('Bearbeitungs-CSV exportieren', 'Export Editable CSV'))}</button>
                <button class="btn" data-exchange-import>${esc(tr('Bearbeitungs-CSV importieren', 'Import Editable CSV'))}</button>
                <span class="auto-tools-label">${esc(tr('Projektstand', 'Project State'))}</span>
                <button class="btn" data-refresh>${esc(tr('Neu laden (Verwerfen)', 'Reload (Discard)'))}</button>
              </div>
            </details>
            <input type="file" data-exchange-file accept=".csv,text/csv" hidden>
            <button class="btn-close" data-close aria-label="${esc(tr('Schließen', 'Close'))}">✕</button>
          </div>
        </header>

        <!-- Main Dynamic Workspace Body -->
        <main class="auto-dialog-main">
          <div class="auto-active-workspace-container" data-workspace-mount>
            ${this.renderActiveWorkspaceContent()}
          </div>
          <div data-preview class="auto-preview" role="status"></div>
          <p data-error role="alert" style="color:#fca5a5;white-space:pre-wrap;padding:0 20px"></p>
        </main>

        <!-- Footer -->
        <footer class="auto-dialog-footer">
          <div class="auto-footer-status">
            ${this.isDirty() ? `
              <span class="auto-dirty-indicator">● ${esc(tr('Ungespeicherte Änderungen vorhanden', 'Unsaved changes present'))}</span>
            ` : `
              <span class="auto-clean-indicator">✓ ${esc(tr('Aktueller Projektstand gespeichert', 'Current state saved'))}</span>
            `}
            ${this.issues.length ? `
              <span class="auto-issues-count">⚠ ${this.issues.length} ${esc(tr('Hinweise / Warnungen', 'Warnings / Issues'))}</span>
            ` : ''}
          </div>
          <div class="auto-footer-buttons">
            <button class="btn" data-close>${esc(tr('Schließen', 'Close'))}</button>
            <button class="btn btn-primary" data-apply ${this.isDirty() ? '' : 'disabled'}>
              ${esc(tr('Übernehmen (Speichern)', 'Apply (Save)'))}
            </button>
          </div>
        </footer>
      </section>
    `;

    this.bindEvents();
    this.bindWorkspaceContent();
    finishEngineeringDialog(this.el, {
      kind: 'automation',
      description: tr('Hardware, Baugruppen und Netze im Überblick', 'Hardware, modules, and networks at a glance'),
      wide: true,
      drawing: {project: this.getProject, navigate: this.navigate},
    });
    focusArticleModal(this.el);
  }

  private renderWorkspaceOnly() {
    const mount = this.el.querySelector<HTMLElement>('[data-workspace-mount]');
    if (!mount) return;
    let focusSelector: string | undefined;
    let selStart: number | null = null;
    let selEnd: number | null = null;
    const active = document.activeElement;
    if (active instanceof HTMLInputElement && mount.contains(active)) {
      for (const selector of ['[data-hw-filter="search"]', '[data-bus-filter="search"]', '[data-knx-filter="search"]']) {
        if (active.matches(selector)) {
          focusSelector = selector;
          selStart = active.selectionStart;
          selEnd = active.selectionEnd;
          break;
        }
      }
    }
    mount.innerHTML = this.renderActiveWorkspaceContent();
    this.bindWorkspaceContent();
    if (focusSelector) {
      const nextInput = mount.querySelector<HTMLInputElement>(focusSelector);
      if (nextInput) {
        nextInput.focus({preventScroll: true});
        if (selStart !== null && selEnd !== null) {
          try {
            nextInput.setSelectionRange(selStart, selEnd);
          } catch {}
        }
      }
    }
  }

  private updateHeaderTabs() {
    const d = automationData(this.workingProject);
    const tabConfig: {
      tab: AutomationWorkspaceTab;
      countText: string;
      issueCount: number;
    }[] = [
      {
        tab: 'plc',
        countText: `${d.controllers.length} CPU · ${d.modules.length} Mod · ${d.channels.length} E/A`,
        issueCount: this.issues.filter(i => ['controllers', 'modules', 'channels'].includes(i.entity)).length,
      },
      {
        tab: 'bus',
        countText: `${d.nodes.length} Nodes · ${d.links.length} Links`,
        issueCount: this.issues.filter(i => ['nodes', 'links'].includes(i.entity)).length,
      },
      {
        tab: 'knx',
        countText: `${d.knxGroups.length} GA · ${d.knxObjects.length} KO`,
        issueCount: this.issues.filter(i => ['knxGroups', 'knxObjects'].includes(i.entity)).length,
      },
    ];

    for (const cfg of tabConfig) {
      const btn = this.el.querySelector<HTMLButtonElement>(`[data-tab-switch="${cfg.tab}"]`);
      if (!btn) continue;
      const countEl = btn.querySelector<HTMLElement>('.tab-count');
      if (countEl) countEl.textContent = cfg.countText;
      let badgeEl = btn.querySelector<HTMLElement>('.tab-alert-badge');
      if (cfg.issueCount > 0) {
        if (!badgeEl) {
          badgeEl = document.createElement('span');
          badgeEl.className = 'tab-alert-badge';
          if (countEl) countEl.before(badgeEl);
          else btn.append(badgeEl);
        }
        badgeEl.title = `${cfg.issueCount} ${tr('Hinweise', 'Warnings')}`;
        badgeEl.textContent = `⚠ ${cfg.issueCount}`;
      } else if (badgeEl) {
        badgeEl.remove();
      }
    }
  }

  private updateFooter() {
    const footerStatus = this.el.querySelector<HTMLElement>('.auto-footer-status');
    const applyBtn = this.el.querySelector<HTMLButtonElement>('[data-apply]');

    if (footerStatus) {
      footerStatus.innerHTML = `
        ${this.isDirty() ? `
          <span class="auto-dirty-indicator">● ${esc(tr('Ungespeicherte Änderungen vorhanden', 'Unsaved changes present'))}</span>
        ` : `
          <span class="auto-clean-indicator">✓ ${esc(tr('Aktueller Projektstand gespeichert', 'Current state saved'))}</span>
        `}
        ${this.issues.length ? `
          <span class="auto-issues-count">⚠ ${this.issues.length} ${esc(tr('Hinweise / Warnungen', 'Warnings / Issues'))}</span>
        ` : ''}
      `;
    }

    if (applyBtn) {
      applyBtn.disabled = !this.isDirty();
    }
  }

  private renderActiveWorkspaceContent(): string {
    if (this.activeTab === 'plc') {
      return this.plcWorkspace ? this.plcWorkspace.render() : '';
    } else if (this.activeTab === 'bus') {
      return this.busWorkspace ? this.busWorkspace.render() : '';
    } else {
      return this.knxWorkspace ? this.knxWorkspace.render() : '';
    }
  }

  private bindWorkspaceContent() {
    const mount = this.el.querySelector<HTMLElement>('[data-workspace-mount]');
    if (!mount) return;

    if (this.activeTab === 'plc') {
      this.plcWorkspace?.bind(mount);
    } else if (this.activeTab === 'bus') {
      this.busWorkspace?.bind(mount);
    } else {
      this.knxWorkspace?.bind(mount);
    }
  }

  private bindEvents() {
    // Tab switching
    for (const btn of this.el.querySelectorAll<HTMLButtonElement>('[data-tab-switch]')) {
      btn.onclick = () => {
        const tab = btn.dataset.tabSwitch as AutomationWorkspaceTab;
        if (tab !== this.activeTab) {
          this.activeTab = tab;
          this.clearError();
          this.render();
        }
      };
    }

    // Apply button
    const applyBtn = this.el.querySelector<HTMLButtonElement>('[data-apply]');
    if (applyBtn) {
      applyBtn.onclick = () => {
        try {
          if (projectRevision(this.getProject()) !== this.initialRevision) {
            throw new Error(tr('Projekt wurde zwischenzeitlich extern geändert. Bitte aktualisieren.', 'Project was modified externally. Please refresh.'));
          }
          this.onApply(this.workingProject);
          this.initialRevision = projectRevision(this.workingProject);
          this.currentRevision = this.initialRevision;
          this.updateFooter();
        } catch (e) {
          this.showError(e);
        }
      };
    }

    // Close buttons
    for (const btn of this.el.querySelectorAll('[data-close]')) {
      (btn as HTMLElement).onclick = () => this.handleClose();
    }

    // Refresh
    const refreshBtn = this.el.querySelector<HTMLButtonElement>('[data-refresh]');
    if (refreshBtn) {
      refreshBtn.onclick = () => this.refresh();
    }

    // AutomationML
    const amlBtn = this.el.querySelector<HTMLButtonElement>('[data-aml]');
    if (amlBtn) {
      amlBtn.onclick = () => {
        new AutomationMlDialog(
          () => this.workingProject,
          p => {
            this.workingProject = p;
            this.updateAnalysis();
            this.render();
          },
          () => {
            if (this.el.isConnected) {
              this.render();
              focusArticleModal(this.el);
            }
          }
        ).show();
      };
    }

    // PDF Export
    const pdfBtn = this.el.querySelector<HTMLButtonElement>('[data-pdf]');
    if (pdfBtn) {
      pdfBtn.onclick = () => {
        try {
          automationPlanPdf(this.plan, this.workingProject.name, this.workingProject).save('schematico-sps-bus.pdf');
        } catch (e) {
          this.showError(articleError(e));
        }
      };
    }

    // CSV Overview Export
    const csvBtn = this.el.querySelector<HTMLButtonElement>('[data-csv]');
    if (csvBtn) {
      csvBtn.onclick = () => {
        try {
          downloadArticleFile(automationCsv(this.plan), 'schematico-sps-bus.csv', 'text/csv;charset=utf-8');
        } catch (e) {
          this.showError(e);
        }
      };
    }

    // CSV Exchange Export
    const exExportBtn = this.el.querySelector<HTMLButtonElement>('[data-exchange-export]');
    if (exExportBtn) {
      exExportBtn.onclick = async () => {
        try {
          const entity = this.activeTab === 'plc' ? 'channels' : this.activeTab === 'bus' ? 'nodes' : 'knxGroups';
          const ids = new Set(automationData(this.workingProject)[entity].map(r => r.id));
          const content = await exportAutomationExchange(this.workingProject, entity, ids);
          downloadArticleFile(content, `schematico-bearbeitung-${entity}.csv`, 'text/csv;charset=utf-8');
        } catch (e) {
          this.showError(e);
        }
      };
    }

    // Close tools dropdown when an action is selected
    const toolsMenu = this.el.querySelector<HTMLDetailsElement>('.auto-tools');
    toolsMenu?.querySelector('.eng-tools-items')?.addEventListener('click', e => {
      if ((e.target as Element).closest('button')) {
        toolsMenu.open = false;
      }
    });

    // CSV Exchange Import
    const exImportBtn = this.el.querySelector<HTMLButtonElement>('[data-exchange-import]');
    const exFileInput = this.el.querySelector<HTMLInputElement>('[data-exchange-file]');
    if (exImportBtn && exFileInput) {
      exImportBtn.onclick = () => exFileInput.click();
      exFileInput.onchange = async () => {
        const file = exFileInput.files?.[0];
        exFileInput.value = '';
        if (!file) return;

        try {
          if (file.size > automationExchangeMaxBytes) {
            throw new Error(tr('Datei ist größer als 4 MiB.', 'File exceeds 4 MiB.'));
          }
          const preview = await previewAutomationExchange(this.workingProject, await file.text());
          if (preview.next) {
            this.workingProject = preview.next;
            this.updateAnalysis();
            this.render();
          }
        } catch (e) {
          this.showError(e);
        }
      };
    }
  }
}
