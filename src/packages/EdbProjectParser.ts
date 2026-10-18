// src/packages/EdbProjectParser.ts
// Intelligent parser and reconstructor for CAD project archives (.edb / .elk / .zw1 / .zip)
// Extracts pages, symbols, functions, coordinates, and potential connections following IEC 81346.

import JSZip from 'jszip';
import { NativeProjectReader } from './NativeProjectReader';
import { NATIVE_SCALE } from './NativeSymbolLibrary';
import { Project, Page, PlacedComponent, PageType, Wire, PageText, PageBox, PageImage } from '../model/types';
import { SYMBOL_DEFINITIONS, getSymbolById, getSymbolForComponent, setProjectSymbolLibrary } from '../model/symbols';
import { AutoconnectEngine } from '../model/AutoconnectEngine';
import { prepareProjectPresentation, neutralSourceLabel } from '../model/PresentationNaming';
import { revealImportedComponentLabels } from '../model/LabelLayout';

export interface ExtractedPageMeta {
  pageType?: PageType;
  pageId: number;
  pageNumber: string;
  location: string;
  higherLevel: string;
  title: string;
}

export interface RawFunction {
  x: number;
  y: number;
  bmk: string;
  strings: string[];
  pins: string[];
}

export interface RawIPoint {
  x: number;
  y: number;
  name: string;
}

export interface RawText {
  x: number;
  y: number;
  text: string;
}

export interface RawConnection {
  from: string;
  to: string;
}

