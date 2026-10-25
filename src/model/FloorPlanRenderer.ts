// src/model/FloorPlanRenderer.ts
// SVG rendering and wall-snapping calculation for architectural floor plans and curved installation wiring

import { FloorPlanData, WallSegment, WallOpening, RoomDefinition, InstallationArcWire, InstallationCircuit, PlacedComponent, Project, SymbolDefinition } from './types';
import { drawingToSvg, escapeSvg } from './ImportedDrawing';
import { getSymbolForComponent } from './symbols';
import { getLocalizedSymbol, getUiLanguage } from '../i18n';

export interface WallSnapResult {
  wall: WallSegment;
  snappedPoint: { x: number; y: number };
  wallCenterPoint: { x: number; y: number };
  distance: number;
  rotation: 0 | 90 | 180 | 270; // Rotation aligned outward from the wall
  angleRad: number;
}

/**
 * Calculates adaptive symbol scale based on floor plan scale ratio (1:X).
 */
export function getAutoSymbolScale(scaleRatio?: number): number {
  const ratio = scaleRatio ?? 100;
  if (ratio >= 150) return 0.35;
  if (ratio >= 100) return 0.45;
  if (ratio >= 75) return 0.55;
  if (ratio >= 50) return 0.65;
  return 0.85;
}

/**
 * Calculates nearest wall, outer surface point and perpendicular orientation for magnetic symbol snapping.
 */
export function findNearestWall(
  point: { x: number; y: number },
  walls: WallSegment[],
  maxDistance: number = 30,
  pixelPerMeter: number = 50,
  tierStep?: number
): WallSnapResult | null {
  let best: WallSnapResult | null = null;
  let minDistance = maxDistance;

  for (const wall of walls) {
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) continue;
    const len = Math.sqrt(lenSq);

    let t = ((point.x - wall.start.x) * dx + (point.y - wall.start.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = wall.start.x + t * dx;
    const projY = wall.start.y + t * dy;
    const vx = point.x - projX;
    const vy = point.y - projY;
    const dist = Math.hypot(vx, vy);

    if (dist < minDistance) {
      minDistance = dist;

      // Normal pointing towards the cursor side of the wall
      let nx = 0, ny = 0;
      if (dist > 1e-4) {
        nx = vx / dist;
        ny = vy / dist;
      } else {
        nx = -dy / len;
        ny = dx / len;
      }

      // Convert normal vector to discrete rotation (0, 90, 180, 270).
      // Standard installation symbols have back (wall attachment) at y=0,
      // and face into direction +Y (DOWN, 90 deg in screen coords).
      // When normal points DOWN (90° screen): rot = 0°
      // When normal points LEFT (180° screen): rot = 90°
      // When normal points UP (270° screen): rot = 180°
      // When normal points RIGHT (0° screen): rot = 270°
      const angleRad = Math.atan2(ny, nx);
      const angleDeg = ((angleRad * 180) / Math.PI + 360) % 360;
      const diff = ((angleDeg - 90) % 360 + 360) % 360;

      let rot: 0 | 90 | 180 | 270 = 0;
      if (diff >= 45 && diff < 135) rot = 90;
      else if (diff >= 135 && diff < 225) rot = 180;
      else if (diff >= 225 && diff < 315) rot = 270;
      else rot = 0;

      // Outer surface of wall on the side of the mouse cursor
      const wallThickness = wall.thickness ?? 0.24;
      const wallThickPx = wallThickness < 2 ? wallThickness * pixelPerMeter : wallThickness;
      const halfThick = wallThickPx / 2;

      let offset = halfThick;
      if (tierStep && tierStep > 4 && dist > halfThick + 4) {
        const tier = Math.round((dist - halfThick) / tierStep);
        if (tier > 0) {
          offset = halfThick + tier * tierStep;
        }
      }

      const surfaceX = projX + nx * offset;
      const surfaceY = projY + ny * offset;

      best = {
        wall,
        snappedPoint: { x: Math.round(surfaceX), y: Math.round(surfaceY) },
        wallCenterPoint: { x: Math.round(projX), y: Math.round(projY) },
        distance: dist,
        rotation: rot,
        angleRad
      };
    }
  }

  return best;
}

/**
 * Calculates a quadratic Bézier curve control point for curved arc wiring (Bogenlinien).
 */
export function calculateArcControlPoint(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  bulgeFactor: number = 0.25
): { x: number; y: number } {
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);

  if (len < 1e-4) return { x: midX, y: midY };

  // Perpendicular normal vector
  const nx = -dy / len;
  const ny = dx / len;
  const offset = len * bulgeFactor;

  return {
    x: Math.round((midX + nx * offset) * 10) / 10,
    y: Math.round((midY + ny * offset) * 10) / 10
  };
}

