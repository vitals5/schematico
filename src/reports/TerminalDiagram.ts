// src/reports/TerminalDiagram.ts
// Generates terminal diagrams (Klemmenplan) according to DIN EN 81346 standards

import { Project, PlacedComponent, Wire } from '../model/types';
import { getSymbolForComponent } from '../model/symbols';

export interface TerminalEntry {
  terminalStrip: string;      // e.g. "-X1"
  terminalNumber: string;     // e.g. "1", "2", "PE"
  internalTarget: string;     // e.g. "-K1:2"
  externalTarget: string;     // e.g. "-M1:U1"
  functionText: string;
  wireColor?: string;
  crossSection?: string;
}

export interface TerminalPdfStripChunk {
  stripName: string;
  continued: boolean;
  entries: TerminalEntry[];
}

export type TerminalPdfPage = TerminalPdfStripChunk[];

export const TERMINAL_PDF_START_Y = 40;
export const TERMINAL_PDF_STRIP_HEADER_HEIGHT = 12; // 5mm strip title + 7mm table header
export const TERMINAL_PDF_ROW_HEIGHT = 6;
export const TERMINAL_PDF_STRIP_GAP = 10;

export function layoutTerminalDiagramPdf(
  strips: Map<string, TerminalEntry[]>,
  pageHeightMm: number
): TerminalPdfPage[] {
  const bottom = pageHeightMm - 25;
  const pages: TerminalPdfPage[] = [[]];
  let curY = TERMINAL_PDF_START_Y;

  const startNextPage = () => {
    pages.push([]);
    curY = TERMINAL_PDF_START_Y;
  };

  for (const [stripName, entries] of strips.entries()) {
    if (entries.length === 0) continue;

    const minStripStartHeight = TERMINAL_PDF_STRIP_HEADER_HEIGHT + TERMINAL_PDF_ROW_HEIGHT;
    if (pages.at(-1)!.length > 0 && curY + minStripStartHeight > bottom + 1e-8) {
      startNextPage();
    }

    let currentChunk: TerminalPdfStripChunk = {
      stripName,
      continued: false,
      entries: [],
    };
    pages.at(-1)!.push(currentChunk);
    curY += TERMINAL_PDF_STRIP_HEADER_HEIGHT;

    for (const entry of entries) {
      if (currentChunk.entries.length > 0 && curY + TERMINAL_PDF_ROW_HEIGHT > bottom + 1e-8) {
        startNextPage();
        currentChunk = {
          stripName,
          continued: true,
          entries: [],
        };
        pages.at(-1)!.push(currentChunk);
        curY += TERMINAL_PDF_STRIP_HEADER_HEIGHT;
      }
      currentChunk.entries.push(entry);
      curY += TERMINAL_PDF_ROW_HEIGHT;
    }

    curY += TERMINAL_PDF_STRIP_GAP;
  }

  return pages;
}

export class TerminalDiagramGenerator {
  public static generateTerminalReport(project: Project): Map<string, TerminalEntry[]> {
    const strips = new Map<string, TerminalEntry[]>();

    for (const page of project.pages) {
      let lastStripName = '-X1';
      // Find all terminal components
      for (const comp of page.components) {
        const sym = getSymbolForComponent(comp, project);
        if (sym?.category !== 'terminals' || comp.bmk === 'PE') continue;

        const rawBmk = comp.bmk?.trim() || '';
        if (rawBmk) {
          lastStripName = rawBmk;
        }
        const stripName = rawBmk || lastStripName;
        if (!strips.has(stripName)) {
          strips.set(stripName, []);
        }

        // Determine targets via connected wires
        let internalTarget = '-';
        let externalTarget = '-';
        let wireColor = '';
        let wireSection = '';

        for (const wire of page.wires) {
          if (wire.from.componentId === comp.id) {
            const targetComp = page.components.find(c => c.id === wire.to.componentId);
            if (targetComp) {
              const label = `${targetComp.bmk}:${wire.to.pinId}`;
              if (wire.from.pinId === '1') internalTarget = label;
              else externalTarget = label;
            }
            wireColor = wire.color || '';
            wireSection = wire.crossSection || '';
          } else if (wire.to.componentId === comp.id) {
            const sourceComp = page.components.find(c => c.id === wire.from.componentId);
            if (sourceComp) {
              const label = `${sourceComp.bmk}:${wire.from.pinId}`;
              if (wire.to.pinId === '1') internalTarget = label;
              else externalTarget = label;
            }
            wireColor = wire.color || '';
            wireSection = wire.crossSection || '';
          }
        }

        const terminalNumber = comp.functionText.match(/\b(U1|V1|W1|PE|\d+)\b/)?.[0] 
          || (strips.get(stripName)!.length + 1).toString();

        strips.get(stripName)!.push({
          terminalStrip: stripName,
          terminalNumber,
          internalTarget,
          externalTarget,
          functionText: comp.functionText || 'Durchgangsklemme',
          wireColor,
          crossSection: wireSection
        });
      }
    }

    return strips;
  }
}
