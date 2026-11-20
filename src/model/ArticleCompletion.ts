import type { CatalogArticle } from './ArticleTypes';
import type { Project, SymbolDefinition } from './types';
import { getSymbolById, getSymbolDefinitions } from './symbols';
import { functionType } from './FunctionDefinitions';
import { getAiProvider, getOpenRouterKey, getOpenRouterModel } from '../ai/ProviderConfig';
import { getGeminiApiKey, getGeminiModel } from '../ai/GeminiConfig';
import { GoogleGenAI } from '@google/genai';
import { routerRequest } from '../ai/openrouter/api';
import { validateElectricalData, type ArticleElectricalData } from './ArticleElectrical';

export interface MissingArticleFields {
  description: boolean;
  symbolId: boolean;
  dimensions: boolean;
  electrical: boolean;
  functions: boolean;
}

/** Analyzes which core engineering attributes are missing on a catalogue article. */
export function detectMissingArticleFields(article: Partial<CatalogArticle>): MissingArticleFields {
  const missingDescription =
    !article.description ||
    article.description.trim().length < 5 ||
    article.description === article.articleNumber;
  const missingSymbol = !article.symbolId && !article.symbol;
  const missingDimensions =
    !article.dimensions ||
    !article.dimensions.widthMm ||
    !article.dimensions.heightMm;
  const missingElectrical = !article.electrical || !article.electrical.kind;
  const missingFunctions = !article.functions || article.functions.length === 0;

  return {
    description: missingDescription,
    symbolId: missingSymbol,
    dimensions: missingDimensions,
    electrical: missingElectrical,
    functions: missingFunctions,
  };
}

/** Returns a list of field names that are currently missing. */
export function missingFieldNames(article: Partial<CatalogArticle>): string[] {
  const missing = detectMissingArticleFields(article);
  const names: string[] = [];
  if (missing.description) names.push('description');
  if (missing.symbolId) names.push('symbolId');
  if (missing.dimensions) names.push('dimensions');
  if (missing.electrical) names.push('electrical');
  if (missing.functions) names.push('functions');
  return names;
}

/**
 * Builds and strictly validates an ArticleElectricalData record according to Schematico schema.
 * Prevents cross-kind rating collisions that would throw articlesElectricalInvalid.
 */
export function buildValidElectricalData(
  kind: 'protection' | 'cable' | 'load',
  raw: {
    ratedVoltageV?: number;
    currentA?: number;
    protectiveCurrentA?: number;
    conventionalTripA?: number;
    breakingCapacityA?: number;
    residualCurrentA?: number;
    poles?: number;
    characteristic?: string;
    currentType?: 'ac' | 'dc' | 'ac_dc';
    sectionMm2?: number;
    cores?: number;
    resistance20OhmKm?: number;
    reactanceOhmKm?: number;
    ampacityA?: number;
    adiabaticK?: number;
    material?: 'copper' | 'aluminium';
    outputPowerW?: number;
    efficiency?: number;
    cosPhi?: number;
    conditions?: string;
    source?: string;
  },
): ArticleElectricalData {
  const source =
    raw.source && raw.source.trim()
      ? raw.source.trim()
      : 'Herstellerkatalog / Datenblatt';
  const currentType =
    raw.currentType && ['ac', 'dc', 'ac_dc'].includes(raw.currentType)
      ? raw.currentType
      : 'ac';
  const ratedVoltageV =
    raw.ratedVoltageV && raw.ratedVoltageV > 0 ? raw.ratedVoltageV : 230;

  if (kind === 'protection') {
    const rawVal = raw.protectiveCurrentA ?? raw.currentA;
    const protectiveCurrentA =
      rawVal && rawVal > 0 ? rawVal : undefined;
    const rawPoles = raw.poles;
    const poles =
      rawPoles && Number.isInteger(rawPoles) && rawPoles >= 1 && rawPoles <= 8
        ? rawPoles
        : 1;
    const breakingCapacityA =
      raw.breakingCapacityA && raw.breakingCapacityA > 0
        ? raw.breakingCapacityA
        : undefined;
    const residualCurrentA =
      raw.residualCurrentA && raw.residualCurrentA > 0
        ? raw.residualCurrentA
        : undefined;
    const characteristic =
      raw.characteristic && raw.characteristic.trim().length <= 80
        ? raw.characteristic.trim().toUpperCase()
        : undefined;
    const conventionalTripA =
      raw.conventionalTripA && raw.conventionalTripA > 0
        ? raw.conventionalTripA
        : undefined;

    const data: ArticleElectricalData = {
      version: 1,
      kind: 'protection',
      source,
      currentType,
      ratedVoltageV,
      poles,
      ...(protectiveCurrentA ? { protectiveCurrentA } : {}),
      ...(breakingCapacityA ? { breakingCapacityA } : {}),
      ...(residualCurrentA ? { residualCurrentA } : {}),
      ...(characteristic ? { characteristic } : {}),
      ...(conventionalTripA ? { conventionalTripA } : {}),
      ...(raw.conditions && raw.conditions.trim()
        ? { conditions: raw.conditions.trim() }
        : {}),
    };
    return validateElectricalData(data);
  }

  if (kind === 'load') {
    const rawVal = raw.currentA ?? raw.protectiveCurrentA;
    const currentA = rawVal && rawVal > 0 ? rawVal : undefined;
    const outputPowerW =
      raw.outputPowerW && raw.outputPowerW > 0 ? raw.outputPowerW : undefined;
    const efficiency =
      raw.efficiency && raw.efficiency > 0 && raw.efficiency <= 1
        ? raw.efficiency
        : undefined;
    const cosPhi =
      raw.cosPhi && raw.cosPhi > 0 && raw.cosPhi <= 1 ? raw.cosPhi : undefined;

    const data: ArticleElectricalData = {
      version: 1,
      kind: 'load',
      source,
      currentType,
      ratedVoltageV,
      ...(currentA ? { currentA } : {}),
      ...(outputPowerW ? { outputPowerW } : {}),
      ...(efficiency ? { efficiency } : {}),
      ...(cosPhi ? { cosPhi } : {}),
      ...(raw.conditions && raw.conditions.trim()
        ? { conditions: raw.conditions.trim() }
        : {}),
    };
    return validateElectricalData(data);
  }

  // kind === 'cable'
  const conditions =
    raw.conditions && raw.conditions.trim()
      ? raw.conditions.trim()
      : raw.ampacityA
        ? 'Standard-Verlegeart C bei 30°C'
        : undefined;
  const data: ArticleElectricalData = {
    version: 1,
    kind: 'cable',
    source,
    currentType,
    ratedVoltageV,
    ...(raw.sectionMm2 && raw.sectionMm2 > 0 ? { sectionMm2: raw.sectionMm2 } : {}),
    ...(raw.cores && raw.cores > 0 ? { cores: raw.cores } : {}),
    ...(raw.resistance20OhmKm && raw.resistance20OhmKm > 0
      ? { resistance20OhmKm: raw.resistance20OhmKm }
      : {}),
    ...(raw.reactanceOhmKm && raw.reactanceOhmKm > 0
      ? { reactanceOhmKm: raw.reactanceOhmKm }
      : {}),
    ...(raw.ampacityA && raw.ampacityA > 0 && conditions
      ? { ampacityA: raw.ampacityA, conditions }
      : {}),
    ...(raw.adiabaticK && raw.adiabaticK > 0 ? { adiabaticK: raw.adiabaticK } : {}),
    ...(raw.material && ['copper', 'aluminium'].includes(raw.material)
      ? { material: raw.material }
      : { material: 'copper' }),
  };
  return validateElectricalData(data);
}

