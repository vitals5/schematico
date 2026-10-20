import assert from 'node:assert/strict';
import { getUiLanguage, setUiLanguage, onLanguageChange, t } from './index';
import { defaultCoverPageTemplate, createCoverPage } from '../model/CoverPage';
import { defaultPlotFrame } from '../model/PlotFrame';
import { getBomColumns } from '../export/PartsListPdf';
import { Project } from '../model/types';
import { getCategoryLabel, getConnectionCategoryLabel, getMacroCategoryLabel, getLocalizedSymbol } from './symbolTranslations';
import { SYMBOL_DEFINITIONS } from '../model/symbols';

// 1. Test UI Language Switching & Callbacks
let callbackLang = '';
const unsubscribe = onLanguageChange((lang) => {
  callbackLang = lang;
});

setUiLanguage('en');
assert.equal(getUiLanguage(), 'en');
assert.equal(callbackLang, 'en');
assert.equal(t('menuSave'), 'Save');
assert.equal(t('rightHeading'), 'PROPERTIES');
assert.equal(t('toolWireLabel'), 'Wire');

setUiLanguage('de');
assert.equal(getUiLanguage(), 'de');
assert.equal(callbackLang, 'de');
assert.equal(t('menuSave'), 'Speichern');
assert.equal(t('rightHeading'), 'EIGENSCHAFTEN');
assert.equal(t('toolWireLabel'), 'Verdrahten');

unsubscribe();

// 2. Test Parameter Interpolation & Fallbacks
assert.equal(t('deletePageConfirm', { number: '4', title: 'Schaltplan' }), 'Möchten Sie die Seite "Blatt 4: Schaltplan" wirklich löschen?');
setUiLanguage('en');
assert.equal(t('deletePageConfirm', { number: '4', title: 'Schematic' }), 'Are you sure you want to delete page "Sheet 4: Schematic"?');
assert.equal(t('nonExistentKey' as any), 'nonExistentKey');

// 3. Test Project Language on Cover Page
const projDe: Project = {
  id: 'p_de',
  name: 'Deutsches_Projekt',
  description: 'Test',
  company: 'Firma',
  author: 'Planer',
  standard: 'DIN EN 81346-2 / IEC 60617',
  version: '1.0',
  created: '2026-10-20',
  modified: '2026-10-20',
  pages: [],
  activePageId: '',
  language: 'de'
};

const coverDe = createCoverPage(projDe);
assert.equal(coverDe.title, 'Titelblatt');

const projEn: Project = {
  id: 'p_en',
  name: 'English_Project',
  description: 'Test',
  company: 'Company',
  author: 'Author',
  standard: 'DIN EN 81346-2 / IEC 60617',
  version: '1.0',
  created: '2026-10-20',
  modified: '2026-10-20',
  pages: [],
  activePageId: '',
  language: 'en'
};

const coverEn = createCoverPage(projEn);
assert.equal(coverEn.title, 'Cover Sheet');

const tplDe = defaultCoverPageTemplate('de');
assert.equal(tplDe.texts.find(t => t.id === 'label-10100')?.text, 'Firma / Kunde');
assert.equal(tplDe.texts.find(t => t.id === 'created-label')?.text, 'Erstellt am');

const tplEn = defaultCoverPageTemplate('en');
assert.equal(tplEn.texts.find(t => t.id === 'label-10100')?.text, 'Company / Client');
assert.equal(tplEn.texts.find(t => t.id === 'created-label')?.text, 'Created on');

// 4. Test Plot Frame Localization
const frameDe = defaultPlotFrame('de');
assert.equal(frameDe.texts.find(t => t.id === 'date-label')?.text, 'Datum');
assert.equal(frameDe.texts.find(t => t.id === 'sheet-label')?.text, 'Blatt');
assert.equal(frameDe.name, 'A3 Normblatt');

const frameEn = defaultPlotFrame('en');
assert.equal(frameEn.texts.find(t => t.id === 'date-label')?.text, 'Date');
assert.equal(frameEn.texts.find(t => t.id === 'sheet-label')?.text, 'Sheet');
assert.equal(frameEn.name, 'A3 Standard Frame');

// 5. Test BOM Column Headers
const bomColsDe = getBomColumns('de');
assert.equal(bomColsDe[0].title, 'Menge');
assert.equal(bomColsDe[1].title, 'Artikelnummer');
assert.equal(bomColsDe[2].title, 'Beschreibung / Typ');

const bomColsEn = getBomColumns('en');
assert.equal(bomColsEn[0].title, 'Qty');
assert.equal(bomColsEn[1].title, 'Part Number');
assert.equal(bomColsEn[2].title, 'Description / Type');

// 6. Test Category, Connection & Macro Localizations
assert.equal(getCategoryLabel('relays', 'de'), 'Schaltgeräte & Relais');
assert.equal(getCategoryLabel('relays', 'en'), 'Switchgear & Relays');
assert.equal(getCategoryLabel('protection', 'en'), 'Protection Devices');

assert.equal(getConnectionCategoryLabel('interruptions', 'de'), 'Abbruchstellen');
assert.equal(getConnectionCategoryLabel('interruptions', 'en'), 'Interruption Points');
assert.equal(getConnectionCategoryLabel('tees', 'en'), 'T-Junctions');

assert.equal(getMacroCategoryLabel('motor', 'de'), '⚙️ Motoren & Antriebe');
assert.equal(getMacroCategoryLabel('motor', 'en'), '⚙️ Motors & Drives');
assert.equal(getMacroCategoryLabel('all', 'en'), 'All Macros');

const coilSym = SYMBOL_DEFINITIONS.find(s => s.id === 'coil');
if (coilSym) {
  const coilDe = getLocalizedSymbol(coilSym, 'de');
  assert.equal(coilDe.name, 'Relaisspule / Schützspule');
  const coilEn = getLocalizedSymbol(coilSym, 'en');
  assert.equal(coilEn.name, 'Relay Coil / Contactor Coil');
}

console.log('✓ UI and Project language localization: switching, persistence, parameter interpolation, cover pages, plot frames, BOM columns, and symbol translations passed.');