/**
 * Generates an SVG path string for a curved arc wire (Bogenlinie).
 */
export function arcWireSvgPath(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  curvature: number = 0.25
): string {
  const ctrl = calculateArcControlPoint(p1, p2, curvature);
  return `M ${p1.x} ${p1.y} Q ${ctrl.x} ${ctrl.y} ${p2.x} ${p2.y}`;
}

export interface RenderFloorPlanOptions {
  showBackground?: boolean;
  showRooms?: boolean;
  showRoomLabels?: boolean;
  showWalls?: boolean;
  showOpenings?: boolean;
  showWires?: boolean;
  components?: PlacedComponent[];
  selectedWallId?: string | null;
  selectedOpeningId?: string | null;
  interactive?: boolean;
}

/**
 * Renders complete FloorPlanData as clean vector SVG.
 */
export function floorPlanToSvg(
  plan: FloorPlanData,
  options: RenderFloorPlanOptions = {}
): string {
  const parts: string[] = [];
  const wallMap = new Map((plan.walls || []).map(w => [w.id, w]));
  const pxPerMeter = plan.scale?.pixelPerMeter || 50;

  // 1. Background image (if present and visible)
  if (options.showBackground !== false && plan.backgroundImage?.visible && plan.backgroundImage.dataUrl) {
    const bg = plan.backgroundImage;
    parts.push(
      `<image href="${bg.dataUrl}" x="${bg.bounds.x}" y="${bg.bounds.y}" width="${bg.bounds.width}" height="${bg.bounds.height}" opacity="${bg.opacity}" preserveAspectRatio="none" style="pointer-events:none;" />`
    );
  }

  // Helper to render a wall segment
  const renderSingleWall = (wall: WallSegment, isSelected: boolean) => {
    const isInteractive = options.interactive !== false;
    const strokeWidth = wall.thickness
      ? (wall.thickness < 1 ? Math.max(1.5, wall.thickness * pxPerMeter) : wall.thickness)
      : (wall.isExterior ? 3.5 : 2.0);
    const strokeColor = isSelected ? '#3182ce' : (wall.isExterior ? '#cbd5e0' : '#a0aec0');

    // Visual line
    parts.push(
      `<line x1="${wall.start.x}" y1="${wall.start.y}" x2="${wall.end.x}" y2="${wall.end.y}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" data-wall-id="${wall.id}" class="floorplan-wall ${isSelected ? 'selected' : ''}" style="${isInteractive ? '' : 'pointer-events:none;'}" />`
    );

    // Hit area for clicking/dragging (only in active floor plan edit mode)
    if (isInteractive) {
      parts.push(
        `<line x1="${wall.start.x}" y1="${wall.start.y}" x2="${wall.end.x}" y2="${wall.end.y}" stroke="rgba(0,0,0,0.001)" stroke-width="${Math.max(36, strokeWidth + 24)}" stroke-linecap="round" pointer-events="all" data-wall-id="${wall.id}" class="floorplan-wall-hit" style="cursor:move; pointer-events:all;" />`
      );
    }

    // If selected: render selection halo, length badge, and endpoint handles
    if (isSelected && isInteractive) {
      const dx = wall.end.x - wall.start.x;
      const dy = wall.end.y - wall.start.y;
      const lenPx = Math.hypot(dx, dy);
      const lenM = (lenPx / pxPerMeter).toFixed(2);
      const mx = (wall.start.x + wall.end.x) / 2;
      const my = (wall.start.y + wall.end.y) / 2;
      let nx = 0, ny = -1;
      if (lenPx > 1e-3) {
        nx = -dy / lenPx;
        ny = dx / lenPx;
      }
      const badgeX = mx + nx * (strokeWidth / 2 + 13);
      const badgeY = my + ny * (strokeWidth / 2 + 13);

      parts.push(
        `<line x1="${wall.start.x}" y1="${wall.start.y}" x2="${wall.end.x}" y2="${wall.end.y}" stroke="#63b3ed" stroke-width="${strokeWidth + 4}" stroke-linecap="round" opacity="0.35" pointer-events="none" data-wall-id="${wall.id}" class="floorplan-wall-halo" />`
      );
      parts.push(`
        <g class="floorplan-wall-badge" data-wall-id="${wall.id}" pointer-events="none" user-select="none">
          <rect x="${badgeX - 22}" y="${badgeY - 8}" width="44" height="16" rx="4" fill="#1a202c" stroke="#3182ce" stroke-width="1.2" />
          <text x="${badgeX}" y="${badgeY + 3.5}" font-size="9" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-weight="bold" fill="#63b3ed" text-anchor="middle">${lenM} m</text>
        </g>
      `);
      parts.push(
        `<circle cx="${wall.start.x}" cy="${wall.start.y}" r="36" fill="rgba(0,0,0,0.001)" pointer-events="all" class="floorplan-wall-handle" data-wall-handle="start" data-wall-id="${wall.id}" style="cursor:crosshair; pointer-events:all;" />
        <circle cx="${wall.start.x}" cy="${wall.start.y}" r="8" fill="#3182ce" stroke="#ffffff" stroke-width="2.5" pointer-events="none" data-wall-handle-visual="start" data-wall-id="${wall.id}" />`
      );
      parts.push(
        `<circle cx="${wall.end.x}" cy="${wall.end.y}" r="36" fill="rgba(0,0,0,0.001)" pointer-events="all" class="floorplan-wall-handle" data-wall-handle="end" data-wall-id="${wall.id}" style="cursor:crosshair; pointer-events:all;" />
        <circle cx="${wall.end.x}" cy="${wall.end.y}" r="8" fill="#3182ce" stroke="#ffffff" stroke-width="2.5" pointer-events="none" data-wall-handle-visual="end" data-wall-id="${wall.id}" />`
      );
    }
  };

  // Helper to render an opening
  const renderSingleOpening = (op: WallOpening, isSelected: boolean) => {
    const isInteractive = options.interactive !== false;
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

    const glassColor = isSelected ? '#3182ce' : '#63b3ed';
    const leafColor = isSelected ? '#3182ce' : '#e2e8f0';
    const arcColor = isSelected ? '#3182ce' : '#90cdf4';
    const cursorStyle = isInteractive ? 'cursor:pointer;' : 'pointer-events:none;';

    if (op.kind === 'window') {
      // Window: wall gap + double glass lines + jamb ticks
      parts.push(`
        <g ${isSelected ? 'class="floorplan-window selected"' : 'class="floorplan-window"'} data-opening-id="${op.id}" style="${cursorStyle}">
          ${isInteractive ? `<rect x="${Math.min(p1x, p2x) - 8}" y="${Math.min(p1y, p2y) - 8}" width="${Math.abs(p2x - p1x) + 16}" height="${Math.abs(p2y - p1y) + 16}" fill="rgba(0,0,0,0.001)" pointer-events="all" style="cursor:pointer; pointer-events:all;" />` : ''}
          <line x1="${p1x.toFixed(1)}" y1="${p1y.toFixed(1)}" x2="${p2x.toFixed(1)}" y2="${p2y.toFixed(1)}" stroke="#1a202c" stroke-width="6" stroke-linecap="butt" />
          <line x1="${(p1x + 1.5 * nx).toFixed(1)}" y1="${(p1y + 1.5 * ny).toFixed(1)}" x2="${(p2x + 1.5 * nx).toFixed(1)}" y2="${(p2y + 1.5 * ny).toFixed(1)}" stroke="${glassColor}" stroke-width="${isSelected ? 2.5 : 1.5}" />
          <line x1="${(p1x - 1.5 * nx).toFixed(1)}" y1="${(p1y - 1.5 * ny).toFixed(1)}" x2="${(p2x - 1.5 * nx).toFixed(1)}" y2="${(p2y - 1.5 * ny).toFixed(1)}" stroke="${glassColor}" stroke-width="${isSelected ? 2.5 : 1.5}" />
          <line x1="${(p1x - 3 * nx).toFixed(1)}" y1="${(p1y - 3 * ny).toFixed(1)}" x2="${(p1x + 3 * nx).toFixed(1)}" y2="${(p1y + 3 * ny).toFixed(1)}" stroke="#cbd5e0" stroke-width="1.5" />
          <line x1="${(p2x - 3 * nx).toFixed(1)}" y1="${(p2y - 3 * ny).toFixed(1)}" x2="${(p2x + 3 * nx).toFixed(1)}" y2="${(p2y + 3 * ny).toFixed(1)}" stroke="#cbd5e0" stroke-width="1.5" />
          ${isSelected && isInteractive ? `
            <circle cx="${op.center.x.toFixed(1)}" cy="${op.center.y.toFixed(1)}" r="22" fill="rgba(0,0,0,0.001)" pointer-events="all" class="floorplan-opening-handle" data-opening-id="${op.id}" style="cursor:move; pointer-events:all;" />
            <circle cx="${op.center.x.toFixed(1)}" cy="${op.center.y.toFixed(1)}" r="7" fill="#3182ce" stroke="#ffffff" stroke-width="2.5" pointer-events="none" data-opening-handle-visual="${op.id}" />
          ` : ''}
        </g>
      `);
    } else if (op.kind === 'opening') {
      // Simple Wall Opening / Durchgang: clean wall gap with jamb ticks
      parts.push(`
        <g ${isSelected ? 'class="floorplan-opening selected"' : 'class="floorplan-opening"'} data-opening-id="${op.id}" style="${cursorStyle}">
          ${isInteractive ? `<rect x="${Math.min(p1x, p2x) - 8}" y="${Math.min(p1y, p2y) - 8}" width="${Math.abs(p2x - p1x) + 16}" height="${Math.abs(p2y - p1y) + 16}" fill="rgba(0,0,0,0.001)" pointer-events="all" style="cursor:pointer; pointer-events:all;" />` : ''}
          <line x1="${p1x.toFixed(1)}" y1="${p1y.toFixed(1)}" x2="${p2x.toFixed(1)}" y2="${p2y.toFixed(1)}" stroke="#1a202c" stroke-width="6" stroke-linecap="butt" />
          <line x1="${(p1x - 3.5 * nx).toFixed(1)}" y1="${(p1y - 3.5 * ny).toFixed(1)}" x2="${(p1x + 3.5 * nx).toFixed(1)}" y2="${(p1y + 3.5 * ny).toFixed(1)}" stroke="${isSelected ? '#3182ce' : '#cbd5e0'}" stroke-width="2" />
          <line x1="${(p2x - 3.5 * nx).toFixed(1)}" y1="${(p2y - 3.5 * ny).toFixed(1)}" x2="${(p2x + 3.5 * nx).toFixed(1)}" y2="${(p2y + 3.5 * ny).toFixed(1)}" stroke="${isSelected ? '#3182ce' : '#cbd5e0'}" stroke-width="2" />
          ${isSelected && isInteractive ? `
            <circle cx="${op.center.x.toFixed(1)}" cy="${op.center.y.toFixed(1)}" r="22" fill="rgba(0,0,0,0.001)" pointer-events="all" class="floorplan-opening-handle" data-opening-id="${op.id}" style="cursor:move; pointer-events:all;" />
            <circle cx="${op.center.x.toFixed(1)}" cy="${op.center.y.toFixed(1)}" r="7" fill="#3182ce" stroke="#ffffff" stroke-width="2.5" pointer-events="none" data-opening-handle-visual="${op.id}" />
          ` : ''}
        </g>
      `);
    } else if (op.kind === 'garage_door') {
      // Garage Sectional Door: wall gap + overhead dashed track lines + sectional slats
      const trackLen = Math.max(30, opW * 0.75);
      const t1x = p1x + trackLen * nx;
      const t1y = p1y + trackLen * ny;
      const t2x = p2x + trackLen * nx;
      const t2y = p2y + trackLen * ny;

      parts.push(`
        <g ${isSelected ? 'class="floorplan-garage selected"' : 'class="floorplan-garage"'} data-opening-id="${op.id}" style="${cursorStyle}">
          ${isInteractive ? `<rect x="${Math.min(p1x, p2x, t1x, t2x) - 8}" y="${Math.min(p1y, p2y, t1y, t2y) - 8}" width="${Math.max(p1x, p2x, t1x, t2x) - Math.min(p1x, p2x, t1x, t2x) + 16}" height="${Math.max(p1y, p2y, t1y, t2y) - Math.min(p1y, p2y, t1y, t2y) + 16}" fill="rgba(0,0,0,0.001)" pointer-events="all" style="cursor:pointer; pointer-events:all;" />` : ''}
          <line x1="${p1x.toFixed(1)}" y1="${p1y.toFixed(1)}" x2="${p2x.toFixed(1)}" y2="${p2y.toFixed(1)}" stroke="#1a202c" stroke-width="6" stroke-linecap="butt" />
          <line x1="${(p1x - 3.5 * nx).toFixed(1)}" y1="${(p1y - 3.5 * ny).toFixed(1)}" x2="${(p1x + 3.5 * nx).toFixed(1)}" y2="${(p1y + 3.5 * ny).toFixed(1)}" stroke="#cbd5e0" stroke-width="2" />
          <line x1="${(p2x - 3.5 * nx).toFixed(1)}" y1="${(p2y - 3.5 * ny).toFixed(1)}" x2="${(p2x + 3.5 * nx).toFixed(1)}" y2="${(p2y + 3.5 * ny).toFixed(1)}" stroke="#cbd5e0" stroke-width="2" />
          <line x1="${p1x.toFixed(1)}" y1="${p1y.toFixed(1)}" x2="${p2x.toFixed(1)}" y2="${p2y.toFixed(1)}" stroke="${isSelected ? '#3182ce' : '#a0aec0'}" stroke-width="2.5" />
          <line x1="${(p1x + 2 * nx).toFixed(1)}" y1="${(p1y + 2 * ny).toFixed(1)}" x2="${(p2x + 2 * nx).toFixed(1)}" y2="${(p2y + 2 * ny).toFixed(1)}" stroke="${isSelected ? '#3182ce' : '#718096'}" stroke-width="1.2" stroke-dasharray="6,3" />
          <line x1="${p1x.toFixed(1)}" y1="${p1y.toFixed(1)}" x2="${t1x.toFixed(1)}" y2="${t1y.toFixed(1)}" stroke="${isSelected ? '#3182ce' : '#718096'}" stroke-width="1.4" stroke-dasharray="3,3" />
          <line x1="${p2x.toFixed(1)}" y1="${p2y.toFixed(1)}" x2="${t2x.toFixed(1)}" y2="${t2y.toFixed(1)}" stroke="${isSelected ? '#3182ce' : '#718096'}" stroke-width="1.4" stroke-dasharray="3,3" />
          <line x1="${t1x.toFixed(1)}" y1="${t1y.toFixed(1)}" x2="${t2x.toFixed(1)}" y2="${t2y.toFixed(1)}" stroke="${isSelected ? '#3182ce' : '#718096'}" stroke-width="1.4" stroke-dasharray="3,3" />
          ${isSelected && isInteractive ? `
            <circle cx="${op.center.x.toFixed(1)}" cy="${op.center.y.toFixed(1)}" r="22" fill="rgba(0,0,0,0.001)" pointer-events="all" class="floorplan-opening-handle" data-opening-id="${op.id}" style="cursor:move; pointer-events:all;" />
            <circle cx="${op.center.x.toFixed(1)}" cy="${op.center.y.toFixed(1)}" r="7" fill="#3182ce" stroke="#ffffff" stroke-width="2.5" pointer-events="none" data-opening-handle-visual="${op.id}" />
          ` : ''}
        </g>
      `);
    } else {
      // Door: wall gap + 90 deg leaf + dashed swing arc (correct DIN Links and DIN Rechts swing geometry)
      const isRight = op.swingDirection?.startsWith('right_');
      const swingSign = op.swingDirection?.includes('out') ? -1 : 1;
      const hasArc = op.swingDirection !== 'none';

      const hingeX = isRight ? p2x : p1x;
      const hingeY = isRight ? p2y : p1y;
      const targetX = isRight ? p1x : p2x;
      const targetY = isRight ? p1y : p2y;

      const leafEndX = hingeX + opW * nx * swingSign;
      const leafEndY = hingeY + opW * ny * swingSign;
      const cross = (leafEndX - hingeX) * (targetY - hingeY) - (leafEndY - hingeY) * (targetX - hingeX);
      const sweepFlag = cross > 0 ? 1 : 0;

      parts.push(`
        <g ${isSelected ? 'class="floorplan-door selected"' : 'class="floorplan-door"'} data-opening-id="${op.id}" style="${cursorStyle}">
          ${isInteractive ? `<circle cx="${op.center.x.toFixed(1)}" cy="${op.center.y.toFixed(1)}" r="${Math.max(18, hw + 6)}" fill="rgba(0,0,0,0.001)" pointer-events="all" style="cursor:pointer; pointer-events:all;" />` : ''}
          <line x1="${p1x.toFixed(1)}" y1="${p1y.toFixed(1)}" x2="${p2x.toFixed(1)}" y2="${p2y.toFixed(1)}" stroke="#1a202c" stroke-width="6" stroke-linecap="butt" />
          <line x1="${(p1x - 2.5 * nx).toFixed(1)}" y1="${(p1y - 2.5 * ny).toFixed(1)}" x2="${(p1x + 2.5 * nx).toFixed(1)}" y2="${(p1y + 2.5 * ny).toFixed(1)}" stroke="#cbd5e0" stroke-width="1.5" />
          <line x1="${(p2x - 2.5 * nx).toFixed(1)}" y1="${(p2y - 2.5 * ny).toFixed(1)}" x2="${(p2x + 2.5 * nx).toFixed(1)}" y2="${(p2y + 2.5 * ny).toFixed(1)}" stroke="#cbd5e0" stroke-width="1.5" />
          ${hasArc ? `
            <line x1="${hingeX.toFixed(1)}" y1="${hingeY.toFixed(1)}" x2="${leafEndX.toFixed(1)}" y2="${leafEndY.toFixed(1)}" stroke="${leafColor}" stroke-width="${isSelected ? 2.5 : 1.8}" />
            <path d="M ${leafEndX.toFixed(1)} ${leafEndY.toFixed(1)} A ${opW.toFixed(1)} ${opW.toFixed(1)} 0 0 ${sweepFlag} ${targetX.toFixed(1)} ${targetY.toFixed(1)}" fill="none" stroke="${arcColor}" stroke-width="${isSelected ? 1.8 : 1.2}" stroke-dasharray="2.5,2.5" />
          ` : `
            <line x1="${p1x.toFixed(1)}" y1="${p1y.toFixed(1)}" x2="${p2x.toFixed(1)}" y2="${p2y.toFixed(1)}" stroke="${leafColor}" stroke-width="1.5" stroke-dasharray="4,4" />
          `}
          ${isSelected && isInteractive ? `
            <circle cx="${op.center.x.toFixed(1)}" cy="${op.center.y.toFixed(1)}" r="22" fill="rgba(0,0,0,0.001)" pointer-events="all" class="floorplan-opening-handle" data-opening-id="${op.id}" style="cursor:move; pointer-events:all;" />
            <circle cx="${op.center.x.toFixed(1)}" cy="${op.center.y.toFixed(1)}" r="7" fill="#3182ce" stroke="#ffffff" stroke-width="2.5" pointer-events="none" data-opening-handle-visual="${op.id}" />
          ` : ''}
        </g>
      `);
    }
  };

  // 3. Render unselected walls
  if (options.showWalls !== false && plan.walls) {
    for (const wall of plan.walls) {
      if (wall.id !== options.selectedWallId) {
        renderSingleWall(wall, false);
      }
    }
  }

  // 4. Render unselected openings
  if (options.showOpenings !== false && plan.openings) {
    for (const op of plan.openings) {
      if (op.id !== options.selectedOpeningId) {
        renderSingleOpening(op, false);
      }
    }
  }

  // 5. FOREGROUND: Selected wall (on top of unselected walls and openings)
  if (options.showWalls !== false && plan.walls && options.selectedWallId) {
    const selWall = plan.walls.find(w => w.id === options.selectedWallId);
    if (selWall) {
      renderSingleWall(selWall, true);
    }
  }

  // 6. FOREGROUND: Selected opening (on top of everything)
  if (options.showOpenings !== false && plan.openings && options.selectedOpeningId) {
    const selOp = plan.openings.find(o => o.id === options.selectedOpeningId);
    if (selOp) {
      renderSingleOpening(selOp, true);
    }
  }

  // 5. Curved Installation Wires (Bogenlinien)
  if (options.showWires !== false && plan.arcWires && options.components) {
    const compMap = new Map(options.components.map(c => [c.id, c]));
    const circuitMap = new Map((plan.circuits || []).map(c => [c.id, c]));

    for (const wire of plan.arcWires) {
      const c1 = compMap.get(wire.fromComponentId);
      const c2 = compMap.get(wire.toComponentId);
      if (!c1 || !c2) continue;

      const p1 = { x: c1.x, y: c1.y };
      const p2 = { x: c2.x, y: c2.y };
      const pathD = arcWireSvgPath(p1, p2, wire.curvature ?? 0.25);
      const circuit = wire.circuitId ? circuitMap.get(wire.circuitId) : undefined;
      const strokeColor = circuit?.color || '#3182ce';

      parts.push(`
        <g class="arc-wire" data-wire-id="${wire.id}">
          <path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" />
          ${wire.label ? `<text x="${(p1.x + p2.x) / 2}" y="${(p1.y + p2.y) / 2 - 4}" font-size="8" font-family="sans-serif" fill="${strokeColor}" text-anchor="middle">${escapeSvg(wire.label)}</text>` : ''}
        </g>
      `);
    }
  }

  return parts.join('\n');
}

