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

export class TerminalDiagramGenerator {
  public static generateTerminalReport(project: Project): Map<string, TerminalEntry[]> {
    const strips = new Map<string, TerminalEntry[]>();

    for (const page of project.pages) {
      // Find all terminal components
      for (const comp of page.components) {
        const sym = getSymbolForComponent(comp);
        if (sym?.category !== 'terminals' || comp.bmk === 'PE') continue;

        const stripName = comp.bmk;
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
