// src/ai/GeometrySanitizer.ts
// Orthogonal rectification, corner snapping, and geometric cleanup for AI-extracted floor plans

import { FloorPlanData, WallSegment, WallOpening, RoomDefinition, ScaleCalibration } from '../model/types';

export interface RawAiWall {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness?: number;
  isExterior?: boolean;
}

export interface RawAiOpening {
  kind: 'door' | 'window';
  x: number;
  y: number;
  width: number;
  orientation?: 'horizontal' | 'vertical';
  swingDirection?: 'left_in' | 'right_in' | 'left_out' | 'right_out' | 'none';
}

export interface RawAiRoom {
  name: string;
  approxAreaM2?: number;
  centerX: number;
  centerY: number;
  polygon?: { x: number; y: number }[];
}

export interface RawAiFloorPlanResponse {
  scaleEstimate?: {
    detectedScaleText?: string;
    detectedDimensionMeters?: number;
  };
  walls: RawAiWall[];
  openings: RawAiOpening[];
  rooms: RawAiRoom[];
}

export interface SanitizeOptions {
  canvasWidth?: number;  // Target drawing width in mm/units, e.g. 800
  canvasHeight?: number; // Target drawing height in mm/units, e.g. 560
  snapAngleToleranceDeg?: number; // e.g. 5°
  cornerSnapDistance?: number;    // e.g. 10 units
  defaultWallThickness?: number;  // e.g. 16 units
}

/**
 * Snaps angle of a wall to 0°, 45°, 90°, 135°, 180° if within tolerance.
 */
export function snapWallOrientation(
  start: { x: number; y: number },
  end: { x: number; y: number },
  toleranceDeg: number = 6
): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-4) return { start, end };

  let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angleDeg < 0) angleDeg += 360;

  // Candidate standard angles: 0, 45, 90, 135, 180, 225, 270, 315, 360
  const candidateAngles = [0, 45, 90, 135, 180, 225, 270, 315, 360];
  let bestAngle = angleDeg;
  let minDiff = Infinity;

  for (const cand of candidateAngles) {
    const diff = Math.abs(angleDeg - cand);
    if (diff < minDiff && diff <= toleranceDeg) {
      minDiff = diff;
      bestAngle = cand % 360;
    }
  }

  const rad = (bestAngle * Math.PI) / 180;
  return {
    start,
    end: {
      x: Math.round((start.x + len * Math.cos(rad)) * 10) / 10,
      y: Math.round((start.y + len * Math.sin(rad)) * 10) / 10,
    }
  };
}

/**
 * Snaps nearby endpoints to shared intersection corners.
 */
export function snapCorners(walls: WallSegment[], snapDistance: number = 10): WallSegment[] {
  const points: { x: number; y: number }[] = [];

  for (const w of walls) {
    points.push(w.start);
    points.push(w.end);
  }

  // Cluster points that are close to each other
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dist = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
      if (dist <= snapDistance) {
        // Average coordinates
        const avgX = Math.round(((points[i].x + points[j].x) / 2) * 10) / 10;
        const avgY = Math.round(((points[i].y + points[j].y) / 2) * 10) / 10;
        points[i].x = avgX;
        points[i].y = avgY;
        points[j].x = avgX;
        points[j].y = avgY;
      }
    }
  }

  // Re-assign snapped coordinates
  let ptIdx = 0;
  return walls.map((w) => ({
    ...w,
    start: { x: points[ptIdx++].x, y: points[ptIdx - 1].y },
    end: { x: points[ptIdx++].x, y: points[ptIdx - 1].y }
  }));
}

/**
 * Transforms normalized 0..1000 AI coordinates into a clean FloorPlanData structure.
 */