export interface FloorPlanLegendItem {
  symbolId: string;
  symbol: SymbolDefinition;
  name: string;
  count: number;
}

export interface FloorPlanLegendLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  columns: number;
  rows: number;
  colWidth: number;
  headerHeight: number;
  rowHeight: number;
  scale: number;
  items: FloorPlanLegendItem[];
  totalCount: number;
  showCounts: boolean;
  title: string;
}

/**
 * Collects and counts all unique symbols placed on a floor plan page.
 */
export function collectFloorPlanLegendItems(
  components: PlacedComponent[],
  project?: Project,
  lang: 'de' | 'en' = getUiLanguage()
): FloorPlanLegendItem[] {
  const map = new Map<string, FloorPlanLegendItem>();
  for (const comp of components || []) {
    const sym = getSymbolForComponent(comp, project);
    if (!sym) continue;
    const existing = map.get(sym.id);
    if (existing) {
      existing.count += 1;
    } else {
      const loc = getLocalizedSymbol(sym, lang);
      map.set(sym.id, {
        symbolId: sym.id,
        symbol: sym,
        name: loc.name || sym.name,
        count: 1
      });
    }
  }
  return Array.from(map.values());
}

/**
 * Calculates the bounding box and table cell metrics for the floor plan symbol legend.
 */
