// src/model/FloorPlanRenderer.ts
// SVG rendering and wall-snapping calculation for architectural floor plans and curved installation wiring

import { FloorPlanData, WallSegment, WallOpening, RoomDefinition, InstallationArcWire, InstallationCircuit, PlacedComponent } from './types';
import { escapeSvg } from './ImportedDrawing';

export interface WallSnapResult {
  wall: WallSegment;
  snappedPoint: { x: number; y: number };
  distance: number;
  rotation: 0 | 90 | 180 | 270; // Rotation aligned outward from the wall
  angleRad: number;
}

/**
 * Calculates nearest wall and normal orientation for magnetic symbol snapping.
 */
export function findNearestWall(
  point: { x: number; y: number },
  walls: WallSegment[],
  maxDistance: number = 30
): WallSnapResult | null {
  let best: WallSnapResult | null = null;
  let minDistance = maxDistance;

  for (const wall of walls) {
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) continue;

    let t = ((point.x - wall.start.x) * dx + (point.y - wall.start.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = wall.start.x + t * dx;
    const projY = wall.start.y + t * dy;
    const dist = Math.hypot(point.x - projX, point.y - projY);

    if (dist < minDistance) {
      minDistance = dist;

      // Wall angle
      let wallAngle = Math.atan2(dy, dx);
      // Wall normal pointing toward the mouse pointer
      let normalAngle = wallAngle + Math.PI / 2;
      const normalX = Math.cos(normalAngle);
      const normalY = Math.sin(normalAngle);
      const dot = normalX * (point.x - projX) + normalY * (point.y - projY);
      if (dot < 0) {
        normalAngle -= Math.PI;
      }

      // Convert normalAngle to discrete 0, 90, 180, 270 deg for symbol rotation
      let deg = ((normalAngle * 180) / Math.PI + 360) % 360;
      let rot: 0 | 90 | 180 | 270 = 0;
      if (deg >= 45 && deg < 135) rot = 90;
      else if (deg >= 135 && deg < 225) rot = 180;
      else if (deg >= 225 && deg < 315) rot = 270;

      best = {
        wall,
        snappedPoint: { x: Math.round(projX), y: Math.round(projY) },
        distance: dist,
        rotation: rot,
        angleRad: normalAngle
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

  // 2. Room polygons and room labels (clean, subtle architectural styling)
  if (options.showRooms !== false && plan.rooms && plan.rooms.length > 0) {
    for (const room of plan.rooms) {
      if (room.polygon && room.polygon.length >= 3) {
        const pts = room.polygon.map(p => `${p.x},${p.y}`).join(' ');
        parts.push(
          `<polygon points="${pts}" fill="rgba(66, 153, 225, 0.04)" stroke="rgba(66, 153, 225, 0.2)" stroke-width="0.8" stroke-dasharray="3,3" style="pointer-events:none;" />`
        );
      }

      // Render subtle room labels only if enabled
      const showLabels = options.showRoomLabels !== false && plan.showRoomLabels !== false;
      if (showLabels) {
        let cx = 0, cy = 0;
        if (room.polygon && room.polygon.length > 0) {
          for (const pt of room.polygon) {
            cx += pt.x;
            cy += pt.y;
          }
          cx = Math.round(cx / room.polygon.length);
          cy = Math.round(cy / room.polygon.length);
        }
        const labelText = escapeSvg(room.name);
        const areaText = room.areaM2 ? `${room.areaM2.toFixed(1)} m²` : '';
        parts.push(`
          <g class="room-label" style="pointer-events:none;user-select:none;">
            <text x="${cx}" y="${cy}" font-size="9.5" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-weight="600" fill="#a0aec0" text-anchor="middle">${labelText}</text>
            ${areaText ? `<text x="${cx}" y="${cy + 11}" font-size="8" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" fill="#718096" text-anchor="middle">${areaText}</text>` : ''}
          </g>
        `);
      }
    }
  }

  // 3. Walls (architectural line weights: exterior 3.5, interior 2.0; interactive selection & handles)
  if (options.showWalls !== false && plan.walls) {
    const isInteractive = options.interactive !== false;
    for (const wall of plan.walls) {
      const isSelected = options.selectedWallId === wall.id;
      // Convert thickness if entered in meters (< 1)
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
          `<line x1="${wall.start.x}" y1="${wall.start.y}" x2="${wall.end.x}" y2="${wall.end.y}" stroke="transparent" stroke-width="${Math.max(16, strokeWidth + 10)}" stroke-linecap="round" data-wall-id="${wall.id}" class="floorplan-wall-hit" style="cursor:pointer;" />`
        );
      }

      // If selected: render selection halo and endpoint handles
      if (isSelected && isInteractive) {
        parts.push(
          `<line x1="${wall.start.x}" y1="${wall.start.y}" x2="${wall.end.x}" y2="${wall.end.y}" stroke="#63b3ed" stroke-width="${strokeWidth + 4}" stroke-linecap="round" opacity="0.35" pointer-events="none" />`
        );
        parts.push(
          `<circle cx="${wall.start.x}" cy="${wall.start.y}" r="6" fill="#3182ce" stroke="#ffffff" stroke-width="2" class="floorplan-wall-handle" data-wall-handle="start" data-wall-id="${wall.id}" style="cursor:crosshair;" />`
        );
        parts.push(
          `<circle cx="${wall.end.x}" cy="${wall.end.y}" r="6" fill="#3182ce" stroke="#ffffff" stroke-width="2" class="floorplan-wall-handle" data-wall-handle="end" data-wall-id="${wall.id}" style="cursor:crosshair;" />`
        );
      }
    }
  }

  // 4. Openings (Doors, Windows, Passages, Garage Doors; interactive selection)
  if (options.showOpenings !== false && plan.openings) {
    const isInteractive = options.interactive !== false;
    for (const op of plan.openings) {
      const isSelected = options.selectedOpeningId === op.id;
      // Width in drawing units
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
            ${isInteractive ? `<rect x="${Math.min(p1x, p2x) - 6}" y="${Math.min(p1y, p2y) - 6}" width="${Math.abs(p2x - p1x) + 12}" height="${Math.abs(p2y - p1y) + 12}" fill="transparent" pointer-events="all" />` : ''}
            <line x1="${p1x.toFixed(1)}" y1="${p1y.toFixed(1)}" x2="${p2x.toFixed(1)}" y2="${p2y.toFixed(1)}" stroke="#1a202c" stroke-width="6" stroke-linecap="butt" />
            <line x1="${(p1x + 1.5 * nx).toFixed(1)}" y1="${(p1y + 1.5 * ny).toFixed(1)}" x2="${(p2x + 1.5 * nx).toFixed(1)}" y2="${(p2y + 1.5 * ny).toFixed(1)}" stroke="${glassColor}" stroke-width="${isSelected ? 2.5 : 1.5}" />
            <line x1="${(p1x - 1.5 * nx).toFixed(1)}" y1="${(p1y - 1.5 * ny).toFixed(1)}" x2="${(p2x - 1.5 * nx).toFixed(1)}" y2="${(p2y - 1.5 * ny).toFixed(1)}" stroke="${glassColor}" stroke-width="${isSelected ? 2.5 : 1.5}" />
            <line x1="${(p1x - 3 * nx).toFixed(1)}" y1="${(p1y - 3 * ny).toFixed(1)}" x2="${(p1x + 3 * nx).toFixed(1)}" y2="${(p1y + 3 * ny).toFixed(1)}" stroke="#cbd5e0" stroke-width="1.5" />
            <line x1="${(p2x - 3 * nx).toFixed(1)}" y1="${(p2y - 3 * ny).toFixed(1)}" x2="${(p2x + 3 * nx).toFixed(1)}" y2="${(p2y + 3 * ny).toFixed(1)}" stroke="#cbd5e0" stroke-width="1.5" />
            ${isSelected && isInteractive ? `<circle cx="${op.center.x.toFixed(1)}" cy="${op.center.y.toFixed(1)}" r="6" fill="#3182ce" stroke="#ffffff" stroke-width="2" class="floorplan-opening-handle" data-opening-id="${op.id}" style="cursor:move;" />` : ''}
          </g>
        `);
      } else if (op.kind === 'opening') {
        // Simple Wall Opening / Durchgang: clean wall gap with jamb ticks
        parts.push(`
          <g ${isSelected ? 'class="floorplan-opening selected"' : 'class="floorplan-opening"'} data-opening-id="${op.id}" style="${cursorStyle}">
            ${isInteractive ? `<rect x="${Math.min(p1x, p2x) - 6}" y="${Math.min(p1y, p2y) - 6}" width="${Math.abs(p2x - p1x) + 12}" height="${Math.abs(p2y - p1y) + 12}" fill="transparent" pointer-events="all" />` : ''}
            <line x1="${p1x.toFixed(1)}" y1="${p1y.toFixed(1)}" x2="${p2x.toFixed(1)}" y2="${p2y.toFixed(1)}" stroke="#1a202c" stroke-width="6" stroke-linecap="butt" />
            <line x1="${(p1x - 3.5 * nx).toFixed(1)}" y1="${(p1y - 3.5 * ny).toFixed(1)}" x2="${(p1x + 3.5 * nx).toFixed(1)}" y2="${(p1y + 3.5 * ny).toFixed(1)}" stroke="${isSelected ? '#3182ce' : '#cbd5e0'}" stroke-width="2" />
            <line x1="${(p2x - 3.5 * nx).toFixed(1)}" y1="${(p2y - 3.5 * ny).toFixed(1)}" x2="${(p2x + 3.5 * nx).toFixed(1)}" y2="${(p2y + 3.5 * ny).toFixed(1)}" stroke="${isSelected ? '#3182ce' : '#cbd5e0'}" stroke-width="2" />
            ${isSelected && isInteractive ? `<circle cx="${op.center.x.toFixed(1)}" cy="${op.center.y.toFixed(1)}" r="6" fill="#3182ce" stroke="#ffffff" stroke-width="2" class="floorplan-opening-handle" data-opening-id="${op.id}" style="cursor:move;" />` : ''}
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
            ${isInteractive ? `<rect x="${Math.min(p1x, p2x, t1x, t2x) - 6}" y="${Math.min(p1y, p2y, t1y, t2y) - 6}" width="${Math.max(p1x, p2x, t1x, t2x) - Math.min(p1x, p2x, t1x, t2x) + 12}" height="${Math.max(p1y, p2y, t1y, t2y) - Math.min(p1y, p2y, t1y, t2y) + 12}" fill="transparent" pointer-events="all" />` : ''}
            <!-- Wall gap -->
            <line x1="${p1x.toFixed(1)}" y1="${p1y.toFixed(1)}" x2="${p2x.toFixed(1)}" y2="${p2y.toFixed(1)}" stroke="#1a202c" stroke-width="6" stroke-linecap="butt" />
            <!-- Jamb ticks -->
            <line x1="${(p1x - 3.5 * nx).toFixed(1)}" y1="${(p1y - 3.5 * ny).toFixed(1)}" x2="${(p1x + 3.5 * nx).toFixed(1)}" y2="${(p1y + 3.5 * ny).toFixed(1)}" stroke="#cbd5e0" stroke-width="2" />
            <line x1="${(p2x - 3.5 * nx).toFixed(1)}" y1="${(p2y - 3.5 * ny).toFixed(1)}" x2="${(p2x + 3.5 * nx).toFixed(1)}" y2="${(p2y + 3.5 * ny).toFixed(1)}" stroke="#cbd5e0" stroke-width="2" />
            <!-- Sectional door closed line -->
            <line x1="${p1x.toFixed(1)}" y1="${p1y.toFixed(1)}" x2="${p2x.toFixed(1)}" y2="${p2y.toFixed(1)}" stroke="${isSelected ? '#3182ce' : '#a0aec0'}" stroke-width="2.5" />
            <!-- Slat pattern -->
            <line x1="${(p1x + 2 * nx).toFixed(1)}" y1="${(p1y + 2 * ny).toFixed(1)}" x2="${(p2x + 2 * nx).toFixed(1)}" y2="${(p2y + 2 * ny).toFixed(1)}" stroke="${isSelected ? '#3182ce' : '#718096'}" stroke-width="1.2" stroke-dasharray="6,3" />
            <!-- Overhead ceiling track lines -->
            <line x1="${p1x.toFixed(1)}" y1="${p1y.toFixed(1)}" x2="${t1x.toFixed(1)}" y2="${t1y.toFixed(1)}" stroke="${isSelected ? '#3182ce' : '#718096'}" stroke-width="1.4" stroke-dasharray="3,3" />
            <line x1="${p2x.toFixed(1)}" y1="${p2y.toFixed(1)}" x2="${t2x.toFixed(1)}" y2="${t2y.toFixed(1)}" stroke="${isSelected ? '#3182ce' : '#718096'}" stroke-width="1.4" stroke-dasharray="3,3" />
            <line x1="${t1x.toFixed(1)}" y1="${t1y.toFixed(1)}" x2="${t2x.toFixed(1)}" y2="${t2y.toFixed(1)}" stroke="${isSelected ? '#3182ce' : '#718096'}" stroke-width="1.4" stroke-dasharray="3,3" />
            ${isSelected && isInteractive ? `<circle cx="${op.center.x.toFixed(1)}" cy="${op.center.y.toFixed(1)}" r="6" fill="#3182ce" stroke="#ffffff" stroke-width="2" class="floorplan-opening-handle" data-opening-id="${op.id}" style="cursor:move;" />` : ''}
          </g>
        `);
      } else {
        // Door: wall gap + 90 deg leaf + dashed swing arc (correct DIN Links and DIN Rechts swing geometry)
        const isRight = op.swingDirection?.startsWith('right_');
        const swingSign = op.swingDirection?.includes('out') ? -1 : 1;
        const hasArc = op.swingDirection !== 'none';

        // Left hinge: hinge at p1, swings to p2
        // Right hinge: hinge at p2, swings to p1
        const hingeX = isRight ? p2x : p1x;
        const hingeY = isRight ? p2y : p1y;
        const targetX = isRight ? p1x : p2x;
        const targetY = isRight ? p1y : p2y;

        const leafEndX = hingeX + opW * nx * swingSign;
        const leafEndY = hingeY + opW * ny * swingSign;

        // Sweep flag: for left, inward swing is clockwise (1); for right, inward swing is counter-clockwise (0)
        const sweepFlag = isRight ? (swingSign > 0 ? 0 : 1) : (swingSign > 0 ? 1 : 0);

        parts.push(`
          <g ${isSelected ? 'class="floorplan-door selected"' : 'class="floorplan-door"'} data-opening-id="${op.id}" style="${cursorStyle}">
            ${isInteractive ? `<circle cx="${op.center.x.toFixed(1)}" cy="${op.center.y.toFixed(1)}" r="${Math.max(16, hw + 4)}" fill="transparent" pointer-events="all" />` : ''}
            <line x1="${p1x.toFixed(1)}" y1="${p1y.toFixed(1)}" x2="${p2x.toFixed(1)}" y2="${p2y.toFixed(1)}" stroke="#1a202c" stroke-width="6" stroke-linecap="butt" />
            <line x1="${(p1x - 2.5 * nx).toFixed(1)}" y1="${(p1y - 2.5 * ny).toFixed(1)}" x2="${(p1x + 2.5 * nx).toFixed(1)}" y2="${(p1y + 2.5 * ny).toFixed(1)}" stroke="#cbd5e0" stroke-width="1.5" />
            <line x1="${(p2x - 2.5 * nx).toFixed(1)}" y1="${(p2y - 2.5 * ny).toFixed(1)}" x2="${(p2x + 2.5 * nx).toFixed(1)}" y2="${(p2y + 2.5 * ny).toFixed(1)}" stroke="#cbd5e0" stroke-width="1.5" />
            ${hasArc ? `
              <line x1="${hingeX.toFixed(1)}" y1="${hingeY.toFixed(1)}" x2="${leafEndX.toFixed(1)}" y2="${leafEndY.toFixed(1)}" stroke="${leafColor}" stroke-width="${isSelected ? 2.5 : 1.8}" />
              <path d="M ${leafEndX.toFixed(1)} ${leafEndY.toFixed(1)} A ${opW.toFixed(1)} ${opW.toFixed(1)} 0 0 ${sweepFlag} ${targetX.toFixed(1)} ${targetY.toFixed(1)}" fill="none" stroke="${arcColor}" stroke-width="${isSelected ? 1.8 : 1.2}" stroke-dasharray="2.5,2.5" />
            ` : `
              <line x1="${p1x.toFixed(1)}" y1="${p1y.toFixed(1)}" x2="${p2x.toFixed(1)}" y2="${p2y.toFixed(1)}" stroke="${leafColor}" stroke-width="1.5" stroke-dasharray="4,4" />
            `}
            ${isSelected && isInteractive ? `<circle cx="${op.center.x.toFixed(1)}" cy="${op.center.y.toFixed(1)}" r="6" fill="#3182ce" stroke="#ffffff" stroke-width="2" class="floorplan-opening-handle" data-opening-id="${op.id}" style="cursor:move;" />` : ''}
          </g>
        `);
      }
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
