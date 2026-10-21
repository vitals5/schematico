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

export interface FitBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SanitizeOptions {
  canvasWidth?: number;  // Target drawing width in mm/units, e.g. 840
  canvasHeight?: number; // Target drawing height in mm/units, e.g. 594
  imageNaturalWidth?: number;
  imageNaturalHeight?: number;
  imageBounds?: FitBounds;
  snapAngleToleranceDeg?: number; // e.g. 5°
  cornerSnapDistance?: number;    // e.g. 8 units
  defaultWallThickness?: number;  // e.g. 3.5 units
}

/**
 * Computes fitted bounding box for an image maintaining its natural aspect ratio.
 */
export function computeImageFitBounds(
  imageWidth: number,
  imageHeight: number,
  targetBox: FitBounds = { x: 30, y: 25, width: 780, height: 530 }
): FitBounds {
  if (imageWidth <= 0 || imageHeight <= 0) {
    return targetBox;
  }
  const imgAspect = imageWidth / imageHeight;
  const boxAspect = targetBox.width / targetBox.height;

  let fitWidth: number;
  let fitHeight: number;

  if (imgAspect > boxAspect) {
    // Image is wider than box -> width is constrained
    fitWidth = targetBox.width;
    fitHeight = Math.round(targetBox.width / imgAspect);
  } else {
    // Image is taller than box -> height is constrained
    fitHeight = targetBox.height;
    fitWidth = Math.round(targetBox.height * imgAspect);
  }

  const fitX = Math.round(targetBox.x + (targetBox.width - fitWidth) / 2);
  const fitY = Math.round(targetBox.y + (targetBox.height - fitHeight) / 2);

  return { x: fitX, y: fitY, width: fitWidth, height: fitHeight };
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

  // Exact axis alignment for 0, 90, 180, 270
  if (bestAngle === 0) {
    return { start, end: { x: Math.round((start.x + len) * 10) / 10, y: start.y } };
  }
  if (bestAngle === 180) {
    return { start, end: { x: Math.round((start.x - len) * 10) / 10, y: start.y } };
  }
  if (bestAngle === 90) {
    return { start, end: { x: start.x, y: Math.round((start.y + len) * 10) / 10 } };
  }
  if (bestAngle === 270) {
    return { start, end: { x: start.x, y: Math.round((start.y - len) * 10) / 10 } };
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
export function snapCorners(walls: WallSegment[], snapDistance: number = 8): WallSegment[] {
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
 * Transforms normalized 0..1000 AI coordinates into a clean FloorPlanData structure,
 * mapped exactly to the background image bounding box.
 */
export function sanitizeFloorPlanGeometry(
  raw: RawAiFloorPlanResponse,
  options: SanitizeOptions = {}
): FloorPlanData {
  const targetW = options.canvasWidth ?? 840;
  const targetH = options.canvasHeight ?? 594;
  const targetBox: FitBounds = {
    x: 30,
    y: 25,
    width: targetW - 60,
    height: targetH - 64
  };

  let bounds: FitBounds;
  if (options.imageBounds) {
    bounds = options.imageBounds;
  } else if (options.imageNaturalWidth && options.imageNaturalHeight) {
    bounds = computeImageFitBounds(options.imageNaturalWidth, options.imageNaturalHeight, targetBox);
  } else {
    // Default fallback: center within drawing area
    bounds = {
      x: 40,
      y: 30,
      width: Math.max(100, targetW - 80),
      height: Math.max(100, targetH - 60)
    };
  }

  // Direct 1-to-1 percentage mapping from normalized [0..1000] to fitted image bounds
  const toCanvas = (x: number, y: number) => ({
    x: Math.round((bounds.x + (x / 1000) * bounds.width) * 10) / 10,
    y: Math.round((bounds.y + (y / 1000) * bounds.height) * 10) / 10,
  });

  // 1. Process Walls
  const processedWalls: WallSegment[] = raw.walls.map((w, idx) => {
    const start = toCanvas(w.x1, w.y1);
    const end = toCanvas(w.x2, w.y2);
    const snapped = snapWallOrientation(start, end, options.snapAngleToleranceDeg ?? 6);

    // Architectural CAD standard line weights:
    // Exterior walls: 3.5 units, Interior partition walls: 2.0 units
    const defaultThickness = w.isExterior ? 3.5 : 2.0;
    const thickness = options.defaultWallThickness ?? (w.thickness ? Math.min(6, Math.max(1.5, w.thickness)) : defaultThickness);

    return {
      id: `wall_${idx + 1}`,
      start: snapped.start,
      end: snapped.end,
      thickness,
      isExterior: !!w.isExterior
    };
  });

  const snappedWalls = snapCorners(processedWalls, options.cornerSnapDistance ?? 8);

  // 2. Process Openings (Doors / Windows)
  const processedOpenings: WallOpening[] = raw.openings.map((op, idx) => {
    const center = toCanvas(op.x, op.y);

    // Find nearest wall
    let nearestWallId: string | undefined;
    let minWallDist = Infinity;
    let nearestWall: WallSegment | undefined;

    for (const wall of snappedWalls) {
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
        nearestWall = wall;
      }
    }

    let orientation = op.orientation;
    if (!orientation && nearestWall) {
      const dx = Math.abs(nearestWall.end.x - nearestWall.start.x);
      const dy = Math.abs(nearestWall.end.y - nearestWall.start.y);
      orientation = dy > dx ? 'vertical' : 'horizontal';
    }

    // Opening width in canvas units:
    let width = op.width;
    if (width > 0 && width <= 200) {
      const refDim = orientation === 'vertical' ? bounds.height : bounds.width;
      width = Math.max(16, Math.min(48, Math.round((width / 1000) * refDim)));
    } else if (width > 200) {
      width = Math.max(16, Math.min(48, Math.round(width * 0.1)));
    } else {
      width = 24;
    }

    return {
      id: `opening_${idx + 1}`,
      wallId: nearestWallId,
      kind: op.kind,
      center,
      width,
      orientation: orientation ?? 'horizontal',
      swingAngle: op.kind === 'door' ? 90 : undefined,
      swingDirection: op.swingDirection ?? (op.kind === 'door' ? 'left_in' : 'none'),
    };
  });

  // 3. Process Rooms
  const processedRooms: RoomDefinition[] = raw.rooms.map((rm, idx) => {
    const center = toCanvas(rm.centerX, rm.centerY);
    let polygon = rm.polygon?.map(p => toCanvas(p.x, p.y)) ?? [];

    if (polygon.length < 3) {
      const halfSize = 36;
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
  const scaleRatio = raw.scaleEstimate?.detectedScaleText?.includes('50') ? 50 : 100;
  const scale: ScaleCalibration = {
    scaleRatio,
    pixelPerMeter: Math.round((bounds.width / 12) * (scaleRatio === 50 ? 2 : 1)),
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
