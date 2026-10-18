// src/ui/PlausibilityDialog.ts
// Plausibility Check & Message Management ("Prüflauf / Meldungsverwaltung")

import { Project, PlacedComponent } from '../model/types';
import { getSymbolForComponent } from '../model/symbols';

export interface PlausibilityMessage {
  id: string;
  severity: 'error' | 'warning' | 'info';
  category: string;
  pageId: string;
  pageNumber: string;
  componentId?: string;
  bmk?: string;
  message: string;
  recommendation: string;
}

export class PlausibilityDialog {
  private project: Project;
  private onNavigate: (pageId: string, componentId?: string) => void;

  constructor(project: Project, onNavigateOrOptions: ((pageId: string, componentId?: string) => void) | { onNavigateToPage: (pageId: string, componentId?: string) => void }) {
    this.project = project;
    if (typeof onNavigateOrOptions === 'function') {
      this.onNavigate = onNavigateOrOptions;
    } else {
      this.onNavigate = onNavigateOrOptions.onNavigateToPage;
    }
  }

  public show(): void {
    const existing = document.getElementById('plausibilityModal');
    if (existing) existing.remove();

    const messages = this.runCheck();

    const modal = document.createElement('div');
    modal.id = 'plausibilityModal';
    modal.className = 'modal-backdrop';
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.backgroundColor = 'rgba(0,0,0,0.75)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '2100';
    modal.style.padding = '12px';

    const errors = messages.filter(m => m.severity === 'error').length;
    const warnings = messages.filter(m => m.severity === 'warning').length;
    const infos = messages.filter(m => m.severity === 'info').length;

    modal.innerHTML = `
      <div class="modal-card ecad-window" style="
        background: #232731;
        border: 1px solid #4a5568;
        border-radius: 6px;
        width: 100%;
        max-width: 840px;
        height: 75vh;
        max-height: 600px;
        box-shadow: 0 16px 40px rgba(0,0,0,0.8);
        color: #edf2f7;
        font-family: inherit;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      ">
        <!-- Titlebar -->
        <div class="ecad-window-header" style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 14px;
          background: #2d323e;
          border-bottom: 1px solid #3e4656;
          user-select: none;
        ">
          <div style="display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 13px;">
            <span style="color: #68d391;">📋</span>
            <span>Prüflauf - Meldungsverwaltung (Plausibilitätsprüfung)</span>
          </div>
          <button id="btnClosePlausModal" style="background: none; border: none; color: #a0aec0; font-size: 18px; cursor: pointer;">&times;</button>
        </div>

        <!-- Summary Bar -->
        <div style="
          padding: 8px 16px;
          background: #1c1f26;
          border-bottom: 1px solid #3e4656;
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 12px;
        ">
          <div>Status: <strong>Prüflauf abgeschlossen</strong></div>
          <div style="display: flex; gap: 12px; margin-left: auto;">
            <span style="color: #fc8181;">❌ ${errors} Fehler</span>
            <span style="color: #f6ad55;">⚠️ ${warnings} Warnungen</span>
            <span style="color: #63b3ed;">ℹ️ ${infos} Hinweise</span>
          </div>
        </div>

        <!-- Messages Table -->
        <div style="flex: 1; overflow-y: auto; padding: 10px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <thead>
              <tr style="background: #181b22; color: #a0aec0; text-align: left; border-bottom: 1px solid #3e4656;">
                <th style="padding: 6px 8px;">Typ</th>
                <th style="padding: 6px 8px;">Ort / Blatt</th>
                <th style="padding: 6px 8px;">BMK</th>
                <th style="padding: 6px 8px;">Meldungstext</th>
                <th style="padding: 6px 8px;">Aktion</th>
              </tr>
            </thead>
            <tbody>
              ${messages.map(m => `
                <tr class="plaus-row" data-page-id="${m.pageId}" data-comp-id="${m.componentId || ''}" style="border-bottom: 1px solid #2d3748; cursor: pointer;">
                  <td style="padding: 6px 8px; white-space: nowrap;">
                    ${m.severity === 'error' ? '❌ <span style="color:#fc8181;font-weight:600;">Fehler</span>' : 
                      (m.severity === 'warning' ? '⚠️ <span style="color:#f6ad55;font-weight:600;">Warnung</span>' : 
                      'ℹ️ <span style="color:#63b3ed;">Hinweis</span>')}
                  </td>
                  <td style="padding: 6px 8px; white-space: nowrap; font-family: monospace;">Blatt ${m.pageNumber}</td>
                  <td style="padding: 6px 8px; font-weight: bold; font-family: monospace; color: #f6e05e;">${m.bmk || '-'}</td>
                  <td style="padding: 6px 8px;">
                    <div>${m.message}</div>
                    <div style="font-size: 10px; color: #a0aec0; margin-top: 2px;">Empfehlung: ${m.recommendation}</div>
                  </td>
                  <td style="padding: 6px 8px; white-space: nowrap;">
                    <button class="btn btn-jump" style="padding: 2px 8px; font-size: 10px;">Springen ➔</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div style="
          padding: 10px 16px;
          border-top: 1px solid #3e4656;
          background: #1c1f26;
          display: flex;
          justify-content: flex-end;
        ">
          <button id="btnConfirmPlaus" class="btn btn-primary" style="padding: 6px 16px; font-size: 12px;">Schließen</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('#btnClosePlausModal')?.addEventListener('click', closeModal);
    modal.querySelector('#btnConfirmPlaus')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    modal.querySelectorAll('.plaus-row').forEach(row => {
      row.addEventListener('click', (e) => {
        const pageId = (e.currentTarget as HTMLElement).dataset.pageId!;
        const compId = (e.currentTarget as HTMLElement).dataset.compId;
        this.onNavigate(pageId, compId);
        closeModal();
      });
    });
  }