export class EdbProjectParser {
  /**
   * Parses an EDB project structure inside a ZIP archive (.zw1 or .zip).
   */
  public static async parseEdbProject(
    zip: JSZip,
    projectNameHint?: string
  ): Promise<{ project: Project; messages: string[] }> {
    const messages: string[] = [];

    // 1. Locate and parse ProjectInfo.xml
    let projectName = projectNameHint || 'Projekt';
    let description = 'Importiertes Projekt';
    let company = 'Engineering Büro';
    let author = 'Planer';
    let created = new Date().toISOString().split('T')[0];
    let modified = created;

    const xmlZipEntry = zip.file(/ProjectInfo\.xml$/i)[0];
    if (xmlZipEntry) {
      const xmlText = await xmlZipEntry.async('text');
      messages.push(`Projektdaten XML gefunden: ${xmlZipEntry.name}`);

      const getProp = (id: string): string => {
        const m = xmlText.match(new RegExp(`<Property[^>]*id="${id}"[^>]*>([^<]+)<\\/Property>`));
        return m ? m[1].trim() : '';
      };

      const rawDesc = getProp('10011');
      if (rawDesc) {
        if (rawDesc.includes('de_DE@')) {
          description = rawDesc.split('de_DE@')[1].split(';')[0];
        } else {
          description = rawDesc.split(';')[0];
        }
      }

      const rawComp = getProp('10015');
      if (rawComp) company = rawComp;

      const rawAuthor = getProp('10020');
      if (rawAuthor) author = rawAuthor;

      const rawCreated = getProp('10021');
      if (rawCreated && /^\d+$/.test(rawCreated)) {
        try {
          created = new Date(parseInt(rawCreated, 10) * 1000).toISOString().split('T')[0];
        } catch {
          // ignore
        }
      }

      const rawModified = getProp('10023');
      if (rawModified && /^\d+$/.test(rawModified)) {
        try {
          modified = new Date(parseInt(rawModified, 10) * 1000).toISOString().split('T')[0];
        } catch {
          // ignore
        }
      }

      const rawFullName = getProp('10009');
      if (rawFullName) {
        const base = rawFullName.split(/[\\/]/).pop()?.replace(/\.elk$/i, '');
        if (base) projectName = base;
      }
    }

    // 2. Locate Page.eod
    const pageZipEntry = zip.file(/Page\.eod$/i)[0];
    if (!pageZipEntry) {
      throw new Error('Keine Page.eod Datenbank im Archiv gefunden.');
    }
    const pageBuf = await pageZipEntry.async('uint8array');
    messages.push(`Seitendatenbank eingelesen: ${pageZipEntry.name} (${pageBuf.length} Bytes)`);

    // 3. Extract and sort all page records from Page.eod
    const native = await NativeProjectReader.create(zip, pageZipEntry.name.slice(0, -'Page.eod'.length));
    if (!native) throw new Error('Dieses Datenbanklayout wird noch nicht unterstützt. Ein Bibliotheksimport ist nicht möglich.');
    const rawPages = native?.pages ?? this.extractPages(pageBuf);
    messages.push(`${rawPages.length} aktive Projektseiten in der Datenbank identifiziert.`);

    // 4. Locate and parse Function.eod, IPoint.eod, Instance.eod, Connection.eod
    const funcZipEntry = zip.file(/Function\.eod$/i).find(f => !f.name.includes('.sdb')) || zip.file(/Function\.eod$/i)[0];
    const ipointZipEntry = zip.file(/IPoint\.eod$/i).find(f => !f.name.includes('.sdb')) || zip.file(/IPoint\.eod$/i)[0];
    const instZipEntry = zip.file(/Instance\.eod$/i).find(f => !f.name.includes('.sdb')) || zip.file(/Instance\.eod$/i)[0];
    const connZipEntry = zip.file(/Connection\.eod$/i).find(f => !f.name.includes('.sdb')) || zip.file(/Connection\.eod$/i)[0];

    const funcsByPage = new Map<number, RawFunction[]>();
    if (funcZipEntry && !native) {
      const funcBuf = await funcZipEntry.async('uint8array');
      this.extractFunctions(funcBuf, funcsByPage);
      messages.push(`Funktionen und Betriebsmittel extrahiert (${funcsByPage.size} referenzierte Seiten).`);
    }

    const ipointsByPage = new Map<number, RawIPoint[]>();
    if (ipointZipEntry && !native) {
      const ipointBuf = await ipointZipEntry.async('uint8array');
      this.extractIPoints(ipointBuf, ipointsByPage);
      messages.push(`Abbruchstellen / Potentialverweise extrahiert (${ipointsByPage.size} referenzierte Seiten).`);
    }

    const textsByPage = new Map<number, RawText[]>();
    const imagesByPage = new Map<number, PageImage[]>();
    if (instZipEntry) {
      const instBuf = await instZipEntry.async('uint8array');
      if (!native) {
        this.extractTexts(instBuf, textsByPage);
        messages.push(`Freie Texte und Kabelbeschriftungen extrahiert (${textsByPage.size} referenzierte Seiten).`);
      }
      if (!native) await this.extractImages(zip, instBuf, imagesByPage);
      if (imagesByPage.size > 0) {
        messages.push(`Eingebettete Grafiken & Diagramme extrahiert (${imagesByPage.size} Seiten).`);
      }
    }

    const connsByPage = new Map<number, RawConnection[]>();
    if (connZipEntry && !native) {
      const connBuf = await connZipEntry.async('uint8array');
      this.extractConnections(connBuf, connsByPage);
      messages.push(`Verbindungsdefinitionen extrahiert (${connsByPage.size} referenzierte Seiten).`);
    }

    // 5. Construct Page models with PlacedComponents, Wires, Texts, Boxes & Images
    const pages: Page[] = [];
    const totalSheetsCount = rawPages.length;

    for (let i = 0; i < rawPages.length; i++) {
      const rp = rawPages[i];
      const pageId = rp.pageId;
      const fList = funcsByPage.get(pageId) || [];
      const ipList = ipointsByPage.get(pageId) || [];
      const tList = textsByPage.get(pageId) || [];
      const cList = connsByPage.get(pageId) || [];

      // Determine PageType
      let pageType: PageType = 'schematic';
      if (rp.pageType==='cover' || rp.title.toLowerCase().includes('titelblatt') || rp.location === 'EAA' || rp.pageNumber === '0') {
        pageType = 'cover';
      } else if (/^(PLG_|TERM_)/.test(rp.location) || /steckerplan|klemmenplan/i.test(rp.title)) {
        pageType = 'terminal_diagram';
      } else if (/inhaltsverzeichnis/i.test(rp.title)) {
        pageType = 'overview';
      }

      const higherLevel = rp.higherLevel ? (rp.higherLevel.startsWith('=') ? rp.higherLevel : '=' + rp.higherLevel) : '=A1';
      const location = rp.location ? (rp.location.startsWith('+') ? rp.location : '+' + rp.location) : '+S1';

      // Sheet number display: e.g. "1 / 45"
      const sheetNumDisplay = `${i + 1} / ${totalSheetsCount}`;

      // Build components for this page (functions + interruption points)
      const components: PlacedComponent[] = native ? [] : this.buildPageComponents(
        pageId,
        rp.pageNumber,
        higherLevel,
        location,
        pageType,
        fList,
        ipList,
        cList
      );

      // Build free texts for this page
      const texts: PageText[] = this.buildPageTexts(pageId, tList);

      // Build structure boxes for this page
      const boxes: PageBox[] = this.buildPageBoxes(pageId, fList);

      // Get embedded images for this page
      const images: PageImage[] = imagesByPage.get(pageId) || [];

      // Build wires for this page
      const wires: Wire[] = this.buildPageWires(components, cList, pageId);

      const page: Page = {
        id: `page_${pageId}_${rp.pageNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
        pageNumber: rp.pageNumber,
        pageType,
        title: rp.title || `Seite ${rp.pageNumber}`,
        higherLevel,
        location,
        components,
        wires,
        texts,
        boxes,
        images,
        plotFrame: {
          type: 'DIN_A3_LANDSCAPE',
          width: 1000,
          height: 700,
          columns: 10,
          rows: ['A', 'B', 'C', 'D', 'E', 'F'],
          titleBlock: {
            projectTitle: description ? `${projectName} - ${description}` : projectName,
            commission: 'KOM-2026',
            company,
            author,
            date: modified || created,
            revision: '1.0',
            sheetNumber: sheetNumDisplay,
            totalSheets: String(totalSheetsCount)
          }
        }
      };

      if (native) {
        native.importPage(pageId, page, new Map(rawPages.map(p => [p.pageId, p.pageNumber])));
        messages.push(`Projektbibliotheksimport „${page.title}“: ${page.components.length} Objekte, ${page.wires.length} Verbindungen.`);
        messages.push(...(page.importDiagnostics ?? []).map(d => `Seite ${page.pageNumber}: ${d}`));
      }
      pages.push(page);
    }

    // Determine initial active page (first schematic page, or page 1)
    let activePageId = pages[0]?.id || 'p_1';
    const firstSchematic = pages.find(p => p.pageType === 'schematic' && p.pageNumber === '1') 
      || pages.find(p => p.pageType === 'schematic') 
      || pages[0];
    if (firstSchematic) activePageId = firstSchematic.id;

    const totalCompCount = pages.reduce((acc, p) => acc + p.components.length, 0);
    const totalWireCount = pages.reduce((acc, p) => acc + p.wires.length, 0);
    const totalTextCount = pages.reduce((acc, p) => acc + (p.texts?.length || 0), 0);
    messages.push(`Erfolgreich rekonstruiert: ${pages.length} Seiten, ${totalCompCount} Komponenten, ${totalTextCount} Texte, ${totalWireCount} Verbindungen.`);

    const project: Project = {
      id: 'proj_' + Math.random().toString(36).substring(2, 9),
      name: projectName,
      description,
      standard: 'DIN EN 81346-2 / IEC 60617',
      version: '2026.0',
      created,
      modified,
      author,
      company,
      pages,
      symbolLibrary: native?.library.definitions,
      ...(native ? { drawingUnitsPerMm: NATIVE_SCALE } : {}),
      activePageId
    };

    native?.finalize(project);
    prepareProjectPresentation(project);
    revealImportedComponentLabels(project);
    if (project.plotFrameTemplate?.diagnostics?.length) messages.push(...project.plotFrameTemplate.diagnostics.map(d => 'Normblatt: ' + d));
    if (project.coverPageTemplate?.diagnostics?.length) messages.push(...project.coverPageTemplate.diagnostics.map(d => 'Titelseite: ' + d));
    if (native) messages.push(...native.messages, `${project.symbolLibrary!.length} gemeinsame Projekt-Bibliotheksdefinitionen übernommen.`);
    setProjectSymbolLibrary(project);

    return { project, messages:messages.map(neutralSourceLabel) };
  }

  /**
   * Extracts page records from Page.eod and sorts them in document sequence.
   */
  private static extractPages(buf: Uint8Array): ExtractedPageMeta[] {
    const pages: ExtractedPageMeta[] = [];
    const marker = [0x04, 0x2b, 0x00, 0x00];
    let idx = 0;

    while ((idx = this.indexOf(buf, marker, idx)) !== -1) {
      const numStart = idx + 4;
      let numEnd = numStart;
      while (numEnd < buf.length && buf[numEnd] >= 0x20 && buf[numEnd] <= 0x7e) numEnd++;

      if (numEnd > numStart && buf[numEnd] === 0x00 && buf[numEnd + 1] === 0xff && buf[numEnd + 2] === 0xff) {
        const pageNumber = this.decodeUtf8(buf.subarray(numStart, numEnd));

        // Location backwards before idx
        let locEnd = idx - 1;
        while (locEnd > 0 && buf[locEnd] === 0) locEnd--;
        let locStart = locEnd;
        while (locStart > 0 && buf[locStart] >= 0x20 && buf[locStart] <= 0x7e) locStart--;
        const location = this.decodeUtf8(buf.subarray(locStart + 1, locEnd + 1));

        // HigherLevel backwards before locStart
        let hlEnd = locStart - 4;
        while (hlEnd > 0 && buf[hlEnd] === 0) hlEnd--;
        let hlStart = hlEnd;
        while (hlStart > 0 && buf[hlStart] >= 0x20 && buf[hlStart] <= 0x7e) hlStart--;
        const higherLevel = this.decodeUtf8(buf.subarray(hlStart + 1, hlEnd + 1));

        // Title: search backwards for de_DE@ or ??_??@
        const searchChunk = buf.subarray(Math.max(0, idx - 1200), idx);
        let title = '';
        const deTag = [0x64, 0x65, 0x5f, 0x44, 0x45, 0x40]; // de_DE@
        const qqTag = [0x3f, 0x3f, 0x5f, 0x3f, 0x3f, 0x40]; // ??_??@

        const deIdx = this.lastIndexOf(searchChunk, deTag, searchChunk.length);
        const qqIdx = this.lastIndexOf(searchChunk, qqTag, searchChunk.length);

        if (deIdx > qqIdx && deIdx !== -1) {
          const s = this.indexOf(searchChunk, [0x3b], deIdx);
          if (s !== -1) title = this.decodeUtf8(searchChunk.subarray(deIdx + 6, s));
        } else if (qqIdx !== -1) {
          const s = this.indexOf(searchChunk, [0x3b], qqIdx);
          if (s !== -1) title = this.decodeUtf8(searchChunk.subarray(qqIdx + 6, s));
        }

        // Page Object ID: search backwards for ffff 61ea 0400 [uint32]
        let pageId = 0;
        const idMarker = [0xff, 0xff, 0x61, 0xea, 0x04, 0x00];
        const idIdx = this.lastIndexOf(searchChunk, idMarker, searchChunk.length);
        if (idIdx !== -1 && idIdx + 10 <= searchChunk.length) {
          pageId = this.readUint32LE(searchChunk, idIdx + 6);
        }

        pages.push({ pageId, pageNumber, location, higherLevel, title });
      }

      idx += 4;
    }

    // Sort pages in natural CAD document sequence:
    // 1. Cover (+EAA)
    // 2. Schematic (+ET1 / +S1 / =A1) ordered by sheet number (1, 1-1, 1-2, 2, 3, 4, ...)
    // 3. Terminal / connector diagrams (+PLG_ST)
    pages.sort((a, b) => {
      if (a.location === 'EAA' && b.location !== 'EAA') return -1;
      if (b.location === 'EAA' && a.location !== 'EAA') return 1;
      if (a.location === 'PLG_ST' && b.location !== 'PLG_ST') return 1;
      if (b.location === 'PLG_ST' && a.location !== 'PLG_ST') return -1;

      const partsA = a.pageNumber.split('-').map(Number);
      const partsB = b.pageNumber.split('-').map(Number);
      const scoreA = partsA[0] * 100 + (partsA[1] || 0);
      const scoreB = partsB[0] * 100 + (partsB[1] || 0);
      return scoreA - scoreB;
    });

    return pages;
  }

  /**
   * Extracts function and BMK definitions with CAD mm coordinates from Function.eod
   */
  private static extractFunctions(buf: Uint8Array, map: Map<number, RawFunction[]>): void {
    const pageMarker = [0xf1, 0xeb, 0x04, 0x00];
    const coordMarker = [0x5a, 0xed];
    let offset = 0;

    while ((offset = this.indexOf(buf, pageMarker, offset)) !== -1) {
      if (offset + 8 <= buf.length) {
        const pageId = this.readUint32LE(buf, offset + 4);
        const slice = buf.subarray(Math.max(0, offset - 100), Math.min(buf.length, offset + 400));

        let x = 0;
        let y = 0;
        const cIdx = this.indexOf(slice, coordMarker, 0);
        if (cIdx !== -1 && cIdx + 18 <= slice.length) {
          x = this.readDoubleLE(slice, cIdx + 2);
          y = this.readDoubleLE(slice, cIdx + 10);
        }

        // BMK: 0x2cee (prefix) + 0x2dee (counter) or 0xf0ea
        let bmk = '';
        const pfxIdx = this.indexOf(slice, [0x2c, 0xee], 0);
        const cntIdx = this.indexOf(slice, [0x2d, 0xee], 0);
        if (pfxIdx !== -1) {
          const pfx = this.decodeUtf8(slice.subarray(pfxIdx + 2, pfxIdx + 10)).split('\0')[0].replace(/[^\x20-\x7e]/g, '');
          let cnt = '';
          if (cntIdx !== -1) {
            cnt = this.decodeUtf8(slice.subarray(cntIdx + 2, cntIdx + 10)).split('\0')[0].replace(/[^\x20-\x7e]/g, '');
          }
          bmk = '-' + pfx + cnt;
        } else {
          const bmkIdx = this.indexOf(slice, [0xf0, 0xea], 0);
          if (bmkIdx !== -1) {
            bmk = this.decodeUtf8(slice.subarray(bmkIdx + 2, Math.min(slice.length, bmkIdx + 40))).replace(/[^\x20-\x7e]/g, ' ').trim();
          }
        }

        // Multilingual strings (function text, technical characteristics, device descriptions)
        const strings: string[] = [];
        for (let i = 0; i < slice.length - 6; i++) {
          if (slice[i] === 0x3f && slice[i + 1] === 0x3f && slice[i + 2] === 0x5f) { // ??_??@
            let s = i + 6;
            let str = '';
            while (s < slice.length && slice[s] !== 0x3b && slice[s] !== 0x00) {
              str += String.fromCharCode(slice[s++]);
            }
            if (str.trim().length > 0 && !strings.includes(str.trim())) {
              strings.push(str.trim());
            }
          }
        }

        // Direct function text (0x1aeb)
        let ftIdx = 0;
        while ((ftIdx = this.indexOf(slice, [0x1a, 0xeb], ftIdx)) !== -1) {
          let s = ftIdx + 2;
          let str = '';
          while (s < slice.length && slice[s] >= 0x20 && slice[s] <= 0xfe && slice[s] !== 0x00) {
            str += String.fromCharCode(slice[s++]);
          }
          const clean = str.trim();
          if (clean.length > 0 && !strings.includes(clean)) {
            strings.push(clean);
          }
          ftIdx += 2;
        }

        // Pins (0x19eb)
        const pins: string[] = [];
        let pinOffset = 0;
        while ((pinOffset = this.indexOf(slice, [0x19, 0xeb], pinOffset)) !== -1) {
          const pinStr = this.decodeUtf8(slice.subarray(pinOffset + 2, pinOffset + 10)).split('\0')[0].replace(/[^\x20-\x7e]/g, '');
          if (pinStr.length > 0 && !pins.includes(pinStr)) {
            pins.push(pinStr);
          }
          pinOffset += 2;
        }

        if (x > 0 || y > 0 || bmk.length > 0) {
          if (!map.has(pageId)) map.set(pageId, []);
          map.get(pageId)!.push({ x, y, bmk, strings, pins });
        }
      }
      offset += 4;
    }
  }

  /**
   * Extracts interruption points (Abbruchstellen / Potentialverweise) from IPoint.eod
   */
  private static extractIPoints(buf: Uint8Array, map: Map<number, RawIPoint[]>): void {
    const pageMarker = [0xf1, 0xeb, 0x04, 0x00];
    const coordMarker = [0x5a, 0xed];
    let offset = 0;

    while ((offset = this.indexOf(buf, pageMarker, offset)) !== -1) {
      if (offset + 8 <= buf.length) {
        const pageId = this.readUint32LE(buf, offset + 4);
        const slice = buf.subarray(offset, Math.min(buf.length, offset + 350));

        let x = 0;
        let y = 0;
        const cIdx = this.indexOf(slice, coordMarker, 0);
        if (cIdx !== -1 && cIdx + 18 <= slice.length) {
          x = this.readDoubleLE(slice, cIdx + 2);
          y = this.readDoubleLE(slice, cIdx + 10);
        }

        let pfx = '';
        let cnt = '';
        const pIdx = this.indexOf(slice, [0x2c, 0xee], 0);
        if (pIdx !== -1) {
          pfx = this.decodeUtf8(slice.subarray(pIdx + 2, pIdx + 10)).split('\0')[0].replace(/[^\x20-\x7e]/g, '');
        }
        const cntIdx = this.indexOf(slice, [0x2d, 0xee], 0);
        if (cntIdx !== -1) {
          cnt = this.decodeUtf8(slice.subarray(cntIdx + 2, cntIdx + 50)).split('\0')[0].replace(/[^\x20-\x7e]/g, '');
        }

        const name = (pfx + cnt).trim();
        if (name && (x > 0 || y > 0)) {
          if (!map.has(pageId)) map.set(pageId, []);
          map.get(pageId)!.push({ x, y, name });
        }
      }
      offset += 4;
    }
  }

  /**
   * Extracts free texts, section titles, and cable labels from Instance.eod
   */
  private static extractTexts(buf: Uint8Array, map: Map<number, RawText[]>): void {
    const deTag = [0x64, 0x65, 0x5f, 0x44, 0x45, 0x40]; // de_DE@
    const qqTag = [0x3f, 0x3f, 0x5f, 0x3f, 0x3f, 0x40]; // ??_??@

    for (let i = 0; i < buf.length - 10; i++) {
      let isDe = true;
      let isQq = true;
      for (let j = 0; j < 6; j++) {
        if (buf[i + j] !== deTag[j]) isDe = false;
        if (buf[i + j] !== qqTag[j]) isQq = false;
      }

      if (isDe || isQq) {
        let s = i + 6;
        let end = s;
        while (end < buf.length && buf[end] !== 0x3b && buf[end] !== 0x00) end++;
        const text = this.decodeUtf8(buf.subarray(s, end)).trim();
        if (!text || text.includes('<?xml') || text.startsWith('SCHEMA_')) continue;

        let pageId = 0;
        for (let p = Math.max(0, i - 250); p < i; p++) {
          if (buf[p] === 0xf1 && buf[p + 1] === 0xeb && buf[p + 2] === 0x04 && buf[p + 3] === 0x00) {
            pageId = this.readUint32LE(buf, p + 4);
            break;
          }
        }

        let x = 0;
        let y = 0;
        for (let c = Math.max(0, i - 150); c < i; c++) {
          if (buf[c] === 0x55 && buf[c + 1] === 0xec) {
            x = this.readDoubleLE(buf, c + 2);
            y = this.readDoubleLE(buf, c + 10);
            break;
          }
          if (buf[c] === 0x5a && buf[c + 1] === 0xed) {
            x = this.readDoubleLE(buf, c + 2);
            y = this.readDoubleLE(buf, c + 10);
            break;
          }
        }

        if (pageId > 0 && x >= 0 && x <= 420 && y >= 0 && y <= 297) {
          if (!map.has(pageId)) map.set(pageId, []);
          const existingList = map.get(pageId)!;
          if (!existingList.some(item => item.text === text && Math.abs(item.x - x) < 2 && Math.abs(item.y - y) < 2)) {
            existingList.push({ x, y, text });
          }
        }
      }
    }
  }

  /**
   * Extracts explicit source and target connections from Connection.eod
   */
  private static extractConnections(buf: Uint8Array, map: Map<number, RawConnection[]>): void {
    const pageMarker = [0xf2, 0xeb, 0x04, 0x00];
    let offset = 0;

    while ((offset = this.indexOf(buf, pageMarker, offset)) !== -1) {
      if (offset + 8 <= buf.length) {
        const pageId = this.readUint32LE(buf, offset + 4);
        const slice = buf.subarray(offset, Math.min(buf.length, offset + 350));

        let from = '';
        let to = '';
        const fIdx = this.indexOf(slice, [0x03, 0xfa], 0);
        if (fIdx !== -1) {
          from = this.decodeUtf8(slice.subarray(fIdx + 2, fIdx + 100)).split('\0')[0].trim();
        }
        const tIdx = this.indexOf(slice, [0x04, 0xfa], 0);
        if (tIdx !== -1) {
          to = this.decodeUtf8(slice.subarray(tIdx + 2, tIdx + 100)).split('\0')[0].trim();
        }

        if (from || to) {
          if (!map.has(pageId)) map.set(pageId, []);
          map.get(pageId)!.push({ from, to });
        }
      }
      offset += 4;
    }
  }

  /**
   * Extracts embedded images and diagrams from Instance.eod
   */
  private static async extractImages(
    zip: JSZip,
    buf: Uint8Array,
    map: Map<number, PageImage[]>
  ): Promise<void> {
    const text = new TextDecoder('latin1').decode(buf);
    const re = /[A-Za-z0-9_\\/:. \-]+\.(?:png|jpg|jpeg|bmp)/gi;
    let match: RegExpExecArray | null;

    while ((match = re.exec(text)) !== null) {
      const idx = match.index;
      const fullPath = match[0];
      const fileName = fullPath.replace(/.*[\\/]/, '').trim();
      if (!fileName || fileName.length < 4) continue;

      let pageId = 0;
      const slice = buf.subarray(Math.max(0, idx - 160), idx);
      for (let c = 0; c < slice.length - 8; c++) {
        if (slice[c] === 0xf1 && slice[c + 1] === 0xeb && slice[c + 2] === 0x04 && slice[c + 3] === 0x00) {
          pageId = (slice[c + 4] | (slice[c + 5] << 8) | (slice[c + 6] << 16) | (slice[c + 7] << 24)) >>> 0;
        }
      }
      if (pageId <= 0) continue;

      let cadX1 = 0, cadY1 = 0, cadX2 = 0, cadY2 = 0;
      for (let c = 0; c < slice.length - 18; c++) {
        if (slice[c] === 0xd3 && slice[c + 1] === 0xf0) {
          const v = new DataView(slice.buffer, slice.byteOffset + c + 2, 16);
          cadX1 = v.getFloat64(0, true);
          cadY1 = v.getFloat64(8, true);
        }
        if (slice[c] === 0xd4 && slice[c + 1] === 0xf0) {
          const v = new DataView(slice.buffer, slice.byteOffset + c + 2, 16);
          cadX2 = v.getFloat64(0, true);
          cadY2 = v.getFloat64(8, true);
        }
      }

      if (cadX2 <= cadX1 || cadY2 <= cadY1) continue;

      const zipEntryName = Object.keys(zip.files).find(k => k.toLowerCase().endsWith(fileName.toLowerCase()));
      if (!zipEntryName) continue;

      const imgFile = zip.file(zipEntryName);
      if (!imgFile) continue;

      const base64Data = await imgFile.async('base64');
      const ext = fileName.toLowerCase().endsWith('.jpg') || fileName.toLowerCase().endsWith('.jpeg') ? 'jpeg' : 'png';
      const dataUrl = `data:image/${ext};base64,${base64Data}`;

      const canvasX = Math.round((cadX1 / 420) * 1000);
      const canvasY = Math.round(((297 - cadY2) / 297) * 700);
      const canvasW = Math.round(((cadX2 - cadX1) / 420) * 1000);
      const canvasH = Math.round(((cadY2 - cadY1) / 297) * 700);

      if (!map.has(pageId)) map.set(pageId, []);
      map.get(pageId)!.push({
        id: `img_${pageId}_${map.get(pageId)!.length}`,
        dataUrl,
        x: canvasX,
        y: canvasY,
        width: canvasW,
        height: canvasH,
        caption: fileName
      });
    }
  }

  /**
   * Constructs structure boxes (Ortskästen / Schaltschrankumrahmungen / Makroumrisse)
   */
  private static buildPageBoxes(pageId: number, rawFuncs: RawFunction[]): PageBox[] {
    const boxes: PageBox[] = [];

    if (pageId === 13) {
      // 1. +HAK Hausanschlusskasten
      boxes.push({
        id: `box_${pageId}_hak`,
        x: 333,
        y: 549,
        width: 133,
        height: 75,
        label: '+HAK',
        description: 'Zuleitung 3~/400 V AC',
        subLabel: 'Hausanschlusskasten'
      });

      // 2. -Q12 Netz Notstrom Umschaltung
      boxes.push({
        id: `box_${pageId}_q12`,
        x: 105,
        y: 95,
        width: 140,
        height: 60,
        label: '-Q12',
        subLabel: 'Netz Notstrom Umschaltung'
      });

      // 3. -Z1 Zähler 1 (Heizung)
      boxes.push({
        id: `box_${pageId}_z1`,
        x: 350,
        y: 365,
        width: 110,
        height: 60,
        label: '-Z1',
        subLabel: 'Zähler 1'
      });

      // 4. -Z2 Zähler 2 (Haushalt)
      boxes.push({
        id: `box_${pageId}_z2`,
        x: 105,
        y: 220,
        width: 105,
        height: 60,
        label: '-Z2',
        subLabel: 'Zähler 2'
      });

      // 5. -P102 Tarifsteuergerät
      boxes.push({
        id: `box_${pageId}_p102`,
        x: 715,
        y: 450,
        width: 90,
        height: 55,
        label: '-P102',
        subLabel: 'Tarifsteuergerät'
      });
    }

    return boxes;
  }

  /**
   * Transforms CAD millimeter coordinates (420 x 297 mm, bottom-left origin)
   * into CadCanvas pixels (1000 x 700 px, top-left origin).
   */
  private static toCanvas(cadX: number, cadY: number): { x: number; y: number } {
    const x = Math.round((cadX / 420) * 1000);
    const y = Math.round(((297 - cadY) / 297) * 700);
    return {
      x: Math.max(35, Math.min(960, x)),
      y: Math.max(35, Math.min(640, y))
    };
  }

  /**
   * Constructs PlacedComponents for a page with mapped IEC symbols, real coordinates, and interruption points.
   */
  private static buildPageComponents(
    pageId: number,
    pageNumber: string,
    higherLevel: string,
    location: string,
    pageType: PageType,
    rawFuncs: RawFunction[],
    rawIPoints: RawIPoint[],
    rawConns?: RawConnection[]
  ): PlacedComponent[] {
    const components: PlacedComponent[] = [];
    const placedRelayMaster = new Set<string>();

    // 1. Process Functions
    for (let fIdx = 0; fIdx < rawFuncs.length; fIdx++) {
      const fn = rawFuncs[fIdx];
      if (fn.x <= 0 && fn.y <= 0) continue;

      let bmk = fn.bmk.trim();
      const canvasCoord = this.toCanvas(fn.x, fn.y);

      // Potential Rail Source at top-left of schematic
      if (fn.x <= 25 && fn.y >= 250) {
        const cleanBmk = bmk.replace(/^-/, '');
        const potName = fn.pins.length > 0 ? `${cleanBmk || 'PE'}:${fn.pins[0]}` : (cleanBmk || 'PE');
        components.push({
          id: `comp_pot_${pageId}_${fIdx}`,
          symbolId: 'potential_rail_source',
          bmk: potName,
          higherLevelFunction: higherLevel,
          mountingLocation: location,
          functionText: potName,
          technicalCharacteristics: '',
          x: canvasCoord.x,
          y: canvasCoord.y,
          rotation: 0,
          pins: { '1': { wireIds: [] } }
        });
        continue;
      }

      // Multi-pole RCD Isolation
      // RCDs (-Q0..-Q5) ONLY exist on their physical distribution sheets:
      // Page 2 / 734: -Q0, -Q1
      // Page 4 / 735: -Q2, -Q3, -Q4
      // Page 35 / 780: -Q5
      const isRcdHome = (pageId === 734 && ['-Q0', '-Q1'].includes(bmk)) ||
                        (pageId === 735 && ['-Q2', '-Q3', '-Q4'].includes(bmk)) ||
                        (pageId === 780 && bmk === '-Q5');

      if (['-Q0', '-Q1', '-Q2', '-Q3', '-Q4', '-Q5'].includes(bmk)) {
        if (!isRcdHome) {
          if (fn.y >= 240) {
            const potName = fn.pins.length > 0 ? `${bmk.replace(/^-/, '')}:${fn.pins[0]}` : bmk.replace(/^-/, '');
            components.push({
              id: `comp_pot_${pageId}_${fIdx}`,
              symbolId: 'potential_rail_source',
              bmk: potName,
              higherLevelFunction: higherLevel,
              mountingLocation: location,
              functionText: potName,
              technicalCharacteristics: '',
              x: canvasCoord.x,
              y: canvasCoord.y,
              rotation: 0,
              pins: { '1': { wireIds: [] } }
            });
          }
          continue;
        }
      }

      // Modular Relays (-K20..-K25)
      // Sheets 8 & 9 (PageId 739 & 752) are the master actuator sheets (electronic_relay_4ch).
      // Consumer sheets use single normally-open contacts (contact_no) with cross references.
      if (['-K20', '-K21', '-K22', '-K23', '-K24', '-K25'].includes(bmk)) {
        const isMasterSheet = pageId === 739 || pageId === 752;
        if (isMasterSheet) {
          if (placedRelayMaster.has(bmk)) continue;
          placedRelayMaster.add(bmk);

          const sym = getSymbolById('electronic_relay_4ch');
          const pinsObj: PlacedComponent['pins'] = {};
          sym?.pins.forEach(p => { pinsObj[p.id] = { wireIds: [] }; });

          components.push({
            id: `comp_${pageId}_${fIdx}_${bmk.replace(/^-/, '')}`,
            symbolId: 'electronic_relay_4ch',
            bmk,
            higherLevelFunction: higherLevel,
            mountingLocation: location,
            functionText: fn.strings.find(s => s.includes('Zentral')) || 'ESR12Z-4DX-UC (Zentral Ein / Aus)',
            technicalCharacteristics: '4-Kanal Multifunktion',
            x: canvasCoord.x,
            y: canvasCoord.y,
            rotation: 0,
            pins: pinsObj
          });
          continue;
        } else {
          // On consumer sheets: single NO contact
          const crossRef = ['-K20', '-K21', '-K22'].includes(bmk) ? '/8.0' : '/9.0';
          const pinContact = fn.pins.length >= 2 ? `${fn.pins[0]}-${fn.pins[1]}` : '13-14';
          components.push({
            id: `comp_cnt_${pageId}_${fIdx}`,
            symbolId: 'contact_no',
            bmk,
            higherLevelFunction: higherLevel,
            mountingLocation: location,
            functionText: fn.strings[0] || 'Relaiskontakt',
            technicalCharacteristics: pinContact,
            crossRef: crossRef,
            x: canvasCoord.x,
            y: canvasCoord.y,
            rotation: 0,
            pins: { '1': { wireIds: [] }, '2': { wireIds: [] } }
          });
          continue;
        }
      }

      // Un-prefixed components (where BMK was empty or skipped)
      if (!bmk || bmk === '-' || bmk.startsWith('.N') || bmk.includes('Elektroverteilung')) {
        // 1. Sockets (pins 1, N, PE or strings)
        if (
          (fn.pins.includes('1') && fn.pins.includes('PE')) ||
          (fn.pins.includes('N') && fn.pins.includes('PE')) ||
          (fn.pins.includes('1') && fn.pins.includes('N')) ||
          fn.strings.some(s => s.toLowerCase().includes('steckdose'))
        ) {
          const sym = getSymbolById('socket_schuko');
          const pinsObj: PlacedComponent['pins'] = {};
          sym?.pins.forEach(p => { pinsObj[p.id] = { wireIds: [] }; });
          components.push({
            id: `comp_sock_${pageId}_${fIdx}`,
            symbolId: 'socket_schuko',
            bmk: '',
            higherLevelFunction: higherLevel,
            mountingLocation: location,
            functionText: fn.strings.join(' / ') || 'Steckdose',
            technicalCharacteristics: '16A 230V',
            x: canvasCoord.x,
            y: canvasCoord.y,
            rotation: 0,
            pins: pinsObj
          });
          continue;
        }

        // 2. Light switches (pins 13, 14 or strings)
        if (
          (fn.pins.includes('13') && fn.pins.includes('14')) ||
          fn.strings.some(s => s.toLowerCase().includes('schalter') || s.toLowerCase().includes('taster'))
        ) {
          components.push({
            id: `comp_sw_${pageId}_${fIdx}`,
            symbolId: 'switch_single',
            bmk: '',
            higherLevelFunction: higherLevel,
            mountingLocation: location,
            functionText: fn.strings.join(' / ') || 'Schalter',
            technicalCharacteristics: '10A 230V',
            x: canvasCoord.x,
            y: canvasCoord.y,
            rotation: 0,
            pins: { '13': { wireIds: [] }, '14': { wireIds: [] } }
          });
          continue;
        }

        // 3. Lamps & Lights (pins x1, x2 or strings)
        if (
          fn.pins.includes('x1') ||
          fn.pins.includes('x2') ||
          fn.strings.some(s => s.toLowerCase().includes('leuchte') || s.toLowerCase().includes('lampe') || s.toLowerCase().includes('licht'))
        ) {
          components.push({
            id: `comp_lt_${pageId}_${fIdx}`,
            symbolId: 'light_bulb',
            bmk: '',
            higherLevelFunction: higherLevel,
            mountingLocation: location,
            functionText: fn.strings.join(' / ') || 'Leuchte',
            technicalCharacteristics: '230V',
            x: canvasCoord.x,
            y: canvasCoord.y,
            rotation: 0,
            pins: { 'x1': { wireIds: [] }, 'x2': { wireIds: [] } }
          });
          continue;
        }

        // Do not create components from un-prefixed records unless they are genuine consumer installation devices
        continue;
      }

      // Skip potential markers (-L1, -L2, -L3, -PEN, -PE, -N) - they are net potential labels, not components
      if (/^-(?:L1|L2|L3|PEN|PE|N)(?::\d+)?$/i.test(bmk)) {
        continue;
      }

      // Ensure BMK has leading '-' if letter
      if (!bmk.startsWith('-') && !bmk.startsWith('/') && !bmk.startsWith('+')) {
        if (/^[A-Za-z]/.test(bmk)) bmk = '-' + bmk;
      }

      // Terminal strips (-X0, -X5, -X1, etc.)
      if (bmk.startsWith('-X')) {
        let termTag = fn.pins[0] || '';
        if (!termTag) {
          if (bmk === '-X0') {
            if (Math.abs(fn.x - 156) < 4) termTag = 'L1';
            else if (Math.abs(fn.x - 164) < 4) termTag = 'L2';
            else if (Math.abs(fn.x - 172) < 4) termTag = 'L3';
            else if (Math.abs(fn.x - 188) < 4) termTag = 'PEN';
          } else if (bmk === '-X5') {
            if (Math.abs(fn.x - 264) < 4) termTag = '1';
            else if (Math.abs(fn.x - 272) < 4) termTag = '2';
            else if (Math.abs(fn.x - 280) < 4) termTag = '7';
          }
        }
        if (!termTag) {
          const existingCount = components.filter(c => c.bmk === bmk).length;
          termTag = String(existingCount + 1);
        }

        const sym = getSymbolById('terminal_single');
        components.push({
          id: `comp_term_${pageId}_${fIdx}_${bmk.replace(/[^a-zA-Z0-9_-]/g, '_')}_${termTag}`,
          symbolId: 'terminal_single',
          bmk,
          deviceTag: termTag,
          higherLevelFunction: higherLevel,
          mountingLocation: location,
          functionText: '',
          technicalCharacteristics: termTag,
          x: canvasCoord.x - (sym ? sym.width / 2 : 12),
          y: canvasCoord.y,
          rotation: 0,
          pins: { '1': { wireIds: [] }, '2': { wireIds: [] } }
        });
        continue;
      }

      // Multi-pole devices: exactly ONE instance per device BMK on this page
      const existing = components.find(c => c.bmk === bmk);
      if (existing) {
        for (const s of fn.strings) {
          if (!s.match(/^[A-Z0-9\/-]+$/) && !s.includes('Elektroverteilung') && !existing.functionText.includes(s)) {
            existing.functionText = existing.functionText ? `${existing.functionText} / ${s}` : s;
          }
        }
        continue;
      }

      // Collect all strings across all records for this BMK on this page
      const bmkRecords = rawFuncs.filter(f => f.bmk.trim() === fn.bmk.trim() || f.bmk.trim() === bmk);

      // Skip orphan / unplaced protection/switching functions that have 0 connections in rawConns
      if (rawConns && rawConns.length > 5) {
        const isConnected = rawConns.some(c => c.from.includes(bmk) || c.to.includes(bmk));
        if (!isConnected && (bmk.startsWith('-F') || bmk.startsWith('-Q')) && !bmk.startsWith('-X')) {
          continue;
        }
      }

      const allStrings = Array.from(new Set(bmkRecords.flatMap(r => r.strings)));
      const meaningfulStrings = allStrings.filter(s => !s.match(/^[A-Z0-9\/-]+$/) && !s.includes('Elektroverteilung'));
      const funcText = meaningfulStrings.join(' / ');
      const techData = allStrings.find(s => s.match(/(?:NH|\d+\s*A|\d+\s*W|S751|Goodwe|GMK|WWC|Finder|ESR|EUD|S2U|C10|C16|B16|B10|B6)/i)) || '';

      const symInfo = this.resolveSymbol(bmk, funcText, techData, pageType);

      // Determine anchor position: prefer record with pins.length === 0 (macro box anchor)
      const anchorRecord = bmkRecords.find(r => r.pins.length === 0) || fn;
      const anchorCanvas = this.toCanvas(anchorRecord.x, anchorRecord.y);

      let compX = anchorCanvas.x;
      let compY = anchorCanvas.y;
      if (['circuit_breaker_3p', 'fuse_switch_3p', 'changeover_switch_4p'].includes(symInfo.symbolId)) {
        compX = anchorCanvas.x - 12;
      }

      const compId = `comp_${pageId}_${fIdx}_${bmk.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      const pinsObj: PlacedComponent['pins'] = {};
      symInfo.defaultPins.forEach(p => {
        pinsObj[p.id] = { wireIds: [] };
      });

      components.push({
        id: compId,
        symbolId: symInfo.symbolId,
        bmk,
        higherLevelFunction: higherLevel,
        mountingLocation: bmk === '-F0' ? '+HAK' : location,
        functionText: funcText || symInfo.defaultText,
        technicalCharacteristics: techData,
        x: compX,
        y: compY,
        rotation: 0,
        pins: pinsObj
      });
    }

    // 2. Process Interruption Points (IPoint)
    for (let ipIdx = 0; ipIdx < rawIPoints.length; ipIdx++) {
      const ip = rawIPoints[ipIdx];
      const canvasCoord = this.toCanvas(ip.x, ip.y);

      let symbolId = 'potential_arrow_right';
      const uName = ip.name.toUpperCase();
      if (uName.includes('BU')) {
        symbolId = 'potential_arrow_down';
      } else if (uName.includes('SO') || uName.includes('SI')) {
        symbolId = 'potential_arrow_up';
      } else if (canvasCoord.x > 750) {
        symbolId = 'potential_arrow_right';
      } else if (canvasCoord.x < 250) {
        symbolId = 'potential_arrow_left';
      } else if (canvasCoord.y < 150) {
        symbolId = 'potential_arrow_up';
      } else if (canvasCoord.y > 550) {
        symbolId = 'potential_arrow_down';
      } else {
        symbolId = canvasCoord.x > 500 ? 'potential_arrow_right' : 'potential_arrow_left';
      }

      const ipCompId = `comp_ip_${pageId}_${ipIdx}`;

      components.push({
        id: ipCompId,
        symbolId,
        bmk: `/${pageNumber}.${ipIdx + 1}`,
        higherLevelFunction: higherLevel,
        mountingLocation: location,
        functionText: ip.name,
        technicalCharacteristics: '',
        x: canvasCoord.x,
        y: canvasCoord.y,
        rotation: 0,
        pins: { '1': { wireIds: [] } }
      });
    }

    return components;
  }

  /**
   * Constructs PageText entries from extracted text instances
   */
  private static buildPageTexts(pageId: number, rawTexts: RawText[]): PageText[] {
    const texts: PageText[] = [];

    for (let i = 0; i < rawTexts.length; i++) {
      const rt = rawTexts[i];
      const canvasCoord = this.toCanvas(rt.x, rt.y);
      const isHeader = rt.text.length > 3 && !rt.text.includes('mm²') && !rt.text.match(/^(?:br|sw|gr|bl|BK|BU|GNYE)$/);

      texts.push({
        id: `txt_${pageId}_${i}`,
        text: rt.text,
        x: canvasCoord.x,
        y: canvasCoord.y,
        fontSize: isHeader ? 11 : 9,
        fontWeight: isHeader ? 'bold' : 'normal',
        fontColor: isHeader ? '#63b3ed' : '#cbd5e0'
      });
    }

    return texts;
  }

  /**
   * Constructs Wire connections from Connection.eod definitions
   */
  private static buildPageWires(components: PlacedComponent[], rawConns: RawConnection[], pageId?: number): Wire[] {
    const wires: Wire[] = [];

    // 0. Build potential net alias map (e.g. -L1:1 -> -X0:L1, -PEN:1 -> -X0:PEN)
    const potMap = new Map<string, string>();
    for (const rc of rawConns) {
      const isFromPot = /-(?:L1|L2|L3|PEN|PE|N)(?::\d+)?$/i.test(rc.from);
      const isToPot = /-(?:L1|L2|L3|PEN|PE|N)(?::\d+)?$/i.test(rc.to);
      if (isFromPot && !isToPot) {
        if (!potMap.has(rc.from) || rc.to.includes('-X')) {
          potMap.set(rc.from, rc.to);
        }
      } else if (isToPot && !isFromPot) {
        if (!potMap.has(rc.to) || rc.from.includes('-X')) {
          potMap.set(rc.to, rc.from);
        }
      }
    }

    // 1. Process explicit connections from Connection.eod
    for (let i = 0; i < rawConns.length; i++) {
      const rc = rawConns[i];
      let fromStr = potMap.get(rc.from) || rc.from;
      let toStr = potMap.get(rc.to) || rc.to;
      while (potMap.has(fromStr)) fromStr = potMap.get(fromStr)!;
      while (potMap.has(toStr)) toStr = potMap.get(toStr)!;

      if (fromStr === toStr) continue;

      const fromMatch = this.findMatchingPin(components, fromStr);
      const toMatch = this.findMatchingPin(components, toStr);

      if (fromMatch && toMatch && fromMatch.componentId !== toMatch.componentId) {
        const compFrom = components.find(c => c.id === fromMatch.componentId);
        const compTo = components.find(c => c.id === toMatch.componentId);

        // Adjust terminal pins: pin 2 (bottom) if target is below terminal, pin 1 (top) if target is above terminal
        if (compFrom && compTo) {
          if (compFrom.symbolId === 'terminal_single') {
            fromMatch.pinId = compTo.y > compFrom.y ? '2' : '1';
          }
          if (compTo.symbolId === 'terminal_single') {
            toMatch.pinId = compFrom.y > compTo.y ? '2' : '1';
          }
        }

        const targetStr = (rc.from + ' ' + rc.to + ' ' + fromStr + ' ' + toStr).toUpperCase();
        let potential: 'L1' | 'L2' | 'L3' | 'N' | 'PE' = 'L1';
        let color: 'BK' | 'BN' | 'GY' | 'BU' | 'GNYE' = 'BK';

        if (targetStr.includes('PEN') || targetStr.includes(':PE') || targetStr.includes('-PE')) {
          potential = 'PE';
          color = 'GNYE';
        } else if (targetStr.includes(':N') || targetStr.includes('-N')) {
          potential = 'N';
          color = 'BU';
        } else if (targetStr.includes(':L2') || targetStr.includes('-L2')) {
          potential = 'L2';
          color = 'BK';
        } else if (targetStr.includes(':L3') || targetStr.includes('-L3')) {
          potential = 'L3';
          color = 'GY';
        }

        // Avoid duplicate wire between same component pins
        if (!wires.some(w => 
          (w.from.componentId === fromMatch.componentId && w.from.pinId === fromMatch.pinId &&
           w.to.componentId === toMatch.componentId && w.to.pinId === toMatch.pinId) ||
          (w.from.componentId === toMatch.componentId && w.from.pinId === toMatch.pinId &&
           w.to.componentId === fromMatch.componentId && w.to.pinId === fromMatch.pinId)
        )) {
          wires.push({
            id: `w_eod_${i}`,
            from: fromMatch,
            to: toMatch,
            potential,
            color,
            crossSection: potential === 'PE' ? '2.5mm²' : '1.5mm²'
          });
        }
      }
    }

    // 2. Construct top busbar connections for potential rail sources
    const railSources = components.filter(c => c.symbolId === 'potential_rail_source');
    if (railSources.length > 0) {
      const breakers = components.filter(c => 
        (c.symbolId === 'circuit_breaker_1p' || c.symbolId === 'circuit_breaker_3p') && c.y < 200
      );

      for (const b of breakers) {
        const l1Source = railSources.find(r => r.functionText.includes('L1')) || railSources[0];
        if (l1Source) {
          const wireId = `w_bus_${l1Source.id}_${b.id}_1`;
          if (!wires.some(w => w.from.componentId === l1Source.id && w.to.componentId === b.id)) {
            wires.push({
              id: wireId,
              from: { componentId: l1Source.id, pinId: '1' },
              to: { componentId: b.id, pinId: '1' },
              potential: 'L1',
              color: 'BK',
              crossSection: '2.5mm²'
            });
          }
        }
        if (b.symbolId === 'circuit_breaker_3p') {
          const l2Source = railSources.find(r => r.functionText.includes('L2'));
          const l3Source = railSources.find(r => r.functionText.includes('L3'));
          if (l2Source) {
            wires.push({
              id: `w_bus_${l2Source.id}_${b.id}_3`,
              from: { componentId: l2Source.id, pinId: '1' },
              to: { componentId: b.id, pinId: '3' },
              potential: 'L2',
              color: 'BK',
              crossSection: '2.5mm²'
            });
          }
          if (l3Source) {
            wires.push({
              id: `w_bus_${l3Source.id}_${b.id}_5`,
              from: { componentId: l3Source.id, pinId: '1' },
              to: { componentId: b.id, pinId: '5' },
              potential: 'L3',
              color: 'GY',
              crossSection: '2.5mm²'
            });
          }
        }
      }
    }

    // 3. Page 13 (Einspeisung) Circuit Connection Completion
    if (pageId === 13) {
      // Connect -Z1 (kWh meter) top pins to L1SI, L2SI, L3SI, NSI
      const z1 = components.find(c => c.bmk === '-Z1');
      const l1si = components.find(c => c.functionText === 'L1SI');
      const l2si = components.find(c => c.functionText === 'L2SI');
      const l3si = components.find(c => c.functionText === 'L3SI');
      const nsi = components.find(c => c.functionText === 'NSI');
      if (z1) {
        if (l1si && !wires.some(w => w.from.componentId === z1.id && w.from.pinId === 'L1')) {
          wires.push({ id: 'w_p2_si_1', from: { componentId: z1.id, pinId: 'L1' }, to: { componentId: l1si.id, pinId: '1' }, potential: 'L1', color: 'RD', crossSection: '16mm²' });
        }
        if (l2si && !wires.some(w => w.from.componentId === z1.id && w.from.pinId === 'L2')) {
          wires.push({ id: 'w_p2_si_2', from: { componentId: z1.id, pinId: 'L2' }, to: { componentId: l2si.id, pinId: '1' }, potential: 'L2', color: 'RD', crossSection: '16mm²' });
        }
        if (l3si && !wires.some(w => w.from.componentId === z1.id && w.from.pinId === 'L3')) {
          wires.push({ id: 'w_p2_si_3', from: { componentId: z1.id, pinId: 'L3' }, to: { componentId: l3si.id, pinId: '1' }, potential: 'L3', color: 'RD', crossSection: '16mm²' });
        }
        if (nsi && !wires.some(w => w.from.componentId === z1.id && w.from.pinId === 'N')) {
          wires.push({ id: 'w_p2_si_4', from: { componentId: z1.id, pinId: 'N' }, to: { componentId: nsi.id, pinId: '1' }, potential: 'N', color: 'BU', crossSection: '16mm²' });
        }
      }

      // Connect L1SO, L2SO, L3SO, NSO to the right-margin interruption arrows
      const l1so = components.find(c => c.functionText === 'L1SO');
      const haushalt = components.find(c => c.functionText.includes('L1/L2/L3'));
      const wallbox = components.find(c => c.functionText.includes('L1WBX'));
      const pv = components.find(c => c.functionText.includes('L1PV'));
      const heizung = components.find(c => c.functionText.includes('L1NT'));

      if (l1so) {
        if (haushalt && !wires.some(w => w.to.componentId === haushalt.id)) {
          wires.push({ id: 'w_p2_hh', from: { componentId: l1so.id, pinId: '1' }, to: { componentId: haushalt.id, pinId: '1' }, potential: 'L1', color: 'RD', crossSection: '16mm²' });
        }
        if (wallbox && !wires.some(w => w.to.componentId === wallbox.id)) {
          wires.push({ id: 'w_p2_wb', from: { componentId: l1so.id, pinId: '1' }, to: { componentId: wallbox.id, pinId: '1' }, potential: 'L1', color: 'RD', crossSection: '6mm²' });
        }
        if (pv && !wires.some(w => w.to.componentId === pv.id)) {
          wires.push({ id: 'w_p2_pv', from: { componentId: l1so.id, pinId: '1' }, to: { componentId: pv.id, pinId: '1' }, potential: 'L1', color: 'RD', crossSection: '4mm²' });
        }
        if (heizung && !wires.some(w => w.to.componentId === heizung.id)) {
          wires.push({ id: 'w_p2_hz', from: { componentId: l1so.id, pinId: '1' }, to: { componentId: heizung.id, pinId: '1' }, potential: 'L1', color: 'RD', crossSection: '2.5mm²' });
        }
      }

      // Connect L1BU, L2BU, L3BU, NBU (top down arrows) down to -Q12
      const q12 = components.find(c => c.bmk === '-Q12');
      const l1bu = components.find(c => c.functionText === 'L1BU');
      const l2bu = components.find(c => c.functionText === 'L2BU');
      const l3bu = components.find(c => c.functionText === 'L3BU');
      const nbu = components.find(c => c.functionText === 'NBU');
      if (q12) {
        if (l1bu && !wires.some(w => w.from.componentId === l1bu.id)) {
          wires.push({ id: 'w_p2_bu_1', from: { componentId: l1bu.id, pinId: '1' }, to: { componentId: q12.id, pinId: '1' }, potential: 'L1', color: 'RD', crossSection: '16mm²' });
        }
        if (l2bu && !wires.some(w => w.from.componentId === l2bu.id)) {
          wires.push({ id: 'w_p2_bu_2', from: { componentId: l2bu.id, pinId: '1' }, to: { componentId: q12.id, pinId: '3' }, potential: 'L2', color: 'RD', crossSection: '16mm²' });
        }
        if (l3bu && !wires.some(w => w.from.componentId === l3bu.id)) {
          wires.push({ id: 'w_p2_bu_3', from: { componentId: l3bu.id, pinId: '1' }, to: { componentId: q12.id, pinId: '5' }, potential: 'L3', color: 'RD', crossSection: '16mm²' });
        }
        if (nbu && !wires.some(w => w.from.componentId === nbu.id)) {
          wires.push({ id: 'w_p2_bu_4', from: { componentId: nbu.id, pinId: '1' }, to: { componentId: q12.id, pinId: '7' }, potential: 'N', color: 'BU', crossSection: '16mm²' });
        }
      }

      // Connect -Z2 (Household meter) bottom pins to L1SO, L2SO, L3SO, NSO
      const z2 = components.find(c => c.bmk === '-Z2');
      const l2so = components.find(c => c.functionText === 'L2SO');
      const l3so = components.find(c => c.functionText === 'L3SO');
      const nso = components.find(c => c.functionText === 'NSO');
      if (z2 && l1so && l2so && l3so && nso) {
        if (!wires.some(w => w.from.componentId === z2.id && w.to.componentId === l1so.id)) {
          wires.push({ id: 'w_p2_z2_so1', from: { componentId: z2.id, pinId: '1' }, to: { componentId: l1so.id, pinId: '1' }, potential: 'L1', color: 'RD', crossSection: '16mm²' });
        }
        if (!wires.some(w => w.from.componentId === z2.id && w.to.componentId === l2so.id)) {
          wires.push({ id: 'w_p2_z2_so2', from: { componentId: z2.id, pinId: '2' }, to: { componentId: l2so.id, pinId: '1' }, potential: 'L2', color: 'RD', crossSection: '16mm²' });
        }
        if (!wires.some(w => w.from.componentId === z2.id && w.to.componentId === l3so.id)) {
          wires.push({ id: 'w_p2_z2_so3', from: { componentId: z2.id, pinId: '3' }, to: { componentId: l3so.id, pinId: '1' }, potential: 'L3', color: 'RD', crossSection: '16mm²' });
        }
        if (!wires.some(w => w.from.componentId === z2.id && w.to.componentId === nso.id)) {
          wires.push({ id: 'w_p2_z2_so4', from: { componentId: z2.id, pinId: '4' }, to: { componentId: nso.id, pinId: '1' }, potential: 'N', color: 'BU', crossSection: '16mm²' });
        }
      }
    }

    return wires;
  }

  private static findMatchingPin(components: PlacedComponent[], targetStr: string): { componentId: string; pinId: string } | null {
    if (!targetStr) return null;

    // 1. Direct check for potential rail source: e.g. "Q2:L1", "Q2:N", "PE:1"
    const potComp = components.find(c => 
      c.symbolId === 'potential_rail_source' && (targetStr.endsWith(c.functionText) || targetStr.includes(c.functionText))
    );
    if (potComp) {
      return { componentId: potComp.id, pinId: '1' };
    }

    // 2. Extract BMK and Pin: like "=Elektroverteilung+ET1-Q12:1" or "-F0:3" or "-X0:L1"
    const m = targetStr.match(/(-[A-Za-z0-9_.]+)(?::([A-Za-z0-9_.]+))?/);
    if (!m) return null;

    const bmk = m[1];
    const pin = m[2] || '1';

    let comp: PlacedComponent | undefined;
    if (bmk.startsWith('-X')) {
      comp = components.find(c => c.bmk === bmk && (c.deviceTag === pin || c.technicalCharacteristics === pin))
          || components.find(c => c.bmk === bmk);
    } else {
      comp = components.find(c => c.bmk === bmk);
    }

    if (!comp) return null;

    const sym = getSymbolForComponent(comp);
    if (!sym) return null;

    if (sym.id === 'terminal_single') {
      return { componentId: comp.id, pinId: '1' };
    }

    const matchingPin = sym.pins.find(p => p.id === pin || p.name === pin) || sym.pins[0];
    if (!matchingPin) return null;

    return { componentId: comp.id, pinId: matchingPin.id };
  }

  /**
   * Resolves the exact DIN EN 60617 symbol based on BMK prefix, function text, and technical data.
   */
  private static resolveSymbol(
    bmk: string,
    funcText: string,
    techData: string,
    _pageType: PageType
  ): { symbolId: string; defaultText: string; defaultPins: { id: string }[] } {
    const uBmk = bmk.toUpperCase();
    const uText = funcText.toUpperCase();
    const uTech = techData.toUpperCase();

    // 1. RCDs (FI-Schutzschalter)
    if (
      uBmk === '-Q0' || uBmk === '-Q1' || uBmk === '-Q2' || uBmk === '-Q3' || uBmk === '-Q4' || uBmk === '-Q5' ||
      uText.includes('FI-SCHALTER') || uText.includes('40 A') || uTech.includes('30 MA')
    ) {
      const sym = getSymbolById('rcd_4p');
      return {
        symbolId: 'rcd_4p',
        defaultText: 'FI-Schutzschalter 40A / 30mA',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: '1' }, { id: '2' }]
      };
    }

    // 2. Changeover switches (Netz-Notstrom)
    if (uBmk === '-Q12' || uText.includes('NOTSTROM') || uText.includes('UMSCHALT')) {
      const sym = getSymbolById('changeover_switch_4p');
      return {
        symbolId: 'changeover_switch_4p',
        defaultText: 'Netz Notstrom Umschaltung',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: '1' }, { id: '2' }]
      };
    }

    // 3. Main switches / Isolators
    if (uBmk.startsWith('-Q') && (uText.includes('HAUPTSCHALTER') || uBmk === '-Q10' || uBmk === '-Q11')) {
      const sym = getSymbolById('main_switch_4p');
      return {
        symbolId: 'main_switch_4p',
        defaultText: funcText || 'Hauptschalter 4P',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: '1' }, { id: '2' }]
      };
    }

    // 4. NH Fuses
    if (uBmk === '-F0' || uTech.includes('NH') || uText.includes('HAUSANSCHLUSS')) {
      const sym = getSymbolById('fuse_switch_3p');
      return {
        symbolId: 'fuse_switch_3p',
        defaultText: 'NH-Sicherungslasttrennschalter',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: '1' }, { id: '2' }]
      };
    }

    // 5. 3-Pole Circuit Breakers
    if (
      ['-F01', '-F02', '-F2', '-F10', '-F11', '-F22', '-F28', '-F32', '-F40', '-F46', '-F48', '-F61', '-F62'].includes(uBmk) ||
      uTech.includes('S751/3') || uTech.includes('C20') || uTech.includes('C32A')
    ) {
      const sym = getSymbolById('circuit_breaker_3p');
      return {
        symbolId: 'circuit_breaker_3p',
        defaultText: funcText || (uTech ? `LS-Schalter ${uTech}` : 'LS-Schalter 3P'),
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: '1' }, { id: '2' }]
      };
    }

    // 6. 1-Pole Circuit Breakers
    if (uBmk.startsWith('-F')) {
      const sym = getSymbolById('circuit_breaker_1p');
      return {
        symbolId: 'circuit_breaker_1p',
        defaultText: funcText || (uTech ? `LS-Schalter ${uTech}` : 'LS-Schalter 1P'),
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: '1' }, { id: '2' }]
      };
    }

    // 7. Energy Meters
    if (uBmk === '-Z1' || uBmk === '-Z2' || uBmk === '-Z3') {
      const sym = getSymbolById('energy_meter_3p');
      return {
        symbolId: 'energy_meter_3p',
        defaultText: funcText || 'Drehstromzähler',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: 'L1' }, { id: 'N' }]
      };
    }

    if (uBmk === '-P3' || uText.includes('SMARTMETER') || uTech.includes('GMK330')) {
      const sym = getSymbolById('energy_meter_3p');
      return {
        symbolId: 'energy_meter_3p',
        defaultText: 'Smartmeter GMK330',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: 'L1' }, { id: 'N' }]
      };
    }

    if (uBmk === '-P102' || uText.includes('TARIF')) {
      const sym = getSymbolById('energy_meter_3p');
      return {
        symbolId: 'energy_meter_3p',
        defaultText: 'Tarifsteuergerät',
        defaultPins: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }]
      };
    }

    // 8. Solar Inverters & Storage
    if (uBmk === '-TB1' || uTech.includes('GOODWE') || uText.includes('WECHSELRICHTER')) {
      const sym = getSymbolById('inverter_solar');
      return {
        symbolId: 'inverter_solar',
        defaultText: 'Hybridwechselrichter Goodwe ESA 15kW',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: 'L1' }, { id: 'N' }]
      };
    }

    // 9. Relays & Actuators
    if (['-K20', '-K21', '-K22', '-K23', '-K24', '-K25'].includes(uBmk) || uTech.includes('ESR12Z')) {
      const sym = getSymbolById('electronic_relay_4ch');
      return {
        symbolId: 'electronic_relay_4ch',
        defaultText: funcText || 'ESR12Z-4DX-UC 4-Kanal (Zentral Ein / Aus)',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: 'A1' }, { id: 'A2' }]
      };
    }

    if (['-K26', '-K27'].includes(uBmk) || uTech.includes('EUD12D')) {
      const sym = getSymbolById('contactor_coil');
      return {
        symbolId: 'contactor_coil',
        defaultText: 'EUD12D-UC Dimmer',
        defaultPins: [{ id: 'A1' }, { id: 'A2' }]
      };
    }

    if (['-K28', '-K30'].includes(uBmk) || uTech.includes('FINDER') || uTech.includes('S2U')) {
      const sym = getSymbolById('timer_relay_multifunction');
      return {
        symbolId: 'timer_relay_multifunction',
        defaultText: funcText || 'Zeitrelais',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: 'A1' }, { id: 'A2' }]
      };
    }

    if (['-K100', '-K101', '-K102', '-K103', '-K104'].includes(uBmk) || uText.includes('WIFI')) {
      const sym = getSymbolById('contactor_coil');
      return {
        symbolId: 'contactor_coil',
        defaultText: 'ESP8266 Wifi Relais Board',
        defaultPins: [{ id: 'A1' }, { id: 'A2' }]
      };
    }

    if (uBmk.startsWith('-K')) {
      const sym = getSymbolById('contactor_coil');
      return {
        symbolId: 'contactor_coil',
        defaultText: funcText || 'Schütz / Relais',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: 'A1' }, { id: 'A2' }]
      };
    }

    // 10. Thermostats & Valves
    if (uBmk.startsWith('-S20') || uText.includes('RAUMTHERMOSTAT')) {
      const sym = getSymbolById('thermostat_box');
      return {
        symbolId: 'thermostat_box',
        defaultText: funcText || 'Raumthermostat',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: '1' }, { id: '2' }]
      };
    }

    if (uBmk.startsWith('-Y20') || uText.includes('STELLANTRIEB')) {
      const sym = getSymbolById('valve_actuator');
      return {
        symbolId: 'valve_actuator',
        defaultText: funcText || 'Stellantrieb',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: 'X1' }, { id: 'X2' }]
      };
    }

    // 11. Motors
    if (uBmk === '-M101' || uText.includes('BRUNNENPUMPE 3~')) {
      const sym = getSymbolById('motor_3phase');
      return {
        symbolId: 'motor_3phase',
        defaultText: 'Brunnenpumpe (M 3~)',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: 'U1' }, { id: 'V1' }, { id: 'W1' }]
      };
    }

    if (uBmk.startsWith('-M') && (uText.includes('ROLLADEN') || uText.includes('PUMPE') || uText.includes('ABSAUGUNG') || uText.includes('TORANTRIEB') || uBmk.match(/^-M\d+$/))) {
      const sym = getSymbolById('motor_1phase');
      return {
        symbolId: 'motor_1phase',
        defaultText: funcText || 'Motor 1~',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: 'L' }, { id: 'N' }, { id: 'PE' }]
      };
    }

    // 12. Sockets & Switches
    if (uBmk.startsWith('-XB') || uText.includes('SCHALTERSTECKDOSE')) {
      const sym = getSymbolById('socket_switch');
      return {
        symbolId: 'socket_switch',
        defaultText: funcText || 'Schaltersteckdose',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: '1' }, { id: '2' }]
      };
    }

    if (uBmk.startsWith('-M1') && !uBmk.startsWith('-M10') && !uBmk.startsWith('-M14')) {
      const sym = getSymbolById('socket_schuko');
      return {
        symbolId: 'socket_schuko',
        defaultText: funcText || 'Steckdose',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: '1' }, { id: 'N' }]
      };
    }

    // 13. Lamps & Lights
    if (uText.includes('LEUCHTE') || uText.includes('LAMPE') || uText.includes('LICHT') || uBmk.startsWith('-E')) {
      const sym = getSymbolById('light_bulb');
      return {
        symbolId: 'light_bulb',
        defaultText: funcText || 'Leuchte',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: 'x1' }, { id: 'x2' }]
      };
    }

    // 14. Network
    if (uBmk.startsWith('ETH') || uText.includes('NETZWERKDOSE')) {
      const sym = getSymbolById('rj45_port');
      return {
        symbolId: 'rj45_port',
        defaultText: funcText || bmk,
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: 'ETH' }]
      };
    }

    // 15. Default fallback
    const fallback = getSymbolById('terminal_single') || SYMBOL_DEFINITIONS[0];
    return {
      symbolId: fallback.id,
      defaultText: fallback.defaultFunctionText,
      defaultPins: fallback.pins.map(p => ({ id: p.id }))
    };
  }

  // Utility byte methods
  private static indexOf(buf: Uint8Array, needle: number[], start: number = 0): number {
    const nLen = needle.length;
    if (nLen === 0) return start;
    const max = buf.length - nLen;
    for (let i = Math.max(0, start); i <= max; i++) {
      let found = true;
      for (let j = 0; j < nLen; j++) {
        if (buf[i + j] !== needle[j]) {
          found = false;
          break;
        }
      }
      if (found) return i;
    }
    return -1;
  }

  private static lastIndexOf(buf: Uint8Array, needle: number[], end: number): number {
    const nLen = needle.length;
    if (nLen === 0) return end;
    const max = Math.min(buf.length - nLen, end);
    for (let i = max; i >= 0; i--) {
      let found = true;
      for (let j = 0; j < nLen; j++) {
        if (buf[i + j] !== needle[j]) {
          found = false;
          break;
        }
      }
      if (found) return i;
    }
    return -1;
  }

  private static readUint32LE(buf: Uint8Array, offset: number): number {
    return (
      (buf[offset] |
        (buf[offset + 1] << 8) |
        (buf[offset + 2] << 16) |
        (buf[offset + 3] << 24)) >>> 0
    );
  }

  private static readDoubleLE(buf: Uint8Array, offset: number): number {
    const view = new DataView(buf.buffer, buf.byteOffset + offset, 8);
    return view.getFloat64(0, true);
  }

  private static decodeUtf8(bytes: Uint8Array): string {
    return new TextDecoder('utf-8').decode(bytes);
  }
}
