// src/model/types.ts
import type { DeviceBoxGeometry } from './DeviceBoxElement';
import type { PlotFrameTemplate } from './PlotFrame';
import type { CoverPageData, CoverPageTemplate } from './CoverPage';
// Data structures following IEC 81346 / DIN EN 60617 standards

export type PageType = 'cover' | 'schematic' | 'terminal_diagram' | 'parts_list' | 'overview' | 'installation';

export interface WallSegment {
  id: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  thickness: number; // drawing units / mm
  isExterior?: boolean;
}

export interface WallOpening {
  id: string;
  wallId?: string;
  kind: 'door' | 'window' | 'opening' | 'garage_door';
  center: { x: number; y: number };
  width: number;
  orientation?: 'horizontal' | 'vertical';
  swingAngle?: number;
  swingDirection?: 'left_in' | 'right_in' | 'left_out' | 'right_out' | 'none';
}

export interface RoomDefinition {
  id: string;
  name: string;
  code?: string;
  areaM2?: number;
  polygon: { x: number; y: number }[];
  ceilingHeight?: number;
}

export interface ScaleCalibration {
  scaleRatio: number; // e.g. 50 for 1:50, 100 for 1:100
  pixelPerMeter: number;
  referenceDistance?: {
    pointA: { x: number; y: number };
    pointB: { x: number; y: number };
    realLengthMeters: number;
  };
}

export interface InstallationCircuit {
  id: string;
  name: string; // e.g. "F1 / W1"
  color?: string; // e.g. "#3182ce"
  fuseBmk?: string; // e.g. "-F1"
  phase?: 'L1' | 'L2' | 'L3' | 'N' | 'PE' | 'DC';
  cableType?: string; // e.g. "NYM-J 3x1.5"
  subDistribution?: string; // e.g. "+UV-EG"
}

export interface InstallationArcWire {
  id: string;
  fromComponentId: string;
  toComponentId: string;
  circuitId?: string;
  curvature?: number; // bulge factor, default 0.25
  label?: string; // e.g. "NYM-J 3x1.5"
}

export interface FloorPlanLegendConfig {
  visible?: boolean;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'custom';
  x?: number;
  y?: number;
  columns?: 'auto' | 1 | 2 | 3;
  showCounts?: boolean;
  scale?: number;
}

export interface FloorPlanData {
  scale: ScaleCalibration;
  walls: WallSegment[];
  openings: WallOpening[];
  rooms?: RoomDefinition[];
  circuits?: InstallationCircuit[];
  arcWires?: InstallationArcWire[];
  showRoomLabels?: boolean;
  symbolScale?: number;
  hideSymbolLabels?: boolean;
  legend?: FloorPlanLegendConfig;
  backgroundImage?: {
    dataUrl: string;
    opacity: number;
    visible: boolean;
    bounds: { x: number; y: number; width: number; height: number };
  };
}

export interface PinDefinition {
  id: string;
  name: string;
  x: number;
  y: number;
  direction: 'top' | 'bottom' | 'left' | 'right';
  description?: string;
  /** Optional source label position in symbol-local editor coordinates. */
  labelPosition?: { x: number; y: number; fontSize: number; alignment: 'start' | 'middle' | 'end';
    rotation?: 0 | 90 | 180 | 270; visible?: boolean };
}

export type DrawingPrimitive =
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; color: string; width?: number; dash?: number[] }
  | { kind: 'rect'; x: number; y: number; width: number; height: number; color: string; lineWidth?: number; dash?: number[] }
  | { kind: 'circle'; x: number; y: number; radius: number; color: string; fill?: string; width?: number }
  | { kind: 'polygon'; points: { x: number; y: number }[]; color: string; width?: number; fill?: string }
  | { kind: 'arc'; x: number; y: number; radius: number; startAngle: number; endAngle: number; color: string; width?: number; counterClockwise?: boolean }
  | { kind: 'text'; x: number; y: number; text: string; color: string; size: number; anchor?: 'start' | 'middle' | 'end'; rotation?: number };

