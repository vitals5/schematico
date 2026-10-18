// src/model/AutoconnectEngine.ts
// Schematico Autoconnecting Engine
// Automatically detects and forms orthogonal electrical connections between aligned pins

import { PlacedComponent, PinDefinition, SymbolDefinition, Wire, Page, Project } from './types';
import { getSymbolForComponent } from './symbols';
import { rotatedLocalPoint } from './SymbolGeometry';

export interface RotatedPinInfo {
  componentId: string;
  pinId: string;
  pinName: string;
  worldX: number;
  worldY: number;
  direction: 'top' | 'bottom' | 'left' | 'right';
}

export interface AutoconnectPair {
  pin1: RotatedPinInfo;
  pin2: RotatedPinInfo;
  orientation: 'vertical' | 'horizontal';
  distance: number;
}

export interface AutoconnectPreviewSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  targetX: number;
  targetY: number;
  orientation: 'vertical' | 'horizontal';
}

export class AutoconnectEngine {
  private static readonly MAX_AUTOCONNECT_DISTANCE = 800; // max distance in px along grid line

  /**
   * Calculates world coordinates and effective rotated direction of a pin.
   * Rotation center is (sym.width / 2, sym.height / 2).
   */
  public static getRotatedPinInfo(
    comp: PlacedComponent,
    pinDef: PinDefinition,
    sym: SymbolDefinition
  ): RotatedPinInfo {
    const rot = comp.rotation || 0;
    const local = rotatedLocalPoint(pinDef, sym, rot);
    const dirs: PinDefinition['direction'][] = ['top', 'right', 'bottom', 'left'];
    return { componentId: comp.id, pinId: pinDef.id, pinName: pinDef.name,
      worldX: comp.x + local.x, worldY: comp.y + local.y,
      direction: dirs[(dirs.indexOf(pinDef.direction) + Math.round(rot / 90) + 4) % 4] };
  }

  /**
   * Extracts all active pins with world coordinates and rotated directions from a list of components.
   */
  public static getAllPins(components: PlacedComponent[], project?: Project): RotatedPinInfo[] {
    const pins: RotatedPinInfo[] = [];
    for (const comp of components) {
      if (comp.source?.routingUsed === false) continue;
      const sym = getSymbolForComponent(comp, project);
      if (!sym) continue;
      for (const pinDef of sym.pins) {
        pins.push(this.getRotatedPinInfo(comp, pinDef, sym));
      }
    }
    return pins;
  }

  /**
   * Clusters pins into groups where coordinate difference is within tolerance (default <= 2px).
   * Ensures components on half-raster or with subpixel differences connect reliably.
   */
  private static clusterPins(
    pins: RotatedPinInfo[],
    getCoord: (p: RotatedPinInfo) => number,
    tolerance: number = 2
  ): RotatedPinInfo[][] {
    const sorted = [...pins].sort((a, b) => getCoord(a) - getCoord(b));
    const clusters: RotatedPinInfo[][] = [];

    for (const pin of sorted) {
      const val = getCoord(pin);
      let added = false;
      if (clusters.length > 0) {
        const lastCluster = clusters[clusters.length - 1];
        const baseCoord = getCoord(lastCluster[0]);
        if (Math.abs(val - baseCoord) <= tolerance) {
          lastCluster.push(pin);
          added = true;
        }
      }
      if (!added) {
        clusters.push([pin]);
      }
    }
    return clusters;
  }

