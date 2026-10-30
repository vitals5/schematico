import { pinStub } from './router';
import { componentInsertionPoint } from '../model/SymbolGeometry';
import { boxDrawing } from '../model/DeviceBox';
import { cableDrawing } from '../model/CableDefinition';
import type {
  Page,
  Project,
  PlacedComponent,
  SymbolDefinition,
} from '../model/types';
import { getDrawingUnitsPerMm, getSymbolForComponent } from '../model/symbols';
import {
  computeBmkPosition,
  computeFunctionTextPosition,
  computeTechnicalDataPosition,
  computeAdditionalTextPosition,
  computeCrossReferencePosition,
  computePinLabelPosition,
  type CalculatedLabelPosition,
} from '../model/LabelLayout';
import {
  interruptionLabelPosition,
  isInterruptionSymbol,
  connectionFamily,
} from '../model/ConnectionSymbols';
import { splitCrossReferenceLines } from '../model/CrossReferenceNavigation';
import { AutoconnectEngine } from '../model/AutoconnectEngine';
import { defaultPlotFrame } from '../model/PlotFrame';
import { wirePolyline, wirePinDirection } from '../model/WireRouting';
import { gridForPage } from '../model/DrawingGrid';
import type {
  LayoutSnapshot,
  LayoutOptions,
  Shape,
  Rect,
  Point,
  LayoutFrame,
} from './types';
import { right, bottom, contains, overlaps, union, translate } from './rect';
export { right, bottom, contains, overlaps, union, translate } from './rect';
const rotate = (p: Point, a: number, c: Point = { x: 0, y: 0 }): Point => {
  const t = (a * Math.PI) / 180,
    dx = p.x - c.x,
    dy = p.y - c.y;
  return {
    x: c.x + dx * Math.cos(t) - dy * Math.sin(t),
    y: c.y + dx * Math.sin(t) + dy * Math.cos(t),
  };
};
const rectPoints = (r: Rect) => [
  { x: r.x, y: r.y },
  { x: right(r), y: r.y },
  { x: right(r), y: bottom(r) },
  { x: r.x, y: bottom(r) },
];
const envelope = (ps: Point[]): Rect =>
  union(ps.map((p) => ({ ...p, width: 0, height: 0 })));