export interface SymbolDefinition {
  unresolved?: boolean;
  id: string;
  name: string;
  category: 'supply' | 'protection' | 'relays' | 'controls' | 'terminals' | 'motors' | 'sensors' | 'automation' | 'installation' | 'structure' | 'connections';
  standard: string;
  defaultBmkPrefix: string;
  defaultFunctionText: string;
  width: number;
  height: number;
  pins: PinDefinition[];
  /** Drawing units per physical mm, for placing this master data in another project. */
  unitsPerMm?: number;
  /** Logical insertion point, independent of the symbol's contour bounds. */
  insertionPoint?: { x: number; y: number };
  /** Original symbol-library reference, retained with the project's master data. */
  source?: { library: string; number: number; variant: number };
  importedGraphics?: DrawingPrimitive[];
  /** A library routing glyph replaces the wire strokes within its own bounds. */
  connectionGraphic?: boolean;
  annotationKind?: 'cable' | 'cable_core';
  // SVG drawing paths or markup relative to (0, 0)
  svgContent: string;
  description: string;
  deviceBox?: boolean;
  isMaster?: boolean; // e.g. Contactor coil
  isContact?: boolean; // e.g. Contactor auxiliary contact
  contactType?: 'NO' | 'NC' | 'Changeover' | 'PowerNO';
  manufacturer?: string;
  articleNumber?: string;
  technicalCharacteristics?: string;
  /** Generic catalogue family and selectable engineering variants, not a manufacturer part. */
  family?: string;
  keywords?: string[];
  bmkPrefixes?: string[];
  variantProperties?: Record<string, string>;
}

export interface TextFormatConfig {
  preset?: 'auto' | 'top' | 'bottom' | 'left' | 'right' | 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right' | 'custom';
  offsetX?: number;             // X offset in px relative to default position
  offsetY?: number;             // Y offset in px relative to default position
  alignment?: 'start' | 'middle' | 'end';
  rotation?: 0 | 90 | 180 | 270;
  fontSize?: number;            // in px, e.g. 8, 10, 12
  visible?: boolean;
  /** A user explicitly chose this label visibility; imported defaults may be revealed on text entry. */
  visibilityExplicit?: boolean;
  fontColor?: string;
  fontWeight?: 'normal' | 'bold';
}

export interface PlacedComponent {
  nativeProperties?: Record<string,string>;
  deviceBox?: DeviceBoxGeometry;
  id: string;
  symbolId: string;
  source?: { format: 'NATIVE_CAD'; objectType: number; objectId: number;
    /** Auto-routing records without any drawn source connection remain editable helpers. */
    routingUsed?: boolean };
  importedSymbol?: SymbolDefinition;
  bmk: string;                  // e.g. "-K1", "-Q1", "-F1"
  deviceTag?: string;           // Gerätebezeichnung z.B. "Hauptschütz K1", "Motorschutzschalter"
  higherLevelFunction?: string; // e.g. "=A1" (Anlage)
  mountingLocation?: string;    // e.g. "+S1" (Schaltschrank / Ort)
  functionText: string;         // e.g. "Hauptantrieb Förderband"
  additionalText?: string;      // Zusatztext / Graviertext
  technicalCharacteristics?: string; // e.g. "4.0kW 400V 8.5A"
  articleNumber?: string;       // e.g. "3RT2026-1BB40"
  manufacturer?: string;        // e.g. "Siemens"
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
  scale?: number;
  showLabels?: boolean;
  pins: {
    [pinId: string]: {
      wireIds?: string[];
      customLabel?: string;
      /** Per-placement source override; the shared pin geometry stays in the library. */
      labelPosition?: PinDefinition['labelPosition'];
    };
  };
  crossRefFontSize?: number;
  pinLabelFontSize?: number;
  crossRef?: string;            // Calculated cross-reference, e.g. "/1.4"
  // Label positioning & display properties
  bmkPosition?: TextFormatConfig;
  functionTextPosition?: TextFormatConfig;
  additionalTextPosition?: TextFormatConfig;
  technicalDataPosition?: TextFormatConfig;
  crossRefPosition?: TextFormatConfig;
  pinLabelPosition?: TextFormatConfig;
  installationMetadata?: {
    mountingHeightCm?: number;
    associatedRoomId?: string;
    attachedWallId?: string;
    circuitId?: string;
  };
}

export interface Wire {
  id: string;
  from: {
    componentId: string;
    pinId: string;
  };
  to: {
    componentId: string;
    pinId: string;
  };
  potential: string;            // 'L1', 'L2', 'L3', 'N', 'PE', '+24V', '0V', 'Signal'
  wireNumber?: string;          // e.g. "101", "102"
  crossSection?: string;        // e.g. "1.5mm²"
  color?: string;               // e.g. "BK", "BU", "GNYE", "RD"
  lineWidth?: number;           // drawing units, including imported layer defaults
  waypoints?: { x: number; y: number }[];
  isAutoconnect?: boolean;
  routingMode?: 'auto' | 'manual'; // Explicitly edited bends survive subsequent device moves.
}

