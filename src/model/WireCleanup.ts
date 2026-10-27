import type { Page, Project } from './types';
import { getDrawingUnitsPerMm } from './symbols';
import { snapshotPage } from '../layout/geometry';
import { routeSelected } from '../layout/router';
export interface WireCleanupResult {
  changed: string[];
  failed: string[];
}
/** Only bends change. Devices, pin identities, nets and automatic connections stay intact. */
export function cleanupConnections(page: Page, project: Project, wireIds?: readonly string[]): WireCleanupResult {
  if (page.pageType !== 'schematic' || page.floorPlan)
    return { changed: [], failed: [] };
  const wanted = new Set(wireIds ?? page.wires.filter(w => !w.isAutoconnect).map(w => w.id));
  const wires = page.wires.filter(w => wanted.has(w.id) && !w.isAutoconnect);
  if (!wires.length)
    return { changed: [], failed: [] };
  const snapshot = snapshotPage(page, project);
  const ids = new Set(wires.map(w => w.id));
  const unit = getDrawingUnitsPerMm(project);
  const failed = routeSelected(snapshot, ids, Math.max(2, snapshot.grid.spacing));
  for (const w of wires)
    if (!snapshot.edges.some(e => e.id === w.id))
      failed.push(w.id);
  const changed: string[] = [];
  for (const w of wires) {
    if (failed.includes(w.id))
      continue;
    const edge = snapshot.edges.find(e => e.id === w.id)!;
    const next = edge.points.slice(1, -1).map(p => ({ x: p.x * unit, y: p.y * unit }));
    if (JSON.stringify(w.waypoints ?? []) !== JSON.stringify(next) || w.routingMode === 'manual') {
      w.waypoints = next;
      w.routingMode = 'auto';
      changed.push(w.id);
    }
  }
  return { changed, failed };
}