export function computeFloorPlanLegendLayout(
  plan: FloorPlanData,
  components: PlacedComponent[],
  project?: Project,
  pageBounds: { width: number; height: number } = { width: 1000, height: 700 },
  lang: 'de' | 'en' = getUiLanguage()
): FloorPlanLegendLayout | null {
  const cfg = plan.legend;
  if (cfg?.visible === false) return null;

  const items = collectFloorPlanLegendItems(components, project, lang);
  if (items.length === 0) return null;

  const scale = cfg?.scale ?? 1;
  const rawCols = cfg?.columns && cfg.columns !== 'auto'
    ? Number(cfg.columns)
    : (items.length > 8 ? 2 : 1);
  const columns = Math.max(1, Math.min(3, Math.min(items.length, rawCols)));
  const rows = Math.ceil(items.length / columns);
  const showCounts = cfg?.showCounts !== false;

  const headerHeight = 16 * scale;
  const rowHeight = 15 * scale;
  const maxChars = Math.max(18, ...items.map(i => i.name.length));
  const colWidth = Math.max(150, Math.min(235, 28 + maxChars * 4.2 + (showCounts ? 24 : 6))) * scale;
  const width = columns * colWidth;
  const height = headerHeight + rows * rowHeight + 3 * scale;

  const pos = cfg?.position ?? 'bottom-right';
  const marginX = 16;
  const topY = 18;
  const bottomY = pageBounds.height - 44; // Above DIN A3 title block

  let x = pageBounds.width - marginX - width;
  let y = bottomY - height;

  if (pos === 'bottom-left') {
    x = marginX;
    y = bottomY - height;
  } else if (pos === 'top-right') {
    x = pageBounds.width - marginX - width;
    y = topY;
  } else if (pos === 'top-left') {
    x = marginX;
    y = topY;
  } else if (pos === 'custom' && typeof cfg?.x === 'number' && typeof cfg?.y === 'number') {
    x = Math.max(4, Math.min(pageBounds.width - 40, cfg.x));
    y = Math.max(12, Math.min(pageBounds.height - 30, cfg.y));
  }

  const totalCount = items.reduce((sum, item) => sum + item.count, 0);
  const title = lang === 'en' ? 'SYMBOL LEGEND' : 'LEGENDE / ZEICHENERKLÄRUNG';

  return {
    x,
    y,
    width,
    height,
    columns,
    rows,
    colWidth,
    headerHeight,
    rowHeight,
    scale,
    items,
    totalCount,
    showCounts,
    title
  };
}

