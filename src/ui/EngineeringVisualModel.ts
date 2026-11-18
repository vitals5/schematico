import { escapeSvg as esc } from "../model/ImportedDrawing";
export interface VisualRecord {
  id: string;
  label: string;
  neighbors: string[];
  groups: string[];
  issue: boolean;
}
export const visualKey = (...parts: unknown[]) => JSON.stringify(parts);
/** Display-only relationships. Callers supply actual saved memberships or net identities. */
export function visualMeta(
  id: string,
  label: string,
  options: { neighbors?: string[]; groups?: string[]; issue?: boolean } = {},
) {
  return `data-eng-id="${esc(id)}" data-eng-label="${esc(label)}" data-eng-neighbors="${esc(JSON.stringify(options.neighbors ?? []))}" data-eng-groups="${esc(JSON.stringify(options.groups ?? []))}" data-eng-issue="${options.issue ? "true" : "false"}"`;
}
export function relatedVisualIds(
  records: VisualRecord[],
  origin: string,
): Set<string> {
  const selected = records.filter((r) => r.id === origin),
    neighbors = new Set(selected.flatMap((r) => r.neighbors)),
    groups = new Set(selected.flatMap((r) => r.groups)),
    result = new Set<string>();
  if (!selected.length) return result;
  for (const r of records)
    if (
      r.id === origin ||
      neighbors.has(r.id) ||
      r.neighbors.includes(origin) ||
      r.groups.some((g) => groups.has(g))
    )
      result.add(r.id);
  return result;
}
export function clampVisualScale(value: number, min = 0.55, max = 1.5) {
  return Number.isFinite(value)
    ? Math.max(min, Math.min(max, Math.round(value * 100) / 100))
    : 1;
}
export interface VisualBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
export function visualMapLayout(boxes: VisualBox[], width = 210, height = 58) {
  const valid = boxes.filter(
    (b) =>
      [b.x, b.y, b.width, b.height].every(Number.isFinite) &&
      b.width > 0 &&
      b.height > 0,
  );
  if (!valid.length) return { boxes: [], left: 0, top: 0, scale: 1 };
  const left = Math.min(...valid.map((b) => b.x)),
    top = Math.min(...valid.map((b) => b.y)),
    right = Math.max(...valid.map((b) => b.x + b.width)),
    bottom = Math.max(...valid.map((b) => b.y + b.height)),
    scale = Math.min(
      (width - 8) / Math.max(1, right - left),
      (height - 8) / Math.max(1, bottom - top),
    );
  return {
    left,
    top,
    scale,
    boxes: valid.map((b) => ({
      id: b.id,
      x: 4 + (b.x - left) * scale,
      y: 4 + (b.y - top) * scale,
      width: Math.max(2, b.width * scale),
      height: Math.max(2, b.height * scale),
    })),
  };
}