export function sanitizeFloorPlanGeometry(
  raw: RawAiFloorPlanResponse,
  options: SanitizeOptions = {}
): FloorPlanData {
  const targetW = options.canvasWidth ?? 800;
  const targetH = options.canvasHeight ?? 560;
  const margin = 40;
  const usableW = targetW - 2 * margin;
  const usableH = targetH - 2 * margin;

  // Find bounding box of raw walls
  let minX = 1000, maxX = 0, minY = 1000, maxY = 0;
  for (const w of raw.walls) {
    minX = Math.min(minX, w.x1, w.x2);
    maxX = Math.max(maxX, w.x1, w.x2);
    minY = Math.min(minY, w.y1, w.y2);
    maxY = Math.max(maxY, w.y1, w.y2);
  }

  if (minX >= maxX || minY >= maxY) {
    minX = 0; maxX = 1000; minY = 0; maxY = 1000;
  }

  const rawW = maxX - minX;
  const rawH = maxY - minY;
  const scaleFactor = Math.min(usableW / rawW, usableH / rawH);

  const toCanvas = (x: number, y: number) => ({
    x: Math.round((margin + (x - minX) * scaleFactor) * 10) / 10,
    y: Math.round((margin + (y - minY) * scaleFactor) * 10) / 10,
  });

  // 1. Process Walls
  const processedWalls: WallSegment[] = raw.walls.map((w, idx) => {
    const start = toCanvas(w.x1, w.y1);
    const end = toCanvas(w.x2, w.y2);
    const snapped = snapWallOrientation(start, end, options.snapAngleToleranceDeg ?? 6);

    return {
      id: `wall_${idx + 1}`,
      start: snapped.start,
      end: snapped.end,
      thickness: Math.max(8, Math.round((w.thickness ?? 16) * scaleFactor * 0.1) * 2),
      isExterior: !!w.isExterior
    };
  });

  const snappedWalls = snapCorners(processedWalls, options.cornerSnapDistance ?? 10);

  // 2. Process Openings (Doors / Windows)
  const processedOpenings: WallOpening[] = raw.openings.map((op, idx) => {
    const center = toCanvas(op.x, op.y);
    const width = Math.max(16, Math.round(op.width * scaleFactor * 0.8));

    // Find nearest wall
    let nearestWallId: string | undefined;
    let minWallDist = Infinity;
    for (const wall of snappedWalls) {
      // Distance from point to line segment
      const dx = wall.end.x - wall.start.x;
      const dy = wall.end.y - wall.start.y;
      const lenSq = dx * dx + dy * dy;
      let t = lenSq === 0 ? 0 : ((center.x - wall.start.x) * dx + (center.y - wall.start.y) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const projX = wall.start.x + t * dx;
      const projY = wall.start.y + t * dy;
      const dist = Math.hypot(center.x - projX, center.y - projY);
      if (dist < minWallDist) {
        minWallDist = dist;
        nearestWallId = wall.id;
      }
    }

    return {
      id: `opening_${idx + 1}`,
      wallId: nearestWallId,
      kind: op.kind,
      center,
      width,
      swingAngle: op.kind === 'door' ? 90 : undefined,
      swingDirection: op.swingDirection ?? (op.kind === 'door' ? 'left_in' : 'none'),
    };
  });

  // 3. Process Rooms
  const processedRooms: RoomDefinition[] = raw.rooms.map((rm, idx) => {
    const center = toCanvas(rm.centerX, rm.centerY);
    let polygon = rm.polygon?.map(p => toCanvas(p.x, p.y)) ?? [];

    if (polygon.length < 3) {
      // Generate a default rectangular room box around center if polygon was omitted
      const halfSize = 40;
      polygon = [
        { x: center.x - halfSize, y: center.y - halfSize },
        { x: center.x + halfSize, y: center.y - halfSize },
        { x: center.x + halfSize, y: center.y + halfSize },
        { x: center.x - halfSize, y: center.y + halfSize },
      ];
    }

    return {
      id: `room_${idx + 1}`,
      name: rm.name || `Raum ${idx + 1}`,
      code: `+R${idx + 1}`,
      areaM2: rm.approxAreaM2,
      polygon,
    };
  });

  // 4. Scale Calibration
  const scale: ScaleCalibration = {
    scaleRatio: raw.scaleEstimate?.detectedScaleText?.includes('50') ? 50 : 100,
    pixelPerMeter: Math.round(scaleFactor * 80), // Approx. pixel/meter estimate
  };

  return {
    scale,
    walls: snappedWalls,
    openings: processedOpenings,
    rooms: processedRooms,
    circuits: [],
    arcWires: []
  };
}