/**
 * Renders the floor plan symbol legend as a draggable vector SVG overlay inside the sheet.
 */
export function floorPlanLegendToSvg(
  plan: FloorPlanData,
  components: PlacedComponent[],
  project?: Project,
  pageBounds: { width: number; height: number } = { width: 1000, height: 700 },
  lang: 'de' | 'en' = getUiLanguage()
): string {
  const layout = computeFloorPlanLegendLayout(plan, components, project, pageBounds, lang);
  if (!layout) return '';

  const { x, y, width, height, columns, rows, colWidth, headerHeight, rowHeight, scale, items, totalCount, showCounts, title } = layout;
  const cells: string[] = [];

  for (let c = 1; c < columns; c++) {
    const cx = (c * colWidth).toFixed(1);
    cells.push(`<line x1="${cx}" y1="${headerHeight.toFixed(1)}" x2="${cx}" y2="${height.toFixed(1)}" stroke="#354052" stroke-width="0.8"/>`);
  }

  items.forEach((item, idx) => {
    const col = Math.floor(idx / rows);
    const row = idx % rows;
    const cellX = col * colWidth;
    const cellY = headerHeight + row * rowHeight;

    if (row > 0) {
      cells.push(
        `<line x1="${(cellX + 3).toFixed(1)}" y1="${cellY.toFixed(1)}" x2="${(cellX + colWidth - 3).toFixed(1)}" y2="${cellY.toFixed(1)}" stroke="#283141" stroke-width="0.6"/>`
      );
    }

    const sym = item.symbol;
    const symW = sym.width || 32;
    const symH = sym.height || 32;
    const iconBox = 11 * scale;
    const iconScale = iconBox / Math.max(symW, symH, 1);
    const iconX = cellX + 11 * scale - (symW * iconScale) / 2;
    const iconY = cellY + rowHeight / 2 - (symH * iconScale) / 2;
    const symMarkup = sym.importedGraphics
      ? drawingToSvg(sym.importedGraphics, { color: '#e2e8f0' })
      : sym.svgContent;

    const maxLabelChars = Math.max(12, Math.floor((colWidth / scale - (showCounts ? 46 : 26)) / 3.9));
    const displayLabel = item.name.length > maxLabelChars
      ? item.name.slice(0, maxLabelChars - 1) + '…'
      : item.name;

    cells.push(`
      <g transform="translate(${iconX.toFixed(2)}, ${iconY.toFixed(2)}) scale(${iconScale.toFixed(4)})" color="#e2e8f0">
        ${symMarkup}
      </g>
      <text x="${(cellX + 21 * scale).toFixed(1)}" y="${(cellY + rowHeight * 0.66).toFixed(1)}" font-size="${(6.8 * scale).toFixed(2)}" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" fill="#e2e8f0">${escapeSvg(displayLabel)}</text>
      ${showCounts ? `<text x="${(cellX + colWidth - 6 * scale).toFixed(1)}" y="${(cellY + rowHeight * 0.66).toFixed(1)}" font-size="${(6.8 * scale).toFixed(2)}" font-family="monospace" font-weight="bold" fill="#63b3ed" text-anchor="end">${item.count}×</text>` : ''}
    `);
  });

  const sumLabel = lang === 'en' ? `Total: ${totalCount}` : `Gesamt: ${totalCount}`;

  return `
    <g id="floorPlanLegend" class="floorplan-legend" data-floorplan-legend="true" transform="translate(${x.toFixed(1)}, ${y.toFixed(1)})" style="cursor: move; user-select: none;">
      <rect x="0" y="0" width="${width.toFixed(1)}" height="${height.toFixed(1)}" rx="3" fill="rgba(20, 25, 35, 0.94)" stroke="#4a5568" stroke-width="1.1"/>
      <rect x="0" y="0" width="${width.toFixed(1)}" height="${headerHeight.toFixed(1)}" rx="3" fill="#232d3d"/>
      <line x1="0" y1="${headerHeight.toFixed(1)}" x2="${width.toFixed(1)}" y2="${headerHeight.toFixed(1)}" stroke="#4a5568" stroke-width="0.9"/>
      <text x="${(7 * scale).toFixed(1)}" y="${(headerHeight * 0.68).toFixed(1)}" font-size="${(6.8 * scale).toFixed(2)}" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-weight="bold" letter-spacing="0.4" fill="#90cdf4">${escapeSvg(title)}</text>
      ${showCounts ? `<text x="${(width - 6 * scale).toFixed(1)}" y="${(headerHeight * 0.68).toFixed(1)}" font-size="${(6.2 * scale).toFixed(2)}" font-family="monospace" fill="#a0aec0" text-anchor="end">${escapeSvg(sumLabel)}</text>` : ''}
      ${cells.join('\n')}
    </g>
  `;
}