function extractUniquePinNames(
  symPins?: Array<{ id: string; name?: string }>,
): string[] {
  if (!symPins || symPins.length === 0) return [];
  const names: string[] = [];
  const seen = new Set<string>();
  for (const p of symPins) {
    let candidate = (p.name || p.id).trim();
    if (!candidate || seen.has(candidate)) {
      if (candidate === 'N') {
        candidate = 'N2';
      } else {
        candidate = p.id.trim();
      }
    }
    if (seen.has(candidate)) {
      let suffix = 2;
      while (seen.has(`${candidate}${suffix}`)) {
        suffix++;
      }
      candidate = `${candidate}${suffix}`;
    }
    seen.add(candidate);
    names.push(candidate);
  }
  return names;
}

/**
 * Derives valid function slot templates for an article from its symbol definition and kind.
 */
export function deriveArticleFunctions(
  article: CatalogArticle,
  symbolId?: string,
  project?: Project,
): NonNullable<CatalogArticle['functions']> {
  if (article.functions && article.functions.length > 0) {
    return structuredClone(article.functions);
  }

  const symId = symbolId || article.symbolId;
  const sym = symId ? getSymbolById(symId, project) : undefined;
  const pins = extractUniquePinNames(sym?.pins);

  let rawList: NonNullable<CatalogArticle['functions']>;

  if (symId && symId.includes('contactor')) {
    rawList = [
      { id: 'coil', type: 'relay_coil', pins: ['A1', 'A2'], required: true },
      { id: 'power', type: 'power_contact_3p', pins: ['1', '2', '3', '4', '5', '6'], required: true },
      { id: 'aux', type: 'contact_no', pins: ['13', '14'] },
    ];
  } else if (symId === 'circuit_breaker_3p') {
    rawList = [
      { id: 'main', type: 'symbol:circuit_breaker_3p', pins: pins.length ? pins : ['1', '2', '3', '4', '5', '6'], required: true },
    ];
  } else if (symId === 'circuit_breaker_1p') {
    rawList = [
      { id: 'main', type: 'symbol:circuit_breaker_1p', pins: pins.length ? pins : ['1', '2'], required: true },
    ];
  } else if (symId === 'rcd_4p') {
    rawList = [
      { id: 'main', type: 'symbol:rcd_4p', pins: pins.length ? pins : ['1', '2', '3', '4', '5', '6', 'N', 'N2'], required: true },
    ];
  } else if (symId === 'rcd_2p') {
    rawList = [
      { id: 'main', type: 'symbol:rcd_2p', pins: pins.length ? pins : ['1', '2', 'N', 'N2'], required: true },
    ];
  } else if (symId === 'rcbo_1p_n') {
    rawList = [
      { id: 'main', type: 'symbol:rcbo_1p_n', pins: pins.length ? pins : ['1', '2', 'N', 'N2'], required: true },
    ];
  } else if (symId === 'motor_protective_switch') {
    rawList = [
      { id: 'main', type: 'symbol:motor_protective_switch', pins: pins.length ? pins : ['1', '2', '3', '4', '5', '6'], required: true },
    ];
  } else if (symId === 'power_supply_dc') {
    rawList = [
      { id: 'pwr', type: 'symbol:power_supply_dc', pins: pins.length ? pins : ['L', 'N', '+', '-'], required: true },
    ];
  } else if (symId === 'socket_schuko') {
    rawList = [
      { id: 'socket', type: 'symbol:socket_schuko', pins: pins.length ? pins : ['L', 'N', 'PE'], required: true },
    ];
  } else if (symId === 'terminal_single') {
    rawList = [
      { id: 'terminal', type: 'symbol:terminal_single', pins: pins.length ? pins : ['1', '2'], required: true },
    ];
  } else if (sym) {
    const fType = functionType(sym) || sym.functionDefinition || ('symbol:' + sym.id);
    rawList = [
      { id: 'main', type: fType, pins: pins.length ? pins : ['1', '2'], required: true },
    ];
  } else {
    rawList = [
      { id: 'main', type: 'general_device', pins: ['1', '2'], required: true },
    ];
  }

  // Ensure 100% unique function IDs and unique pin names within each function
  const seenIds = new Set<string>();
  return rawList.map((f, i) => {
    let id = f.id.trim() || `func_${i + 1}`;
    if (seenIds.has(id)) {
      id = `${id}_${i + 1}`;
    }
    seenIds.add(id);

    const pinSeen = new Set<string>();
    const uniquePins: string[] = [];
    for (const rawPin of f.pins) {
      let p = String(rawPin).trim();
      if (!p) continue;
      if (pinSeen.has(p)) {
        let n = 2;
        while (pinSeen.has(`${p}${n}`)) n++;
        p = `${p}${n}`;
      }
      pinSeen.add(p);
      uniquePins.push(p);
    }

    return {
      id,
      type: f.type.trim(),
      pins: uniquePins.length ? uniquePins : ['1', '2'],
      ...(f.required !== undefined ? { required: Boolean(f.required) } : {}),
    };
  });
}

