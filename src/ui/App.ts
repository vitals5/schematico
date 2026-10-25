import { readAppSetting, writeAppSetting } from '../model/LegacyCompatibility';
import { getGeminiApiKey, setGeminiApiKey, testGeminiApiKey } from '../ai/GeminiConfig';
import { loadLastProject, saveLastProject, isAutoLoadProjectEnabled, setAutoLoadProjectEnabled } from '../model/ProjectStorage';
import { renderAppHeader, bindAppHeaderMenus } from './AppHeader';
import { AboutDialog } from './AboutDialog';
import { macroWithVariables } from '../model/NativeMacroVariables';
import { deviceBoxFields, collectDeviceBoxFields } from './DeviceBoxFields';
import { renderDeviceBoxProperties } from './DeviceBoxProperties';
import { externalMacroLibrary } from '../model/ExternalMacroLibrary';
import { createMacroFolderPanel, refreshMacroFolderPanels } from './MacroFolderPanel';
import { readImageFile } from './ImageFile';
import { setComponentLabelText, revealImportedComponentLabels } from '../model/LabelLayout';
import { selectionCount } from '../model/ElementSelection';
import { createCoverPage, defaultCoverPageTemplate } from '../model/CoverPage';
import { defaultPlotFrame } from '../model/PlotFrame';
import { t, getUiLanguage, setUiLanguage, onLanguageChange, Language, getCategoryLabel, getConnectionCategoryLabel, getMacroCategoryLabel, getLocalizedSymbol } from '../i18n';
import { CoverPageDialog } from './CoverPageDialog';
import { neutralSourceLabel, prepareProjectPresentation } from '../model/PresentationNaming';
import { SharedProperty, SelectionPatch, sharedPropertyValue, applySelectionProperties, propertyExistsOnAllSelected } from '../model/SelectionProperties';
import { cableCrossings } from '../model/CableDefinition';
// src/ui/App.ts
// Main application controller for Schematico (Elektro-CAD CAE Suite)

import { Project, Page, PlacedComponent, Wire, CableDefinition, PageText, WallSegment, WallOpening } from '../model/types';
import { getSymbolDefinitions, getSymbolById, getSymbolForComponent, setProjectSymbolLibrary, mergeProjectSymbolLibrary, getDrawingUnitsPerMm, getComponentSymbolLibrary } from '../model/symbols';
import { ProjectHistory } from '../model/ProjectHistory';
import { referenceMarkup } from '../model/CrossReferenceNavigation';
import { ELEMENT_CATEGORIES, symbolMatchesQuery } from '../model/SymbolCatalogue';
import { isConnectionSymbol, isInterruptionSymbol, connectionFamily } from '../model/ConnectionSymbols';
import { drawingToSvg, escapeSvg } from '../model/ImportedDrawing';
import { CadCanvas } from '../editor/CadCanvas';
import { CrossReferenceEngine } from '../model/CrossReferenceEngine';
import { PackageHandler, PackageInspectionResult } from '../packages/PackageHandler';
import { TerminalDiagramGenerator } from '../reports/TerminalDiagram';
import { PartsListGenerator } from '../reports/PartsList';
import { PdfExportDialog } from './PdfExportDialog';
import { PartCatalogue, MANUFACTURER_PARTS, ManufacturerPart } from '../model/PartCatalogue';
import { MobileConnectDialog } from './MobileConnectDialog';
import { PropertiesDialog } from './PropertiesDialog';
import { SymbolSelectionDialog } from './SymbolSelectionDialog';
import { PlausibilityDialog } from './PlausibilityDialog';
import { AutoconnectEngine } from '../model/AutoconnectEngine';
import { MacroManager, WindowMacro, PageMacro, MacroItem } from '../model/MacroManager';
import { MacroSelectionDialog } from './MacroSelectionDialog';
import { FloorPlanImportDialog } from './FloorPlanImportDialog';
import { collectFloorPlanLegendItems } from '../model/FloorPlanRenderer';

export class App {
  private project!: Project;
  private canvas!: CadCanvas;
  private history = new ProjectHistory();
  private inputSession = 0;
  private selectedComponent: PlacedComponent | null = null;
  private selectedWire: Wire | null = null;
  private selectedCable: CableDefinition | null = null;
  private selectedText: PageText | null = null;
  private selectedWall: WallSegment | null = null;
  private selectedOpening: WallOpening | null = null;
  private activeLeftTab: 'pages' | 'symbols' | 'connections' | 'macros' | 'terminals' | 'bom' | 'parts' = 'pages';
  private symbolCategoryFilter: string = 'all';
  private connectionCategoryFilter: string = 'all';
  private symbolSearchQuery = '';
  private connectionSearchQuery = '';
  private macroCategoryFilter: string = 'all';
  private macroSearchQuery: string = '';
  private macroPage = 0;
  private manufacturerFilter: string = 'all';
  private manufacturerSearchQuery: string = '';
  private leftDrawerOpen: boolean = false;
  private rightDrawerOpen: boolean = false;

  private leftSidebarWidth: number = 280;
  private rightSidebarWidth: number = 300;
  private isLeftCollapsed: boolean = false;
  private isRightCollapsed: boolean = false;
  private isFloatingBarMinimized: boolean = false;
  private autoSaveTimer: any = null;
  private saveFeedbackTimer: any = null;
  private currentFilePath: string | null = null;
  private currentFileHandle: any = null;
  private currentFileFormat: 'json' | 'zw1' | 'xml' = 'json';