  /**
   * Finds all valid autoconnect pairs:
   * - Vertical: pin1.x === pin2.x (with tolerance <= 2px), pin1 points 'bottom', pin2 points 'top', no intermediate pins
   * - Horizontal: pin1.y === pin2.y (with tolerance <= 2px), pin1 points 'right', pin2 points 'left', no intermediate pins
   */
  public static findAutoconnectPairs(components: PlacedComponent[], tolerance = 2, minimumDistance = 8, project?: Project): AutoconnectPair[] {
    const allPins = this.getAllPins(components, project);
    const pairs: AutoconnectPair[] = [];

    // Group pins by X (for vertical connections) with tolerance <= 2px
    const verticalClusters = this.clusterPins(allPins, p => p.worldX, tolerance);
    // Group pins by Y (for horizontal connections) with tolerance <= 2px
    const horizontalClusters = this.clusterPins(allPins, p => p.worldY, tolerance);

    const connect = (clusters: RotatedPinInfo[][], vertical: boolean) => {
      const forward = vertical ? 'bottom' : 'right', backward = vertical ? 'top' : 'left';
      const coordinate = (p: RotatedPinInfo) => vertical ? p.worldY : p.worldX;
      for (const cluster of clusters) {
        const pins = cluster.filter(p => p.direction === forward || p.direction === backward).sort((a, b) => coordinate(a) - coordinate(b));
        const positions: RotatedPinInfo[][] = [];
        for (const pin of pins) {
          const last = positions.at(-1);
          if (last && Math.abs(coordinate(last[0]) - coordinate(pin)) < 1e-6) last.push(pin);
          else positions.push([pin]);
        }
        for (let i = 1; i < positions.length; i++) {
          const distance = coordinate(positions[i][0]) - coordinate(positions[i - 1][0]);
          if (distance < minimumDistance || distance > this.MAX_AUTOCONNECT_DISTANCE) continue;
          for (const a of positions[i - 1].filter(p => p.direction === forward))
            for (const b of positions[i].filter(p => p.direction === backward))
              if (a.componentId !== b.componentId) pairs.push({ pin1: a, pin2: b,
                orientation: vertical ? 'vertical' : 'horizontal', distance });
        }
      }
    };
    connect(verticalClusters, true); connect(horizontalClusters, false);

    return pairs;
  }

  /**
   * Recalculates all autoconnections for a page.
   * Manual wires (isAutoconnect !== true) are preserved.
   * Obsolete autoconnections are cleared; valid new ones are added.
   */
  public static updatePageAutoconnections(page: Page): void {
    // Native native CAD pages already own an explicit connection graph, including bundles.
    if (page.importedDrawing) return;
    const manualWires = page.wires.filter(w => !w.isAutoconnect);
    const existingAutoWires = page.wires.filter(w => w.isAutoconnect);

    // Existing manual wire map for fast lookup: key = minComp:pin|maxComp:pin
    const manualWireSet = new Set<string>();
    for (const w of manualWires) {
      const k1 = `${w.from.componentId}:${w.from.pinId}|${w.to.componentId}:${w.to.pinId}`;
      const k2 = `${w.to.componentId}:${w.to.pinId}|${w.from.componentId}:${w.from.pinId}`;
      manualWireSet.add(k1);
      manualWireSet.add(k2);
    }

    const pairs = this.findAutoconnectPairs(page.components, page.grid ? 1e-6 : 2, page.grid ? page.grid.spacing / 4 : 8);
    const importedIds = new Set(page.connectionMode === 'explicit' ? page.components.filter(c => c.source?.format === 'NATIVE_CAD').map(c => c.id) : []);
    const newAutoWires: Wire[] = [];

    for (const pair of pairs) {
      // Preserve the imported graph while allowing normal new placements to autoconnect.
      if (importedIds.has(pair.pin1.componentId) && importedIds.has(pair.pin2.componentId)) continue;
      const key1 = `${pair.pin1.componentId}:${pair.pin1.pinId}|${pair.pin2.componentId}:${pair.pin2.pinId}`;
      const key2 = `${pair.pin2.componentId}:${pair.pin2.pinId}|${pair.pin1.componentId}:${pair.pin1.pinId}`;

      // Check if user manually disconnected / suppressed this autoconnection
      if (page.suppressedAutoconnections && (page.suppressedAutoconnections.includes(key1) || page.suppressedAutoconnections.includes(key2))) {
        continue;
      }

      if (manualWireSet.has(key1) || manualWireSet.has(key2)) {
        // User already drew a manual wire here; do not duplicate
        continue;
      }

      // Check if we already have an autowire for this pair to keep its ID and attributes
      const existing = existingAutoWires.find(w =>
        (w.from.componentId === pair.pin1.componentId && w.from.pinId === pair.pin1.pinId &&
         w.to.componentId === pair.pin2.componentId && w.to.pinId === pair.pin2.pinId) ||
        (w.from.componentId === pair.pin2.componentId && w.from.pinId === pair.pin2.pinId &&
         w.to.componentId === pair.pin1.componentId && w.to.pinId === pair.pin1.pinId)
      );

      const potentialInfo = this.inferPotential(pair.pin1, pair.pin2);

      if (existing) {
        newAutoWires.push(existing);
      } else {
        newAutoWires.push({
          id: 'auto_w_' + Math.random().toString(36).substring(2, 9),
          from: {
            componentId: pair.pin1.componentId,
            pinId: pair.pin1.pinId
          },
          to: {
            componentId: pair.pin2.componentId,
            pinId: pair.pin2.pinId
          },
          potential: potentialInfo.potential,
          color: potentialInfo.color,
          crossSection: '1.5mm²',
          ...(page.grid ? { lineWidth: page.grid.spacing / 16 } : {}),
          isAutoconnect: true
        });
      }
    }

    page.wires = [...manualWires, ...newAutoWires];
  }

