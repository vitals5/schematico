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
  showWalls?: boolean;
  showOpenings?: boolean;
  showWires?: boolean;
  components?: PlacedComponent[];
}

/**
 * Renders complete FloorPlanData as clean vector SVG.
 */
export function floorPlanToSvg(
  plan: FloorPlanData,
  options: RenderFloorPlanOptions = {}
): string {
  const parts: string[] = [];

  // 1. Background image (if present and visible)
  if (options.showBackground !== false && plan.backgroundImage?.visible && plan.backgroundImage.dataUrl) {
    const bg = plan.backgroundImage;
    parts.push(
      `<image href="${bg.dataUrl}" x="${bg.bounds.x}" y="${bg.bounds.y}" width="${bg.bounds.width}" height="${bg.bounds.height}" opacity="${bg.opacity}" preserveAspectRatio="none" style="pointer-events:none;" />`
    );
  }

  // 2. Room polygons and room labels
  if (options.showRooms !== false && plan.rooms && plan.rooms.length > 0) {
    for (const room of plan.rooms) {
      if (room.polygon && room.polygon.length >= 3) {
        const pts = room.polygon.map(p => `${p.x},${p.y}`).join(' ');
        parts.push(
          `<polygon points="${pts}" fill="rgba(66, 153, 225, 0.05)" stroke="rgba(66, 153, 225, 0.25)" stroke-width="1" stroke-dasharray="4,4" />`
        );
      }
      // Calculate center of polygon for room label
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
          <text x="${cx}" y="${cy}" font-size="11" font-family="sans-serif" font-weight="bold" fill="#718096" text-anchor="middle">${labelText}</text>
          ${areaText ? `<text x="${cx}" y="${cy + 14}" font-size="9" font-family="sans-serif" fill="#a0aec0" text-anchor="middle">${areaText}</text>` : ''}
        </g>
      `);
    }
  }

  // 3. Walls
  if (options.showWalls !== false && plan.walls) {
    for (const wall of plan.walls) {
      const strokeWidth = wall.thickness || 12;
      const strokeColor = wall.isExterior ? '#2d3748' : '#4a5568';
      parts.push(
        `<line x1="${wall.start.x}" y1="${wall.start.y}" x2="${wall.end.x}" y2="${wall.end.y}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" />`
      );
    }
  }

  // 4. Openings (Doors & Windows)
  if (options.showOpenings !== false && plan.openings) {
    for (const op of plan.openings) {
      const hw = op.width / 2;
      if (op.kind === 'window') {
        // Window: opening line with double glass frame
        parts.push(`
          <g class="floorplan-window">
            <line x1="${op.center.x - hw}" y1="${op.center.y}" x2="${op.center.x + hw}" y2="${op.center.y}" stroke="#ffffff" stroke-width="14" />
            <line x1="${op.center.x - hw}" y1="${op.center.y - 2}" x2="${op.center.x + hw}" y2="${op.center.y - 2}" stroke="#3182ce" stroke-width="2" />
            <line x1="${op.center.x - hw}" y1="${op.center.y + 2}" x2="${op.center.x + hw}" y2="${op.center.y + 2}" stroke="#3182ce" stroke-width="2" />
          </g>
        `);
      } else {
        // Door: opening gap + door leaf line + 90 deg swing arc
        parts.push(`
          <g class="floorplan-door">
            <line x1="${op.center.x - hw}" y1="${op.center.y}" x2="${op.center.x + hw}" y2="${op.center.y}" stroke="#ffffff" stroke-width="14" />
            <line x1="${op.center.x - hw}" y1="${op.center.y}" x2="${op.center.x - hw}" y2="${op.center.y - op.width}" stroke="#e2e8f0" stroke-width="2" />
            <path d="M ${op.center.x - hw} ${op.center.y - op.width} A ${op.width} ${op.width} 0 0 1 ${op.center.x + hw} ${op.center.y}" fill="none" stroke="#a0aec0" stroke-width="1.5" stroke-dasharray="3,3" />
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