  constructor() {
    const savedLeftW = readAppSetting('left_w');
    if (savedLeftW) this.leftSidebarWidth = parseInt(savedLeftW, 10) || 280;
    const savedRightW = readAppSetting('right_w');
    if (savedRightW) this.rightSidebarWidth = parseInt(savedRightW, 10) || 300;
    this.isFloatingBarMinimized = readAppSetting('floating_bar_minimized') === 'true';

    // Default panels to collapsed on mobile / small screens
    if (window.innerWidth <= 960) {
      this.isLeftCollapsed = true;
      this.isRightCollapsed = true;
    }

    if (!this.loadInitialProject()) {
      this.initDefaultProject();
    }
    this.renderLayout();
    this.initCanvas();
    this.history.reset(this.project);
    this.initHistoryEvents();
    this.initPanelResizers();
    onLanguageChange(() => {
      this.refreshUiLocalization();
    });
    this.updateUI();
    externalMacroLibrary.subscribe(() => {
      refreshMacroFolderPanels();
      if (this.activeLeftTab === 'macros') this.renderLeftTab();
    });
    void externalMacroLibrary.restore();

    if (this.isLeftCollapsed) this.setLeftPanelCollapsed(true);
    if (this.isRightCollapsed) this.setRightPanelCollapsed(true);

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.saveActiveProject();
      });
      window.addEventListener('keydown', (e) => {
        if (e.defaultPrevented) return;
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement
          || (e.target as HTMLElement)?.isContentEditable || (e.target as Element)?.closest?.('.modal-backdrop')) return;
        if (e.ctrlKey || e.metaKey) {
          const key = e.key.toLowerCase();
          if (key === 's') {
            e.preventDefault();
            if (e.shiftKey) {
              void this.saveProjectJson(true);
            } else {
              void this.saveProjectJson(false);
            }
          } else if (key === 'o') {
            e.preventDefault();
            void this.openProjectWithPicker();
          } else if (key === 'p') {
            e.preventDefault();
            new PdfExportDialog(this.project, this.project.activePageId).show();
          } else if (key === 'n') {
            e.preventDefault();
            this.createNewProject();
          }
        }
      });
    }
  }

  private loadInitialProject(): boolean {
    const project = loadLastProject();
    if (!project) return false;
    this.project = project;
    prepareProjectPresentation(this.project);
    revealImportedComponentLabels(this.project);
    setProjectSymbolLibrary(this.project);
    for (const p of this.project.pages) {
      AutoconnectEngine.updatePageAutoconnections(p);
    }
    CrossReferenceEngine.updateProjectCrossReferences(this.project);
    return true;
  }

  private loadDemoProject(): void {
    this.currentFilePath = null;
    this.currentFileHandle = null;
    this.currentFileFormat = 'json';
    this.initDefaultProject();
    this.selectedComponent = null;
    this.selectedWire = null;
    this.selectedCable = null;
    this.canvas.setProject(this.project);
    if (this.project.activePageId) {
      this.canvas.setPage(this.project.activePageId);
    }
    this.canvas.fitToScreen();
    this.history.reset(this.project);
    this.updateUI();
    this.saveActiveProject();
  }

  private triggerAutoSave(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
    this.autoSaveTimer = setTimeout(() => {
      this.saveActiveProject();
    }, 400);
  }

  private saveActiveProject(): void {
    if (!this.project) return;
    saveLastProject(this.project);
  }

  private initDefaultProject(): void {
    const dummyFile = new File([''], 'Projekt_Einspeisung.zw1');
    // Generates the initial project with Cover, 400V Motor circuit, 24V DC control circuit, and PLC/Sensor circuit
    const res = (PackageHandler as any).createProjectFromPackageMetadata('Conveyor System Control FA-400', '', []);
    this.project = res;
    setProjectSymbolLibrary(this.project);
    for (const p of this.project.pages) {
      AutoconnectEngine.updatePageAutoconnections(p);
    }
    CrossReferenceEngine.updateProjectCrossReferences(this.project);
  }

  private renderLayout(): void {
    const root = document.getElementById('app');
    if (!root) return;

    root.innerHTML = `
      ${renderAppHeader(this.project.name)}

      <!-- Backdrop for mobile drawers -->
      <div class="drawer-backdrop" id="drawerBackdrop"></div>

      <!-- Main Workspace -->
      <div class="main-container" id="mainContainer">
        <!-- Left Sidebar -->
        <aside class="sidebar" id="leftSidebar" style="width: ${this.leftSidebarWidth}px;">
          <div class="sidebar-top-bar">
            <span class="sidebar-heading">${t('leftHeading')}</span>
            <button class="btn-panel-collapse" id="btnCollapseLeft" title="${t('collapseLeftPanel')} (◀)">◀</button>
          </div>
          <div class="tab-nav">
            <button class="tab-btn active" data-tab="pages">${t('tabPages')}</button>
            <button class="tab-btn" data-tab="symbols">${t('tabSymbols')}</button>
            <button class="tab-btn" data-tab="connections">${t('tabConnections')}</button>
            <button class="tab-btn" data-tab="macros">${t('tabMacros')}</button>
            <button class="tab-btn" data-tab="parts">${getUiLanguage() === 'de' ? 'Artikel' : 'Parts'}</button>
            <button class="tab-btn" data-tab="terminals">${t('tabTerminals')}</button>
            <button class="tab-btn" data-tab="bom">${t('tabBom')}</button>
          </div>
          <div class="tab-content" id="leftTabContent"></div>
        </aside>

        <!-- Left Resizer Splitter -->
        <div class="sidebar-resizer" id="leftResizer" title="${t('adjustWidth')}">
          <div class="resizer-handle"></div>
          <button class="resizer-expand-btn left" id="btnExpandLeft" title="${t('expandLeftPanel')}" style="display: none;">▶</button>
        </div>

        <!-- Center CAD Canvas -->
        <main class="canvas-wrapper" id="canvasContainer">
          <!-- Floating Symbol Placement Banner -->
          <div class="place-hint-banner" id="placeHintBanner" style="display: none;">
            <span id="placeHintText">${t('placeHintText')}</span>
            <button class="btn-banner-close" id="btnCancelPlace" title="${t('btnCancelPlace')}">✕</button>
          </div>

          <!-- Floating Selection Action Bar (always visible on canvas when component selected) -->
          <div class="selection-floating-bar" id="selectionFloatingBar" style="
            position: absolute;
            bottom: 64px;
            left: 50%;
            transform: translateX(-50%);
            display: none;
            background: rgba(30, 36, 46, 0.96);
            backdrop-filter: blur(12px);
            border: 1px solid #4a5568;
            box-shadow: 0 10px 28px rgba(0,0,0,0.7);
            border-radius: 8px;
            padding: 8px 14px;
            z-index: 1000;
            align-items: center;
            gap: 10px;
          ">
            <span id="selectionFloatingTag" style="font-weight: bold; font-family: monospace; color: #f6e05e; font-size: 13px;">-K1</span>
            <button class="btn btn-primary" id="btnFloatingEdit" style="padding: 6px 14px; font-size: 12px; font-weight: 600; background: #3182ce; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
              <span>${t('btnFloatingEdit')}</span>
            </button>
            <button class="btn" id="btnFloatingCopy" style="padding: 6px 10px; font-size: 12px;" title="${t('toolCopy')}">📋</button>
            <button class="btn" id="btnFloatingDuplicate" style="padding: 6px 10px; font-size: 12px;" title="${t('toolDuplicate')}">📑</button>
            <button class="btn" id="btnFloatingExportMacro" style="padding: 6px 10px; font-size: 12px; background: rgba(66, 153, 225, 0.2); border-color: #3182ce;" title="${t('btnFloatingSaveMacroTitle')}">${t('btnFloatingSaveMacro')}</button>
            <button class="btn" id="btnFloatingRotate" style="padding: 6px 10px; font-size: 12px;" title="${t('toolRotate')}">🔄</button>
            <button class="btn" id="btnFloatingDelete" style="padding: 6px 10px; font-size: 12px; color: #fc8181; border-color: #e53e3e;" title="${t('toolDelete')}">🗑️</button>
            <button class="btn" id="btnFloatingContextMenu" style="padding: 6px 10px; font-size: 13px;" title="Kontextmenü">⋮</button>
            <button class="btn" id="btnMinimizeFloatingBar" style="padding: 6px 9px; font-size: 11px; color: #a0aec0;" title="${t('btnMinimizeFloatingBar')}">▼</button>
          </div>

          <!-- Minimized Floating Selection Pill -->
          <button type="button" class="btn" id="selectionFloatingRestoreBtn" title="${t('btnExpandFloatingBar')}" style="
            position: absolute;
            bottom: 8px;
            left: 50%;
            transform: translateX(-50%);
            display: none;
            background: rgba(30, 36, 46, 0.88);
            backdrop-filter: blur(8px);
            border: 1px solid #4a5568;
            border-radius: 999px;
            padding: 3px 12px;
            font-size: 11px;
            color: #cbd5e0;
            z-index: 1000;
            align-items: center;
            gap: 6px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            cursor: pointer;
          ">
            <span>▲</span>
            <span id="selectionFloatingRestoreTag" style="font-family: monospace; color: #f6e05e; font-weight: 600;"></span>
          </button>

          <!-- Touch Navigation & Zoom Floating HUD -->
          <div class="touch-nav-hud" id="touchNavHud">
            <button type="button" class="touch-hud-toggle" id="btnToggleNavHud" title="Navigation ein-/ausblenden" aria-label="Toggle Navigation">🧭</button>
            <div class="touch-hud-content" id="touchHudContent">
              <div class="touch-dpad">
                <button type="button" class="dpad-btn dpad-up" id="btnNavUp" title="Nach oben scrollen" aria-label="Up">▲</button>
                <div class="dpad-row">
                  <button type="button" class="dpad-btn dpad-left" id="btnNavLeft" title="Nach links scrollen" aria-label="Left">◀</button>
                  <button type="button" class="dpad-btn dpad-center" id="btnNavFit" title="Ganzes Blatt zentrieren" aria-label="Fit">⛶</button>
                  <button type="button" class="dpad-btn dpad-right" id="btnNavRight" title="Nach rechts scrollen" aria-label="Right">▶</button>
                </div>
                <button type="button" class="dpad-btn dpad-down" id="btnNavDown" title="Nach unten scrollen" aria-label="Down">▼</button>
              </div>
              <div class="touch-hud-tools">
                <button type="button" class="hud-btn" id="btnNavZoomIn" title="Vergrößern (Zoom In)" aria-label="Zoom In">➕</button>
                <button type="button" class="hud-btn" id="btnNavZoomOut" title="Verkleinern (Zoom Out)" aria-label="Zoom Out">➖</button>
                <button type="button" class="hud-btn" id="btnNavPanMode" title="Hand-Werkzeug (Verschieben)" aria-label="Pan">✋</button>
                <button type="button" class="hud-btn" id="btnNavMultiSelect" title="Mehrfachauswahl umschalten" aria-label="Multi-Select">☑️</button>
              </div>
            </div>
          </div>

          <!-- Mobile Floating Action Bar -->
          <div class="mobile-floating-bar" id="mobileFloatingBar">
            <button class="btn-fab btn-fab-primary" id="fabEdit" title="${t('fabEditTitle')}">${t('fabEdit')}</button>
            <button class="btn-fab" id="fabFit" title="${t('menuFit')}">${t('fabFit')}</button>
            <button class="btn-fab" id="fabWire" title="${t('toolWireLabel')}">${t('fabWire')}</button>
            <button class="btn-fab" id="fabRotate" title="${t('menuRotate')}">${t('fabRotate')}</button>
            <button class="btn-fab" id="fabDelete" title="${t('menuDelete')}">${t('fabDelete')}</button>
            <button class="btn-fab" id="fabPdf" title="${t('toolExportPdf')}">${t('fabPdf')}</button>
          </div>
        </main>

        <!-- Right Resizer Splitter -->
        <div class="sidebar-resizer right" id="rightResizer" title="${t('adjustWidth')}">
          <div class="resizer-handle"></div>
          <button class="resizer-expand-btn right" id="btnExpandRight" title="${t('expandRightPanel')}" style="display: none;">◀</button>
        </div>

        <!-- Right Sidebar -->
        <aside class="sidebar right" id="rightSidebar" style="width: ${this.rightSidebarWidth}px;">
          <div class="sidebar-top-bar">
            <span class="sidebar-heading" id="rightSidebarHeading">${t('rightHeading')}</span>
            <button class="btn-panel-collapse" id="btnCollapseRight" title="${t('collapseRightPanel')} (▶)">▶</button>
          </div>
          <div class="tab-content" id="rightTabContent"></div>
        </aside>
      </div>

      <!-- Bottom Status Bar -->
      <footer class="status-bar">
        <div id="statusLeft">${t('statusReady')}</div>
        <div id="statusRight"></div>
      </footer>
    `;

    this.bindHeaderEvents();
    this.updateStatusBar();
  }

  private initCanvas(): void {
    const container = document.getElementById('canvasContainer');
    if (!container) return;

    this.canvas = new CadCanvas(container, this.project, {
      onSelectComponent: (comp) => {
        this.selectedCable=null;this.selectedText=null;this.selectedWall=null;this.selectedOpening=null;if(this.canvas)this.canvas.selectedCableId=null;
        this.selectedComponent = comp;
        if (comp) this.selectedWire = null;
        this.updateFloatingSelectionBar();
        this.renderRightTab();
      },
      onSelectWire: (wire) => {
        this.selectedCable=null;this.selectedText=null;this.selectedWall=null;this.selectedOpening=null;if(this.canvas)this.canvas.selectedCableId=null;
        this.selectedWire = wire;
        if (wire) this.selectedComponent = null;
        this.updateFloatingSelectionBar();
        this.renderRightTab();
      },
      onSelectText: text => {
        this.selectedText = text;
        if (text) {
          this.selectedComponent = null;
          this.selectedWire = null;
          this.selectedCable = null;
          this.selectedWall = null;
          this.selectedOpening = null;
          if (this.isRightCollapsed) this.setRightPanelCollapsed(false);
        }
        this.updateFloatingSelectionBar();
        this.renderRightTab();
      },
      onSelectCable: cable => {
        this.selectedCable=cable;this.selectedText=null;this.selectedWall=null;this.selectedOpening=null;
        if(cable){this.selectedComponent=null;this.selectedWire=null;}
        this.updateFloatingSelectionBar();this.renderRightTab();
      },
      onSelectWall: wall => {
        this.selectedWall = wall;
        if (wall) {
          this.selectedComponent = null;
          this.selectedWire = null;
          this.selectedCable = null;
          this.selectedText = null;
          this.selectedOpening = null;
        }
        this.updateFloatingSelectionBar();
        this.renderRightTab();
      },
      onSelectOpening: opening => {
        this.selectedOpening = opening;
        if (opening) {
          this.selectedComponent = null;
          this.selectedWire = null;
          this.selectedCable = null;
          this.selectedText = null;
          this.selectedWall = null;
        }
        this.updateFloatingSelectionBar();
        this.renderRightTab();
      },
      onSelectionChanged: selection => {
        if (selection.textIds?.length === 1) {
          const page = this.project.pages.find(p => p.id === this.project.activePageId);
          this.selectedText = page?.texts?.find(t => t.id === selection.textIds![0]) ?? null;
        } else if (selectionCount(selection) === 0 || !selection.textIds?.length) {
          this.selectedText = null;
        }
        this.updateFloatingSelectionBar();this.renderRightTab();
      },
      onOpenSelectionProperties: () => this.openSelectionProperties(true),
      onOpenCoverPage:()=>{const page=this.project.pages.find(p=>p.id===this.project.activePageId);if(page?.pageType==='cover')this.openCoverPage(page);},
      onOpenProperties: (comp) => {
        this.openPropertiesDialog(comp);
      },
      onOpenSymbolSelection: () => {
        new SymbolSelectionDialog({
          onSelect: (sym) => {
            this.canvas.setSymbolToPlace(sym.id);
          }
        }).show();
      },
      onOpenMacroSelection: () => {
        this.openMacroSelectionDialog();
      },
      onExportSelectedMacro: (comps) => {
        this.exportComponentsAsMacro(comps);
      },
      onNavigateToPage: (pageId) => {
        this.canvas.setPage(pageId);
        this.updateUI();
      },
      onUndo: () => this.undo(),
      onRedo: () => this.redo(),
      onProjectModified: () => {
        const banner = document.getElementById('placeHintBanner');
        if (banner) banner.style.display = 'none';
        if(this.canvas.mode==='select')this.updateToolButtons('btnToolSelect');
        this.updateUI();
      }
    });

    // Support dragging macro files (.ema, .ems, .edz) directly onto CAD canvas
    container.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    container.addEventListener('drop', async (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file) {
        if (file.name.endsWith('.floorplan.json')) {
          await this.importFloorPlanPageFromFile(file);
        } else if (/\.(ema|ems|edz|xml|json)$/i.test(file.name)) {
          await this.handleMacroFileDrop(file, e.clientX, e.clientY);
        }
      }
    });

    // Make sure initial page is loaded
    this.canvas.setPage(this.project.activePageId || this.project.pages[0].id);
  }

  public openPropertiesDialog(comp: PlacedComponent): void {
    new PropertiesDialog(comp, this.project, {
      onNavigateToReference: (index) => this.canvas.followReference(comp, index),
      onSave: (updated) => {
        // 1. Mutate the original comp in-place so all references stay updated
        Object.assign(comp, updated);
        this.selectedComponent = comp;

        // 2. Also ensure activePage components array has this exact updated object
        const activePage = this.project.pages.find(p => p.id === this.project.activePageId);
        if (activePage) {
          const idx = activePage.components.findIndex(c => c.id === comp.id);
          if (idx !== -1) {
            activePage.components[idx] = comp;
          }
          if (this.canvas.autoconnectEnabled) {
            AutoconnectEngine.updatePageAutoconnections(activePage);
          }
        }

        // 3. Mark change, recalculate cross references, re-render canvas and UI
        this.notifyChange();
        this.updateFloatingSelectionBar();
        this.renderRightTab();
      }
    }).show();
  }

  public updateFloatingSelectionBar(): void {
    const bar = document.getElementById('selectionFloatingBar');
    const tag = document.getElementById('selectionFloatingTag');
    const restoreBtn = document.getElementById('selectionFloatingRestoreBtn');
    const restoreTag = document.getElementById('selectionFloatingRestoreTag');
    const btnEdit = document.getElementById('btnFloatingEdit');
    const btnRot = document.getElementById('btnFloatingRotate');
    const btnDel = document.getElementById('btnFloatingDelete');

    for(const [id,enabled]of [['menuGroup',this.canvas?.canGroupSelection()],['menuUngroup',this.canvas?.canUngroupSelection()]] as const){const button=document.getElementById(id) as HTMLButtonElement|null;if(button)button.disabled=!enabled;}
    const imageSelected=!!this.canvas?.selectedImageId,boxSelected=!!this.canvas?.selectedBoxId;
    const textSelected=!!this.selectedText || (this.canvas?.getElementSelection().textIds?.length === 1);
    const wallSelected=!!this.selectedWall, openingSelected=!!this.selectedOpening;
    const multiple=this.canvas && selectionCount(this.canvas.getElementSelection())>1;
    const hasSelection=(this.canvas && selectionCount(this.canvas.getElementSelection())>0) || wallSelected || openingSelected;
    const hasClip=this.canvas?.hasClipboard() ?? false;
    for(const id of ['btnToolCopy','menuCopy','menuCut']){const button=document.getElementById(id) as HTMLButtonElement|null;if(button)button.disabled=!hasSelection||wallSelected||openingSelected;}
    for(const id of ['btnToolPaste','menuPaste']){const button=document.getElementById(id) as HTMLButtonElement|null;if(button)button.disabled=!hasClip;}
    for(const id of ['btnToolDuplicate','menuDuplicate']){const button=document.getElementById(id) as HTMLButtonElement|null;if(button)button.disabled=!hasSelection||wallSelected||openingSelected;}
    for(const id of ['btnToolRotate','menuRotate']){const button=document.getElementById(id) as HTMLButtonElement|null;if(button)button.disabled=!hasSelection||!!multiple||imageSelected||boxSelected||wallSelected||openingSelected;}
    const macroButton=document.getElementById('btnFloatingExportMacro');if(macroButton)macroButton.style.display=imageSelected||boxSelected||textSelected||wallSelected||openingSelected||!this.canvas?.getElementSelection().componentIds.length?'none':'';
    if (bar && tag) {
      let shouldShow = true;
      if (multiple) {
        tag.textContent = `${this.canvas.canUngroupSelection() ? t('menuGroup') + ': ' : ''}${t('foundElements', { count: selectionCount(this.canvas.getElementSelection()) })}`;
        if(btnEdit)btnEdit.style.display='inline-flex';if(btnRot)btnRot.style.display='none';
        if(btnDel){btnDel.title=t('floatingSelectionDeleteTitle');btnDel.textContent='🗑️';}
      } else if(boxSelected) {
        tag.textContent=t('boxHeading');if(btnEdit)btnEdit.style.display='inline-flex';if(btnRot)btnRot.style.display='none';if(btnDel){btnDel.title=t('floatingBoxDeleteTitle');btnDel.textContent='🗑️';}
      } else if(imageSelected) {
        tag.textContent=t('imageHeading');if(btnEdit)btnEdit.style.display='inline-flex';if(btnRot)btnRot.style.display='none';if(btnDel){btnDel.title=t('floatingImageDeleteTitle');btnDel.textContent='🗑️';}
      } else if (this.selectedText) {
        const preview = this.selectedText.text.length > 16 ? this.selectedText.text.substring(0, 16) + '...' : this.selectedText.text;
        tag.textContent = `📝 "${preview || 'Text'}"`;
        if (btnEdit) btnEdit.style.display = 'inline-flex';
        if (btnRot) btnRot.style.display = 'inline-block';
        if (btnDel) { btnDel.title = t('toolDelete'); btnDel.textContent = '🗑️'; }
      } else if (this.selectedWall) {
        const len = Math.round(Math.hypot(this.selectedWall.end.x - this.selectedWall.start.x, this.selectedWall.end.y - this.selectedWall.start.y));
        tag.textContent = t('floatingWallTag', { len });
        if (btnEdit) btnEdit.style.display = 'inline-flex';
        if (btnRot) btnRot.style.display = 'none';
        if (btnDel) { btnDel.title = t('toolDelete'); btnDel.textContent = '🗑️'; }
      } else if (this.selectedOpening) {
        const typeName = this.selectedOpening.kind === 'door' ? t('openingDoorName') : this.selectedOpening.kind === 'window' ? t('openingWindowName') : this.selectedOpening.kind === 'garage_door' ? t('openingGarageName') : t('openingGenericName');
        tag.textContent = `🚪 ${typeName} (${this.selectedOpening.width} mm)`;
        if (btnEdit) btnEdit.style.display = 'inline-flex';
        if (btnRot) btnRot.style.display = 'none';
        if (btnDel) { btnDel.title = t('toolDelete'); btnDel.textContent = '🗑️'; }
      } else if (this.selectedComponent) {
        const sym = getSymbolForComponent(this.selectedComponent);
        const locSym = sym ? getLocalizedSymbol(sym) : undefined;
        tag.textContent = `${this.selectedComponent.bmk} (${this.selectedComponent.functionText || locSym?.name || t('componentLabel')})`;
        if (btnEdit) btnEdit.style.display = 'inline-flex';
        if (btnRot) btnRot.style.display = 'inline-block';
        if (btnDel) {
          btnDel.title = t('floatingCompDeleteTitle');
          btnDel.textContent = '🗑️';
        }
      } else if (this.selectedCable) {
        tag.textContent = t('floatingCable', { name: this.selectedCable.bmk || this.selectedCable.cableType || t('cableHeading') });
        if(btnEdit)btnEdit.style.display='inline-flex';if(btnRot)btnRot.style.display='inline-block';
        if(btnDel)btnDel.title=t('floatingCableDeleteTitle');
      } else if (this.selectedWire) {
        tag.textContent = t('floatingWire', { potential: this.selectedWire.potential, color: this.selectedWire.color || 'BK', section: this.selectedWire.crossSection || '1.5mm²' });
        if (btnEdit) btnEdit.style.display = 'none';
        if (btnRot) btnRot.style.display = 'none';
        if (btnDel) {
          btnDel.title = t('floatingWireDisconnectTitle');
          btnDel.textContent = t('floatingWireDisconnect');
        }
      } else {
        shouldShow = false;
      }

      if (restoreTag) {
        restoreTag.textContent = tag.textContent || '';
      }
      if (!shouldShow) {
        bar.style.display = 'none';
        if (restoreBtn) restoreBtn.style.display = 'none';
      } else if (this.isFloatingBarMinimized) {
        bar.style.display = 'none';
        if (restoreBtn) restoreBtn.style.display = 'inline-flex';
      } else {
        bar.style.display = 'flex';
        if (restoreBtn) restoreBtn.style.display = 'none';
      }
    }
    const menuFloatingBar = document.getElementById('menuToggleFloatingBar');
    if (menuFloatingBar) {
      menuFloatingBar.setAttribute('aria-pressed', String(!this.isFloatingBarMinimized));
    }
    document.getElementById('btnNavMultiSelect')?.classList.toggle('active', !!this.canvas?.multiSelectMode);
    document.getElementById('btnNavPanMode')?.classList.toggle('active', this.canvas?.mode === 'pan');
  }

  public setFloatingBarMinimized(minimized: boolean): void {
    this.isFloatingBarMinimized = minimized;
    writeAppSetting('floating_bar_minimized', minimized ? 'true' : 'false');
    this.updateFloatingSelectionBar();
  }

  public setLeftPanelCollapsed(collapsed: boolean): void {
    this.isLeftCollapsed = collapsed;
    const sidebar = document.getElementById('leftSidebar');
    const expandBtn = document.getElementById('btnExpandLeft');
    const toggleBtn = document.getElementById('btnToggleLeftSidebar');
    const resizer = document.getElementById('leftResizer');

    if (sidebar) {
      if (collapsed) {
        sidebar.classList.add('collapsed');
        sidebar.style.width = '0px';
        if (expandBtn) expandBtn.style.display = 'flex';
        toggleBtn?.classList.remove('active');
        resizer?.classList.add('collapsed');
      } else {
        sidebar.classList.remove('collapsed');
        sidebar.style.width = `${this.leftSidebarWidth}px`;
        if (expandBtn) expandBtn.style.display = 'none';
        toggleBtn?.classList.add('active');
        resizer?.classList.remove('collapsed');
      }
    }
    setTimeout(() => this.canvas?.render(), 120);
  }

  public setRightPanelCollapsed(collapsed: boolean): void {
    this.isRightCollapsed = collapsed;
    const sidebar = document.getElementById('rightSidebar');
    const expandBtn = document.getElementById('btnExpandRight');
    const toggleBtn = document.getElementById('btnToggleRightSidebar');
    const resizer = document.getElementById('rightResizer');

    if (sidebar) {
      if (collapsed) {
        sidebar.classList.add('collapsed');
        sidebar.style.width = '0px';
        if (expandBtn) expandBtn.style.display = 'flex';
        toggleBtn?.classList.remove('active');
        resizer?.classList.add('collapsed');
      } else {
        sidebar.classList.remove('collapsed');
        sidebar.style.width = `${this.rightSidebarWidth}px`;
        if (expandBtn) expandBtn.style.display = 'none';
        toggleBtn?.classList.add('active');
        resizer?.classList.remove('collapsed');
      }
    }
    setTimeout(() => this.canvas?.render(), 120);
  }

  private initPanelResizers(): void {
    const leftResizer = document.getElementById('leftResizer');
    const rightResizer = document.getElementById('rightResizer');
    const leftSidebar = document.getElementById('leftSidebar');
    const rightSidebar = document.getElementById('rightSidebar');
    const mainContainer = document.getElementById('mainContainer');

    if (leftResizer && leftSidebar && mainContainer) {
      const onMove = (clientX: number) => {
        if (this.isLeftCollapsed) {
          this.setLeftPanelCollapsed(false);
        }
        const rect = mainContainer.getBoundingClientRect();
        let newW = clientX - rect.left;
        newW = Math.max(160, Math.min(newW, Math.min(550, window.innerWidth - 200)));
        this.leftSidebarWidth = newW;
        leftSidebar.style.width = `${newW}px`;
        localStorage.setItem('schematico_left_w', String(newW));
      };

      const startLeftDrag = (e: MouseEvent | TouchEvent) => {
        if ((e.target as HTMLElement).closest('.resizer-expand-btn')) return;
        e.preventDefault();
        document.body.classList.add('resizing');
        const moveHandler = (ev: MouseEvent | TouchEvent) => {
          const clientX = 'touches' in ev ? ev.touches[0].clientX : ev.clientX;
          onMove(clientX);
        };
        const upHandler = () => {
          document.body.classList.remove('resizing');
          window.removeEventListener('mousemove', moveHandler);
          window.removeEventListener('mouseup', upHandler);
          window.removeEventListener('touchmove', moveHandler);
          window.removeEventListener('touchend', upHandler);
          this.canvas?.render();
        };
        window.addEventListener('mousemove', moveHandler);
        window.addEventListener('mouseup', upHandler);
        window.addEventListener('touchmove', moveHandler, { passive: false });
        window.addEventListener('touchend', upHandler);
      };

      leftResizer.addEventListener('mousedown', startLeftDrag);
      leftResizer.addEventListener('touchstart', startLeftDrag, { passive: false });
    }

    if (rightResizer && rightSidebar && mainContainer) {
      const onMove = (clientX: number) => {
        if (this.isRightCollapsed) {
          this.setRightPanelCollapsed(false);
        }
        const rect = mainContainer.getBoundingClientRect();
        let newW = rect.right - clientX;
        newW = Math.max(160, Math.min(newW, Math.min(550, window.innerWidth - 200)));
        this.rightSidebarWidth = newW;
        rightSidebar.style.width = `${newW}px`;
        localStorage.setItem('schematico_right_w', String(newW));
      };

      const startRightDrag = (e: MouseEvent | TouchEvent) => {
        if ((e.target as HTMLElement).closest('.resizer-expand-btn')) return;
        e.preventDefault();
        document.body.classList.add('resizing');
        const moveHandler = (ev: MouseEvent | TouchEvent) => {
          const clientX = 'touches' in ev ? ev.touches[0].clientX : ev.clientX;
          onMove(clientX);
        };
        const upHandler = () => {
          document.body.classList.remove('resizing');
          window.removeEventListener('mousemove', moveHandler);
          window.removeEventListener('mouseup', upHandler);
          window.removeEventListener('touchmove', moveHandler);
          window.removeEventListener('touchend', upHandler);
          this.canvas?.render();
        };
        window.addEventListener('mousemove', moveHandler);
        window.addEventListener('mouseup', upHandler);
        window.addEventListener('touchmove', moveHandler, { passive: false });
        window.addEventListener('touchend', upHandler);
      };

      rightResizer.addEventListener('mousedown', startRightDrag);
      rightResizer.addEventListener('touchstart', startRightDrag, { passive: false });
    }
  }

  public onSymbolSelectedToPlace(symId: string, customName?: string): void {
    this.canvas.setSymbolToPlace(symId);
    if (window.innerWidth <= 960) {
      this.setLeftPanelCollapsed(true);
      const banner = document.getElementById('placeHintBanner');
      const bannerText = document.getElementById('placeHintText');
      if (banner && bannerText) {
        bannerText.textContent = t('placeHintSelected', { name: customName || t('componentLabel') });
        banner.style.display = 'flex';
      }
    }
  }

  private bindHeaderEvents(): void {
    // Panel Toggles & Collapse Buttons
    document.getElementById('btnToggleLeftSidebar')?.addEventListener('click', () => {
      this.setLeftPanelCollapsed(!this.isLeftCollapsed);
    });

    document.getElementById('btnToggleRightSidebar')?.addEventListener('click', () => {
      this.setRightPanelCollapsed(!this.isRightCollapsed);
    });

    document.getElementById('btnCollapseLeft')?.addEventListener('click', () => {
      this.setLeftPanelCollapsed(true);
    });

    document.getElementById('btnExpandLeft')?.addEventListener('click', () => {
      this.setLeftPanelCollapsed(false);
    });

    document.getElementById('btnCollapseRight')?.addEventListener('click', () => {
      this.setRightPanelCollapsed(true);
    });

    document.getElementById('btnExpandRight')?.addEventListener('click', () => {
      this.setRightPanelCollapsed(false);
    });

    // Fit to screen
    document.getElementById('btnZoomFit')?.addEventListener('click', () => {
      this.canvas.fitToScreen();
    });

    // Floating action buttons (mobile bar & selection bar)
    document.getElementById('fabEdit')?.addEventListener('click', () => {
      if(this.canvas.selectedBoxId||this.canvas.selectedImageId||selectionCount(this.canvas.getElementSelection())>1){this.openSelectionProperties(true);return;}
      if (this.selectedComponent) {
        this.openPropertiesDialog(this.selectedComponent);
      } else if (this.selectedCable || this.selectedText || this.selectedWall || this.selectedOpening) {
        this.openSelectionProperties(true);
      } else {
        alert('Bitte tippen Sie zuerst ein Bauteil im Plan an.');
      }
    });

    document.getElementById('btnFloatingEdit')?.addEventListener('click', () => {
      if(this.canvas.selectedBoxId||this.canvas.selectedImageId||selectionCount(this.canvas.getElementSelection())>1){this.openSelectionProperties(true);return;}
      if (this.selectedComponent) this.openPropertiesDialog(this.selectedComponent);
      else if (this.selectedCable || this.selectedText || this.selectedWall || this.selectedOpening) { this.openSelectionProperties(true); }
    });

    document.getElementById('btnFloatingExportMacro')?.addEventListener('click', () => {
      this.exportSelectedAsWindowMacro();
    });

    document.getElementById('btnFloatingRotate')?.addEventListener('click', () => {
      this.canvas.rotateSelected();
      this.updateFloatingSelectionBar();
    });

    document.getElementById('btnFloatingDelete')?.addEventListener('click', () => {
      this.canvas.deleteSelected();
      this.updateFloatingSelectionBar();
    });

    document.getElementById('btnFloatingContextMenu')?.addEventListener('click', () => {
      this.canvas.triggerContextMenu(window.innerWidth / 2, Math.max(100, window.innerHeight - 150));
    });

    const minBtn = document.getElementById('btnMinimizeFloatingBar');
    if (minBtn) {
      minBtn.onclick = () => this.setFloatingBarMinimized(true);
    }
    const restoreBtn = document.getElementById('selectionFloatingRestoreBtn');
    if (restoreBtn) {
      restoreBtn.onclick = () => this.setFloatingBarMinimized(false);
    }

    const bindContinuousAction = (btnId: string, action: () => void, intervalMs: number = 35) => {
      const el = document.getElementById(btnId);
      if (!el) return;
      let timer: any = null;
      let delayTimer: any = null;

      const stop = () => {
        if (delayTimer) { clearTimeout(delayTimer); delayTimer = null; }
        if (timer) { clearInterval(timer); timer = null; }
      };

      el.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        action();
        stop();
        delayTimer = setTimeout(() => {
          timer = setInterval(action, intervalMs);
        }, 220);
      });

      el.addEventListener('pointerup', stop);
      el.addEventListener('pointercancel', stop);
      el.addEventListener('pointerleave', stop);
    };

    // Nav arrows: pan smoothly in 4 directions
    bindContinuousAction('btnNavUp', () => this.canvas.panBy(0, 50));
    bindContinuousAction('btnNavDown', () => this.canvas.panBy(0, -50));
    bindContinuousAction('btnNavLeft', () => this.canvas.panBy(50, 0));
    bindContinuousAction('btnNavRight', () => this.canvas.panBy(-50, 0));

    // Nav center: fit sheet to screen
    document.getElementById('btnNavFit')?.addEventListener('click', () => {
      this.canvas.fitToScreen();
    });

    // Zoom buttons: smooth centered zoom
    bindContinuousAction('btnNavZoomIn', () => this.canvas.zoomIn(1.12), 60);
    bindContinuousAction('btnNavZoomOut', () => this.canvas.zoomOut(0.88), 60);

    // Pan / Hand mode toggle
    const btnPanMode = document.getElementById('btnNavPanMode');
    btnPanMode?.addEventListener('click', () => {
      const newMode = this.canvas.mode === 'pan' ? 'select' : 'pan';
      this.canvas.setMode(newMode);
      btnPanMode.classList.toggle('active', newMode === 'pan');
      if (newMode === 'pan') this.updateToolButtons('');
      else this.updateToolButtons('btnToolSelect');
    });

    // Multi-Select toggle
    const btnMulti = document.getElementById('btnNavMultiSelect');
    btnMulti?.addEventListener('click', () => {
      const active = this.canvas.toggleMultiSelectMode();
      btnMulti.classList.toggle('active', active);
      this.updateFloatingSelectionBar();
    });

    // Drag & Toggle Nav HUD
    const hud = document.getElementById('touchNavHud');
    const hudToggle = document.getElementById('btnToggleNavHud');
    if (hud) {
      let isDraggingHud = false;
      let hudDragStart = { x: 0, y: 0 };
      let hudInitialPos = { left: 0, top: 0 };
      let hasMovedHud = false;

      hud.addEventListener('pointerdown', (e: PointerEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('.dpad-btn, .hud-btn')) return;
        isDraggingHud = true;
        hasMovedHud = false;
        hudDragStart = { x: e.clientX, y: e.clientY };
        const rect = hud.getBoundingClientRect();
        const containerRect = hud.parentElement?.getBoundingClientRect() ?? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
        hudInitialPos = {
          left: rect.left - containerRect.left,
          top: rect.top - containerRect.top
        };
      });

      window.addEventListener('pointermove', (e: PointerEvent) => {
        if (!isDraggingHud) return;
        const dx = e.clientX - hudDragStart.x;
        const dy = e.clientY - hudDragStart.y;
        if (!hasMovedHud && Math.hypot(dx, dy) > 4) {
          hasMovedHud = true;
        }
        if (hasMovedHud) {
          const container = hud.parentElement;
          const cw = container?.clientWidth || window.innerWidth;
          const ch = container?.clientHeight || window.innerHeight;
          const hw = hud.offsetWidth;
          const hh = hud.offsetHeight;
          const newLeft = Math.max(6, Math.min(cw - hw - 6, hudInitialPos.left + dx));
          const newTop = Math.max(6, Math.min(ch - hh - 6, hudInitialPos.top + dy));
          hud.style.left = `${newLeft}px`;
          hud.style.top = `${newTop}px`;
          hud.style.right = 'auto';
          hud.style.bottom = 'auto';
        }
      });

      const onHudUp = () => {
        if (!isDraggingHud) return;
        isDraggingHud = false;
      };
      window.addEventListener('pointerup', onHudUp);
      window.addEventListener('pointercancel', onHudUp);

      hudToggle?.addEventListener('click', (e) => {
        if (hasMovedHud) {
          e.stopPropagation();
          hasMovedHud = false;
          return;
        }
        hud.classList.toggle('collapsed');
      });
    }

    document.getElementById('fabFit')?.addEventListener('click', () => {
      this.canvas.fitToScreen();
    });

    document.getElementById('fabWire')?.addEventListener('click', () => {
      this.canvas.setMode('wire');
      this.updateToolButtons('btnToolWire');
    });

    document.getElementById('fabRotate')?.addEventListener('click', () => {
      this.canvas.rotateSelected();
    });

    document.getElementById('fabDelete')?.addEventListener('click', () => {
      this.canvas.deleteSelected();
    });

    document.getElementById('fabPdf')?.addEventListener('click', () => {
      new PdfExportDialog(this.project, this.project.activePageId).show();
    });

    // Cancel placement
    document.getElementById('btnCancelPlace')?.addEventListener('click', () => {
      this.canvas.setMode('select');
      const banner = document.getElementById('placeHintBanner');
      if (banner) banner.style.display = 'none';
    });

    // Left tabs
    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        this.activeLeftTab = target.dataset.tab as any;
        document.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('active'));
        target.classList.add('active');
        this.renderLeftTab();
      });
    });

    // Tools
    document.getElementById('btnToolSelect')?.addEventListener('click', () => {
      this.canvas.setMode('select');
      this.updateToolButtons('btnToolSelect');
    });

    document.getElementById('btnToolWire')?.addEventListener('click', () => {
      this.canvas.setMode('wire');
      this.updateToolButtons('btnToolWire');
    });

    document.getElementById('btnToolText')?.addEventListener('click', () => {
      this.canvas.setMode('place_text');
      this.updateToolButtons('btnToolText');
      const status = document.getElementById('statusLeft');
      if (status) status.textContent = 'Text platzieren: Position auf der Seite anklicken. Esc bricht ab.';
    });

    document.getElementById('btnToolRotate')?.addEventListener('click', () => {
      this.canvas.rotateSelected();
    });

    document.getElementById('btnToolDelete')?.addEventListener('click', () => {
      this.canvas.deleteSelected();
    });

    document.getElementById('btnFloorPlanEdit')?.addEventListener('click', () => {
      this.canvas.setFloorPlanEditMode(!this.canvas.floorPlanEditMode);
      this.updateFloorPlanEditButtonState();
      this.renderRightTab();
    });

    document.getElementById('btnOpenConnections')?.addEventListener('click', () => this.openConnectionSelection());
    document.getElementById('btnDeviceBox')?.addEventListener('click',()=>this.startDeviceBox());
    document.getElementById('btnAddImage')?.addEventListener('click',()=>document.getElementById('imageFileInput')?.click());
    document.getElementById('imageFileInput')?.addEventListener('change',async event=>{
      const input=event.target as HTMLInputElement,file=input.files?.[0];input.value='';if(!file)return;
      try {const image=await readImageFile(file,getDrawingUnitsPerMm(this.project));this.canvas.setImageToPlace(image);this.updateToolButtons('btnToolSelect');const status=document.getElementById('statusLeft');if(status)status.textContent='Bild platzieren: Position auf der Seite anklicken. Esc bricht ab.';}
      catch(error){alert(error instanceof Error?error.message:'Die Grafikdatei konnte nicht geladen werden.');}
    });
    document.getElementById('btnCableDefinition')?.addEventListener('click', () => this.startCableDefinition());
    // Toolbar Actions
    document.getElementById('btnOpenSymbolSelection')?.addEventListener('click', () => {
      new SymbolSelectionDialog({
        onSelect: (sym) => this.canvas.setSymbolToPlace(sym.id)
      }).show();
    });

    document.getElementById('btnToolCopy')?.addEventListener('click', () => {
      this.canvas.copySelected();
      this.updateFloatingSelectionBar();
    });

    document.getElementById('btnToolPaste')?.addEventListener('click', () => {
      this.canvas.paste();
    });

    document.getElementById('btnToolDuplicate')?.addEventListener('click', () => {
      this.canvas.duplicateSelected();
    });

    document.getElementById('btnFloatingCopy')?.addEventListener('click', () => {
      this.canvas.copySelected();
      this.updateFloatingSelectionBar();
    });

    document.getElementById('btnFloatingDuplicate')?.addEventListener('click', () => {
      this.canvas.duplicateSelected();
    });

    // Menubar interactions
    this.bindMenubarEvents();

    // File Open
    document.getElementById('btnOpenProject')?.addEventListener('click', () => {
      void this.openProjectWithPicker();
    });
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    fileInput?.addEventListener('change', async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        await this.handleFilesOpen(files);
      }
      fileInput.value = '';
    });

    // Save JSON
    document.getElementById('btnSaveJson')?.addEventListener('click', () => {
      void this.saveProjectJson(false);
    });

    // Smart PDF Export
    document.getElementById('btnExportPdf')?.addEventListener('click', () => {
      new PdfExportDialog(this.project, this.project.activePageId).show();
    });

    // Native Electron menu integration
    if ((window as any).electronAPI) {
      const api = (window as any).electronAPI;
      api.onMenuAction('menu:new', () => this.createNewProject());
      api.onMenuAction('menu:save', () => void this.saveProjectJson(false));
      api.onMenuAction('menu:saveAs', () => void this.saveProjectJson(true));
      api.onMenuAction('menu:exportZw1', () => void this.exportZw1());
      api.onMenuAction('menu:exportXml', () => void this.exportXml());
      api.onMenuAction('menu:exportPdf', () => new PdfExportDialog(this.project, this.project.activePageId).show());
      api.onMenuAction('menu:exportFloorPlanPage', () => this.exportFloorPlanPage());
      api.onMenuAction('menu:importFloorPlanPage', () => this.triggerImportFloorPlanPage());
      api.onMenuAction('menu:rotate', () => this.canvas.rotateSelected());
      api.onMenuAction('menu:fileOpened', (fileInfo: { path: string; name: string; data: number[] }) => {
        const uint8 = new Uint8Array(fileInfo.data);
        const file = new File([uint8], fileInfo.name);
        void this.handleFilesOpen([file], { filePath: fileInfo.path });
      });
    }
  }

  private bindMenubarEvents(): void {
    const {close:closeAllMenus}=bindAppHeaderMenus();

    const bindMenuOpt = (id: string, action: () => void) => {
      document.getElementById(id)?.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllMenus();
        action();
      });
    };

    // Projekt
    bindMenuOpt('menuOpen', () => void this.openProjectWithPicker());
    bindMenuOpt('menuToggleLeftPanel',()=>this.setLeftPanelCollapsed(!this.isLeftCollapsed));
    bindMenuOpt('menuToggleRightPanel',()=>this.setRightPanelCollapsed(!this.isRightCollapsed));
    bindMenuOpt('menuToggleFloatingBar',()=>this.setFloatingBarMinimized(!this.isFloatingBarMinimized));
    bindMenuOpt('menuNew', () => {
      if (confirm(t('confirmNewProject'))) {
        this.createNewProject();
      }
    });
    bindMenuOpt('menuLoadDemo', () => {
      if (confirm(t('confirmLoadDemo'))) {
        this.loadDemoProject();
      }
    });
    bindMenuOpt('menuProjectSettings', () => this.openProjectSettings());

    const menuFileInput = document.getElementById('menuFileInput') as HTMLInputElement;
    menuFileInput?.addEventListener('change', async (e) => {
      closeAllMenus();
      const files = (e.target as HTMLInputElement).files;
      if (files?.length) await this.handleFilesOpen(files);
      menuFileInput.value = '';
    });

    bindMenuOpt('menuInsertCable', () => this.startCableDefinition());
    bindMenuOpt('menuInsertText', () => {
      this.canvas.setMode('place_text');
      this.updateToolButtons('btnToolText');
      const status = document.getElementById('statusLeft');
      if (status) status.textContent = 'Text platzieren: Position auf der Seite anklicken. Esc bricht ab.';
    });
    bindMenuOpt('btnInsertText', () => {
      this.canvas.setMode('place_text');
      this.updateToolButtons('btnToolText');
      const status = document.getElementById('statusLeft');
      if (status) status.textContent = 'Text platzieren: Position auf der Seite anklicken. Esc bricht ab.';
    });
    bindMenuOpt('menuSettings', () => this.openSettings());
    bindMenuOpt('menuInsertConnections', () => this.openConnectionSelection());
    bindMenuOpt('menuSave', () => void this.saveProjectJson(false));
    bindMenuOpt('menuSaveAs', () => void this.saveProjectJson(true));
    bindMenuOpt('menuExportPdf', () => new PdfExportDialog(this.project, this.project.activePageId).show());
    bindMenuOpt('menuExportZw1', async () => await this.exportZw1());
    bindMenuOpt('menuExportXml', () => void this.exportXml());
    bindMenuOpt('menuExportPageMacro', () => this.exportCurrentPageAsPageMacro());
    bindMenuOpt('menuExportFloorPlanPage', () => this.exportFloorPlanPage());
    bindMenuOpt('menuImportFloorPlanPage', () => this.triggerImportFloorPlanPage());

    // Bearbeiten
    bindMenuOpt('menuUndo', () => this.undo());
    bindMenuOpt('menuRedo', () => this.redo());
    bindMenuOpt('menuCut', () => this.canvas.cutSelected());
    bindMenuOpt('menuCopy', () => {
      this.canvas.copySelected();
      this.updateFloatingSelectionBar();
    });
    bindMenuOpt('menuPaste', () => this.canvas.paste());
    bindMenuOpt('menuDuplicate', () => this.canvas.duplicateSelected());
    bindMenuOpt('menuRotate', () => this.canvas.rotateSelected());
    bindMenuOpt('menuGroup', () => this.canvas.groupSelected());
    bindMenuOpt('menuUngroup', () => this.canvas.ungroupSelected());
    bindMenuOpt('menuDelete', () => this.canvas.deleteSelected());

    // Ansicht
    bindMenuOpt('menuFit', () => this.canvas.fitToScreen());
    bindMenuOpt('menuZoom100', () => this.canvas.resetZoom());
    bindMenuOpt('menuZoomIn', () => this.canvas.zoomIn());
    bindMenuOpt('menuZoomOut', () => this.canvas.zoomOut());
    bindMenuOpt('menuGridFull', () => {
      this.canvas.setGridResolution('full');
      this.updateGridButtonState();
    });
    bindMenuOpt('menuGridHalf', () => {
      this.canvas.setGridResolution('half');
      this.updateGridButtonState();
    });
    bindMenuOpt('menuGridFine', () => {
      this.canvas.setGridResolution('fine');
      this.updateGridButtonState();
    });
    bindMenuOpt('menuGridOff', () => {
      this.canvas.setGridResolution('off');
      this.updateGridButtonState();
    });
    bindMenuOpt('menuToggleAutoconnect', () => {
      this.canvas.autoconnectEnabled = !this.canvas.autoconnectEnabled;
      if (this.canvas.autoconnectEnabled) {
        const activePage = this.project.pages.find(p => p.id === this.project.activePageId);
        if (activePage) AutoconnectEngine.updatePageAutoconnections(activePage);
        this.canvas.render();
      }
      this.updateUI();
    });

    // Einfügen
    bindMenuOpt('menuInsertSym', () => {
      new SymbolSelectionDialog({
        onSelect: (sym) => this.canvas.setSymbolToPlace(sym.id)
      }).show();
    });
    bindMenuOpt('menuInsertBox',()=>this.startDeviceBox());
    bindMenuOpt('menuInsertImage', () => document.getElementById('imageFileInput')?.click());
    bindMenuOpt('menuInsertMacro', () => {
      this.openMacroSelectionDialog('window');
    });
    bindMenuOpt('menuWire', () => {
      this.canvas.setMode('wire');
      this.updateToolButtons('btnToolWire');
    });
    bindMenuOpt('menuNewPage', () => this.addNewPage());
    bindMenuOpt('menuNewCoverPage',()=>this.addCoverPage());
    bindMenuOpt('menuImportFloorPlan', () => this.openFloorPlanImport());
    bindMenuOpt('menuDeletePage', () => this.deletePage(this.project.activePageId));
    bindMenuOpt('menuInsertPageMacro', () => {
      this.openMacroSelectionDialog('page');
    });

    // Projektdaten
    bindMenuOpt('menuPlausibility', () => {
      new PlausibilityDialog(this.project, {
        onNavigateToPage: (pageId) => {
          this.canvas.setPage(pageId);
          this.updateUI();
        }
      }).show();
    });
    bindMenuOpt('menuRecalcCrossRef', () => {
      CrossReferenceEngine.updateProjectCrossReferences(this.project);
      this.canvas.render();
      this.updateUI();
      alert(t('alertCrossRefsCalculated'));
    });
    bindMenuOpt('menuShowTerminals', () => {
      this.activeLeftTab = 'terminals';
      document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', (b as HTMLElement).dataset.tab === 'terminals'));
      this.renderLeftTab();
    });
    bindMenuOpt('menuShowBom', () => {
      this.activeLeftTab = 'bom';
      document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', (b as HTMLElement).dataset.tab === 'bom'));
      this.renderLeftTab();
    });

    // Hilfe
    bindMenuOpt('menuMobile', () => MobileConnectDialog.show());
    bindMenuOpt('menuShortcuts', () => {
      alert(t('shortcutsHelp'));
    });
    bindMenuOpt('menuAbout', () => AboutDialog.show());
  }

  private updateToolButtons(activeId: string): void {
    ['btnToolSelect', 'btnToolWire', 'btnToolText', 'btnCableDefinition','btnDeviceBox'].forEach(id => {
      document.getElementById(id)?.classList.toggle('active', id === activeId);
    });
  }

  public updateFloorPlanEditButtonState(): void {
    const isEdit = !!this.canvas?.floorPlanEditMode;
    const btn = document.getElementById('btnFloorPlanEdit');
    if (btn) {
      btn.classList.toggle('active', isEdit);
      btn.setAttribute('aria-pressed', String(isEdit));
      btn.style.background = isEdit ? '#2b6cb0' : '';
      btn.style.color = isEdit ? '#ffffff' : '';
    }
  }

  public updateGridButtonState(): void {
    if (this.canvas) {
      const resolution=this.canvas.gridSnap?this.canvas.gridResolution:'off';
      const labels={full:t('gridLabelFull'),half:t('gridLabelHalf'),fine:t('gridLabelFine'),off:t('gridLabelOff')};
      const label=document.getElementById('headerGridLabel');if(label)label.textContent=labels[resolution];
      const gridButton=document.getElementById('btnDrawingOptions');
      gridButton?.setAttribute('title',`${t('headingGrid')}: ${this.canvas.getGridLabel()}`);
      for(const [id,value]of [['menuGridFull','full'],['menuGridHalf','half'],['menuGridFine','fine'],['menuGridOff','off']]as const){
        const checked=value===resolution;
        document.querySelectorAll(`[id="${id}"], [data-header-command="${id}"]`).forEach(el=>{el.setAttribute('aria-pressed',String(checked));el.classList.toggle('checked',checked);});
      }
      document.querySelectorAll('#menuToggleAutoconnect, [data-header-command="menuToggleAutoconnect"]').forEach(el=>{
        el.setAttribute('aria-pressed',String(this.canvas.autoconnectEnabled));el.classList.toggle('checked',this.canvas.autoconnectEnabled);
      });
    }
    this.updateStatusBar();
  }

  private updateStatusBar(): void {
    const statusRight = document.getElementById('statusRight');
    const activePage = this.project.pages.find(p => p.id === this.project.activePageId);
    if (statusRight && activePage && this.canvas) {
      const isEn = getUiLanguage() === 'en';
      const pageLabel = isEn ? 'Page' : 'Seite';
      const gridLabel = isEn ? 'Grid' : 'Raster';
      const compLabel = isEn ? 'Components' : 'Bauteile';
      const wireLabel = isEn ? 'Wires' : 'Leitungen';
      const cableLabel = isEn ? 'Cables' : 'Kabel';
      statusRight.textContent = `${pageLabel} ${activePage.pageNumber} (${activePage.title}) | ${gridLabel}: ${this.canvas.getGridLabel()} | ${compLabel}: ${activePage.components.length} | ${wireLabel}: ${activePage.wires.length} | ${cableLabel}: ${activePage.cables?.length ?? 0}`;
    }
  }

  private openConnectionSelection(): void {
    new SymbolSelectionDialog({ onSelect: s => this.canvas.setSymbolToPlace(s.id) }, 'connections').show();
  }

  private openSettings(): void {
    document.getElementById('settingsModal')?.remove();
    const modal = document.createElement('div'); modal.id = 'settingsModal'; modal.className = 'modal-backdrop';
    modal.style.cssText = 'position:fixed;inset:0;background:#000b;z-index:2200;display:flex;align-items:center;justify-content:center';
    const autoLoad = isAutoLoadProjectEnabled();
    const currentLang = getUiLanguage();
    const currentGeminiKey = getGeminiApiKey();
    modal.innerHTML = `<div class="modal-card" style="background:#232731;padding:24px;width:480px;max-width:95vw;border:1px solid #4a5568;border-radius:6px">
      <h3 style="margin-top:0;margin-bottom:16px;">${t('generalSettingsTitle')}</h3>

      <div style="margin: 16px 0;">
        <label for="settingUiLanguage" style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;color:#e2e8f0;">${t('uiLanguageLabel')}</label>
        <select id="settingUiLanguage" class="form-input" style="width:100%;box-sizing:border-box;">
          <option value="de" ${currentLang === 'de' ? 'selected' : ''}>${t('langGerman')}</option>
          <option value="en" ${currentLang === 'en' ? 'selected' : ''}>${t('langEnglish')}</option>
        </select>
        <p style="font-size:11px;color:#a0aec0;margin:4px 0 0 0;">${t('uiLanguageDesc')}</p>
      </div>

      <div style="margin: 16px 0; padding-top: 12px; border-top: 1px solid #374151;">
        <label for="settingGeminiApiKey" style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;color:#e2e8f0;">${t('geminiApiKeyLabel')}</label>
        <div style="display:flex;gap:6px;align-items:center;">
          <input type="password" id="settingGeminiApiKey" class="form-input" style="flex:1;box-sizing:border-box;font-family:monospace;" placeholder="${t('geminiApiKeyPlaceholder')}" value="${escapeSvg(currentGeminiKey)}" />
          <button type="button" class="btn" id="toggleGeminiKeyVisibility" style="padding:4px 8px;font-size:12px;" title="${t('geminiApiKeyShow')}">👁️</button>
          <button type="button" class="btn" id="testGeminiApiKey" style="padding:4px 10px;font-size:11px;white-space:nowrap;">${t('geminiApiKeyTest')}</button>
        </div>
        <div id="geminiTestStatus" style="font-size:11px;margin-top:5px;display:none;"></div>
        <p style="font-size:11px;color:#a0aec0;margin:4px 0 0 0;">${t('geminiApiKeyDesc')}</p>
      </div>

      <div style="margin: 16px 0; padding-top: 12px; border-top: 1px solid #374151;">
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;color:#e2e8f0;">
          <input type="checkbox" id="settingAutoLoadProject" ${autoLoad ? 'checked' : ''} style="width:16px;height:16px;accent-color:#3182ce;" />
          <span>${t('autoLoadLabel')}</span>
        </label>
        <p style="font-size:11px;color:#a0aec0;margin:4px 0 0 24px;">${t('autoLoadDesc')}</p>
      </div>

      <div style="margin: 16px 0; padding-top: 12px; border-top: 1px solid #374151;">
        <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px;color:#e2e8f0;">${t('macroFolderLabel')}</label>
        <div id="settingsMacroFolder"></div>
        <p style="font-size:11px;color:#a0aec0;margin:4px 0 0 0;">${t('macroFolderDesc')}</p>
      </div>

      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:20px;">
        <button class="btn" id="cancelSettings">${t('btnCancel')}</button>
        <button class="btn btn-primary" id="saveSettings">${t('btnApply')}</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#settingsMacroFolder')!.appendChild(createMacroFolderPanel());

    const keyInput = modal.querySelector('#settingGeminiApiKey') as HTMLInputElement;
    const toggleBtn = modal.querySelector('#toggleGeminiKeyVisibility') as HTMLButtonElement;
    const testBtn = modal.querySelector('#testGeminiApiKey') as HTMLButtonElement;
    const testStatus = modal.querySelector('#geminiTestStatus') as HTMLDivElement;

    toggleBtn?.addEventListener('click', () => {
      if (keyInput.type === 'password') {
        keyInput.type = 'text';
        toggleBtn.textContent = '🔒';
        toggleBtn.title = t('geminiApiKeyHide');
      } else {
        keyInput.type = 'password';
        toggleBtn.textContent = '👁️';
        toggleBtn.title = t('geminiApiKeyShow');
      }
    });

    testBtn?.addEventListener('click', async () => {
      const keyVal = keyInput.value.trim();
      if (!keyVal) {
        testStatus.style.display = 'block';
        testStatus.style.color = '#fc8181';
        testStatus.textContent = t('geminiApiKeyPlaceholder');
        return;
      }
      testBtn.disabled = true;
      testBtn.textContent = t('geminiApiKeyTesting');
      testStatus.style.display = 'block';
      testStatus.style.color = '#cbd5e0';
      testStatus.textContent = t('geminiApiKeyTesting');
      try {
        const res = await testGeminiApiKey(keyVal);
        testStatus.style.color = res.success ? '#68d391' : '#fc8181';
        testStatus.textContent = res.message;
      } catch (err: any) {
        testStatus.style.color = '#fc8181';
        testStatus.textContent = err?.message || 'Fehler beim Verbindungsaufbau';
      } finally {
        testBtn.disabled = false;
        testBtn.textContent = t('geminiApiKeyTest');
      }
    });

    modal.querySelector('#cancelSettings')!.addEventListener('click', () => modal.remove());
    modal.querySelector('#saveSettings')!.addEventListener('click', () => {
      const selectedLang = (modal.querySelector('#settingUiLanguage') as HTMLSelectElement).value as Language;
      const chkAutoLoad = (modal.querySelector('#settingAutoLoadProject') as HTMLInputElement)?.checked;
      if (chkAutoLoad !== undefined) setAutoLoadProjectEnabled(chkAutoLoad);
      if (keyInput) {
        setGeminiApiKey(keyInput.value);
      }
      const langChanged = selectedLang !== getUiLanguage();
      if (langChanged) {
        setUiLanguage(selectedLang);
      }
      modal.remove();
      if (langChanged) {
        this.refreshUiLocalization();
      }
    });
  }

  private openProjectSettings(): void {
    document.getElementById('projectSettingsModal')?.remove();
    const modal = document.createElement('div'); modal.id = 'projectSettingsModal'; modal.className = 'modal-backdrop';
    modal.style.cssText = 'position:fixed;inset:0;background:#000b;z-index:2200;display:flex;align-items:center;justify-content:center';
    const selectedSide = this.project.settings?.interruptionLabelSide ?? 'source';
    const projectLang = this.project.language ?? 'en';
    modal.innerHTML = `<div class="modal-card" style="background:#232731;padding:24px;width:500px;max-width:95vw;border:1px solid #4a5568;border-radius:6px">
      <h3 style="margin-top:0;margin-bottom:16px;">${t('projectSettingsTitle')}</h3>

      <div style="display:flex;flex-direction:column;gap:12px;margin:16px 0;">
        <div>
          <label style="display:block;font-size:12px;color:#a0aec0;margin-bottom:4px;">${t('projectNameLabel')}</label>
          <input type="text" id="projSettingName" class="form-input" style="width:100%;box-sizing:border-box;" value="${escapeSvg(this.project.name)}" />
        </div>
        <div>
          <label style="display:block;font-size:12px;color:#a0aec0;margin-bottom:4px;">${t('projectDescLabel')}</label>
          <input type="text" id="projSettingDesc" class="form-input" style="width:100%;box-sizing:border-box;" value="${escapeSvg(this.project.description)}" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label style="display:block;font-size:12px;color:#a0aec0;margin-bottom:4px;">${t('companyLabel')}</label>
            <input type="text" id="projSettingCompany" class="form-input" style="width:100%;box-sizing:border-box;" value="${escapeSvg(this.project.company)}" />
          </div>
          <div>
            <label style="display:block;font-size:12px;color:#a0aec0;margin-bottom:4px;">${t('authorLabel')}</label>
            <input type="text" id="projSettingAuthor" class="form-input" style="width:100%;box-sizing:border-box;" value="${escapeSvg(this.project.author)}" />
          </div>
        </div>
        <div>
          <label style="display:block;font-size:12px;color:#a0aec0;margin-bottom:4px;">${t('standardLabel')}</label>
          <input type="text" id="projSettingStandard" class="form-input" style="width:100%;box-sizing:border-box;" value="${escapeSvg(this.project.standard)}" />
        </div>

        <div style="padding-top:8px;border-top:1px solid #374151;">
          <label for="projSettingLanguage" style="display:block;font-size:12px;font-weight:600;color:#e2e8f0;margin-bottom:4px;">${t('projectLanguageLabel')}</label>
          <select id="projSettingLanguage" class="form-input" style="width:100%;box-sizing:border-box;">
            <option value="de" ${projectLang === 'de' ? 'selected' : ''}>${t('langGerman')}</option>
            <option value="en" ${projectLang === 'en' ? 'selected' : ''}>${t('langEnglish')}</option>
          </select>
          <p style="font-size:11px;color:#a0aec0;margin:4px 0 0 0;">${t('projectLanguageDesc')}</p>
        </div>

        <div style="padding-top:8px;border-top:1px solid #374151;">
          <label for="projInterruptionSide" style="display:block;font-size:12px;font-weight:600;color:#e2e8f0;margin-bottom:4px;">${t('interruptionLabelSide')}</label>
          <select id="projInterruptionSide" class="form-input" style="width:100%;box-sizing:border-box;">
            <option value="source" ${selectedSide === 'source' ? 'selected' : ''}>${t('optSource')}</option>
            <option value="before" ${selectedSide === 'before' ? 'selected' : ''}>${t('optBefore')}</option>
            <option value="after" ${selectedSide === 'after' ? 'selected' : ''}>${t('optAfter')}</option>
          </select>
          <p style="font-size:11px;color:#a0aec0;margin:4px 0 0 0;">${t('interruptionLabelSideDesc')}</p>
        </div>
      </div>

      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:20px;">
        <button class="btn" id="cancelProjSettings">${t('btnCancel')}</button>
        <button class="btn btn-primary" id="saveProjSettings">${t('btnApply')}</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#cancelProjSettings')!.addEventListener('click', () => modal.remove());
    modal.querySelector('#saveProjSettings')!.addEventListener('click', () => {
      const name = (modal.querySelector('#projSettingName') as HTMLInputElement).value.trim();
      const desc = (modal.querySelector('#projSettingDesc') as HTMLInputElement).value.trim();
      const company = (modal.querySelector('#projSettingCompany') as HTMLInputElement).value.trim();
      const author = (modal.querySelector('#projSettingAuthor') as HTMLInputElement).value.trim();
      const standard = (modal.querySelector('#projSettingStandard') as HTMLInputElement).value.trim() as any;
      const lang = (modal.querySelector('#projSettingLanguage') as HTMLSelectElement).value as 'de' | 'en';
      const side = (modal.querySelector('#projInterruptionSide') as HTMLSelectElement).value as 'source' | 'before' | 'after';

      this.updateProjectProperties({
        name: name || undefined,
        description: desc,
        company,
        author
      });
      if (standard) this.project.standard = standard;
      this.project.settings = { ...this.project.settings, interruptionLabelSide: side };

      const oldLang = this.project.language ?? 'en';
      if (lang !== oldLang) {
        this.project.language = lang;
        if (!this.project.plotFrameTemplate || this.project.plotFrameTemplate.id === 'default-a3') {
          this.project.plotFrameTemplate = defaultPlotFrame(lang);
        }
        if (!this.project.coverPageTemplate || this.project.coverPageTemplate.id === 'default-f26' || this.project.coverPageTemplate.id === 'default-f01') {
          this.project.coverPageTemplate = defaultCoverPageTemplate(lang);
        }
        for (const p of this.project.pages) {
          if (p.pageType === 'cover') {
            if (oldLang === 'de' && p.title === 'Titelblatt' && lang === 'en') {
              p.title = 'Cover Sheet';
            } else if (oldLang === 'en' && p.title === 'Cover Sheet' && lang === 'de') {
              p.title = 'Titelblatt';
            }
          }
        }
      }

      modal.remove();
      this.notifyChange();
      this.updateUI();
    });
  }

  private refreshUiLocalization(): void {
    const chrome = document.querySelector('.app-chrome');
    if (chrome) {
      chrome.outerHTML = renderAppHeader(this.project.name);
      this.bindHeaderEvents();
    }
    const leftHeading = document.querySelector('#leftSidebar .sidebar-heading');
    if (leftHeading) leftHeading.textContent = t('leftHeading');
    const rightHeading = document.getElementById('rightSidebarHeading');
    if (rightHeading) rightHeading.textContent = t('rightHeading');

    const isDe = getUiLanguage() === 'de';
    const tabMap: Record<string, string> = {
      pages: t('tabPages'),
      symbols: t('tabSymbols'),
      connections: t('tabConnections'),
      macros: t('tabMacros'),
      parts: isDe ? 'Artikel' : 'Parts',
      terminals: t('tabTerminals'),
      bom: t('tabBom')
    };
    document.querySelectorAll('#leftSidebar .tab-btn').forEach(btn => {
      const tab = (btn as HTMLElement).dataset.tab;
      if (tab && tabMap[tab]) btn.textContent = tabMap[tab];
    });

    const statusLeft = document.getElementById('statusLeft');
    if (statusLeft) statusLeft.textContent = t('statusReady');
    const minBtn = document.getElementById('btnMinimizeFloatingBar');
    if (minBtn) minBtn.title = t('btnMinimizeFloatingBar');
    const restoreBtn = document.getElementById('selectionFloatingRestoreBtn');
    if (restoreBtn) restoreBtn.title = t('btnExpandFloatingBar');
    this.updateFloatingSelectionBar();
    this.updateStatusBar();

    this.renderLeftTab();
    this.renderRightTab();
  }

  private initHistoryEvents(): void {
    document.getElementById('btnUndo')?.addEventListener('click', () => this.undo());
    document.getElementById('btnRedo')?.addEventListener('click', () => this.redo());
    document.addEventListener('focusin', () => { this.inputSession++; });
    document.addEventListener('focusout', () => this.history.breakGroup());
    document.addEventListener('click', (event) => {
      const link = (event.target as Element)?.closest?.('[data-crossref-source]');
      if (!link || link instanceof SVGElement || link.closest('#propertiesModal')) return;
      const component = this.project.pages.flatMap(p => p.components).find(c => c.id === link.getAttribute('data-crossref-source'));
      if (component) this.canvas.followReference(component, Number(link.getAttribute('data-crossref-index') ?? 0));
    });
  }

  private updateHistoryButtons(): void {
    for (const [id, enabled] of [['btnUndo', this.history.canUndo], ['menuUndo', this.history.canUndo],
      ['btnRedo', this.history.canRedo], ['menuRedo', this.history.canRedo]] as const) {
      const button = document.getElementById(id) as HTMLButtonElement | null;
      if (button) { button.disabled = !enabled; button.setAttribute('aria-disabled', String(!enabled)); }
    }
  }

  private undo(): void {
    this.canvas.finishInteraction();
    this.history.record(this.project);
    const previous = this.history.undo();
    if (previous) this.restoreHistory(previous);
  }

  private redo(): void {
    this.canvas.finishInteraction();
    this.history.record(this.project);
    const next = this.history.redo();
    if (next) this.restoreHistory(next);
  }

  private restoreHistory(project: Project): void {
    (document.activeElement as HTMLElement | null)?.blur?.();
    const elementSelection=this.canvas.getElementSelection();
    const componentId = this.canvas.selectedComponentId, wireId = this.canvas.selectedWireId, cableId=this.canvas.selectedCableId;
    this.project = project;
    setProjectSymbolLibrary(project);
    this.canvas.setProject(project, false);
    const page = project.pages.find(p => p.id === project.activePageId)!;
    this.selectedCable=page.cables?.find(c=>c.id===cableId) ?? null;
    this.canvas.selectedCableId=this.selectedCable?.id ?? null;
    this.selectedComponent = page.components.find(c => c.id === componentId) ?? null;
    this.selectedWire = page.wires.find(w => w.id === wireId) ?? null;
    this.canvas.selectedComponentId = this.selectedComponent?.id ?? null;
    this.canvas.selectedWireId = this.selectedWire?.id ?? null;
    if(selectionCount(elementSelection)>1||elementSelection.imageIds?.length||elementSelection.boxIds?.length||elementSelection.textIds?.length||elementSelection.wireIds?.length)this.canvas.setElementSelection(elementSelection);
    this.canvas.render();
    this.updateToolButtons('btnToolSelect');
    this.updateFloatingSelectionBar();
    this.updateUI();
  }

  private updateUI(): void {
    const focused = document.activeElement as HTMLElement | null;
    const editing = focused?.matches('input, textarea, select') && focused.closest('#rightSidebar');
    this.history.record(this.project, editing ? `${this.inputSession}:${focused!.id}` : undefined);
    this.updateHistoryButtons();
    const projNameEl = document.getElementById('headerProjectName');
    if (projNameEl) {projNameEl.textContent = this.project.name;projNameEl.title=this.project.name;}

    this.updateGridButtonState();
    this.updateFloorPlanEditButtonState();
    this.renderLeftTab();
    if (!editing) this.renderRightTab();
    this.triggerAutoSave();
  }

  private renderLeftTab(): void {
    const container = document.getElementById('leftTabContent');
    if (!container) return;

    if (this.activeLeftTab === 'pages') {
      this.renderPagesTab(container);
    } else if (this.activeLeftTab === 'symbols' || this.activeLeftTab === 'connections') {
      this.renderSymbolsTab(container);
    } else if (this.activeLeftTab === 'macros') {
      this.renderMacrosTab(container);
    } else if (this.activeLeftTab === 'parts') {
      this.renderPartsCatalogueTab(container);
    } else if (this.activeLeftTab === 'terminals') {
      this.renderTerminalsTab(container);
    } else if (this.activeLeftTab === 'bom') {
      this.renderBomTab(container);
    }
  }

  private renderPagesTab(container: HTMLElement): void {
    const activePage = this.project.pages.find(p => p.id === this.project.activePageId) || this.project.pages[0];
    const activeIdx = this.project.pages.findIndex(p => p.id === this.project.activePageId);
    const canMoveUp = activeIdx > 0;
    const canMoveDown = activeIdx >= 0 && activeIdx < this.project.pages.length - 1;
    const canDelete = this.project.pages.length > 1;

    const sheetWord = t('sheet');
    const pageWord = t('page');
    let html = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 11px; font-weight: bold; color: var(--text-muted); text-transform: uppercase;">${t('projectPages')}</span>
        <button class="btn btn-primary" id="btnAddPage" style="padding: 2px 8px; font-size: 11px;">${t('btnNewPage')}</button>
      </div>
      <div style="display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap;">
        <button class="btn" id="btnAddCoverPage" style="flex: 1 1 90px; min-width: 0; padding: 4px 6px; font-size: 11px; justify-content: center;">${t('btnNewCover')}</button>
        <button class="btn" id="btnImportFloorPlan" style="flex: 1 1 90px; min-width: 0; padding: 4px 6px; font-size: 11px; justify-content: center;" title="${t('importFloorPlanTitle')}">${t('btnFloorPlan')}</button>
      </div>

      <div class="page-tree-toolbar" style="display: flex; gap: 6px; align-items: center; justify-content: space-between; margin-bottom: 10px; padding: 5px 8px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px;">
        <span style="font-size: 11px; color: var(--text-muted); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${activePage ? `${sheetWord} ${escapeSvg(activePage.pageNumber)}: ${escapeSvg(activePage.title)}` : t('activePage')}">
          ${activePage ? `${sheetWord} ${escapeSvg(activePage.pageNumber)}` : pageWord}:
        </span>
        <div style="display: flex; gap: 4px; align-items: center; flex-shrink: 0;">
          <button type="button" class="btn" id="btnTreeMovePageUp" title="${t('movePageUp')}" ${canMoveUp ? '' : 'disabled'} style="padding: 2px 7px; font-size: 11px; line-height: 1.2;">▲</button>
          <button type="button" class="btn" id="btnTreeMovePageDown" title="${t('movePageDown')}" ${canMoveDown ? '' : 'disabled'} style="padding: 2px 7px; font-size: 11px; line-height: 1.2;">▼</button>
          <button type="button" class="btn" id="btnTreeDeletePage" title="${t('deletePage')}" ${canDelete ? '' : 'disabled'} style="padding: 2px 7px; font-size: 11px; line-height: 1.2; color: var(--danger); border-color: rgba(229,62,62,0.4);">🗑️</button>
        </div>
      </div>

      <div class="page-tree">
    `;

    for (let idx = 0; idx < this.project.pages.length; idx++) {
      const page = this.project.pages[idx];
      const isActive = page.id === this.project.activePageId;
      const icon = page.pageType === 'cover' ? '📄' : (page.pageType === 'installation' ? '🏠' : (page.pageType === 'schematic' ? '⚡' : '📋'));
      html += `
        <div class="tree-node page-tree-item ${isActive ? 'active' : ''}" data-page-id="${page.id}" data-page-index="${idx}" draggable="true" style="user-select: none;">
          <span style="cursor: grab;" title="${t('dragToReorder')}">${icon}</span>
          <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-left: 6px;">
            <div style="font-weight: 500;">${sheetWord} ${escapeSvg(page.pageNumber)}: ${escapeSvg(page.title)}</div>
            <div style="font-size: 10px; color: ${isActive ? '#e2e8f0' : 'var(--text-muted)'};">${escapeSvg(page.higherLevel)}${escapeSvg(page.location)}</div>
          </div>
        </div>
      `;
    }

    html += `</div>`;
    container.innerHTML = html;

    // Events
    container.querySelectorAll('.tree-node').forEach(node => {
      node.addEventListener('click', () => {
        const id = (node as HTMLElement).dataset.pageId!;
        this.canvas.setPage(id);
        if (window.innerWidth <= 960) {
          this.setLeftPanelCollapsed(true);
        }
        this.updateUI();
      });
    });

    const activePageId = this.project.activePageId;
    document.getElementById('btnTreeMovePageUp')?.addEventListener('click', () => {
      if (activePageId) this.movePage(activePageId, 'up');
    });

    document.getElementById('btnTreeMovePageDown')?.addEventListener('click', () => {
      if (activePageId) this.movePage(activePageId, 'down');
    });

    document.getElementById('btnTreeDeletePage')?.addEventListener('click', () => {
      if (activePageId) this.deletePage(activePageId);
    });

    // Drag & Drop
    let draggedPageId: string | null = null;
    container.querySelectorAll('.page-tree-item').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        draggedPageId = (e.currentTarget as HTMLElement).dataset.pageId!;
        (e as DragEvent).dataTransfer?.setData('text/plain', draggedPageId);
        (e.currentTarget as HTMLElement).style.opacity = '0.5';
      });
      item.addEventListener('dragend', (e) => {
        (e.currentTarget as HTMLElement).style.opacity = '1';
        draggedPageId = null;
      });
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        (e as DragEvent).dataTransfer!.dropEffect = 'move';
        (e.currentTarget as HTMLElement).classList.add('drag-over');
      });
      item.addEventListener('dragleave', (e) => {
        (e.currentTarget as HTMLElement).classList.remove('drag-over');
      });
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).classList.remove('drag-over');
        const targetId = (e.currentTarget as HTMLElement).dataset.pageId!;
        const fromId = draggedPageId || (e as DragEvent).dataTransfer?.getData('text/plain');
        if (fromId && fromId !== targetId) {
          const targetIdx = Number((e.currentTarget as HTMLElement).dataset.pageIndex);
          if (Number.isFinite(targetIdx)) {
            this.movePageToIndex(fromId, targetIdx);
          }
        }
      });
    });

    document.getElementById('btnAddPage')?.addEventListener('click', () => {
      this.addNewPage();
    });
    document.getElementById('btnAddCoverPage')?.addEventListener('click',()=>this.addCoverPage());
    document.getElementById('btnImportFloorPlan')?.addEventListener('click', () => this.openFloorPlanImport());
  }

  public updateTotalSheets(): void {
    const total = String(this.project.pages.length);
    for (const page of this.project.pages) {
      if (page.plotFrame?.titleBlock) {
        page.plotFrame.titleBlock.totalSheets = total;
      }
    }
  }

  public updateProjectProperties(updates: { name?: string; company?: string; author?: string; description?: string }): void {
    if (updates.name !== undefined) {
      this.project.name = updates.name;
      const projNameEl = document.getElementById('currentProjectName');
      if (projNameEl) {
        projNameEl.textContent = updates.name;
        projNameEl.title = updates.name;
      }
    }
    if (updates.company !== undefined) this.project.company = updates.company;
    if (updates.author !== undefined) this.project.author = updates.author;
    if (updates.description !== undefined) this.project.description = updates.description;

    for (const page of this.project.pages) {
      if (page.plotFrame?.titleBlock) {
        if (updates.name !== undefined) page.plotFrame.titleBlock.projectTitle = updates.name;
        if (updates.company !== undefined) page.plotFrame.titleBlock.company = updates.company;
        if (updates.author !== undefined) page.plotFrame.titleBlock.author = updates.author;
      }
    }

    this.notifyChange();
    this.canvas.render();
  }

  public movePage(pageId: string, direction: 'up' | 'down'): void {
    const idx = this.project.pages.findIndex(p => p.id === pageId);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= this.project.pages.length) return;

    const [moved] = this.project.pages.splice(idx, 1);
    this.project.pages.splice(targetIdx, 0, moved);
    this.updateTotalSheets();
    this.notifyChange();
    this.updateUI();
  }

  public movePageToIndex(pageId: string, targetIdx: number): void {
    const idx = this.project.pages.findIndex(p => p.id === pageId);
    if (idx === -1 || targetIdx < 0 || targetIdx >= this.project.pages.length || idx === targetIdx) return;

    const [moved] = this.project.pages.splice(idx, 1);
    this.project.pages.splice(targetIdx, 0, moved);
    this.updateTotalSheets();
    this.notifyChange();
    this.updateUI();
  }

  public deletePage(pageId: string): void {
    if (this.project.pages.length <= 1) {
      alert(t('deletePageMinPages'));
      return;
    }
    const page = this.project.pages.find(p => p.id === pageId);
    if (!page) return;

    const confirmMsg = t('deletePageConfirm', { number: page.pageNumber, title: page.title });
    if (!confirm(confirmMsg)) return;

    const idx = this.project.pages.findIndex(p => p.id === pageId);
    this.project.pages.splice(idx, 1);

    if (this.project.activePageId === pageId) {
      const newIdx = Math.min(idx, this.project.pages.length - 1);
      const newActive = this.project.pages[newIdx];
      this.project.activePageId = newActive.id;
      this.canvas.setPage(newActive.id);
    }

    this.updateTotalSheets();
    this.notifyChange();
    this.updateUI();
  }

  private addCoverPage():void {
    const page=createCoverPage(this.project);
    this.project.pages.unshift(page);this.canvas.setPage(page.id);this.updateTotalSheets();this.updateUI();this.openCoverPage(page);
  }

  private openCoverPage(page:Page):void {
    new CoverPageDialog(page,this.project,{onSave:cover=>{
      page.coverPage=cover;this.notifyChange();
    }}).show();
  }

  private openFloorPlanImport(): void {
    new FloorPlanImportDialog(this.project, {
      onCreatePage: (newPage) => {
        this.project.pages.push(newPage);
        this.project.activePageId = newPage.id;
        this.updateTotalSheets();
        this.canvas.setPage(newPage.id);
        if (newPage.floorPlan) {
          this.canvas.setFloorPlanEditMode(true);
          const status = document.getElementById('statusLeft');
          if (status) {
            if (!newPage.floorPlan.walls || newPage.floorPlan.walls.length === 0) {
              status.textContent = t('fpStatusTemplateLoaded');
            } else {
              status.textContent = t('fpStatusLoaded');
            }
          }
        }
        this.notifyChange();
        this.updateUI();
      },
      onOpenSettings: () => this.openSettings(),
      onImportFloorPlanPage: () => this.triggerImportFloorPlanPage(),
      onImportFloorPlanPageFromFile: (file: File) => this.importFloorPlanPageFromFile(file)
    }).show();
  }

  private addNewPage(): void {
    const num = (this.project.pages.length).toString();
    const newPage: Page = {
      id: 'p_' + Math.random().toString(36).substring(2, 9),
      pageNumber: num,
      pageType: 'schematic',
      title: `Schaltplan Seite ${num}`,
      higherLevel: '=A1',
      location: '+S1',
      components: [],
      wires: [],
      plotFrame: {
        type: 'DIN_A3_LANDSCAPE',
        width: 1000,
        height: 700,
        columns: 10,
        rows: ['A', 'B', 'C', 'D', 'E', 'F'],
        titleBlock: {
          projectTitle: this.project.name,
          commission: 'KOM-2026',
          company: this.project.company,
          author: this.project.author,
          date: new Date().toISOString().split('T')[0],
          revision: '1.0',
          sheetNumber: num,
          totalSheets: (this.project.pages.length + 1).toString()
        }
      }
    };

    this.project.pages.push(newPage);
    this.canvas.setPage(newPage.id);
    this.updateTotalSheets();
    this.updateUI();
  }

  private renderSymbolsTab(container: HTMLElement): void {
    const connections = this.activeLeftTab === 'connections';
    const category = connections ? this.connectionCategoryFilter : this.symbolCategoryFilter;
    const query = connections ? this.connectionSearchQuery : this.symbolSearchQuery;
    const categories: [string, string][] = connections
      ? ['all', 'interruptions', 'tees', 'corners', 'crossings', 'other', 'project'].map(id => [id, getConnectionCategoryLabel(id)])
      : [['all', getCategoryLabel('all')], ['project', getCategoryLabel('project')], ...ELEMENT_CATEGORIES.map(c => [c.id, getCategoryLabel(c.id)]) as [string, string][]];
    const filtered = getSymbolDefinitions().filter(s => !s.annotationKind && isConnectionSymbol(s) === connections
      && (category === 'all' || category === 'project' && !!s.source || (connections ? connectionFamily(s) : s.category) === category)
      && symbolMatchesQuery(s,query));
    let categoriesHtml = `<select class="form-input" id="symbolCategorySelect" aria-label="${escapeSvg(connections ? t('tabConnections') : t('tabSymbols'))}">${categories.map(([id,label])=>`<option value="${id}" ${category===id?'selected':''}>${escapeSvg(label)}</option>`).join('')}</select>
      <input class="form-input" id="symbolSearchInput" aria-label="${escapeSvg(connections ? t('tabConnections') : t('tabSymbols'))}" placeholder="${escapeSvg(t(connections ? 'searchConnectionsPlaceholder' : 'searchSymbolsPlaceholder'))}" value="${escapeSvg(query)}" style="margin:8px 0">
      <div style="font-size:11px;margin-bottom:8px;color:var(--text-muted)">${t(connections ? 'foundConnections' : 'foundElements', { count: filtered.length })}</div><div class="symbol-grid">`;

    for (const sym of filtered) {
      const isSelected = this.canvas.activeSymbolToPlace === sym.id && this.canvas.mode === 'place_symbol';
      const locSym = getLocalizedSymbol(sym);
      categoriesHtml += `
        <div class="symbol-card ${isSelected ? 'selected' : ''}" data-symbol-id="${sym.id}" title="${escapeSvg(locSym.description || '')}">
          <div class="symbol-preview-svg">
            <svg width="40" height="40" viewBox="0 0 ${sym.width} ${sym.height}">
              <g color="#e2e8f0">${sym.importedGraphics ? drawingToSvg(sym.importedGraphics) : sym.svgContent}</g>
            </svg>
          </div>
          <div class="symbol-title">${escapeSvg(locSym.name)}</div>
          <div class="symbol-bmk">BMK: ${sym.defaultBmkPrefix}</div>
          ${sym.source ? `<div class="symbol-bmk">${sym.source.library} / ${sym.source.number} · ${sym.source.variant}</div>` : ''}
        </div>
      `;
    }

    categoriesHtml += `</div>`;
    container.innerHTML = (connections ? `<button class="btn" id="connectionCableTool" style="width:100%;margin-bottom:8px">${t('connBtnCable')}</button>` : '') + categoriesHtml;
    container.querySelector('#connectionCableTool')?.addEventListener('click',()=>this.startCableDefinition());

    const search = container.querySelector<HTMLInputElement>('#symbolSearchInput');
    search?.addEventListener('input',()=>{
      if(connections)this.connectionSearchQuery=search.value;else this.symbolSearchQuery=search.value;
      const caret=search.selectionStart;
      this.renderSymbolsTab(container);
      const replacement=container.querySelector<HTMLInputElement>('#symbolSearchInput');
      replacement?.focus();replacement?.setSelectionRange(caret,caret);
    });
    // Events
    container.querySelector('#symbolCategorySelect')?.addEventListener('change', (e) => {
      if (connections) this.connectionCategoryFilter = (e.target as HTMLSelectElement).value;
      else this.symbolCategoryFilter = (e.target as HTMLSelectElement).value;
      this.renderSymbolsTab(container);
    });

    container.querySelectorAll('[data-symbol-id]').forEach(card => {
      card.addEventListener('click', (e) => {
        const symId = (e.currentTarget as HTMLElement).dataset.symbolId!;
        const sym = getSymbolById(symId);
        const locSym = sym ? getLocalizedSymbol(sym) : undefined;
        this.onSymbolSelectedToPlace(symId, locSym?.name);
        this.renderSymbolsTab(container);
      });
    });
  }

  private renderMacrosTab(container: HTMLElement): void {
    const macroCategories = ['all', 'window', 'page', 'motor', 'power', 'safety', 'external', 'user'] as const;
    let html = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 11px; font-weight: bold; color: var(--text-muted); text-transform: uppercase;">${t('macroHeading')}</span>
        <div style="display: flex; gap: 4px;">
          <button class="btn" id="btnOpenMacroDialog" style="padding: 2px 7px; font-size: 11px;" title="${t('macroOpenDialogTitle')}">${t('macroOpenDialog')}</button>
          <label class="btn btn-primary" style="padding: 2px 7px; font-size: 11px; margin: 0; cursor: pointer;" title="${t('macroImportTitle')}">
            ${t('macroImport')}
            <input type="file" id="macroTabFileInput" accept=".ema,.ems,.emp,.fp1,.edz,.xml,.json" style="display: none;">
          </label>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px;">
        <select class="form-input" id="macroCategorySelect">
          ${macroCategories.map(cat => `<option value="${cat}" ${this.macroCategoryFilter === cat ? 'selected' : ''}>${escapeSvg(getMacroCategoryLabel(cat))}</option>`).join('')}
        </select>
        <input class="form-input" id="macroTabSearch" placeholder="${escapeSvg(t('searchMacrosPlaceholder'))}" value="${escapeSvg(this.macroSearchQuery)}">
      </div>

      <div class="dropzone" id="macroTabDropzone" style="padding: 8px 10px; margin-bottom: 8px; text-align: center; border: 1px dashed var(--border-color); border-radius: 4px; background: rgba(0,0,0,0.15); cursor: pointer;" title="${t('macroDropzoneTitle')}">
        <div style="font-size: 11px; color: var(--text-muted);">
          ${t('macroDropzone')}
        </div>
      </div>

      <div class="macro-list" style="display: flex; flex-direction: column; gap: 8px; overflow-y: auto;">
    `;

    let list = MacroManager.getAllMacros();
    if (this.macroCategoryFilter === 'window') {
      list = list.filter(m => m.type === 'ema');
    } else if (this.macroCategoryFilter === 'page') {
      list = list.filter(m => m.type === 'ems');
    } else if (this.macroCategoryFilter === 'external') {
      list = list.filter(m => !!m.externalPath);
    } else if (this.macroCategoryFilter === 'user') {
      list = list.filter(m => !m.isBuiltIn && !m.externalPath);
    } else if (this.macroCategoryFilter === 'motor') {
      list = list.filter(m => m.category.includes('Motor') || m.name.includes('Motor'));
    } else if (this.macroCategoryFilter === 'power') {
      list = list.filter(m => m.category.includes('Strom') || m.category.includes('Versorgung') || m.name.includes('24V'));
    } else if (this.macroCategoryFilter === 'safety') {
      list = list.filter(m => m.category.includes('Sicherheit') || m.name.includes('HALT'));
    } else if (this.macroCategoryFilter !== 'all') {
      list = list.filter(m => m.category.toLowerCase().includes(this.macroCategoryFilter.toLowerCase()));
    }

    if (this.macroSearchQuery) {
      const q = this.macroSearchQuery.toLowerCase();
      list = list.filter(m => {
        const titleMatch = (m.name.toLowerCase().includes(q) || (m.externalPath || '').toLowerCase().includes(q));
        const descMatch = (m.description || '').toLowerCase().includes(q);
        const catMatch = (m.category || '').toLowerCase().includes(q);
        const bmkMatch = m.type === 'ema'
          ? (m as WindowMacro).components.some(c => c.bmk.toLowerCase().includes(q) || (c.functionText || '').toLowerCase().includes(q))
          : (m as PageMacro).page.components.some(c => c.bmk.toLowerCase().includes(q));
        return titleMatch || descMatch || catMatch || bmkMatch;
      });
    }

    const pageSize=48,pageCount=Math.max(1,Math.ceil(list.length/pageSize));
    this.macroPage=Math.max(0,Math.min(this.macroPage,pageCount-1));
    if(pageCount>1)html+=`<div data-macro-pager style="display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:11px"><button class="btn" data-macro-page="-1" ${this.macroPage===0?'disabled':''} aria-label="${t('macroPagePrev')}">←</button><span>${t('foundMacros', { count: list.length })} · ${this.macroPage+1}/${pageCount}</span><button class="btn" data-macro-page="1" ${this.macroPage===pageCount-1?'disabled':''} aria-label="${t('macroPageNext')}">→</button></div>`;
    if (list.length === 0) {
      html += `
        <div style="padding: 24px 10px; text-align: center; color: var(--text-muted); font-size: 11px;">
          ${t('noMacrosFound')}
        </div>
      `;
    } else {
      for (const m of list.slice(this.macroPage*pageSize,(this.macroPage+1)*pageSize)) {
        const isWindow = m.type === 'ema';
        const typeBadge = isWindow
          ? '<span style="background: rgba(66, 153, 225, 0.25); color: #63b3ed; border: 1px solid #3182ce; font-size: 9px; padding: 1px 4px; border-radius: 3px; font-weight: bold;">.EMA</span>'
          : '<span style="background: rgba(159, 122, 234, 0.25); color: #b794f4; border: 1px solid #805ad5; font-size: 9px; padding: 1px 4px; border-radius: 3px; font-weight: bold;">.EMS</span>';

        const thumbSvg = MacroManager.generateMacroSvgThumbnail(m);
        const compCount = isWindow ? (m as WindowMacro).components.length : (m as PageMacro).page.components.length;
        const bmkSummary = isWindow
          ? (m as WindowMacro).components.map(c => c.bmk).filter(Boolean).slice(0, 4).join(', ')
          : (m as PageMacro).page.components.map(c => c.bmk).filter(Boolean).slice(0, 4).join(', ');

        const isCurrentPlacing = isWindow && this.canvas.mode === 'place_macro' && this.canvas.activeMacroToPlace?.id === m.id;

        html += `
          <div class="symbol-card ${isCurrentPlacing ? 'selected' : ''}" style="display: flex; flex-direction: column; gap: 6px; padding: 8px; border: 1px solid ${isCurrentPlacing ? '#63b3ed' : 'var(--border-color)'};">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 4px;">
              <div style="font-size: 11px; font-weight: 600; color: #edf2f7; line-height: 1.3;">${escapeSvg(m.name)}</div>
              ${typeBadge}
            </div>

            <div style="background: #181b22; border: 1px solid #2d3748; border-radius: 3px; height: 75px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
              ${thumbSvg}
            </div>

            <div style="font-size: 10px; color: var(--text-muted); line-height: 1.3; max-height: 26px; overflow: hidden;">
              ${escapeSvg(m.description || t('macroCircuitMacro'))}${m.externalPath ? `<br><span title="${t('macroSourceFile')}">${escapeSvg(m.externalPath)}</span>` : ''}
            </div>

            <div style="font-size: 9px; font-family: monospace; color: #f6e05e;">
              ${t('macroComponentsSummary', { count: compCount, summary: escapeSvg(bmkSummary || '–') })}
            </div>
            ${m.importDiagnostics?.length?`<details class="macro-import-notes"><summary>${t('macroDiagnostics', { count: m.importDiagnostics.length })}</summary><ul style="padding-left:16px;font-size:11px;overflow-wrap:anywhere">${m.importDiagnostics.map(note=>`<li>${escapeSvg(note)}</li>`).join('')}</ul></details>`:''}

            <div style="display: flex; gap: 4px; margin-top: 2px;">
              <button class="btn btn-primary btn-tab-place-macro" data-macro-id="${m.id}" style="flex:1;padding:3px 6px;font-size:11px;justify-content:center">⚡ ${t('macroPlace')}</button>
              ${m.type==='ems'&&m.nativeData?.kind==='PageMacro'?`<button class="btn btn-tab-add-page-macro" data-macro-id="${m.id}" style="padding:3px 6px;font-size:11px">${t('macroAddPages')}</button>`:''}
              <button class="btn btn-tab-export-macro" data-macro-id="${m.id}" style="padding: 3px 6px; font-size: 11px;" title="${t('macroExportBtn')}">💾</button>
              ${!m.isBuiltIn && !m.externalPath ? `
                <button class="btn btn-tab-delete-macro" data-macro-id="${m.id}" style="padding: 3px 6px; font-size: 11px; color: #fc8181; border-color: #e53e3e;" title="${t('menuDelete')}">🗑️</button>
              ` : ''}
            </div>
          </div>
        `;
      }
    }

    html += `</div>`;
    container.innerHTML = html;

    container.prepend(createMacroFolderPanel());
    this.bindMacrosTabEvents(container);
  }

  private bindMacrosTabEvents(container: HTMLElement): void {
    container.querySelectorAll<HTMLElement>('[data-macro-page]').forEach(button=>button.addEventListener('click',()=>{
      this.macroPage+=Number(button.dataset.macroPage);this.renderMacrosTab(container);container.scrollTop=0;
    }));
    document.getElementById('btnOpenMacroDialog')?.addEventListener('click', () => {
      this.openMacroSelectionDialog();
    });

    document.getElementById('macroCategorySelect')?.addEventListener('change', (e) => {
      this.macroCategoryFilter = (e.target as HTMLSelectElement).value;
      this.macroPage=0;
      this.renderMacrosTab(container);
    });

    document.getElementById('macroTabSearch')?.addEventListener('input', (e) => {
      const input=e.target as HTMLInputElement,caret=input.selectionStart;
      this.macroSearchQuery = input.value;
      this.macroPage=0;
      this.renderMacrosTab(container);
      const replacement=container.querySelector<HTMLInputElement>('#macroTabSearch');replacement?.focus();replacement?.setSelectionRange(caret,caret);
    });

    // File input import
    const fileInput = document.getElementById('macroTabFileInput') as HTMLInputElement;
    fileInput?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        await this.importMacroFile(file);
      }
    });

    // Dropzone import
    const dropzone = document.getElementById('macroTabDropzone');
    if (dropzone) {
      dropzone.addEventListener('click', () => {
        fileInput?.click();
      });
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--accent-bright)';
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = 'var(--border-color)';
      });
      dropzone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--border-color)';
        const file = e.dataTransfer?.files?.[0];
        if (file) {
          await this.importMacroFile(file);
        }
      });
    }

    // Place window macro buttons
    container.querySelectorAll<HTMLElement>('.btn-tab-add-page-macro').forEach(button=>button.addEventListener('click',()=>{
      const macro=MacroManager.getAllMacros().find(m=>m.id===button.dataset.macroId);
      if(macro?.type==='ems'){
        if(macro.nativeData?.variables.length)this.configureMacro(macro,true);else this.addMacroPages(macro);
      }
    }));
    container.querySelectorAll('.btn-tab-place-macro').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.macroId!;
        const macro = MacroManager.getAllMacros().find(m => m.id === id);
        if (macro) {
          this.startPlacingMacro(macro);
          this.renderMacrosTab(container);
        }
      });
    });

    // Export buttons
    container.querySelectorAll('.btn-tab-export-macro').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.macroId!;
        const macro = MacroManager.getAllMacros().find(m => m.id === id);
        if (macro) {
          this.downloadMacro(macro);
        }
      });
    });

    // Delete buttons
    container.querySelectorAll('.btn-tab-delete-macro').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.macroId!;
        if (confirm(t('macroDeleteConfirm'))) {
          MacroManager.deleteMacro(id);
          this.renderMacrosTab(container);
        }
      });
    });
  }

  public openMacroSelectionDialog(defaultCategory?: string): void {
    new MacroSelectionDialog({
      onSelectWindowMacro: (wm) => {
        this.startPlacingMacro(wm);
      },
      onSelectPageMacro: (pm) => {
        this.startPlacingMacro(pm);
      }
    }, defaultCategory).show();
  }

  public startPlacingMacro(macro: MacroItem): void {
    if((macro.nativeData?.variables.length??0)>0 || macro.type==='ems'&&(macro.pages?.length??0)>1){
      this.configureMacro(macro);return;
    }
    try { this.startPlacingWindowMacro(MacroManager.forPlacement(macro)); }
    catch (error) { alert(error instanceof Error ? error.message : t('macroCannotPlace')); }
  }

  private configureMacro(macro:MacroItem,asPages=false):void {
    document.getElementById('macroConfigureDialog')?.remove();
    const dialog=document.createElement('dialog');dialog.id='macroConfigureDialog';dialog.className='about-dialog modal-backdrop';
    const variables=macro.nativeData?.variables??[],pages=macro.type==='ems'?macro.pages??[macro.page]:[];
    dialog.innerHTML=`<div class="about-heading"><h2>${t('macroConfigureTitle')}</h2><button class="btn" data-close aria-label="${t('btnClose')}">×</button></div>
      <div class="about-body"><p>${escapeSvg(macro.name)}</p>${pages.length>1&&!asPages?`<label class="form-label">${t('macroSourcePage')}<select class="form-input" data-source-page>${pages.map((p,i)=>`<option value="${i}">${escapeSvg(p.title)}</option>`).join('')}</select></label>`:''}
      ${variables.map((v,i)=>`<label class="form-label" style="display:block;margin:10px 0">${escapeSvg(v.name.replace(/_/g,' '))}<input class="form-input" data-variable="${i}" value="${escapeSvg(v.value)}"></label>`).join('')}
      <button class="btn btn-primary" data-apply>${asPages?t('macroAddPages'):t('macroPlace')}</button></div>`;
    document.body.appendChild(dialog);dialog.querySelector('[data-close]')!.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});
    dialog.querySelector('[data-apply]')!.addEventListener('click',()=>{
      const values=Object.fromEntries([...dialog.querySelectorAll<HTMLInputElement>('[data-variable]')].filter(input=>input.value!==variables[Number(input.dataset.variable)].value)
        .map(input=>[variables[Number(input.dataset.variable)].name,input.value]));
      const configured=macroWithVariables(macro,values);dialog.close();
      if(asPages&&configured.type==='ems')this.addMacroPages(configured);
      else{
        if(configured.type==='ems'){const index=Number(dialog.querySelector<HTMLSelectElement>('[data-source-page]')?.value??0);configured.page=configured.pages?.[index]??configured.page;}
        try{this.startPlacingWindowMacro(MacroManager.forPlacement(configured));}catch(e){alert(e instanceof Error?e.message:t('macroCannotPlace'));}
      }
    });dialog.showModal();
  }

  private addMacroPages(macro:PageMacro):void {
    const sources=macro.pages??[macro.page],added=sources.map(page=>{
      const copy=MacroManager.instantiatePageMacro({...macro,page},this.project);this.project.pages.push(copy);return copy;
    });
    if(added.length){this.canvas.setPage(added[0].id);this.notifyChange();this.updateUI();this.canvas.fitToScreen();}
  }

  public startPlacingWindowMacro(macro: WindowMacro): void {
    // Resolve portable project symbols before the canvas draws the placement preview.
    macro = JSON.parse(JSON.stringify(macro));
    mergeProjectSymbolLibrary(this.project, macro.symbolLibrary ?? [], macro.components);
    this.canvas.setMacroToPlace(macro);
    if (window.innerWidth <= 960) {
      this.setLeftPanelCollapsed(true);
    }
    const banner = document.getElementById('placeHintBanner');
    const bannerText = document.getElementById('placeHintText');
    if (banner && bannerText) {
      bannerText.textContent = t('macroPlaceHint', { name: macro.name });
      banner.style.display = 'flex';
    }
  }

  public async importMacroFile(file: File): Promise<void> {
    try {
      const imported = await MacroManager.parseMacroFile(file,{allowMissingDependencies:true});
      MacroManager.addMacro(imported);
      if (this.activeLeftTab === 'macros') {
        const container = document.getElementById('leftTabContent');
        if (container) this.renderMacrosTab(container);
      }
      alert(t('macroImportSuccess', { name: imported.name, type: imported.type === 'ema' ? '.ema' : '.ems' }));
    } catch (err: any) {
      alert(t('macroImportError', { error: err.message }));
    }
  }

  public exportSelectedAsWindowMacro(): void {
    const page=this.project.pages.find(p=>p.id===this.project.activePageId)!;
    const components=page.components.filter(c=>this.canvas.getElementSelection().componentIds.includes(c.id));
    if (!components.length) {
      alert(t('macroSelectFirst'));
      return;
    }
    this.exportComponentsAsMacro(components);
  }

  public exportComponentsAsMacro(comps: PlacedComponent[]): void {
    const activePage = this.project.pages.find(p => p.id === this.project.activePageId);
    if (!activePage || comps.length === 0) return;

    const defaultName = comps.length === 1
      ? `Makro_${comps[0].bmk}`
      : `Makro_${comps[0].bmk}_Gruppe`;

    const name = prompt(t('macroWindowPromptName'), defaultName);
    if (!name) return;

    const desc = prompt(t('macroWindowPromptDesc'), comps[0].functionText || t('macroWindowCustomDesc')) || '';

    const current=this.canvas.getElementSelection();
    const selection=current.componentIds.length===comps.length&&comps.every(c=>current.componentIds.includes(c.id))?current:{componentIds:comps.map(c=>c.id),cableIds:[]};
    const macro = MacroManager.createMacroFromSelection(name,'Eigene Fenstermakros',desc,activePage,selection);

    MacroManager.addMacro(macro);

    const { blob, filename } = MacroManager.exportMacro(macro);
    this.downloadBlob(blob, filename);

    if (this.activeLeftTab === 'macros') {
      const container = document.getElementById('leftTabContent');
      if (container) this.renderMacrosTab(container);
    }

    alert(t('macroWindowCreated', { name }));
  }

  public exportCurrentPageAsPageMacro(): void {
    const activePage = this.project.pages.find(p => p.id === this.project.activePageId);
    if (!activePage) return;

    const defaultName = `Makro_Blatt_${activePage.pageNumber}_${activePage.title.replace(/\s+/g, '_')}`;
    const name = prompt(t('macroPagePromptName'), defaultName);
    if (!name) return;

    const desc = prompt(t('macroWindowPromptDesc'), `${activePage.title} (${activePage.higherLevel}${activePage.location})`) || '';

    const macro = MacroManager.createMacroFromPage(
      activePage,
      name,
      'Eigene Makros (.ems)'
    );

    MacroManager.addMacro(macro);

    const { blob, filename } = MacroManager.exportMacro(macro);
    this.downloadBlob(blob, filename);

    if (this.activeLeftTab === 'macros') {
      const container = document.getElementById('leftTabContent');
      if (container) this.renderMacrosTab(container);
    }

    alert(t('macroPageCreated', { name }));
  }

  public downloadMacro(macro: MacroItem): void {
    const { blob, filename } = MacroManager.exportMacro(macro);
    this.downloadBlob(blob, filename);
  }

  public exportFloorPlanPage(page?: Page): void {
    const targetPage = page || this.project.pages.find(p => p.id === this.project.activePageId);
    if (!targetPage) return;
    if (!targetPage.floorPlan && targetPage.pageType !== 'installation') {
      alert(t('fpErrorNotFloorPlanPage'));
      return;
    }

    const pageClone: Page = JSON.parse(JSON.stringify(targetPage));
    const payload = {
      format: 'schematico-floorplan-page',
      version: 1,
      exportedAt: new Date().toISOString(),
      projectName: this.project.name,
      symbolLibrary: getComponentSymbolLibrary(pageClone.components),
      page: pageClone
    };

    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const safeTitle = (targetPage.title || 'Grundriss').replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, '_');
    const filename = `${safeTitle}_Blatt_${targetPage.pageNumber}.floorplan.json`;
    this.downloadBlob(blob, filename);

    const status = document.getElementById('statusLeft');
    if (status) {
      status.textContent = t('fpStatusExportedPage', { title: targetPage.title, filename });
    }
  }

  public rescaleFloorPlanToScale(targetRatio: number): void {
    const page = this.project.pages.find(p => p.id === this.project.activePageId);
    if (!page?.floorPlan) return;
    const fp = page.floorPlan;
    const currentPpm = fp.scale?.pixelPerMeter || 50;
    if (currentPpm <= 0 || targetRatio <= 0) return;

    const drawingUnits = getDrawingUnitsPerMm(this.project) || 2;
    const targetPpm = Math.max(5, (1000 * drawingUnits) / targetRatio);
    const factor = targetPpm / currentPpm;
    if (!isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 1e-4) return;

    // Calculate center of current elements
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasBounds = false;

    if (fp.walls?.length) {
      for (const w of fp.walls) {
        minX = Math.min(minX, w.start.x, w.end.x);
        maxX = Math.max(maxX, w.start.x, w.end.x);
        minY = Math.min(minY, w.start.y, w.end.y);
        maxY = Math.max(maxY, w.start.y, w.end.y);
        hasBounds = true;
      }
    }
    if (fp.openings?.length) {
      for (const op of fp.openings) {
        minX = Math.min(minX, op.center.x);
        maxX = Math.max(maxX, op.center.x);
        minY = Math.min(minY, op.center.y);
        maxY = Math.max(maxY, op.center.y);
        hasBounds = true;
      }
    }
    if (fp.backgroundImage?.bounds) {
      const b = fp.backgroundImage.bounds;
      minX = Math.min(minX, b.x);
      maxX = Math.max(maxX, b.x + b.width);
      minY = Math.min(minY, b.y);
      maxY = Math.max(maxY, b.y + b.height);
      hasBounds = true;
    }

    const cx = hasBounds ? Math.round((minX + maxX) / 2) : 400;
    const cy = hasBounds ? Math.round((minY + maxY) / 2) : 300;

    // 1. Rescale walls
    if (fp.walls) {
      for (const w of fp.walls) {
        w.start.x = Math.round(cx + (w.start.x - cx) * factor);
        w.start.y = Math.round(cy + (w.start.y - cy) * factor);
        w.end.x = Math.round(cx + (w.end.x - cx) * factor);
        w.end.y = Math.round(cy + (w.end.y - cy) * factor);
        if (w.thickness && w.thickness > 2) {
          w.thickness = Math.max(1, Math.round(w.thickness * factor));
        }
      }
    }

    // 2. Rescale openings (doors, windows, wall openings, garage doors)
    if (fp.openings) {
      for (const op of fp.openings) {
        op.center.x = Math.round(cx + (op.center.x - cx) * factor);
        op.center.y = Math.round(cy + (op.center.y - cy) * factor);
        op.width = Math.max(4, Math.round(op.width * factor));
      }
    }

    // 3. Rescale background image
    if (fp.backgroundImage?.bounds) {
      const b = fp.backgroundImage.bounds;
      b.x = Math.round(cx + (b.x - cx) * factor);
      b.y = Math.round(cy + (b.y - cy) * factor);
      b.width = Math.max(10, Math.round(b.width * factor));
      b.height = Math.max(10, Math.round(b.height * factor));
    }

    // 4. Rescale placed components
    for (const comp of page.components) {
      comp.x = Math.round(cx + (comp.x - cx) * factor);
      comp.y = Math.round(cy + (comp.y - cy) * factor);
    }

    // 5. Rescale page texts
    if (page.texts) {
      for (const t of page.texts) {
        t.x = Math.round(cx + (t.x - cx) * factor);
        t.y = Math.round(cy + (t.y - cy) * factor);
      }
    }

    // 6. Update scale metadata
    fp.scale.pixelPerMeter = targetPpm;
    fp.scale.scaleRatio = targetRatio;
    if (fp.scale.referenceDistance) {
      const rd = fp.scale.referenceDistance;
      rd.pointA.x = Math.round(cx + (rd.pointA.x - cx) * factor);
      rd.pointA.y = Math.round(cy + (rd.pointA.y - cy) * factor);
      rd.pointB.x = Math.round(cx + (rd.pointB.x - cx) * factor);
      rd.pointB.y = Math.round(cy + (rd.pointB.y - cy) * factor);
    }

    this.notifyChange();
    this.canvas.render();
    this.renderRightTab();

    const status = document.getElementById('statusLeft');
    if (status) {
      status.textContent = t('fpStatusRescaled', { ratio: targetRatio, ppm: targetPpm.toFixed(1) });
    }
  }

  public triggerImportFloorPlanPage(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.floorplan.json,.json,.ems';
    input.hidden = true;
    document.body.appendChild(input);
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) await this.importFloorPlanPageFromFile(file);
      input.remove();
    };
    input.click();
  }

  public async importFloorPlanPageFromFile(file: File): Promise<void> {
    try {
      let rawPage: Page | undefined;
      let symbolLib: any[] | undefined;

      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith('.ems')) {
        const macro = await MacroManager.parseMacroFile(file, { allowMissingDependencies: true });
        if (macro && 'page' in macro && macro.page) {
          rawPage = macro.page;
          symbolLib = macro.symbolLibrary;
        }
      } else {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (parsed.format === 'schematico-floorplan-page' && parsed.page) {
          rawPage = parsed.page;
          symbolLib = parsed.symbolLibrary;
        } else if (parsed.floorPlan || parsed.pageType === 'installation') {
          rawPage = parsed;
          symbolLib = parsed.symbolLibrary;
        } else if (parsed.page && (parsed.page.floorPlan || parsed.page.pageType === 'installation')) {
          rawPage = parsed.page;
          symbolLib = parsed.symbolLibrary;
        } else {
          throw new Error(t('fpErrorNoFloorPlanData'));
        }
      }

      if (!rawPage) {
        throw new Error(t('fpErrorReadFloorPlanFailed'));
      }

      // Clone page and assign fresh unique ID
      const pageClone: Page = JSON.parse(JSON.stringify(rawPage));
      const newPageId = 'page_' + Math.random().toString(36).substring(2, 9);
      pageClone.id = newPageId;
      pageClone.pageType = 'installation';

      // Determine next available page number
      let maxPageNum = 0;
      for (const p of this.project.pages) {
        const num = parseInt(p.pageNumber, 10);
        if (!isNaN(num) && num > maxPageNum) maxPageNum = num;
      }
      const nextNum = (maxPageNum + 1).toString();
      pageClone.pageNumber = nextNum;

      if (pageClone.plotFrame?.titleBlock) {
        pageClone.plotFrame.titleBlock.sheetNumber = nextNum;
        pageClone.plotFrame.titleBlock.totalSheets = (this.project.pages.length + 1).toString();
        pageClone.plotFrame.titleBlock.projectTitle = this.project.name;
        pageClone.plotFrame.titleBlock.company = this.project.company;
        pageClone.plotFrame.titleBlock.author = this.project.author;
        pageClone.plotFrame.titleBlock.date = new Date().toLocaleDateString('de-DE');
      }

      // Remap component IDs to avoid collisions
      const idMap = new Map<string, string>();
      for (const c of pageClone.components) {
        const oldId = c.id;
        const newId = 'comp_' + Math.random().toString(36).substring(2, 9);
        idMap.set(oldId, newId);
        c.id = newId;
      }

      // Remap wires
      const wireIds = new Map<string, string>();
      for (const w of pageClone.wires) {
        const oldId = w.id;
        w.id = 'w_' + Math.random().toString(36).substring(2, 9);
        wireIds.set(oldId, w.id);
        if (idMap.has(w.from.componentId)) w.from.componentId = idMap.get(w.from.componentId)!;
        if (idMap.has(w.to.componentId)) w.to.componentId = idMap.get(w.to.componentId)!;
      }

      for (const c of pageClone.components) {
        for (const pin of Object.values(c.pins)) {
          if (pin.wireIds) pin.wireIds = pin.wireIds.flatMap(id => wireIds.has(id) ? [wireIds.get(id)!] : []);
        }
      }

      // Remap arcWires if any
      if (pageClone.floorPlan?.arcWires) {
        for (const aw of pageClone.floorPlan.arcWires) {
          aw.id = 'aw_' + Math.random().toString(36).substring(2, 9);
          if (idMap.has(aw.fromComponentId)) aw.fromComponentId = idMap.get(aw.fromComponentId)!;
          if (idMap.has(aw.toComponentId)) aw.toComponentId = idMap.get(aw.toComponentId)!;
        }
      }

      // Merge symbol library
      if (symbolLib) {
        mergeProjectSymbolLibrary(this.project, symbolLib, pageClone.components);
      }

      this.project.pages.push(pageClone);
      this.project.activePageId = pageClone.id;
      this.updateTotalSheets();
      this.canvas.setPage(pageClone.id);
      this.canvas.setFloorPlanEditMode(true);
      this.notifyChange();
      this.updateUI();

      const status = document.getElementById('statusLeft');
      if (status) {
        status.textContent = t('fpStatusImportedPage', { title: pageClone.title, number: pageClone.pageNumber });
      }
    } catch (err: any) {
      alert(t('fpErrorImportPageFailed', { error: err?.message || err }));
    }
  }

  private async handleMacroFileDrop(file: File, clientX: number, clientY: number): Promise<void> {
    try {
      const imported = await MacroManager.parseMacroFile(file,{allowMissingDependencies:true});
      MacroManager.addMacro(imported);
      const placement = MacroManager.forPlacement(imported);
      mergeProjectSymbolLibrary(this.project, placement.symbolLibrary ?? [], placement.components);
      const world = this.canvas.screenToWorld(clientX, clientY);
      this.canvas.placeMacroAt(world.x, world.y, placement);
      this.updateUI();

    } catch (err: any) {
      alert(t('macroProcessError', { error: err.message }));
    }
  }

  private renderPartsCatalogueTab(container: HTMLElement): void {
    let html = `
      <div style="font-size: 11px; font-weight: bold; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">
        ${t('partsHeading')}
      </div>

      <div style="display: flex; gap: 6px; margin-bottom: 8px;">
        <select class="form-input" id="mfrSelect" style="flex: 1;">
          <option value="all" ${this.manufacturerFilter === 'all' ? 'selected' : ''}>${t('partsMfrAll')}</option>
          <option value="Hager" ${this.manufacturerFilter === 'Hager' ? 'selected' : ''}>Hager</option>
          <option value="Finder" ${this.manufacturerFilter === 'Finder' ? 'selected' : ''}>Finder</option>
          <option value="Siemens" ${this.manufacturerFilter === 'Siemens' ? 'selected' : ''}>Siemens</option>
          <option value="ABB" ${this.manufacturerFilter === 'ABB' ? 'selected' : ''}>ABB</option>
          <option value="Eaton" ${this.manufacturerFilter === 'Eaton' ? 'selected' : ''}>Eaton</option>
          <option value="Dehn" ${this.manufacturerFilter === 'Dehn' ? 'selected' : ''}>Dehn</option>
        </select>
        <input class="form-input" id="mfrSearch" placeholder="${escapeSvg(t('partsSearchPlaceholder'))}" value="${escapeSvg(this.manufacturerSearchQuery)}" style="flex: 1.2;">
      </div>

      <div class="parts-list" style="display: flex; flex-direction: column; gap: 8px;">
    `;

    let parts = MANUFACTURER_PARTS;
    if (this.manufacturerFilter !== 'all') {
      parts = parts.filter(p => p.manufacturer.toLowerCase() === this.manufacturerFilter.toLowerCase());
    }
    if (this.manufacturerSearchQuery) {
      const q = this.manufacturerSearchQuery.toLowerCase();
      parts = parts.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.articleNumber.toLowerCase().includes(q) || 
        p.description.toLowerCase().includes(q) ||
        p.technicalData.toLowerCase().includes(q)
      );
    }

    for (const part of parts) {
      html += `
        <div class="part-item-card" data-part-id="${part.id}" style="
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 8px 10px;
          cursor: pointer;
          transition: all 0.15s ease;
        ">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
            <span style="font-weight: 600; font-size: 11px; color: var(--accent-bright);">${part.manufacturer}</span>
            <span style="font-family: monospace; font-size: 10px; background: rgba(246, 224, 94, 0.15); color: var(--warning); padding: 1px 4px; border-radius: 3px;">
              ${part.articleNumber}
            </span>
          </div>

          <div style="font-weight: 500; font-size: 11px; margin-bottom: 3px; color: var(--text-main);">
            ${part.name}
          </div>

          <div style="font-size: 10px; color: var(--text-muted); margin-bottom: 6px;">
            ${part.technicalData}
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 6px;">
            <span style="font-size: 9px; color: #718096;">${part.widthModules || t('partsNormDesign')}</span>
            <button class="btn btn-primary btn-place-part" data-part-id="${part.id}" style="padding: 2px 6px; font-size: 10px;">
              ⚡ ${t('partsPlaceOnCanvas')}
            </button>
          </div>
        </div>
      `;
    }

    html += `</div>`;
    container.innerHTML = html;

    // Events
    document.getElementById('mfrSelect')?.addEventListener('change', (e) => {
      this.manufacturerFilter = (e.target as HTMLSelectElement).value;
      this.renderPartsCatalogueTab(container);
    });

    document.getElementById('mfrSearch')?.addEventListener('input', (e) => {
      this.manufacturerSearchQuery = (e.target as HTMLInputElement).value;
      this.renderPartsCatalogueTab(container);
    });

    container.querySelectorAll('.btn-place-part, .part-item-card').forEach(el => {
      el.addEventListener('click', (e) => {
        const partId = (e.currentTarget as HTMLElement).dataset.partId!;
        const part = MANUFACTURER_PARTS.find(p => p.id === partId);
        if (part) {
          this.onSymbolSelectedToPlace(part.symbolId, `${part.manufacturer} ${part.name}`);
          if (this.selectedComponent) {
            this.selectedComponent.manufacturer = part.manufacturer;
            this.selectedComponent.articleNumber = part.articleNumber;
            setComponentLabelText(this.selectedComponent, 'functionText', part.name);
            setComponentLabelText(this.selectedComponent, 'technicalCharacteristics', part.technicalData);
            this.notifyChange();
          }
        }
      });
    });
  }

  private renderTerminalsTab(container: HTMLElement): void {
    const isEn = this.project.language === 'en';
    const strips = TerminalDiagramGenerator.generateTerminalReport(this.project);

    let html = `
      <div style="font-size: 11px; font-weight: bold; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">
        ${isEn ? 'Terminal Diagram Report (DIN EN 81346)' : 'Klemmenplan-Auswertung (DIN EN 81346)'}
      </div>
    `;

    if (strips.size === 0) {
      html += `<div style="font-size: 11px; color: var(--text-muted); padding: 12px 0;">${isEn ? 'No terminal strips placed in project.' : 'Keine Klemmenleisten im Projekt platziert.'}</div>`;
    } else {
      for (const [stripName, entries] of strips.entries()) {
        html += `
          <div style="margin-bottom: 16px;">
            <div style="font-size: 12px; font-weight: bold; color: var(--warning); margin-bottom: 4px;">${isEn ? 'Terminal Strip' : 'Klemmenleiste'}: ${stripName}</div>
            <table class="report-table">
              <thead>
                <tr>
                  <th>${isEn ? 'Terminal' : 'Klemme'}</th>
                  <th>${isEn ? 'Internal' : 'Intern'}</th>
                  <th>${isEn ? 'External' : 'Extern'}</th>
                  <th>${isEn ? 'Function' : 'Funktion'}</th>
                </tr>
              </thead>
              <tbody>
        `;
        for (const entry of entries) {
          html += `
            <tr>
              <td style="font-family: monospace; font-weight: bold; color: var(--accent-bright);">${entry.terminalNumber}</td>
              <td style="font-family: monospace;">${entry.internalTarget}</td>
              <td style="font-family: monospace;">${entry.externalTarget}</td>
              <td>${entry.functionText}</td>
            </tr>
          `;
        }
        html += `</tbody></table></div>`;
      }
    }

    container.innerHTML = html;
  }

  private renderBomTab(container: HTMLElement): void {
    const isEn = this.project.language === 'en';
    const parts = PartsListGenerator.generatePartsList(this.project);

    let html = `
      <div style="font-size: 11px; font-weight: bold; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">
        ${isEn ? 'Bill of Materials (BOM)' : 'Stückliste / Artikelliste (BOM)'}
      </div>
      <table class="report-table">
        <thead>
          <tr>
            <th>${isEn ? 'Qty' : 'Menge'}</th>
            <th>${isEn ? 'Part Number' : 'Artikelnummer'}</th>
            <th>${isEn ? 'Description / Type' : 'Beschreibung'}</th>
            <th>${isEn ? 'Manufacturer' : 'Hersteller'}</th>
            <th>${isEn ? 'Tag List' : 'BMK-Liste'}</th>
          </tr>
        </thead>
        <tbody>
    `;

    for (const part of parts) {
      html += `
        <tr>
          <td style="font-weight: bold; color: var(--warning);">${part.quantity}x</td>
          <td style="font-family: monospace; color: var(--accent-bright);">${part.articleNumber}</td>
          <td>${part.description}</td>
          <td>${part.manufacturer}</td>
          <td style="font-family: monospace; color: #a0aec0;">${part.bmkList.join(', ')}</td>
        </tr>
      `;
    }

    html += `</tbody></table>`;
    container.innerHTML = html;
  }

  private renderRightTab(): void {
    const container = document.getElementById('rightTabContent');
    if (!container) return;
    this.renderPropertiesTab(container);
  }

  private openSelectionProperties(openModal = false): void {
    if (this.isRightCollapsed) this.setRightPanelCollapsed(false);
    this.renderRightTab();
    if (openModal) {
      this.openSelectionPropertiesModal();
    }
  }

  private openSelectionPropertiesModal(): void {
    const selection = this.canvas.getElementSelection();
    const page = this.project.pages.find(p => p.id === this.project.activePageId);
    if (!page) return;

    if (selectionCount(selection) > 1) {
      if (selection.componentIds.length > 1 && !selection.cableIds.length && !selection.boxIds?.length && !selection.imageIds?.length && !selection.wireIds?.length && !selection.textIds?.length) {
        const comps = page.components.filter(c => selection.componentIds.includes(c.id));
        new PropertiesDialog(comps, this.project, {
          onSave: (updated) => {
            const idx = page.components.findIndex(c => c.id === updated.id);
            if (idx >= 0) page.components[idx] = updated;
            this.notifyChange();
            this.renderRightTab();
            this.updateFloatingSelectionBar();
          },
          onSaveMultiple: (updatedList) => {
            for (const updated of updatedList) {
              const idx = page.components.findIndex(c => c.id === updated.id);
              if (idx >= 0) page.components[idx] = updated;
            }
            this.notifyChange();
            this.renderRightTab();
            this.updateFloatingSelectionBar();
          }
        }).show();
        return;
      }
      PropertiesDialog.showSelectionModal(page, this.project, selection, () => {
        this.notifyChange();
        this.renderRightTab();
        this.updateFloatingSelectionBar();
      });
      return;
    }

    if (this.selectedComponent) {
      this.openPropertiesDialog(this.selectedComponent);
    }
  }

  private renderImageProperties(container:HTMLElement):void {
    const page=this.project.pages.find(p=>p.id===this.project.activePageId),image=page?.images?.find(i=>i.id===this.canvas.selectedImageId);if(!image)return;
    const units=getDrawingUnitsPerMm(this.project),ratio=image.width/image.height;
    container.innerHTML=`<h3>${t('imageHeading')}</h3><p>${escapeSvg(image.caption || t('imageCaptionDefault'))}</p>
      ${[['X',t('boxLabelPosX'),image.x],['Y',t('boxLabelPosY'),image.y],['Width',t('boxLabelWidth'),image.width],['Height',t('boxLabelHeight'),image.height]].map(([id,label,n])=>`<label class="form-label">${label} (mm)<input class="form-input" id="image${id}" type="number" step="any" ${id==='Width'||id==='Height'?'min="0.1"':''} value="${Number((Number(n)/units).toFixed(4))}"></label>`).join('')}
      ${image.missing?`<p style="color:#f6ad55">${t('imageMissing')}</p>`:''}
      <p style="font-size:12px;color:var(--text-muted)">${t('imageProportional')}</p><button class="btn" id="applyImageProperties">${t('btnApply')}</button> <button class="btn" id="replaceImage">${t('imageReplace')}</button> <button class="btn" id="deleteImage">${t('imageDelete')}</button>`;
    let editedSize:'Width'|'Height'|undefined;
    for(const key of ['Width','Height'] as const)container.querySelector('#image'+key)?.addEventListener('input',()=>{editedSize=key;const input=container.querySelector('#image'+key) as HTMLInputElement,other=container.querySelector('#image'+(key==='Width'?'Height':'Width')) as HTMLInputElement;if(input.value&&input.validity.valid)other.value=String(key==='Width'?Number(input.value)/ratio:Number(input.value)*ratio);});
    container.querySelector('#applyImageProperties')?.addEventListener('click',()=>{
      const inputs=['X','Y','Width','Height'].map(key=>container.querySelector('#image'+key) as HTMLInputElement);
      if(inputs.some(i=>!i.value||!i.validity.valid||!Number.isFinite(Number(i.value))))return;
      const before=JSON.stringify(image);image.x=Number(inputs[0].value)*units;image.y=Number(inputs[1].value)*units;
      if(editedSize==='Width'){image.width=Number(inputs[2].value)*units;image.height=image.width/ratio;}else if(editedSize==='Height'){image.height=Number(inputs[3].value)*units;image.width=image.height*ratio;}
      if(JSON.stringify(image)!==before)this.notifyChange();this.renderRightTab();
    });
    container.querySelector('#deleteImage')?.addEventListener('click',()=>this.canvas.deleteSelected());
    container.querySelector('#replaceImage')?.addEventListener('click',()=>{
      const input=document.createElement('input');input.type='file';input.accept='image/*,.svg,.bmp';input.hidden=true;document.body.appendChild(input);
      input.addEventListener('cancel',()=>input.remove(),{once:true});
      input.addEventListener('change',async()=>{
        const file=input.files?.[0];input.remove();if(!file)return;
        try{const replacement=await readImageFile(file,units);if(!page?.images?.includes(image))return;
          image.dataUrl=replacement.dataUrl;image.caption=file.name;image.missing=false;this.notifyChange();this.renderRightTab();
        }catch(error){alert(error instanceof Error?error.message:t('imageReadError'));}
      },{once:true});input.click();
    });
  }

  private renderSelectionProperties(container: HTMLElement): void {
    const selection = this.canvas.getElementSelection();
    const page = this.project.pages.find(p => p.id === this.project.activePageId)!;

    const count = selectionCount(selection);

    const field = (key: SharedProperty, label: string, number = false) => {
      if (!propertyExistsOnAllSelected(page, selection, key)) return '';
      const value = sharedPropertyValue(page, this.project, selection, key);
      const isMixed = value === undefined;
      const displayVal = isMixed ? '' : typeof value === 'number' ? Number(value.toFixed(4)) : value;
      return `<label class="form-label" style="display:block;margin-bottom:8px">${escapeSvg(label)}<input class="form-input" data-shared-property="${key}" id="shared-${key}" type="${number ? 'number' : 'text'}" ${number ? 'min="0.05" max="200" step="any"' : ''} value="${escapeSvg(String(displayVal))}" placeholder="${isMixed ? escapeSvg(t('sharedDifferentValues')) : ''}"></label>`;
    };

    const selectField = (key: SharedProperty, label: string, options: [string, string][]) => {
      if (!propertyExistsOnAllSelected(page, selection, key)) return '';
      const value = sharedPropertyValue(page, this.project, selection, key);
      const isMixed = value === undefined;
      return `
        <label class="form-label" style="display:block;margin-bottom:8px">
          ${escapeSvg(label)}
          <select class="form-input" data-shared-property="${key}" id="shared-${key}">
            <option value="" ${isMixed ? 'selected' : ''} disabled>— (${escapeSvg(t('sharedDifferentValues'))}) —</option>
            ${options.map(([optVal, optLabel]) => `
              <option value="${optVal}" ${!isMixed && String(value) === optVal ? 'selected' : ''}>${escapeSvg(optLabel)}</option>
            `).join('')}
          </select>
        </label>
      `;
    };

    const checkboxField = (key: SharedProperty, label: string) => {
      if (!propertyExistsOnAllSelected(page, selection, key)) return '';
      const value = sharedPropertyValue(page, this.project, selection, key);
      return `
        <label class="form-label" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;">
          <input type="checkbox" data-shared-property="${key}" id="shared-${key}" ${value === 'true' ? 'checked' : ''} style="accent-color:#3182ce;">
          <span>${escapeSvg(label)}</span>
        </label>
      `;
    };

    // Build fieldset groups
    const idFields = [
      field('bmk', t('labelBmk')),
      field('deviceTag', t('labelDeviceTag')),
      field('functionText', t('labelFunctionText')),
      field('additionalText', t('labelAdditionalText')),
      field('technicalCharacteristics', t('labelTechnical')),
      field('higherLevel', t('labelStructure') + ' (=Anlage)'),
      field('location', t('labelStructure') + ' (+Ort)'),
      field('manufacturer', t('labelManufacturer')),
      field('articleNumber', t('labelArticleNumber'))
    ].filter(Boolean).join('');

    const fontFields = [
      field('bmkFontSize', t('labelBmk') + ' (mm)', true),
      field('functionFontSize', t('labelFunctionText') + ' (mm)', true),
      field('additionalFontSize', t('labelAdditionalText') + ' (mm)', true),
      field('technicalFontSize', t('labelTechnical') + ' (mm)', true),
      field('crossRefFontSize', t('labelCrossRef') + ' (mm)', true),
      field('pinFontSize', t('symPins', { count: '' }) + ' (mm)', true),
      field('boxFontSize', t('boxLabelFontSize') + ' (mm)', true),
      field('textFontSize', t('textFontSize'), true),
    ].filter(Boolean).join('');

    const visFields = [
      checkboxField('bmkVisible', 'BMK sichtbar'),
      checkboxField('fnVisible', 'Funktionstext sichtbar'),
      checkboxField('techVisible', 'Technische Daten sichtbar'),
      checkboxField('additionalVisible', 'Zusatztext sichtbar'),
      checkboxField('crossRefVisible', 'Querverweise sichtbar'),
      checkboxField('pinVisible', 'Anschlüsse / Adern sichtbar'),
      selectField('bmkPreset', t('labelBmkPosition'), [
        ['auto', t('bmkPresetAuto')],
        ['top', t('bmkPresetTop')],
        ['top_left', t('bmkPresetTopLeft')],
        ['top_right', t('bmkPresetTopRight')],
        ['bottom', t('bmkPresetBottom')],
        ['bottom_left', t('bmkPresetBottomLeft')],
        ['bottom_right', t('bmkPresetBottomRight')],
        ['left', t('bmkPresetLeft')],
        ['right', t('bmkPresetRight')],
      ])
    ].filter(Boolean).join('');

    const cableFields = [
      field('cableType', t('cableType')),
      field('crossSection', t('cableSection')),
      field('coreCount', t('cableCoreCount'), true),
      field('cableDescription', t('cableDescription')),
      selectField('cableMarkStyle', t('cableMarkStyle'), [['slash', t('cableMarkSlash')], ['none', t('cableMarkNone')]])
    ].filter(Boolean).join('');

    const wireFields = [
      field('wirePotential', t('wirePotential')),
      selectField('wireColor', t('wireColor'), [['BK', t('wireColorBk')], ['BU', t('wireColorBu')], ['GNYE', t('wireColorGnye')], ['RD', t('wireColorRd')], ['DBU', t('wireColorDbu')]]),
      field('wireNumber', 'Adernummer')
    ].filter(Boolean).join('');

    const textFields = [
      field('textContent', t('textContent')),
      selectField('textAlign', t('textAlign'), [['start', t('textAlignLeft')], ['center', t('textAlignCenter')], ['end', t('textAlignRight')]]),
      selectField('textFontWeight', 'Schriftschnitt', [['normal', 'Normal'], ['bold', 'Fett']]),
      selectField('textFontStyle', 'Schriftstil', [['normal', 'Normal'], ['italic', 'Kursiv']])
    ].filter(Boolean).join('');

    const boxFields = [
      field('boxLineWidth', t('boxLabelLineWidth') + ' (mm)', true),
      selectField('boxLineStyle', t('boxLabelLineStyle'), [['solid', t('boxStyleSolid')], ['dashed', t('boxStyleDashed')]])
    ].filter(Boolean).join('');

    const geomFields = [
      field('posX', t('boxLabelPosX') + ' (mm)', true),
      field('posY', t('boxLabelPosY') + ' (mm)', true),
      field('width', t('boxLabelWidth') + ' (mm)', true),
      field('height', t('boxLabelHeight') + ' (mm)', true),
      selectField('rotation', t('propRotationAngle'), [['0', '0°'], ['90', '90°'], ['180', '180°'], ['270', '270°']])
    ].filter(Boolean).join('');

    const floorPlanFields = [
      checkboxField('compShowLabels', t('fpCompShowBmkLabel')),
      selectField('compScale', t('fpCompScaleLabel'), [
        ['inherit', t('fpCompScaleInherit')],
        ['0.35', t('fpCompScale35')],
        ['0.45', t('fpCompScale45')],
        ['0.6', t('fpCompScale60')],
        ['0.75', t('fpCompScale75')],
        ['1.0', t('fpCompScale100')],
      ])
    ].filter(Boolean).join('');

    container.innerHTML = `
      <button class="btn btn-primary" id="btnOpenFullPropModal" style="width: 100%; margin-bottom: 12px; font-weight: 600; font-size: 12px; padding: 8px 12px; display: flex; align-items: center; justify-content: center; gap: 8px; background: #3182ce; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
        <span>⚙️ ${escapeSvg(t('btnOpenFullPropModal'))}</span>
        <span style="font-size: 10px; opacity: 0.8; font-family: monospace;">[Enter / F2]</span>
      </button>

      <h3>${escapeSvg(t('sharedPropsHeading'))}</h3>
      <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px; margin-bottom: 8px;">
        ${escapeSvg(t('sharedPropsSelected', { count, components: selection.componentIds.length, cables: selection.cableIds.length, images: selection.imageIds?.length ?? 0, boxes: selection.boxIds?.length ?? 0 }))}
      </p>
      <p style="font-size: 11px; color: var(--text-muted); margin-bottom: 12px;">
        ${escapeSvg(t('sharedPropsHint'))}
      </p>

      ${idFields ? `<fieldset style="border:1px solid var(--border-color);padding:8px;margin:10px 0"><legend>Identifikation & Texte</legend>${idFields}</fieldset>` : ''}
      ${fontFields ? `<fieldset style="border:1px solid var(--border-color);padding:8px;margin:10px 0"><legend>${escapeSvg(t('legendFontSizes'))}</legend>${fontFields}</fieldset>` : ''}
      ${visFields ? `<fieldset style="border:1px solid var(--border-color);padding:8px;margin:10px 0"><legend>Anzeige & Position</legend>${visFields}</fieldset>` : ''}
      ${cableFields ? `<fieldset style="border:1px solid var(--border-color);padding:8px;margin:10px 0"><legend>${escapeSvg(t('legendCableDefs'))}</legend>${cableFields}</fieldset>` : ''}
      ${wireFields ? `<fieldset style="border:1px solid var(--border-color);padding:8px;margin:10px 0"><legend>Verbindungen</legend>${wireFields}</fieldset>` : ''}
      ${textFields ? `<fieldset style="border:1px solid var(--border-color);padding:8px;margin:10px 0"><legend>Textformatierung</legend>${textFields}</fieldset>` : ''}
      ${boxFields ? `<fieldset style="border:1px solid var(--border-color);padding:8px;margin:10px 0"><legend>${escapeSvg(t('legendDeviceBoxes'))}</legend>${boxFields}</fieldset>` : ''}
      ${geomFields ? `<fieldset style="border:1px solid var(--border-color);padding:8px;margin:10px 0"><legend>Lage & Abmessungen</legend>${geomFields}</fieldset>` : ''}
      ${floorPlanFields ? `<fieldset style="border:1px solid var(--border-color);padding:8px;margin:10px 0"><legend>Grundriss-Darstellung</legend>${floorPlanFields}</fieldset>` : ''}

      <button class="btn btn-primary" id="applySharedProperties" disabled style="width: 100%; margin-top: 10px;">${escapeSvg(t('sharedApplyChanges'))}</button>
      <button class="btn" id="clearElementSelection" style="width: 100%; margin-top: 6px;">${escapeSvg(t('sharedClearSelection'))}</button>
    `;

    container.querySelector('#btnOpenFullPropModal')?.addEventListener('click', () => {
      this.openSelectionPropertiesModal();
    });

    const patch: SelectionPatch = {};
    const apply = container.querySelector('#applySharedProperties') as HTMLButtonElement;

    container.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-shared-property]').forEach(input => {
      const handler = () => {
        const key = input.dataset.sharedProperty as SharedProperty;
        if (input.type === 'checkbox') {
          patch[key] = (input as HTMLInputElement).checked ? 'true' : 'false';
        } else if (input.type === 'number') {
          if (input.value === '') delete patch[key];
          else patch[key] = Number(input.value);
        } else {
          patch[key] = input.value;
        }
        apply.disabled = Object.keys(patch).length === 0 || [...container.querySelectorAll<HTMLInputElement>('[data-shared-property]')].some(i => i.dataset.sharedProperty! in patch && !i.validity.valid);
      };
      input.addEventListener('input', handler);
      input.addEventListener('change', handler);
    });

    apply.addEventListener('click', () => {
      if (apply.disabled) return;
      if (applySelectionProperties(page, this.project, this.canvas.getElementSelection(), patch)) {
        this.notifyChange();
      }
      this.renderRightTab();
    });

    container.querySelector('#clearElementSelection')?.addEventListener('click', () => {
      this.canvas.setElementSelection({ componentIds: [], cableIds: [] });
    });
  }

  private startDeviceBox():void {
    this.canvas.startDeviceBox();this.updateToolButtons('btnDeviceBox');
    const status=document.getElementById('statusLeft');if(status)status.textContent=t('statusDeviceBox');
  }

  private startCableDefinition():void {
    this.canvas.setMode('cable');this.updateToolButtons('btnCableDefinition');
    const status=document.getElementById('statusLeft');if(status)status.textContent=t('statusCable');
  }

  private renderCableProperties(container:HTMLElement,cable:CableDefinition):void {
    const units=getDrawingUnitsPerMm(this.project),page=this.project.pages.find(p=>p.id===this.project.activePageId)!;
    const crossings=cableCrossings(cable,page,this.project);
    const input=(id:string,label:string,value:string|number,type='text')=>`<label class="form-label">${label}<input class="form-input" id="${id}" type="${type}" ${type==='number'?'step="any"':''} value="${escapeSvg(String(value))}"></label>`;
    container.innerHTML=`<h3>${t('cableHeading')}</h3>
      ${input('cableBmk',t('cableBmk'),cable.bmk)}${input('cableType',t('cableType'),cable.cableType)}
      ${input('cableCoreCount',t('cableCoreCount'),cable.coreCount ?? '','number')}${input('cableSection',t('cableSection'),cable.crossSection)}${input('cableDescription',t('cableDescription'),cable.description ?? '')}
      <fieldset style="border:1px solid var(--border-color);margin:10px 0"><legend>${t('cableLegendLabel')}</legend>
      ${input('cableFontSize',t('cableFontSize'),Number(((cable.fontSize ?? units*2.2356)/units).toFixed(4)),'number')}
      ${input('cableBmkFontSize',t('cableBmkFontSize'),Number(((cable.bmkFontSize ?? cable.fontSize ?? units*2.2356)/units).toFixed(4)),'number')}
      ${input('cableCoreFontSize',t('cableCoreFontSize'),Number(((cable.coreFontSize ?? units*1.6146)/units).toFixed(4)),'number')}
      ${input('cableLabelX',t('cableLabelX'),(cable.labelOffset?.x ?? -units)/units,'number')}${input('cableLabelY',t('cableLabelY'),(cable.labelOffset?.y ?? -.285*units)/units,'number')}
      <label><input id="cableShowLabel" type="checkbox" ${cable.showLabel!==false?'checked':''}> ${t('cableShowLabel')}</label><br>
      <label><input id="cableShowCores" type="checkbox" ${cable.showCoreLabels!==false?'checked':''}> ${t('cableShowCores')}</label>
      <label class="form-label">${t('cableMarkStyle')}<select class="form-input" id="cableMarkStyle"><option value="none" ${cable.markStyle==='none'?'selected':''}>${t('cableMarkNone')}</option><option value="slash" ${cable.markStyle!=='none'?'selected':''}>${t('cableMarkSlash')}</option></select></label></fieldset>
      <fieldset style="border:1px solid var(--border-color);margin:10px 0"><legend>${t('cableLegendLine')}</legend>
      ${input('cableStartX',t('cableStartX'),cable.start.x/units,'number')}${input('cableStartY',t('cableStartY'),cable.start.y/units,'number')}${input('cableEndX',t('cableEndX'),cable.end.x/units,'number')}${input('cableEndY',t('cableEndY'),cable.end.y/units,'number')}</fieldset>
      <p>${t('cableCrossings', { count: crossings.length })}</p>
      ${cable.cores.length?`<details><summary>${t('cableCoresSummary', { count: cable.cores.length })}</summary>${cable.cores.map((core,i)=>`<div style="margin:8px 0">${t('cableCore', { index: i+1 })}${input('cableCoreColor'+i,t('cableColor'),core.color ?? '')}${input('cableCoreName'+i,t('cableDesignation'),core.designation ?? '')}</div>`).join('')}</details>`:''}
      <button class="btn" id="cableRotate">${t('cableRotate')}</button> <button class="btn" id="cableDelete">${t('cableDelete')}</button>`;
    const bindText=(id:string,apply:(value:string)=>void)=>container.querySelector('#'+id)?.addEventListener('input',event=>{apply((event.target as HTMLInputElement).value);this.notifyChange();});
    for(const [id,key] of [['cableBmk','bmk'],['cableType','cableType'],['cableSection','crossSection'],['cableDescription','description']] as const)bindText(id,value=>cable[key]=value);
    const bindNumber=(id:string,apply:(value:number)=>void,min=-Infinity,max=Infinity)=>container.querySelector('#'+id)?.addEventListener('input',event=>{const input=event.target as HTMLInputElement,value=Number(input.value);if(input.value!==''&&input.validity.valid&&Number.isFinite(value)&&value>=min&&value<=max){apply(value);this.notifyChange();}});
    bindNumber('cableCoreCount',value=>{if(Number.isInteger(value))cable.coreCount=value;},1,999);
    for(const [id,key] of [['cableFontSize','fontSize'],['cableBmkFontSize','bmkFontSize'],['cableCoreFontSize','coreFontSize']] as const)bindNumber(id,value=>cable[key]=value*units,.1,20);
    for(const [id,key,axis] of [['cableStartX','start','x'],['cableStartY','start','y'],['cableEndX','end','x'],['cableEndY','end','y']] as const)bindNumber(id,value=>cable[key][axis]=value*units);
    bindNumber('cableLabelX',value=>{cable.labelOffset={x:value*units,y:cable.labelOffset?.y ?? -.285*units};});
    bindNumber('cableLabelY',value=>{cable.labelOffset={x:cable.labelOffset?.x ?? -units,y:value*units};});
    for(const [id,key] of [['cableShowLabel','showLabel'],['cableShowCores','showCoreLabels']] as const)container.querySelector('#'+id)?.addEventListener('change',e=>{cable[key]=(e.target as HTMLInputElement).checked;this.notifyChange();});
    container.querySelector('#cableMarkStyle')?.addEventListener('change',e=>{cable.markStyle=(e.target as HTMLSelectElement).value as 'none'|'slash';this.notifyChange();});
    cable.cores.forEach((core,i)=>{bindText('cableCoreColor'+i,v=>core.color=v);bindText('cableCoreName'+i,v=>core.designation=v);});
    container.querySelector('#cableRotate')?.addEventListener('click',()=>{this.canvas.rotateSelected();this.renderCableProperties(container,cable);});
    container.querySelector('#cableDelete')?.addEventListener('click',()=>this.canvas.deleteSelected());
  }

  private renderWallProperties(container: HTMLElement, wall: WallSegment): void {
    const page = this.project.pages.find(p => p.id === this.project.activePageId);
    const scale = page?.floorPlan?.scale;
    const pxPerMeter = scale?.pixelPerMeter || 50;

    const isExt = !!wall.isExterior;
    const thicknessM = wall.thickness
      ? (wall.thickness < 1 ? wall.thickness : wall.thickness / pxPerMeter)
      : (isExt ? 0.24 : 0.115);
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const lenPx = Math.hypot(dx, dy);
    const lenM = (lenPx / pxPerMeter).toFixed(2);
    const angleDeg = (Math.atan2(dy, dx) * 180 / Math.PI).toFixed(1);

    container.innerHTML = `
      <div style="font-size: 11px; font-weight: bold; color: var(--text-muted); text-transform: uppercase; margin-bottom: 12px;">
        ${t('wallPropsHeading')}
      </div>

      <div class="form-group">
        <label class="form-label">${t('wallTypeLabel')}</label>
        <select class="form-input" id="propWallType">
          <option value="exterior" ${isExt ? 'selected' : ''}>${t('wallTypeExterior')}</option>
          <option value="interior" ${!isExt ? 'selected' : ''}>${t('wallTypeInterior')}</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">${t('wallThicknessLabel')}</label>
        <input class="form-input" id="propWallThickness" type="number" min="0.05" max="1.50" step="0.005" value="${thicknessM.toFixed(3)}">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:6px;">
          <button type="button" class="btn btn-sm btnWallThickPreset" data-thick="0.115" style="font-size:10px;padding:3px;justify-content:center;">${t('wallThickPreset115')}</button>
          <button type="button" class="btn btn-sm btnWallThickPreset" data-thick="0.175" style="font-size:10px;padding:3px;justify-content:center;">${t('wallThickPreset175')}</button>
          <button type="button" class="btn btn-sm btnWallThickPreset" data-thick="0.240" style="font-size:10px;padding:3px;justify-content:center;">${t('wallThickPreset240')}</button>
          <button type="button" class="btn btn-sm btnWallThickPreset" data-thick="0.365" style="font-size:10px;padding:3px;justify-content:center;">${t('wallThickPreset365')}</button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">${t('wallStartPointLabel')}</label>
        <div style="display:flex;gap:6px;">
          <input class="form-input" id="propWallStartX" type="number" step="0.01" value="${(wall.start.x / pxPerMeter).toFixed(2)}">
          <input class="form-input" id="propWallStartY" type="number" step="0.01" value="${(wall.start.y / pxPerMeter).toFixed(2)}">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">${t('wallEndPointLabel')}</label>
        <div style="display:flex;gap:6px;">
          <input class="form-input" id="propWallEndX" type="number" step="0.01" value="${(wall.end.x / pxPerMeter).toFixed(2)}">
          <input class="form-input" id="propWallEndY" type="number" step="0.01" value="${(wall.end.y / pxPerMeter).toFixed(2)}">
        </div>
      </div>

      <div class="form-group" style="background:#1a202c;border:1px solid #4a5568;border-radius:4px;padding:8px;margin-bottom:12px;">
        <label class="form-label" style="font-weight:bold;color:#63b3ed;margin-bottom:4px;">${t('wallLengthLabel')}</label>
        <div style="display:flex;gap:6px;align-items:center;">
          <input class="form-input" id="propWallLengthM" type="number" step="0.05" min="0.05" max="200" value="${lenM}" style="flex:1;font-size:12px;font-weight:bold;">
          <span style="font-size:11px;color:#cbd5e0;">m</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:10px;color:var(--text-muted);">
          <span>${t('wallAngleLabel')} <strong>${angleDeg}°</strong></span>
          <span>${t('wallPixelLabel')} <strong>${Math.round(lenPx)} px</strong></span>
        </div>
      </div>

      <!-- Scale Calibration from Reference Wall -->
      <div class="form-group" style="background:rgba(49, 130, 206, 0.12);border:1px solid rgba(49, 130, 206, 0.35);padding:10px;border-radius:6px;margin-bottom:12px;">
        <label class="form-label" style="color:#63b3ed;font-weight:bold;margin-bottom:4px;">${t('wallCalibHeading')}</label>
        <div style="font-size:10px;color:#cbd5e0;margin-bottom:6px;">
          ${t('wallCalibDetectedLen', { meters: lenM, px: Math.round(lenPx), ratio: scale?.scaleRatio || 100 })}
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          <input class="form-input" id="propCalibRealLenM" type="number" step="0.05" min="0.1" max="100" placeholder="${t('wallCalibRealLenPlaceholder')}" value="${lenM}" style="flex:1 1 70px;min-width:60px;font-size:11px;padding:4px 6px;">
          <span style="font-size:11px;color:#cbd5e0;">m</span>
          <button type="button" class="btn btn-primary" id="btnCalibWallScale" style="font-size:11px;padding:5px 10px;background:#3182ce;justify-content:center;">
            ${t('wallCalibActionBtn')}
          </button>
        </div>
        <button type="button" class="btn" id="btnWallCalibPickOther" style="width:100%;font-size:10px;padding:4px;margin-top:6px;background:#2d3748;color:#cbd5e0;border:1px solid #4a5568;justify-content:center;">
          ${t('wallCalibPickOtherBtn')}
        </button>
        <div id="txtCalibWallFeedback" style="font-size:10px;color:#68d391;margin-top:4px;"></div>
        <div id="boxCalibScalePresets" style="margin-top:8px;padding-top:6px;border-top:1px dashed #4a5568;">
          <div style="font-size:10px;color:#a0aec0;margin-bottom:4px;">${t('wallCalibNormScaleHeading')}</div>
          <div style="display:flex;gap:4px;">
            <button type="button" class="btn btn-sm btn-rescale-wall-preset" data-scale="50" style="flex:1;font-size:10px;padding:3px;background:#2b6cb0;color:#fff;justify-content:center;" title="${t('wallCalibNormScaleTitle', { scale: 50 })}">1:50</button>
            <button type="button" class="btn btn-sm btn-rescale-wall-preset" data-scale="75" style="flex:1;font-size:10px;padding:3px;background:#2b6cb0;color:#fff;justify-content:center;" title="${t('wallCalibNormScaleTitle', { scale: 75 })}">1:75</button>
            <button type="button" class="btn btn-sm btn-rescale-wall-preset" data-scale="100" style="flex:1;font-size:10px;padding:3px;background:#2b6cb0;color:#fff;justify-content:center;" title="${t('wallCalibNormScaleTitle', { scale: 100 })}">1:100</button>
          </div>
        </div>
      </div>

      <div style="font-size:10px;font-weight:bold;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px;">${t('wallOpeningsHeading')}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:12px;">
        <button type="button" class="btn btn-primary" id="btnWallAddDoor" style="font-size:11px;padding:5px;justify-content:center;">
          ${t('fpDoorBtn')}
        </button>
        <button type="button" class="btn btn-primary" id="btnWallAddWindow" style="font-size:11px;padding:5px;justify-content:center;">
          ${t('fpWindowBtn')}
        </button>
        <button type="button" class="btn btn-primary" id="btnWallAddOpening" style="font-size:11px;padding:5px;justify-content:center;">
          ${t('fpPassageBtn')}
        </button>
        <button type="button" class="btn btn-primary" id="btnWallAddGarage" style="font-size:11px;padding:5px;justify-content:center;">
          ${t('fpGarageBtn')}
        </button>
      </div>

      <button type="button" class="btn btn-danger" id="btnWallDelete" style="width:100%;font-size:11px;padding:6px;border-color:var(--danger);color:var(--danger);justify-content:center;">
        ${t('wallDeleteBtn')}
      </button>
    `;

    container.querySelector('#propWallType')?.addEventListener('change', (e) => {
      const val = (e.target as HTMLSelectElement).value;
      wall.isExterior = val === 'exterior';
      const defM = wall.isExterior ? 0.240 : 0.115;
      wall.thickness = defM * pxPerMeter;
      this.notifyChange();
      this.canvas.render();
      this.renderWallProperties(container, wall);
    });

    container.querySelector('#propWallThickness')?.addEventListener('input', (e) => {
      const valM = parseFloat((e.target as HTMLInputElement).value);
      if (!isNaN(valM) && valM > 0) {
        wall.thickness = valM * pxPerMeter;
        this.notifyChange();
        this.canvas.render();
      }
    });

    container.querySelectorAll('.btnWallThickPreset').forEach(btn => {
      btn.addEventListener('click', () => {
        const valM = parseFloat((btn as HTMLElement).dataset.thick || '0.115');
        wall.thickness = valM * pxPerMeter;
        const input = container.querySelector('#propWallThickness') as HTMLInputElement;
        if (input) input.value = valM.toFixed(3);
        this.notifyChange();
        this.canvas.render();
      });
    });

    container.querySelector('#propWallLengthM')?.addEventListener('input', (e) => {
      const newM = parseFloat((e.target as HTMLInputElement).value);
      if (!isNaN(newM) && newM > 0 && lenPx > 0.001) {
        const dirX = (wall.end.x - wall.start.x) / lenPx;
        const dirY = (wall.end.y - wall.start.y) / lenPx;
        const newPx = newM * pxPerMeter;
        wall.end.x = wall.start.x + dirX * newPx;
        wall.end.y = wall.start.y + dirY * newPx;
        const endXInput = container.querySelector('#propWallEndX') as HTMLInputElement;
        const endYInput = container.querySelector('#propWallEndY') as HTMLInputElement;
        if (endXInput) endXInput.value = (wall.end.x / pxPerMeter).toFixed(2);
        if (endYInput) endYInput.value = (wall.end.y / pxPerMeter).toFixed(2);
        this.notifyChange();
        this.canvas.render();
      }
    });

    container.querySelector('#propWallStartX')?.addEventListener('input', (e) => {
      const valM = parseFloat((e.target as HTMLInputElement).value);
      if (!isNaN(valM)) {
        wall.start.x = valM * pxPerMeter;
        this.notifyChange();
        this.canvas.render();
      }
    });

    container.querySelector('#propWallStartY')?.addEventListener('input', (e) => {
      const valM = parseFloat((e.target as HTMLInputElement).value);
      if (!isNaN(valM)) {
        wall.start.y = valM * pxPerMeter;
        this.notifyChange();
        this.canvas.render();
      }
    });

    container.querySelector('#propWallEndX')?.addEventListener('input', (e) => {
      const valM = parseFloat((e.target as HTMLInputElement).value);
      if (!isNaN(valM)) {
        wall.end.x = valM * pxPerMeter;
        this.notifyChange();
        this.canvas.render();
      }
    });

    container.querySelector('#propWallEndY')?.addEventListener('input', (e) => {
      const valM = parseFloat((e.target as HTMLInputElement).value);
      if (!isNaN(valM)) {
        wall.end.y = valM * pxPerMeter;
        this.notifyChange();
        this.canvas.render();
      }
    });

    container.querySelector('#btnCalibWallScale')?.addEventListener('click', () => {
      const realM = parseFloat((container.querySelector('#propCalibRealLenM') as HTMLInputElement).value);
      if (!isNaN(realM) && realM > 0 && lenPx > 0 && page?.floorPlan) {
        const newPpm = lenPx / realM;
        const drawingUnits = getDrawingUnitsPerMm(this.project) || 2;
        const newRatio = Math.max(1, Math.round((1000 * drawingUnits) / newPpm));
        page.floorPlan.scale.pixelPerMeter = newPpm;
        page.floorPlan.scale.scaleRatio = newRatio;
        page.floorPlan.scale.referenceDistance = {
          pointA: { ...wall.start },
          pointB: { ...wall.end },
          realLengthMeters: realM
        };
        const fb = container.querySelector('#txtCalibWallFeedback');
        if (fb) fb.textContent = t('wallCalibFeedback', { ratio: newRatio, ppm: newPpm.toFixed(1) });
        this.notifyChange();
        this.canvas.render();
        this.renderWallProperties(container, wall);
      }
    });

    container.querySelectorAll('.btn-rescale-wall-preset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sc = Number((e.currentTarget as HTMLElement).dataset.scale);
        if (sc > 0) this.rescaleFloorPlanToScale(sc);
      });
    });

    container.querySelector('#btnWallCalibPickOther')?.addEventListener('click', () => {
      const status = document.getElementById('statusLeft');
      if (status) status.textContent = t('fpStatusPickCalibWall');
      this.canvas.startWallCalibrationPick((pickedWall) => {
        this.selectedWall = pickedWall;
        this.canvas.selectedWallId = pickedWall.id;
        this.renderRightTab();
        if (status) status.textContent = t('fpStatusWallPickedForCalib');
      });
    });

    container.querySelector('#btnWallAddDoor')?.addEventListener('click', () => {
      this.canvas.startPlacingOpening('door');
    });

    container.querySelector('#btnWallAddWindow')?.addEventListener('click', () => {
      this.canvas.startPlacingOpening('window');
    });

    container.querySelector('#btnWallAddOpening')?.addEventListener('click', () => {
      this.canvas.startPlacingOpening('opening');
    });

    container.querySelector('#btnWallAddGarage')?.addEventListener('click', () => {
      this.canvas.startPlacingOpening('garage_door');
    });

    container.querySelector('#btnWallDelete')?.addEventListener('click', () => {
      this.canvas.deleteSelected();
    });
  }

  private renderOpeningProperties(container: HTMLElement, op: WallOpening): void {
    const page = this.project.pages.find(p => p.id === this.project.activePageId);
    const scale = page?.floorPlan?.scale;
    const pxPerMeter = scale?.pixelPerMeter || 50;

    const kind = op.kind || 'door';
    const isDoor = kind === 'door';
    const isWindow = kind === 'window';
    const isOpening = kind === 'opening';
    const isGarage = kind === 'garage_door';

    const widthM = op.width
      ? (op.width < 5 ? op.width : op.width / pxPerMeter)
      : (isGarage ? 2.50 : isDoor ? 0.885 : isWindow ? 1.01 : 0.885);
    const orientation = op.orientation || 'horizontal';
    const swing = op.swingDirection || 'left_in';

    const titleIcon = isDoor ? `🚪 ${t('openingDoorName')}` : isWindow ? `🪟 ${t('openingWindowName')}` : isGarage ? `🚗 ${t('openingGarageName')}` : `🚪 ${t('openingPassageName')}`;

    container.innerHTML = `
      <div style="font-size: 11px; font-weight: bold; color: var(--text-muted); text-transform: uppercase; margin-bottom: 12px;">
        ${titleIcon} ${t('openingPropsSuffix')}
      </div>

      <div class="form-group">
        <label class="form-label">${t('openingKindLabel')}</label>
        <select class="form-input" id="propOpeningKind">
          <option value="door" ${isDoor ? 'selected' : ''}>${t('openingKindDoor')}</option>
          <option value="window" ${isWindow ? 'selected' : ''}>${t('openingKindWindow')}</option>
          <option value="opening" ${isOpening ? 'selected' : ''}>${t('openingKindOpening')}</option>
          <option value="garage_door" ${isGarage ? 'selected' : ''}>${t('openingKindGarage')}</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">${t('openingWidthLabel')}</label>
        <input class="form-input" id="propOpeningWidth" type="number" min="0.30" max="8.00" step="0.005" value="${widthM.toFixed(3)}">
        <div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap;">
          ${isDoor ? `
            <button type="button" class="btn btn-sm btnOpWidthPreset" data-w="0.750" style="flex:1;font-size:10px;padding:3px;justify-content:center;">0.75 m</button>
            <button type="button" class="btn btn-sm btnOpWidthPreset" data-w="0.885" style="flex:1;font-size:10px;padding:3px;justify-content:center;">0.885 m</button>
            <button type="button" class="btn btn-sm btnOpWidthPreset" data-w="1.010" style="flex:1;font-size:10px;padding:3px;justify-content:center;">1.01 m</button>
            <button type="button" class="btn btn-sm btnOpWidthPreset" data-w="1.250" style="flex:1;font-size:10px;padding:3px;justify-content:center;">1.25 m</button>
          ` : isWindow ? `
            <button type="button" class="btn btn-sm btnOpWidthPreset" data-w="0.750" style="flex:1;font-size:10px;padding:3px;justify-content:center;">0.75 m</button>
            <button type="button" class="btn btn-sm btnOpWidthPreset" data-w="1.010" style="flex:1;font-size:10px;padding:3px;justify-content:center;">1.01 m</button>
            <button type="button" class="btn btn-sm btnOpWidthPreset" data-w="1.250" style="flex:1;font-size:10px;padding:3px;justify-content:center;">1.25 m</button>
            <button type="button" class="btn btn-sm btnOpWidthPreset" data-w="1.500" style="flex:1;font-size:10px;padding:3px;justify-content:center;">1.50 m</button>
            <button type="button" class="btn btn-sm btnOpWidthPreset" data-w="2.000" style="flex:1;font-size:10px;padding:3px;justify-content:center;">2.00 m</button>
          ` : isGarage ? `
            <button type="button" class="btn btn-sm btnOpWidthPreset" data-w="2.500" style="flex:1;font-size:10px;padding:3px;justify-content:center;">2.50 m</button>
            <button type="button" class="btn btn-sm btnOpWidthPreset" data-w="3.000" style="flex:1;font-size:10px;padding:3px;justify-content:center;">3.00 m</button>
            <button type="button" class="btn btn-sm btnOpWidthPreset" data-w="4.000" style="flex:1;font-size:10px;padding:3px;justify-content:center;">4.00 m</button>
            <button type="button" class="btn btn-sm btnOpWidthPreset" data-w="5.000" style="flex:1;font-size:10px;padding:3px;justify-content:center;">5.00 m</button>
          ` : `
            <button type="button" class="btn btn-sm btnOpWidthPreset" data-w="0.885" style="flex:1;font-size:10px;padding:3px;justify-content:center;">0.885 m</button>
            <button type="button" class="btn btn-sm btnOpWidthPreset" data-w="1.010" style="flex:1;font-size:10px;padding:3px;justify-content:center;">1.01 m</button>
            <button type="button" class="btn btn-sm btnOpWidthPreset" data-w="1.500" style="flex:1;font-size:10px;padding:3px;justify-content:center;">1.50 m</button>
            <button type="button" class="btn btn-sm btnOpWidthPreset" data-w="2.000" style="flex:1;font-size:10px;padding:3px;justify-content:center;">2.00 m</button>
          `}
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">${t('openingOrientationLabel')}</label>
        <select class="form-input" id="propOpeningOrientation">
          <option value="horizontal" ${orientation === 'horizontal' ? 'selected' : ''}>${t('openingOrientHorizontal')}</option>
          <option value="vertical" ${orientation === 'vertical' ? 'selected' : ''}>${t('openingOrientVertical')}</option>
        </select>
      </div>

      ${isDoor ? `
        <div class="form-group">
          <label class="form-label">${t('openingSwingLabel')}</label>
          <select class="form-input" id="propOpeningSwing">
            <option value="left_in" ${swing === 'left_in' ? 'selected' : ''}>${t('openingSwingLeftIn')}</option>
            <option value="right_in" ${swing === 'right_in' ? 'selected' : ''}>${t('openingSwingRightIn')}</option>
            <option value="left_out" ${swing === 'left_out' ? 'selected' : ''}>${t('openingSwingLeftOut')}</option>
            <option value="right_out" ${swing === 'right_out' ? 'selected' : ''}>${t('openingSwingRightOut')}</option>
            <option value="none" ${swing === 'none' ? 'selected' : ''}>${t('openingSwingNone')}</option>
          </select>
        </div>
      ` : ''}

      <div class="form-group">
        <label class="form-label">${t('openingCenterPosLabel')}</label>
        <div style="display:flex;gap:6px;">
          <input class="form-input" id="propOpeningCenterX" type="number" step="0.01" value="${(op.center.x / pxPerMeter).toFixed(2)}">
          <input class="form-input" id="propOpeningCenterY" type="number" step="0.01" value="${(op.center.y / pxPerMeter).toFixed(2)}">
        </div>
      </div>

      ${op.wallId ? `
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px;">
          ${t('openingAssignedWallLabel')} <code style="color:#63b3ed;">${escapeSvg(op.wallId)}</code>
        </div>
      ` : ''}

      <button type="button" class="btn btn-danger" id="btnOpeningDelete" style="width:100%;font-size:11px;padding:6px;border-color:var(--danger);color:var(--danger);justify-content:center;">
        ${t('openingDeleteBtn')}
      </button>
    `;

    container.querySelector('#propOpeningKind')?.addEventListener('change', (e) => {
      const val = (e.target as HTMLSelectElement).value as 'door' | 'window' | 'opening' | 'garage_door';
      op.kind = val;
      if (val === 'door' && !op.swingDirection) {
        op.swingDirection = 'left_in';
      }
      if (val === 'garage_door' && op.width < 1.5 * pxPerMeter) {
        op.width = 2.50 * pxPerMeter;
      }
      this.notifyChange();
      this.canvas.render();
      this.renderOpeningProperties(container, op);
    });

    container.querySelector('#propOpeningWidth')?.addEventListener('input', (e) => {
      const valM = parseFloat((e.target as HTMLInputElement).value);
      if (!isNaN(valM) && valM > 0) {
        op.width = valM * pxPerMeter;
        this.notifyChange();
        this.canvas.render();
      }
    });

    container.querySelectorAll('.btnOpWidthPreset').forEach(btn => {
      btn.addEventListener('click', () => {
        const valM = parseFloat((btn as HTMLElement).dataset.w || '0.885');
        op.width = valM * pxPerMeter;
        const input = container.querySelector('#propOpeningWidth') as HTMLInputElement;
        if (input) input.value = valM.toFixed(3);
        this.notifyChange();
        this.canvas.render();
      });
    });

    container.querySelector('#propOpeningOrientation')?.addEventListener('change', (e) => {
      op.orientation = (e.target as HTMLSelectElement).value as 'horizontal' | 'vertical';
      this.notifyChange();
      this.canvas.render();
    });

    container.querySelector('#propOpeningSwing')?.addEventListener('change', (e) => {
      op.swingDirection = (e.target as HTMLSelectElement).value as any;
      this.notifyChange();
      this.canvas.render();
    });

    container.querySelector('#propOpeningCenterX')?.addEventListener('input', (e) => {
      const valM = parseFloat((e.target as HTMLInputElement).value);
      if (!isNaN(valM)) {
        op.center.x = valM * pxPerMeter;
        this.notifyChange();
        this.canvas.render();
      }
    });

    container.querySelector('#propOpeningCenterY')?.addEventListener('input', (e) => {
      const valM = parseFloat((e.target as HTMLInputElement).value);
      if (!isNaN(valM)) {
        op.center.y = valM * pxPerMeter;
        this.notifyChange();
        this.canvas.render();
      }
    });

    container.querySelector('#btnOpeningDelete')?.addEventListener('click', () => {
      this.canvas.deleteSelected();
    });
  }

  private renderTextProperties(container: HTMLElement, text: PageText): void {
    const units = getDrawingUnitsPerMm(this.project);
    const colorHex = (text.fontColor && /^#[0-9a-fA-F]{6}$/.test(text.fontColor)) ? text.fontColor : '#cbd5e0';

    container.innerHTML = `
      <div class="properties-panel text-properties" style="padding: 10px 4px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
          <h3 style="margin: 0; font-size: 14px; display: flex; align-items: center; gap: 6px;">
            <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; background: rgba(99, 179, 237, 0.2); color: #63b3ed; border-radius: 4px; font-weight: bold; font-size: 13px;">T</span>
            ${t('textHeading')}
          </h3>
          <button type="button" class="btn btn-sm" id="btnDeleteText" title="${t('textDelete')}" style="color: var(--danger); border-color: rgba(229,62,62,0.4); padding: 3px 8px; font-size: 11px;">
            🗑️ ${t('textDelete')}
          </button>
        </div>

        <!-- Text Content -->
        <div class="form-group" style="margin-bottom: 12px;">
          <label class="form-label" style="display: block; font-size: 11px; margin-bottom: 4px; font-weight: 500; color: var(--text-muted);">${t('textContent')}:</label>
          <textarea id="propTextContent" class="form-input" rows="4" style="width: 100%; resize: vertical; font-family: inherit; font-size: 13px; line-height: 1.4; box-sizing: border-box;">${escapeSvg(text.text || '')}</textarea>
        </div>

        <!-- Typography: Size, Bold, Italic -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
          <div class="form-group">
            <label class="form-label" style="display: block; font-size: 11px; margin-bottom: 4px; color: var(--text-muted);">${t('textFontSize')}:</label>
            <input type="number" id="propTextFontSize" class="form-input" min="3" max="100" step="0.5" value="${Number((text.fontSize || 9).toFixed(1))}" style="width: 100%; box-sizing: border-box;">
          </div>
          <div class="form-group">
            <label class="form-label" style="display: block; font-size: 11px; margin-bottom: 4px; color: var(--text-muted);">Format:</label>
            <div style="display: flex; gap: 4px;">
              <button type="button" id="propTextBold" class="btn ${text.fontWeight === 'bold' ? 'btn-primary active' : ''}" style="flex: 1; font-weight: bold; padding: 4px 6px;" title="${t('textBold')}">B</button>
              <button type="button" id="propTextItalic" class="btn ${text.fontStyle === 'italic' ? 'btn-primary active' : ''}" style="flex: 1; font-style: italic; font-family: serif; padding: 4px 6px;" title="${t('textItalic')}">I</button>
            </div>
          </div>
        </div>

        <!-- Alignment & Rotation -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
          <div class="form-group">
            <label class="form-label" style="display: block; font-size: 11px; margin-bottom: 4px; color: var(--text-muted);">${t('textAlign')}:</label>
            <div style="display: flex; gap: 2px;">
              <button type="button" class="btn btn-align ${(!text.align || text.align === 'start' || text.align === 'left') ? 'btn-primary active' : ''}" data-align="start" style="flex: 1; padding: 4px 2px;" title="${t('textAlignLeft')}">⇤</button>
              <button type="button" class="btn btn-align ${(text.align === 'center' || text.align === 'middle') ? 'btn-primary active' : ''}" data-align="center" style="flex: 1; padding: 4px 2px;" title="${t('textAlignCenter')}">↔</button>
              <button type="button" class="btn btn-align ${(text.align === 'end' || text.align === 'right') ? 'btn-primary active' : ''}" data-align="end" style="flex: 1; padding: 4px 2px;" title="${t('textAlignRight')}">⇥</button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" style="display: block; font-size: 11px; margin-bottom: 4px; color: var(--text-muted);">${t('textRotation')}:</label>
            <select id="propTextRotation" class="form-input" style="width: 100%; box-sizing: border-box;">
              <option value="0" ${(text.rotation || 0) === 0 ? 'selected' : ''}>0°</option>
              <option value="90" ${text.rotation === 90 ? 'selected' : ''}>90°</option>
              <option value="180" ${text.rotation === 180 ? 'selected' : ''}>180°</option>
              <option value="270" ${text.rotation === 270 ? 'selected' : ''}>270°</option>
            </select>
          </div>
        </div>

        <!-- Text Color -->
        <div class="form-group" style="margin-bottom: 12px;">
          <label class="form-label" style="display: block; font-size: 11px; margin-bottom: 4px; color: var(--text-muted);">${t('textFontColor')}:</label>
          <div style="display: flex; gap: 6px; align-items: center;">
            <input type="color" id="propTextColorPicker" value="${colorHex}" style="width: 32px; height: 26px; padding: 1px; border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; background: transparent;">
            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
              ${['#cbd5e0', '#63b3ed', '#0000ff', '#ffffff', '#68d391', '#f6e05e', '#f56565', '#a0aec0'].map(c => `
                <button type="button" class="btn-color-swatch" data-color="${c}" style="width: 20px; height: 20px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.25); background: ${c}; cursor: pointer; padding: 0;" title="${c}"></button>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Position X / Y -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px;">
          <div class="form-group">
            <label class="form-label" style="display: block; font-size: 11px; margin-bottom: 4px; color: var(--text-muted);">X (mm):</label>
            <input type="number" id="propTextX" class="form-input" step="any" value="${Number((text.x / units).toFixed(2))}" style="width: 100%; box-sizing: border-box;">
          </div>
          <div class="form-group">
            <label class="form-label" style="display: block; font-size: 11px; margin-bottom: 4px; color: var(--text-muted);">Y (mm):</label>
            <input type="number" id="propTextY" class="form-input" step="any" value="${Number((text.y / units).toFixed(2))}" style="width: 100%; box-sizing: border-box;">
          </div>
        </div>

        <!-- Actions: Duplicate -->
        <div style="display: flex; gap: 6px;">
          <button type="button" class="btn" id="btnDuplicateText" style="flex: 1; padding: 6px 10px; font-size: 12px;">
            📑 ${t('textDuplicate')}
          </button>
        </div>
      </div>
    `;

    // Event listeners
    container.querySelector('#propTextContent')?.addEventListener('input', (e) => {
      text.text = (e.target as HTMLTextAreaElement).value;
      this.notifyChange();
      this.canvas.render();
    });

    container.querySelector('#propTextFontSize')?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      if (!isNaN(val) && val > 0) {
        text.fontSize = val;
        this.notifyChange();
        this.canvas.render();
      }
    });

    container.querySelector('#propTextBold')?.addEventListener('click', () => {
      text.fontWeight = text.fontWeight === 'bold' ? 'normal' : 'bold';
      this.notifyChange();
      this.canvas.render();
      this.renderRightTab();
    });

    container.querySelector('#propTextItalic')?.addEventListener('click', () => {
      text.fontStyle = text.fontStyle === 'italic' ? 'normal' : 'italic';
      this.notifyChange();
      this.canvas.render();
      this.renderRightTab();
    });

    container.querySelectorAll('.btn-align').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const align = target.dataset.align as any;
        text.align = align;
        this.notifyChange();
        this.canvas.render();
        this.renderRightTab();
      });
    });

    container.querySelector('#propTextRotation')?.addEventListener('change', (e) => {
      text.rotation = parseInt((e.target as HTMLSelectElement).value, 10) as any;
      this.notifyChange();
      this.canvas.render();
    });

    container.querySelector('#propTextColorPicker')?.addEventListener('input', (e) => {
      text.fontColor = (e.target as HTMLInputElement).value;
      this.notifyChange();
      this.canvas.render();
    });

    container.querySelectorAll('.btn-color-swatch').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        const color = (e.currentTarget as HTMLElement).dataset.color;
        if (color) {
          text.fontColor = color;
          this.notifyChange();
          this.canvas.render();
          this.renderRightTab();
        }
      });
    });

    container.querySelector('#propTextX')?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      if (!isNaN(val)) {
        text.x = val * units;
        this.notifyChange();
        this.canvas.render();
      }
    });

    container.querySelector('#propTextY')?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      if (!isNaN(val)) {
        text.y = val * units;
        this.notifyChange();
        this.canvas.render();
      }
    });

    container.querySelector('#btnDuplicateText')?.addEventListener('click', () => {
      const page = this.project.pages.find(p => p.id === this.project.activePageId);
      if (page) {
        const dup: PageText = {
          ...JSON.parse(JSON.stringify(text)),
          id: 'text_' + Math.random().toString(36).substring(2, 9),
          x: text.x + 20,
          y: text.y + 20
        };
        (page.texts ??= []).push(dup);
        this.canvas.selectText(dup);
        this.notifyChange();
        this.renderRightTab();
      }
    });

    container.querySelector('#btnDeleteText')?.addEventListener('click', () => {
      this.canvas.deleteSelected();
      this.selectedText = null;
      this.renderRightTab();
    });
  }

  private renderPropertiesTab(container: HTMLElement): void {
    if (this.canvas && selectionCount(this.canvas.getElementSelection()) > 1) {
      this.renderSelectionProperties(container);
      return;
    }
    if (this.selectedWall) {
      this.renderWallProperties(container, this.selectedWall);
      return;
    }
    if (this.selectedOpening) {
      this.renderOpeningProperties(container, this.selectedOpening);
      return;
    }
    if (this.selectedText) {
      this.renderTextProperties(container, this.selectedText);
      return;
    }
    if (this.canvas?.selectedTextId) {
      const page = this.project.pages.find(p => p.id === this.project.activePageId);
      const text = page?.texts?.find(t => t.id === this.canvas.selectedTextId);
      if (text) {
        this.selectedText = text;
        this.renderTextProperties(container, text);
        return;
      }
    }
    if(this.canvas?.selectedBoxId){
      const page=this.project.pages.find(p=>p.id===this.project.activePageId),box=page?.boxes?.find(c=>c.id===this.canvas.selectedBoxId);
      if(box)renderDeviceBoxProperties(container,box,getDrawingUnitsPerMm(this.project),()=>{this.notifyChange();this.renderRightTab();},()=>this.canvas.deleteSelected());
      return;
    }
    if(this.canvas?.selectedImageId){this.renderImageProperties(container);return;}
    if (this.selectedCable) { this.renderCableProperties(container,this.selectedCable);return; }
    if (this.selectedComponent) {
      const comp = this.selectedComponent;
      const page = this.project.pages.find(p => p.id === this.project.activePageId);
      const sym = getSymbolForComponent(comp);

      const units = getDrawingUnitsPerMm(this.project);
      const bmkPreset = comp.bmkPosition?.preset || 'auto';

      const locSym = sym ? getLocalizedSymbol(sym) : undefined;
      const refTargets = this.canvas.getComponentReferenceTargets(comp);
      const jumpRefHtml = refTargets.length > 0 ? `
        <div style="background:#232d3d;border:1px solid #3e4c63;border-radius:4px;padding:8px 10px;margin-bottom:12px;">
          <div style="font-size:11px;font-weight:600;color:#63b3ed;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
            <span>🔗</span> <span>Verweis-Gegenstück (${refTargets.length}):</span>
          </div>
          ${refTargets.map((target, idx) => {
            const tPage = this.project.pages.find(p => p.id === target.pageId);
            const pageNum = tPage?.pageNumber || '?';
            return `
              <button type="button" class="btn btn-sm btn-jump-ref" data-target-index="${idx}" style="width:100%;text-align:left;font-size:11px;padding:5px 8px;margin-top:3px;background:#2b6cb0;color:#fff;border:none;border-radius:3px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;">
                <span>↗ Zu Blatt ${escapeSvg(pageNum)} springen</span>
                <span style="font-size:9px;opacity:0.8;">[Strg+Klick]</span>
              </button>
            `;
          }).join('')}
        </div>
      ` : '';

      container.innerHTML = `
        <button class="btn btn-primary" id="btnOpenFullPropModal" style="width: 100%; margin-bottom: 12px; font-weight: 600; font-size: 12px; padding: 8px 12px; display: flex; align-items: center; justify-content: center; gap: 8px; background: #3182ce; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
          <span>${t('btnOpenFullPropModal')}</span>
          <span style="font-size: 10px; opacity: 0.8; font-family: monospace;">[Enter / F2]</span>
        </button>

        ${jumpRefHtml}

        <div style="font-size: 11px; font-weight: bold; color: var(--text-muted); text-transform: uppercase; margin-bottom: 12px;">
          ${t('compPropsHeading', { name: locSym?.name || comp.symbolId })}
        </div>
        ${deviceBoxFields(comp,units)}

        <div class="form-group">
          <label class="form-label">${t('labelBmk')}</label>
          <input class="form-input" id="propBmk" value="${escapeSvg(comp.bmk)}">
        </div>

        <div class="form-group">
          <label class="form-label">${t('labelDeviceTag')}</label>
          <input class="form-input" id="propDeviceTag" value="${escapeSvg(comp.deviceTag || '')}" placeholder="${t('placeholderDeviceTag')}">
        </div>

        <div class="form-group">
          <label class="form-label">${t('labelFunctionText')}</label>
          <textarea class="form-input" id="propFunctionText" rows="2">${escapeSvg(comp.functionText || '')}</textarea>
        </div>

        <div class="form-group"><label class="form-label">${t('labelAdditionalText')}</label><textarea class="form-input" id="propAdditionalText">${escapeSvg(comp.additionalText || '')}</textarea></div>
        <fieldset style="border:1px solid var(--border-color);padding:8px;margin:0 0 12px"><legend>${t('legendFontSizes')}</legend>
          ${[['Bmk',t('labelBmk'),comp.bmkPosition?.fontSize ?? 10],['Fn',t('labelFunctionText'),comp.functionTextPosition?.fontSize ?? 8],['Additional',t('labelAdditionalText'),comp.additionalTextPosition?.fontSize ?? 8],['Tech',t('labelTechnical'),comp.technicalDataPosition?.fontSize ?? 8],['CrossRef',t('labelCrossRef'),comp.crossRefFontSize ?? 8],['Pin',t('symPins', { count: '' }),comp.pinLabelFontSize ?? Object.values(comp.pins).find(p=>p.labelPosition)?.labelPosition?.fontSize ?? sym?.pins.find(p=>p.labelPosition)?.labelPosition?.fontSize ?? 6.5]].map(([key,label,size])=>`<label class="form-label">${label}<input class="form-input" id="quick${key}FontSize" type="number" min="0.1" max="20" step="0.1" value="${Number((Number(size)/units).toFixed(4))}"></label>`).join('')}
        </fieldset>

        <div class="form-group">
          <label class="form-label">${t('labelBmkPosition')}</label>
          <select class="form-input" id="propQuickBmkPreset">
            <option value="auto" ${bmkPreset === 'auto' ? 'selected' : ''}>${t('bmkPresetAuto')}</option>
            <option value="top" ${bmkPreset === 'top' ? 'selected' : ''}>${t('bmkPresetTop')}</option>
            <option value="top_left" ${bmkPreset === 'top_left' ? 'selected' : ''}>${t('bmkPresetTopLeft')}</option>
            <option value="top_right" ${bmkPreset === 'top_right' ? 'selected' : ''}>${t('bmkPresetTopRight')}</option>
            <option value="bottom" ${bmkPreset === 'bottom' ? 'selected' : ''}>${t('bmkPresetBottom')}</option>
            <option value="bottom_left" ${bmkPreset === 'bottom_left' ? 'selected' : ''}>${t('bmkPresetBottomLeft')}</option>
            <option value="bottom_right" ${bmkPreset === 'bottom_right' ? 'selected' : ''}>${t('bmkPresetBottomRight')}</option>
            <option value="left" ${bmkPreset === 'left' ? 'selected' : ''}>${t('bmkPresetLeft')}</option>
            <option value="right" ${bmkPreset === 'right' ? 'selected' : ''}>${t('bmkPresetRight')}</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">${t('labelTechnical')}</label>
          <input class="form-input" id="propTechnical" value="${escapeSvg(comp.technicalCharacteristics || '')}">
        </div>

        ${page?.floorPlan ? `
          <div class="form-group" style="background:#1a202c;border:1px solid #4a5568;border-radius:4px;padding:8px;margin-bottom:12px;">
            <div style="font-size:10px;font-weight:bold;color:#63b3ed;text-transform:uppercase;margin-bottom:6px;">${t('fpCompDisplayHeading')}</div>
            <label style="display:flex;align-items:center;gap:8px;font-size:11px;cursor:pointer;margin-bottom:6px;color:#cbd5e0;">
              <input type="checkbox" id="propCompShowLabel" ${comp.showLabels ? 'checked' : ''} style="accent-color:#3182ce;" />
              <span>${t('fpCompShowBmkLabel')}</span>
            </label>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;">
              <span style="font-size:10px;color:#a0aec0;">${t('fpCompScaleLabel')}</span>
              <select id="propCompScale" class="form-input" style="font-size:10px;padding:2px 4px;width:120px;flex:1;min-width:100px;">
                <option value="inherit" ${!comp.scale ? 'selected' : ''}>${t('fpCompScaleInherit')}</option>
                <option value="0.35" ${comp.scale === 0.35 ? 'selected' : ''}>${t('fpCompScale35')}</option>
                <option value="0.45" ${comp.scale === 0.45 ? 'selected' : ''}>${t('fpCompScale45')}</option>
                <option value="0.6" ${comp.scale === 0.6 ? 'selected' : ''}>${t('fpCompScale60')}</option>
                <option value="0.75" ${comp.scale === 0.75 ? 'selected' : ''}>${t('fpCompScale75')}</option>
                <option value="1.0" ${comp.scale === 1.0 ? 'selected' : ''}>${t('fpCompScale100')}</option>
              </select>
            </div>
          </div>
        ` : ''}

        <div class="form-group" style="background: rgba(99, 179, 237, 0.08); padding: 8px; border-radius: 4px; border: 1px dashed var(--accent);">
          <label class="form-label" style="color: var(--accent-bright);">${t('labelAssignPart')}</label>
          <select class="form-input" id="propAssignPartSelect">
            <option value="">${t('selectPartPlaceholder')}</option>
            ${MANUFACTURER_PARTS.map(p => `
              <option value="${p.id}" ${comp.articleNumber === p.articleNumber ? 'selected' : ''}>
                ${p.manufacturer} - ${p.articleNumber} (${p.name})
              </option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">${t('labelArticleNumber')}</label>
          <input class="form-input" id="propArticle" value="${comp.articleNumber || ''}">
        </div>

        <div class="form-group">
          <label class="form-label">${t('labelManufacturer')}</label>
          <input class="form-input" id="propManufacturer" value="${comp.manufacturer || ''}">
        </div>

        <div class="form-group">
          <label class="form-label">${t('labelStructure')}</label>
          <div style="display: flex; gap: 6px;">
            <input class="form-input" id="propHigherLevel" placeholder="=Anlage" value="${comp.higherLevelFunction || ''}">
            <input class="form-input" id="propLocation" placeholder="+Ort" value="${comp.mountingLocation || ''}">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">${t('labelCrossRef')}</label>
          <div style="padding: 8px; background-color: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px; font-family: monospace; font-size: 11px; color: var(--warning);">
            ${referenceMarkup(this.project, comp) || t('noCrossRefs')}
          </div>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 14px;">
          <button class="btn btn-primary" id="btnPropApply" style="flex: 1; font-weight: 600; padding: 7px 10px; background: #38a169;">
            ${t('btnApplyOk')}
          </button>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 8px;">
          <button class="btn" id="btnPropRotate" style="flex: 1;">${t('btnRotate90')}</button>
          <button class="btn" id="btnPropDelete" style="flex: 1; border-color: var(--danger); color: var(--danger);">${t('btnDelete')}</button>
        </div>
      `;

      // Form bindings
      container.querySelectorAll('.btn-jump-ref').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = Number((e.currentTarget as HTMLElement).dataset.targetIndex ?? 0);
          this.canvas.followReference(comp, idx);
        });
      });

      document.getElementById('btnPropApply')?.addEventListener('click', () => {
        if(!collectDeviceBoxFields(container,comp,units))return;
        const isInterruption = sym && isInterruptionSymbol(sym);
        const bmkInput = document.getElementById('propBmk') as HTMLInputElement;
        if (bmkInput) {
          comp.bmk = bmkInput.value.trim();
          if (isInterruption) comp.functionText = comp.bmk;
        }

        const devInput = document.getElementById('propDeviceTag') as HTMLInputElement;
        if (devInput) setComponentLabelText(comp, 'deviceTag', devInput.value.trim());

        const fnInput = document.getElementById('propFunctionText') as HTMLTextAreaElement;
        if (fnInput) {
          setComponentLabelText(comp, 'functionText', fnInput.value.trim());
          if (isInterruption && (!bmkInput || !bmkInput.value.trim())) comp.bmk = comp.functionText;
        }

        const additionalInput = document.getElementById('propAdditionalText') as HTMLInputElement;
        if(additionalInput)setComponentLabelText(comp,'additionalText',additionalInput.value.trim());

        const techInput = document.getElementById('propTechnical') as HTMLInputElement;
        if (techInput) setComponentLabelText(comp, 'technicalCharacteristics', techInput.value.trim());

        const artInput = document.getElementById('propArticle') as HTMLInputElement;
        if (artInput) comp.articleNumber = artInput.value.trim();

        const mfrInput = document.getElementById('propManufacturer') as HTMLInputElement;
        if (mfrInput) comp.manufacturer = mfrInput.value.trim();

        const hlInput = document.getElementById('propHigherLevel') as HTMLInputElement;
        if (hlInput) comp.higherLevelFunction = hlInput.value.trim();

        const locInput = document.getElementById('propLocation') as HTMLInputElement;
        if (locInput) comp.mountingLocation = locInput.value.trim();

        this.notifyChange();
        this.updateFloatingSelectionBar();

        const applyBtn = document.getElementById('btnPropApply');
        if (applyBtn) {
          const orig = applyBtn.innerHTML;
          applyBtn.innerHTML = t('appliedSuccess');
          setTimeout(() => { applyBtn.innerHTML = orig; }, 1200);
        }
      });

      document.getElementById('btnOpenFullPropModal')?.addEventListener('click', () => {
        this.openPropertiesDialog(comp);
      });

      document.getElementById('propBmk')?.addEventListener('input', (e) => {
        comp.bmk = (e.target as HTMLInputElement).value;
        if (sym && isInterruptionSymbol(sym)) {
          comp.functionText = comp.bmk;
          const fnInput = document.getElementById('propFunctionText') as HTMLTextAreaElement;
          if (fnInput) fnInput.value = comp.bmk;
        }
        this.notifyChange();
      });
      for (const [key,property] of [['Bmk','bmkPosition'],['Fn','functionTextPosition'],['Additional','additionalTextPosition'],['Tech','technicalDataPosition']] as const) {
        document.getElementById(`quick${key}FontSize`)?.addEventListener('input', e => {
          const input = e.target as HTMLInputElement;
          if (input.value && input.validity.valid && Number(input.value)>0) { comp[property] = {...comp[property],fontSize:Number(input.value)*units}; this.notifyChange(); }
        });
      }
      for (const [key,property] of [['CrossRef','crossRefFontSize'],['Pin','pinLabelFontSize']] as const) {
        document.getElementById(`quick${key}FontSize`)?.addEventListener('input', e => {
          const input = e.target as HTMLInputElement;
          if (input.value && input.validity.valid && Number(input.value)>0) { comp[property]=Number(input.value)*units;this.notifyChange(); }
        });
      }
      document.getElementById('propDeviceTag')?.addEventListener('input', (e) => {
        setComponentLabelText(comp, 'deviceTag', (e.target as HTMLInputElement).value);
        this.notifyChange();
      });
      document.getElementById('propQuickBmkPreset')?.addEventListener('change', (e) => {
        const preset = (e.target as HTMLSelectElement).value as any;
        if (!comp.bmkPosition) {
          comp.bmkPosition = { preset: 'top', visible: true };
        }
        comp.bmkPosition.preset = preset;
        if (preset === 'auto') comp.bmkPosition.alignment = 'end';
        this.notifyChange();
      });
      document.getElementById('propAssignPartSelect')?.addEventListener('change', (e) => {
        const partId = (e.target as HTMLSelectElement).value;
        const part = MANUFACTURER_PARTS.find(p => p.id === partId);
        if (part) {
          comp.manufacturer = part.manufacturer;
          comp.articleNumber = part.articleNumber;
          setComponentLabelText(comp, 'technicalCharacteristics', part.technicalData);
          setComponentLabelText(comp, 'functionText', part.name);
          this.notifyChange();
        }
      });
      document.getElementById('propAdditionalText')?.addEventListener('input', (e) => {
        setComponentLabelText(comp, 'additionalText', (e.target as HTMLInputElement).value);this.notifyChange();
      });
      document.getElementById('propFunctionText')?.addEventListener('input', (e) => {
        setComponentLabelText(comp, 'functionText', (e.target as HTMLTextAreaElement).value);
        if (sym && isInterruptionSymbol(sym)) {
          comp.bmk = comp.functionText || '';
          const bmkInput = document.getElementById('propBmk') as HTMLInputElement;
          if (bmkInput) bmkInput.value = comp.bmk;
        }
        this.notifyChange();
      });
      document.getElementById('propTechnical')?.addEventListener('input', (e) => {
        setComponentLabelText(comp, 'technicalCharacteristics', (e.target as HTMLInputElement).value);
        this.notifyChange();
      });
      document.getElementById('propArticle')?.addEventListener('input', (e) => {
        comp.articleNumber = (e.target as HTMLInputElement).value;
        this.notifyChange();
      });
      document.getElementById('propManufacturer')?.addEventListener('input', (e) => {
        comp.manufacturer = (e.target as HTMLInputElement).value;
        this.notifyChange();
      });
      document.getElementById('propHigherLevel')?.addEventListener('input', (e) => {
        comp.higherLevelFunction = (e.target as HTMLInputElement).value;
        this.notifyChange();
      });
      document.getElementById('propLocation')?.addEventListener('input', (e) => {
        comp.mountingLocation = (e.target as HTMLInputElement).value;
        this.notifyChange();
      });

      document.getElementById('propCompShowLabel')?.addEventListener('change', (e) => {
        comp.showLabels = (e.target as HTMLInputElement).checked;
        this.notifyChange();
        this.canvas.render();
      });
      document.getElementById('propCompScale')?.addEventListener('change', (e) => {
        const val = (e.target as HTMLSelectElement).value;
        if (val === 'inherit') {
          delete comp.scale;
        } else {
          comp.scale = parseFloat(val);
        }
        this.notifyChange();
        this.canvas.render();
      });

      document.getElementById('btnPropRotate')?.addEventListener('click', () => this.canvas.rotateSelected());
      document.getElementById('btnPropDelete')?.addEventListener('click', () => this.canvas.deleteSelected());

    } else if (this.selectedWire) {
      const wire = this.selectedWire;

      container.innerHTML = `
        <div style="font-size: 11px; font-weight: bold; color: var(--text-muted); text-transform: uppercase; margin-bottom: 12px;">
          ${t('wirePropsHeading')}
        </div>

        <div class="form-group">
          <label class="form-label">${t('wirePotential')}</label>
          <input class="form-input" id="propWirePotential" value="${wire.potential}">
        </div>

        <div class="form-group">
          <label class="form-label">${t('wireSection')}</label>
          <input class="form-input" id="propWireSection" value="${wire.crossSection || '1.5mm²'}">
        </div>

        <div class="form-group">
          <label class="form-label">${t('wireColor')}</label>
          <select class="form-input" id="propWireColor">
            <option value="BK" ${wire.color === 'BK' ? 'selected' : ''}>${t('wireColorBk')}</option>
            <option value="BU" ${wire.color === 'BU' ? 'selected' : ''}>${t('wireColorBu')}</option>
            <option value="GNYE" ${wire.color === 'GNYE' ? 'selected' : ''}>${t('wireColorGnye')}</option>
            <option value="RD" ${wire.color === 'RD' ? 'selected' : ''}>${t('wireColorRd')}</option>
            <option value="DBU" ${wire.color === 'DBU' ? 'selected' : ''}>${t('wireColorDbu')}</option>
          </select>
        </div>

        <button class="btn" id="btnDeleteWire" style="width: 100%; margin-top: 16px; border-color: var(--danger); color: var(--danger);">
          ${t('wireDelete')}
        </button>
      `;

      document.getElementById('propWirePotential')?.addEventListener('input', (e) => {
        wire.potential = (e.target as HTMLInputElement).value;
        this.notifyChange();
      });
      document.getElementById('propWireSection')?.addEventListener('input', (e) => {
        wire.crossSection = (e.target as HTMLInputElement).value;
        this.notifyChange();
      });
      document.getElementById('propWireColor')?.addEventListener('change', (e) => {
        wire.color = (e.target as HTMLSelectElement).value;
        this.notifyChange();
      });
      document.getElementById('btnDeleteWire')?.addEventListener('click', () => this.canvas.deleteSelected());

    } else {
      // Project / Page properties
      const activePage = this.project.pages.find(p => p.id === this.project.activePageId);
      const activeIdx = this.project.pages.findIndex(p => p.id === this.project.activePageId);
      const canMoveUp = activeIdx > 0;
      const canMoveDown = activeIdx >= 0 && activeIdx < this.project.pages.length - 1;
      const canDelete = this.project.pages.length > 1;

      container.innerHTML = `
        <div style="font-size: 11px; font-weight: bold; color: var(--text-muted); text-transform: uppercase; margin-bottom: 12px;">
          ${t('pageProperties', { number: activePage?.pageNumber || '1' })}
        </div>
        ${activePage?.pageType==='cover'?`<button class="btn btn-primary" id="btnEditCoverPage" style="width:100%;margin-bottom:12px">${t('btnEditCoverPage')}</button>`:''}
        ${activePage?.pageType==='installation' && activePage.floorPlan ? `
          <div style="background:#232731;border:1px solid #4a5568;border-radius:6px;padding:10px;margin-bottom:12px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:8px;">
              <div style="font-size:11px;font-weight:bold;color:#63b3ed;text-transform:uppercase;min-width:0;overflow:hidden;text-overflow:ellipsis;">
                ${t('fpPanelHeading')}
              </div>
              <span style="font-size:10px;color:#a0aec0;font-weight:bold;flex-shrink:0;">1 : ${activePage.floorPlan.scale?.scaleRatio || 100}</span>
            </div>

            <!-- Floor plan edit mode toggle button -->
            <button type="button" class="btn" id="btnToggleFloorPlanEditCard" style="width:100%;margin-bottom:8px;font-size:11px;padding:6px;font-weight:bold;justify-content:center;background:${this.canvas?.floorPlanEditMode ? '#2b6cb0' : '#2d3748'};color:#ffffff;border:1px solid ${this.canvas?.floorPlanEditMode ? '#63b3ed' : '#4a5568'};">
              ${this.canvas?.floorPlanEditMode ? t('fpEditModeActive') : t('fpEditModeEnable')}
            </button>

            <!-- Wall Calibration Pick Button -->
            <button type="button" class="btn" id="btnPickCalibWall" style="width:100%;margin-bottom:8px;font-size:11px;padding:6px;background:#2b6cb0;color:#fff;border:1px solid #63b3ed;display:flex;align-items:center;justify-content:center;gap:6px;font-weight:600;">
              <span>${t('fpPickWallCalibBtn')}</span>
            </button>

            <!-- Hide symbol labels toggle -->
            <div style="margin-bottom:8px;">
              <label style="display:flex;align-items:center;gap:8px;font-size:11px;cursor:pointer;color:#cbd5e0;">
                <input type="checkbox" id="chkHideSymbolLabels" ${activePage.floorPlan.hideSymbolLabels !== false ? 'checked' : ''} style="accent-color:#3182ce;" />
                <span>${t('fpHideSymbolLabels')}</span>
              </label>
            </div>

            <!-- Symbol Scale setting -->
            <div style="margin-bottom:10px;background:#1a202c;border:1px solid #4a5568;border-radius:4px;padding:6px 8px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                <span style="font-size:10px;color:#a0aec0;">${t('fpSymbolSizeLabel')}</span>
                <span style="font-size:10px;color:#68d391;">${activePage.floorPlan.symbolScale ? `${Math.round(activePage.floorPlan.symbolScale * 100)}%` : 'Auto'}</span>
              </div>
              <select id="selFloorPlanSymbolScale" class="form-input" style="font-size:11px;padding:3px 6px;width:100%;">
                <option value="auto" ${!activePage.floorPlan.symbolScale ? 'selected' : ''}>${t('fpSymbolScaleAuto')}</option>
                <option value="0.35" ${activePage.floorPlan.symbolScale === 0.35 ? 'selected' : ''}>${t('fpSymbolScale35')}</option>
                <option value="0.45" ${activePage.floorPlan.symbolScale === 0.45 ? 'selected' : ''}>${t('fpSymbolScale45')}</option>
                <option value="0.60" ${activePage.floorPlan.symbolScale === 0.60 ? 'selected' : ''}>${t('fpSymbolScale60')}</option>
                <option value="0.75" ${activePage.floorPlan.symbolScale === 0.75 ? 'selected' : ''}>${t('fpSymbolScale75')}</option>
                <option value="1.0" ${activePage.floorPlan.symbolScale === 1.0 ? 'selected' : ''}>${t('fpSymbolScale100')}</option>
              </select>
            </div>

            ${activePage.floorPlan.backgroundImage ? `
              <div style="margin-bottom:8px;">
                <label style="display:flex;align-items:center;gap:8px;font-size:11px;cursor:pointer;">
                  <input type="checkbox" id="chkShowBlueprintBg" ${activePage.floorPlan.backgroundImage.visible ? 'checked' : ''} style="accent-color:#3182ce;" />
                  <span>${t('fpBlueprintBgLabel')}</span>
                </label>
              </div>
              <div style="margin-bottom:10px;">
                <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-bottom:4px;">
                  <span>${t('fpOpacityLabel')}</span>
                  <span id="txtBlueprintOpacity">${Math.round(activePage.floorPlan.backgroundImage.opacity * 100)}%</span>
                </div>
                <input type="range" id="rngBlueprintOpacity" min="0" max="100" value="${Math.round(activePage.floorPlan.backgroundImage.opacity * 100)}" style="width:100%;accent-color:#3182ce;" />
              </div>
            ` : ''}

            <!-- Quick Add Elements -->
            <div style="font-size:10px;font-weight:bold;color:#a0aec0;text-transform:uppercase;margin-bottom:4px;">${t('fpInsertElementsHeading')}</div>
            <div class="sidebar-btn-grid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(105px, 1fr));gap:6px;margin-bottom:8px;">
              <button type="button" class="btn" id="btnDrawWall" style="font-size:11px;padding:5px 6px;background:#2b6cb0;color:#fff;border:none;justify-content:center;">
                ${t('fpDrawWallBtn')}
              </button>
              <button type="button" class="btn" id="btnAddDoorQuick" style="font-size:11px;padding:5px 6px;justify-content:center;">
                ${t('fpDoorBtn')}
              </button>
              <button type="button" class="btn" id="btnAddWindowQuick" style="font-size:11px;padding:5px 6px;justify-content:center;">
                ${t('fpWindowBtn')}
              </button>
              <button type="button" class="btn" id="btnAddOpeningQuick" style="font-size:11px;padding:5px 6px;justify-content:center;">
                ${t('fpPassageBtn')}
              </button>
              <button type="button" class="btn" id="btnAddGarageQuick" style="font-size:11px;padding:5px 6px;justify-content:center;">
                ${t('fpGarageBtn')}
              </button>
              <button type="button" class="btn" id="btnReimportFloorPlan" style="font-size:11px;padding:5px 6px;justify-content:center;">
                ${t('fpReimportBtn')}
              </button>
              <button type="button" class="btn" id="btnExportFloorPlanRight" style="font-size:11px;padding:5px 6px;justify-content:center;" title="${t('fpExportPageTitle')}">
                ${t('fpExportPageBtn')}
              </button>
              <button type="button" class="btn" id="btnImportFloorPlanRight" style="font-size:11px;padding:5px 6px;justify-content:center;" title="${t('fpImportPageTitle')}">
                ${t('fpImportPageBtn')}
              </button>
            </div>

            <!-- Scale setting with A3 Norm presets -->
            <div style="background:#1a202c;border:1px solid #4a5568;border-radius:4px;padding:6px 8px;margin-top:6px;">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;flex-wrap:wrap;margin-bottom:4px;">
                <span style="font-size:10px;color:#a0aec0;">${t('fpTargetScaleA3Label')}</span>
                <span style="font-size:10px;color:#68d391;">1 : ${activePage.floorPlan.scale?.scaleRatio || 100} (${(activePage.floorPlan.scale?.pixelPerMeter || 50).toFixed(1)} px/m)</span>
              </div>
              <div style="display:flex;gap:4px;align-items:center;margin-bottom:6px;">
                <button type="button" class="btn btn-sm btn-scale-preset" data-scale="50" style="flex:1;font-size:10px;padding:3px 4px;justify-content:center;${activePage.floorPlan.scale?.scaleRatio === 50 ? 'background:#3182ce;color:#fff;' : 'background:#2d3748;color:#cbd5e0;'}" title="${t('fpScalePreset50Title')}">1:50</button>
                <button type="button" class="btn btn-sm btn-scale-preset" data-scale="75" style="flex:1;font-size:10px;padding:3px 4px;justify-content:center;${activePage.floorPlan.scale?.scaleRatio === 75 ? 'background:#3182ce;color:#fff;' : 'background:#2d3748;color:#cbd5e0;'}" title="${t('fpScalePreset75Title')}">1:75</button>
                <button type="button" class="btn btn-sm btn-scale-preset" data-scale="100" style="flex:1;font-size:10px;padding:3px 4px;justify-content:center;${activePage.floorPlan.scale?.scaleRatio === 100 ? 'background:#3182ce;color:#fff;' : 'background:#2d3748;color:#cbd5e0;'}" title="${t('fpScalePreset100Title')}">1:100</button>
              </div>
              <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">
                <span style="font-size:11px;color:#cbd5e0;">1 :</span>
                <input type="number" id="inpFloorPlanScaleRatio" class="form-input" min="1" max="1000" value="${activePage.floorPlan.scale?.scaleRatio || 100}" style="font-size:11px;padding:2px 6px;flex:1 1 55px;min-width:50px;" />
                <button type="button" class="btn btn-sm btn-primary" id="btnApplyFloorPlanScale" style="font-size:10px;padding:3px 8px;background:#3182ce;justify-content:center;" title="${t('fpRescaleBtnTitle')}">${t('fpRescaleBtn')}</button>
              </div>
            </div>

            <!-- Symbol Legend Settings & Live Summary -->
            ${(() => {
              const isEn = getUiLanguage() === 'en';
              const leg = activePage.floorPlan.legend ?? {};
              const legVisible = leg.visible !== false;
              const legCounts = leg.showCounts !== false;
              const legPos = leg.position ?? 'bottom-right';
              const legCols = String(leg.columns ?? 'auto');
              const legScale = String(leg.scale ?? 1);
              const legendItems = collectFloorPlanLegendItems(activePage.components, this.project, getUiLanguage());
              return `
                <div style="background:#1a202c;border:1px solid #4a5568;border-radius:4px;padding:8px;margin-top:8px;">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                    <span style="font-size:10px;font-weight:bold;color:#63b3ed;text-transform:uppercase;">📋 ${isEn ? 'Symbol Legend' : 'Symbollegende'}</span>
                    <span style="font-size:10px;color:#68d391;font-family:monospace;">${legendItems.length} ${isEn ? 'types' : 'Typen'}</span>
                  </div>
                  <label style="display:flex;align-items:center;gap:8px;font-size:11px;cursor:pointer;color:#cbd5e0;margin-bottom:5px;">
                    <input type="checkbox" id="chkFloorPlanLegendVisible" ${legVisible ? 'checked' : ''} style="accent-color:#3182ce;" />
                    <span>${isEn ? 'Show symbol legend on sheet' : 'Legende auf Grundriss-Blatt anzeigen'}</span>
                  </label>
                  <label style="display:flex;align-items:center;gap:8px;font-size:11px;cursor:pointer;color:#cbd5e0;margin-bottom:6px;">
                    <input type="checkbox" id="chkFloorPlanLegendCounts" ${legCounts ? 'checked' : ''} style="accent-color:#3182ce;" />
                    <span>${isEn ? 'Show symbol counts (× N)' : 'Stückzahl je Symbol anzeigen (× N)'}</span>
                  </label>
                  <div style="display:grid;grid-template-columns:1.2fr 0.9fr 0.8fr;gap:5px;margin-bottom:6px;">
                    <div>
                      <label style="display:block;font-size:9px;color:#a0aec0;margin-bottom:2px;">${isEn ? 'Position' : 'Position'}</label>
                      <select id="selFloorPlanLegendPos" class="form-input" style="font-size:10px;padding:3px 4px;width:100%;">
                        <option value="bottom-right" ${legPos === 'bottom-right' ? 'selected' : ''}>${isEn ? 'Bottom Right' : 'Unten rechts'}</option>
                        <option value="bottom-left" ${legPos === 'bottom-left' ? 'selected' : ''}>${isEn ? 'Bottom Left' : 'Unten links'}</option>
                        <option value="top-right" ${legPos === 'top-right' ? 'selected' : ''}>${isEn ? 'Top Right' : 'Oben rechts'}</option>
                        <option value="top-left" ${legPos === 'top-left' ? 'selected' : ''}>${isEn ? 'Top Left' : 'Oben links'}</option>
                        <option value="custom" ${legPos === 'custom' ? 'selected' : ''}>${isEn ? 'Custom (Drag)' : 'Frei (Verschoben)'}</option>
                      </select>
                    </div>
                    <div>
                      <label style="display:block;font-size:9px;color:#a0aec0;margin-bottom:2px;">${isEn ? 'Columns' : 'Spalten'}</label>
                      <select id="selFloorPlanLegendCols" class="form-input" style="font-size:10px;padding:3px 4px;width:100%;">
                        <option value="auto" ${legCols === 'auto' ? 'selected' : ''}>Auto</option>
                        <option value="1" ${legCols === '1' ? 'selected' : ''}>1</option>
                        <option value="2" ${legCols === '2' ? 'selected' : ''}>2</option>
                        <option value="3" ${legCols === '3' ? 'selected' : ''}>3</option>
                      </select>
                    </div>
                    <div>
                      <label style="display:block;font-size:9px;color:#a0aec0;margin-bottom:2px;">${isEn ? 'Scale' : 'Größe'}</label>
                      <select id="selFloorPlanLegendScale" class="form-input" style="font-size:10px;padding:3px 4px;width:100%;">
                        <option value="0.8" ${legScale === '0.8' ? 'selected' : ''}>80%</option>
                        <option value="1" ${legScale === '1' ? 'selected' : ''}>100%</option>
                        <option value="1.2" ${legScale === '1.2' ? 'selected' : ''}>120%</option>
                      </select>
                    </div>
                  </div>
                  ${legendItems.length > 0 ? `
                    <div style="max-height:110px;overflow-y:auto;border-top:1px solid #2d3748;padding-top:5px;display:flex;flex-direction:column;gap:3px;">
                      ${legendItems.map(item => `
                        <div style="display:flex;align-items:center;justify-content:space-between;font-size:10px;color:#cbd5e0;gap:6px;">
                          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeSvg(item.name)}</span>
                          <span style="font-family:monospace;color:#63b3ed;font-weight:bold;flex-shrink:0;">${item.count}×</span>
                        </div>
                      `).join('')}
                    </div>
                  ` : `<div style="font-size:10px;color:#718096;">${isEn ? 'Place symbols on the floor plan to populate the legend automatically.' : 'Platzieren Sie Symbole im Grundriss, um die Legende automatisch zu füllen.'}</div>`}
                </div>
              `;
            })()}
          </div>
        ` : ''}

        <div class="form-group">
          <label class="form-label">${t('fieldSheetNumber')}</label>
          <input class="form-input" id="pageNumberInput" value="${escapeSvg(activePage?.pageNumber || '')}">
        </div>

        <div class="form-group">
          <label class="form-label">${t('fieldPageTitle')}</label>
          <input class="form-input" id="pageTitleInput" value="${activePage?.title || ''}">
        </div>

        <div class="form-group">
          <label class="form-label">${t('fieldHigherLevel')}</label>
          <input class="form-input" id="pageHigherLevelInput" value="${activePage?.higherLevel || '=A1'}">
        </div>

        <div class="form-group">
          <label class="form-label">${t('fieldLocation')}</label>
          <input class="form-input" id="pageLocationInput" value="${activePage?.location || '+S1'}">
        </div>

        <div style="display: flex; gap: 6px; margin: 12px 0 16px 0; flex-wrap: wrap;">
          <button class="btn" id="btnMovePageUp" style="flex: 1 1 70px; min-width: 0; justify-content: center;" ${canMoveUp ? '' : 'disabled'} title="${t('movePageUp')}">${t('btnMoveUp')}</button>
          <button class="btn" id="btnMovePageDown" style="flex: 1 1 70px; min-width: 0; justify-content: center;" ${canMoveDown ? '' : 'disabled'} title="${t('movePageDown')}">${t('btnMoveDown')}</button>
          <button class="btn" id="btnDeleteCurrentPage" style="flex: 1 1 70px; min-width: 0; justify-content: center; border-color: var(--danger); color: var(--danger);" ${canDelete ? '' : 'disabled'} title="${t('deletePage')}">🗑️ ${t('menuDelete')}</button>
        </div>

        <div style="margin-top: 20px; font-size: 11px; font-weight: bold; color: var(--text-muted); text-transform: uppercase; margin-bottom: 12px;">
          ${t('projectPropertiesHeading')}
        </div>

        <div class="form-group">
          <label class="form-label">${t('fieldProjectName')}</label>
          <input class="form-input" id="projNameInput" value="${this.project.name}">
        </div>

        <div class="form-group">
          <label class="form-label">${t('fieldCompany')}</label>
          <input class="form-input" id="projCompanyInput" value="${this.project.company}">
        </div>

        <div class="form-group">
          <label class="form-label">${t('fieldAuthor')}</label>
          <input class="form-input" id="projAuthorInput" value="${this.project.author}">
        </div>
      `;

      document.getElementById('btnEditCoverPage')?.addEventListener('click',()=>{if(activePage)this.openCoverPage(activePage);});
      document.getElementById('btnToggleFloorPlanEditCard')?.addEventListener('click', () => {
        this.canvas.setFloorPlanEditMode(!this.canvas.floorPlanEditMode);
        this.updateFloorPlanEditButtonState();
        this.renderRightTab();
      });
      document.getElementById('btnPickCalibWall')?.addEventListener('click', () => {
        const status = document.getElementById('statusLeft');
        if (status) status.textContent = t('fpStatusPickCalibWall');
        this.canvas.startWallCalibrationPick((wall) => {
          this.selectedWall = wall;
          this.selectedComponent = null;
          this.selectedWire = null;
          this.selectedCable = null;
          this.selectedOpening = null;
          this.canvas.selectedWallId = wall.id;
          this.renderRightTab();
          if (status) status.textContent = t('fpStatusWallPickedForCalib');
          setTimeout(() => {
            const input = document.getElementById('propCalibRealLenM') as HTMLInputElement;
            if (input) {
              input.focus();
              input.select();
            }
          }, 60);
        });
      });
      document.getElementById('chkHideSymbolLabels')?.addEventListener('change', (e) => {
        if (activePage?.floorPlan) {
          activePage.floorPlan.hideSymbolLabels = (e.target as HTMLInputElement).checked;
          this.canvas.render();
          this.notifyChange();
        }
      });
      document.getElementById('selFloorPlanSymbolScale')?.addEventListener('change', (e) => {
        if (activePage?.floorPlan) {
          const val = (e.target as HTMLSelectElement).value;
          if (val === 'auto') {
            delete activePage.floorPlan.symbolScale;
          } else {
            activePage.floorPlan.symbolScale = parseFloat(val);
          }
          this.canvas.render();
          this.notifyChange();
          this.renderRightTab();
        }
      });
      document.getElementById('chkShowBlueprintBg')?.addEventListener('change', (e) => {
        if (activePage?.floorPlan?.backgroundImage) {
          activePage.floorPlan.backgroundImage.visible = (e.target as HTMLInputElement).checked;
          this.canvas.render();
          this.notifyChange();
        }
      });
      document.getElementById('rngBlueprintOpacity')?.addEventListener('input', (e) => {
        if (activePage?.floorPlan?.backgroundImage) {
          const val = Number((e.target as HTMLInputElement).value);
          activePage.floorPlan.backgroundImage.opacity = val / 100;
          const txt = document.getElementById('txtBlueprintOpacity');
          if (txt) txt.textContent = `${val}%`;
          this.canvas.render();
          this.notifyChange();
        }
      });
      document.getElementById('btnDrawWall')?.addEventListener('click', () => {
        this.canvas.setMode('draw_wall');
        const status = document.getElementById('statusLeft');
        if (status) status.textContent = t('fpStatusDrawWallPrompt');
      });
      document.getElementById('btnAddDoorQuick')?.addEventListener('click', () => {
        this.canvas.startPlacingOpening('door');
        const status = document.getElementById('statusLeft');
        if (status) status.textContent = t('fpStatusPlaceDoorPrompt');
      });
      document.getElementById('btnAddWindowQuick')?.addEventListener('click', () => {
        this.canvas.startPlacingOpening('window');
        const status = document.getElementById('statusLeft');
        if (status) status.textContent = t('fpStatusPlaceWindowPrompt');
      });
      document.getElementById('btnAddOpeningQuick')?.addEventListener('click', () => {
        this.canvas.startPlacingOpening('opening');
        const status = document.getElementById('statusLeft');
        if (status) status.textContent = t('fpStatusPlaceOpeningPrompt');
      });
      document.getElementById('btnAddGarageQuick')?.addEventListener('click', () => {
        this.canvas.startPlacingOpening('garage_door');
        const status = document.getElementById('statusLeft');
        if (status) status.textContent = t('fpStatusPlaceGaragePrompt');
      });
      document.getElementById('btnApplyFloorPlanScale')?.addEventListener('click', () => {
        const inp = document.getElementById('inpFloorPlanScaleRatio') as HTMLInputElement;
        const newRatio = parseInt(inp?.value || '100', 10);
        if (newRatio > 0 && activePage?.floorPlan) {
          this.rescaleFloorPlanToScale(newRatio);
        }
      });
      container.querySelectorAll('.btn-scale-preset').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const sc = Number((e.currentTarget as HTMLElement).dataset.scale);
          if (sc > 0) this.rescaleFloorPlanToScale(sc);
        });
      });
      document.getElementById('btnReimportFloorPlan')?.addEventListener('click', () => {
        this.openFloorPlanImport();
      });
      document.getElementById('btnExportFloorPlanRight')?.addEventListener('click', () => {
        this.exportFloorPlanPage(activePage);
      });
      document.getElementById('btnImportFloorPlanRight')?.addEventListener('click', () => {
        this.triggerImportFloorPlanPage();
      });
      document.getElementById('chkFloorPlanLegendVisible')?.addEventListener('change', (e) => {
        if (activePage?.floorPlan) {
          activePage.floorPlan.legend = {
            ...activePage.floorPlan.legend,
            visible: (e.target as HTMLInputElement).checked
          };
          this.canvas.render();
          this.notifyChange();
        }
      });
      document.getElementById('chkFloorPlanLegendCounts')?.addEventListener('change', (e) => {
        if (activePage?.floorPlan) {
          activePage.floorPlan.legend = {
            ...activePage.floorPlan.legend,
            showCounts: (e.target as HTMLInputElement).checked
          };
          this.canvas.render();
          this.notifyChange();
        }
      });
      document.getElementById('selFloorPlanLegendPos')?.addEventListener('change', (e) => {
        if (activePage?.floorPlan) {
          const pos = (e.target as HTMLSelectElement).value as any;
          activePage.floorPlan.legend = {
            ...activePage.floorPlan.legend,
            position: pos
          };
          this.canvas.render();
          this.notifyChange();
        }
      });
      document.getElementById('selFloorPlanLegendCols')?.addEventListener('change', (e) => {
        if (activePage?.floorPlan) {
          const val = (e.target as HTMLSelectElement).value;
          activePage.floorPlan.legend = {
            ...activePage.floorPlan.legend,
            columns: val === 'auto' ? 'auto' : (Number(val) as 1 | 2 | 3)
          };
          this.canvas.render();
          this.notifyChange();
        }
      });
      document.getElementById('selFloorPlanLegendScale')?.addEventListener('change', (e) => {
        if (activePage?.floorPlan) {
          const val = parseFloat((e.target as HTMLSelectElement).value);
          if (!isNaN(val) && val > 0) {
            activePage.floorPlan.legend = {
              ...activePage.floorPlan.legend,
              scale: val
            };
            this.canvas.render();
            this.notifyChange();
          }
        }
      });
      document.getElementById('pageNumberInput')?.addEventListener('input', (e) => {
        if (activePage) {
          const val = (e.target as HTMLInputElement).value;
          activePage.pageNumber = val;
          if (activePage.plotFrame?.titleBlock) {
            activePage.plotFrame.titleBlock.sheetNumber = val;
          }
          this.notifyChange();
          this.renderLeftTab();
        }
      });
      document.getElementById('pageTitleInput')?.addEventListener('input', (e) => {
        if (activePage) activePage.title = (e.target as HTMLInputElement).value;
        this.notifyChange();
        this.renderLeftTab();
      });
      document.getElementById('pageHigherLevelInput')?.addEventListener('input', (e) => {
        if (activePage) activePage.higherLevel = (e.target as HTMLInputElement).value;
        this.notifyChange();
      });
      document.getElementById('pageLocationInput')?.addEventListener('input', (e) => {
        if (activePage) activePage.location = (e.target as HTMLInputElement).value;
        this.notifyChange();
      });
      document.getElementById('btnMovePageUp')?.addEventListener('click', () => {
        if (activePage) this.movePage(activePage.id, 'up');
      });
      document.getElementById('btnMovePageDown')?.addEventListener('click', () => {
        if (activePage) this.movePage(activePage.id, 'down');
      });
      document.getElementById('btnDeleteCurrentPage')?.addEventListener('click', () => {
        if (activePage) this.deletePage(activePage.id);
      });
      document.getElementById('projNameInput')?.addEventListener('input', (e) => {
        this.updateProjectProperties({ name: (e.target as HTMLInputElement).value });
      });
      document.getElementById('projCompanyInput')?.addEventListener('input', (e) => {
        this.updateProjectProperties({ company: (e.target as HTMLInputElement).value });
      });
      document.getElementById('projAuthorInput')?.addEventListener('input', (e) => {
        this.updateProjectProperties({ author: (e.target as HTMLInputElement).value });
      });
    }
  }

  private detectProjectFileFormat(filename?: string | null): 'json' | 'zw1' | 'xml' | null {
    if (!filename) return null;
    const lower = filename.toLowerCase();
    if (lower.endsWith('.json')) return 'json';
    if (lower.endsWith('.zw1')) return 'zw1';
    if (lower.endsWith('.xml')) return 'xml';
    return null;
  }

  private async openProjectWithPicker(): Promise<void> {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.openFile) {
      try {
        const result = await electronAPI.openFile();
        if (!result) return;
        const list = Array.isArray(result.files) && result.files.length > 0
          ? result.files
          : [result];
        const files = list.map((f: { name: string; buffer: number[] }) => new File([new Uint8Array(f.buffer)], f.name));
        await this.handleFilesOpen(files, {
          filePath: files.length === 1 ? list[0].path : undefined
        });
      } catch (err: any) {
        const isEn = this.project.language === 'en';
        alert(`${isEn ? 'Error opening file' : 'Fehler beim Öffnen der Datei'}: ${neutralSourceLabel(err.message)}`);
      }
      return;
    }

    const showOpenFilePicker = (window as any).showOpenFilePicker;
    if (typeof showOpenFilePicker === 'function') {
      try {
        const handles = await showOpenFilePicker({
          multiple: true,
          types: [
            {
              description: 'Schematico Project Files',
              accept: {
                'application/json': ['.json'],
                'application/xml': ['.xml'],
                'application/octet-stream': ['.zw1', '.zip', '.edz', '.elk', '.001', '.002', '.003']
              }
            }
          ]
        });
        if (!handles || handles.length === 0) return;
        const files: File[] = [];
        for (const h of handles) {
          files.push(await h.getFile());
        }
        await this.handleFilesOpen(files, {
          fileHandle: handles.length === 1 ? handles[0] : undefined
        });
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        document.getElementById('fileInput')?.click();
      }
      return;
    }

    document.getElementById('fileInput')?.click();
  }

  private async handleFileOpen(file: File): Promise<void> {
    await this.handleFilesOpen([file]);
  }

  private async handleFilesOpen(
    files: FileList | File[],
    sourceInfo?: { filePath?: string; fileHandle?: any }
  ): Promise<void> {
    try {
      const result: PackageInspectionResult = await PackageHandler.inspectFiles(files);
      
      if (result.extractedProject) {
        this.project = result.extractedProject;
        const firstFile = files[0];
        const electronFilePath = sourceInfo?.filePath || (files.length === 1 ? (firstFile as any)?.path : undefined);
        const format = this.detectProjectFileFormat(electronFilePath || firstFile?.name);
        if (format && (electronFilePath || sourceInfo?.fileHandle)) {
          this.currentFilePath = electronFilePath ?? null;
          this.currentFileHandle = sourceInfo?.fileHandle ?? null;
          this.currentFileFormat = format;
        } else {
          this.currentFilePath = null;
          this.currentFileHandle = null;
          this.currentFileFormat = 'json';
        }
        prepareProjectPresentation(this.project);
        revealImportedComponentLabels(this.project);
        setProjectSymbolLibrary(this.project);
        this.selectedComponent = null;
        this.selectedWire = null;
        this.canvas.setProject(this.project);
        if (this.project.activePageId) {
          this.canvas.setPage(this.project.activePageId);
        }
        this.canvas.fitToScreen();
        this.history.reset(this.project);
        this.updateUI();
        this.saveActiveProject();
      }
    } catch (err: any) {
      const isEn = this.project.language === 'en';
      alert(`${isEn ? 'Error opening file' : 'Fehler beim Öffnen der Datei'}: ${neutralSourceLabel(err.message)}`);
    }
  }

  private createNewProject(): void {
    this.currentFilePath = null;
    this.currentFileHandle = null;
    this.currentFileFormat = 'json';
    this.project = {
      id: 'proj_' + Math.random().toString(36).substring(2, 9),
      name: 'Neues_Schematico_Projekt',
      description: 'Erstellt mit Schematico Suite',
      standard: 'DIN EN 81346-2 / IEC 60617',
      version: '1.0',
      created: new Date().toISOString().split('T')[0],
      modified: new Date().toISOString().split('T')[0],
      author: 'Planer',
      company: 'Engineering Büro',
      pages: [
        {
          id: 'p_1',
          pageNumber: '1',
          pageType: 'schematic',
          title: 'Stromlaufplan Seite 1',
          higherLevel: '=A1',
          location: '+S1',
          components: [],
          wires: [],
          plotFrame: {
            type: 'DIN_A3_LANDSCAPE',
            width: 1000,
            height: 700,
            columns: 10,
            rows: ['A', 'B', 'C', 'D', 'E', 'F'],
            titleBlock: {
              projectTitle: 'Neues_Schematico_Projekt',
              commission: 'KOM-001',
              company: 'Engineering Büro',
              author: 'Planer',
              date: new Date().toISOString().split('T')[0],
              revision: '1.0',
              sheetNumber: '1',
              totalSheets: '1'
            }
          }
        }
      ],
      activePageId: 'p_1'
    };

    setProjectSymbolLibrary(this.project);
    this.selectedComponent = null;
    this.selectedWire = null;
    this.canvas.setProject(this.project);
    this.history.reset(this.project);
    this.updateUI();
    this.saveActiveProject();
  }

  private async buildProjectBlob(format: 'json' | 'zw1' | 'xml'): Promise<Blob> {
    if (format === 'zw1') {
      return await PackageHandler.exportToZw1(this.project);
    }
    if (format === 'xml') {
      const xml = PackageHandler.generateProjectXml(this.project);
      return new Blob([xml], { type: 'application/xml' });
    }
    const jsonStr = JSON.stringify(this.project, null, 2);
    return new Blob([jsonStr], { type: 'application/json' });
  }

  private showSaveFeedback(targetLabel: string): void {
    const isEn = this.project.language === 'en';
    const message = isEn ? `Saved: ${targetLabel}` : `Gespeichert: ${targetLabel}`;
    const status = document.getElementById('statusLeft');
    if (status) {
      status.textContent = `✓ ${message}`;
      status.style.color = '#68d391';
    }
    const saveBtn = document.getElementById('btnSaveJson');
    if (saveBtn) {
      saveBtn.classList.add('save-feedback');
      const pathEl = saveBtn.querySelector('svg path');
      if (pathEl) {
        if (!saveBtn.dataset.origPath) {
          saveBtn.dataset.origPath = pathEl.getAttribute('d') || '';
        }
        pathEl.setAttribute('d', 'm5 12 5 5L20 7');
      }
    }
    if (this.saveFeedbackTimer) {
      clearTimeout(this.saveFeedbackTimer);
    }
    this.saveFeedbackTimer = setTimeout(() => {
      if (saveBtn) {
        saveBtn.classList.remove('save-feedback');
        const pathEl = saveBtn.querySelector('svg path');
        if (pathEl && saveBtn.dataset.origPath) {
          pathEl.setAttribute('d', saveBtn.dataset.origPath);
        }
      }
      if (status) {
        status.style.color = '';
      }
      this.saveFeedbackTimer = null;
    }, 1400);
  }

  private async saveProjectJson(forceSaveAs = false): Promise<void> {
    this.project.modified = new Date().toISOString().split('T')[0];
    this.saveActiveProject();

    const format = !forceSaveAs && (this.currentFilePath || this.currentFileHandle)
      ? this.currentFileFormat
      : 'json';
    const ext = format;
    const defaultName = `${this.project.name}.${ext}`;
    const blob = await this.buildProjectBlob(format);

    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.saveFile) {
      const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
      const filters = format === 'zw1'
        ? [{ name: 'Schematico Projektarchiv (.zw1)', extensions: ['zw1'] }, { name: 'JSON Projekt (.json)', extensions: ['json'] }]
        : format === 'xml'
          ? [{ name: 'Projekt-XML (.xml)', extensions: ['xml'] }, { name: 'JSON Projekt (.json)', extensions: ['json'] }]
          : [{ name: 'Schematico Projekt (.json)', extensions: ['json'] }, { name: 'Schematico Projektarchiv (.zw1)', extensions: ['zw1'] }];
      const saved = await electronAPI.saveFile({
        filePath: !forceSaveAs && this.currentFilePath ? this.currentFilePath : undefined,
        defaultName: this.currentFilePath || defaultName,
        filters,
        data: bytes
      });
      if (saved) {
        if (typeof saved === 'string') {
          this.currentFilePath = saved;
          this.currentFileFormat = this.detectProjectFileFormat(saved) ?? format;
          this.showSaveFeedback(saved.split(/[\\/]/).pop() || saved);
        } else {
          this.showSaveFeedback(defaultName);
        }
      }
      return;
    }

    if (!forceSaveAs && this.currentFileHandle && typeof this.currentFileHandle.createWritable === 'function') {
      try {
        const writable = await this.currentFileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        this.showSaveFeedback(this.currentFileHandle.name || defaultName);
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    const showSaveFilePicker = (window as any).showSaveFilePicker;
    if (typeof showSaveFilePicker === 'function') {
      try {
        const handle = await showSaveFilePicker({
          suggestedName: defaultName,
          types: [
            {
              description: 'Schematico Project (.json)',
              accept: { 'application/json': ['.json'] }
            },
            {
              description: 'Schematico Project Archive (.zw1)',
              accept: { 'application/octet-stream': ['.zw1'] }
            },
            {
              description: 'Project XML (.xml)',
              accept: { 'application/xml': ['.xml'] }
            }
          ]
        });
        if (!handle) return;
        const chosenFormat = this.detectProjectFileFormat(handle.name) ?? 'json';
        const finalBlob = chosenFormat === format ? blob : await this.buildProjectBlob(chosenFormat);
        const writable = await handle.createWritable();
        await writable.write(finalBlob);
        await writable.close();
        this.currentFileHandle = handle;
        this.currentFileFormat = chosenFormat;
        this.showSaveFeedback(handle.name || defaultName);
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    this.downloadBlob(blob, defaultName);
    this.showSaveFeedback(defaultName);
  }

  private async exportZw1(): Promise<void> {
    const blob = await PackageHandler.exportToZw1(this.project);
    await this.saveOrDownloadBlob(blob, `${this.project.name}.zw1`, [
      { name: 'Schematico Projektarchiv (.zw1)', extensions: ['zw1'] }
    ], {
      description: 'Schematico Project Archive (.zw1)',
      accept: { 'application/octet-stream': ['.zw1'] }
    });
  }

  private async exportXml(): Promise<void> {
    const xml = PackageHandler.generateProjectXml(this.project);
    const blob = new Blob([xml], { type: 'application/xml' });
    await this.saveOrDownloadBlob(blob, `${this.project.name}.xml`, [
      { name: 'Projekt-XML (.xml)', extensions: ['xml'] }
    ], {
      description: 'Project XML (.xml)',
      accept: { 'application/xml': ['.xml'] }
    });
  }

  private async saveOrDownloadBlob(
    blob: Blob,
    defaultName: string,
    electronFilters?: { name: string; extensions: string[] }[],
    pickerType?: { description: string; accept: Record<string, string[]> }
  ): Promise<void> {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.saveFile) {
      const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
      const saved = await electronAPI.saveFile({
        defaultName,
        filters: electronFilters,
        data: bytes
      });
      if (saved) {
        this.showSaveFeedback(typeof saved === 'string' ? (saved.split(/[\\/]/).pop() || saved) : defaultName);
      }
      return;
    }

    const showSaveFilePicker = (window as any).showSaveFilePicker;
    if (typeof showSaveFilePicker === 'function') {
      try {
        const handle = await showSaveFilePicker({
          suggestedName: defaultName,
          ...(pickerType ? { types: [pickerType] } : {})
        });
        if (!handle) return;
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        this.showSaveFeedback(handle.name || defaultName);
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    this.downloadBlob(blob, defaultName);
    this.showSaveFeedback(defaultName);
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private notifyChange(): void {
    CrossReferenceEngine.updateProjectCrossReferences(this.project);
    this.canvas.render();
    this.updateUI();
  }
}