  /**
   * Generates live autoconnect preview lines for a component being dragged or placed.
   */
  public static getAutoconnectPreview(
    existingComponents: PlacedComponent[],
    activeComp: PlacedComponent,
    page?: Page
  ): AutoconnectPreviewSegment[] {
    const tolerance = page?.grid ? 1e-6 : 2;
    const minimumDistance = page?.grid ? page.grid.spacing / 4 : 8;
    const sym = getSymbolForComponent(activeComp);
    if (!sym) return [];

    const activePins = sym.pins.map(p => this.getRotatedPinInfo(activeComp, p, sym));
    // Filter out the activeComp if it already exists in existingComponents
    const otherComps = existingComponents.filter(c => c.id !== activeComp.id);
    const otherPins = this.getAllPins(otherComps);

    const previews: AutoconnectPreviewSegment[] = [];

    for (const aPin of activePins) {
      if (aPin.direction === 'top' || aPin.direction === 'bottom') {
        // Look for matching pins on same X
        // Look for matching pins on same X (tolerance <= 2px)
        const candidates = otherPins
          .filter(p => Math.abs(p.worldX - aPin.worldX) <= tolerance)
          .sort((a, b) => a.worldY - b.worldY);

        if (aPin.direction === 'top') {
          // Needs pin above us facing 'bottom'
          const above = candidates.filter(p => p.worldY < aPin.worldY && p.direction === 'bottom');
          if (above.length > 0) {
            const nearest = above[above.length - 1]; // closest above
            const dist = aPin.worldY - nearest.worldY;
            if (dist >= minimumDistance && dist <= this.MAX_AUTOCONNECT_DISTANCE) {
              previews.push({
                x1: aPin.worldX,
                y1: aPin.worldY,
                x2: aPin.worldX,
                y2: nearest.worldY,
                targetX: nearest.worldX,
                targetY: nearest.worldY,
                orientation: 'vertical'
              });
            }
          }
        } else if (aPin.direction === 'bottom') {
          // Needs pin below us facing 'top'
          const below = candidates.filter(p => p.worldY > aPin.worldY && p.direction === 'top');
          if (below.length > 0) {
            const nearest = below[0]; // closest below
            const dist = nearest.worldY - aPin.worldY;
            if (dist >= minimumDistance && dist <= this.MAX_AUTOCONNECT_DISTANCE) {
              previews.push({
                x1: aPin.worldX,
                y1: aPin.worldY,
                x2: aPin.worldX,
                y2: nearest.worldY,
                targetX: nearest.worldX,
                targetY: nearest.worldY,
                orientation: 'vertical'
              });
            }
          }
        }
      } else if (aPin.direction === 'left' || aPin.direction === 'right') {
        // Look for matching pins on same Y (tolerance <= 2px)
        const candidates = otherPins
          .filter(p => Math.abs(p.worldY - aPin.worldY) <= tolerance)
          .sort((a, b) => a.worldX - b.worldX);

        if (aPin.direction === 'left') {
          // Needs pin to the left facing 'right'
          const leftOf = candidates.filter(p => p.worldX < aPin.worldX && p.direction === 'right');
          if (leftOf.length > 0) {
            const nearest = leftOf[leftOf.length - 1]; // closest left
            const dist = aPin.worldX - nearest.worldX;
            if (dist >= minimumDistance && dist <= this.MAX_AUTOCONNECT_DISTANCE) {
              previews.push({
                x1: aPin.worldX,
                y1: aPin.worldY,
                x2: nearest.worldX,
                y2: aPin.worldY,
                targetX: nearest.worldX,
                targetY: nearest.worldY,
                orientation: 'horizontal'
              });
            }
          }
        } else if (aPin.direction === 'right') {
          // Needs pin to the right facing 'left'
          const rightOf = candidates.filter(p => p.worldX > aPin.worldX && p.direction === 'left');
          if (rightOf.length > 0) {
            const nearest = rightOf[0]; // closest right
            const dist = nearest.worldX - aPin.worldX;
            if (dist >= minimumDistance && dist <= this.MAX_AUTOCONNECT_DISTANCE) {
              previews.push({
                x1: aPin.worldX,
                y1: aPin.worldY,
                x2: nearest.worldX,
                y2: aPin.worldY,
                targetX: nearest.worldX,
                targetY: nearest.worldY,
                orientation: 'horizontal'
              });
            }
          }
        }
      }
    }

    return previews;
  }

