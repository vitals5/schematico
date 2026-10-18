import { Page, PlacedComponent, Project } from './types';
import { getSymbolForComponent } from './symbols';
import { componentInsertionPoint } from './SymbolGeometry';
import { escapeSvg } from './ImportedDrawing';
import { CrossReferenceEngine } from './CrossReferenceEngine';

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
    const sameStructure = (p: Page) => structure(p.higherLevel) === structure(source.higherLevelFunction ?? sourcePage.higherLevel)
      && structure(p.location) === structure(source.mountingLocation ?? sourcePage.location);
    const page = pages.find(sameStructure) ?? pages.find(p => p.pageType === 'schematic') ?? pages[0];
    if (!page || col >= page.plotFrame.columns || col < 0) continue;
    const sourceSymbol = getSymbolForComponent(source, project);
    const candidates = page.components.filter(c => c.id !== source.id && (
      source.bmk.trim() ? c.bmk.trim() === source.bmk.trim()
        && structure(c.higherLevelFunction ?? page.higherLevel) === structure(source.higherLevelFunction ?? sourcePage.higherLevel)
        && structure(c.mountingLocation ?? page.location) === structure(source.mountingLocation ?? sourcePage.location)
        : source.functionText && c.functionText === source.functionText));
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

/** Keep labels intact while giving every reference its own keyboard/click target. */
export function referenceMarkup(project: Project, source: PlacedComponent, svg = false): string {
  const text = source.crossRef ?? '', targets = referenceTargets(project, source);
  let cursor = 0, result = '';
  targets.forEach((target, index) => {
    result += escapeSvg(text.slice(cursor, target.start));
    const attrs = `class="crossref-link" data-crossref-source="${escapeSvg(source.id)}" data-crossref-index="${index}"`;
    result += svg ? `<tspan ${attrs} role="link" tabindex="0" aria-label="Zu ${escapeSvg(target.label)} springen">${escapeSvg(target.label)}</tspan>`
      : `<button type="button" ${attrs} title="Zur Zielstelle springen">${escapeSvg(target.label)}</button>`;
    cursor = target.end;
  });
  return result + escapeSvg(text.slice(cursor));
}
