import { Page, PlacedComponent, SymbolDefinition } from './types';
import { positionAtInsertionPoint, rotatedLocalPoint, symbolInsertionPoint } from './SymbolGeometry';

export type GridResolution = 'full' | 'half' | 'fine' | 'off';
export function gridForPage(page: Page, fallbackSpacing = 8): NonNullable<Page['grid']> {
  const grid = page.grid;
  return grid && Number.isFinite(grid.spacing) && grid.spacing > 0
    && Number.isFinite(grid.origin.x) && Number.isFinite(grid.origin.y)
    ? grid : { spacing: fallbackSpacing, origin: { x: 0, y: 0 } };
}

export function gridStep(spacing: number, resolution: GridResolution, modifier = false): number {
  if (resolution === 'off') return 0;
  return spacing / (modifier ? resolution === 'full' ? 2 : 4 : resolution === 'half' ? 2 : resolution === 'fine' ? 4 : 1);
}

export function snapCoordinate(value: number, step: number, origin = 0): number {
  return step > 0 ? origin + Math.round((value - origin) / step) * step : value;
}

export function snapSymbolPosition(position: { x: number; y: number }, symbol: SymbolDefinition,
  rotation: PlacedComponent['rotation'], grid: NonNullable<Page['grid']>, step: number): { x: number; y: number } {
  const offset = rotatedLocalPoint(symbolInsertionPoint(symbol), symbol, rotation);
  return positionAtInsertionPoint({ x: snapCoordinate(position.x + offset.x, step, grid.origin.x),
    y: snapCoordinate(position.y + offset.y, step, grid.origin.y) }, symbol, rotation);
}
