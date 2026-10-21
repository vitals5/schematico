import { boxDrawing } from '../model/DeviceBox';
import { cableDrawing } from '../model/CableDefinition';
import { coverPageTemplate, coverPageTextRuns, coverPageLogo } from '../model/CoverPage';
import { prepareProjectPresentation } from '../model/PresentationNaming';
import { defaultPlotFrame, frameTextCell, frameTextValue, fitFrameText } from '../model/PlotFrame';
import { interruptionLabelPosition, isInterruptionSymbol, isConnectionSymbol } from '../model/ConnectionSymbols';
import { rotatedLocalPoint } from '../model/SymbolGeometry';
import { getAutoSymbolScale } from '../model/FloorPlanRenderer';
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
import { computeBmkPosition, computeFunctionTextPosition, computeAdditionalTextPosition, computeTechnicalDataPosition, computeCrossReferencePosition } from '../model/LabelLayout';
import { jsPDF } from 'jspdf';
import { Project, Page, PlacedComponent, Wire, DrawingPrimitive, SymbolDefinition } from '../model/types';
import { getSymbolForComponent } from '../model/symbols';
import { TerminalDiagramGenerator } from '../reports/TerminalDiagram';
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

    // Mapping from page.pageNumber to 1-based PDF page index
    const pageNumberToPdfPageIndex = new Map<string, number>();
    pagesToExport.forEach((page, index) => {
      pageNumberToPdfPageIndex.set(page.pageNumber, index + 1);
    });

    // Total sheet count update
    const bomColumns = getBomColumns(project.language ?? 'de');
    const bomPages = options.includePartsList ? layoutPartsListPdf(doc, PartsListGenerator.generatePartsList(project), pageHeightMm, bomColumns) : [];
    const extraSheets = (options.includeTerminalDiagram ? 1 : 0) + bomPages.length;
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

      // Render Embedded Images
      this.renderImages(doc, page, pageWidthMm, pageHeightMm);

      // Render Structure Boxes (Ortskästen / Schaltschrankumrahmungen)
      this.renderBoxes(doc, page, pageWidthMm, pageHeightMm, options.colorMode);

      // Render Wires
      this.renderWires(doc, page, project, pageWidthMm, pageHeightMm, options.colorMode);

      // Render Components & Interactive Cross-Reference Links
      this.renderComponents(doc, page, project, pageWidthMm, pageHeightMm, options, pageNumberToPdfPageIndex);
      for (const cable of page.cables ?? []) this.renderImportedGraphics(doc, cableDrawing(cable,page,project),pageWidthMm/page.plotFrame.width,pageHeightMm/page.plotFrame.height,options.colorMode);

      // Render Free Texts & Annotations
      this.renderTexts(doc, page, pageWidthMm, pageHeightMm, options.colorMode);
      this.renderImportedGraphics(doc, page.importedDrawing?.graphics ?? [], pageWidthMm / page.plotFrame.width,
        pageHeightMm / page.plotFrame.height, options.colorMode);
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
      this.renderTerminalDiagramPage(doc, project, pageWidthMm, pageHeightMm, options.colorMode, totalSheetsCount);
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

      doc.setFont('helvetica', (t.fontWeight === 'bold' || isHeader) ? 'bold' : 'normal');
      doc.setFontSize(Math.max(6, (t.fontSize || 9) * 0.75));

      if (isMonochrome) {
        doc.setTextColor(0, 0, 0);
      } else if (isHeader) {
        doc.setTextColor(43, 108, 176);
      } else {
        doc.setTextColor(74, 85, 104);
      }

      doc.text(t.text, xMm, yMm);
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
      doc.setLineWidth(wire.lineWidth === undefined ? 0.35 : wire.lineWidth * sx);
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
    pageMapping: Map<string, number>
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
      const isConnection = !sym.importedGraphics && (sym.category === 'connections' || isConnectionSymbol(sym) || sym.id.startsWith('potential_arrow') || sym.id === 'potential_rail_source');
      const isTerminal = sym.id === 'terminal_single' || sym.id === 'terminal_pe';

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
        this.drawVectorSymbol(this.rotatedSymbolDocument(doc, compX, compY, compW, compH, comp.rotation, sx, sy), sym.id, compX, compY, compW, compH, sym);
      }

      // Label anchors are library data for imported and built-in symbols alike.
      for (const pin of sym.pins) {
        const label = comp.pins[pin.id]?.labelPosition ?? pin.labelPosition;
        if (sym.source || label) {
          // Electrical contact circles are already part of the library vectors.
          if (!label || label.visible === false) continue;
          const point = rotatedLocalPoint(label, sym, comp.rotation);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize((comp.pinLabelFontSize ?? label.fontSize) * sy * 72 / 25.4);
          doc.setTextColor(0, 0, 0);
          doc.text(comp.pins[pin.id]?.customLabel ?? pin.name, (comp.x + point.x) * sx, (comp.y + point.y) * sy,
            { align: label.alignment === 'middle' ? 'center' : label.alignment === 'end' ? 'right' : 'left', angle: -(label.rotation ?? 0) });
        } else if (!isConnection && !isTerminal) {
          const coords = this.getPinCoords(page, comp.id, pin.id, project)!;
          const px = coords.x * sx, py = coords.y * sy;
          doc.setFillColor(255, 255, 255);
          doc.circle(px, py, 0.4, 'FD');
          doc.setFont('courier', 'normal');
          doc.setFontSize((comp.pinLabelFontSize ?? 6.5) * sy * 72 / 25.4);
          doc.setTextColor(80, 80, 80);
          const ty = pin.direction === 'top' ? py - 1.0 : py + 2.0;
          doc.text(comp.pins[pin.id]?.customLabel ?? pin.name, px, ty, { align: 'center' });
        }
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
          doc.setFont('helvetica', bold || pos.fontWeight === 'bold' ? 'bold' : 'normal');
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
      if (comp.crossRef && refPos.visible && (!isConnection || isInterruptionSymbol(sym))) {
        const crPoint = rotatedLocalPoint(refPos, sym, comp.rotation);
        const crX = (comp.x + crPoint.x) * sx, crY = (comp.y + crPoint.y) * sy;
        doc.setFont('courier', 'bold');
        doc.setFontSize(refPos.fontSize * sy * 72 / 25.4);
        doc.setTextColor(options.colorMode === 'color' ? 200 : 50, 50, 0);
        doc.text(comp.crossRef, crX, crY, { align: refPos.anchor === 'end' ? 'right' : refPos.anchor === 'start' ? 'left' : 'center', angle: -refPos.rotation });

        // Add PDF Hyperlink if interactive cross-references are enabled
        if (options.interactiveCrossReferences) {
          const match = comp.crossRef.match(/\/(\d+)\./);
          if (match) {
            const targetPageStr = match[1];
            const targetPdfPage = pageMapping.get(targetPageStr);
            if (targetPdfPage) {
              const textW = doc.getTextWidth(comp.crossRef), textH = refPos.fontSize * sy;
              const startX = refPos.anchor === 'end' ? -textW : refPos.anchor === 'start' ? 0 : -textW / 2;
              const a = refPos.rotation * Math.PI / 180;
              const corners = [[startX,-textH],[startX+textW,-textH],[startX,.25*textH],[startX+textW,.25*textH]]
                .map(([x,y])=>({x:crX+x*Math.cos(a)-y*Math.sin(a),y:crY+x*Math.sin(a)+y*Math.cos(a)}));
              const linkX = Math.min(...corners.map(p=>p.x)), linkY = Math.min(...corners.map(p=>p.y));
              const linkW = Math.max(...corners.map(p=>p.x))-linkX, linkH = Math.max(...corners.map(p=>p.y))-linkY;
              doc.link(linkX, linkY, linkW, linkH, { pageNumber: targetPdfPage });
              if (options.colorMode === 'color') {
                doc.setDrawColor(66, 153, 225);
                doc.setLineWidth(0.15);
                doc.rect(linkX, linkY, linkW, linkH);
              }
            }
          }
        }
      }
    }
  }

  /** Rotate built-in outlines and text anchors with the same center as their pins. */
  private static rotatedSymbolDocument(doc: jsPDF, x: number, y: number, w: number, h: number, rotation: number, sx: number, sy: number): jsPDF {
    if (!rotation) return doc;
    const rad = rotation * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
    const point = (px: number, py: number) => [x+w/2+(px-x-w/2)*cos-(py-y-h/2)*sin*sx/sy,
      y+h/2+(px-x-w/2)*sin*sy/sx+(py-y-h/2)*cos] as [number,number];
    const polygon = (points: [number,number][], style?: string) => {
      doc.path([...points.map(([px,py], i) => ({op: i ? 'l' : 'm', c: point(px,py)})), {op:'h',c:[]}]);
      if (style === 'F') doc.fill(); else if (style === 'FD' || style === 'DF') doc.fillStroke(); else doc.stroke();
      return doc;
    };
    const methods = {
      line: (x1: number,y1: number,x2: number,y2: number) => doc.line(...point(x1,y1),...point(x2,y2)),
      rect: (px: number,py: number,pw: number,ph: number,style?: string) => polygon([[px,py],[px+pw,py],[px+pw,py+ph],[px,py+ph]],style),
      triangle: (x1: number,y1: number,x2: number,y2: number,x3: number,y3: number,style?: string) => polygon([[x1,y1],[x2,y2],[x3,y3]],style),
      circle: (px: number,py: number,r: number,style?: string) => doc.circle(...point(px,py),r,style),
      ellipse: (px: number,py: number,rx: number,ry: number,style?: string) => doc.ellipse(...point(px,py),Math.abs(sin)>.5?ry*sx/sy:rx,Math.abs(sin)>.5?rx*sy/sx:ry,style),
      text: (text: string,px: number,py: number,options?: Parameters<jsPDF['text']>[3]) => doc.text(text,...point(px,py),options),
    };
    return new Proxy(doc, {get(target,key) {
      if (key in methods) return methods[key as keyof typeof methods];
      const value = Reflect.get(target,key); return typeof value === 'function' ? value.bind(target) : value;
    }});
  }

  /**
   * Vector drawing commands for DIN EN 60617 symbols in PDF
   */
  private static drawVectorSymbol(doc: jsPDF, symId: string, x: number, y: number, w: number, h: number, sym?: SymbolDefinition): void {
    switch (symId) {
      case 'contactor_coil': {
        doc.rect(x + w * 0.2, y + h * 0.25, w * 0.6, h * 0.5);
        doc.line(x + w * 0.5, y, x + w * 0.5, y + h * 0.25);
        doc.line(x + w * 0.5, y + h * 0.75, x + w * 0.5, y + h);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text('K', x + w * 0.5, y + h * 0.55, { align: 'center' });
        break;
      }
      case 'contact_no':
      case 'pushbutton_no':
      case 'switch_single': {
        doc.line(x + w * 0.5, y, x + w * 0.5, y + h * 0.35);
        doc.line(x + w * 0.5, y + h * 0.35, x + w * 0.85, y + h * 0.65);
        doc.line(x + w * 0.5, y + h * 0.68, x + w * 0.5, y + h);
        doc.circle(x + w * 0.5, y + h * 0.35, 0.4, 'F');
        doc.circle(x + w * 0.5, y + h * 0.68, 0.4, 'F');
        break;
      }
      case 'contact_nc':
      case 'pushbutton_emergency_stop': {
        doc.line(x + w * 0.5, y, x + w * 0.5, y + h * 0.35);
        doc.line(x + w * 0.5, y + h * 0.35, x + w * 0.15, y + h * 0.65);
        doc.line(x + w * 0.15, y + h * 0.65, x + w * 0.5, y + h * 0.65);
        doc.line(x + w * 0.5, y + h * 0.68, x + w * 0.5, y + h);
        break;
      }
      case 'circuit_breaker_1p': {
        doc.line(x + w * 0.5, y, x + w * 0.5, y + h * 0.28);
        doc.line(x + w * 0.5, y + h * 0.28, x + w * 0.8, y + h * 0.58);
        doc.line(x + w * 0.5, y + h * 0.62, x + w * 0.5, y + h);
        // Thermal bimetal
        doc.rect(x + w * 0.35, y + h * 0.68, w * 0.3, h * 0.18);
        // Magnetic trip
        doc.line(x + w * 0.65, y + h * 0.42, x + w * 0.8, y + h * 0.34);
        doc.line(x + w * 0.8, y + h * 0.34, x + w * 0.8, y + h * 0.5);
        break;
      }
      case 'circuit_breaker_3p': {
        const poleOffsets = [12, 36, 60];
        for (let p = 0; p < 3; p++) {
          const px = x + w * (poleOffsets[p] / 72);
          doc.line(px, y, px, y + h * 0.28);
          doc.line(px, y + h * 0.28, px + w * 0.1, y + h * 0.58);
          doc.line(px, y + h * 0.62, px, y + h);
          doc.rect(px - 1.2, y + h * 0.68, 2.4, 2.0);
        }
        doc.setLineDashPattern([1, 1], 0);
        doc.line(x + w * (12 / 72), y + h * 0.44, x + w * (60 / 72), y + h * 0.44);
        doc.setLineDashPattern([], 0);
        break;
      }
      case 'fuse_switch_3p': {
        const poleOffsets = [12, 36, 60];
        for (let p = 0; p < 3; p++) {
          const px = x + w * (poleOffsets[p] / 72);
          doc.line(px, y, px, y + h * 0.15);
          doc.rect(px - 1.5, y + h * 0.15, 3.0, h * 0.3);
          doc.line(px, y + h * 0.15, px, y + h * 0.45);
          doc.line(px, y + h * 0.45, px + w * 0.1, y + h * 0.72);
          doc.line(px, y + h * 0.75, px, y + h);
        }
        doc.setLineDashPattern([1, 1], 0);
        doc.line(x + w * (12 / 72), y + h * 0.6, x + w * (60 / 72), y + h * 0.6);
        doc.setLineDashPattern([], 0);
        break;
      }
      case 'main_switch_4p':
      case 'changeover_switch_4p': {
        const poleOffsets = [12, 36, 60, 84];
        for (let p = 0; p < 4; p++) {
          const px = x + w * (poleOffsets[p] / 96);
          doc.line(px, y, px, y + h * 0.3);
          doc.line(px, y + h * 0.3, px + w * 0.08, y + h * 0.65);
          doc.line(px, y + h * 0.68, px, y + h);
        }
        doc.setLineDashPattern([1, 1], 0);
        doc.line(x + w * (12 / 96), y + h * 0.48, x + w * (84 / 96), y + h * 0.48);
        doc.setLineDashPattern([], 0);
        break;
      }
      case 'energy_meter_3p': {
        doc.rect(x + w * 0.05, y + h * 0.15, w * 0.9, h * 0.7, 'S');
        doc.line(x + w * 0.05, y + h * 0.45, x + w * 0.95, y + h * 0.45);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('kWh', x + w * 0.5, y + h * 0.35, { align: 'center' });
        const poleOffsets = [12, 36, 60, 84];
        for (let p = 0; p < 4; p++) {
          const px = x + w * (poleOffsets[p] / 96);
          doc.line(px, y, px, y + h * 0.15);
          doc.line(px, y + h * 0.85, px, y + h);
        }
        break;
      }
      case 'contactor_power_3p':
      case 'motor_protective_switch': {
        for (let p = 0; p < 3; p++) {
          const px = x + w * (0.16 + p * 0.33);
          doc.line(px, y, px, y + h * 0.3);
          doc.line(px, y + h * 0.3, px + w * 0.12, y + h * 0.6);
          doc.line(px, y + h * 0.65, px, y + h);
          if (symId === 'motor_protective_switch') {
            doc.rect(px - 1.5, y + h * 0.72, 3, 2.5);
          }
        }
        doc.setLineDashPattern([1, 1], 0);
        doc.line(x + w * 0.2, y + h * 0.45, x + w * 0.8, y + h * 0.45);
        doc.setLineDashPattern([], 0);
        break;
      }
      case 'motor_3phase':
      case 'motor_1phase': {
        const radius = Math.min(w, h) * 0.38;
        const cx = x + w * 0.5;
        const cy = y + h * 0.55;
        doc.circle(cx, cy, radius);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text('M', cx, cy - 0.5, { align: 'center' });
        doc.setFontSize(6);
        doc.text(symId === 'motor_3phase' ? '3 ~' : '1 ~', cx, cy + 3.5, { align: 'center' });
        if (symId === 'motor_3phase') {
          doc.line(cx - radius * 0.5, y, cx - radius * 0.5, cy - radius);
          doc.line(cx, y, cx, cy - radius);
          doc.line(cx + radius * 0.5, y, cx + radius * 0.5, cy - radius);
        } else {
          doc.line(cx - radius * 0.4, y, cx - radius * 0.4, cy - radius);
          doc.line(cx + radius * 0.4, y, cx + radius * 0.4, cy - radius);
        }
        break;
      }
      case 'socket_schuko': {
        doc.line(x + w * 0.25, y, x + w * 0.25, y + h * 0.35);
        doc.line(x + w * 0.5, y, x + w * 0.5, y + h * 0.35);
        doc.line(x + w * 0.75, y, x + w * 0.75, y + h * 0.35);
        doc.ellipse(x + w * 0.5, y + h * 0.35, w * 0.35, h * 0.45, 'S');
        doc.circle(x + w * 0.4, y + h * 0.55, 0.5, 'F');
        doc.circle(x + w * 0.6, y + h * 0.55, 0.5, 'F');
        break;
      }
      case 'light_bulb': {
        const radius = Math.min(w, h) * 0.38;
        const cx = x + w * 0.5;
        const cy = y + h * 0.5;
        doc.circle(cx, cy, radius);
        doc.line(cx - radius * 0.707, cy - radius * 0.707, cx + radius * 0.707, cy + radius * 0.707);
        doc.line(cx + radius * 0.707, cy - radius * 0.707, cx - radius * 0.707, cy + radius * 0.707);
        doc.line(cx, y, cx, cy - radius);
        doc.line(cx, cy + radius, cx, y + h);
        break;
      }
      case 'rj45_port': {
        doc.rect(x + w * 0.15, y + h * 0.25, w * 0.7, h * 0.6, 'S');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5);
        doc.text('ETH', x + w * 0.5, y + h * 0.6, { align: 'center' });
        doc.line(x + w * 0.5, y, x + w * 0.5, y + h * 0.25);
        break;
      }
      case 'valve_actuator': {
        doc.triangle(x + w * 0.2, y + h * 0.2, x + w * 0.8, y + h * 0.8, x + w * 0.2, y + h * 0.8, 'S');
        doc.triangle(x + w * 0.8, y + h * 0.2, x + w * 0.8, y + h * 0.8, x + w * 0.2, y + h * 0.2, 'S');
        doc.line(x + w * 0.5, y, x + w * 0.5, y + h * 0.3);
        doc.line(x + w * 0.5, y + h * 0.7, x + w * 0.5, y + h);
        break;
      }
      case 'thermostat_box': {
        doc.rect(x + w * 0.08, y + h * 0.2, w * 0.84, h * 0.6, 'S');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.text('°C', x + w * 0.5, y + h * 0.55, { align: 'center' });
        break;
      }
      case 'inverter_solar': {
        doc.setLineDashPattern([1.5, 1], 0);
        doc.rect(x + w * 0.03, y + h * 0.1, w * 0.94, h * 0.8, 'S');
        doc.setLineDashPattern([], 0);
        doc.line(x + w * 0.03, y + h * 0.1, x + w * 0.97, y + h * 0.9);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text('DC', x + w * 0.25, y + h * 0.65);
        doc.text('AC ~', x + w * 0.7, y + h * 0.35);
        break;
      }
      case 'electronic_relay_4ch': {
        doc.rect(x + w * 0.04, y + h * 0.12, w * 0.92, h * 0.76, 'S');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text('ESR12Z-4DX-UC', x + w * 0.5, y + h * 0.42, { align: 'center' });
        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'normal');
        doc.text('4-Kanal Multifunktion', x + w * 0.5, y + h * 0.62, { align: 'center' });
        break;
      }
      case 'potential_arrow':
      case 'potential_arrow_down': {
        const cx = x + w * 0.5;
        doc.line(cx, y, cx, y + h * 0.45);
        doc.triangle(cx - w * 0.25, y + h * 0.45, cx, y + h * 0.92, cx + w * 0.25, y + h * 0.45, 'FD');
        break;
      }
      case 'potential_arrow_up': {
        const cx = x + w * 0.5;
        doc.line(cx, y + h, cx, y + h * 0.55);
        doc.triangle(cx - w * 0.25, y + h * 0.55, cx, y + h * 0.08, cx + w * 0.25, y + h * 0.55, 'FD');
        break;
      }
      case 'potential_arrow_right': {
        const cy = y + h * 0.5;
        doc.line(x, cy, x + w * 0.45, cy);
        doc.triangle(x + w * 0.45, cy - h * 0.25, x + w * 0.92, cy, x + w * 0.45, cy + h * 0.25, 'FD');
        break;
      }
      case 'potential_arrow_left': {
        const cy = y + h * 0.5;
        doc.line(x + w, cy, x + w * 0.55, cy);
        doc.triangle(x + w * 0.55, cy - h * 0.25, x + w * 0.08, cy, x + w * 0.55, cy + h * 0.25, 'FD');
        break;
      }
      case 't_piece_down': {
        const cx = x + w * 0.5, cy = y + h * 0.5;
        doc.line(x, cy, x + w, cy);
        doc.line(cx, cy, cx, y + h);
        doc.circle(cx, cy, 0.8, 'FD');
        break;
      }
      case 't_piece_up': {
        const cx = x + w * 0.5, cy = y + h * 0.5;
        doc.line(x, cy, x + w, cy);
        doc.line(cx, y, cx, cy);
        doc.circle(cx, cy, 0.8, 'FD');
        break;
      }
      case 't_piece_right': {
        const cx = x + w * 0.5, cy = y + h * 0.5;
        doc.line(cx, y, cx, y + h);
        doc.line(cx, cy, x + w, cy);
        doc.circle(cx, cy, 0.8, 'FD');
        break;
      }
      case 't_piece_left': {
        const cx = x + w * 0.5, cy = y + h * 0.5;
        doc.line(cx, y, cx, y + h);
        doc.line(x, cy, cx, cy);
        doc.circle(cx, cy, 0.8, 'FD');
        break;
      }
      case 'corner_top_right': {
        const cx = x + w * 0.5, cy = y + h * 0.5;
        doc.line(x, cy, cx, cy);
        doc.line(cx, cy, cx, y + h);
        break;
      }
      case 'corner_top_left': {
        const cx = x + w * 0.5, cy = y + h * 0.5;
        doc.line(x + w, cy, cx, cy);
        doc.line(cx, cy, cx, y + h);
        break;
      }
      case 'corner_bottom_right': {
        const cx = x + w * 0.5, cy = y + h * 0.5;
        doc.line(x, cy, cx, cy);
        doc.line(cx, cy, cx, y);
        break;
      }
      case 'corner_bottom_left': {
        const cx = x + w * 0.5, cy = y + h * 0.5;
        doc.line(x + w, cy, cx, cy);
        doc.line(cx, cy, cx, y);
        break;
      }
      case 'cross_junction': {
        const cx = x + w * 0.5, cy = y + h * 0.5;
        doc.line(x, cy, x + w, cy);
        doc.line(cx, y, cx, y + h);
        doc.circle(cx, cy, 0.9, 'FD');
        break;
      }
      case 'cross_bridge': {
        const cx = x + w * 0.5, cy = y + h * 0.5;
        doc.line(cx, y, cx, y + h);
        const br = w * 0.2;
        doc.line(x, cy, cx - br, cy);
        doc.line(cx + br, cy, x + w, cy);
        for (let i = 0; i < 6; i++) {
          const a1 = Math.PI - (i / 6) * Math.PI, a2 = Math.PI - ((i + 1) / 6) * Math.PI;
          doc.line(cx + br * Math.cos(a1), cy - br * Math.sin(a1), cx + br * Math.cos(a2), cy - br * Math.sin(a2));
        }
        break;
      }
      case 'potential_rail_source': {
        doc.circle(x + w * 0.5, y + h * 0.5, 0.9, 'S');
        doc.line(x + w * 0.5 + 0.9, y + h * 0.5, x + w, y + h * 0.5);
        break;
      }
      case 'terminal_pe': {
        doc.line(x + w * 0.5, y, x + w * 0.5, y + h * 0.4);
        doc.circle(x + w * 0.5, y + h * 0.5, 1.0, 'FD');
        doc.line(x + w * 0.5, y + h * 0.6, x + w * 0.5, y + h);
        break;
      }
      case 'ground_pe': {
        doc.line(x + w * 0.5, y, x + w * 0.5, y + h * 0.5);
        doc.line(x + w * 0.1, y + h * 0.5, x + w * 0.9, y + h * 0.5);
        doc.line(x + w * 0.25, y + h * 0.75, x + w * 0.75, y + h * 0.75);
        doc.line(x + w * 0.4, y + h, x + w * 0.6, y + h);
        break;
      }
      case 'power_supply_dc': {
        doc.rect(x + w * 0.1, y + h * 0.15, w * 0.8, h * 0.7);
        doc.line(x + w * 0.1, y + h * 0.85, x + w * 0.9, y + h * 0.15);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text('~', x + w * 0.3, y + h * 0.45, { align: 'center' });
        doc.text('=', x + w * 0.7, y + h * 0.7, { align: 'center' });
        doc.line(x + w * 0.25, y, x + w * 0.25, y + h * 0.15);
        doc.line(x + w * 0.5, y, x + w * 0.5, y + h * 0.15);
        doc.line(x + w * 0.75, y, x + w * 0.75, y + h * 0.15);
        doc.line(x + w * 0.35, y + h * 0.85, x + w * 0.35, y + h);
        doc.line(x + w * 0.65, y + h * 0.85, x + w * 0.65, y + h);
        break;
      }
      case 'socket_switch': {
        doc.rect(x + w * 0.1, y + h * 0.25, w * 0.8, h * 0.65);
        doc.line(x + w * 0.25, y, x + w * 0.25, y + h * 0.25);
        doc.line(x + w * 0.5, y, x + w * 0.5, y + h * 0.25);
        doc.line(x + w * 0.75, y, x + w * 0.75, y + h * 0.25);
        const radius = Math.min(w, h) * 0.2;
        doc.circle(x + w * 0.5, y + h * 0.58, radius);
        doc.line(x + w * 0.5 - radius * 0.7, y + h * 0.58 - radius * 0.7, x + w * 0.5 + radius * 0.7, y + h * 0.58 + radius * 0.7);
        break;
      }
      case 'fuse_1p': {
        doc.rect(x + w * 0.25, y + h * 0.25, w * 0.5, h * 0.5);
        doc.line(x + w * 0.5, y, x + w * 0.5, y + h);
        break;
      }
      case 'pilot_lamp': {
        const radius = Math.min(w, h) * 0.35;
        const cx = x + w * 0.5;
        const cy = y + h * 0.5;
        doc.circle(cx, cy, radius);
        doc.line(cx - radius * 0.7, cy - radius * 0.7, cx + radius * 0.7, cy + radius * 0.7);
        doc.line(cx + radius * 0.7, cy - radius * 0.7, cx - radius * 0.7, cy + radius * 0.7);
        doc.line(cx, y, cx, cy - radius);
        doc.line(cx, cy + radius, cx, y + h);
        break;
      }
      case 'terminal_single': {
        doc.line(x + w * 0.5, y, x + w * 0.5, y + h * 0.38);
        doc.circle(x + w * 0.5, y + h * 0.5, 1.0, 'S');
        doc.line(x + w * 0.5, y + h * 0.62, x + w * 0.5, y + h);
        break;
      }
      case 'rcd_4p':
      case 'rcd_2p':
      case 'rcbo_1p_n': {
        const poles = symId === 'rcd_4p' ? 4 : 2;
        for (let p = 0; p < poles; p++) {
          const px = x + w * ((p + 0.5) / poles);
          doc.line(px, y, px, y + h * 0.28);
          doc.line(px, y + h * 0.28, px + w * 0.08, y + h * 0.58);
          doc.line(px, y + h * 0.62, px, y + h);
        }
        doc.ellipse(x + w * 0.5, y + h * 0.8, w * 0.42, h * 0.12);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        doc.text('T', x + w * 0.9, y + h * 0.8);
        break;
      }
      case 'impulse_relay_1no':
      case 'impulse_relay_2no': {
        doc.rect(x + w * 0.08, y + h * 0.25, w * 0.35, h * 0.48);
        doc.line(x + w * 0.25, y, x + w * 0.25, y + h * 0.25);
        doc.line(x + w * 0.25, y + h * 0.73, x + w * 0.25, y + h);
        doc.line(x + w * 0.12, y + h * 0.55, x + w * 0.2, y + h * 0.55);
        doc.line(x + w * 0.2, y + h * 0.55, x + w * 0.2, y + h * 0.4);
        doc.line(x + w * 0.2, y + h * 0.4, x + w * 0.35, y + h * 0.4);
        const contacts = symId === 'impulse_relay_2no' ? 2 : 1;
        for (let c = 0; c < contacts; c++) {
          const cx = x + w * (0.55 + c * 0.3);
          doc.line(cx, y, cx, y + h * 0.35);
          doc.line(cx, y + h * 0.35, cx + w * 0.15, y + h * 0.65);
          doc.line(cx, y + h * 0.65, cx, y + h);
        }
        break;
      }
      case 'timer_relay_multifunction': {
        doc.rect(x + w * 0.1, y + h * 0.25, w * 0.35, h * 0.45);
        doc.line(x + w * 0.1, y + h * 0.25, x + w * 0.45, y + h * 0.7);
        doc.line(x + w * 0.27, y, x + w * 0.27, y + h * 0.25);
        doc.line(x + w * 0.27, y + h * 0.7, x + w * 0.27, y + h);
        doc.line(x + w * 0.75, y, x + w * 0.75, y + h * 0.3);
        doc.line(x + w * 0.75, y + h * 0.3, x + w * 0.6, y + h * 0.6);
        doc.line(x + w * 0.6, y + h * 0.65, x + w * 0.6, y + h);
        doc.line(x + w * 0.85, y + h * 0.65, x + w * 0.85, y + h);
        break;
      }
      case 'surge_arrester_spd': {
        for (let s = 0; s < 4; s++) {
          const sx = x + w * (0.15 + s * 0.22);
          doc.rect(sx - 1.5, y + h * 0.3, 3, 5);
          doc.line(sx - 2, y + h * 0.6, sx + 2, y + h * 0.3);
          doc.line(sx, y, sx, y + h * 0.3);
          doc.line(sx, y + h * 0.65, sx, y + h * 0.8);
        }
        doc.line(x + w * 0.15, y + h * 0.8, x + w * 0.81, y + h * 0.8);
        doc.line(x + w * 0.48, y + h * 0.8, x + w * 0.48, y + h);
        break;
      }
      default: {
        if (sym?.svgContent) {
          this.renderSvgContent(doc, sym.svgContent, x, y, w, h, sym.width, sym.height);
        } else if (!sym || (!isConnectionSymbol(sym) && sym.category !== 'connections')) {
          doc.rect(x, y, w, h);
        }
        break;
      }
    }
  }

  /**
   * Fallback renderer that translates symbol svgContent into PDF vector primitives
   */
  private static renderSvgContent(doc: jsPDF, svg: string, x: number, y: number, w: number, h: number, symWidth: number, symHeight: number): void {
    const scaleX = w / (symWidth || 1), scaleY = h / (symHeight || 1);
    const toX = (val: number) => x + val * scaleX;
    const toY = (val: number) => y + val * scaleY;

    const tagRegex = /<([a-zA-Z]+)\b([^>]*)\/?>/g;
    let match: RegExpExecArray | null;
    while ((match = tagRegex.exec(svg)) !== null) {
      const tagName = match[1];
      const attrsStr = match[2];
      const getAttr = (name: string): string | undefined => {
        const m = new RegExp(`\\b${name}="([^"]*)"`).exec(attrsStr);
        return m ? m[1] : undefined;
      };
      const getNum = (name: string, def = 0): number => {
        const v = getAttr(name);
        return v !== undefined ? parseFloat(v) : def;
      };

      if (tagName === 'line') {
        doc.line(toX(getNum('x1')), toY(getNum('y1')), toX(getNum('x2')), toY(getNum('y2')));
      } else if (tagName === 'rect') {
        const rx = toX(getNum('x')), ry = toY(getNum('y'));
        const rw = getNum('width') * scaleX, rh = getNum('height') * scaleY;
        const fill = getAttr('fill');
        const isFilled = fill && fill !== 'none';
        doc.rect(rx, ry, rw, rh, isFilled ? 'FD' : 'S');
      } else if (tagName === 'circle') {
        const cx = toX(getNum('cx')), cy = toY(getNum('cy'));
        const r = getNum('r') * scaleX;
        const fill = getAttr('fill');
        const isFilled = fill && fill !== 'none';
        doc.circle(cx, cy, r, isFilled ? 'FD' : 'S');
      } else if (tagName === 'ellipse') {
        const cx = toX(getNum('cx')), cy = toY(getNum('cy'));
        const rx = getNum('rx') * scaleX, ry = getNum('ry') * scaleY;
        const fill = getAttr('fill');
        const isFilled = fill && fill !== 'none';
        doc.ellipse(cx, cy, rx, ry, isFilled ? 'FD' : 'S');
      } else if (tagName === 'polygon' || tagName === 'polyline') {
        const pointsStr = getAttr('points') || '';
        const pts = pointsStr.trim().split(/[\s,]+/).reduce((acc, val, i, arr) => {
          if (i % 2 === 0 && i + 1 < arr.length) {
            acc.push([toX(parseFloat(val)), toY(parseFloat(arr[i + 1]))]);
          }
          return acc;
        }, [] as [number, number][]);
        if (pts.length >= 2) {
          const fill = getAttr('fill');
          const isFilled = tagName === 'polygon' && fill && fill !== 'none';
          if (pts.length === 3) {
            doc.triangle(pts[0][0], pts[0][1], pts[1][0], pts[1][1], pts[2][0], pts[2][1], isFilled ? 'FD' : 'S');
          } else {
            for (let i = 1; i < pts.length; i++) {
              doc.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
            }
            if (tagName === 'polygon') {
              doc.line(pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1]);
            }
          }
        }
      }
    }
  }

  /**
   * Generates formatted DIN A3 Klemmenplan (terminal matrix) page in PDF
   */
  private static renderTerminalDiagramPage(
    doc: jsPDF,
    project: Project,
    wMm: number,
    hMm: number,
    colorMode: 'color' | 'monochrome',
    totalSheets: number
  ): void {
    const isEn = project.language === 'en';
    const dummyPage: Page = {
      id: 'rep_term',
      pageNumber: isEn ? 'TD' : 'KP',
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
          sheetNumber: isEn ? 'TD' : 'KP',
          totalSheets: totalSheets.toString()
        }
      }
    };

    this.renderPlotFrame(doc, dummyPage, wMm, hMm, colorMode, totalSheets);

    const strips = TerminalDiagramGenerator.generateTerminalReport(project);
    let curY = 30;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(isEn ? 'TERMINAL DIAGRAM (DIN EN 81346 / IEC 60617)' : 'KLEMMENPLAN (DIN EN 81346 / IEC 60617)', 20, curY);
    curY += 10;

    for (const [stripName, entries] of strips.entries()) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(colorMode === 'color' ? 200 : 0, colorMode === 'color' ? 100 : 0, 0);
      doc.text(isEn ? `Terminal Strip: ${stripName} (Cabinet +S1)` : `Klemmenleiste: ${stripName} (Schaltschrank +S1)`, 20, curY);
      curY += 5;

      // Table Header
      const tableX = 20;
      const colWidths = [30, 45, 45, 60, 30];
      const headers = isEn
        ? ['Terminal', 'Internal Target', 'External Target', 'Function Text', 'Cross Section']
        : ['Klemme', 'Internes Ziel', 'Externes Ziel', 'Funktionstext', 'Querschnitt'];

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
      for (const entry of entries) {
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
    if (col === 'RD' || pot.startsWith('L') || pot === '+24V' || col === 'BK') return { r: 220, g: 38, b: 38 };
    if (col === 'DBU' || pot === '0V') return { r: 30, g: 64, b: 175 };
    return { r: 220, g: 38, b: 38 };
  }
}
