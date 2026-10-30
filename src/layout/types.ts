import type { Page, Project } from '../model/types';
export interface Point {
  x: number;
  y: number;
}
export interface Rect extends Point {
  width: number;
  height: number;
}
export type Direction = 'top' | 'right' | 'bottom' | 'left';
export interface Shape {
  id: string;
  owner: string;
  kind: 'body' | 'label' | 'pin_label' | 'obstacle' | 'frame';
  rect: Rect;
  pinId?: string;
  text?: {
    value: string;
    anchor: Point;
    rotation: number;
    size: number;
    font: string;
    align: string;
    weight: string;
  };
}
export interface LayoutPin extends Point {
  id: string;
  direction: Direction;
}
export interface LayoutNode {
  deviceRelation?: { key: string; kind: 'master' | 'contact' };
  circuitRole?: 'power' | 'control';
  routingJunction?: boolean;
  handover?: boolean;
  joinedPins?: string[][];
  insertion?: Point;
  id: string;
  kind: 'component' | 'text' | 'image' | 'cable';
  origin: Point;
  rect: Rect;
  shapes: Shape[];
  pins: LayoutPin[];
  fixed: boolean;
  parent?: string;
}
export interface LayoutFrame {
  rigid?: boolean;
  id: string;
  kind: 'group' | 'box' | 'component';
  members: string[];
  fixed: boolean;
  rect: Rect;
  shapes?: Shape[];
}
export interface LayoutEdge {
  /** Temporary planning edge may define levels without imposing a shared axis. */
  alignAxis?: boolean;
  id: string;
  from: { componentId: string; pinId: string };
  to: { componentId: string; pinId: string };
  potential: string;
  points: Point[];
}
export interface LayoutSnapshot {
  /** Preferred flow axis for a temporary branch-subcircuit calculation. */
  planningAxis?: 'horizontal' | 'vertical';
  /** Temporary planning reservations; never persisted as project connections. */
  junctionSpaces?: { pins: string[]; width: number; height: number; reserve?: boolean; orderX?: [string, string][]; orderY?: [string, string][]; apartX?: [string, string][]; apartY?: [string, string][] }[];
  pageId: string;
  area: Rect;
  nodes: LayoutNode[];
  frames: LayoutFrame[];
  edges: LayoutEdge[];
  grid: { spacing: number; origin: Point };
  issues: LayoutIssue[];
}
export interface LayoutIssue {
  type: string;
  severity: 'error' | 'warning';
  objectIds: string[];
  message: string;
  bounds?: Rect[];
}
export interface LayoutReport {
  phase?: 'input' | 'placement' | 'routing' | 'validation';
  valid: boolean;
  issues: LayoutIssue[];
  metrics: {
    bodyOverlaps: number;
    textOverlaps: number;
    wireObstacles: number;
    overflows: number;
    crossings: number;
    bends: number;
    length: number;
    displacement: number;
  };
}
export interface LayoutConstraints {
  protectedComponentIds?: string[];
  fixedFrameIds?: string[];
  lockedIds?: string[];
  containerMembers?: Record<string, string[]>;
}
export interface LayoutOptions extends LayoutConstraints {
  multiPage?: boolean;
  selectedIds?: string[];
}
export interface LayoutSolution {
  profile: 'readability' | 'compact' | 'minimal_change' | 'lanes' | 'structured';
  snapshot: LayoutSnapshot;
  report: LayoutReport;
}
export interface LayoutCandidate {
  multiPage?: import('./multipage').MultiPageLayout;
  id: string;
  base: string;
  pageId: string;
  page: Page;
  report: LayoutReport;
  profile: string;
}
export interface LayoutPreview {
  pageId: string;
  status: 'preview_ready' | 'layout_invalid';
  before: LayoutReport;
  candidates: LayoutCandidate[];
  issues: LayoutIssue[];
  splitSuggestion?: {
    message: string;
    groups: string[][];
    sheets?: { groups: string[]; componentIds: string[]; estimate: true; oversized?: boolean }[];
    crossSheetConnections?: {
      wireId: string;
      fromSheet: number;
      toSheet: number;
      from: LayoutEdge['from'];
      to: LayoutEdge['to'];
      potential: string;
      referenceName: string;
    }[];
  };
}
export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
/** Ignore view navigation/modified timestamps, but include all electrical and library state. */
export const projectRevision = (p: Project) =>
  JSON.stringify({ ...p, activePageId: undefined, modified: undefined });
export const topology = (p: Project) =>
  JSON.stringify({
    pages: p.pages.map((page) => ({
      id: page.id,
      components: page.components.map((c) => ({
        id: c.id,
        symbolId: c.symbolId,
        bmk: c.bmk,
        source: c.source,
        pins: Object.entries(c.pins).map(([id, p]) => [id, p.customLabel]),
      })),
      wires: page.wires.map(({ waypoints, isAutoconnect, routingMode, ...w }) => w),
      groups: page.groups,
      cables: page.cables?.map(({ start, end, ...c }) => c),
    })),
    logical: p.logicalConnections,
    library: p.symbolLibrary,
  });