export interface CableDefinition {
  id: string;
  symbolId?: string;
  source?: PlacedComponent['source'];
  start: { x: number; y: number };
  end: { x: number; y: number };
  bmk: string;
  cableType: string;
  coreCount?: number;
  crossSection: string;
  description?: string;
  fontSize?: number;
  bmkFontSize?: number;
  coreFontSize?: number;
  labelOffset?: { x: number; y: number };
  showLabel?: boolean;
  showCoreLabels?: boolean;
  markStyle?: 'slash' | 'none';
  cores: { id: string; symbolId?: string; t: number; color?: string; designation?: string; crossSection?: string; wireIds?: string[]; source?: PlacedComponent['source'] }[];
}

export interface TitleBlock {
  projectTitle: string;
  commission: string;           // Kommission / Auftrags-Nr.
  company: string;
  author: string;
  date: string;
  revision: string;
  sheetNumber: string;
  totalSheets: string;
}

export interface PageText {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize?: number;
  fontColor?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  fontFamily?: string;
  align?: 'start' | 'center' | 'end' | 'left' | 'middle' | 'right';
  rotation?: 0 | 90 | 180 | 270 | number;
}

export interface PageBox {
  kind?: 'device';
  bmk?: string;
  lineStyle?: 'solid' | 'dashed';
  lineWidth?: number;
  color?: string;
  fontSize?: number;
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  subLabel?: string;
  description?: string;
}

export interface PageImage {
  sourcePath?: string;
  missing?: boolean;
  id: string;
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  caption?: string;
}

/** Persistent, page-local groups keep their members as ordinary editable objects.
 * Child groups allow an outer group to be dissolved without losing inner groups. */
export interface ElementGroup {
  id: string;
  name?: string;
  members: { kind: 'component' | 'cable' | 'image' | 'box' | 'wire' | 'text' | 'group'; id: string }[];
  source?: { format: 'NATIVE_CAD'; objectType: number; objectId: number };
}

export interface Page {
  layoutConstraints?: import('../layout/types').LayoutConstraints;
  nativeData?: import('./NativeMacroData').NativeMacroData;
  id: string;
  pageNumber: string;           // e.g. "1", "2", "3"
  pageType: PageType;
  title: string;                // e.g. "Einspeisung & Steuerspannung"
  higherLevel: string;          // =Anlage (z.B. "=H1")
  location: string;             // +Ort (z.B. "+S1")
  components: PlacedComponent[];
  grid?: { spacing: number; origin: { x: number; y: number } };
  wires: Wire[];
  cables?: CableDefinition[];
  floorPlan?: FloorPlanData;
  texts?: PageText[];
  boxes?: PageBox[];
  images?: PageImage[];
  groups?: ElementGroup[];
  coverPage?: CoverPageData;
  suppressedAutoconnections?: string[];
  importDiagnostics?: string[];
  connectionMode?: 'explicit' | 'autoconnect';
  importedDrawing?: {
    source: 'NATIVE_CAD';
    graphics: DrawingPrimitive[];
    diagnostics: string[];
  };
  plotFrame: {
    type: 'DIN_A3_LANDSCAPE';
    width: number;              // drawing units (physical mm via Project.drawingUnitsPerMm)
    height: number;             // drawing units
    columns: number;            // 0..9 (10 paths per page)
    rows: string[];             // A..F
    titleBlock: TitleBlock;
  };
}

export interface Project {
  id: string;
  name: string;
  description: string;
  standard: 'DIN EN 81346-2 / IEC 60617';
  version: string;
  created: string;
  modified: string;
  author: string;
  company: string;
  pages: Page[];
  plotFrameTemplate?: PlotFrameTemplate;
  coverPageTemplate?: CoverPageTemplate;
  settings?: { interruptionLabelSide?: 'source' | 'before' | 'after' };
  language?: 'de' | 'en';
  drawingUnitsPerMm?: number;
  /** Shared project master data. Placements reference these definitions by symbolId. */
  symbolLibrary?: SymbolDefinition[];
  /** Native electrical endpoint netlist, separate from editable drawn runs (may span pages). */
  logicalConnections?: Wire[];
  activePageId: string;
}

export interface CrossReference {
  masterId: string;
  slaveId: string;
  masterPageNumber: string;
  masterPath: number;
  slavePageNumber: string;
  slavePath: number;
  contactType: string;
}