/**
 * Intelligent domain heuristics for standard electrical devices across all major
 * manufacturers (Siemens, ABB, Eaton, Hager, Schneider, Wago, Phoenix Contact, Mean Well, etc.).
 */
export function completeArticleHeuristics(
  article: CatalogArticle,
  project?: Project,
): CatalogArticle {
  const next: CatalogArticle = structuredClone(article);
  const mfr = (next.manufacturer || '').toLowerCase();
  const artNo = (next.articleNumber || '').toUpperCase().trim();
  const rawDesc = (next.description || '').trim();

  let detectedSymbolId: string | undefined = next.symbolId;
  let detectedWidthMm: number | undefined = next.dimensions?.widthMm;
  let detectedHeightMm: number | undefined = next.dimensions?.heightMm;
  let detectedDepthMm: number | undefined = next.dimensions?.depthMm;
  let detectedKind: string | undefined = next.electrical?.kind;
  let detectedCurrentA: number | undefined =
    next.electrical?.kind === 'protection'
      ? next.electrical.protectiveCurrentA
      : next.electrical?.currentA;
  let detectedVoltageV: number | undefined = next.electrical?.ratedVoltageV;
  let detectedBreakingCapacityA: number | undefined =
    next.electrical?.kind === 'protection'
      ? next.electrical.breakingCapacityA
      : undefined;
  let detectedResidualCurrentA: number | undefined =
    next.electrical?.kind === 'protection'
      ? next.electrical.residualCurrentA
      : undefined;
  let detectedCharacteristic: string | undefined =
    next.electrical?.kind === 'protection'
      ? next.electrical.characteristic
      : undefined;
  let detectedPoles: number | undefined =
    next.electrical?.kind === 'protection' ? next.electrical.poles : undefined;
  let cleanDesc: string | undefined = next.description;

  // 1. Regex extractions from part number or description
  // Siemens MCB: 5SL6316-7 -> 3-pole, 16A, C char
  const siemensMcb = artNo.match(/^5S[LY][346]([1-4])(\d{2})-([5678])$/i);
  if (siemensMcb) {
    if (!detectedPoles) detectedPoles = parseInt(siemensMcb[1], 10);
    if (!detectedCurrentA) detectedCurrentA = parseInt(siemensMcb[2], 10);
    if (!detectedCharacteristic) {
      const charDigit = siemensMcb[3];
      detectedCharacteristic = charDigit === '6' ? 'B' : charDigit === '7' ? 'C' : charDigit === '8' ? 'D' : 'B';
    }
  }

  // ABB MCB: S201-C16, S203-B16
  const abbMcb = artNo.match(/^S20([1-4])(?:[A-Z]*)-([BCD])(\d{1,2})$/i);
  if (abbMcb) {
    if (!detectedPoles) detectedPoles = parseInt(abbMcb[1], 10);
    if (!detectedCharacteristic) detectedCharacteristic = abbMcb[2].toUpperCase();
    if (!detectedCurrentA) detectedCurrentA = parseInt(abbMcb[3], 10);
  }

  // Hager MCB: MBN316 (B, 3P, 16A), MCN116 (C, 1P, 16A)
  const hagerMcb = artNo.match(/^M([BC])N([1-4])(\d{2})$/i);
  if (hagerMcb) {
    if (!detectedCharacteristic) detectedCharacteristic = hagerMcb[1].toUpperCase();
    if (!detectedPoles) detectedPoles = parseInt(hagerMcb[2], 10);
    if (!detectedCurrentA) detectedCurrentA = parseInt(hagerMcb[3], 10);
  }

  // Eaton MCB: FAZ-C16/3
  const eatonMcb = artNo.match(/^FAZ-([BCD])(\d{1,2})\/([1-4])$/i);
  if (eatonMcb) {
    if (!detectedCharacteristic) detectedCharacteristic = eatonMcb[1].toUpperCase();
    if (!detectedCurrentA) detectedCurrentA = parseInt(eatonMcb[2], 10);
    if (!detectedPoles) detectedPoles = parseInt(eatonMcb[3], 10);
  }

  // Residual current (e.g. /0.03, 30mA, 300mA)
  const resMatch = artNo.match(/\/(0\.\d{2,3})\b/) || rawDesc.match(/(\d+)\s*mA\b/i);
  if (resMatch && !detectedResidualCurrentA) {
    if (resMatch[0].includes('mA')) {
      detectedResidualCurrentA = parseFloat(resMatch[1]) / 1000;
    } else {
      detectedResidualCurrentA = parseFloat(resMatch[1]);
    }
  }

  // General current match
  const curMatch =
    artNo.match(/[-_ /](?:C|B|D)?(\d{1,3})(?:A|[\/-]|$)/i) ||
    artNo.match(/(?:[BCD])(\d{1,3})(?:[\/-]|$)/) ||
    rawDesc.match(/(\d+(?:\.\d+)?)\s*(?:A|Ampere)\b/i);
  if (curMatch && !detectedCurrentA) {
    const val = parseFloat(curMatch[1]);
    if (val > 0 && val <= 2500) detectedCurrentA = val;
  }

  const charMatch =
    artNo.match(/\b([BCD])\d{1,3}\b/) ||
    artNo.match(/[-_]([BCD])\b/) ||
    rawDesc.match(/\bCharakteristik\s+([BCD])\b/i) ||
    rawDesc.match(/\b([BCD])(?:16|10|13|20|25|32|40|6|4|2)\b/i);
  if (charMatch && !detectedCharacteristic) {
    detectedCharacteristic = charMatch[1].toUpperCase();
  }

  const poleMatch = rawDesc.match(/(\d+)[- ]*(?:polig|pol|pole|p)\b/i) || artNo.match(/[-_](\d)P\b/i);
  if (poleMatch && !detectedPoles) {
    detectedPoles = parseInt(poleMatch[1], 10);
  }

  const kaMatch = rawDesc.match(/(\d+(?:\.\d+)?)\s*kA\b/i) || artNo.match(/(\d+)KA\b/i);
  if (kaMatch && !detectedBreakingCapacityA) {
    detectedBreakingCapacityA = parseFloat(kaMatch[1]) * 1000;
  }

  // 2. Specific Manufacturer Families
  // A. Miniature Circuit Breakers (MCB / LS-Schalter)
  if (
    /5SL[63]|5SY[46]|S20[1234]|MBN|MCN|FAZ|A9F/i.test(artNo) ||
    /leitungsschutzschalter|ls-schalter|circuit breaker|mcb/i.test(rawDesc)
  ) {
    detectedKind = 'mcb';
    if (!detectedPoles) {
      if (/5SL[63]1|S201|MBN1|MCN1/i.test(artNo)) detectedPoles = 1;
      else if (/5SL[63]2|S202|MBN2|MCN2/i.test(artNo)) detectedPoles = 2;
      else if (/5SL[63]3|S203|MBN3|MCN3/i.test(artNo)) detectedPoles = 3;
      else if (/5SL[63]4|S204|MBN4|MCN4/i.test(artNo)) detectedPoles = 4;
      else detectedPoles = 1;
    }

    if (!detectedSymbolId) {
      detectedSymbolId = detectedPoles >= 3 ? 'circuit_breaker_3p' : 'circuit_breaker_1p';
    }

    if (!detectedVoltageV) {
      detectedVoltageV = detectedPoles >= 3 ? 400 : 230;
    }

    if (!detectedBreakingCapacityA) {
      detectedBreakingCapacityA = /5SL6|6KA/i.test(artNo + rawDesc) ? 6000 : 10000;
    }

    if (!detectedWidthMm) {
      detectedWidthMm = detectedPoles * 18;
      detectedHeightMm = 90;
      detectedDepthMm = 76;
    }

    if (!cleanDesc || cleanDesc === artNo || cleanDesc.length < 10) {
      const charStr = detectedCharacteristic ? detectedCharacteristic : 'C';
      const ampStr = detectedCurrentA ? `${detectedCurrentA}A` : '16A';
      const kaStr = detectedBreakingCapacityA ? `${detectedBreakingCapacityA / 1000}kA` : '6kA';
      cleanDesc = `Leitungsschutzschalter ${detectedPoles}P ${charStr}${ampStr} ${kaStr} ${detectedVoltageV}V (${detectedPoles} TE)`;
    }
  }

  // B. Residual Current Devices (RCD / FI-Schutzschalter)
  else if (
    /5SV[34]|FH20[24]|F20[24]|CDA|CFR/i.test(artNo) ||
    /fi-schutzschalter|fehlerstromschutzschalter|rcd/i.test(rawDesc)
  ) {
    detectedKind = 'rcd';
    if (!detectedPoles) {
      detectedPoles = /204|4P|4-pol/i.test(artNo + rawDesc) ? 4 : 2;
    }
    if (!detectedResidualCurrentA) {
      detectedResidualCurrentA = 0.03; // Standard 30mA
    }
    if (!detectedSymbolId) {
      detectedSymbolId = detectedPoles >= 4 ? 'rcd_4p' : 'rcd_2p';
    }
    if (!detectedVoltageV) {
      detectedVoltageV = detectedPoles >= 4 ? 400 : 230;
    }
    if (!detectedWidthMm) {
      detectedWidthMm = detectedPoles === 4 ? 72 : 36;
      detectedHeightMm = 90;
      detectedDepthMm = 70;
    }
    if (!cleanDesc || cleanDesc === artNo || cleanDesc.length < 10) {
      const ampStr = detectedCurrentA ? `${detectedCurrentA}A` : '40A';
      const maStr = `${Math.round(detectedResidualCurrentA * 1000)}mA`;
      cleanDesc = `FI-Schutzschalter ${detectedPoles}P ${ampStr} ${maStr} Typ A (${detectedPoles === 4 ? 4 : 2} TE)`;
    }
  }

  // C. Combined RCBO (FI/LS-Schalter)
  else if (
    /5SV1|DS201|ADS/i.test(artNo) ||
    /fi\/ls|rcbo/i.test(rawDesc)
  ) {
    detectedKind = 'rcbo';
    detectedPoles = 2;
    if (!detectedResidualCurrentA) detectedResidualCurrentA = 0.03;
    if (!detectedCurrentA) {
      const match =
        artNo.match(/(?:KK|AK|KL|-)?(6|10|13|16|20|25|32|40)$/i) ||
        artNo.match(/5SV1\d(\d{2})/i);
      detectedCurrentA = match ? parseInt(match[1], 10) : 16;
    }
    if (!detectedCharacteristic) {
      if (/-6/i.test(artNo)) detectedCharacteristic = 'C';
      else if (/-7/i.test(artNo)) detectedCharacteristic = 'B';
      else detectedCharacteristic = 'B';
    }
    if (!detectedBreakingCapacityA) detectedBreakingCapacityA = 6000;
    if (!detectedSymbolId) detectedSymbolId = 'rcbo_1p_n';
    if (!detectedVoltageV) detectedVoltageV = 230;
    if (!detectedWidthMm) {
      const is1Te = /5SV1|1 TE|kompakt/i.test(artNo + rawDesc);
      detectedWidthMm = is1Te ? 18 : 36;
      detectedHeightMm = 90;
      detectedDepthMm = 76;
    }
    if (!cleanDesc || cleanDesc === artNo || cleanDesc.length < 10) {
      const ampStr = `${detectedCurrentA}A`;
      const charStr = detectedCharacteristic || 'B';
      cleanDesc = `FI/LS-Kombischalter 1P+N ${charStr}${ampStr} 30mA Typ A 6kA (${detectedWidthMm === 18 ? '1 TE' : '2 TE'})`;
    }
  }

  // D. Contactors (Schütze / Leistungsschütze)
  else if (
    /3RT20|AF09|AF16|AF26|DILM|LC1D/i.test(artNo) ||
    /leistungsschütz|motorschütz|schütz|contactor/i.test(rawDesc)
  ) {
    detectedKind = 'contactor';
    detectedPoles = 3;
    if (!detectedSymbolId) detectedSymbolId = 'contactor_power_3p';
    if (!detectedVoltageV) detectedVoltageV = 400;
    if (!detectedWidthMm) {
      detectedWidthMm = 45;
      detectedHeightMm = 85;
      detectedDepthMm = 73;
    }
    if (!cleanDesc || cleanDesc === artNo || cleanDesc.length < 10) {
      const ampStr = detectedCurrentA ? ` ${detectedCurrentA}A` : '';
      cleanDesc = `Leistungsschütz 3-polig 400V${ampStr} Steuerspannung 24V DC / 230V AC`;
    }
  }

  // E. Motor Protective Switch (Motorschutzschalter)
  else if (
    /3RV20|MS116|MS132|PKZM0|GV2P/i.test(artNo) ||
    /motorschutzschalter/i.test(rawDesc)
  ) {
    detectedKind = 'motor_protective_switch';
    detectedPoles = 3;
    if (!detectedSymbolId) detectedSymbolId = 'motor_protective_switch';
    if (!detectedVoltageV) detectedVoltageV = 400;
    if (!detectedWidthMm) {
      detectedWidthMm = 45;
      detectedHeightMm = 97;
      detectedDepthMm = 96;
    }
    if (!cleanDesc || cleanDesc === artNo || cleanDesc.length < 10) {
      cleanDesc = `Motorschutzschalter 3-polig 400V mit Überlast- und Kurzschlussauslöser`;
    }
  }

  // F. Power Supplies (Schaltnetzteile / Hutschienen-Netzteile)
  else if (
    /HDR-|NDR-|EDR-|QUINT|TRIO|STEP|SITOP/i.test(artNo) ||
    /netzteil|stromversorgung|power supply/i.test(rawDesc)
  ) {
    detectedKind = 'power_supply';
    if (!detectedSymbolId) detectedSymbolId = 'power_supply_dc';
    if (!detectedVoltageV) detectedVoltageV = 230;
    if (!detectedWidthMm) {
      detectedWidthMm = /HDR-30/i.test(artNo) ? 35 : /HDR-60/i.test(artNo) ? 52.5 : /NDR-120/i.test(artNo) ? 40 : 35;
      detectedHeightMm = 90;
      detectedDepthMm = 58;
    }
    if (!cleanDesc || cleanDesc === artNo || cleanDesc.length < 10) {
      const outV = /12V|12-24/i.test(artNo + rawDesc) ? '12V' : '24V';
      cleanDesc = `Hutschienen-Schaltnetzteil Eingang 100-240V AC, Ausgang ${outV} DC`;
    }
  }

  // G. Surge Protective Device (SPD / Überspannungsableiter)
  else if (
    /952|VAL-MS|5SD|V20/i.test(artNo) ||
    /überspannungsschutz|dehnguard|surge arrester|spd/i.test(rawDesc)
  ) {
    detectedKind = 'surge_arrester';
    if (!detectedSymbolId) detectedSymbolId = 'surge_arrester_spd';
    if (!detectedVoltageV) detectedVoltageV = 400;
    if (!detectedWidthMm) {
      detectedWidthMm = 72;
      detectedHeightMm = 90;
      detectedDepthMm = 66;
    }
    if (!cleanDesc || cleanDesc === artNo || cleanDesc.length < 10) {
      cleanDesc = `Überspannungsschutzableiter Typ 1+2 / Typ 2 für Haupt- und Unterverteiler`;
    }
  }

  // H. Impulse Relays (Stromstoßschalter)
  else if (
    /E290|5TT|FIN\s*2[06]/i.test(artNo) ||
    /stromstoßschalter|stromstoss/i.test(rawDesc)
  ) {
    detectedKind = 'contactor';
    if (!detectedSymbolId) detectedSymbolId = 'impulse_relay_1no';
    if (!detectedVoltageV) detectedVoltageV = 230;
    if (!detectedWidthMm) {
      detectedWidthMm = 18;
      detectedHeightMm = 85;
      detectedDepthMm = 62;
    }
    if (!cleanDesc || cleanDesc === artNo || cleanDesc.length < 10) {
      cleanDesc = `Elektromagnetischer Stromstoßschalter 16A 1S 230V AC für Reiheneinbau (1 TE)`;
    }
  }

  // I. Sockets (Steckdosen)
  else if (
    /20\s*EUC|SCHUKO/i.test(artNo + rawDesc) ||
    /steckdose|socket/i.test(rawDesc)
  ) {
    detectedKind = 'load';
    if (!detectedSymbolId) detectedSymbolId = 'socket_schuko';
    if (!detectedVoltageV) detectedVoltageV = 230;
    if (!detectedCurrentA) detectedCurrentA = 16;
    if (!detectedWidthMm) {
      detectedWidthMm = 71;
      detectedHeightMm = 71;
      detectedDepthMm = 32;
    }
    if (!cleanDesc || cleanDesc === artNo || cleanDesc.length < 10) {
      cleanDesc = `SCHUKO Steckdosen-Einsatz 16A 250V mit Steckklemmen`;
    }
  }

  // J. Terminal Blocks (Reihenklemmen)
  else if (
    /2002-|2004-|UT\s*2|UT\s*4|WDU/i.test(artNo) ||
    /reihenklemme|durchgangsklemme|terminal/i.test(rawDesc)
  ) {
    detectedKind = 'protection';
    if (!detectedSymbolId) detectedSymbolId = 'terminal_single';
    if (!detectedWidthMm) {
      detectedWidthMm = 5.2;
      detectedHeightMm = 48;
      detectedDepthMm = 36;
    }
    if (!cleanDesc || cleanDesc === artNo || cleanDesc.length < 10) {
      cleanDesc = `Reihenklemme Durchgangsklemme 2.5mm² mit Feder-/Schraubanschluss`;
    }
  }

  // 3. Fallback verification against library symbols
  if (detectedSymbolId && project) {
    const sym = getSymbolById(detectedSymbolId, project);
    if (!sym) {
      const defs = getSymbolDefinitions(project);
      const match = defs.find((s) => s.id === detectedSymbolId);
      if (!match) {
        detectedSymbolId = next.symbolId;
      }
    }
  }

  // 4. Update the article object
  if (cleanDesc) next.description = cleanDesc;
  if (detectedSymbolId) next.symbolId = detectedSymbolId;

  if (detectedWidthMm && detectedHeightMm) {
    next.dimensions = {
      widthMm: detectedWidthMm,
      heightMm: detectedHeightMm,
      depthMm: detectedDepthMm ?? 70,
    };
  }

  // 5. Determine and assign electrical ratings with strict schema validation
  let electricalKind: 'protection' | 'cable' | 'load' = 'protection';
  if (detectedKind === 'cable' || /kabel|leitung|nym/i.test(artNo + rawDesc)) {
    electricalKind = 'cable';
  } else if (
    detectedKind === 'power_supply' ||
    detectedKind === 'load' ||
    /netzteil|stromversorgung|power supply|verbraucher|motor\b|steckdose|socket|leuchte|lampe/i.test(
      artNo + rawDesc,
    )
  ) {
    electricalKind = 'load';
  } else {
    electricalKind = 'protection';
  }

  try {
    next.electrical = buildValidElectricalData(electricalKind, {
      ratedVoltageV: detectedVoltageV ?? next.electrical?.ratedVoltageV ?? 230,
      currentA: detectedCurrentA,
      protectiveCurrentA: detectedCurrentA,
      breakingCapacityA: detectedBreakingCapacityA,
      characteristic: detectedCharacteristic,
      residualCurrentA: detectedResidualCurrentA,
      poles: detectedPoles,
      source: next.electrical?.source || 'Herstellerkatalog / Datenblatt',
      conditions: next.electrical?.conditions,
      currentType: next.electrical?.currentType || 'ac',
    });
  } catch {
    // If validation fails for any reason, safely ignore to avoid corrupting existing data
  }

  // 6. Always derive valid function slots if missing
  next.functions = deriveArticleFunctions(next, detectedSymbolId, project);

  return next;
}