  /**
   * Infers wire potential and color from connected pin names.
   */
  public static inferPotential(pin1: RotatedPinInfo, pin2: RotatedPinInfo): { potential: string; color: string } {
    const names = [pin1.pinName.toUpperCase(), pin2.pinName.toUpperCase(), pin1.pinId.toUpperCase(), pin2.pinId.toUpperCase()];

    if (names.some(n => n === 'PE' || n === 'GND')) {
      return { potential: 'PE', color: 'GNYE' };
    }
    if (names.some(n => n === '+24V' || n === '24V' || n === '+')) {
      return { potential: '+24V', color: 'RD' };
    }
    if (names.some(n => n === '0V' || n === '-' || n === 'M' || n === 'A2')) {
      return { potential: '0V', color: 'BU' };
    }
    if (names.some(n => n === 'N')) {
      return { potential: 'N', color: 'BU' };
    }
    if (names.some(n => n === 'L1' || n === 'U1' || n === 'U')) {
      return { potential: 'L1', color: 'BK' };
    }
    if (names.some(n => n === 'L2' || n === 'V1' || n === 'V')) {
      return { potential: 'L2', color: 'BK' };
    }
    if (names.some(n => n === 'L3' || n === 'W1' || n === 'W')) {
      return { potential: 'L3', color: 'BK' };
    }
    if (names.some(n => ['11', '12', '13', '14', '21', '22', 'A1', 'X1', 'X2'].includes(n))) {
      return { potential: '+24V', color: 'RD' };
    }
    if (names.some(n => n === '1' || n === '2')) {
      return { potential: 'L1', color: 'BK' };
    }
    if (names.some(n => n === '3' || n === '4')) {
      return { potential: 'L2', color: 'BK' };
    }
    if (names.some(n => n === '5' || n === '6')) {
      return { potential: 'L3', color: 'BK' };
    }
    return { potential: 'Signal', color: 'BK' };
  }

  /**
   * Suppresses an autoconnection so deleting/disconnecting it keeps it disconnected.
   */
  public static suppressAutoconnection(page: Page, wire: Wire): void {
    if (!page.suppressedAutoconnections) {
      page.suppressedAutoconnections = [];
    }
    const key = `${wire.from.componentId}:${wire.from.pinId}|${wire.to.componentId}:${wire.to.pinId}`;
    if (!page.suppressedAutoconnections.includes(key)) {
      page.suppressedAutoconnections.push(key);
    }
  }

  /**
   * Clears any suppressions for a component when it moves, allowing it to reconnect at its new position.
   */
  public static clearSuppressedForComponent(page: Page, componentId: string): void {
    if (!page.suppressedAutoconnections) return;
    page.suppressedAutoconnections = page.suppressedAutoconnections.filter(key => !key.includes(componentId));
  }
}

