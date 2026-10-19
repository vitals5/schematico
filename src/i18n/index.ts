import { readAppSetting, writeAppSetting } from '../model/LegacyCompatibility';

export type Language = 'de' | 'en';

type Listener = (lang: Language) => void;
const listeners = new Set<Listener>();

export const translations = {
  de: {
    // Menu
    menu: 'Menü',
    menuProject: 'Projekt',
    menuNew: 'Neues Projekt…',
    menuOpen: 'Projekt öffnen…',
    menuSave: 'Speichern',
    menuProjectSettings: 'Projekt-Einstellungen…',
    menuLoadDemo: 'Standard-Projekt laden…',
    headingExport: 'Export',
    menuExportPdf: 'PDF exportieren…',
    menuExportZw1: 'Projektarchiv (.zw1)…',
    menuExportXml: 'Projekt-XML…',
    menuExportPageMacro: 'Seite als Makro (.ems)…',
    menuPrint: 'Drucken…',
    menuSettings: 'Allgemeine Einstellungen…',
    menuEdit: 'Bearbeiten',
    menuUndo: 'Rückgängig',
    menuRedo: 'Wiederholen',
    menuCut: 'Ausschneiden',
    menuCopy: 'Kopieren',
    menuPaste: 'Einfügen',
    menuDuplicate: 'Duplizieren',
    menuRotate: 'Um 90° drehen',
    menuDelete: 'Löschen',
    menuGroup: 'Gruppieren',
    menuUngroup: 'Gruppierung auflösen',
    menuInsert: 'Einfügen',
    menuInsertSym: 'Element…',
    menuInsertConnections: 'Verbindungselement…',
    menuWire: 'Verbindungslinie',
    menuInsertCable: 'Kabelbeschriftung…',
    menuInsertBox: 'Gerätekasten zeichnen',
    menuInsertImage: 'Bilddatei…',
    headingMacros: 'Makros',
    menuInsertMacro: 'Fenstermakro (.ema)…',
    menuInsertPageMacro: 'Makro platzieren (.ems)…',
    headingPages: 'Seiten',
    menuNewPage: 'Neue Seite…',
    menuNewCoverPage: 'Titelblatt…',
    menuDeletePage: 'Aktuelle Seite löschen…',
    menuView: 'Ansicht',
    menuFit: 'Ganzes Blatt',
    menuZoom100: 'Originalgröße (100 %)',
    menuZoomIn: 'Vergrößern',
    menuZoomOut: 'Verkleinern',
    headingGrid: 'Rasterfang',
    menuGridFull: 'Vollraster',
    menuGridHalf: 'Halbraster',
    menuGridFine: 'Feinraster',
    menuGridOff: 'Rasterfang aus',
    menuToggleAutoconnect: 'Automatisch verbinden',
    menuToggleLeftPanel: 'Seiten & Bibliothek',
    menuToggleRightPanel: 'Eigenschaften',
    menuData: 'Auswerten',
    menuPlausibility: 'Projekt prüfen…',
    menuRecalcCrossRef: 'Querverweise aktualisieren',
    menuShowTerminals: 'Klemmenplan anzeigen',
    menuShowBom: 'Artikelstückliste anzeigen',
    menuHelp: 'Hilfe',
    menuShortcuts: 'Tastenkürzel…',
    menuMobile: 'Auf dem Smartphone öffnen…',
    menuAbout: 'Über Schematico',

    // Key shortcuts
    keyCtrlS: 'Strg+S',
    keyCtrlP: 'Strg+P',
    keyCtrlZ: 'Strg+Z',
    keyCtrlY: 'Strg+Y',
    keyCtrlX: 'Strg+X',
    keyCtrlC: 'Strg+C',
    keyCtrlV: 'Strg+V',
    keyCtrlD: 'Strg+D',
    keyCtrlG: 'Strg+G',
    keyCtrlShiftG: 'Strg+Umschalt+G',
    keyR: 'R',
    keyDel: 'Entf',
    keyIns: 'Einfg',
    keyD: 'D',
    keyF: 'F',

    // Toolbar
    toolToggleLeft: 'Seiten & Bibliothek ein-/ausblenden',
    toolOpenProject: 'Projekt öffnen',
    toolSave: 'Projekt speichern (Strg+S)',
    toolUndo: 'Rückgängig (Strg+Z)',
    toolRedo: 'Wiederholen (Strg+Y)',
    toolSelect: 'Auswählen',
    toolWire: 'Verbindungslinie zeichnen (D)',
    toolWireLabel: 'Verdrahten',
    toolInsertSym: 'Element auswählen (Einfg)',
    toolInsertSymLabel: 'Element',
    toolMoreInsert: 'Weitere Objekte einfügen',
    toolRotate: 'Um 90° drehen (R)',
    toolCopy: 'Kopieren (Strg+C)',
    toolPaste: 'Einfügen (Strg+V)',
    toolDuplicate: 'Duplizieren (Strg+D)',
    toolDelete: 'Löschen (Entf)',
    toolFit: 'Ganzes Blatt (F)',
    toolGrid: 'Raster',
    toolExportPdf: 'PDF exportieren (Strg+P)',
    toolToggleRight: 'Eigenschaften ein-/ausblenden',

    // Sidebars
    leftHeading: 'PROJEKT & SYMBOLE',
    rightHeading: 'EIGENSCHAFTEN',
    tabPages: 'Seiten',
    tabSymbols: 'Bibliothek',
    tabConnections: 'Verbindungen',
    tabMacros: 'Makros',
    tabTerminals: 'Klemmen',
    tabBom: 'Stückliste',
    tabProperties: 'Eigenschaften',
    collapseLeftPanel: 'Linkes Panel einklappen',
    collapseRightPanel: 'Rechtes Panel einklappen',
    expandLeftPanel: 'Linkes Panel einblenden',
    expandRightPanel: 'Rechtes Panel einblenden',
    adjustWidth: 'Breite anpassen (ziehen)',

    // Page Manager
    projectPages: 'Projektseiten (DIN EN 81346)',
    btnNewPage: '+ Seite',
    btnNewCover: '+ Titelblatt',
    sheet: 'Blatt',
    page: 'Seite',
    activePage: 'Aktive Seite',
    movePageUp: 'Aktive Seite nach oben verschieben',
    movePageDown: 'Aktive Seite nach unten verschieben',
    deletePage: 'Aktive Seite löschen',
    deletePageMinPages: 'Das Projekt muss mindestens eine Seite enthalten.',
    deletePageConfirm: 'Möchten Sie die Seite "Blatt {number}: {title}" wirklich löschen?',
    btnMoveUp: '▲ Nach oben',
    btnMoveDown: '▼ Nach unten',
    pageProperties: 'Seiteneigenschaften (Blatt {number})',
    btnEditCoverPage: 'Titelblatt bearbeiten…',
    fieldSheetNumber: 'Blattnummer',
    fieldPageTitle: 'Seitentitel',
    fieldHigherLevel: 'Anlagenkennzeichen (=Anlage)',
    fieldLocation: 'Ortskennzeichen (+Ort)',
    projectPropertiesHeading: 'Projekteigenschaften',
    fieldProjectName: 'Projektname',
    fieldCompany: 'Firma / Organisation',
    fieldAuthor: 'Ersteller / Bearbeiter',
    dragToReorder: 'Ziehen zum Neuanordnen',

    // Status bar
    statusReady: 'Bereit | DIN EN 81346 / IEC 60617 | Elektro-CAD Modus',
    statusPageInfo: 'Seite {page} / {total} | Raster: {grid} | Querverweise: {crossRef}',
    statusActive: 'Aktiv',
    statusInactive: 'Inaktiv',

    // Dialogs & Settings
    generalSettingsTitle: 'Allgemeine Einstellungen',
    uiLanguageLabel: 'Sprache der Benutzeroberfläche',
    uiLanguageDesc: 'Bestimmt die Sprache der Menüs, Schaltflächen und Meldungen.',
    macroFolderLabel: 'Makroordner',
    macroFolderDesc: 'Der Makroordner wird als Programmeinstellung unabhängig vom Projekt gespeichert.',
    autoLoadLabel: 'Zuletzt geöffnetes Projekt beim Start automatisch laden',
    autoLoadDesc: 'Wenn aktiviert, öffnet Schematico beim Programmstart direkt das zuletzt bearbeitete Projekt.',
    projectSettingsTitle: 'Projekt-Einstellungen',
    projectNameLabel: 'Projektname',
    projectDescLabel: 'Projektbeschreibung',
    companyLabel: 'Firma / Organisation',
    authorLabel: 'Bearbeiter (Kürzel / Name)',
    standardLabel: 'Norm / Richtlinie',
    projectLanguageLabel: 'Projektsprache',
    projectLanguageDesc: 'Bestimmt die Sprache für Titelblatt, Stücklisten, Normblätter und Auswertungen.',
    interruptionLabelSide: 'Beschriftung der Abbruchstellen',
    interruptionLabelSideDesc: 'Die Position der Bezeichnung bezieht sich auf die Pfeilrichtung. Querverweise erscheinen automatisch gegenüber der angeschlossenen Seite, solange keine eigene Position gewählt ist. Die Einstellung wird mit dem Projekt gespeichert.',
    optSource: 'Wie importiert / Standard',
    optBefore: 'Vor dem Pfeil (Leitungsseite)',
    optAfter: 'Nach dem Pfeil (Spitzenseite)',
    btnApply: 'Übernehmen',
    btnCancel: 'Abbrechen',
    btnClose: 'Schließen',
    btnSave: 'Speichern',

    // BOM & Reports
    bomTitle: 'Stückliste / Artikelliste (BOM)',
    bomQty: 'Menge',
    bomPartNumber: 'Artikelnummer',
    bomDescription: 'Beschreibung / Typ',
    bomManufacturer: 'Hersteller',
    bomBmkList: 'BMK-Liste',
    terminalsTitle: 'Klemmenplan-Auswertung (DIN EN 81346)',
    terminalsEmpty: 'Keine Klemmenleisten im Projekt platziert.',
    terminalsStrip: 'Klemmenleiste',
    terminalsColTerminal: 'Klemme',
    terminalsColInternal: 'Intern',
    terminalsColExternal: 'Extern',
    terminalsColFunction: 'Funktion',

    // Floating toolbar & Selection
    floatingCut: 'Ausschneiden',
    floatingCopy: 'Kopieren',
    floatingPaste: 'Einfügen',
    floatingDuplicate: 'Duplizieren',
    floatingDelete: 'Löschen',
    floatingRotate: 'Drehen',
    floatingProperties: 'Eigenschaften',
    floatingGroup: 'Gruppieren',
    floatingUngroup: 'Gruppe auflösen',
    elementsSelected: '{count} Elemente ausgewählt',
    deviceBoxSelected: 'Gerätekasten ausgewählt',

    // Language names
    langGerman: 'Deutsch',
    langEnglish: 'English'
  },
  en: {
    // Menu
    menu: 'Menu',
    menuProject: 'Project',
    menuNew: 'New Project…',
    menuOpen: 'Open Project…',
    menuSave: 'Save',
    menuProjectSettings: 'Project Settings…',
    menuLoadDemo: 'Load Demo Project…',
    headingExport: 'Export',
    menuExportPdf: 'Export PDF…',
    menuExportZw1: 'Project Archive (.zw1)…',
    menuExportXml: 'Project XML…',
    menuExportPageMacro: 'Page as Macro (.ems)…',
    menuPrint: 'Print…',
    menuSettings: 'General Settings…',
    menuEdit: 'Edit',
    menuUndo: 'Undo',
    menuRedo: 'Redo',
    menuCut: 'Cut',
    menuCopy: 'Copy',
    menuPaste: 'Paste',
    menuDuplicate: 'Duplicate',
    menuRotate: 'Rotate 90°',
    menuDelete: 'Delete',
    menuGroup: 'Group',
    menuUngroup: 'Ungroup',
    menuInsert: 'Insert',
    menuInsertSym: 'Symbol…',
    menuInsertConnections: 'Connection Symbol…',
    menuWire: 'Wire',
    menuInsertCable: 'Cable Definition…',
    menuInsertBox: 'Draw Device Box',
    menuInsertImage: 'Image File…',
    headingMacros: 'Macros',
    menuInsertMacro: 'Window Macro (.ema)…',
    menuInsertPageMacro: 'Place Macro (.ems)…',
    headingPages: 'Pages',
    menuNewPage: 'New Page…',
    menuNewCoverPage: 'Cover Sheet…',
    menuDeletePage: 'Delete Current Page…',
    menuView: 'View',
    menuFit: 'Fit to Screen',
    menuZoom100: 'Actual Size (100%)',
    menuZoomIn: 'Zoom In',
    menuZoomOut: 'Zoom Out',
    headingGrid: 'Grid Snap',
    menuGridFull: 'Full Grid',
    menuGridHalf: 'Half Grid',
    menuGridFine: 'Fine Grid',
    menuGridOff: 'Grid Snap Off',
    menuToggleAutoconnect: 'Autoconnect',
    menuToggleLeftPanel: 'Pages & Library',
    menuToggleRightPanel: 'Properties',
    menuData: 'Reports',
    menuPlausibility: 'Check Project…',
    menuRecalcCrossRef: 'Recalculate Cross-References',
    menuShowTerminals: 'Show Terminal Diagram',
    menuShowBom: 'Show Bill of Materials',
    menuHelp: 'Help',
    menuShortcuts: 'Keyboard Shortcuts…',
    menuMobile: 'Open on Smartphone…',
    menuAbout: 'About Schematico',

    // Key shortcuts
    keyCtrlS: 'Ctrl+S',
    keyCtrlP: 'Ctrl+P',
    keyCtrlZ: 'Ctrl+Z',
    keyCtrlY: 'Ctrl+Y',
    keyCtrlX: 'Ctrl+X',
    keyCtrlC: 'Ctrl+C',
    keyCtrlV: 'Ctrl+V',
    keyCtrlD: 'Ctrl+D',
    keyCtrlG: 'Ctrl+G',
    keyCtrlShiftG: 'Ctrl+Shift+G',
    keyR: 'R',
    keyDel: 'Del',
    keyIns: 'Ins',
    keyD: 'D',
    keyF: 'F',

    // Toolbar
    toolToggleLeft: 'Toggle Pages & Library sidebar',
    toolOpenProject: 'Open project',
    toolSave: 'Save project (Ctrl+S)',
    toolUndo: 'Undo (Ctrl+Z)',
    toolRedo: 'Redo (Ctrl+Y)',
    toolSelect: 'Select',
    toolWire: 'Draw wire (D)',
    toolWireLabel: 'Wire',
    toolInsertSym: 'Select symbol (Ins)',
    toolInsertSymLabel: 'Symbol',
    toolMoreInsert: 'Insert more objects',
    toolRotate: 'Rotate 90° (R)',
    toolCopy: 'Copy (Ctrl+C)',
    toolPaste: 'Paste (Ctrl+V)',
    toolDuplicate: 'Duplicate (Ctrl+D)',
    toolDelete: 'Delete (Del)',
    toolFit: 'Fit to screen (F)',
    toolGrid: 'Grid',
    toolExportPdf: 'Export PDF (Ctrl+P)',
    toolToggleRight: 'Toggle Properties sidebar',

    // Sidebars
    leftHeading: 'PROJECT & SYMBOLS',
    rightHeading: 'PROPERTIES',
    tabPages: 'Pages',
    tabSymbols: 'Library',
    tabConnections: 'Connections',
    tabMacros: 'Macros',
    tabTerminals: 'Terminals',
    tabBom: 'BOM',
    tabProperties: 'Properties',
    collapseLeftPanel: 'Collapse left panel',
    collapseRightPanel: 'Collapse right panel',
    expandLeftPanel: 'Expand left panel',
    expandRightPanel: 'Expand right panel',
    adjustWidth: 'Adjust width (drag)',

    // Page Manager
    projectPages: 'Project Pages (DIN EN 81346)',
    btnNewPage: '+ Page',
    btnNewCover: '+ Cover',
    sheet: 'Sheet',
    page: 'Page',
    activePage: 'Active Page',
    movePageUp: 'Move active page up',
    movePageDown: 'Move active page down',
    deletePage: 'Delete active page',
    deletePageMinPages: 'The project must contain at least one page.',
    deletePageConfirm: 'Are you sure you want to delete page "Sheet {number}: {title}"?',
    btnMoveUp: '▲ Move Up',
    btnMoveDown: '▼ Move Down',
    pageProperties: 'Page Properties (Sheet {number})',
    btnEditCoverPage: 'Edit Cover Sheet…',
    fieldSheetNumber: 'Sheet Number',
    fieldPageTitle: 'Page Title',
    fieldHigherLevel: 'Higher-level designation (=Plant)',
    fieldLocation: 'Location designation (+Location)',
    projectPropertiesHeading: 'Project Properties',
    fieldProjectName: 'Project Name',
    fieldCompany: 'Company / Organization',
    fieldAuthor: 'Author / Designer',
    dragToReorder: 'Drag to reorder',

    // Status bar
    statusReady: 'Ready | DIN EN 81346 / IEC 60617 | Electrical CAD Mode',
    statusPageInfo: 'Page {page} / {total} | Grid: {grid} | Cross-references: {crossRef}',
    statusActive: 'Active',
    statusInactive: 'Inactive',

    // Dialogs & Settings
    generalSettingsTitle: 'General Settings',
    uiLanguageLabel: 'User Interface Language',
    uiLanguageDesc: 'Controls the display language of menus, toolbars, and dialogs.',
    macroFolderLabel: 'Macro Folder',
    macroFolderDesc: 'The macro folder is stored as an application setting independently of the project.',
    autoLoadLabel: 'Automatically load last opened project on startup',
    autoLoadDesc: 'When enabled, Schematico immediately re-opens the most recently edited project on startup.',
    projectSettingsTitle: 'Project Settings',
    projectNameLabel: 'Project Name',
    projectDescLabel: 'Project Description',
    companyLabel: 'Company / Organization',
    authorLabel: 'Author (Initials / Name)',
    standardLabel: 'Standard / Guideline',
    projectLanguageLabel: 'Project Language',
    projectLanguageDesc: 'Determines the language for the cover sheet, bill of materials, plot frame, and reports.',
    interruptionLabelSide: 'Interruption Point Labeling',
    interruptionLabelSideDesc: 'Label position relative to arrow direction. Cross-references automatically appear opposite the connected side unless a custom position is chosen. Saved with the project.',
    optSource: 'As imported / Standard',
    optBefore: 'Before arrow (wire side)',
    optAfter: 'After arrow (tip side)',
    btnApply: 'Apply',
    btnCancel: 'Cancel',
    btnClose: 'Close',
    btnSave: 'Save',

    // BOM & Reports
    bomTitle: 'Bill of Materials (BOM)',
    bomQty: 'Qty',
    bomPartNumber: 'Part Number',
    bomDescription: 'Description / Type',
    bomManufacturer: 'Manufacturer',
    bomBmkList: 'Tag List',
    terminalsTitle: 'Terminal Diagram Report (DIN EN 81346)',
    terminalsEmpty: 'No terminal strips placed in project.',
    terminalsStrip: 'Terminal Strip',
    terminalsColTerminal: 'Terminal',
    terminalsColInternal: 'Internal',
    terminalsColExternal: 'External',
    terminalsColFunction: 'Function',

    // Floating toolbar & Selection
    floatingCut: 'Cut',
    floatingCopy: 'Copy',
    floatingPaste: 'Paste',
    floatingDuplicate: 'Duplicate',
    floatingDelete: 'Delete',
    floatingRotate: 'Rotate',
    floatingProperties: 'Properties',
    floatingGroup: 'Group',
    floatingUngroup: 'Ungroup',
    elementsSelected: '{count} elements selected',
    deviceBoxSelected: 'Device box selected',

    // Language names
    langGerman: 'Deutsch',
    langEnglish: 'English'
  }
};

export type TranslationKey = keyof typeof translations.de;

let currentUiLanguage: Language | null = null;

export function getUiLanguage(): Language {
  if (currentUiLanguage) return currentUiLanguage;

  const stored = readAppSetting('ui_language');
  if (stored === 'de' || stored === 'en') {
    currentUiLanguage = stored;
    return stored;
  }

  // Detect browser language
  if (typeof navigator !== 'undefined' && navigator.language) {
    const lang = navigator.language.toLowerCase();
    if (lang.startsWith('de')) {
      currentUiLanguage = 'de';
      return 'de';
    }
  }

  currentUiLanguage = 'en';
  return 'en';
}

export function setUiLanguage(lang: Language): void {
  currentUiLanguage = lang;
  writeAppSetting('ui_language', lang);
  for (const listener of listeners) {
    try {
      listener(lang);
    } catch (e) {
      console.error('Error in language listener:', e);
    }
  }
}

export function onLanguageChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const lang = getUiLanguage();
  const dict = translations[lang] || translations.en;
  let text: string = (dict as any)[key] ?? (translations.en as any)[key] ?? key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}