let measureSvg: SVGSVGElement | undefined;
/** Actual SVG glyph metrics in browsers, conservative deterministic metrics for headless API use. */
export function textRect(
  text: string,
  size: number,
  font: string,
  anchor: string = 'start',
  weight = 'normal',
  lineHeight = 1.2,
): Rect {
  const lines = text.split(/\r?\n/);
  let width = 0,
    top = -size * 0.9,
    height = size * 1.2;
  if (typeof document !== 'undefined') {
    measureSvg ??= document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg',
    );
    measureSvg.style.cssText =
      'position:fixed;left:-100000px;top:0;visibility:hidden;overflow:visible';
    document.body.appendChild(measureSvg);
    const el = document.createElementNS(
      measureSvg.namespaceURI,
      'text',
    ) as SVGTextElement;
    el.setAttribute('font-size', String(size));
    el.setAttribute('font-family', font);
    el.setAttribute('font-weight', weight);
    measureSvg.appendChild(el);
    for (const line of lines) {
      el.textContent = line || ' ';
      const b = el.getBBox();
      width = Math.max(width, b.width);
      top = Math.min(top, b.y);
      height = Math.max(height, b.height);
    }
    el.remove();
  } else
    width = Math.max(
      0,
      ...lines.map((l) =>
        [...l].reduce(
          (n, c) =>
            n +
            size *
              (font === 'monospace'
                ? 0.63
                : /[MW@%]/.test(c)
                  ? 0.95
                  : /[ilI., :/]/.test(c)
                    ? 0.33
                    : 0.63),
          0,
        ),
      ),
    );
  return {
    x:
      anchor === 'end'
        ? -width
        : anchor === 'middle' || anchor === 'center'
          ? -width / 2
          : 0,
    y: top,
    width,
    height: height + (lines.length - 1) * size * lineHeight,
  };
}
export function componentShapes(
  comp: PlacedComponent,
  sym: SymbolDefinition,
  project: Project,
): Shape[] {
  const u = getDrawingUnitsPerMm(project),
    center = { x: sym.width / 2, y: sym.height / 2 };
  const world = (p: Point) => {
    const q = rotate(p, comp.rotation, center);
    return { x: (q.x + comp.x) / u, y: (q.y + comp.y) / u };
  };
  const body = envelope(
    rectPoints({ x: 0, y: 0, width: sym.width, height: sym.height }).map(world),
  );
  const shapes: Shape[] = [
    {
      id: comp.id + ':body',
      owner: comp.id,
      kind: comp.deviceBox ? 'frame' : 'body',
      rect: body,
    },
  ];
  const label = (
    key: string,
    text: string,
    pos: CalculatedLabelPosition,
    font: string,
    weight = 'normal',
    pinId?: string,
  ) => {
    if (!text || !pos.visible) return;
    const r = textRect(
        text,
        pos.fontSize,
        font,
        pos.anchor,
        weight,
        key === 'crossRef' ? 1.4 : 1.2,
      ),
      anchor = world(pos);
    const bounds = envelope(
      rectPoints(r).map((p) => {
        const q = rotate(p, pos.rotation);
        return { x: anchor.x + q.x / u, y: anchor.y + q.y / u };
      }),
    );
    shapes.push({
      id: comp.id + ':' + key,
      owner: comp.id,
      kind: pinId ? 'pin_label' : 'label',
      rect: bounds,
      text: {
        value: text,
        anchor,
        rotation: pos.rotation,
        size: pos.fontSize / u,
        font,
        align: pos.anchor,
        weight,
      },
      ...(pinId ? { pinId } : {}),
    });
  };
  const conn =
    isInterruptionSymbol(sym) ||
    (!sym.importedGraphics &&
      (sym.category === 'connections' ||
        sym.id.startsWith('potential_arrow') ||
        sym.id === 'potential_rail_source'));
  const bmk = computeBmkPosition(comp, sym),
    fn = computeFunctionTextPosition(comp, sym);
  if (!conn && sym.id !== 'terminal_single') {
    label('bmk', comp.bmk, bmk, 'monospace', 'bold');
    label('function', comp.functionText, fn, 'sans-serif', fn.fontWeight);
    label(
      'technical',
      [comp.deviceTag, comp.technicalCharacteristics]
        .filter(Boolean)
        .join(' · '),
      computeTechnicalDataPosition(comp, sym),
      'sans-serif',
    );
  } else if (sym.id === 'terminal_single') {
    label('bmk', comp.bmk, bmk, 'monospace', 'bold');
    label(
      'terminal',
      comp.deviceTag ||
        comp.technicalCharacteristics ||
        comp.functionText ||
        '1',
      {
        ...fn,
        x: sym.width + 2,
        y: sym.height / 2 + 3,
        fontSize: comp.pinLabelFontSize ?? 7.5,
        anchor: 'start',
        rotation: 0,
        visible: true,
      },
      'monospace',
      'bold',
    );
  } else if (isInterruptionSymbol(sym) || sym.id === 'potential_rail_source') {
    const arrow = interruptionLabelPosition(project, comp, sym);
    label(
      'function',
      comp.functionText || comp.bmk,
      {
        ...fn,
        ...(arrow ?? { x: -4, y: sym.height / 2 + 3, anchor: 'end' as const }),
        fontSize: sym.source
          ? fn.fontSize
          : (comp.functionTextPosition?.fontSize ?? 8.5),
        visible: comp.functionTextPosition?.visible !== false,
      },
      sym.source ? 'sans-serif' : 'monospace',
      'bold',
    );
  }
  label(
    'additional',
    comp.additionalText ?? '',
    computeAdditionalTextPosition(comp, sym),
    'sans-serif',
  );
  if (!conn || isInterruptionSymbol(sym))
    label(
      'crossRef',
      splitCrossReferenceLines(comp.crossRef ?? '').join('\n'),
      computeCrossReferencePosition(comp, sym, project),
      'monospace',
    );
  for (const pin of sym.pins) {
    const pos = computePinLabelPosition(comp, sym, pin);
    label(
      'pin:' + pin.id,
      comp.pins[pin.id]?.customLabel ?? pin.name,
      pos,
      sym.source || pin.labelPosition || comp.pins[pin.id]?.labelPosition
        ? 'Tahoma, Arial, sans-serif'
        : 'monospace',
      'normal',
      pin.id,
    );
  }
  return shapes;
}
export function usableArea(page: Page, project: Project): Rect {
  const u = getDrawingUnitsPerMm(project),
    w = page.plotFrame.width / u,
    h = page.plotFrame.height / u;
  const template =
    project.plotFrameTemplate ?? defaultPlotFrame(project.language);
  // The renderer fits the physical template to the actual page dimensions.
  const sx = w / template.width,
    sy = h / template.height;
  const bars = template.graphics
    .filter(
      (g) =>
        g.kind === 'line' &&
        Math.abs(g.y1 - g.y2) < 1e-6 &&
        Math.abs(g.x2 - g.x1) > 0.8 * template.width &&
        g.y1 > template.height * 0.7,
    )
    .map((g) => (g.kind === 'line' ? g.y1 * sy : h));
  const footer = bars.length ? Math.min(...bars) : h - 16 * sy;
  return { x: 5 * sx, y: 8 * sy, width: w - 10 * sx, height: footer - 11 * sy };
}
export function snapshotPage(
  page: Page,
  project: Project,
  options: LayoutOptions = {},
): LayoutSnapshot {
  const u = getDrawingUnitsPerMm(project),
    grid = gridForPage(page),
    saved = page.layoutConstraints ?? {};
  const locked = new Set(options.lockedIds ?? saved.lockedIds ?? []),
    selected = options.selectedIds ? new Set(options.selectedIds) : undefined;
  const snapshot: LayoutSnapshot = {
    pageId: page.id,
    area: usableArea(page, project),
    nodes: [],
    frames: [],
    edges: [],
    grid: {
      spacing: grid.spacing / u,
      origin: { x: grid.origin.x / u, y: grid.origin.y / u },
    },
    issues: [],
  };
  if (typeof document === 'undefined')
    snapshot.issues.push({
      type: 'estimated_text_metrics',
      severity: 'warning',
      objectIds: [],
      message:
        'Textmaße außerhalb des Browsers konservativ geschätzt. Die Übernahme prüft mit tatsächlichen Schriftmetriken.',
    });
  if (page.importedDrawing)
    snapshot.issues.push({
      type: 'flattened_drawing',
      severity: 'error',
      objectIds: [page.id],
      message:
        'Flache Altzeichnung kann nicht verlustfrei automatisch angeordnet werden.',
    });
  const ids = new Set<string>();
  const unique = (id: string) => {
    if (ids.has(id))
      snapshot.issues.push({
        type: 'duplicate_id',
        severity: 'error',
        objectIds: [id],
        message: 'Doppelte Objekt-ID.',
      });
    ids.add(id);
  };
  for (const comp of page.components) {
    unique(comp.id);
    if (comp.scale !== undefined && comp.scale !== 1)
      snapshot.issues.push({
        type: 'scaled_symbol',
        severity: 'error',
        objectIds: [comp.id],
        message:
          'Individuell skalierte Symbole benötigen eine eindeutige Anschlussgeometrie. Layout nicht übernommen.',
      });
    const sym = getSymbolForComponent(comp, project);
    if (!sym) {
      snapshot.issues.push({
        type: 'missing_symbol',
        severity: 'error',
        objectIds: [comp.id],
        message: 'Bibliothekssymbol fehlt.',
      });
      continue;
    }
    const shapes = componentShapes(comp, sym, project),
      rect = union(shapes.map((s) => s.rect));
    if (comp.deviceBox && !saved.fixedFrameIds?.includes(comp.id)) {
      snapshot.frames.push({
        id: comp.id,
        kind: 'component',
        members: [],
        fixed: locked.has(comp.id),
        rect: shapes[0].rect,
        shapes,
      });
      continue;
    }
    const pins = sym.pins.map((pin) => {
      const p = AutoconnectEngine.getRotatedPinInfo(comp, pin, sym);
      return {
        id: pin.id,
        x: p.worldX / u,
        y: p.worldY / u,
        direction: p.direction,
      };
    });
    snapshot.nodes.push({
      id: comp.id,
      kind: 'component',
      circuitRole: sym.layoutRole,
      handover: isInterruptionSymbol(sym),
      routingJunction: ['corners', 'tees', 'crossings'].includes(connectionFamily(sym)),
      joinedPins:
        ['corners', 'tees', 'interruptions'].includes(connectionFamily(sym)) ||
        sym.id === 'terminal_single' ||
        (sym.id === 'cross_junction' || sym.id.startsWith('cross_junction_bus_'))
          ? [pins.map((p) => p.id)]
          : undefined,
      insertion: {
        x: componentInsertionPoint(comp, sym).x / u,
        y: componentInsertionPoint(comp, sym).y / u,
      },
      origin: { x: comp.x / u, y: comp.y / u },
      rect,
      shapes,
      pins,
      fixed: locked.has(comp.id) || (!!selected && !selected.has(comp.id)),
    });
  }
  // Reserve the mandatory port escape corridor before packing near the sheet boundary.
  for (const node of snapshot.nodes) {
    node.rect = union([
      node.rect,
      ...node.pins.map((pin) => ({
        ...pinStub(snapshot, pin, node.id),
        width: 0,
        height: 0,
      })),
    ]);
  }
  for (const t of page.texts ?? []) {
    unique(t.id);
    const size = t.fontSize ?? 10,
      r = textRect(
        t.text,
        size,
        t.fontFamily ?? 'sans-serif',
        t.align ?? 'start',
        t.fontWeight,
      ),
      rect = envelope(
        rectPoints(r).map((p) => {
          const q = rotate(p, t.rotation ?? 0);
          return { x: (t.x + q.x) / u, y: (t.y + q.y) / u };
        }),
      );
    snapshot.nodes.push({
      id: t.id,
      kind: 'text',
      origin: { x: t.x / u, y: t.y / u },
      rect,
      shapes: [{ id: t.id, owner: t.id, kind: 'obstacle', rect }],
      pins: [],
      fixed: true,
    });
  }
  for (const image of page.images ?? []) {
    unique(image.id);
    const rect = {
      x: image.x / u,
      y: image.y / u,
      width: image.width / u,
      height: image.height / u,
    };
    snapshot.nodes.push({
      id: image.id,
      kind: 'image',
      origin: { x: rect.x, y: rect.y },
      rect,
      shapes: [{ id: image.id, owner: image.id, kind: 'obstacle', rect }],
      pins: [],
      fixed: true,
    });
  }
  const drawingText = (
    owner: string,
    g: Extract<import('../model/types').DrawingPrimitive, { kind: 'text' }>,
  ): Shape => {
    const raw = textRect(g.text, g.size, 'sans-serif', g.anchor ?? 'start'),
      rect = envelope(
        rectPoints(raw).map((p) => {
          const q = rotate(p, g.rotation ?? 0);
          return { x: (g.x + q.x) / u, y: (g.y + q.y) / u };
        }),
      );
    return {
      id: owner + ':text:' + g.x + ':' + g.y,
      owner,
      kind: 'label',
      rect,
      text: {
        value: g.text,
        anchor: { x: g.x / u, y: g.y / u },
        rotation: g.rotation ?? 0,
        size: g.size / u,
        font: 'sans-serif',
        align: g.anchor ?? 'start',
        weight: 'normal',
      },
    };
  };
  for (const cable of page.cables ?? []) {
    unique(cable.id);
    const a = { x: cable.start.x / u, y: cable.start.y / u },
      b = { x: cable.end.x / u, y: cable.end.y / u },
      shapes: Shape[] = cableDrawing(cable, page, project)
        .filter((g) => g.kind === 'text')
        .map((g) =>
          drawingText(cable.id, g as Extract<typeof g, { kind: 'text' }>),
        );
    const rect = union([envelope([a, b]), ...shapes.map((s) => s.rect)]);
    snapshot.nodes.push({
      id: cable.id,
      kind: 'cable',
      origin: a,
      rect,
      shapes,
      pins: [],
      fixed: true,
    });
  }
  for (const box of page.boxes ?? []) {
    unique(box.id);
    snapshot.frames.push({
      id: box.id,
      kind: 'box',
      members: [],
      fixed: locked.has(box.id),
      rect: {
        x: box.x / u,
        y: box.y / u,
        width: box.width / u,
        height: box.height / u,
      },
      shapes: boxDrawing(box)
        .filter((g) => g.kind === 'text')
        .map((g) =>
          drawingText(box.id, g as Extract<typeof g, { kind: 'text' }>),
        ),
    });
  }
  const constraints = options.containerMembers ?? saved.containerMembers ?? {};
  for (const frame of snapshot.frames) {
    frame.members =
      constraints[frame.id] ??
      snapshot.nodes
        .filter((n) => contains(frame.rect, n.shapes[0]?.rect ?? n.rect))
        .map((n) => n.id);
  }
  for (const group of page.groups ?? []) {
    unique(group.id);
    snapshot.frames.push({
      id: group.id,
      kind: 'group',
      rigid: !!group.source,
      members: group.members.map((m) => m.id),
      fixed: locked.has(group.id),
      rect: { x: 0, y: 0, width: 0, height: 0 },
    });
  }
  for (const node of snapshot.nodes) {
    const parents = snapshot.frames.filter((f) => f.members.includes(node.id));
    const configured = parents.filter(
      (f) => f.kind !== 'group' && constraints[f.id]?.includes(node.id),
    );
    const explicit = parents.filter((f) => f.kind === 'group'),
      candidates = configured.length
        ? configured
        : explicit.length
          ? explicit
          : parents;
    candidates.sort(
      (a, b) =>
        a.rect.width * a.rect.height - b.rect.width * b.rect.height ||
        a.id.localeCompare(b.id),
    );
    if (
      candidates.length > 1 &&
      !explicit.length &&
      !contains(candidates[1].rect, candidates[0].rect)
    )
      snapshot.issues.push({
        type: 'ambiguous_container',
        severity: 'error',
        objectIds: [node.id, ...candidates.map((f) => f.id)],
        message: 'Gerätekastenzuordnung ist mehrdeutig.',
      });
    if (candidates[0]) {
      node.parent = candidates[0].id;
      if (node.kind !== 'component' && !locked.has(node.id))
        node.fixed = !!selected && !selected.has(node.id);
    }
  }
  // Nested explicit groups; cycles and missing members are errors, never guessed.
  for (const frame of snapshot.frames) {
    for (const id of frame.members)
      if (
        !snapshot.nodes.some((n) => n.id === id) &&
        !snapshot.frames.some((f) => f.id === id) &&
        !page.wires.some((w) => w.id === id)
      )
        snapshot.issues.push({
          type: 'missing_group_member',
          severity: 'error',
          objectIds: [frame.id, id],
          message: 'Gruppenmitglied fehlt.',
        });
  }
  const descendants = (id: string, seen = new Set<string>()): string[] => {
    if (seen.has(id)) {
      snapshot.issues.push({
        type: 'group_cycle',
        severity: 'error',
        objectIds: [id],
        message: 'Zyklische Gruppe.',
      });
      return [];
    }
    const f = snapshot.frames.find((f) => f.id === id);
    if (!f) return [id];
    return f.members.flatMap((m) => descendants(m, new Set([...seen, id])));
  };
  if (selected) {
    for (let changed = true; changed;) {
      changed = false;
      for (const f of snapshot.frames)
        if (selected.has(f.id) || f.members.some((id) => selected.has(id)))
          for (const id of [f.id, ...f.members])
            if (!selected.has(id)) {
              selected.add(id);
              changed = true;
            }
    }
    for (const n of snapshot.nodes)
      if (selected.has(n.id) && !locked.has(n.id)) n.fixed = false;
  }
  for (const f of snapshot.frames) {
    const ds = descendants(f.id),
      nodes = snapshot.nodes.filter((n) => ds.includes(n.id));
    if (f.kind === 'group' && nodes.length) {
      f.rect = union(nodes.map((n) => n.rect));
      if (nodes.every((n) => !n.pins.length)) f.rigid = true;
    }
    if (f.fixed || nodes.some((n) => n.fixed && n.kind === 'component'))
      for (const n of nodes) n.fixed = true;
  }
  for (const n of snapshot.nodes)
    if (
      n.kind === 'component' &&
      page.components.find((c) => c.id === n.id)?.rotation! % 90 !== 0
    )
      snapshot.issues.push({
        type: 'unsupported_rotation',
        severity: 'error',
        objectIds: [n.id],
        message: 'Layout unterstützt elektrische Symbole in Vierteldrehungen.',
      });
  for (const f of snapshot.frames.filter((f) => f.kind !== 'group'))
    for (const child of snapshot.frames)
      if (
        constraints[f.id] === undefined &&
        child.id !== f.id &&
        contains(f.rect, child.rect) &&
        f.rect.width * f.rect.height >
          child.rect.width * child.rect.height + 1 &&
        !child.members.includes(f.id) &&
        !f.members.includes(child.id)
      )
        f.members.push(child.id);
  for (const id of locked)
    if (!ids.has(id))
      snapshot.issues.push({
        type: 'missing_locked_object',
        severity: 'error',
        objectIds: [id],
        message: 'Fixiertes Objekt fehlt.',
      });
  for (const wire of page.wires) {
    const from = snapshot.nodes
        .find((n) => n.id === wire.from.componentId)
        ?.pins.find((p) => p.id === wire.from.pinId),
      to = snapshot.nodes
        .find((n) => n.id === wire.to.componentId)
        ?.pins.find((p) => p.id === wire.to.pinId);
    if (!from || !to) {
      snapshot.issues.push({
        type: 'missing_endpoint',
        severity: 'error',
        objectIds: [wire.id],
        message: 'Leitungsanschluss fehlt.',
      });
      continue;
    }
    snapshot.edges.push({
      id: wire.id,
      from: wire.from,
      to: wire.to,
      potential: wire.potential,
      points: wirePolyline(
        { x: from.x * u, y: from.y * u },
        { x: to.x * u, y: to.y * u },
        wire.waypoints,
        wirePinDirection(page, project, wire.from),
        wirePinDirection(page, project, wire.to),
        false,
        grid,
      ).map((p) => ({ x: p.x / u, y: p.y / u })),
    });
  }
  return snapshot;
}
