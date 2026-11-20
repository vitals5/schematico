import type { CatalogArticle } from './ArticleTypes';
import type { Project, SymbolDefinition } from './types';
import { getSymbolById, getSymbolDefinitions } from './symbols';
import { getAiProvider, getOpenRouterKey, getOpenRouterModel } from '../ai/ProviderConfig';
import { getGeminiApiKey, getGeminiModel } from '../ai/GeminiConfig';
import { GoogleGenAI, Type } from '@google/genai';
import { routerRequest } from '../ai/openrouter/api';

export interface MissingArticleFields {
  description: boolean;
  symbolId: boolean;
  dimensions: boolean;
  electrical: boolean;
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

  return {
    description: missingDescription,
    symbolId: missingSymbol,
    dimensions: missingDimensions,
    electrical: missingElectrical,
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
  return names;
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
  let detectedCurrentA: number | undefined = next.electrical?.currentA;
  let detectedVoltageV: number | undefined = next.electrical?.ratedVoltageV;
  let detectedBreakingCapacityA: number | undefined = next.electrical?.breakingCapacityA;
  let detectedCharacteristic: string | undefined = next.electrical?.characteristic;
  let detectedPoles: number | undefined = next.electrical?.poles;
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
      cleanDesc = `FI-Schutzschalter ${detectedPoles}P ${ampStr} 30mA Typ A (${detectedPoles === 4 ? 4 : 2} TE)`;
    }
  }

  // C. Combined RCBO (FI/LS-Schalter)
  else if (
    /5SV1|DS201|ADS/i.test(artNo) ||
    /fi\/ls|rcbo/i.test(rawDesc)
  ) {
    detectedKind = 'rcbo';
    detectedPoles = 2;
    if (!detectedSymbolId) detectedSymbolId = 'rcbo_1p_n';
    if (!detectedVoltageV) detectedVoltageV = 230;
    if (!detectedWidthMm) {
      const is1Te = /5SV1|1 TE|kompakt/i.test(artNo + rawDesc);
      detectedWidthMm = is1Te ? 18 : 36;
      detectedHeightMm = 90;
      detectedDepthMm = 76;
    }
    if (!cleanDesc || cleanDesc === artNo || cleanDesc.length < 10) {
      const ampStr = detectedCurrentA ? `${detectedCurrentA}A` : '16A';
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
        detectedSymbolId = next.symbolId; // keep original if valid not found
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

  if (detectedKind || detectedCurrentA || detectedVoltageV) {
    const electricalKind: 'protection' | 'cable' | 'load' =
      detectedKind === 'cable'
        ? 'cable'
        : ['mcb', 'rcd', 'rcbo', 'fuse', 'spd', 'contactor', 'motor_starter', 'protection'].includes(
            detectedKind || '',
          )
          ? 'protection'
          : 'load';
    next.electrical = {
      version: 1,
      source: next.electrical?.source || 'heuristic_completion',
      ...(next.electrical || {}),
      kind: electricalKind,
      currentType: next.electrical?.currentType || 'ac',
      ratedVoltageV: detectedVoltageV ?? next.electrical?.ratedVoltageV ?? 230,
      currentA: detectedCurrentA ?? next.electrical?.currentA,
      breakingCapacityA: detectedBreakingCapacityA ?? next.electrical?.breakingCapacityA,
      characteristic: detectedCharacteristic ?? next.electrical?.characteristic,
      poles: detectedPoles ?? next.electrical?.poles ?? 1,
    };
  }

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

  const prompt = `Du bist ein Experte für elektrotechnische Stammdaten und CAD-Bauteilkataloge.
Vervollständige die fehlenden Daten für folgenden Elektro-Artikel:
- Hersteller: "${article.manufacturer}"
- Artikelnummer: "${article.articleNumber}"
- Variante: "${article.variant || ''}"
- Vorhandene Beschreibung: "${article.description || ''}"

Antworte ausschließlich im JSON-Format mit folgenden Feldern:
{
  "description": "Prägnante, professionelle deutsche Artikelbeschreibung (z. B. 'Leitungsschutzschalter 3P C16A 6kA 400V')",
  "symbolId": "Passendes Standard-Symbol aus der Liste: circuit_breaker_1p, circuit_breaker_3p, rcd_2p, rcd_4p, rcbo_1p_n, contactor_power_3p, contactor_coil, motor_protective_switch, power_supply_dc, surge_arrester_spd, impulse_relay_1no, socket_schuko, terminal_single, motor_3phase, switch_emergency_stop, pilot_lamp",
  "dimensions": {
    "widthMm": Zahl in mm (z. B. 18 für 1 TE, 54 für 3 TE, 45 für Schütz),
    "heightMm": Zahl in mm (z. B. 90),
    "depthMm": Zahl in mm (z. B. 76)
  },
  "electrical": {
    "kind": "mcb" | "rcd" | "rcbo" | "contactor" | "motor_protective_switch" | "power_supply" | "surge_arrester" | "cable" | "general",
    "ratedVoltageV": Bemessungsspannung in Volt (z. B. 230 oder 400),
    "ratedCurrentA": Bemessungsstrom in Ampere (z. B. 16),
    "breakingCapacityA": Bemessungskurzschlussausschaltvermögen in A (z. B. 6000),
    "characteristic": "B" | "C" | "D",
    "poles": Polzahl (z. B. 1, 2, 3, 4)
  }
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
          max_tokens: 800,
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
            : (base.electrical?.kind || 'protection');
      result.electrical = {
        version: 1,
        source: base.electrical?.source || 'ai_completion',
        ...(base.electrical || {}),
        kind: elecKind,
        currentType: 'ac',
        ...(Number.isFinite(Number(data.electrical.ratedVoltageV))
          ? { ratedVoltageV: Number(data.electrical.ratedVoltageV) }
          : {}),
        ...(Number.isFinite(Number(data.electrical.currentA ?? data.electrical.ratedCurrentA))
          ? { currentA: Number(data.electrical.currentA ?? data.electrical.ratedCurrentA) }
          : {}),
        ...(Number.isFinite(Number(data.electrical.breakingCapacityA))
          ? { breakingCapacityA: Number(data.electrical.breakingCapacityA) }
          : {}),
        ...(typeof data.electrical.characteristic === 'string'
          ? { characteristic: data.electrical.characteristic }
          : {}),
        ...(Number.isFinite(Number(data.electrical.poles))
          ? { poles: Number(data.electrical.poles) }
          : {}),
      };
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
