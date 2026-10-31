import { renderSymbolSvg } from './SymbolSvg';
import { boxDrawing } from '../model/DeviceBox';
import { cableDrawing } from '../model/CableDefinition';
import { coverPageTemplate, coverPageTextRuns, coverPageLogo } from '../model/CoverPage';
import { prepareProjectPresentation } from '../model/PresentationNaming';
import { defaultPlotFrame, frameTextCell, frameTextValue, fitFrameText } from '../model/PlotFrame';
import { interruptionLabelPosition, isInterruptionSymbol, isConnectionSymbol } from '../model/ConnectionSymbols';
import { rotatedLocalPoint } from '../model/SymbolGeometry';
import { getAutoSymbolScale, calculateArcControlPoint, computeFloorPlanLegendLayout } from '../model/FloorPlanRenderer';
import { referenceTargets, splitCrossReferenceLines } from '../model/CrossReferenceNavigation';
// src/export/PdfExporter.ts
// Smart Vector PDF Export:
// - Multi-page vector PDF (DIN A3 / DIN A4 Landscape)
// - Interactive cross-reference hyperlinks (jump between coil and contacts)
// - PDF document outline / bookmarks based on DIN EN 81346 (=Anlage+Ort/Blatt)
// - DIN EN ISO 7200 plot frame and title block
// - Appended report pages: Klemmenplan and Stückliste (BOM)

import { wirePolyline, wirePinDirection } from '../model/WireRouting';
import { gridForPage } from '../model/DrawingGrid';
import { connectionCutouts, connectionGraphicWires, isConnectionGraphic, supersededConnectionGraphics, visibleWireSegments } from '../model/ConnectionGraphics';
import { arcPoints, rotateDrawing } from '../model/ImportedDrawing';
import { computeBmkPosition, computeFunctionTextPosition, computeAdditionalTextPosition, computeTechnicalDataPosition, computeCrossReferencePosition, computePinLabelPosition } from '../model/LabelLayout';
import { jsPDF } from 'jspdf';
import { Project, Page, PlacedComponent, Wire, DrawingPrimitive, SymbolDefinition } from '../model/types';
import { getSymbolForComponent } from '../model/symbols';
import { TerminalDiagramGenerator, layoutTerminalDiagramPdf, type TerminalPdfPage } from '../reports/TerminalDiagram';
import { PartsListGenerator } from '../reports/PartsList';
import { layoutPartsListPdf, BOM_COLUMNS, BOM_FONT_SIZE, BOM_LINE_HEIGHT, BOM_ROWS_TOP, getBomColumns, type BomPage } from './PartsListPdf';

export interface PdfExportOptions {
  paperFormat: 'a3' | 'a4';
  colorMode: 'color' | 'monochrome';
  pageRange: 'all' | 'current';
  currentPageId?: string;
  interactiveCrossReferences: boolean;
  includeBookmarks: boolean;
  includeTerminalDiagram: boolean;
  includePartsList: boolean;
  plotFrame: boolean;
}

