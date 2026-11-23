import type { Page, PlacedComponent, Project, SymbolDefinition } from "./types";
import { getDrawingUnitsPerMm, getSymbolForComponent } from "./symbols";
import { terminalRowAnchor } from "./LabelLayout";
import {
  terminalIdentity,
  terminalStripKey,
  type TerminalStripIdentity,
} from "./TerminalStripTypes";
import { componentShapes, snapshotPage, usableArea } from "../layout/geometry";
import { contains, overlaps, union, translate } from "../layout/rect";
import type { Rect } from "../layout/types";
import { symbolInsertionPoint } from "./SymbolGeometry";
import { gridForPage, snapCoordinate } from "./DrawingGrid";
import { AutoconnectEngine } from "./AutoconnectEngine";

export const terminalRowSymbolId = (id: string) =>
  /^terminal_feed_[34]$/.test(id) ? id + "_row" : id;
const bounds = (c: PlacedComponent, s: SymbolDefinition, p: Project) =>
  union(componentShapes(c, s, p).map((shape) => shape.rect));
export function horizontalRowPitch(components: PlacedComponent[], p: Project) {
  const u = getDrawingUnitsPerMm(p);
  let left = 0,
    right = 0;
  for (const original of components) {
    const s = getSymbolForComponent(original, p)!;
    const c = {
        ...original,
        x: 0,
        y: 0,
        terminal: {
          ...original.terminal!,
          rowDisplay: "continuation" as const,
        },
      },
      a = terminalRowAnchor(s),
      box = bounds(c, s, p);
    left = Math.max(left, a.x / u - box.x);
    right = Math.max(right, box.x + box.width - a.x / u);
  }
  return Math.max(8, left + right + 2);
}
export function terminalRowPairKeys(page: Page, p: Project) {
  return new Set(
    AutoconnectEngine.findAutoconnectPairs(page.components, 2, 0, p).map(
      (pair) =>
        [
          JSON.stringify([pair.pin1.componentId, pair.pin1.pinId]),
          JSON.stringify([pair.pin2.componentId, pair.pin2.pinId]),
        ]
          .sort()
          .join("|"),
    ),
  );
}
export function sameTerminalRowPairs(a: Set<string>, b: Set<string>) {
  return a.size === b.size && [...a].every((k) => b.has(k));
}

/** One horizontal run per strip/sheet. Extending a run never moves its members.
 * Obstacles and pin axes constrain X; they can never push a member off the Y axis. */
export function horizontalTerminalRow(
  page: Page,
  p: Project,
  identity: TerminalStripIdentity,
  pitch: number,
) {
  const u = getDrawingUnitsPerMm(p),
    grid = gridForPage(page, 4 * u),
    step = grid.spacing / 4,
    area = usableArea(page, p),
    scope = terminalStripKey(identity);
  const existing = page.components
    .filter(
      (c) =>
        c.terminal &&
        terminalStripKey(terminalIdentity(page, c)) === scope &&
        c.rotation === 0 &&
        getSymbolForComponent(c, p)?.terminalDefinition,
    )
    .sort((a, b) => a.x - b.x);
  const anchors = existing.map((c) => {
    const s = getSymbolForComponent(c, p)!,
      a = terminalRowAnchor(s);
    return {
      x: (c.x + a.x * (c.scale ?? 1)) / u,
      y: (c.y + a.y * (c.scale ?? 1)) / u,
    };
  });
  const continuing =
    anchors.length > 0 &&
    anchors.every((a) => Math.abs(a.y - anchors[0].y) < 1e-7);
  if (continuing)
    existing.forEach(
      (c, i) =>
        (c.terminal = {
          ...c.terminal!,
          rowDisplay: i === 0 ? "start" : "continuation",
        }),
    );
  const snapshot = snapshotPage(page, p),
    obstacles: Rect[] = [
      ...snapshot.nodes.map((n) => n.rect),
      ...snapshot.frames.map((f) => f.rect),
      ...snapshot.edges.flatMap((e) =>
        e.points.slice(1).map((pt, i) =>
          union([
            { ...pt, width: 0, height: 0 },
            { ...e.points[i], width: 0, height: 0 },
          ]),
        ),
      ),
    ];
  const pins = AutoconnectEngine.getAllPins(page.components, p);
  let axisY = continuing ? anchors[0].y : undefined,
    cursor = continuing ? anchors.at(-1)!.x : undefined,
    hasHeading = continuing;
  if (continuing && anchors.length > 1)
    pitch = Math.max(pitch, anchors.at(-1)!.x - anchors.at(-2)!.x);
  const stride = (Math.ceil((pitch * u) / step) * step) / u;
  return {
    place(c: PlacedComponent, s: SymbolDefinition) {
      c.terminal = {
        ...c.terminal!,
        rowDisplay: hasHeading ? "continuation" : "start",
      };
      const a = terminalRowAnchor(s),
        local = bounds({ ...c, x: 0, y: 0 }, s, p),
        relativeLeft = local.x - a.x / u;
      const startY =
        axisY ??
        (Math.ceil(
          ((area.y - local.y + a.y / u + 2) * u - grid.origin.y) / step,
        ) *
          step +
          grid.origin.y) /
          u;
      for (
        let y = startY;
        y <= area.y + area.height;
        y += axisY === undefined ? Math.max(2, step / u) : area.height + 1
      ) {
        const startX =
          cursor === undefined ? area.x - relativeLeft + 2 : cursor + stride;
        for (
          let x = startX;
          x <= area.x + area.width;
          x += Math.max(step / u, 1)
        ) {
          const px =
              snapCoordinate(
                x * u - a.x + symbolInsertionPoint(s).x,
                step,
                grid.origin.x,
              ) - symbolInsertionPoint(s).x,
            py = y * u - a.y,
            box = translate(local, px / u, py / u);
          if (
            !contains(area, box) ||
            obstacles.some((r) => overlaps(r, box, 1))
          )
            continue;
          c.x = px;
          c.y = py;
          const candidate = s.pins.map((pin) =>
            AutoconnectEngine.getRotatedPinInfo(c, pin, s),
          );
          if (
            candidate.some((one) =>
              pins.some((two) => {
                const vertical = (d: string) => d === "top" || d === "bottom";
                return (
                  vertical(one.direction) === vertical(two.direction) &&
                  Math.abs(
                    vertical(one.direction)
                      ? one.worldX - two.worldX
                      : one.worldY - two.worldY,
                  ) <=
                    2 + 1e-8
                );
              }),
            )
          )
            continue;
          page.components.push(c);
          obstacles.push(box);
          pins.push(...candidate);
          cursor = (c.x + a.x) / u;
          axisY = y;
          hasHeading = true;
          return true;
        }
      }
      return false;
    },
  };
}