  private runCheck(): PlausibilityMessage[] {
    const messages: PlausibilityMessage[] = [];

    // Map of BMK to count
    const bmkMap = new Map<string, { count: number; components: { comp: PlacedComponent; pageId: string; pageNum: string }[] }>();

    for (const page of this.project.pages) {
      for (const comp of page.components) {
        const key = comp.bmk;
        if (!bmkMap.has(key)) {
          bmkMap.set(key, { count: 0, components: [] });
        }
        const entry = bmkMap.get(key)!;
        entry.count++;
        entry.components.push({ comp, pageId: page.id, pageNum: page.pageNumber });

        // Check for missing manufacturer articles
        if (!comp.articleNumber) {
          messages.push({
            id: 'msg_' + Math.random().toString(36).substring(2, 7),
            severity: 'info',
            category: 'Stammdaten',
            pageId: page.id,
            pageNumber: page.pageNumber,
            componentId: comp.id,
            bmk: comp.bmk,
            message: `Keine Artikelnummer / Bestelldaten für Bauteil hinterlegt.`,
            recommendation: `Weisen Sie im Eigenschaften-Dialog einen Herstellerartikel zu.`
          });
        }

        // Check open pins
        const sym = getSymbolForComponent(comp);
        if (sym) {
          const connectedPins = new Set<string>();
          for (const wire of page.wires) {
            if (wire.from.componentId === comp.id) connectedPins.add(wire.from.pinId);
            if (wire.to.componentId === comp.id) connectedPins.add(wire.to.pinId);
          }
          const unconnected = sym.pins.filter(p => !connectedPins.has(p.id));
          if (unconnected.length > 0 && unconnected.length === sym.pins.length) {
            messages.push({
              id: 'msg_' + Math.random().toString(36).substring(2, 7),
              severity: 'warning',
              category: 'Verdrahtung',
              pageId: page.id,
              pageNumber: page.pageNumber,
              componentId: comp.id,
              bmk: comp.bmk,
              message: `Bauteil ist vollständig unverdrahtet (alle ${sym.pins.length} Anschlüsse unbeschaltet).`,
              recommendation: `Verbinden Sie die Anschlüsse mit Zuleitung oder Klemmen.`
            });
          }
        }
      }
    }

    // Check duplicate BMK conflicts (e.g. two separate motors with same BMK)
    for (const [bmk, entry] of bmkMap.entries()) {
      if (entry.count > 1) {
        const firstSym = getSymbolForComponent(entry.components[0].comp);
        // If not contactor coil + contacts, warn about duplicate
        const isNormalContactSet = firstSym?.isMaster || firstSym?.isContact;
        if (!isNormalContactSet) {
          messages.push({
            id: 'msg_' + Math.random().toString(36).substring(2, 7),
            severity: 'error',
            category: 'Betriebsmittel',
            pageId: entry.components[1].pageId,
            pageNumber: entry.components[1].pageNum,
            componentId: entry.components[1].comp.id,
            bmk: bmk,
            message: `Doppeltes Betriebsmittelkennzeichen '${bmk}' für eigenständige Geräte gefunden.`,
            recommendation: `Benennen Sie eines der Geräte um (z.B. in ${bmk}A).`
          });
        }
      }
    }

    return messages;
  }
}
