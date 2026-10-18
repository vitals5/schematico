// src/ui/PdfExportDialog.ts
// Modal dialog for Smart PDF-Export settings

import { Project } from '../model/types';
import { PdfExporter, PdfExportOptions } from '../export/PdfExporter';

export class PdfExportDialog {
  private project: Project;
  private activePageId: string;
  private modalOverlay: HTMLElement | null = null;

  constructor(project: Project, activePageId: string) {
    this.project = project;
    this.activePageId = activePageId;
  }

  public show(): void {
    this.createModal();
  }

  private createModal(): void {
    this.modalOverlay = document.createElement('div');
    this.modalOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    this.modalOverlay.innerHTML = `
      <div style="
        background: #1a202c;
        border: 1px solid #4a5568;
        border-radius: 8px;
        width: 520px;
        max-width: 90vw;
        color: #edf2f7;
        box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        overflow: hidden;
      ">
        <!-- Dialog Header -->
        <div style="
          padding: 14px 18px;
          background: #2d3748;
          border-bottom: 1px solid #4a5568;
          display: flex;
          align-items: center;
          justify-content: space-between;
        ">
          <div style="font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 8px;">
            📑 Schematico – PDF-Export
          </div>
          <button id="btnPdfClose" style="background: none; border: none; color: #a0aec0; cursor: pointer; font-size: 16px;">✕</button>
        </div>

        <!-- Dialog Body -->
        <div style="padding: 18px; font-size: 12px; line-height: 1.5; max-height: 75vh; overflow-y: auto;">
          <!-- 1. Seitenumfang -->
          <div style="margin-bottom: 14px;">
            <div style="font-weight: bold; color: #63b3ed; margin-bottom: 6px; text-transform: uppercase; font-size: 11px;">1. Seitenbereich</div>
            <div style="display: flex; gap: 16px;">
              <label style="cursor: pointer; display: flex; align-items: center; gap: 6px;">
                <input type="radio" name="pdfPageRange" value="all" checked>
                Gesamtes Projekt (${this.project.pages.length} Seiten)
              </label>
              <label style="cursor: pointer; display: flex; align-items: center; gap: 6px;">
                <input type="radio" name="pdfPageRange" value="current">
                Nur aktive Seite
              </label>
            </div>
          </div>

          <!-- 2. Format & Papier -->
          <div style="margin-bottom: 14px;">
            <div style="font-weight: bold; color: #63b3ed; margin-bottom: 6px; text-transform: uppercase; font-size: 11px;">2. Papierformat</div>
            <select id="pdfFormatSelect" style="width: 100%; padding: 6px; background: #2d3748; border: 1px solid #4a5568; color: white; border-radius: 4px;">
              <option value="a3" selected>DIN A3 Querformat (420 × 297 mm - Standard)</option>
              <option value="a4">DIN A4 Querformat (297 × 210 mm)</option>
            </select>
          </div>

          <!-- 3. Farbmodus -->
          <div style="margin-bottom: 14px;">
            <div style="font-weight: bold; color: #63b3ed; margin-bottom: 6px; text-transform: uppercase; font-size: 11px;">3. Farbmodus</div>
            <div style="display: flex; gap: 16px;">
              <label style="cursor: pointer; display: flex; align-items: center; gap: 6px;">
                <input type="radio" name="pdfColorMode" value="color" checked>
                Farbe (Standard Farbschema)
              </label>
              <label style="cursor: pointer; display: flex; align-items: center; gap: 6px;">
                <input type="radio" name="pdfColorMode" value="monochrome">
                Schwarz / Weiß (Druckoptimiert)
              </label>
            </div>
          </div>

          <!-- 4. Smart PDF Optionen -->
          <div style="margin-bottom: 16px; background: #232d3d; padding: 12px; border-radius: 6px; border: 1px solid #3e4c63;">
            <div style="font-weight: bold; color: #f6e05e; margin-bottom: 8px; font-size: 11px; text-transform: uppercase;">
              ✨ Intelligente PDF-Funktionen
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <label style="cursor: pointer; display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="chkInteractiveLinks" checked>
                <strong>Interaktive Querverweise</strong> (Klickbare Sprungmarken zwischen Spule & Kontakten)
              </label>
              
              <label style="cursor: pointer; display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="chkBookmarks" checked>
                <strong>Lesezeichenbaum</strong> (Strukturierung nach DIN EN 81346 =Anlage+Ort)
              </label>

              <label style="cursor: pointer; display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="chkTerminalDiagram" checked>
                <strong>Klemmenplan-Auswertung</strong> als zusätzliche PDF-Seite anhängen
              </label>

              <label style="cursor: pointer; display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="chkPartsList" checked>
                <strong>Stückliste (BOM)</strong> an das PDF anhängen
              </label>

              <label style="cursor: pointer; display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="chkPlotFrame" checked>
                Normblatt & Schriftfeld nach DIN EN ISO 7200 drucken
              </label>
            </div>
          </div>

          <div id="pdfExportStatus" style="display: none; padding: 8px; border-radius: 4px; background: #2b6cb0; color: white; text-align: center; margin-bottom: 12px;">
            ⏳ Vektor-PDF wird generiert...
          </div>
        </div>

        <!-- Dialog Footer -->
        <div style="
          padding: 12px 18px;
          background: #2d3748;
          border-top: 1px solid #4a5568;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        ">
          <button id="btnPdfCancel" style="padding: 6px 14px; font-size: 12px; background: #4a5568; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Abbrechen
          </button>
          <button id="btnPdfDoExport" style="padding: 6px 16px; font-size: 12px; background: #3182ce; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">
            📥 PDF Exportieren
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(this.modalOverlay);

    // Event Bindings
    document.getElementById('btnPdfClose')?.addEventListener('click', () => this.close());
    document.getElementById('btnPdfCancel')?.addEventListener('click', () => this.close());
    document.getElementById('btnPdfDoExport')?.addEventListener('click', () => this.executeExport());
  }

  private async executeExport(): Promise<void> {
    const statusEl = document.getElementById('pdfExportStatus');
    const btnExport = document.getElementById('btnPdfDoExport') as HTMLButtonElement;
    if (statusEl) statusEl.style.display = 'block';
    if (btnExport) btnExport.disabled = true;

    try {
      const pageRangeRadio = document.querySelector('input[name="pdfPageRange"]:checked') as HTMLInputElement;
      const colorModeRadio = document.querySelector('input[name="pdfColorMode"]:checked') as HTMLInputElement;
      const formatSelect = document.getElementById('pdfFormatSelect') as HTMLSelectElement;
      
      const chkLinks = document.getElementById('chkInteractiveLinks') as HTMLInputElement;
      const chkBookmarks = document.getElementById('chkBookmarks') as HTMLInputElement;
      const chkTerminals = document.getElementById('chkTerminalDiagram') as HTMLInputElement;
      const chkParts = document.getElementById('chkPartsList') as HTMLInputElement;
      const chkPlotFrame = document.getElementById('chkPlotFrame') as HTMLInputElement;

      const options: PdfExportOptions = {
        paperFormat: (formatSelect?.value as any) || 'a3',
        colorMode: (colorModeRadio?.value as any) || 'color',
        pageRange: (pageRangeRadio?.value as any) || 'all',
        currentPageId: this.activePageId,
        interactiveCrossReferences: chkLinks?.checked ?? true,
        includeBookmarks: chkBookmarks?.checked ?? true,
        includeTerminalDiagram: chkTerminals?.checked ?? true,
        includePartsList: chkParts?.checked ?? true,
        plotFrame: chkPlotFrame?.checked ?? true
      };

      const pdfBlob = await PdfExporter.exportToPdf(this.project, options);
      
      // Trigger download
      const filename = `${this.project.name.replace(/[^a-zA-Z0-9_\-]/g, '_')}_Stromlaufplan.pdf`;
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.close();
    } catch (err: any) {
      alert(`Fehler beim PDF-Export: ${err.message}`);
      if (statusEl) statusEl.style.display = 'none';
      if (btnExport) btnExport.disabled = false;
    }
  }

  private close(): void {
    if (this.modalOverlay) {
      document.body.removeChild(this.modalOverlay);
      this.modalOverlay = null;
    }
  }
}
