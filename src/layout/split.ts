import type { LayoutSnapshot, LayoutSolution, LayoutPreview } from './types';
/** A non-mutating, conservative shelf estimate. Each proposed sheet still needs its own route validation. */
export function suggestSplit(
  input: LayoutSnapshot,
  solutions: LayoutSolution[],
): LayoutPreview['splitSuggestion'] {
  if (input.issues.some((i) => i.severity === 'error')) return undefined;
  const s = solutions[0]?.snapshot ?? input;
  const parent = (id: string) =>
    input.frames
      .filter((f) => f.members.includes(id))
      .sort(
        (a, b) =>
          a.rect.width * a.rect.height - b.rect.width * b.rect.height || a.id.localeCompare(b.id),
      )[0]?.id;
  const root = (id: string, seen = new Set<string>()): string => {
    const p = parent(id);
    return !p || seen.has(p) ? id : root(p, new Set([...seen, id]));
  };
  const blocks = new Map<string, string[]>();
  for (const n of input.nodes.filter((n) => n.kind === 'component')) {
    const id = root(n.id);
    blocks.set(id, [...(blocks.get(id) ?? []), n.id]);
  }
  if (!blocks.size) return undefined;
  const items = [...blocks]
    .map(([id, members]) => {
      const failed = s.issues.find((i) => i.type === 'sheet_capacity' && i.objectIds.includes(id))
        ?.bounds?.[0];
      const frame = s.frames.find((f) => f.id === id),
        node = s.nodes.find((n) => n.id === id);
      const r = failed ??
        frame?.rect ??
        node?.rect ?? { width: input.area.width, height: input.area.height };
      return { id, members, width: r.width + 8, height: r.height + 8 };
    })
    .sort((a, b) => b.height - a.height || a.id.localeCompare(b.id));
  const sheets: {
      groups: string[];
      componentIds: string[];
      estimate: true;
      oversized?: boolean;
    }[] = [],
    packing: { x: number; y: number; rowHeight: number }[] = [];
  for (const item of items) {
    let index = -1,
      place: { x: number; y: number; rowHeight: number } | undefined;
    for (let i = 0; i < packing.length; i++) {
      const p = { ...packing[i] };
      if (p.x + item.width > input.area.width) {
        p.x = 0;
        p.y += p.rowHeight;
        p.rowHeight = 0;
      }
      if (p.y + item.height <= input.area.height && item.width <= input.area.width) {
        index = i;
        place = p;
        break;
      }
    }
    if (index < 0) {
      index = sheets.length;
      sheets.push({
        groups: [],
        componentIds: [],
        estimate: true,
        ...(item.width > input.area.width || item.height > input.area.height
          ? { oversized: true }
          : {}),
      });
      packing.push({ x: 0, y: 0, rowHeight: 0 });
      place = { ...packing[index] };
    }
    sheets[index].groups.push(item.id);
    sheets[index].componentIds.push(...item.members);
    packing[index] = {
      x: place!.x + item.width,
      y: place!.y,
      rowHeight: Math.max(place!.rowHeight, item.height),
    };
  }
  const owner = new Map(
    sheets.flatMap((sheet, i) => sheet.componentIds.map((id) => [id, i + 1] as const)),
  );
  const crossSheetConnections = input.edges
    .filter((e) => owner.get(e.from.componentId) !== owner.get(e.to.componentId))
    .map((e) => ({
      wireId: e.id,
      fromSheet: owner.get(e.from.componentId)!,
      toSheet: owner.get(e.to.componentId)!,
      from: e.from,
      to: e.to,
      potential: e.potential,
      referenceName: 'LAYOUT-' + e.id,
    }));
  return {
    message:
      'Vorschlag zur Blattaufteilung (Flächenschätzung, noch keine geprüften Blattlayouts). Gruppen und elektrische Anschlüsse bleiben erhalten. Neue Blätter und Querverweise werden erst nach einer gesonderten Entscheidung angelegt.',
    groups: [...blocks.values()],
    sheets,
    crossSheetConnections,
  };
}
