import { Page, PlacedComponent, Project } from './types';
import { getSymbolForComponent } from './symbols';
import { componentInsertionPoint } from './SymbolGeometry';
import { escapeSvg } from './ImportedDrawing';
import { CrossReferenceEngine } from './CrossReferenceEngine';
import { isInterruptionSymbol } from './ConnectionSymbols';

export type ReferenceTarget = { label: string; start: number; end: number; pageId: string;
  componentId?: string; x: number; y: number };
const structure = (text: string) => text.replace(/^[=+]+/, '');

/** Resolve each printed reference independently, including split page numbers. */
export function referenceTargets(project: Project, source: PlacedComponent): ReferenceTarget[] {
  const sourcePage = project.pages.find(p => p.components.some(c => c.id === source.id));
  if (!sourcePage) return [];
  const result: ReferenceTarget[] = [];
  for (const match of (source.crossRef ?? '').matchAll(/\/([^\s,|/:]+)\.(\d+)/g)) {
    const number = match[1], col = Number(match[2]);
    const pages = project.pages.filter(p => p.pageNumber === number);
    const sourceSymbol = getSymbolForComponent(source, project);
    const isSourceInterruption = sourceSymbol && isInterruptionSymbol(sourceSymbol);
    const sourceTag = isSourceInterruption
      ? (source.bmk.trim() && !source.bmk.startsWith('PF') && source.bmk !== '/' ? source.bmk.trim() : (source.functionText?.trim() || source.bmk.trim()))
      : source.bmk.trim();

    const matchesCandidate = (c: PlacedComponent) => {
      if (c.id === source.id) return false;
      const targetSymbol = getSymbolForComponent(c, project);
      if (isSourceInterruption && targetSymbol && isInterruptionSymbol(targetSymbol)) {
        const targetTag = (c.bmk.trim() && !c.bmk.startsWith('PF') && c.bmk !== '/' ? c.bmk.trim() : (c.functionText?.trim() || c.bmk.trim()));
        return targetTag === sourceTag;
      }
      return sourceTag
        ? c.bmk.trim() === source.bmk.trim()
          && structure(c.higherLevelFunction ?? sourcePage.higherLevel) === structure(source.higherLevelFunction ?? sourcePage.higherLevel)
        : !!(source.functionText && c.functionText === source.functionText);
    };

    const sameStructure = (p: Page) => structure(p.higherLevel) === structure(source.higherLevelFunction ?? sourcePage.higherLevel)
      && structure(p.location) === structure(source.mountingLocation ?? sourcePage.location);
    const page = pages.find(p => sameStructure(p) && p.components.some(matchesCandidate))
      ?? pages.find(p => p.components.some(matchesCandidate))
      ?? pages.find(sameStructure)
      ?? pages.find(p => p.pageType === 'schematic')
      ?? pages[0];
    if (!page || col >= page.plotFrame.columns || col < 0) continue;
    const candidates = page.components.filter(c => {
      if (c.id === source.id) return false;
      const targetSymbol = getSymbolForComponent(c, project);
      if (isSourceInterruption && targetSymbol && isInterruptionSymbol(targetSymbol)) {
        const targetTag = (c.bmk.trim() && !c.bmk.startsWith('PF') && c.bmk !== '/' ? c.bmk.trim() : (c.functionText?.trim() || c.bmk.trim()));
        return targetTag === sourceTag;
      }
      return sourceTag
        ? c.bmk.trim() === source.bmk.trim()
          && structure(c.higherLevelFunction ?? page.higherLevel) === structure(source.higherLevelFunction ?? sourcePage.higherLevel)
          && structure(c.mountingLocation ?? page.location) === structure(source.mountingLocation ?? sourcePage.location)
        : source.functionText && c.functionText === source.functionText;
    });
    const designation = (source.crossRef ?? '').slice(0, match.index).split(/[|,]/).at(-1)?.match(/([\w-]+):\s*$/)?.[1];
    const score = (c: PlacedComponent) => {
      const targetSymbol = getSymbolForComponent(c, project);
      const type = sourceSymbol?.isContact && targetSymbol?.isMaster || sourceSymbol?.isMaster && targetSymbol?.isContact ? 0 : 1;
      const pins = targetSymbol?.pins.map(p => c.pins[p.id]?.customLabel ?? p.name).join('-');
      const designationMatch = designation && sourceSymbol?.isMaster && designation !== pins ? 1 : 0;
      return Math.abs(CrossReferenceEngine.componentPath(c, page, project) - col) * 100 + type * 10 + designationMatch * 2
        + (c.source?.objectType === source.source?.objectType ? 0 : 1);
    };
    candidates.sort((a, b) => score(a) - score(b));
    const component = candidates[0];
    const symbol = component && getSymbolForComponent(component, project);
    const point = component && symbol ? componentInsertionPoint(component, symbol)
      : { x: (col + .5) * page.plotFrame.width / page.plotFrame.columns, y: page.plotFrame.height / 2 };
    result.push({ label: match[0], start: match.index!, end: match.index! + match[0].length,
      pageId: page.id, componentId: component?.id, ...point });
  }
  return result;
}

export function splitCrossReferenceLines(crossRef?: string): string[] {
  if (!crossRef) return [];
  return crossRef.split(/\s*(?:\||,|\r?\n)\s*/).map(line => line.trim()).filter(Boolean);
}

/** Keep labels intact while giving every reference its own keyboard/click target. */
export function referenceMarkup(
  project: Project,
  source: PlacedComponent,
  svg = false,
  layout?: { x: number; fontSize: number }
): string {
  const text = source.crossRef ?? '', targets = referenceTargets(project, source);
  const segments: { start: number; end: number }[] = [];
  let segStart = 0;
  for (const sep of text.matchAll(/\s*(?:\||,|\r?\n)\s*/g)) {
    const end = sep.index!;
    if (text.slice(segStart, end).trim()) segments.push({ start: segStart, end });
    segStart = end + sep[0].length;
  }
  if (text.slice(segStart).trim()) segments.push({ start: segStart, end: text.length });

  const renderRange = (rangeStart: number, rangeEnd: number) => {
    let cursor = rangeStart, out = '';
    targets.forEach((target, index) => {
      if (target.start < rangeStart || target.end > rangeEnd) return;
      out += escapeSvg(text.slice(cursor, target.start));
      const attrs = `class="crossref-link" data-crossref-source="${escapeSvg(source.id)}" data-crossref-index="${index}"`;
      out += svg ? `<tspan ${attrs} role="link" tabindex="0" aria-label="Zu ${escapeSvg(target.label)} springen">${escapeSvg(target.label)}</tspan>`
        : `<button type="button" ${attrs} title="Zur Zielstelle springen">${escapeSvg(target.label)}</button>`;
      cursor = target.end;
    });
    return out + escapeSvg(text.slice(cursor, rangeEnd));
  };

  if (segments.length <= 1) {
    return renderRange(0, text.length);
  }

  const lines = segments.map(s => renderRange(s.start, s.end));
  if (!svg) return lines.join('<br>');
  const x = layout?.x ?? 0;
  const lineStep = layout ? Number((layout.fontSize * 1.25).toFixed(3)) : '1.25em';
  return lines.map((line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lineStep}">${line}</tspan>`).join('');
}