/**
 * Completes an article using AI (Gemini or OpenRouter), with automatic heuristic fallback.
 */
export async function completeArticleWithAi(
  article: CatalogArticle,
  options: {
    project?: Project;
    apiKey?: string;
    provider?: string;
    model?: string;
  } = {},
): Promise<{ article: CatalogArticle; usedAi: boolean; enrichedFields: string[] }> {
  // Always run heuristics first as solid foundation
  const base = completeArticleHeuristics(article, options.project);

  const provider = options.provider || getAiProvider();
  const isRouter = provider === 'openrouter';
  const apiKey = (options.apiKey || (isRouter ? getOpenRouterKey() : getGeminiApiKey())).trim();

  // If no API key configured, return heuristics directly
  if (!apiKey) {
    const missingBefore = missingFieldNames(article);
    const missingAfter = missingFieldNames(base);
    const enriched = missingBefore.filter((f) => !missingAfter.includes(f));
    return { article: base, usedAi: false, enrichedFields: enriched };
  }

  const prompt = `Du bist ein führender Experte für elektrotechnische Stammdaten, Bauteilkataloge und CAD-Funktionsschablonen.
Deine Aufgabe ist es, für den folgenden Artikel ALLE fehlenden Stammdaten vollständig, normgerecht und präzise auszufüllen:
- Hersteller: "${article.manufacturer}"
- Artikelnummer: "${article.articleNumber}"
- Variante: "${article.variant || ''}"
- Vorhandene Beschreibung: "${article.description || ''}"

WICHTIGE ANWEISUNGEN:
1. Fülle ALLE Felder im JSON vollständig und detailliert aus.
2. Wähle die genaue "Artikelfunktion" (kind):
   - "protection": für Schutzgeräte (Leitungsschutzschalter MCB, FI-Schutzschalter RCD, FI/LS-Kombischalter RCBO, Motorschutzschalter, Schmelzsicherungen, Überspannungsableiter SPD, Schütze)
   - "cable": für Kabel und Leitungen
   - "load": für Verbraucher (Netzteile, Schaltnetzteile, Motoren, Steckdosen, Leuchten)
3. Wähle das exakt passende "symbolId" aus Schematico (z. B. circuit_breaker_1p, circuit_breaker_3p, rcd_2p, rcd_4p, rcbo_1p_n, contactor_power_3p, contactor_coil, motor_protective_switch, power_supply_dc, surge_arrester_spd, impulse_relay_1no, socket_schuko, terminal_single, motor_3phase, switch_emergency_stop, pilot_lamp).
4. Bestimme die realen Einbaumaße (dimensions): Bei Reiheneinbaugeräten (REG) immer Breite = Polzahl * 18 mm (1 TE = 18 mm, 2 TE = 36 mm, 3 TE = 54 mm, 4 TE = 72 mm), Höhe ca. 85-90 mm, Tiefe ca. 70-76 mm.
5. Bestimme alle elektrischen Kennwerte (electrical) passend zum Typ:
   - Bei protection: ratedVoltageV (z. B. 230 oder 400), protectiveCurrentA (Nennstrom in A), breakingCapacityA (Kurzschlussausschaltvermögen in A, z. B. 6000 für 6kA, 10000 für 10kA), characteristic ("B", "C", "D"), residualCurrentA (bei RCD/RCBO z. B. 0.03 für 30mA), poles (1..8).
   - Bei load: ratedVoltageV, currentA (Nennstrom), outputPowerW (Leistung in W), currentType ("ac" oder "dc").
   - Bei cable: ratedVoltageV, sectionMm2 (Querschnitt), cores (Aderzahl), material ("copper").
6. Bestimme die Funktionsschablonen (functions):
   - Jede Funktion hat { "id": string, "type": string, "pins": string[], "required": boolean }.
   - Z. B. für Schütz: Coil A1/A2, Power 1/2/3/4/5/6, Aux 13/14.
   - Z. B. für MCB 3P: Main 1/2/3/4/5/6.

Antworte ausschließlich mit reinem JSON im folgenden Format:
{
  "description": "Ausführliche deutsche Artikelbezeichnung inklusive aller Nenngrößen",
  "symbolId": "symbolId aus der obigen Liste",
  "dimensions": {
    "widthMm": number,
    "heightMm": number,
    "depthMm": number
  },
  "electrical": {
    "kind": "protection" | "load" | "cable",
    "ratedVoltageV": number,
    "protectiveCurrentA": number,
    "currentA": number,
    "breakingCapacityA": number,
    "residualCurrentA": number,
    "characteristic": string,
    "poles": number,
    "currentType": "ac" | "dc" | "ac_dc",
    "source": "Hersteller-Datenblatt"
  },
  "functions": [
    { "id": "main", "type": "symbol:circuit_breaker_3p", "pins": ["1", "2", "3", "4", "5", "6"], "required": true }
  ]
}`;

  try {
    let responseText = '';
    if (isRouter) {
      const model = options.model || getOpenRouterModel();
      const res = await routerRequest(
        '/chat/completions',
        apiKey,
        {
          model,
          messages: [
            {
              role: 'system',
              content:
                'You are an electrical engineering catalog data expert. Output valid JSON only.',
            },
            { role: 'user', content: prompt },
          ],
          max_tokens: 1200,
          temperature: 0.1,
        },
      );
      responseText = res.choices?.[0]?.message?.content ?? '';
    } else {
      const ai = new GoogleGenAI({ apiKey });
      const model = options.model || getGeminiModel();
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });
      responseText = response.text || '';
    }

    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(cleanJson);

    const result: CatalogArticle = structuredClone(base);

    if (typeof data.description === 'string' && data.description.trim().length > 3) {
      result.description = data.description.trim();
    }

    if (typeof data.symbolId === 'string' && data.symbolId.trim()) {
      result.symbolId = data.symbolId.trim();
    }

    if (data.dimensions && typeof data.dimensions === 'object') {
      const w = Number(data.dimensions.widthMm);
      const h = Number(data.dimensions.heightMm);
      const d = Number(data.dimensions.depthMm);
      if (Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0) {
        result.dimensions = {
          widthMm: w,
          heightMm: h,
          depthMm: Number.isFinite(d) && d > 0 ? d : 70,
        };
      }
    }

    if (data.electrical && typeof data.electrical === 'object') {
      const elecKind: 'protection' | 'cable' | 'load' =
        data.electrical.kind === 'cable'
          ? 'cable'
          : data.electrical.kind === 'load'
            ? 'load'
            : 'protection';
      try {
        result.electrical = buildValidElectricalData(elecKind, {
          ratedVoltageV:
            Number(data.electrical.ratedVoltageV) ||
            base.electrical?.ratedVoltageV ||
            230,
          protectiveCurrentA:
            Number(data.electrical.protectiveCurrentA ?? data.electrical.ratedCurrentA) ||
            (base.electrical?.kind === 'protection'
              ? base.electrical?.protectiveCurrentA
              : undefined),
          currentA:
            Number(data.electrical.currentA ?? data.electrical.ratedCurrentA) ||
            (base.electrical?.kind === 'load'
              ? base.electrical?.currentA
              : undefined),
          breakingCapacityA:
            Number(data.electrical.breakingCapacityA) ||
            (base.electrical?.kind === 'protection'
              ? base.electrical?.breakingCapacityA
              : undefined),
          residualCurrentA:
            Number(data.electrical.residualCurrentA) ||
            (base.electrical?.kind === 'protection'
              ? base.electrical?.residualCurrentA
              : undefined),
          poles:
            Number(data.electrical.poles) ||
            (base.electrical?.kind === 'protection'
              ? base.electrical?.poles
              : undefined),
          characteristic:
            typeof data.electrical.characteristic === 'string'
              ? data.electrical.characteristic
              : base.electrical?.kind === 'protection'
                ? base.electrical?.characteristic
                : undefined,
          currentType:
            data.electrical.currentType || base.electrical?.currentType || 'ac',
          source:
            data.electrical.source ||
            base.electrical?.source ||
            'Hersteller-Datenblatt',
          outputPowerW: Number(data.electrical.outputPowerW) || undefined,
        });
      } catch {
        // Fallback to base.electrical
      }
    }

    if (Array.isArray(data.functions) && data.functions.length > 0) {
      const validFuncs = data.functions
        .filter(
          (f: any) =>
            f &&
            typeof f.id === 'string' &&
            typeof f.type === 'string' &&
            Array.isArray(f.pins) &&
            f.pins.length > 0,
        )
        .map((f: any, i: number) => {
          const pinSeen = new Set<string>();
          const uniquePins: string[] = [];
          for (const rawPin of f.pins) {
            let p = String(rawPin).trim();
            if (!p) continue;
            if (pinSeen.has(p)) {
              let n = 2;
              while (pinSeen.has(`${p}${n}`)) n++;
              p = `${p}${n}`;
            }
            pinSeen.add(p);
            uniquePins.push(p);
          }
          return {
            id: String(f.id).trim() || `func_${i + 1}`,
            type: String(f.type).trim(),
            pins: uniquePins,
            required: Boolean(f.required),
          };
        })
        .filter((f: any) => f.pins.length > 0);

      if (validFuncs.length > 0) {
        const idSeen = new Set<string>();
        result.functions = validFuncs.map((f: any, i: number) => {
          let id = f.id;
          if (idSeen.has(id)) {
            id = `${id}_${i + 1}`;
          }
          idSeen.add(id);
          return { ...f, id };
        });
      }
    }
    if (!result.functions || result.functions.length === 0) {
      result.functions = deriveArticleFunctions(result, result.symbolId, options.project);
    }

    const missingBefore = missingFieldNames(article);
    const missingAfter = missingFieldNames(result);
    const enriched = missingBefore.filter((f) => !missingAfter.includes(f));

    return { article: result, usedAi: true, enrichedFields: enriched };
  } catch {
    // If AI generation fails, heuristic completion still succeeds
    const missingBefore = missingFieldNames(article);
    const missingAfter = missingFieldNames(base);
    const enriched = missingBefore.filter((f) => !missingAfter.includes(f));
    return { article: base, usedAi: false, enrichedFields: enriched };
  }
}

/**
 * Completes a batch of articles with progress reporting.
 */
export async function completeArticlesBatchWithAi(
  articles: CatalogArticle[],
  onProgress?: (completed: number, total: number, current: CatalogArticle) => void,
  options?: { project?: Project; apiKey?: string },
): Promise<CatalogArticle[]> {
  const completedList: CatalogArticle[] = [];
  const total = articles.length;

  for (let i = 0; i < total; i++) {
    const item = articles[i];
    const { article: completed } = await completeArticleWithAi(item, options);
    completedList.push(completed);
    onProgress?.(i + 1, total, completed);
  }

  return completedList;
}