export class PdfExporter {
  public static async exportToPdf(project: Project, options: PdfExportOptions): Promise<Blob> {
    project=structuredClone(project);
    prepareProjectPresentation(project);
    const isA3 = options.paperFormat === 'a3';
    const pageWidthMm = isA3 ? 420 : 297;
    const pageHeightMm = isA3 ? 297 : 210;

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: isA3 ? 'a3' : 'a4',
      compress: true
    });

    // Set Document Properties
    doc.setProperties({
      title: `${project.name} - Stromlaufplan`,
      subject: `Kommission: ${project.pages[0]?.plotFrame.titleBlock.commission || 'KOM-2026'}`,
      author: project.author || 'Schematico Engineer',
      creator: 'Schematico CAE Suite',
      keywords: 'Schematico, DIN EN 81346, IEC 60617, Schaltplan, CAD, ECAD'
    });

    // Filter pages to export
    let pagesToExport: Page[] = [];
    if (options.pageRange === 'current' && options.currentPageId) {
      const page = project.pages.find(p => p.id === options.currentPageId);
      pagesToExport = page ? [page] : [project.pages[0]];
    } else {
      pagesToExport = [...project.pages];
    }

    // Mapping from page.pageNumber and page.id to 1-based PDF page index
    const pageNumberToPdfPageIndex = new Map<string, number>();
    const pageIdToPdfPageIndex = new Map<string, number>();
    pagesToExport.forEach((page, index) => {
      pageNumberToPdfPageIndex.set(page.pageNumber, index + 1);
      pageIdToPdfPageIndex.set(page.id, index + 1);
    });

    // Total sheet count update
    const bomColumns = getBomColumns(project.language ?? 'de');
    const terminalPages = options.includeTerminalDiagram
      ? layoutTerminalDiagramPdf(TerminalDiagramGenerator.generateTerminalReport(project), pageHeightMm)
      : [];
    const bomPages = options.includePartsList ? layoutPartsListPdf(doc, PartsListGenerator.generatePartsList(project), pageHeightMm, bomColumns) : [];
    const extraSheets = terminalPages.length + bomPages.length;
    const totalSheetsCount = pagesToExport.length + extraSheets;

    // Render schematic pages
    for (let i = 0; i < pagesToExport.length; i++) {
      if (i > 0) {
        doc.addPage(isA3 ? 'a3' : 'a4', 'landscape');
      }

      const page = pagesToExport[i];
      const pdfPageNum = i + 1;

      // Add Bookmarks / Outline if enabled
      if (options.includeBookmarks && doc.outline) {
        const bookmarkTitle = `Blatt ${page.pageNumber}: ${page.title} (${page.higherLevel}${page.location})`;
        try {
          doc.outline.add(null, bookmarkTitle, { pageNumber: pdfPageNum });
        } catch {
          // ignore outline errors
        }
      }

      // Render Plot Frame (Normblatt)
      if (options.plotFrame) {
        this.renderPlotFrame(doc, page, pageWidthMm, pageHeightMm, options.colorMode, totalSheetsCount, project);
      }
      if(page.pageType==='cover')this.renderCoverPage(doc,page,project,pageWidthMm,pageHeightMm,options.colorMode);

      // Render Floor Plan (Walls, Openings, Blueprint Background, Installation Wires)
      if (page.floorPlan) {
        this.renderFloorPlan(doc, page, pageWidthMm, pageHeightMm, options.colorMode);
      }

      // Render Embedded Images
      this.renderImages(doc, page, pageWidthMm, pageHeightMm);

      // Render Structure Boxes (Ortskästen / Schaltschrankumrahmungen)
      this.renderBoxes(doc, page, pageWidthMm, pageHeightMm, options.colorMode);

      // Render Wires
      this.renderWires(doc, page, project, pageWidthMm, pageHeightMm, options.colorMode);

      // Render Components & Interactive Cross-Reference Links
      this.renderComponents(doc, page, project, pageWidthMm, pageHeightMm, options, pageNumberToPdfPageIndex, pageIdToPdfPageIndex);
      for (const cable of page.cables ?? []) this.renderImportedGraphics(doc, cableDrawing(cable,page,project),pageWidthMm/page.plotFrame.width,pageHeightMm/page.plotFrame.height,options.colorMode);

      // Render Free Texts & Annotations
      this.renderTexts(doc, page, pageWidthMm, pageHeightMm, options.colorMode);
      this.renderImportedGraphics(doc, page.importedDrawing?.graphics ?? [], pageWidthMm / page.plotFrame.width,
        pageHeightMm / page.plotFrame.height, options.colorMode);
      if (page.floorPlan) {
        this.renderFloorPlanLegend(doc, page, project, pageWidthMm, pageHeightMm, options.colorMode);
      }
    }

    // Render Optional Klemmenplan Page
    if (options.includeTerminalDiagram) {
      doc.addPage(isA3 ? 'a3' : 'a4', 'landscape');
      const pdfPageNum = doc.getNumberOfPages();
      if (options.includeBookmarks && doc.outline) {
        try {
          doc.outline.add(null, project.language === 'en' ? 'Report: Terminal Diagram (-X1)' : 'Auswertung: Klemmenplan (-X1)', { pageNumber: pdfPageNum });
        } catch {}
      }
      this.renderTerminalDiagramPage(doc, project, pageWidthMm, pageHeightMm, options.colorMode, totalSheetsCount, terminalPages);
    }

    // Render Optional Stückliste Page
    if (options.includePartsList) {
      doc.addPage(isA3 ? 'a3' : 'a4', 'landscape');
      const pdfPageNum = doc.getNumberOfPages();
      if (options.includeBookmarks && doc.outline) {
        try {
          doc.outline.add(null, project.language === 'en' ? 'Report: Bill of Materials (BOM)' : 'Auswertung: Stückliste (BOM)', { pageNumber: pdfPageNum });
        } catch {}
      }
      this.renderPartsListPage(doc, project, pageWidthMm, pageHeightMm, options.colorMode, totalSheetsCount, bomPages);
    }

    return doc.output('blob');
  }

  /**
   * Transforms CAD coordinates (1000 x 700) to PDF mm
   */
  private static scaleX(x: number, maxMm: number): number {
    return (x / 1000) * maxMm;
  }

  private static scaleY(y: number, maxMm: number): number {
    return (y / 700) * maxMm;
  }

  /**
   * Renders the DIN A3 / A4 Normblatt (Plot Frame) with column paths 0..9 and title block
   */
  private static renderPlotFrame(
    doc: jsPDF,
    page: Page,
    wMm: number,
    hMm: number,
    colorMode: 'color' | 'monochrome',
    totalSheets: number,
    project?: Project
  ): void {
    const template = project?.plotFrameTemplate ?? defaultPlotFrame();
    const context = project ?? { pages: [page], description: page.plotFrame.titleBlock.projectTitle, company: page.plotFrame.titleBlock.company, author: page.plotFrame.titleBlock.author } as Project;
    const sx = wMm / template.width, sy = hMm / template.height;
    this.renderImportedGraphics(doc, template.graphics, sx, sy, colorMode, 0, 0, '#7ca552');
    for (const text of template.texts) {
      const value = text.property === 10300 ? String(totalSheets)
        : text.property === 25020 ? String(doc.getCurrentPageInfo().pageNumber) : frameTextValue(text, page, context, template);
      if (!value) continue;
      const cell = frameTextCell(text, template), fit = fitFrameText(value, text, cell);
      doc.saveGraphicsState();
      doc.rect(cell.x * sx, cell.y * sy, cell.width * sx, cell.height * sy, null);
      doc.clip(); doc.discardPath();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(fit.size * sy * 72 / 25.4);
      doc.setTextColor(...(colorMode === 'color' ? [124, 165, 82] : [0, 0, 0]) as [number, number, number]);
      fit.lines.forEach((line, i) => doc.text(line, fit.x * sx, (fit.y + i * fit.size * 1.2) * sy,
        { align: text.anchor === 'middle' ? 'center' : text.anchor === 'end' ? 'right' : 'left' }));
      doc.restoreGraphicsState();
    }
  }

  private static renderCoverPage(doc:jsPDF,page:Page,project:Project,wMm:number,hMm:number,colorMode:'color'|'monochrome'):void {
    const template=coverPageTemplate(project),sx=wMm/template.width,sy=hMm/template.height;
    this.renderImportedGraphics(doc,template.graphics,sx,sy,colorMode,0,0,'#7ca552');
    const logo=coverPageLogo(page,project);
    if(logo){
      const image=doc.getImageProperties(logo.dataUrl),factor=Math.min(logo.width*sx/image.width,logo.height*sy/image.height);
      const width=image.width*factor,height=image.height*factor;
      doc.addImage(logo.dataUrl,logo.dataUrl.startsWith('data:image/png')?'PNG':'JPEG',logo.x*sx+(logo.width*sx-width)/2,logo.y*sy+(logo.height*sy-height)/2,width,height);
    }
    for(const {text,value,cell,fit} of coverPageTextRuns(page,project)){
      if(!value)continue;
      doc.saveGraphicsState();doc.rect(cell.x*sx,cell.y*sy,cell.width*sx,cell.height*sy,null);doc.clip();doc.discardPath();
      doc.setFont('helvetica','normal');doc.setFontSize(fit.size*sy*72/25.4);
      doc.setTextColor(...(colorMode==='color'?[124,165,82]:[0,0,0]) as [number,number,number]);
      fit.lines.forEach((line,i)=>doc.text(line,fit.x*sx,(fit.y+i*fit.size*1.2)*sy,{align:text.anchor==='middle'?'center':text.anchor==='end'?'right':'left'}));
      doc.restoreGraphicsState();
    }
  }

  /**
   * Renders free texts, cable definitions, and section titles
   */
  private static renderTexts(
    doc: jsPDF,
    page: Page,
    wMm: number,
    hMm: number,
    colorMode: 'color' | 'monochrome'
  ): void {
    if (!page.texts || page.texts.length === 0) return;
    const scaleX = wMm / page.plotFrame.width;
    const scaleY = hMm / page.plotFrame.height;

    for (const t of page.texts) {
      const xMm = t.x * scaleX;
      const yMm = t.y * scaleY;
      const isHeader = Boolean(t.fontSize && t.fontSize >= 11);
      const isMonochrome = colorMode === 'monochrome';
      const isBold = t.fontWeight === 'bold' || isHeader;
      const isItalic = t.fontStyle === 'italic';

      const style = isBold && isItalic ? 'bolditalic' : isBold ? 'bold' : isItalic ? 'italic' : 'normal';
      doc.setFont('helvetica', style);
      const ptSize = (t.fontSize || 9) * scaleY * 72 / 25.4;
      doc.setFontSize(Math.max(4, ptSize));

      if (isMonochrome) {
        doc.setTextColor(0, 0, 0);
      } else if (t.fontColor && /^#[0-9a-fA-F]{6}$/.test(t.fontColor)) {
        const r = parseInt(t.fontColor.slice(1, 3), 16);
        const g = parseInt(t.fontColor.slice(3, 5), 16);
        const b = parseInt(t.fontColor.slice(5, 7), 16);
        doc.setTextColor(r, g, b);
      } else if (isHeader) {
        doc.setTextColor(43, 108, 176);
      } else {
        doc.setTextColor(74, 85, 104);
      }

      const align = (t.align === 'center' || t.align === 'middle') ? 'center' : (t.align === 'end' || t.align === 'right') ? 'right' : undefined;
      const options: any = {};
      if (align) options.align = align;
      if (t.rotation) options.angle = t.rotation;

      const lines = (t.text || '').split(/\r?\n/);
      doc.text(lines, xMm, yMm, options);
    }
  }

  /**
   * Renders embedded raster images and diagrams
   */
  private static renderImages(doc: jsPDF, page: Page, wMm: number, hMm: number): void {
    if (!page.images || page.images.length === 0) return;
    const scaleX = wMm / page.plotFrame.width;
    const scaleY = hMm / page.plotFrame.height;

    for (const img of page.images) {
      const ix = img.x * scaleX;
      const iy = img.y * scaleY;
      const iw = img.width * scaleX;
      const ih = img.height * scaleY;
      try {
        const format = img.dataUrl.includes('image/jpeg') ? 'JPEG' : 'PNG';
        doc.addImage(img.dataUrl, format, ix, iy, iw, ih);
      } catch (err) {
        console.warn('Failed to embed image into PDF:', err);
      }
    }
  }

  /**
   * Renders floor plan elements (blueprint background, walls, openings, installation arc wires)
   */
  private static renderFloorPlan(
    doc: jsPDF,
    page: Page,
    wMm: number,
    hMm: number,
    colorMode: 'color' | 'monochrome'
  ): void {
    const fp = page.floorPlan;
    if (!fp) return;

    const sx = wMm / page.plotFrame.width;
    const sy = hMm / page.plotFrame.height;
    const pxPerMeter = fp.scale?.pixelPerMeter || 50;
    const isColor = colorMode === 'color';

    // 1. Background image (blueprint/sketch)
    if (fp.backgroundImage?.visible && fp.backgroundImage.dataUrl && fp.backgroundImage.bounds) {
      const b = fp.backgroundImage.bounds;
      const ix = b.x * sx;
      const iy = b.y * sy;
      const iw = b.width * sx;
      const ih = b.height * sy;
      try {
        const format = fp.backgroundImage.dataUrl.includes('image/jpeg') ? 'JPEG' : 'PNG';
        const hasGState = typeof (doc as any).GState === 'function';
        if (hasGState && fp.backgroundImage.opacity !== undefined && fp.backgroundImage.opacity < 1) {
          doc.saveGraphicsState();
          doc.setGState(new (doc as any).GState({ opacity: fp.backgroundImage.opacity }));
          doc.addImage(fp.backgroundImage.dataUrl, format, ix, iy, iw, ih);
          doc.restoreGraphicsState();
        } else {
          doc.addImage(fp.backgroundImage.dataUrl, format, ix, iy, iw, ih);
        }
      } catch (err) {
        console.warn('Failed to embed floor plan background image into PDF:', err);
      }
    }

    // 2. Walls
    const wallMap = new Map((fp.walls || []).map(w => [w.id, w]));
    if (fp.walls && fp.walls.length > 0) {
      for (const wall of fp.walls) {
        const thickness = wall.thickness
          ? Math.max(0.35, (wall.thickness < 1 ? wall.thickness * pxPerMeter : wall.thickness) * sx * 0.4)
          : (wall.isExterior ? 0.75 : 0.45);
        doc.setLineWidth(thickness);
        if (isColor) {
          if (wall.isExterior) {
            doc.setDrawColor(45, 55, 72);
          } else {
            doc.setDrawColor(74, 85, 104);
          }
        } else {
          doc.setDrawColor(0, 0, 0);
        }
        doc.line(wall.start.x * sx, wall.start.y * sy, wall.end.x * sx, wall.end.y * sy);
      }
    }

    // 3. Openings (doors, windows, wall openings, garage doors)
    if (fp.openings && fp.openings.length > 0) {
      for (const op of fp.openings) {
        const opW = op.width < 5 ? op.width * pxPerMeter : op.width;
        const hw = opW / 2;
        const wall = op.wallId ? wallMap.get(op.wallId) : undefined;
        let ux = 1, uy = 0, nx = 0, ny = 1;

        if (wall) {
          const dx = wall.end.x - wall.start.x;
          const dy = wall.end.y - wall.start.y;
          const len = Math.hypot(dx, dy);
          if (len > 1e-3) {
            ux = dx / len;
            uy = dy / len;
            nx = -uy;
            ny = ux;
          }
        } else if (op.orientation === 'vertical') {
          ux = 0; uy = 1;
          nx = 1; ny = 0;
        }

        const p1x = op.center.x - hw * ux;
        const p1y = op.center.y - hw * uy;
        const p2x = op.center.x + hw * ux;
        const p2y = op.center.y + hw * uy;

        // Cut wall opening with clean white gap
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(1.8);
        doc.line(p1x * sx, p1y * sy, p2x * sx, p2y * sy);

        if (op.kind === 'window') {
          const glassColor = isColor ? { r: 49, g: 130, b: 206 } : { r: 0, g: 0, b: 0 };
          const frameColor = isColor ? { r: 113, g: 128, b: 150 } : { r: 0, g: 0, b: 0 };

          doc.setDrawColor(frameColor.r, frameColor.g, frameColor.b);
          doc.setLineWidth(0.3);
          doc.line((p1x - 3 * nx) * sx, (p1y - 3 * ny) * sy, (p1x + 3 * nx) * sx, (p1y + 3 * ny) * sy);
          doc.line((p2x - 3 * nx) * sx, (p2y - 3 * ny) * sy, (p2x + 3 * nx) * sx, (p2y + 3 * ny) * sy);

          doc.setDrawColor(glassColor.r, glassColor.g, glassColor.b);
          doc.setLineWidth(0.3);
          doc.line((p1x + 1.5 * nx) * sx, (p1y + 1.5 * ny) * sy, (p2x + 1.5 * nx) * sx, (p2y + 1.5 * ny) * sy);
          doc.line((p1x - 1.5 * nx) * sx, (p1y - 1.5 * ny) * sy, (p2x - 1.5 * nx) * sx, (p2y - 1.5 * ny) * sy);
        } else if (op.kind === 'opening') {
          const frameColor = isColor ? { r: 74, g: 85, b: 104 } : { r: 0, g: 0, b: 0 };
          doc.setDrawColor(frameColor.r, frameColor.g, frameColor.b);
          doc.setLineWidth(0.35);
          doc.line((p1x - 3.5 * nx) * sx, (p1y - 3.5 * ny) * sy, (p1x + 3.5 * nx) * sx, (p1y + 3.5 * ny) * sy);
          doc.line((p2x - 3.5 * nx) * sx, (p2y - 3.5 * ny) * sy, (p2x + 3.5 * nx) * sx, (p2y + 3.5 * ny) * sy);
        } else if (op.kind === 'garage_door') {
          const frameColor = isColor ? { r: 74, g: 85, b: 104 } : { r: 0, g: 0, b: 0 };
          const trackColor = isColor ? { r: 113, g: 128, b: 150 } : { r: 0, g: 0, b: 0 };
          const trackLen = Math.max(30, opW * 0.75);
          const t1x = p1x + trackLen * nx;
          const t1y = p1y + trackLen * ny;
          const t2x = p2x + trackLen * nx;
          const t2y = p2y + trackLen * ny;

          doc.setDrawColor(frameColor.r, frameColor.g, frameColor.b);
          doc.setLineWidth(0.35);
          doc.line((p1x - 3.5 * nx) * sx, (p1y - 3.5 * ny) * sy, (p1x + 3.5 * nx) * sx, (p1y + 3.5 * ny) * sy);
          doc.line((p2x - 3.5 * nx) * sx, (p2y - 3.5 * ny) * sy, (p2x + 3.5 * nx) * sx, (p2y + 3.5 * ny) * sy);
          doc.line(p1x * sx, p1y * sy, p2x * sx, p2y * sy);

          doc.setDrawColor(trackColor.r, trackColor.g, trackColor.b);
          doc.setLineWidth(0.25);
          doc.line(p1x * sx, p1y * sy, t1x * sx, t1y * sy);
          doc.line(p2x * sx, p2y * sy, t2x * sx, t2y * sy);
          doc.line(t1x * sx, t1y * sy, t2x * sx, t2y * sy);
        } else {
          const isRight = op.swingDirection?.startsWith('right_');
          const swingSign = op.swingDirection?.includes('out') ? -1 : 1;
          const hasArc = op.swingDirection !== 'none';

          const hingeX = isRight ? p2x : p1x;
          const hingeY = isRight ? p2y : p1y;
          const targetX = isRight ? p1x : p2x;
          const targetY = isRight ? p1y : p2y;

          const leafEndX = hingeX + opW * nx * swingSign;
          const leafEndY = hingeY + opW * ny * swingSign;

          const frameColor = isColor ? { r: 74, g: 85, b: 104 } : { r: 0, g: 0, b: 0 };
          const leafColor = isColor ? { r: 45, g: 55, b: 72 } : { r: 0, g: 0, b: 0 };
          const arcColor = isColor ? { r: 113, g: 128, b: 150 } : { r: 80, g: 80, b: 80 };

          doc.setDrawColor(frameColor.r, frameColor.g, frameColor.b);
          doc.setLineWidth(0.3);
          doc.line((p1x - 2.5 * nx) * sx, (p1y - 2.5 * ny) * sy, (p1x + 2.5 * nx) * sx, (p1y + 2.5 * ny) * sy);
          doc.line((p2x - 2.5 * nx) * sx, (p2y - 2.5 * ny) * sy, (p2x + 2.5 * nx) * sx, (p2y + 2.5 * ny) * sy);

          if (hasArc) {
            doc.setDrawColor(leafColor.r, leafColor.g, leafColor.b);
            doc.setLineWidth(0.4);
            doc.line(hingeX * sx, hingeY * sy, leafEndX * sx, leafEndY * sy);

            doc.setDrawColor(arcColor.r, arcColor.g, arcColor.b);
            doc.setLineWidth(0.25);
            const startAngle = Math.atan2(leafEndY - hingeY, leafEndX - hingeX);
            let endAngle = Math.atan2(targetY - hingeY, targetX - hingeX);
            let diff = endAngle - startAngle;
            while (diff > Math.PI) diff -= 2 * Math.PI;
            while (diff < -Math.PI) diff += 2 * Math.PI;

            const steps = 8;
            let prevX = leafEndX * sx;
            let prevY = leafEndY * sy;
            for (let i = 1; i <= steps; i++) {
              const a = startAngle + (diff * i) / steps;
              const curX = (hingeX + opW * Math.cos(a)) * sx;
              const curY = (hingeY + opW * Math.sin(a)) * sy;
              doc.line(prevX, prevY, curX, curY);
              prevX = curX;
              prevY = curY;
            }
          } else {
            doc.setDrawColor(leafColor.r, leafColor.g, leafColor.b);
            doc.setLineWidth(0.35);
            doc.line(p1x * sx, p1y * sy, p2x * sx, p2y * sy);
          }
        }
      }
    }

    // 4. Arc Wires (curved installation wiring)
    if (fp.arcWires && fp.arcWires.length > 0) {
      const compMap = new Map((page.components || []).map(c => [c.id, c]));
      const circuitMap = new Map((fp.circuits || []).map(c => [c.id, c]));

      for (const wire of fp.arcWires) {
        const c1 = compMap.get(wire.fromComponentId);
        const c2 = compMap.get(wire.toComponentId);
        if (!c1 || !c2) continue;

        const p1 = { x: c1.x, y: c1.y };
        const p2 = { x: c2.x, y: c2.y };
        const curvature = wire.curvature ?? 0.25;
        const ctrl = calculateArcControlPoint(p1, p2, curvature);

        const circ = wire.circuitId ? circuitMap.get(wire.circuitId) : undefined;
        let wireRgb = { r: 49, g: 130, b: 206 };
        if (circ?.color && /^#[0-9a-fA-F]{6}$/.test(circ.color)) {
          wireRgb = {
            r: parseInt(circ.color.slice(1, 3), 16),
            g: parseInt(circ.color.slice(3, 5), 16),
            b: parseInt(circ.color.slice(5, 7), 16)
          };
        } else if (!isColor) {
          wireRgb = { r: 0, g: 0, b: 0 };
        }

        doc.setDrawColor(wireRgb.r, wireRgb.g, wireRgb.b);
        doc.setLineWidth(0.35);

        const steps = 10;
        let prevX = p1.x * sx;
        let prevY = p1.y * sy;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const u = 1 - t;
          const curX = (u * u * p1.x + 2 * u * t * ctrl.x + t * t * p2.x) * sx;
          const curY = (u * u * p1.y + 2 * u * t * ctrl.y + t * t * p2.y) * sy;
          doc.line(prevX, prevY, curX, curY);
          prevX = curX;
          prevY = curY;
        }
      }
    }
  }

  /**
   * Renders the automatic symbol legend table on floor plan pages in PDF export
   */
  private static renderFloorPlanLegend(
    doc: jsPDF,
    page: Page,
    project: Project,
    wMm: number,
    hMm: number,
    colorMode: 'color' | 'monochrome'
  ): void {
    if (!page.floorPlan) return;
    const lang = project.language ?? 'de';
    const layout = computeFloorPlanLegendLayout(
      page.floorPlan,
      page.components,
      project,
      { width: page.plotFrame.width, height: page.plotFrame.height },
      lang
    );
    if (!layout) return;

    const sx = wMm / page.plotFrame.width;
    const sy = hMm / page.plotFrame.height;
    const isColor = colorMode === 'color';
    const { x, y, width, height, columns, rows, colWidth, headerHeight, rowHeight, scale, items, totalCount, showCounts, title } = layout;

    // Outer box
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(isColor ? 74 : 0, isColor ? 85 : 0, isColor ? 104 : 0);
    doc.setLineWidth(0.3);
    doc.rect(x * sx, y * sy, width * sx, height * sy, 'FD');

    // Header bar
    doc.setFillColor(isColor ? 237 : 242, isColor ? 242 : 242, isColor ? 247 : 242);
    doc.rect(x * sx, y * sy, width * sx, headerHeight * sy, 'FD');

    // Header text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(Math.max(4.5, 6.6 * scale * sy * 72 / 25.4));
    doc.setTextColor(isColor ? 43 : 0, isColor ? 108 : 0, isColor ? 176 : 0);
    doc.text(title, (x + 7 * scale) * sx, (y + headerHeight * 0.68) * sy);

    if (showCounts) {
      const sumLabel = lang === 'en' ? `Total: ${totalCount}` : `Gesamt: ${totalCount}`;
      doc.setFont('courier', 'bold');
      doc.setFontSize(Math.max(4, 6.0 * scale * sy * 72 / 25.4));
      doc.setTextColor(isColor ? 100 : 40, isColor ? 116 : 40, isColor ? 139 : 40);
      doc.text(sumLabel, (x + width - 6 * scale) * sx, (y + headerHeight * 0.68) * sy, { align: 'right' });
    }

    // Column dividers
    doc.setDrawColor(isColor ? 203 : 160, isColor ? 213 : 160, isColor ? 224 : 160);
    doc.setLineWidth(0.2);
    for (let c = 1; c < columns; c++) {
      const cx = (x + c * colWidth) * sx;
      doc.line(cx, (y + headerHeight) * sy, cx, (y + height) * sy);
    }

    // Items
    items.forEach((item, idx) => {
      const col = Math.floor(idx / rows);
      const row = idx % rows;
      const cellX = x + col * colWidth;
      const cellY = y + headerHeight + row * rowHeight;

      if (row > 0) {
        doc.setDrawColor(isColor ? 226 : 190, isColor ? 232 : 190, isColor ? 240 : 190);
        doc.setLineWidth(0.15);
        doc.line((cellX + 3) * sx, cellY * sy, (cellX + colWidth - 3) * sx, cellY * sy);
      }

      const sym = item.symbol;
      const symW = sym.width || 32;
      const symH = sym.height || 32;
      const iconBox = 11 * scale;
      const iconScale = iconBox / Math.max(symW, symH, 1);
      const iconX = cellX + 11 * scale - (symW * iconScale) / 2;
      const iconY = cellY + rowHeight / 2 - (symH * iconScale) / 2;

      doc.setDrawColor(0, 0, 0);
      doc.setFillColor(0, 0, 0);
      doc.setLineWidth(0.25);
      if (sym.importedGraphics) {
        this.renderImportedGraphics(doc, sym.importedGraphics, sx * iconScale, sy * iconScale, colorMode, iconX / iconScale, iconY / iconScale, '#000000');
      } else {
        this.drawVectorSymbol(doc, sym.id, iconX * sx, iconY * sy, symW * iconScale * sx, symH * iconScale * sy, sym);
      }

      const maxLabelChars = Math.max(12, Math.floor((colWidth / scale - (showCounts ? 46 : 26)) / 3.9));
      const displayLabel = item.name.length > maxLabelChars
        ? item.name.slice(0, maxLabelChars - 1) + '…'
        : item.name;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(Math.max(4, 6.6 * scale * sy * 72 / 25.4));
      doc.setTextColor(0, 0, 0);
      doc.text(displayLabel, (cellX + 21 * scale) * sx, (cellY + rowHeight * 0.66) * sy);

      if (showCounts) {
        doc.setFont('courier', 'bold');
        doc.setFontSize(Math.max(4, 6.6 * scale * sy * 72 / 25.4));
        doc.setTextColor(isColor ? 43 : 0, isColor ? 108 : 0, isColor ? 176 : 0);
        doc.text(`${item.count}x`, (cellX + colWidth - 6 * scale) * sx, (cellY + rowHeight * 0.66) * sy, { align: 'right' });
      }
    });
  }

  /**
   * Renders structure boxes (Ortskästen / Schaltschrankumrahmungen)
   */
  private static renderBoxes(
    doc: jsPDF,
    page: Page,
    wMm: number,
    hMm: number,
    colorMode: 'color' | 'monochrome'
  ): void {
    for(const box of page.boxes ?? [])this.renderImportedGraphics(doc,boxDrawing(box),wMm/page.plotFrame.width,hMm/page.plotFrame.height,colorMode);
  }

  /**
   * Renders all electrical wires with potential colors and orthogonal paths
   */
  private static renderWires(
    doc: jsPDF,
    page: Page,
    project: Project,
    wMm: number,
    hMm: number,
    colorMode: 'color' | 'monochrome'
  ): void {
    const sx = wMm / page.plotFrame.width, sy = hMm / page.plotFrame.height;
    const cutouts = connectionCutouts(page, project);
    for (const wire of page.wires) {
      const p1 = this.getPinCoords(page, wire.from.componentId, wire.from.pinId, project);
      const p2 = this.getPinCoords(page, wire.to.componentId, wire.to.pinId, project);
      if (!p1 || !p2) continue;
      doc.setLineWidth((wire.lineWidth ?? 2) * sx);
      const rgb = colorMode === 'color' ? this.getPotentialRgb(wire.potential, wire.color) : { r: 0, g: 0, b: 0 };
      doc.setDrawColor(rgb.r, rgb.g, rgb.b);
      doc.setFillColor(rgb.r, rgb.g, rgb.b);
      const points = wirePolyline(p1, p2, wire.waypoints, wirePinDirection(page, project, wire.from), wirePinDirection(page, project, wire.to),
        page.components.find(c => c.id === wire.from.componentId)?.symbolId === 'potential_rail_source', gridForPage(page));
      for (const [a, b] of visibleWireSegments(points, cutouts)) doc.line(a.x * sx, a.y * sy, b.x * sx, b.y * sy);
    }
  }

  /**
   * Renders components, symbols, labels, and smart cross-reference hyperlinks
   */
  private static renderComponents(
    doc: jsPDF,
    page: Page,
    project: Project,
    wMm: number,
    hMm: number,
    options: PdfExportOptions,
    pageMapping: Map<string, number>,
    pageIdMapping?: Map<string, number>
  ): void {
    const superseded = supersededConnectionGraphics(page, project);
    const graphicWires = connectionGraphicWires(page, project);
    const isFloorPlan = !!page.floorPlan;
    const hideLabels = isFloorPlan && (page.floorPlan?.hideSymbolLabels !== false);
    for (const comp of page.components) {
      const sym = getSymbolForComponent(comp, project);
      if (!sym) continue;

      const s = comp.scale ?? (isFloorPlan ? (page.floorPlan?.symbolScale ?? getAutoSymbolScale(page.floorPlan?.scale?.scaleRatio)) : 1);
      const sx = wMm / page.plotFrame.width, sy = hMm / page.plotFrame.height;
      const compX = comp.x * sx, compY = comp.y * sy;
      const compW = sym.width * sx * s, compH = sym.height * sy * s;

      const routingGlyph = isConnectionGraphic(comp, sym);
      const isInterruption = isInterruptionSymbol(sym);
      const isConnection = isInterruption || (!sym.importedGraphics && (sym.category === 'connections' || isConnectionSymbol(sym) || sym.id.startsWith('potential_arrow') || sym.id === 'potential_rail_source'));
      const isTerminal = sym.id === 'terminal_single';

      const connectedWire = graphicWires.get(comp.id)
        ?? page.wires.find(w => w.from.componentId === comp.id || w.to.componentId === comp.id);
      const potHint = connectedWire?.potential || comp.functionText || 'Signal';
      const rgb = options.colorMode === 'color'
        ? this.getPotentialRgb(potHint, connectedWire?.color)
        : { r: 0, g: 0, b: 0 };
      const foreground = comp.deviceBox?.color??((routingGlyph || isConnection) ? '#' + [rgb.r, rgb.g, rgb.b].map(c => c.toString(16).padStart(2, '0')).join('') : '#000000');
      if (superseded.has(comp.id) || comp.source?.routingUsed === false) {
        // Functional source object is retained in the model; its co-located
        // explicit routing symbol supplies the visible connection geometry.
      } else if (sym.importedGraphics) {
        this.renderImportedGraphics(doc, rotateDrawing(sym.importedGraphics, comp.rotation, sym.width, sym.height), wMm / page.plotFrame.width, hMm / page.plotFrame.height,
          options.colorMode, comp.x, comp.y, foreground);
      } else {
        // Draw Symbol Vector Outline
        if (isConnection) {
          doc.setDrawColor(rgb.r, rgb.g, rgb.b);
          doc.setFillColor(rgb.r, rgb.g, rgb.b);
          doc.setLineWidth(connectedWire?.lineWidth === undefined ? 0.35 : connectedWire.lineWidth * sx);
        } else {
          doc.setDrawColor(0, 0, 0);
          doc.setFillColor(0, 0, 0);
          doc.setLineWidth(0.35);
        }
        this.drawVectorSymbol(doc, sym.id, compX, compY, compW, compH, sym, comp.rotation, foreground, options.colorMode === 'monochrome');
      }

      // Export the same anchors and fonts as the editor; pin handles are editing aids.
      for (const pin of sym.pins) {
        const pinPos = computePinLabelPosition(comp, sym, pin);
        if (!pinPos.visible) continue;
        const point = rotatedLocalPoint(pinPos, sym, comp.rotation);
        const sourceLabel = sym.source || pin.labelPosition || comp.pins[pin.id]?.labelPosition;
        doc.setFont(sourceLabel ? 'helvetica' : 'courier', 'normal');
        doc.setFontSize(pinPos.fontSize * sy * 72 / 25.4);
        doc.setTextColor(0, 0, 0);
        doc.text(comp.pins[pin.id]?.customLabel ?? pin.name, (comp.x + point.x) * sx, (comp.y + point.y) * sy,
          { align: pinPos.anchor === 'middle' ? 'center' : pinPos.anchor === 'end' ? 'right' : 'left', angle: -pinPos.rotation });
      }

      // Draw Labels according to component type
      const arrowPos = interruptionLabelPosition(project, comp, sym);
      if (isInterruptionSymbol(sym) && arrowPos) {
        const local = arrowPos;
        const point = rotatedLocalPoint(local, sym, comp.rotation);
        doc.setFont('helvetica', 'normal'); doc.setFontSize((sym.source ? computeFunctionTextPosition(comp, sym).fontSize : (comp.functionTextPosition?.fontSize ?? 8.5)) * sy * 72 / 25.4);
        doc.setTextColor(0, 0, 0);
        if (!sym.source || computeFunctionTextPosition(comp, sym).visible) doc.text(comp.functionText || comp.bmk, (comp.x + point.x) * sx, (comp.y + point.y) * sy,
          { align: local.anchor === 'middle' ? 'center' : local.anchor === 'end' ? 'right' : 'left' });
      } else if (isConnection) {
        // Interruption point / Potential arrow: render target name beside arrow
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(options.colorMode === 'color' ? 180 : 0, 0, 0);
        if (sym.id === 'potential_arrow_right') {
          doc.text(comp.functionText || comp.bmk, compX + compW + 1.5, compY + compH * 0.5 + 1.2, { align: 'left' });
        } else if (sym.id === 'potential_arrow_left') {
          doc.text(comp.functionText || comp.bmk, compX - 1.5, compY + compH * 0.5 + 1.2, { align: 'right' });
        } else if (sym.id === 'potential_arrow_down' || sym.id === 'potential_arrow') {
          doc.text(comp.functionText || comp.bmk, compX + compW * 0.5, compY + compH + 3.0, { align: 'center' });
        } else if (sym.id === 'potential_arrow_up') {
          doc.text(comp.functionText || comp.bmk, compX + compW * 0.5, compY - 1.5, { align: 'center' });
        } else if (sym.id === 'potential_rail_source') {
          doc.text(comp.functionText || comp.bmk, compX - 1.5, compY + compH * 0.5 + 1.2, { align: 'right' });
        }
      } else if (isTerminal) {
        // Terminal: draw terminal designation beside circle and BMK above
        const termNum = comp.deviceTag || comp.technicalCharacteristics || comp.functionText || '1';
        doc.setFont('courier', 'bold');
        doc.setFontSize((comp.pinLabelFontSize ?? 7.5) * sy * 72 / 25.4);
        doc.setTextColor(50, 50, 50);
        const anchor = rotatedLocalPoint({x:sym.width+2,y:sym.height/2+3},sym,comp.rotation);
        doc.text(termNum, (comp.x+anchor.x)*sx, (comp.y+anchor.y)*sy);

      }
      {
        const drawLabel = (text: string, pos: ReturnType<typeof computeBmkPosition>, bold: boolean, color: number[]) => {
          if (!text || !pos.visible) return;
          const a = comp.rotation * Math.PI / 180;
          const dx = pos.x - sym.width / 2, dy = pos.y - sym.height / 2;
          const px = comp.x + sym.width / 2 + dx * Math.cos(a) - dy * Math.sin(a);
          const py = comp.y + sym.height / 2 + dx * Math.sin(a) + dy * Math.cos(a);
          doc.setFont(bold ? 'courier' : 'helvetica', bold || pos.fontWeight === 'bold' ? 'bold' : 'normal');
          doc.setFontSize(pos.fontSize * sy * 72 / 25.4);
          const hex = pos.fontColor?.match(/^#([0-9a-f]{6})$/i)?.[1];
          const ownColor = hex ? [parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16)] : color;
          const rgb = options.colorMode === 'color' ? ownColor : [0, 0, 0];
          doc.setTextColor(rgb[0], rgb[1], rgb[2]);
          doc.text(text, px * sx, py * sy, { align: pos.anchor === 'middle' ? 'center' : pos.anchor === 'end' ? 'right' : 'left', angle: -pos.rotation });
        };
        if (!hideLabels || comp.showLabels) {
          if (!isConnection && (!isTerminal || !comp.bmk.startsWith('comp_')))
            drawLabel(comp.bmk, computeBmkPosition(comp, sym), true, [140, 95, 0]);
          if (!isConnection && !isTerminal) {
            drawLabel(comp.functionText, computeFunctionTextPosition(comp, sym), false, [0, 0, 0]);
            const tech = comp.deviceTag ? comp.deviceTag + (comp.technicalCharacteristics ? ' · ' + comp.technicalCharacteristics : '') : comp.technicalCharacteristics || '';
            drawLabel(tech, computeTechnicalDataPosition(comp, sym), false, [25, 100, 45]);
          }
          drawLabel(comp.additionalText || '', computeAdditionalTextPosition(comp, sym), false, [0, 0, 0]);
        }
      }

      // SMART PDF: Interactive Cross-References (Kontaktspiegel & Querverweise)
      const refPos = computeCrossReferencePosition(comp, sym, project);
      let targetPdfPage: number | undefined;

      if (options.interactiveCrossReferences) {
        const targets = referenceTargets(project, comp);
        if (targets.length > 0) {
          for (const target of targets) {
            const num = (pageIdMapping?.get(target.pageId)) ?? pageMapping.get(target.label.replace(/^\/|[\.\d]+$/g, ''));
            if (num) {
              targetPdfPage = num;
              break;
            }
          }
        }
        if (!targetPdfPage && comp.crossRef) {
          for (const m of comp.crossRef.matchAll(/\/([^\s,|/:]+)\.(\d+)/g)) {
            const num = pageMapping.get(m[1]);
            if (num) {
              targetPdfPage = num;
              break;
            }
          }
        }
        if (!targetPdfPage && comp.bmk?.trim()) {
          const bmk = comp.bmk.trim();
          if (bmk !== '?' && bmk !== '/') {
            for (const otherPage of project.pages) {
              if (otherPage.id !== page.id && otherPage.components.some(c => c.bmk?.trim() === bmk)) {
                targetPdfPage = pageIdMapping?.get(otherPage.id) ?? pageMapping.get(otherPage.pageNumber);
                if (targetPdfPage) break;
              }
            }
          }
        }

        // Make the symbol itself clickable in PDF on floor plans (where labels are hidden)
        if (targetPdfPage && (isFloorPlan || hideLabels)) {
          doc.link(compX, compY, Math.max(3, compW), Math.max(3, compH), { pageNumber: targetPdfPage });
        }
      }

      if (comp.crossRef && refPos.visible && !hideLabels && (!isConnection || isInterruptionSymbol(sym))) {
        const refLines = splitCrossReferenceLines(comp.crossRef);
        const rad = refPos.rotation * Math.PI / 180;
        const targets = options.interactiveCrossReferences ? referenceTargets(project, comp) : [];
        doc.setFont('courier', 'bold');
        doc.setFontSize(refPos.fontSize * sy * 72 / 25.4);
        doc.setTextColor(options.colorMode === 'color' ? 200 : 50, 50, 0);

        refLines.forEach((line, lineIndex) => {
          const lineOffset = lineIndex * refPos.fontSize * 1.25;
          const lineLocal = lineIndex === 0
            ? refPos
            : { x: refPos.x - lineOffset * Math.sin(rad), y: refPos.y + lineOffset * Math.cos(rad) };
          const crPoint = rotatedLocalPoint(lineLocal, sym, comp.rotation);
          const crX = (comp.x + crPoint.x) * sx, crY = (comp.y + crPoint.y) * sy;
          doc.text(line, crX, crY, { align: refPos.anchor === 'end' ? 'right' : refPos.anchor === 'start' ? 'left' : 'center', angle: -refPos.rotation });

          let lineTargetPdfPage: number | undefined;
          if (options.interactiveCrossReferences) {
            const target = targets[lineIndex];
            if (target) {
              const targetPage = project.pages.find(p => p.id === target.pageId);
              lineTargetPdfPage = pageIdMapping?.get(target.pageId) ?? (targetPage && pageMapping.get(targetPage.pageNumber));
            }
            if (!lineTargetPdfPage) {
              const m = line.match(/\/([^\s,|/:]+)\.(\d+)/);
              if (m) lineTargetPdfPage = pageMapping.get(m[1]);
            }
            lineTargetPdfPage ??= targetPdfPage;
          }

          // Add PDF Hyperlink on text if interactive cross-references are enabled
          if (options.interactiveCrossReferences && lineTargetPdfPage) {
            const textW = doc.getTextWidth(line), textH = refPos.fontSize * sy;
            const startX = refPos.anchor === 'end' ? -textW : refPos.anchor === 'start' ? 0 : -textW / 2;
            const a = refPos.rotation * Math.PI / 180;
            const corners = [[startX,-textH],[startX+textW,-textH],[startX,.25*textH],[startX+textW,.25*textH]]
              .map(([x,y])=>({x:crX+x*Math.cos(a)-y*Math.sin(a),y:crY+x*Math.sin(a)+y*Math.cos(a)}));
            const linkX = Math.min(...corners.map(p=>p.x)), linkY = Math.min(...corners.map(p=>p.y));
            const linkW = Math.max(...corners.map(p=>p.x))-linkX, linkH = Math.max(...corners.map(p=>p.y))-linkY;
            doc.link(linkX, linkY, linkW, linkH, { pageNumber: lineTargetPdfPage });
            if (options.colorMode === 'color') {
              doc.setDrawColor(66, 153, 225);
              doc.setLineWidth(0.15);
              doc.rect(linkX, linkY, linkW, linkH);
            }
          }
        });
      }
    }
  }

  /** The library contour is the single source for the editor and PDF. */
  private static drawVectorSymbol(doc: jsPDF, symId: string, x: number, y: number, w: number, h: number,
    sym?: SymbolDefinition, rotation = 0, foreground = '#000000', monochrome = false): void {
    if (sym?.svgContent) {
      renderSymbolSvg(doc, sym.svgContent, x, y, w, h, sym.width, sym.height, rotation, foreground, monochrome);
    } else if (!sym || (!isConnectionSymbol(sym) && sym.category !== 'connections')) {
      doc.rect(x, y, w, h);
    }
  }

  /**
   * Generates formatted DIN A3/A4 Klemmenplan (terminal matrix) pages in PDF
   */
  private static renderTerminalDiagramPage(
    doc: jsPDF,
    project: Project,
    wMm: number,
    hMm: number,
    colorMode: 'color' | 'monochrome',
    totalSheets: number,
    pages?: TerminalPdfPage[]
  ): void {
    const isEn = project.language === 'en';
    const pagePrefix = isEn ? 'TD' : 'KP';
    const terminalPages = pages ?? layoutTerminalDiagramPdf(TerminalDiagramGenerator.generateTerminalReport(project), hMm);
    const dummyPage: Page = {
      id: 'rep_term',
      pageNumber: pagePrefix,
      pageType: 'terminal_diagram',
      title: isEn ? 'Report: Terminal Diagram' : 'Auswertung: Klemmenplan',
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
          projectTitle: project.name,
          commission: 'KOM-2026',
          company: project.company,
          author: project.author,
          date: new Date().toISOString().split('T')[0],
          revision: '1.0',
          sheetNumber: pagePrefix,
          totalSheets: totalSheets.toString()
        }
      }
    };

    const tableX = 20;
    const colWidths = [30, 45, 45, 60, 30];
    const headers = isEn
      ? ['Terminal', 'Internal Target', 'External Target', 'Function Text', 'Cross Section']
      : ['Klemme', 'Internes Ziel', 'Externes Ziel', 'Funktionstext', 'Querschnitt'];

    for (let index = 0; index < terminalPages.length; index++) {
      if (index > 0) {
        doc.addPage(wMm > 300 ? 'a3' : 'a4', 'landscape');
      }

      dummyPage.pageNumber = terminalPages.length > 1 ? `${pagePrefix}${index + 1}` : pagePrefix;
      dummyPage.plotFrame.titleBlock.sheetNumber = dummyPage.pageNumber;
      this.renderPlotFrame(doc, dummyPage, wMm, hMm, colorMode, totalSheets, project);

      let curY = 30;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text(isEn ? 'TERMINAL DIAGRAM (DIN EN 81346 / IEC 60617)' : 'KLEMMENPLAN (DIN EN 81346 / IEC 60617)', tableX, curY);
      curY += 10;

      for (const chunk of terminalPages[index]) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(colorMode === 'color' ? 200 : 0, colorMode === 'color' ? 100 : 0, 0);
        const contSuffix = chunk.continued
          ? (isEn ? ' – continued' : ' – Fortsetzung')
          : '';
        doc.text(
          isEn
            ? `Terminal Strip: ${chunk.stripName} (Cabinet +S1)${contSuffix}`
            : `Klemmenleiste: ${chunk.stripName} (Schaltschrank +S1)${contSuffix}`,
          tableX,
          curY
        );
        curY += 5;

        // Table Header
        doc.setFillColor(240, 240, 240);
        doc.rect(tableX, curY, 210, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);

        let tx = tableX;
        for (let h = 0; h < headers.length; h++) {
          doc.text(headers[h], tx + 2, curY + 5);
          tx += colWidths[h];
        }
        curY += 7;

        // Table Rows
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        for (const entry of chunk.entries) {
          doc.setDrawColor(220, 220, 220);
          doc.line(tableX, curY + 6, tableX + 210, curY + 6);

          tx = tableX;
          doc.setFont('courier', 'bold');
          doc.text(entry.terminalNumber, tx + 2, curY + 4.5);
          tx += colWidths[0];

          doc.setFont('courier', 'normal');
          doc.text(entry.internalTarget, tx + 2, curY + 4.5);
          tx += colWidths[1];

          doc.text(entry.externalTarget, tx + 2, curY + 4.5);
          tx += colWidths[2];

          doc.setFont('helvetica', 'normal');
          doc.text(entry.functionText, tx + 2, curY + 4.5);
          tx += colWidths[3];

          doc.text(entry.crossSection || '2.5mm²', tx + 2, curY + 4.5);

          curY += 6;
        }

        curY += 10;
      }
    }
  }

  /**
   * Generates wrapped and paginated DIN A3/A4 Stückliste (BOM) pages in PDF
   */
  private static renderPartsListPage(
    doc: jsPDF,
    project: Project,
    wMm: number,
    hMm: number,
    colorMode: 'color' | 'monochrome',
    totalSheets: number,
    pages: BomPage[]
  ): void {
    const isEn = project.language === 'en';
    const pagePrefix = isEn ? 'BOM' : 'ST';
    const dummyPage: Page = {
      id: 'rep_bom',
      pageNumber: pagePrefix,
      pageType: 'parts_list',
      title: isEn ? 'Report: Bill of Materials' : 'Auswertung: Stückliste',
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
          projectTitle: project.name,
          commission: 'KOM-2026',
          company: project.company,
          author: project.author,
          date: new Date().toISOString().split('T')[0],
          revision: '1.0',
          sheetNumber: pagePrefix,
          totalSheets: totalSheets.toString()
        }
      }
    };

    const tableX = 20;
    const columns = getBomColumns(project.language ?? 'de');
    const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
    for (let index = 0; index < pages.length; index++) {
      if (index) doc.addPage(wMm > 300 ? 'a3' : 'a4', 'landscape');
      dummyPage.pageNumber = pages.length > 1 ? `${pagePrefix}${index + 1}` : pagePrefix;
      dummyPage.plotFrame.titleBlock.sheetNumber = dummyPage.pageNumber;
      this.renderPlotFrame(doc, dummyPage, wMm, hMm, colorMode, totalSheets);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(0, 0, 0);
      doc.text(isEn ? 'BILL OF MATERIALS (BOM)' : 'ARTIKELSTÜCKLISTE (BILL OF MATERIALS)', tableX, 30);
      doc.setFillColor(240, 240, 240);
      doc.rect(tableX, 40, tableWidth, 7, 'F');
      doc.setFontSize(8);
      let tx = tableX;
      for (const column of columns) {
        doc.text(column.title, tx + 2, 45); tx += column.width;
      }
      let curY = BOM_ROWS_TOP;
      for (const row of pages[index]) {
        tx = tableX;
        for (let i = 0; i < columns.length; i++) {
          const column = columns[i];
          doc.setFont(column.font, column.style); doc.setFontSize(BOM_FONT_SIZE);
          row.cells[i].forEach((line, lineIndex) => doc.text(line, tx + 2, curY + 4.5 + lineIndex * BOM_LINE_HEIGHT));
          tx += column.width;
        }
        curY += row.height;
        doc.setDrawColor(220, 220, 220); doc.setLineWidth(.15);
        doc.line(tableX, curY, tableX + tableWidth, curY);
      }
    }
  }

  private static getPinCoords(page: Page, compId: string, pinId: string, project: Project): { x: number; y: number } | null {
    const comp = page.components.find(c => c.id === compId);
    if (!comp) return null;
    const sym = getSymbolForComponent(comp, project);
    if (!sym) return null;
    const pin = sym.pins.find(p => p.id === pinId);
    if (!pin) return null;
    const angle = comp.rotation * Math.PI / 180, dx = pin.x - sym.width / 2, dy = pin.y - sym.height / 2;
    return { x: comp.x + sym.width / 2 + dx * Math.cos(angle) - dy * Math.sin(angle),
      y: comp.y + sym.height / 2 + dx * Math.sin(angle) + dy * Math.cos(angle) };
  }

  private static renderImportedGraphics(doc: jsPDF, graphics: DrawingPrimitive[], sx: number, sy: number,
    mode: 'color' | 'monochrome', ox = 0, oy = 0, foreground?: string): void {
    const x = (n: number) => (n + ox) * sx, y = (n: number) => (n + oy) * sy;
    const rgb = (value: string): number[] => {
      const hex = value.replace('#', '');
      if (mode === 'monochrome' || !/^(?:[a-f0-9]{3}|[a-f0-9]{6})$/i.test(hex)) return [0, 0, 0];
      const full = hex.length === 3 ? [...hex].map(c => c + c).join('') : hex;
      const channels = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
      // White and light editor foregrounds must remain visible on white PDF paper.
      return channels.every(c => c >= 200) ? [0, 0, 0] : channels;
    };
    for (const g of graphics) {
      const color = rgb(foreground ?? g.color);
      doc.setDrawColor(color[0], color[1], color[2]); doc.setTextColor(color[0], color[1], color[2]);
      const width = g.kind === 'rect' ? g.lineWidth ?? 0.6 : 'width' in g ? g.width ?? 0.6 : 0.5;
      doc.setLineWidth(width * sx);
      doc.setLineDashPattern('dash' in g ? g.dash?.map(n => n * sx) ?? [] : [], 0);
      if (g.kind === 'line') doc.line(x(g.x1), y(g.y1), x(g.x2), y(g.y2));
      else if (g.kind === 'rect') doc.rect(x(g.x), y(g.y), g.width * sx, g.height * sy);
      else if (g.kind === 'circle') {
        if (g.fill) {
          const fill = rgb(foreground ?? g.fill);
          doc.setFillColor(fill[0], fill[1], fill[2]);
        }
        doc.circle(x(g.x), y(g.y), g.radius * sx, g.fill ? 'FD' : 'S');
      } else if (g.kind === 'polygon' || g.kind === 'arc') {
        const points = g.kind === 'polygon' ? g.points : arcPoints(g);
        if (points.length < 2) continue;
        if (g.kind === 'polygon' && g.fill) {
          const fill = rgb(foreground ?? g.fill);
          doc.setFillColor(fill[0], fill[1], fill[2]);
        }
        const path = points.map((point, i) => ({ op: i ? 'l' : 'm', c: [x(point.x), y(point.y)] }));
        if (g.kind === 'polygon') path.push({ op: 'h', c: [] });
        doc.path(path);
        if (g.kind === 'polygon' && g.fill) doc.fillStroke(); else doc.stroke();
      } else {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(g.size * sy * 72 / 25.4);
        doc.text(g.text, x(g.x), y(g.y), { align: g.anchor === 'end' ? 'right' : g.anchor === 'middle' ? 'center' : 'left', angle: -(g.rotation ?? 0) });
      }
    }
    doc.setLineDashPattern([], 0);
  }

  private static getPotentialRgb(potential: string, color?: string): { r: number; g: number; b: number } {
    const pot = (potential || '').toUpperCase();
    const col = (color || '').toUpperCase();
    if (col === 'BU' || pot === 'N' || pot.startsWith('N')) return { r: 37, g: 99, b: 235 };
    if (col === 'GNYE' || pot === 'PE' || pot === 'PEN' || pot.startsWith('PE')) return { r: 22, g: 163, b: 74 };
    if (col === 'RD' || pot === '+24V') return { r: 220, g: 38, b: 38 };
    if (col === 'BK' || pot.startsWith('L')) return { r: 0, g: 0, b: 0 };
    if (col === 'DBU' || pot === '0V') return { r: 30, g: 64, b: 175 };
    return { r: 220, g: 38, b: 38 };
  }
}
