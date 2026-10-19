import { canGroupSelection, createElementGroup, dissolveElementGroups, expandGroupedSelection, selectedRootGroups, pruneElementGroups, selectionMembers, membersSelection } from '../model/ElementGroups';
import { newDeviceBox, resizeDeviceBox, geometryFromSymbol } from '../model/DeviceBoxElement';
import { boxDrawing, boxSvg } from '../model/DeviceBox';
import { nextDeviceTag } from '../model/DeviceTag';
import { ElementSelection, MoveSnapshot, emptySelection, selectionCount, normalizeSelection, selectionBounds, elementsInWindow, captureSelectionMove, translateSelection } from '../model/ElementSelection';
import { copySelection, pasteClipboard, getClipboard, setClipboard, hasClipboard, getPasteCounter, incrementPasteCounter, resetPasteCounter } from '../model/Clipboard';
import { coverPageSvg } from '../model/CoverPage';
import { cableSvg, cableCrossings } from '../model/CableDefinition';
// src/editor/CadCanvas.ts
// Interactive SVG-based CAD drawing canvas for electrical schematics

import { interruptionLabelPosition, isInterruptionSymbol } from '../model/ConnectionSymbols';
import { labelTransform } from '../model/LabelLayout';
import { plotFrameSvg } from '../model/PlotFrame';
import { wirePolyline, wirePinDirection } from '../model/WireRouting';
import { connectionCutouts, connectionGraphicWires, isConnectionGraphic, supersededConnectionGraphics, visibleWireSegments } from '../model/ConnectionGraphics';
import { drawingToSvg, escapeSvg, uprightSymbolSvg } from '../model/ImportedDrawing';
import { Project, Page, PlacedComponent, Wire, CableDefinition, PageImage, PageBox } from '../model/types';
import { getSymbolById, getSymbolForComponent, getDrawingUnitsPerMm } from '../model/symbols';
import { referenceTargets, referenceMarkup, ReferenceTarget } from '../model/CrossReferenceNavigation';
import { CrossReferenceEngine } from '../model/CrossReferenceEngine';
import { AutoconnectEngine, AutoconnectPreviewSegment } from '../model/AutoconnectEngine';
import { computeBmkPosition, computeFunctionTextPosition, computeAdditionalTextPosition, computeTechnicalDataPosition, computeCrossReferencePosition } from '../model/LabelLayout';
import { WindowMacro, MacroManager } from '../model/MacroManager';
import { mergeNativeMacroData } from '../model/NativeMacroData';
import { componentInsertionPoint, positionAtInsertionPoint, scalePlacedComponent, rotatedLocalPoint } from '../model/SymbolGeometry';
import { gridForPage, gridStep, snapCoordinate, snapSymbolPosition, GridResolution } from '../model/DrawingGrid';
export type { GridResolution } from '../model/DrawingGrid';

export type EditorMode = 'select' | 'wire' | 'place_symbol' | 'place_macro' | 'pan' | 'cable' | 'place_image' | 'device_box';

export interface CadCanvasCallbacks {
  onSelectionChanged?: (selection: ElementSelection) => void;
  onOpenSelectionProperties?: () => void;
  onOpenCoverPage?: () => void;
  onSelectComponent: (component: PlacedComponent | null) => void;
  onSelectCable?: (cable: CableDefinition | null) => void;
  onSelectWire: (wire: Wire | null) => void;
  onOpenProperties?: (component: PlacedComponent) => void;
  onOpenSymbolSelection?: () => void;
  onOpenMacroSelection?: () => void;
  onExportSelectedMacro?: (components: PlacedComponent[]) => void;
  onNavigateToPage?: (pageId: string) => void;
  onProjectModified: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

export class CadCanvas {
  private container: HTMLElement;
  private svg: SVGSVGElement;
  private project: Project;
  private activePage: Page;
  private callbacks: CadCanvasCallbacks;

  // Viewport transformation
  private scale: number = 1.0;
  private panX: number = 20;
  private panY: number = 20;
  private isPanning: boolean = false;
  private startPan: { x: number; y: number } = { x: 0, y: 0 };

  // Editor State
  public mode: EditorMode = 'select';
  public gridSnap: boolean = true;
  public gridSize: number = 8; // Legacy fallback; imported pages own their physical grid.
  public gridResolution: GridResolution = 'full';
  public autoconnectEnabled: boolean = true;
  public activeSymbolToPlace: string | null = null;
  public activeMacroToPlace: WindowMacro | null = null;
  public ghostRotation: 0 | 90 | 180 | 270 = 0;
  public selectedComponentId: string | null = null;
  public selectedWireId: string | null = null;
  public selectedCableId: string | null = null;
  public selectedBoxId: string | null = null;
  private boxDraft?: {start:{x:number;y:number};end:{x:number;y:number};pressing:boolean};
  private elementBoxResize?: {component:PlacedComponent;original:PlacedComponent;anchor:{x:number;y:number}};
  private boxResize?: {box:PageBox;width:number;height:number};
  public selectedImageId: string | null = null;
  private activeImageToPlace?: Omit<PageImage, 'id' | 'x' | 'y'>;
  private multipleSelection?: ElementSelection;
  private selectionWindow?: {start:{x:number;y:number};end:{x:number;y:number};client:{x:number;y:number};moved:boolean;base:ElementSelection;additive:boolean};
  private selectionDrag?: {origin:{x:number;y:number};snapshot:MoveSnapshot;dx:number;dy:number};
  private cableStart?: { x: number; y: number };
  private cableDrag?: { cable: CableDefinition; start: {x:number;y:number}; end: {x:number;y:number}; origin: {x:number;y:number}; moved: boolean };
  public hoveredPin: { componentId: string; pinId: string } | null = null;

  // Dragging components
  private isDraggingComponent: boolean = false;
  private referenceMarker?: { x: number; y: number };
  private dragOffset: { x: number; y: number } = { x: 0, y: 0 };
  private lastMousePress: { componentId: string; time: number } | null = null;

  // Wiring State
  private wireStart: { componentId: string; pinId: string } | null = null;
  private currentMousePos: { x: number; y: number } = { x: 0, y: 0 };

  // Touch gesture state
  private touchMode: 'none' | 'pan' | 'pinch' | 'drag' = 'none';
  private initialPinchDist: number = 0;
  private initialPinchScale: number = 1.0;
  private initialPinchCenter: { x: number; y: number } = { x: 0, y: 0 };
  private initialPan: { x: number; y: number } = { x: 0, y: 0 };
  private lastTapTime: number = 0;
  private lastTapComponentId: string | null = null;

  constructor(container: HTMLElement, project: Project, callbacks: CadCanvasCallbacks) {
    this.container = container;
    this.project = project;
    this.callbacks = callbacks;
    this.activePage = this.getOrCreateActivePage();

    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'cad-viewport');
    this.svg.style.width = '100%';
    this.svg.style.height = '100%';
    this.svg.style.display = 'block';
    this.svg.style.userSelect = 'none';
    this.svg.style.touchAction = 'none';
    this.container.appendChild(this.svg);

    this.bindEvents();
    if (this.autoconnectEnabled) {
      AutoconnectEngine.updatePageAutoconnections(this.activePage);
    }
    this.render();
  }

  public setPage(pageId: string): void {
    const page = this.project.pages.find(p => p.id === pageId);
    if (page) {
      this.cancelBoxInteraction();
      this.referenceMarker = undefined;
      this.multipleSelection=undefined;this.selectionWindow=undefined;this.selectionDrag=undefined;
      this.activePage = page;
      this.project.activePageId = pageId;
      this.selectedComponentId = null;
      this.selectedWireId = null;
      this.selectedImageId=null;this.selectedBoxId=null;this.activeImageToPlace=undefined;
      if(this.mode==='place_image'||this.mode==='device_box')this.mode='select';
      this.boxDraft=undefined;this.boxResize=undefined;
      this.selectedCableId = null; this.cableDrag = undefined; this.cableStart = undefined;
      this.callbacks.onSelectCable?.(null);
      this.callbacks.onSelectComponent(null);
      this.callbacks.onSelectWire(null);
      if (this.autoconnectEnabled) {
        AutoconnectEngine.updatePageAutoconnections(this.activePage);
      }
      this.render();
    }
  }

  public setProject(project: Project, recompute = true): void {
    this.isDraggingComponent = false; this.isPanning = false; this.touchMode = 'none';
    this.wireStart = null; this.lastMousePress = null; this.hoveredPin = null;
    this.activeSymbolToPlace = null; this.activeMacroToPlace = null; this.mode = 'select';
    this.referenceMarker = undefined;this.boxDraft=undefined;this.boxResize=undefined;
    this.multipleSelection=undefined;this.selectionWindow=undefined;this.selectionDrag=undefined;
    this.project = project;
    this.activePage = this.getOrCreateActivePage();
    this.selectedComponentId = null;
    this.selectedWireId = null;
    this.selectedImageId=null;this.selectedBoxId=null;this.activeImageToPlace=undefined;
    this.selectedCableId = null; this.cableDrag = undefined; this.cableStart = undefined;
    this.callbacks.onSelectCable?.(null);
    if (recompute) {
      CrossReferenceEngine.updateProjectCrossReferences(this.project);
      if (this.autoconnectEnabled) AutoconnectEngine.updatePageAutoconnections(this.activePage);
    }
    this.render();
  }

  public finishInteraction(): void {
    this.onMouseUp();
    this.touchMode = 'none';
  }

  public followReference(source: PlacedComponent, index = 0): boolean {
    const target = referenceTargets(this.project, source)[index];
    if (!target) return false;
    this.focusReference(target);
    return true;
  }

  public focusReference(target: ReferenceTarget): void {
    if (!this.project.pages.some(p => p.id === target.pageId)) return;
    this.clearMultipleSelection();this.selectedImageId=null;this.selectedBoxId=null;
    this.setMode('select');
    this.isDraggingComponent = false; this.touchMode = 'none'; this.lastMousePress = null;
    this.callbacks.onNavigateToPage?.(target.pageId);
    if (this.activePage.id !== target.pageId) this.setPage(target.pageId);
    const component = this.activePage.components.find(c => c.id === target.componentId) ?? null;
    this.selectedComponentId = component?.id ?? null;
    this.selectedWireId = null;
    this.callbacks.onSelectComponent(component); this.callbacks.onSelectWire(null);
    this.referenceMarker = { x: target.x, y: target.y };
    const rect = this.container.getBoundingClientRect();
    this.scale = Math.max(.9, this.scale);
    this.panX = rect.width / 2 - target.x * this.scale;
    this.panY = rect.height / 2 - target.y * this.scale;
    this.render();
  }

  private referenceFromEvent(event: Event): boolean {
    const link = (event.target as Element | null)?.closest?.('[data-crossref-source]');
    if (!link) return false;
    const source = this.activePage.components.find(c => c.id === link.getAttribute('data-crossref-source'));
    if (!source) return false;
    event.preventDefault(); event.stopPropagation();
    return this.followReference(source, Number(link.getAttribute('data-crossref-index') ?? 0));
  }

  public setMode(mode: EditorMode): void {
    this.selectionWindow=undefined;this.cancelBoxInteraction();
    if(mode!=='place_image')this.activeImageToPlace=undefined;
    this.mode = mode;
    this.cableStart = undefined;
    this.wireStart = null;
    this.render();
  }

  public setSymbolToPlace(symbolId: string): void {
    this.setElementSelection(emptySelection());this.cancelBoxInteraction();
    this.activeSymbolToPlace = symbolId;
    this.activeMacroToPlace = null;
    this.mode = 'place_symbol';
    this.ghostRotation = 0;
    this.render();
  }

  public setMacroToPlace(macro: WindowMacro): void {
    this.setElementSelection(emptySelection());this.cancelBoxInteraction();
    this.activeMacroToPlace = macro;
    this.activeSymbolToPlace = null;
    this.mode = 'place_macro';
    this.render();
  }

  public placeMacroAt(worldX: number, worldY: number, macro: WindowMacro): PlacedComponent[] {
    this.clearMultipleSelection();
    const { x: snappedX, y: snappedY } = this.macroPlacementPosition(worldX, worldY, macro);
    const res = MacroManager.instantiateWindowMacro(macro, snappedX, snappedY, this.activePage.components, this.project);

    this.activePage.components.push(...res.components);
    if (res.wires && res.wires.length > 0) {
      this.activePage.wires.push(...res.wires);
    }

    if(res.groups.length)(this.activePage.groups??=[]).push(...res.groups);
    if(res.boxes.length)(this.activePage.boxes ??= []).push(...res.boxes);
    if (res.images.length) (this.activePage.images ??= []).push(...res.images);
    if (res.cables.length) (this.activePage.cables ??= []).push(...res.cables);
    this.activePage.nativeData=mergeNativeMacroData(this.activePage.nativeData,res.nativeData);
    if(res.importDiagnostics?.length)this.activePage.importDiagnostics=[...new Set([...(this.activePage.importDiagnostics??[]),...res.importDiagnostics])];
    if (this.autoconnectEnabled) {
      AutoconnectEngine.updatePageAutoconnections(this.activePage);
    }
    CrossReferenceEngine.updateProjectCrossReferences(this.project);
    this.setElementSelection({ componentIds: res.components.map(c => c.id), cableIds: res.cables.map(c => c.id), imageIds: res.images.map(i => i.id),boxIds:res.boxes.map(i=>i.id) });

    this.notifyModified();
    this.render();
    return res.components;
  }

  public zoomIn(): void {
    this.scale = Math.min(3.0, this.scale * 1.15);
    this.render();
  }

  public zoomOut(): void {
    this.scale = Math.max(0.3, this.scale / 1.15);
    this.render();
  }

  public resetZoom(): void {
    this.scale = 1.0;
    this.panX = 30;
    this.panY = 30;
    this.render();
  }

  public fitToScreen(): void {
    const rect = this.container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      // Normblatt DIN A3 is roughly 1188 x 840
      const padding = 15;
      const scaleX = (rect.width - padding * 2) / 1200;
      const scaleY = (rect.height - padding * 2) / 850;
      this.scale = Math.max(0.2, Math.min(1.2, Math.min(scaleX, scaleY)));
      this.panX = Math.round((rect.width - 1200 * this.scale) / 2);
      this.panY = Math.round((rect.height - 850 * this.scale) / 2);
      this.render();
    }
  }

  public rotateSelected(delta: number = 90): void {
    if(this.multipleSelection)return;
    const cable = this.activePage.cables?.find(c=>c.id===this.selectedCableId);
    if (cable) {
      const cx=cable.start.x,cy=cable.start.y,a=delta*Math.PI/180;
      const rotate=(p:{x:number;y:number})=>({x:cx+(p.x-cx)*Math.cos(a)-(p.y-cy)*Math.sin(a),y:cy+(p.x-cx)*Math.sin(a)+(p.y-cy)*Math.cos(a)});
      cable.start=rotate(cable.start);cable.end=rotate(cable.end);this.notifyModified();this.render();return;
    }
    if (!this.selectedComponentId) return;
    const comp = this.activePage.components.find(c => c.id === this.selectedComponentId);
    if (comp) {
      const symbol = getSymbolForComponent(comp, this.project);
      const insertion = symbol && componentInsertionPoint(comp, symbol);
      comp.rotation = (((comp.rotation || 0) + delta + 360) % 360) as any;
      if (symbol && insertion) Object.assign(comp, positionAtInsertionPoint(insertion, symbol, comp.rotation));
      AutoconnectEngine.clearSuppressedForComponent(this.activePage, comp.id);
      if (this.autoconnectEnabled) {
        AutoconnectEngine.updatePageAutoconnections(this.activePage);
      }
      this.notifyModified();
      this.render();
    }
  }

  public copySelected(): boolean {
    const selection = this.getElementSelection();
    if (selectionCount(selection) === 0) return false;
    const payload = copySelection(this.activePage, this.project, selection);
    if (!payload) return false;
    setClipboard(payload);
    resetPasteCounter();
    this.callbacks.onSelectionChanged?.(this.getElementSelection());
    return true;
  }

  public cutSelected(): boolean {
    if (!this.copySelected()) return false;
    const clip = getClipboard();
    if (clip) clip.isCut = true;
    this.deleteSelected();
    return true;
  }

  public hasClipboard(): boolean {
    return hasClipboard();
  }

  public paste(targetPos?: { x: number; y: number }): boolean {
    const clip = getClipboard();
    if (!clip || !hasClipboard()) return false;
    const step = gridForPage(this.activePage, this.gridSize).spacing * 2;
    let dx = 0, dy = 0;

    if (targetPos) {
      const snapX = this.snap(targetPos.x, false, 'x');
      const snapY = this.snap(targetPos.y, false, 'y');
      if (clip.bounds) {
        const origX = this.snap(clip.bounds.left, false, 'x');
        const origY = this.snap(clip.bounds.top, false, 'y');
        dx = snapX - origX;
        dy = snapY - origY;
      } else {
        dx = snapX;
        dy = snapY;
      }
    } else if (clip.isCut) {
      dx = 0;
      dy = 0;
      clip.isCut = false;
    } else {
      const isSamePage = clip.sourcePageId === this.activePage.id;
      const count = getPasteCounter();
      if (!isSamePage && count === 1) {
        dx = 0;
        dy = 0;
      } else {
        dx = step * count;
        dy = step * count;
      }
      incrementPasteCounter();
    }

    const result = pasteClipboard(this.activePage, this.project, clip, { dx, dy });
    if (this.autoconnectEnabled) {
      AutoconnectEngine.updatePageAutoconnections(this.activePage);
    }
    this.setElementSelection(result.pastedSelection);
    this.notifyModified();
    this.render();
    return true;
  }

  public duplicateSelected(): void {
    const selection = this.getElementSelection();
    if (selectionCount(selection) === 0) return;
    const payload = copySelection(this.activePage, this.project, selection);
    if (!payload) return;
    const step = gridForPage(this.activePage, this.gridSize).spacing * 4;
    const result = pasteClipboard(this.activePage, this.project, payload, { dx: step, dy: step });
    if (this.autoconnectEnabled) {
      AutoconnectEngine.updatePageAutoconnections(this.activePage);
    }
    this.setElementSelection(result.pastedSelection);
    this.notifyModified();
    this.render();
  }

  public setImageToPlace(image:Omit<PageImage,'id'|'x'|'y'>):void {
    this.setElementSelection(emptySelection());this.setMode('place_image');this.activeImageToPlace={...image};this.render();
  }

  private placeImageAt(world:{x:number;y:number}):void {
    if(!this.activeImageToPlace)return;
    const image:PageImage={...this.activeImageToPlace,id:`image_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,x:this.snap(world.x,false,'x'),y:this.snap(world.y,false,'y')};
    (this.activePage.images ??= []).push(image);this.activeImageToPlace=undefined;this.mode='select';
    this.setElementSelection({componentIds:[],cableIds:[],imageIds:[image.id]});this.notifyModified();this.render();
  }

  public startDeviceBox():void {
    this.setElementSelection(emptySelection());this.setMode('device_box');
  }

  private boxPoint(world:{x:number;y:number}):{x:number;y:number} {
    return {x:this.snap(world.x,false,'x'),y:this.snap(world.y,false,'y')};
  }

  private finishDeviceBox():void {
    const draft=this.boxDraft;if(!draft)return;
    const width=Math.abs(draft.end.x-draft.start.x),height=Math.abs(draft.end.y-draft.start.y);
    const minimum=gridForPage(this.activePage,this.gridSize).spacing;
    if(width<minimum||height<minimum)return;
    const box=newDeviceBox('comp_'+crypto.randomUUID(),nextDeviceTag(this.project,'-A'),Math.min(draft.start.x,draft.end.x),Math.min(draft.start.y,draft.end.y),width,height,getDrawingUnitsPerMm(this.project));
    this.activePage.components.unshift(box);this.boxDraft=undefined;this.mode='select';
    this.setElementSelection({componentIds:[box.id],cableIds:[]});this.notifyModified();this.render();
  }

  private cancelBoxInteraction():void {
    if(this.elementBoxResize)Object.assign(this.elementBoxResize.component,structuredClone(this.elementBoxResize.original));
    this.elementBoxResize=undefined;
    if(this.boxResize){this.boxResize.box.width=this.boxResize.width;this.boxResize.box.height=this.boxResize.height;}
    this.boxResize=undefined;this.boxDraft=undefined;
  }

  private startElementBoxResize(event:Event):boolean {
    if(this.multipleSelection)return false;
    const id=(event.target as Element)?.closest?.('[data-element-box-resize]')?.getAttribute('data-element-box-resize');
    const component=this.activePage.components.find(c=>c.id===id);if(!component?.deviceBox||this.mode!=='select')return false;
    const sym=getSymbolForComponent(component,this.project)!;
    const origin=rotatedLocalPoint({x:0,y:0},sym,component.rotation);
    this.setElementSelection({componentIds:[component.id],cableIds:[]});
    this.elementBoxResize={component,original:structuredClone(component),anchor:{x:component.x+origin.x,y:component.y+origin.y}};return true;
  }

  private resizeElementBox(world:{x:number;y:number}):void {
    const {component,original,anchor}=this.elementBoxResize!,point=this.boxPoint(world),a=-component.rotation*Math.PI/180;
    const dx=point.x-anchor.x,dy=point.y-anchor.y,minimum=gridForPage(this.activePage,this.gridSize).spacing;
    Object.assign(component,structuredClone(original));
    resizeDeviceBox(component,Math.max(minimum,Math.round((dx*Math.cos(a)-dy*Math.sin(a))*1e10)/1e10),Math.max(minimum,Math.round((dx*Math.sin(a)+dy*Math.cos(a))*1e10)/1e10));
    const sym=getSymbolForComponent(component,this.project)!,origin=rotatedLocalPoint({x:0,y:0},sym,component.rotation);
    component.x=anchor.x-origin.x;component.y=anchor.y-origin.y;
    const element=this.svg.getElementById(component.id);if(!element)return;
    element.setAttribute('transform',`translate(${component.x},${component.y}) rotate(${component.rotation},${sym.width/2},${sym.height/2})`);
    const graphic=element.querySelector(':scope > g[color]');if(graphic)graphic.innerHTML=drawingToSvg(sym.importedGraphics??[]);
    for(const selector of ['.box-hit-target','.selection-rect']){element.querySelector(selector)?.setAttribute('width',String(sym.width));element.querySelector(selector)?.setAttribute('height',String(sym.height));}
    element.querySelector('.box-resize-handle')?.setAttribute('x',String(sym.width-4));element.querySelector('.box-resize-handle')?.setAttribute('y',String(sym.height-4));
    for(const [key,pos]of Object.entries({bmkPosition:computeBmkPosition(component,sym),functionTextPosition:computeFunctionTextPosition(component,sym),technicalDataPosition:computeTechnicalDataPosition(component,sym),additionalTextPosition:computeAdditionalTextPosition(component,sym)})){
      const label=element.querySelector(`[data-label="${key}"]`);if(!label)continue;label.setAttribute('x',String(pos.x));label.setAttribute('y',String(pos.y));
      label.setAttribute('transform',`rotate(${pos.rotation-component.rotation},${pos.x},${pos.y})`);
      label.querySelectorAll('tspan').forEach(span=>span.setAttribute('x',String(pos.x)));
    }
  }

  private resizeBox(world:{x:number;y:number}):void {
    const box=this.boxResize!.box,point=this.boxPoint(world),minimum=gridForPage(this.activePage,this.gridSize).spacing;
    box.width=Math.max(minimum,point.x-box.x);box.height=Math.max(minimum,point.y-box.y);
    const element=this.svg.getElementById(box.id);if(!element)return;
    const graphics=element.querySelector('g[pointer-events="none"]');if(graphics)graphics.innerHTML=drawingToSvg(boxDrawing(box));
    element.querySelector('.box-hit-target')?.setAttribute('width',String(box.width));
    element.querySelector('.box-hit-target')?.setAttribute('height',String(box.height));
    element.querySelector('.box-selection-rect')?.setAttribute('width',String(box.width+6));
    element.querySelector('.box-selection-rect')?.setAttribute('height',String(box.height+6));
    element.querySelector('.box-resize-handle')?.setAttribute('x',String(box.x+box.width-4));
    element.querySelector('.box-resize-handle')?.setAttribute('y',String(box.y+box.height-4));
  }

  public deleteSelected(): void {
    if(this.multipleSelection){
      const {componentIds,cableIds,imageIds,boxIds,wireIds,textIds}=this.multipleSelection,ids=new Set(componentIds);
      this.activePage.components=this.activePage.components.filter(c=>!ids.has(c.id));
      this.activePage.wires=this.activePage.wires.filter(w=>!ids.has(w.from.componentId)&&!ids.has(w.to.componentId)&&!wireIds?.includes(w.id));
      this.activePage.texts=this.activePage.texts?.filter(t=>!textIds?.includes(t.id));
      this.activePage.boxes=this.activePage.boxes?.filter(c=>!boxIds?.includes(c.id));
      this.activePage.images=this.activePage.images?.filter(c=>!imageIds?.includes(c.id));
      this.activePage.cables=this.activePage.cables?.filter(c=>!cableIds.includes(c.id));
      this.project.logicalConnections=this.project.logicalConnections?.filter(w=>!ids.has(w.from.componentId)&&!ids.has(w.to.componentId));
      for(const c of this.activePage.components)for(const pin of Object.values(c.pins))if(pin.wireIds)pin.wireIds=pin.wireIds.filter(id=>this.activePage.wires.some(w=>w.id===id));
      this.setElementSelection(emptySelection());
      if(this.autoconnectEnabled && ids.size)AutoconnectEngine.updatePageAutoconnections(this.activePage);
      this.notifyModified();this.render();return;
    }
    if(this.selectedBoxId){this.activePage.boxes=this.activePage.boxes?.filter(c=>c.id!==this.selectedBoxId);this.setElementSelection(emptySelection());this.notifyModified();this.render();return;}
    if(this.selectedImageId){this.activePage.images=this.activePage.images?.filter(c=>c.id!==this.selectedImageId);this.setElementSelection(emptySelection());this.notifyModified();this.render();return;}
    if (this.selectedCableId) {
      this.activePage.cables = (this.activePage.cables ?? []).filter(c=>c.id!==this.selectedCableId);
      this.selectedCableId=null; this.callbacks.onSelectCable?.(null);this.notifyModified();this.render();return;
    }
    if (this.selectedComponentId) {
      this.activePage.components = this.activePage.components.filter(c => c.id !== this.selectedComponentId);
      // Remove attached wires
      this.activePage.wires = this.activePage.wires.filter(
        w => w.from.componentId !== this.selectedComponentId && w.to.componentId !== this.selectedComponentId
      );
      this.project.logicalConnections = this.project.logicalConnections?.filter(
        w => w.from.componentId !== this.selectedComponentId && w.to.componentId !== this.selectedComponentId
      );
      this.selectedComponentId = null;
      this.callbacks.onSelectComponent(null);
      if (this.autoconnectEnabled) {
        AutoconnectEngine.updatePageAutoconnections(this.activePage);
      }
      this.notifyModified();
      this.render();
    } else if (this.selectedWireId) {
      const wire = this.activePage.wires.find(w => w.id === this.selectedWireId);
      if (wire) {
        AutoconnectEngine.suppressAutoconnection(this.activePage, wire);
      }
      this.activePage.wires = this.activePage.wires.filter(w => w.id !== this.selectedWireId);
      this.selectedWireId = null;
      this.callbacks.onSelectWire(null);
      this.notifyModified();
      this.render();
    }
  }

  private getOrCreateActivePage(): Page {
    let page = this.project.pages.find(p => p.id === this.project.activePageId);
    if (!page && this.project.pages.length > 0) {
      page = this.project.pages[0];
      this.project.activePageId = page.id;
    }
    return page!;
  }

  public getEffectiveGridSize(isModifierActive: boolean = false): number {
    return gridStep(gridForPage(this.activePage, this.gridSize).spacing,
      this.gridSnap ? this.gridResolution : 'off', isModifierActive);
  }

  public getGridLabel(): string {
    if (!this.gridSnap || this.gridResolution === 'off') return 'Aus';
    const prefix = this.gridResolution === 'half' ? '½' : this.gridResolution === 'fine' ? '¼' : '1x';
    const units = getDrawingUnitsPerMm(this.project);
    return `${prefix} (${(this.getEffectiveGridSize() / units).toLocaleString('de-DE', { maximumFractionDigits: 3 })} mm)`;
  }

  public cycleGridResolution(): GridResolution {
    if (!this.gridSnap || this.gridResolution === 'off') {
      this.gridSnap = true;
      this.gridResolution = 'full';
    } else if (this.gridResolution === 'full') {
      this.gridResolution = 'half';
    } else if (this.gridResolution === 'half') {
      this.gridResolution = 'fine';
    } else {
      this.gridResolution = 'off';
      this.gridSnap = false;
    }
    this.render();
    return this.gridResolution;
  }

  public setGridResolution(res: GridResolution): void {
    this.gridResolution = res;
    this.gridSnap = (res !== 'off');
    this.render();
  }

  public snap(val: number, isModifierActive: boolean = false, axis: 'x' | 'y' = 'x'): number {
    const step = this.getEffectiveGridSize(isModifierActive);
    return snapCoordinate(val, step, gridForPage(this.activePage, this.gridSize).origin[axis]);
  }

  private placementPosition(x: number, y: number, symbol: NonNullable<ReturnType<typeof getSymbolById>>): { x: number; y: number } {
    return positionAtInsertionPoint({ x: this.snap(x), y: this.snap(y, false, 'y') }, symbol, this.ghostRotation);
  }

  private macroPlacementPosition(x: number, y: number, macro: WindowMacro): { x: number; y: number } {
    const factor = MacroManager.getMacroScale(macro, this.project);
    const first = macro.components[0];
    const symbol = first && getSymbolForComponent(first, { ...this.project,
      symbolLibrary: [...(this.project.symbolLibrary ?? []), ...(macro.symbolLibrary ?? [])] });
    const handle = macro.handlePoint ? { x: macro.handlePoint.x * factor, y: macro.handlePoint.y * factor }
      : first && symbol ? componentInsertionPoint({ ...first, x: first.x * factor, y: first.y * factor }, symbol) : { x: 0, y: 0 };
    return { x: this.snap(x) - handle.x, y: this.snap(y, false, 'y') - handle.y };
  }


  public screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.svg.getBoundingClientRect();
    const x = (clientX - rect.left - this.panX) / this.scale;
    const y = (clientY - rect.top - this.panY) / this.scale;
    return { x, y };
  }

  private bindEvents(): void {
    // Mouse events
    this.svg.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', () => this.onMouseUp());
    this.svg.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    this.svg.addEventListener('dblclick', (e) => this.onDoubleClick(e));
    this.svg.addEventListener('contextmenu', (e) => this.onContextMenu(e));

    // Touch events for smartphone / tablet gestures
    this.svg.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    window.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    window.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });
    window.addEventListener('touchcancel', (e) => this.onTouchEnd(e), { passive: false });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      this.lastMousePress = null;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement
        || (e.target as HTMLElement)?.isContentEditable || (e.target as Element)?.closest?.('.modal-backdrop')) return;
      if ((e.key === 'Enter' || e.key === ' ') && this.referenceFromEvent(e)) return;
      if (e.key.startsWith('Arrow') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (document.querySelector('.modal-backdrop')) return;
        e.preventDefault();
        const step = e.shiftKey ? 160 : 40;
        this.panX += e.key === 'ArrowLeft' ? step : e.key === 'ArrowRight' ? -step : 0;
        this.panY += e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0;
        this.render(); return;
      }
      if (e.key === 'Tab' && (e.target as Element)?.closest?.('[data-crossref-source]')) return;
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'z' || key === 'y') {
          if (document.querySelector('.modal-backdrop')) return;
          e.preventDefault();
          if (key === 'y' || e.shiftKey) this.callbacks.onRedo?.(); else this.callbacks.onUndo?.();
          return;
        }
        if (key === 'a') { e.preventDefault();this.setMode('select');this.setElementSelection({componentIds:this.activePage.components.filter(c=>c.source?.routingUsed!==false).map(c=>c.id),textIds:(this.activePage.texts??[]).map(t=>t.id),cableIds:(this.activePage.cables ?? []).map(c=>c.id),imageIds:(this.activePage.images ?? []).map(c=>c.id),boxIds:(this.activePage.boxes ?? []).map(c=>c.id)});return; }
        if (key === 'g') { e.preventDefault();if(e.shiftKey)this.ungroupSelected();else this.groupSelected();return; }
        if (key === 'd') { e.preventDefault(); this.duplicateSelected(); return; }
        if (key === 'c') { e.preventDefault(); this.copySelected(); return; }
        if (key === 'x') { e.preventDefault(); this.cutSelected(); return; }
        if (key === 'v') { e.preventDefault(); this.paste(); return; }
      }
      
      if (e.key === 'Tab') {
        if (this.mode === 'place_symbol' && this.activeSymbolToPlace) {
          e.preventDefault();
          this.ghostRotation = ((this.ghostRotation + 90) % 360) as any;
          this.render();
        } else if (this.selectedComponentId) {
          e.preventDefault();
          this.rotateSelected();
        }
      } else if (e.key === 'Enter' || e.key === 'F2') {
        if(this.selectedImageId||this.selectedBoxId){e.preventDefault();this.callbacks.onOpenSelectionProperties?.();return;}
        if(this.multipleSelection){e.preventDefault();this.callbacks.onOpenSelectionProperties?.();return;}
        if(!this.selectedComponentId&&!this.selectedCableId&&!this.selectedWireId&&this.activePage.pageType==='cover'){e.preventDefault();this.callbacks.onOpenCoverPage?.();return;}
        if (this.selectedComponentId) {
          const comp = this.activePage.components.find(c => c.id === this.selectedComponentId);
          if (comp) {
            e.preventDefault();
            this.callbacks.onOpenProperties?.(comp);
          }
        }
      } else if (e.key === 'Insert' || e.key === 'e' || e.key === 'E') {
        this.callbacks.onOpenSymbolSelection?.();
      } else if (e.key === 'w' || e.key === 'W' || e.key === 'd' || e.key === 'D') {
        this.setMode(this.mode === 'wire' ? 'select' : 'wire');
      } else if (e.key === 'f' || e.key === 'F') {
        this.fitToScreen();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        this.deleteSelected();
      } else if (e.key === 'r' || e.key === 'R') {
        if (this.mode === 'place_symbol' && this.activeSymbolToPlace) {
          e.preventDefault();
          this.ghostRotation = ((this.ghostRotation + 90) % 360) as any;
          this.render();
        } else {
          this.rotateSelected();
        }
      } else if (e.key === 'Escape') {
        if(this.selectionDrag)translateSelection(this.activePage,this.selectionDrag.snapshot,0,0);
        this.selectionDrag=undefined;this.selectionWindow=undefined;this.setElementSelection(emptySelection());
        this.cancelBoxInteraction();this.mode = 'select';this.activeImageToPlace=undefined;
        this.cableStart = undefined;
        this.wireStart = null;
        this.activeSymbolToPlace = null;
        this.render();
      } else if (e.ctrlKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        this.duplicateSelected();
      } else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        this.setGridResolution(this.gridResolution === 'half' ? 'full' : 'half');
        this.callbacks.onProjectModified();
      } else if (e.altKey && e.key === '1') {
        e.preventDefault();
        this.setGridResolution('full');
        this.callbacks.onProjectModified();
      } else if (e.altKey && e.key === '2') {
        e.preventDefault();
        this.setGridResolution('half');
        this.callbacks.onProjectModified();
      } else if (e.altKey && e.key === '3') {
        e.preventDefault();
        this.setGridResolution('fine');
        this.callbacks.onProjectModified();
      } else if (e.altKey && e.key === '0') {
        e.preventDefault();
        this.setGridResolution('off');
        this.callbacks.onProjectModified();
      }
    });
  }

  private onDoubleClick(e: MouseEvent): void {
    if(this.selectedImageId||this.selectedBoxId){this.callbacks.onOpenSelectionProperties?.();return;}
    if(this.multipleSelection){this.callbacks.onOpenSelectionProperties?.();return;}
    if ((e.target as Element)?.closest?.('[data-crossref-source],[data-cable-id]')) return;
    const world = this.screenToWorld(e.clientX, e.clientY);
    const comp = this.componentFromEvent(e)??this.findComponentAt(world.x, world.y);
    if (comp) {
      this.callbacks.onOpenProperties?.(comp);
    } else if(this.activePage.pageType==='cover') {
      this.callbacks.onOpenCoverPage?.();
    }
  }

  private onContextMenu(e: MouseEvent): void {
    e.preventDefault();
    const world = this.screenToWorld(e.clientX, e.clientY);
    const targetBox=this.boxFromEvent(e),targetCable=this.cableFromEvent(e),targetImage=this.imageFromEvent(e),targetComp=this.componentFromEvent(e)??this.findComponentAt(world.x,world.y);
    const targetText=(e.target as Element)?.closest?.('[data-text-id]')?.getAttribute('data-text-id'),targetWire=!targetBox&&!targetCable&&!targetImage&&!targetComp?this.findWireAt(world.x,world.y):null;
    const key=targetBox?'boxIds':targetCable?'cableIds':targetImage?'imageIds':targetText?'textIds':targetComp?'componentIds':'wireIds';
    const id=targetText??(targetBox??targetCable??targetImage??targetComp??targetWire)?.id;
    if(id&&this.multipleSelection?.[key]?.includes(id)){this.showContextMenu(e.clientX,e.clientY,null,null);return;}
    if(targetText){this.setElementSelection({...emptySelection(),textIds:[targetText]});this.showContextMenu(e.clientX,e.clientY,null,null);return;}
    if(id){const hit={...emptySelection(),[key]:[id]};if(selectedRootGroups(this.activePage,hit).length){if(!this.getElementSelection()[key]?.includes(id))this.setElementSelection(hit);this.showContextMenu(e.clientX,e.clientY,null,null);return;}}
    const box=this.boxFromEvent(e);
    if(box){if(!this.multipleSelection?.boxIds?.includes(box.id))this.setElementSelection({componentIds:[],cableIds:[],boxIds:[box.id]});this.showContextMenu(e.clientX,e.clientY,null,null);return;}
    this.selectedBoxId=null;
    const comp = this.componentFromEvent(e)??this.findComponentAt(world.x, world.y),image=this.imageFromEvent(e);
    if(image){if(!this.multipleSelection?.imageIds?.includes(image.id))this.setElementSelection({componentIds:[],cableIds:[],imageIds:[image.id]});this.showContextMenu(e.clientX,e.clientY,null,null);return;}
    this.selectedImageId=null;this.selectedBoxId=null;
    if(this.multipleSelection && (comp && this.multipleSelection.componentIds.includes(comp.id) || this.cableFromEvent(e) && this.multipleSelection.cableIds.includes(this.cableFromEvent(e)!.id))){this.showContextMenu(e.clientX,e.clientY,null,null);return;}
    this.clearMultipleSelection();
    const wire = this.findWireAt(world.x, world.y);

    if (comp) {
      this.selectedComponentId = comp.id;
      this.selectedWireId = null;
      this.callbacks.onSelectComponent(comp);
      this.callbacks.onSelectWire(null);
      this.render();
    } else if (wire) {
      this.selectedWireId = wire.id;
      this.selectedComponentId = null;
      this.callbacks.onSelectWire(wire);
      this.callbacks.onSelectComponent(null);
      this.render();
    }

    this.showContextMenu(e.clientX, e.clientY, comp, wire);
  }

  private showContextMenu(clientX: number, clientY: number, comp: PlacedComponent | null, wire: Wire | null): void {
    const existing = document.getElementById('ecadContextMenu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'ecadContextMenu';
    menu.className = 'ecad-context-menu';
    menu.style.position = 'fixed';
    menu.style.left = `${clientX}px`;
    menu.style.top = `${clientY}px`;
    menu.style.zIndex = '3000';

    let items = '';
    if(this.multipleSelection){items=`<div class="ctx-header">${selectionCount(this.multipleSelection)} Elemente ausgewählt</div><div class="ctx-item" data-action="cut">✂️ Ausschneiden <span class="ctx-key">Strg+X</span></div><div class="ctx-item" data-action="copy">📋 Kopieren <span class="ctx-key">Strg+C</span></div><div class="ctx-item" data-action="duplicate">📑 Duplizieren <span class="ctx-key">Strg+D</span></div>${this.hasClipboard()?'<div class="ctx-item" data-action="paste">📥 Einfügen <span class="ctx-key">Strg+V</span></div>':''}<div class="ctx-sep"></div><div class="ctx-item" data-action="properties">Gemeinsame Eigenschaften… <span class="ctx-key">F2</span></div><div class="ctx-item ctx-danger" data-action="delete">Auswahl löschen <span class="ctx-key">Entf</span></div>`;}
    else if(this.selectedBoxId){items=`<div class="ctx-header">Gerätekasten</div><div class="ctx-item" data-action="cut">✂️ Ausschneiden <span class="ctx-key">Strg+X</span></div><div class="ctx-item" data-action="copy">📋 Kopieren <span class="ctx-key">Strg+C</span></div><div class="ctx-item" data-action="duplicate">📑 Duplizieren <span class="ctx-key">Strg+D</span></div>${this.hasClipboard()?'<div class="ctx-item" data-action="paste">📥 Einfügen <span class="ctx-key">Strg+V</span></div>':''}<div class="ctx-sep"></div><div class="ctx-item" data-action="properties">Eigenschaften… <span class="ctx-key">F2</span></div><div class="ctx-item ctx-danger" data-action="delete">Gerätekasten löschen <span class="ctx-key">Entf</span></div>`;}
    else if(this.selectedImageId){items=`<div class="ctx-header">Bild</div><div class="ctx-item" data-action="cut">✂️ Ausschneiden <span class="ctx-key">Strg+X</span></div><div class="ctx-item" data-action="copy">📋 Kopieren <span class="ctx-key">Strg+C</span></div><div class="ctx-item" data-action="duplicate">📑 Duplizieren <span class="ctx-key">Strg+D</span></div>${this.hasClipboard()?'<div class="ctx-item" data-action="paste">📥 Einfügen <span class="ctx-key">Strg+V</span></div>':''}<div class="ctx-sep"></div><div class="ctx-item" data-action="properties">Eigenschaften… <span class="ctx-key">F2</span></div><div class="ctx-item ctx-danger" data-action="delete">Bild löschen <span class="ctx-key">Entf</span></div>`;}
    else if (comp) {
      const sym = getSymbolForComponent(comp, this.project);
      items += `
        <div class="ctx-header"><strong>${escapeSvg(comp.bmk)}</strong> (${sym?.name || 'Bauteil'})</div>
        <div class="ctx-item" data-action="properties">⚙️ Eigenschaften... <span class="ctx-key">DblClick</span></div>
        <div class="ctx-item" data-action="rotate">🔄 Um 90° drehen <span class="ctx-key">R</span></div>
        <div class="ctx-item" data-action="cut">✂️ Ausschneiden <span class="ctx-key">Strg+X</span></div>
        <div class="ctx-item" data-action="copy">📋 Kopieren <span class="ctx-key">Strg+C</span></div>
        <div class="ctx-item" data-action="duplicate">📑 Duplizieren <span class="ctx-key">Strg+D</span></div>
        ${this.hasClipboard() ? '<div class="ctx-item" data-action="paste">📥 Einfügen <span class="ctx-key">Strg+V</span></div>' : ''}
        <div class="ctx-item" data-action="export-macro">📦 Als .ema Fenstermakro speichern...</div>
        ${comp.crossRef ? `<div class="ctx-item" data-action="jump-crossref">🔗 Querverweis folgen (${escapeSvg(comp.crossRef)})</div>` : ''}
        <div class="ctx-sep"></div>
        <div class="ctx-item ctx-danger" data-action="delete">🗑️ Löschen <span class="ctx-key">Entf</span></div>
      `;
    } else if (wire) {
      items += `
        <div class="ctx-header">Verbindung: <strong>${wire.potential}</strong></div>
        ${this.hasClipboard() ? '<div class="ctx-item" data-action="paste">📥 Einfügen <span class="ctx-key">Strg+V</span></div><div class="ctx-sep"></div>' : ''}
        <div class="ctx-item" data-action="delete">🗑️ Verbindung löschen <span class="ctx-key">Entf</span></div>
      `;
    } else {
      items += `
        ${this.hasClipboard() ? '<div class="ctx-item" data-action="paste">📥 Hier einfügen <span class="ctx-key">Strg+V</span></div><div class="ctx-sep"></div>' : ''}
        <div class="ctx-item" data-action="insert-sym">⚡ Symbol einfügen... <span class="ctx-key">Einfg</span></div>
        <div class="ctx-item" data-action="insert-macro">📦 Makro aus Bibliothek einfügen (.ema)...</div>
        <div class="ctx-item" data-action="wire">🔌 Verbinden / Verdrahten <span class="ctx-key">D</span></div>
        <div class="ctx-sep"></div>
        <div class="ctx-item" data-action="fit">🔍 Ansicht: Ganzes Blatt <span class="ctx-key">F</span></div>
        <div class="ctx-item" data-action="reset-zoom">📐 100% Zoom (1:1)</div>
        <div class="ctx-item" data-action="toggle-grid">📐 Raster: ${this.getGridLabel()} <span class="ctx-key">H</span></div>
      `;
    }

    if(this.canGroupSelection())items+='<div class="ctx-item" data-action="group">Gruppieren <span class="ctx-key">Strg+G</span></div>';
    if(this.canUngroupSelection())items+='<div class="ctx-item" data-action="ungroup">Gruppierung auflösen <span class="ctx-key">Strg+Umschalt+G</span></div>';
    menu.innerHTML = items;
    document.body.appendChild(menu);

    const closeMenu = () => menu.remove();
    setTimeout(() => {
      window.addEventListener('click', closeMenu, { once: true });
      window.addEventListener('contextmenu', closeMenu, { once: true });
    }, 10);

    menu.querySelectorAll('.ctx-item').forEach(el => {
      el.addEventListener('click', (e) => {
        const action = (e.currentTarget as HTMLElement).dataset.action;
        closeMenu();
        if(action==='group'){this.groupSelected();return;}
        if(action==='ungroup'){this.ungroupSelected();return;}
        if(action==='cut'){this.cutSelected();return;}
        if(action==='copy'){this.copySelected();return;}
        if(action==='paste'){this.paste(this.screenToWorld(clientX, clientY));return;}
        if(action==='properties' && (this.multipleSelection || this.selectedImageId || this.selectedBoxId)){this.callbacks.onOpenSelectionProperties?.();}
        else if (action === 'properties' && comp) {
          this.callbacks.onOpenProperties?.(comp);
        } else if (action === 'rotate') {
          this.rotateSelected();
        } else if (action === 'duplicate') {
          this.duplicateSelected();
        } else if (action === 'export-macro' && comp) {
          this.callbacks.onExportSelectedMacro?.([comp]);
        } else if (action === 'delete') {
          this.deleteSelected();
        } else if (action === 'insert-sym') {
          this.callbacks.onOpenSymbolSelection?.();
        } else if (action === 'insert-macro') {
          this.callbacks.onOpenMacroSelection?.();
        } else if (action === 'wire') {
          this.setMode('wire');
        } else if (action === 'fit') {
          this.fitToScreen();
        } else if (action === 'reset-zoom') {
          this.resetZoom();
        } else if (action === 'toggle-grid') {
          this.cycleGridResolution();
          this.callbacks.onProjectModified();
        } else if (action === 'jump-crossref' && comp?.crossRef) {
          this.followReference(comp);
        }
      });
    });
  }

  public placeSymbolAt(worldX: number, worldY: number): PlacedComponent | null {
    this.clearMultipleSelection();this.selectedBoxId=null;this.selectedImageId=null;
    if (!this.activeSymbolToPlace) return null;
    const sym = getSymbolById(this.activeSymbolToPlace, this.project);
    if (!sym) return null;

    const bmk = nextDeviceTag(this.project, sym.defaultBmkPrefix);

    const newComp: PlacedComponent = {
      id: 'comp_' + Math.random().toString(36).substring(2, 9),
      symbolId: sym.id,
      ...(sym.deviceBox?{deviceBox:geometryFromSymbol(sym)}:{}),
      bmk,
      higherLevelFunction: this.activePage.higherLevel,
      mountingLocation: this.activePage.location,
      functionText: sym.defaultFunctionText,
      technicalCharacteristics: sym.technicalCharacteristics || '',
      articleNumber: sym.articleNumber || '',
      manufacturer: sym.manufacturer || '',
      ...this.placementPosition(worldX, worldY, sym),
      rotation: this.ghostRotation || 0,
      pins: Object.fromEntries(sym.pins.map(pin => [pin.id, { customLabel: pin.name, wireIds: [] }]))
    };

    this.activePage.components.push(newComp);
    this.selectedComponentId = newComp.id;
    this.callbacks.onSelectComponent(newComp);
    if (this.autoconnectEnabled) {
      AutoconnectEngine.updatePageAutoconnections(this.activePage);
    }
    this.notifyModified();
    this.render();
    return newComp;
  }

  private handlePinClick(clickedPin: { componentId: string; pinId: string }): void {
    if (this.mode === 'wire' || this.wireStart !== null) {
      if (!this.wireStart) {
        this.wireStart = clickedPin;
        this.mode = 'wire';
      } else if (this.wireStart.componentId !== clickedPin.componentId || this.wireStart.pinId !== clickedPin.pinId) {
        // Complete wire
        const wire: Wire = {
          id: 'w_' + Math.random().toString(36).substring(2, 9),
          from: this.wireStart,
          to: clickedPin,
          potential: 'L1',
          color: 'BK',
          crossSection: '1.5mm²',
          ...(this.activePage.grid ? { lineWidth: this.activePage.grid.spacing / 16 } : {})
        };
        this.activePage.wires.push(wire);
        this.wireStart = null;
        this.notifyModified();
      }
      this.render();
    }
  }

  private onMouseDown(e: MouseEvent): void {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle click or Alt+Click -> Pan
      this.isPanning = true;
      this.startPan = { x: e.clientX - this.panX, y: e.clientY - this.panY };
      return;
    }

    if (e.button !== 0) return;
    if (!(this.mode==='select' && (e.ctrlKey||e.metaKey||e.shiftKey)) && this.referenceFromEvent(e)) return;
    this.referenceMarker = undefined;

    const world = this.screenToWorld(e.clientX, e.clientY);

    if (this.mode === 'place_symbol' && this.activeSymbolToPlace) {
      this.placeSymbolAt(world.x, world.y);
      return;
    }

    if (this.mode === 'place_macro' && this.activeMacroToPlace) {
      this.placeMacroAt(world.x, world.y, this.activeMacroToPlace);
      return;
    }

    if(this.mode==='device_box'){
      if(this.boxDraft){this.boxDraft.end=this.boxPoint(world);this.finishDeviceBox();}
      else this.boxDraft={start:this.boxPoint(world),end:this.boxPoint(world),pressing:true};
      this.updateSelectionOverlay();return;
    }
    if(this.startElementBoxResize(e))return;
    const resize=(e.target as Element)?.closest?.('[data-box-resize]');
    if(this.mode==='select' && resize){const box=this.boxFromEvent(e);if(box){this.boxResize={box,width:box.width,height:box.height};return;}}
    if(this.mode==='place_image'){this.placeImageAt(world);return;}
    if (this.mode === 'cable') { this.placeCablePoint(world); return; }
    if(this.mode==='select' && this.handleSelectionMouseDown(e,world))return;
    this.clearMultipleSelection();this.selectedImageId=null;this.selectedBoxId=null;
    const clickedCable = this.cableFromEvent(e);
    if (clickedCable) {
      this.selectCable(clickedCable);
      this.cableDrag={cable:clickedCable,start:{...clickedCable.start},end:{...clickedCable.end},origin:world,moved:false};
      return;
    }
    this.selectedCableId=null;this.callbacks.onSelectCable?.(null);

    // Check if clicked on a pin only in wire mode
    if (this.mode === 'wire' || this.wireStart !== null) {
      const clickedPin = this.findPinAt(world.x, world.y);
      if (clickedPin) {
        this.handlePinClick(clickedPin);
        return;
      }
    }

    // Check if clicked on a component
    const clickedComp = this.componentFromEvent(e)??this.findComponentAt(world.x, world.y, false);
    if (clickedComp) {
      // SVG redraw replaces DOM nodes between clicks. Recognize a double click
      // by the stable model identity, rather than relying on the removed target.
      const previous = this.lastMousePress;
      this.lastMousePress = { componentId: clickedComp.id, time: e.timeStamp };
      if (previous?.componentId === clickedComp.id && e.timeStamp - previous.time < 350) {
        this.lastMousePress = null;
        this.isDraggingComponent = false;
        this.callbacks.onOpenProperties?.(clickedComp);
        return;
      }
      this.selectedComponentId = clickedComp.id;
      this.selectedWireId = null;
      this.callbacks.onSelectComponent(clickedComp);
      this.callbacks.onSelectWire(null);

      this.isDraggingComponent = true;
      this.dragOffset = {
        x: world.x - clickedComp.x,
        y: world.y - clickedComp.y
      };
      this.updateSelectionClasses();
      return;
    }

    // Check if clicked on a wire
    const clickedWire = this.findWireAt(world.x, world.y);
    if (clickedWire) {
      this.selectedWireId = clickedWire.id;
      this.selectedComponentId = null;
      this.callbacks.onSelectWire(clickedWire);
      this.callbacks.onSelectComponent(null);
      this.updateSelectionClasses();
      if(this.mode==='select')this.beginSelectionWindow(e,world);
      return;
    }

    // Clicked empty background
    this.lastMousePress = null;
    this.selectedComponentId = null;
    this.selectedWireId = null;
    this.callbacks.onSelectComponent(null);
    this.callbacks.onSelectWire(null);
    this.updateSelectionClasses();
    if(this.mode==='select')this.beginSelectionWindow(e,world);
  }

  private onMouseMove(e: MouseEvent): void {
    if (this.isPanning) {
      this.panX = e.clientX - this.startPan.x;
      this.panY = e.clientY - this.startPan.y;
      this.render();
      return;
    }

    const world = this.screenToWorld(e.clientX, e.clientY);
    this.currentMousePos = world;

    if(this.elementBoxResize){this.resizeElementBox(world);return;}
    if(this.boxResize){this.resizeBox(world);return;}
    if(this.boxDraft){this.boxDraft.end=this.boxPoint(world);this.updateSelectionOverlay();return;}
    if(this.selectionWindow){
      const box=this.selectionWindow;box.end=world;
      box.moved ||= Math.hypot(e.clientX-box.client.x,e.clientY-box.client.y)>=3;
      this.updateSelectionOverlay();return;
    }
    if(this.selectionDrag){
      const step=this.getEffectiveGridSize(e.shiftKey||e.altKey),dx=snapCoordinate(world.x-this.selectionDrag.origin.x,step),dy=snapCoordinate(world.y-this.selectionDrag.origin.y,step);
      this.moveElementSelection(dx,dy);return;
    }
    if (this.cableDrag) { this.moveCable(world);return; }

    if (this.isDraggingComponent && this.selectedComponentId) {
      const comp = this.activePage.components.find(c => c.id === this.selectedComponentId);
      if (comp) {
        const sym = getSymbolForComponent(comp, this.project);
        const rawX = world.x - this.dragOffset.x;
        const rawY = world.y - this.dragOffset.y;
        const isModifier = e.shiftKey || e.altKey;
        if (sym) Object.assign(comp, snapSymbolPosition({ x: rawX, y: rawY }, sym, comp.rotation,
          gridForPage(this.activePage, this.gridSize), this.getEffectiveGridSize(isModifier)));
        const el = this.svg.getElementById(comp.id);
        if (el && sym) {
          el.setAttribute('transform', `translate(${comp.x}, ${comp.y}) rotate(${comp.rotation || 0}, ${sym.width / 2}, ${sym.height / 2})`);
        }
        this.updateConnectedWiresFast(comp.id);
        this.updateAutoconnectPreviewLayer();
      }
      return;
    }

    // Check hovered pin for visual snap highlight
    const pin = this.findPinAt(world.x, world.y);
    const pinChanged = (pin?.componentId !== this.hoveredPin?.componentId || pin?.pinId !== this.hoveredPin?.pinId);
    if (pinChanged) {
      this.hoveredPin = pin;
    }

    if (this.mode === 'place_image' || this.mode === 'cable' || this.mode === 'place_symbol' || this.mode === 'place_macro' || this.wireStart || pinChanged) {
      this.render();
    }
  }

  private onMouseUp(): void {
    if(this.elementBoxResize){const edit=this.elementBoxResize;this.elementBoxResize=undefined;if(JSON.stringify(edit.component)!==JSON.stringify(edit.original))this.notifyModified();this.render();}
    if(this.boxDraft?.pressing){this.boxDraft.pressing=false;this.finishDeviceBox();}
    if(this.boxResize){const resize=this.boxResize;this.boxResize=undefined;if(resize.width!==resize.box.width||resize.height!==resize.box.height)this.notifyModified();this.render();}
    if(this.selectionWindow){
      const box=this.selectionWindow;this.selectionWindow=undefined;
      if(box.moved){const found=elementsInWindow(this.activePage,this.project,box.start,box.end);this.setElementSelection({textIds:[...(box.additive?box.base.textIds??[]:[]),...(found.textIds??[])],wireIds:box.additive?box.base.wireIds??[]:[],componentIds:[...(box.additive?box.base.componentIds:[]),...found.componentIds],cableIds:[...(box.additive?box.base.cableIds:[]),...found.cableIds],imageIds:[...(box.additive?box.base.imageIds ?? []:[]),...(found.imageIds ?? [])],boxIds:[...(box.additive?box.base.boxIds ?? []:[]),...(found.boxIds ?? [])]});}
      this.updateSelectionOverlay();
    }
    if(this.selectionDrag){
      const moved=this.selectionDrag.dx!==0||this.selectionDrag.dy!==0;this.selectionDrag=undefined;
      if(moved){this.lastMousePress=null;for(const id of this.getElementSelection().componentIds)AutoconnectEngine.clearSuppressedForComponent(this.activePage,id);if(this.autoconnectEnabled && this.getElementSelection().componentIds.length)AutoconnectEngine.updatePageAutoconnections(this.activePage);this.notifyModified();}
      this.render();
    }
    if (this.cableDrag) { const moved=this.cableDrag.moved;this.cableDrag=undefined;if(moved)this.notifyModified();this.render(); }
    if (this.isPanning) {
      this.isPanning = false;
    }
    if (this.isDraggingComponent) {
      this.isDraggingComponent = false;
      if (this.selectedComponentId) {
        AutoconnectEngine.clearSuppressedForComponent(this.activePage, this.selectedComponentId);
      }
      if (this.autoconnectEnabled) {
        AutoconnectEngine.updatePageAutoconnections(this.activePage);
      }
      this.notifyModified();
      this.render();
    }
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    const newScale = Math.max(0.3, Math.min(3.0, this.scale * zoomFactor));
    this.panX = mouseX - (mouseX - this.panX) * (newScale / this.scale);
    this.panY = mouseY - (mouseY - this.panY) * (newScale / this.scale);
    this.scale = newScale;
    this.render();
  }

  private onTouchStart(e: TouchEvent): void {
    if (e.touches.length === 2) {
      e.preventDefault();
      if(this.selectionDrag){translateSelection(this.activePage,this.selectionDrag.snapshot,0,0);this.selectionDrag=undefined;this.render();}
      this.cancelBoxInteraction();this.touchMode = 'pinch';
      this.isDraggingComponent = false;
      this.isPanning = false;

      const t0 = e.touches[0];
      const t1 = e.touches[1];
      this.initialPinchDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      this.initialPinchScale = this.scale;
      this.initialPinchCenter = {
        x: (t0.clientX + t1.clientX) / 2,
        y: (t0.clientY + t1.clientY) / 2
      };
      this.initialPan = { x: this.panX, y: this.panY };
      return;
    }

    if (e.touches.length === 1) {
      if (this.referenceFromEvent(e)) return;
      this.referenceMarker = undefined;
      const touch = e.touches[0];
      const world = this.screenToWorld(touch.clientX, touch.clientY);

      if(this.mode==='select'&&!(e.target as Element)?.closest?.('[data-box-resize]')&&this.handleSelectionMouseDown(e as unknown as MouseEvent,world)){e.preventDefault();return;}
      if(this.mode==='device_box'){e.preventDefault();if(this.boxDraft){this.boxDraft.end=this.boxPoint(world);this.finishDeviceBox();}else this.boxDraft={start:this.boxPoint(world),end:this.boxPoint(world),pressing:true};return;}
      if(this.startElementBoxResize(e)){e.preventDefault();return;}
      const box=this.boxFromEvent(e);
      if(box && this.mode==='select'){
        e.preventDefault();
        if((e.target as Element)?.closest?.('[data-box-resize]')){this.boxResize={box,width:box.width,height:box.height};return;}
        const selection=this.getElementSelection();if(!selection.boxIds?.includes(box.id))this.setElementSelection({componentIds:[],cableIds:[],boxIds:[box.id]});
        const now=Date.now();if(now-this.lastTapTime<350&&this.lastTapComponentId===box.id){this.lastTapTime=0;this.callbacks.onOpenSelectionProperties?.();return;}
        this.lastTapTime=now;this.lastTapComponentId=box.id;
        this.selectionDrag={origin:world,snapshot:captureSelectionMove(this.activePage,this.getElementSelection()),dx:0,dy:0};return;
      }
      if(this.mode==='place_image'){e.preventDefault();this.placeImageAt(world);return;}
      const image=this.imageFromEvent(e);
      if(image && this.mode==='select'){e.preventDefault();const selection=this.getElementSelection();if(!selection.imageIds?.includes(image.id))this.setElementSelection({componentIds:[],cableIds:[],imageIds:[image.id]});this.selectionDrag={origin:world,snapshot:captureSelectionMove(this.activePage,this.getElementSelection()),dx:0,dy:0};return;}
      this.selectedImageId=null;this.selectedBoxId=null;
      if (this.mode === 'cable') { e.preventDefault();this.placeCablePoint(world);return; }
      const cable=this.cableFromEvent(e);
      if(cable){e.preventDefault();this.selectCable(cable);this.cableDrag={cable,start:{...cable.start},end:{...cable.end},origin:world,moved:false};return;}
      this.selectedCableId=null;this.callbacks.onSelectCable?.(null);

      this.clearMultipleSelection();

      // Symbol placing
      if (this.mode === 'place_symbol' && this.activeSymbolToPlace) {
        e.preventDefault();
        this.placeSymbolAt(world.x, world.y);
        this.mode = 'select';
        return;
      }

      // Macro placing
      if (this.mode === 'place_macro' && this.activeMacroToPlace) {
        e.preventDefault();
        this.placeMacroAt(world.x, world.y, this.activeMacroToPlace);
        this.mode = 'select';
        return;
      }

      // Check pin in wire mode only
      if (this.mode === 'wire' || this.wireStart !== null) {
        const clickedPin = this.findPinAt(world.x, world.y);
        if (clickedPin) {
          e.preventDefault();
          this.handlePinClick(clickedPin);
          return;
        }
      }

      // Check component (with finger touch hitbox padding)
      const clickedComp = this.componentFromEvent(e)??this.findComponentAt(world.x, world.y, true);
      if (clickedComp) {
        e.preventDefault();
        this.selectedComponentId = clickedComp.id;
        this.selectedWireId = null;
        this.callbacks.onSelectComponent(clickedComp);
        this.callbacks.onSelectWire(null);

        // Touch double-tap detection to open properties on mobile
        const now = Date.now();
        if (now - this.lastTapTime < 350 && this.lastTapComponentId === clickedComp.id) {
          this.callbacks.onOpenProperties?.(clickedComp);
          this.lastTapTime = 0;
          this.lastTapComponentId = null;
          return;
        }
        this.lastTapTime = now;
        this.lastTapComponentId = clickedComp.id;

        this.touchMode = 'drag';
        this.isDraggingComponent = true;
        this.dragOffset = {
          x: world.x - clickedComp.x,
          y: world.y - clickedComp.y
        };
        // DO NOT call this.render() here: keeping DOM intact avoids cancelling touch stream in Mobile Chrome
        this.updateSelectionClasses();
        return;
      }

      // Check wire (with touch padding)
      const clickedWire = this.findWireAt(world.x, world.y, true);
      if (clickedWire) {
        e.preventDefault();
        this.selectedWireId = clickedWire.id;
        this.selectedComponentId = null;
        this.callbacks.onSelectWire(clickedWire);
        this.callbacks.onSelectComponent(null);
        this.updateSelectionClasses();
        return;
      }

      // 1-finger pan on empty background
      this.touchMode = 'pan';
      this.isPanning = true;
      this.startPan = { x: touch.clientX - this.panX, y: touch.clientY - this.panY };
      this.selectedComponentId = null;
      this.selectedWireId = null;
      this.callbacks.onSelectComponent(null);
      this.callbacks.onSelectWire(null);
      this.updateSelectionClasses();
    }
  }

  private onTouchMove(e: TouchEvent): void {
    if(this.elementBoxResize&&e.touches.length===1){e.preventDefault();const t=e.touches[0];this.resizeElementBox(this.screenToWorld(t.clientX,t.clientY));return;}
    if((this.boxDraft||this.boxResize)&&e.touches.length===1){e.preventDefault();const touch=e.touches[0],world=this.screenToWorld(touch.clientX,touch.clientY);if(this.boxResize)this.resizeBox(world);else{this.boxDraft!.end=this.boxPoint(world);this.updateSelectionOverlay();}return;}
    if(this.selectionDrag && e.touches.length===1){e.preventDefault();const t=e.touches[0],world=this.screenToWorld(t.clientX,t.clientY),step=this.getEffectiveGridSize(false);this.moveElementSelection(snapCoordinate(world.x-this.selectionDrag.origin.x,step),snapCoordinate(world.y-this.selectionDrag.origin.y,step));return;}
    if (e.touches.length === 2 && this.touchMode === 'pinch') {
      e.preventDefault();
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      if (this.initialPinchDist > 0) {
        const pinchFactor = dist / this.initialPinchDist;
        const targetScale = Math.max(0.2, Math.min(3.5, this.initialPinchScale * pinchFactor));

        const centerScreenX = (t0.clientX + t1.clientX) / 2;
        const centerScreenY = (t0.clientY + t1.clientY) / 2;
        const deltaCenterX = centerScreenX - this.initialPinchCenter.x;
        const deltaCenterY = centerScreenY - this.initialPinchCenter.y;

        const rect = this.svg.getBoundingClientRect();
        const originX = this.initialPinchCenter.x - rect.left;
        const originY = this.initialPinchCenter.y - rect.top;

        this.panX = originX - (originX - this.initialPan.x) * (targetScale / this.initialPinchScale) + deltaCenterX;
        this.panY = originY - (originY - this.initialPan.y) * (targetScale / this.initialPinchScale) + deltaCenterY;
        this.scale = targetScale;

        this.render();
      }
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (this.touchMode === 'pan' && this.isPanning) {
        e.preventDefault();
        this.panX = touch.clientX - this.startPan.x;
        this.panY = touch.clientY - this.startPan.y;
        this.render();
        return;
      }

      if(this.cableDrag && e.touches.length===1){e.preventDefault();const t=e.touches[0];this.moveCable(this.screenToWorld(t.clientX,t.clientY));return;}

    if (this.touchMode === 'drag' && this.isDraggingComponent && this.selectedComponentId) {
        e.preventDefault();
        const world = this.screenToWorld(touch.clientX, touch.clientY);
        const comp = this.activePage.components.find(c => c.id === this.selectedComponentId);
        if (comp) {
          const sym = getSymbolForComponent(comp, this.project);
          const rawX = world.x - this.dragOffset.x;
          const rawY = world.y - this.dragOffset.y;
          if (sym) Object.assign(comp, snapSymbolPosition({ x: rawX, y: rawY }, sym, comp.rotation,
            gridForPage(this.activePage, this.gridSize), this.getEffectiveGridSize()));
          // Fast DOM update for smooth 60fps drag without replacing innerHTML:
          const el = this.svg.getElementById(comp.id);
          if (el && sym) {
            el.setAttribute('transform', `translate(${comp.x}, ${comp.y}) rotate(${comp.rotation || 0}, ${sym.width / 2}, ${sym.height / 2})`);
          }
          this.updateConnectedWiresFast(comp.id);
          this.updateAutoconnectPreviewLayer();
        }
      }
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    if(e.type==='touchcancel' && (this.boxDraft||this.boxResize||this.elementBoxResize)){this.cancelBoxInteraction();this.render();return;}
    if((this.cableDrag || this.selectionDrag || this.boxDraft || this.boxResize || this.elementBoxResize) && e.touches.length===0)this.onMouseUp();
    if (this.touchMode === 'pinch' && e.touches.length < 2) {
      this.touchMode = 'none';
    }

    if (this.touchMode === 'pan') {
      this.isPanning = false;
      this.touchMode = 'none';
    }

    if (this.touchMode === 'drag') {
      this.isDraggingComponent = false;
      this.touchMode = 'none';
      if (this.selectedComponentId) {
        AutoconnectEngine.clearSuppressedForComponent(this.activePage, this.selectedComponentId);
      }
      if (this.autoconnectEnabled) {
        AutoconnectEngine.updatePageAutoconnections(this.activePage);
      }
      this.notifyModified();
      this.render();
    }
  }

  private updateSelectionClasses(): void {
    this.svg.querySelectorAll('.device-box').forEach(el=>{const selected=!!this.getElementSelection().boxIds?.includes(el.id);el.classList.toggle('selected',selected);for(const selector of ['.box-selection-rect','.box-resize-handle'])el.querySelector(selector)?.setAttribute('visibility',selected?'visible':'hidden');});
    this.svg.querySelectorAll('.embedded-image').forEach(el=>{const selected=this.getElementSelection().imageIds?.includes(el.id);el.classList.toggle('selected',!!selected);(el.querySelector('.image-selection-rect') as SVGElement|null)?.setAttribute('visibility',selected?'visible':'hidden');});
    this.svg.querySelectorAll('.cable-definition').forEach(el=>{
      el.classList.toggle('selected',this.getElementSelection().cableIds.includes(el.id));
      el.setAttribute('color',this.getElementSelection().cableIds.includes(el.id)?'#63b3ed':'#e2e8f0');
    });
    this.svg.querySelectorAll('.component').forEach(el => {
      const isSel = this.getElementSelection().componentIds.includes(el.id);
      el.classList.toggle('selected', isSel);
      const handle=el.querySelector('.box-resize-handle') as SVGElement|null;if(handle)handle.style.display=isSel&&!this.multipleSelection?'block':'none';
      const selRect = el.querySelector('.selection-rect') as SVGElement | null;
      if (selRect) {
        selRect.style.display = isSel ? 'block' : 'none';
      }
    });
    this.svg.querySelectorAll('.wire').forEach(el => {
      el.classList.toggle('selected', el.id === this.selectedWireId||!!this.getElementSelection().wireIds?.includes(el.id));
    });
    this.updateSelectionOverlay();
  }

  private wirePoints(wire: Wire): { x: number; y: number }[] {
    const from = this.getPinCoordinates(wire.from.componentId, wire.from.pinId);
    const to = this.getPinCoordinates(wire.to.componentId, wire.to.pinId);
    if (!from || !to) return [];
    return wirePolyline(from, to, wire.waypoints,
      wirePinDirection(this.activePage, this.project, wire.from), wirePinDirection(this.activePage, this.project, wire.to),
      this.activePage.components.find(c => c.id === wire.from.componentId)?.symbolId === 'potential_rail_source', gridForPage(this.activePage, this.gridSize));
  }

  private updateConnectedWiresFast(componentId: string): void {
    const component = this.activePage.components.find(c => c.id === componentId);
    const symbol = component && getSymbolForComponent(component, this.project);
    const movingGlyph = component && symbol && isConnectionGraphic(component, symbol);
    const cutouts = connectionCutouts(this.activePage, this.project);
    for (const wire of this.activePage.wires) {
      if (!movingGlyph && wire.from.componentId !== componentId && wire.to.componentId !== componentId) continue;
      const points = this.wirePoints(wire);
      const wireEl = this.svg.getElementById(wire.id);
      if (!wireEl) continue;
      wireEl.querySelector('[data-wire-role="hit"]')?.setAttribute('d',
        points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' '));
      wireEl.querySelector('[data-wire-role="ink"]')?.setAttribute('d',
        visibleWireSegments(points, cutouts).map(([a, b]) => `M ${a.x} ${a.y} L ${b.x} ${b.y}`).join(' '));
    }
  }

  private notifyModified(): void {
    pruneElementGroups(this.activePage);
    CrossReferenceEngine.updateProjectCrossReferences(this.project);
    this.callbacks.onProjectModified();
  }

  private findComponentAt(x: number, y: number, isTouch: boolean = false): PlacedComponent | null {
    const pad = isTouch ? 20 : 6;
    let frame:PlacedComponent|null=null;
    for (let i = this.activePage.components.length - 1; i >= 0; i--) {
      const comp = this.activePage.components[i];
      const sym = getSymbolForComponent(comp, this.project);
      if (!sym) continue;
      
      const rot = comp.rotation || 0;
      const cx = comp.x + sym.width / 2;
      const cy = comp.y + sym.height / 2;
      let halfW = sym.width / 2;
      let halfH = sym.height / 2;
      if (rot === 90 || rot === 270) {
        halfW = sym.height / 2;
        halfH = sym.width / 2;
      }

      if (x >= cx - halfW - pad && x <= cx + halfW + pad && y >= cy - halfH - pad && y <= cy + halfH + pad) {
        if(comp.deviceBox){if(Math.min(Math.abs(x-(cx-halfW)),Math.abs(x-(cx+halfW)),Math.abs(y-(cy-halfH)),Math.abs(y-(cy+halfH)))<=pad)frame??=comp;continue;}
        return comp;
      }
    }
    return frame;
  }

  private componentFromEvent(event:Event):PlacedComponent|undefined {
    const id=(event.target as Element)?.closest?.('.component')?.getAttribute('id');return this.activePage.components.find(c=>c.id===id);
  }

  private findPinAt(x: number, y: number): { componentId: string; pinId: string } | null {
    const pinRadius = 8;
    for (const comp of this.activePage.components) {
      const sym = getSymbolForComponent(comp, this.project);
      if (!sym) continue;
      for (const pin of sym.pins) {
        const pCoord = this.getPinCoordinates(comp.id, pin.id);
        if (!pCoord) continue;
        const dist = Math.hypot(x - pCoord.x, y - pCoord.y);
        if (dist <= pinRadius) {
          return { componentId: comp.id, pinId: pin.id };
        }
      }
    }
    return null;
  }

  private findWireAt(x: number, y: number, isTouch: boolean = false): Wire | null {
    const hitTolerance = isTouch ? 22 : 12;
    for (const wire of this.activePage.wires) {
      const p1 = this.getPinCoordinates(wire.from.componentId, wire.from.pinId);
      const p2 = this.getPinCoordinates(wire.to.componentId, wire.to.pinId);
      if (!p1 || !p2) continue;

      const points = this.wirePoints(wire);
      if (points.slice(1).some((p, i) =>
        this.distToSegment(x, y, points[i].x, points[i].y, p.x, p.y) < hitTolerance)) return wire;
    }
    return null;
  }

  private distToSegment(x: number, y: number, x1: number, y1: number, x2: number, y2: number): number {
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) return Math.hypot(x - x1, y - y1);
    let t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(x - (x1 + t * (x2 - x1)), y - (y1 + t * (y2 - y1)));
  }

  public getPinCoordinates(componentId: string, pinId: string): { x: number; y: number } | null {
    const comp = this.activePage.components.find(c => c.id === componentId);
    if (!comp) return null;
    const sym = getSymbolForComponent(comp, this.project);
    if (!sym) return null;
    const pin = sym.pins.find(p => p.id === pinId);
    if (!pin) return null;

    const info = AutoconnectEngine.getRotatedPinInfo(comp, pin, sym);
    return { x: info.worldX, y: info.worldY };
  }

  /**
   * Main rendering loop (generates SVG DOM elements)
   */
  public render(): void {
    const pageWidth = this.activePage.plotFrame.width;
    const pageHeight = this.activePage.plotFrame.height;

    const effGrid = this.getEffectiveGridSize();
    const grid = gridForPage(this.activePage, this.gridSize);
    const patternSize = effGrid || grid.spacing;
    const dotRadius = patternSize <= 4 ? 0.6 : 0.75;
    const dotFill = this.gridSnap && this.gridResolution !== 'off' ? '#4a5568' : '#2d3748';

    this.svg.innerHTML = `
      <defs>
        <pattern id="cadGrid" x="${grid.origin.x}" y="${grid.origin.y}" width="${patternSize}" height="${patternSize}" patternUnits="userSpaceOnUse" overflow="visible">
          <circle cx="0" cy="0" r="${dotRadius}" fill="${dotFill}"/>
        </pattern>
      </defs>
      <g id="viewportTransform" transform="translate(${this.panX}, ${this.panY}) scale(${this.scale})">
        <!-- Page Paper -->
        <rect x="0" y="0" width="${pageWidth}" height="${pageHeight}" fill="#1a202c" stroke="#2d3748" stroke-width="2"/>
        <rect x="0" y="0" width="${pageWidth}" height="${pageHeight}" fill="url(#cadGrid)" style="display: ${this.gridSnap && this.gridResolution !== 'off' ? 'block' : 'none'};"/>
        
        <!-- DIN A3 Normblatt Plot Frame -->
        ${this.renderPlotFrame(pageWidth, pageHeight)}
        ${coverPageSvg(this.activePage, this.project)}

        <!-- Structure Boxes (Ortskästen / Schaltschrankumrahmungen) -->
        <g id="boxesLayer">
          ${this.renderBoxes()}
        </g>

        <!-- Wires -->
        <g id="wiresLayer">
          ${this.renderWires()}
        </g>


        <!-- Components -->
        <g id="componentsLayer">
          ${this.renderComponents()}
          ${this.referenceMarker ? `<circle class="reference-marker" cx="${this.referenceMarker.x}" cy="${this.referenceMarker.y}" r="14" fill="none" stroke="#f6ad55" stroke-width="2" pointer-events="none"/>` : ''}
        </g>

        <g id="cablesLayer">${this.renderCables()}</g>

        <!-- Embedded Images & Diagrams -->
        <g id="imagesLayer">
          ${this.renderImages()}
        </g>


        <!-- Free Texts & Annotations -->
        <g id="textsLayer">
          ${this.renderTexts()}
          ${drawingToSvg(this.activePage.importedDrawing?.graphics ?? [], { color: '#e2e8f0' })}
        </g>

        <!-- Live Autoconnect Previews (Cyan Dashed Guide Lines & Targets) -->
        <g id="autoconnectPreviewLayer">
          ${this.renderAutoconnectPreview()}
        </g>

        <!-- Interactive Temp Wire -->
        ${this.renderInteractiveWire()}

        <!-- Pin Hover Snap Highlight -->
        ${this.renderHoveredPin()}

        <!-- Ghost Symbol under Cursor (Placement Preview) -->
        ${this.renderGhostSymbol()}
        <g id="selectionOverlayLayer" pointer-events="none">${this.renderSelectionOverlay()}</g>
      </g>
    `;
  }

  private renderPlotFrame(w: number, h: number): string {
    return plotFrameSvg(this.activePage, this.project);
  }

  public getElementSelection():ElementSelection {
    return this.multipleSelection ?? {componentIds:this.selectedComponentId?[this.selectedComponentId]:[],cableIds:this.selectedCableId?[this.selectedCableId]:[],...(this.selectedImageId?{imageIds:[this.selectedImageId]}:{}),...(this.selectedBoxId?{boxIds:[this.selectedBoxId]}:{}),...(this.selectedWireId?{wireIds:[this.selectedWireId]}:{})};
  }

  public setElementSelection(selection:ElementSelection):void {
    const normalized=expandGroupedSelection(this.activePage,normalizeSelection(this.activePage,selection)),count=selectionCount(normalized);
    this.multipleSelection=count>1||normalized.textIds?.length?normalized:undefined;
    this.selectedComponentId=count===1?normalized.componentIds[0] ?? null:null;
    this.selectedBoxId=count===1?normalized.boxIds?.[0] ?? null:null;
    this.selectedImageId=count===1?normalized.imageIds?.[0] ?? null:null;
    this.selectedWireId=count===1?normalized.wireIds?.[0]??null:null;this.selectedCableId=count===1?normalized.cableIds[0] ?? null:null;
    const comp=this.activePage.components.find(c=>c.id===this.selectedComponentId) ?? null;
    const cable=this.activePage.cables?.find(c=>c.id===this.selectedCableId) ?? null;
    this.callbacks.onSelectComponent(comp);this.callbacks.onSelectWire(this.activePage.wires.find(w=>w.id===this.selectedWireId)??null);this.callbacks.onSelectCable?.(cable);
    this.selectedWireId=count===1?normalized.wireIds?.[0]??null:null;
    // Legacy selection callbacks may clear another primary ID.
    this.selectedComponentId=comp?.id ?? null;this.selectedCableId=cable?.id ?? null;
    this.callbacks.onSelectionChanged?.(normalized);this.updateSelectionClasses();
  }

  public canGroupSelection():boolean {return canGroupSelection(this.activePage,this.getElementSelection());}
  public canUngroupSelection():boolean {return selectedRootGroups(this.activePage,this.getElementSelection()).length>0;}
  public groupSelected():void {
    const selection=this.getElementSelection();if(!createElementGroup(this.activePage,selection))return;
    this.setElementSelection(selection);this.notifyModified();this.render();
  }
  public ungroupSelected():void {
    const selection=this.getElementSelection();if(!dissolveElementGroups(this.activePage,selection))return;
    this.setElementSelection(selection);this.notifyModified();this.render();
  }

  private clearMultipleSelection():void {
    if(!this.multipleSelection)return;
    this.multipleSelection=undefined;this.callbacks.onSelectionChanged?.(this.getElementSelection());
  }

  private handleSelectionMouseDown(e:MouseEvent,world:{x:number;y:number}):boolean {
    const box=this.boxFromEvent(e),cable=!box?this.cableFromEvent(e):undefined,image=!box&&!cable?this.imageFromEvent(e):undefined;
    const textId=(e.target as Element)?.closest?.('[data-text-id]')?.getAttribute('data-text-id');
    const component=box||cable||image||textId?null:this.componentFromEvent(e)??this.findComponentAt(world.x,world.y);
    const wire=box||cable||image||textId||component?null:this.findWireAt(world.x,world.y);
    if(!box&&!cable&&!component&&!image&&!wire&&!textId){if(e.ctrlKey||e.metaKey||e.shiftKey){this.beginSelectionWindow(e,world);return true;}return false;}
    const key=box?'boxIds':cable?'cableIds':image?'imageIds':textId?'textIds':wire?'wireIds':'componentIds',id=textId??(box??cable??image??wire??component)!.id;
    let current=this.getElementSelection();
    const hit=expandGroupedSelection(this.activePage,{...emptySelection(),[key]:[id]});
    if(e.ctrlKey||e.metaKey||e.shiftKey){
      const hitMembers=selectionMembers(hit),remove=!!current[key]?.includes(id),keys=new Set(hitMembers.map(m=>`${m.kind}:${m.id}`));
      const members=remove?selectionMembers(current).filter(m=>!keys.has(`${m.kind}:${m.id}`)):[...selectionMembers(current),...hitMembers];
      this.lastMousePress=null;this.setElementSelection(membersSelection(members));return true;
    }
    if(!current[key]?.includes(id)&&(selectionCount(hit)>1||textId||box||image)){
      this.setElementSelection(hit);current=this.getElementSelection();
    }
    if((this.multipleSelection||box||image)&&current[key]?.includes(id)){
      if(this.lastMousePress?.componentId===id&&e.timeStamp-this.lastMousePress.time<350){this.lastMousePress=null;this.callbacks.onOpenSelectionProperties?.();return true;}
      this.lastMousePress={componentId:id,time:e.timeStamp};
      this.selectionDrag={origin:world,snapshot:captureSelectionMove(this.activePage,current),dx:0,dy:0};return true;
    }
    return false;
  }

  private beginSelectionWindow(e:MouseEvent,world:{x:number;y:number}):void {
    this.selectionWindow={start:world,end:world,client:{x:e.clientX,y:e.clientY},moved:false,base:this.getElementSelection(),additive:e.ctrlKey||e.metaKey||e.shiftKey};
  }

  private moveElementSelection(dx:number,dy:number):void {
    const drag=this.selectionDrag!;drag.dx=dx;drag.dy=dy;translateSelection(this.activePage,drag.snapshot,dx,dy);
    for(const original of drag.snapshot.components){
      const c=this.activePage.components.find(c=>c.id===original.id)!,sym=getSymbolForComponent(c,this.project);
      if(sym)this.svg.getElementById(c.id)?.setAttribute('transform',`translate(${c.x},${c.y}) rotate(${c.rotation || 0},${sym.width/2},${sym.height/2})`);
    }
    for(const original of drag.snapshot.boxes ?? [])this.svg.getElementById(original.id)?.setAttribute('transform',`translate(${dx},${dy})`);
    for(const original of drag.snapshot.images ?? [])this.svg.getElementById(original.id)?.setAttribute('transform',`translate(${dx},${dy})`);
    for(const original of drag.snapshot.texts??[])this.svg.getElementById(original.id)?.setAttribute('transform',`translate(${dx},${dy})`);
    for(const original of drag.snapshot.cables)this.svg.getElementById(original.id)?.setAttribute('transform',`translate(${dx},${dy})`);
    const wires=this.svg.getElementById('wiresLayer');if(wires)wires.innerHTML=this.renderWires();this.updateSelectionOverlay();
  }

  private renderSelectionOverlay():string {
    if(this.boxDraft){const {start,end}=this.boxDraft;return `<rect class="device-box-preview" x="${Math.min(start.x,end.x)}" y="${Math.min(start.y,end.y)}" width="${Math.abs(end.x-start.x)}" height="${Math.abs(end.y-start.y)}" fill="none" stroke="#63b3ed" stroke-width="1.2"/>`;}
    const box=this.selectionWindow;
    if(box?.moved){const x=Math.min(box.start.x,box.end.x),y=Math.min(box.start.y,box.end.y);return `<rect class="selection-marquee" x="${x}" y="${y}" width="${Math.abs(box.end.x-box.start.x)}" height="${Math.abs(box.end.y-box.start.y)}" fill="#63b3ed22" stroke="#63b3ed" stroke-width="1" vector-effect="non-scaling-stroke" stroke-dasharray="5 3"/>`;}
    if(!this.multipleSelection)return '';
    const bounds=selectionBounds(this.activePage,this.project,this.multipleSelection);if(!bounds)return '';
    return `<rect class="selection-group-outline" x="${bounds.left-6}" y="${bounds.top-6}" width="${bounds.right-bounds.left+12}" height="${bounds.bottom-bounds.top+12}" fill="none" stroke="#63b3ed" stroke-dasharray="6 4" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
  }

  private updateSelectionOverlay():void {
    const layer=this.svg.getElementById('selectionOverlayLayer');if(layer)layer.innerHTML=this.renderSelectionOverlay();
  }

  private boxFromEvent(e:Event):PageBox|undefined {
    const id=(e.target as Element)?.closest?.('[data-box-id]')?.getAttribute('data-box-id');return this.activePage.boxes?.find(c=>c.id===id);
  }

  private imageFromEvent(e:Event):PageImage|undefined {
    const id=(e.target as Element)?.closest?.('[data-image-id]')?.getAttribute('data-image-id');return this.activePage.images?.find(c=>c.id===id);
  }

  private cableFromEvent(e: Event): CableDefinition | undefined {
    const id=(e.target as Element)?.closest?.('[data-cable-id]')?.getAttribute('data-cable-id');
    return this.activePage.cables?.find(c=>c.id===id);
  }

  public selectCable(cable: CableDefinition): void {
    this.clearMultipleSelection();
    this.selectedComponentId=null;this.selectedWireId=null;this.selectedImageId=null;this.selectedBoxId=null;
    this.callbacks.onSelectComponent(null);this.callbacks.onSelectWire(null);
    this.selectedCableId=cable.id;this.callbacks.onSelectCable?.(cable);this.updateSelectionClasses();
  }

  private placeCablePoint(world:{x:number;y:number}):void {
    const point={x:this.snap(world.x,false,'x'),y:this.snap(world.y,false,'y')};
    if(!this.cableStart){this.cableStart=point;this.render();return;}
    const start=this.cableStart,dx=point.x-start.x,dy=point.y-start.y;
    const end=Math.abs(dx)>=Math.abs(dy)?{x:point.x,y:start.y}:{x:start.x,y:point.y};
    if(Math.hypot(end.x-start.x,end.y-start.y)<1e-6)return;
    const maxNumber=Math.max(0,...this.project.pages.flatMap(p=>p.cables ?? []).map(c=>Number(c.bmk.match(/^-W(\d+)$/)?.[1])||0));
    const cable:CableDefinition={id:'cable_'+crypto.randomUUID(),start:{...start},end,bmk:'-W'+(maxNumber+1),cableType:'',crossSection:'',markStyle:'slash',cores:[]};
    cable.cores=cableCrossings(cable,this.activePage,this.project).map((p,i)=>({id:cable.id+'_'+i,t:p.t,wireIds:p.wireIds}));cable.coreCount=cable.cores.length || undefined;
    (this.activePage.cables ??=[]).push(cable);this.cableStart=undefined;this.mode='select';this.selectCable(cable);this.notifyModified();this.render();
  }

  private moveCable(world:{x:number;y:number}):void {
    const drag=this.cableDrag!;
    const dx=this.snap(drag.start.x+world.x-drag.origin.x,false,'x')-drag.start.x,dy=this.snap(drag.start.y+world.y-drag.origin.y,false,'y')-drag.start.y;
    drag.cable.start={x:drag.start.x+dx,y:drag.start.y+dy};drag.cable.end={x:drag.end.x+dx,y:drag.end.y+dy};drag.moved=dx!==0||dy!==0;
    this.svg.getElementById(drag.cable.id)?.setAttribute('transform',`translate(${dx},${dy})`);
  }

  private renderCables():string {
    const preview=this.cableStart ? `<line x1="${this.cableStart.x}" y1="${this.cableStart.y}" x2="${Math.abs(this.currentMousePos.x-this.cableStart.x)>=Math.abs(this.currentMousePos.y-this.cableStart.y)?this.currentMousePos.x:this.cableStart.x}" y2="${Math.abs(this.currentMousePos.x-this.cableStart.x)>=Math.abs(this.currentMousePos.y-this.cableStart.y)?this.cableStart.y:this.currentMousePos.y}" stroke="#63b3ed" stroke-dasharray="4 3" pointer-events="none"/>` : '';
    return (this.activePage.cables ?? []).map(c=>cableSvg(c,this.activePage,this.project,this.getElementSelection().cableIds.includes(c.id))).join('')+preview;
  }

  private renderComponents(): string {
    const superseded = supersededConnectionGraphics(this.activePage, this.project);
    const graphicWires = connectionGraphicWires(this.activePage, this.project);
    const labelText = (text: string, x: number, size: number): string => {
      if (!text.includes('\n')) return escapeSvg(text);
      return text.split(/\r?\n/).map((line, i) => `<tspan x="${x}" dy="${i ? size * 1.2 : 0}">${escapeSvg(line)}</tspan>`).join('');
    };
    const ordered=[...this.activePage.components.filter(c=>c.deviceBox),...this.activePage.components.filter(c=>!c.deviceBox)];
    return ordered.map(comp => {
      const sym = getSymbolForComponent(comp, this.project);
      if (!sym) return '';

      const isConn = !sym.importedGraphics && (sym.category === 'connections' || sym.id.startsWith('potential_arrow') || sym.id === 'potential_rail_source');
      const isTerminal = sym.id === 'terminal_single';
      const isSelected = this.getElementSelection().componentIds.includes(comp.id);
      const connectedWire = graphicWires.get(comp.id);
      const strokeColor = isSelected ? '#63b3ed' : comp.deviceBox?.color??(isConnectionGraphic(comp, sym)
        ? this.getWireColor(connectedWire?.potential ?? 'Signal', connectedWire?.color) : '#e2e8f0');

      const bmkPos = computeBmkPosition(comp, sym);
      const fnPos = computeFunctionTextPosition(comp, sym);
      const arrowPos = interruptionLabelPosition(this.project, comp, sym);
      if (arrowPos) Object.assign(fnPos, arrowPos, { transform: labelTransform(arrowPos.x, arrowPos.y, comp.rotation) });
      const techPos = computeTechnicalDataPosition(comp, sym);
      const additionalPos = computeAdditionalTextPosition(comp, sym);
      const techText = comp.deviceTag
        ? (comp.deviceTag + (comp.technicalCharacteristics ? ' · ' + comp.technicalCharacteristics : ''))
        : (comp.technicalCharacteristics || '');

      // Cross Reference text / Contact mirror (placed below technical data)
      let crossRefDisplay = '';
      const refPos = computeCrossReferencePosition(comp, sym, this.project);
      if (comp.crossRef && refPos.visible && (!isConn || isInterruptionSymbol(sym))) {
        crossRefDisplay = `<text class="cross-reference" ${refPos.transform} x="${refPos.x}" y="${refPos.y}" font-size="${refPos.fontSize}" font-family="monospace" fill="#f6ad55" text-anchor="${refPos.anchor}">${referenceMarkup(this.project, comp, true)}</text>`;
      }

      // Pins render
      const pinsSvg = sym.pins.map(pin => {
        if (sym.source || pin.labelPosition || comp.pins[pin.id]?.labelPosition) {
          const label = comp.pins[pin.id]?.labelPosition ?? pin.labelPosition;
          const handle = !sym.source || this.mode === 'wire' || this.wireStart
            ? `<circle class="pin-handle" cx="${pin.x}" cy="${pin.y}" r="3" fill="#2d3748" stroke="#63b3ed" stroke-width="1.2"/>` : '';
          const text = label && label.visible !== false
            ? `<text class="source-pin-label" x="${label.x}" y="${label.y}" font-size="${comp.pinLabelFontSize ?? label.fontSize}" font-family="Tahoma, Arial, sans-serif" fill="#e2e8f0" text-anchor="${label.alignment}" ${labelTransform(label.x, label.y, comp.rotation, label.rotation)}>${escapeSvg(comp.pins[pin.id]?.customLabel ?? pin.name)}</text>` : '';
          return `<g class="pin">${handle}${text}</g>`;
        }
        if (isConn || isTerminal) {
          return `
            <g class="pin" transform="translate(${pin.x}, ${pin.y})">
              <circle cx="0" cy="0" r="2.5" fill="transparent"/>
            </g>
          `;
        }
        return `
          <g class="pin" transform="translate(${pin.x}, ${pin.y})">
            <circle cx="0" cy="0" r="3" fill="#2d3748" stroke="#63b3ed" stroke-width="1.2"/>
            <text ${labelTransform(pin.direction === 'top' ? 0 : 5, pin.direction === 'top' ? -4 : 3.5, comp.rotation)} x="${pin.direction === 'top' ? 0 : 5}" y="${pin.direction === 'top' ? -4 : 3.5}" font-size="${comp.pinLabelFontSize ?? 6.5}" font-family="monospace" fill="#a0aec0" text-anchor="${pin.direction === 'top' ? 'middle' : 'start'}">${escapeSvg(comp.pins[pin.id]?.customLabel ?? pin.name)}</text>
          </g>
        `;
      }).join('');

      return `
        <g id="${comp.id}" class="component ${comp.deviceBox?'device-box ':''}${isSelected ? 'selected' : ''}"
           transform="translate(${comp.x}, ${comp.y}) rotate(${comp.rotation || 0}, ${sym.width / 2}, ${sym.height / 2})"
           style="cursor: pointer;">
          
          ${comp.deviceBox?`<rect class="box-hit-target" x="0" y="0" width="${sym.width}" height="${sym.height}" fill="none" stroke="transparent" stroke-width="12" vector-effect="non-scaling-stroke" pointer-events="stroke"/>`:''}
          <!-- Selection Highlight -->
          <rect class="selection-rect" pointer-events="none" x="${comp.deviceBox?0:-8}" y="${comp.deviceBox?0:-8}" width="${sym.width + (comp.deviceBox?0:16)}" height="${comp.deviceBox?sym.height:isConn ? sym.height + 16 : sym.height + 36}" fill="${comp.deviceBox?'none':'rgba(99, 179, 237, 0.15)'}" stroke="#63b3ed" stroke-width="1.5" stroke-dasharray="3,2" rx="4" style="display: ${isSelected ? 'block' : 'none'};"/>

          ${!isConn && !isTerminal ? `
            <!-- BMK Label (z.B. -K1, -Q1) -->
            ${bmkPos.visible ? `
              <text data-label="bmkPosition" x="${bmkPos.x}" y="${bmkPos.y}" font-size="${bmkPos.fontSize}" font-weight="bold" font-family="monospace" fill="${escapeSvg(bmkPos.fontColor || '#f6e05e')}" text-anchor="${bmkPos.anchor}" ${bmkPos.transform}>${labelText(comp.bmk, bmkPos.x, bmkPos.fontSize)}</text>
            ` : ''}
            
            <!-- Function text (Funktionstext) -->
            ${fnPos.visible && comp.functionText ? `
              <text data-label="functionTextPosition" x="${fnPos.x}" y="${fnPos.y}" font-size="${fnPos.fontSize}" font-weight="${fnPos.fontWeight || 'normal'}" font-family="sans-serif" fill="${escapeSvg(fnPos.fontColor || '#e2e8f0')}" text-anchor="${fnPos.anchor}" ${fnPos.transform}>${labelText(comp.functionText, fnPos.x, fnPos.fontSize)}</text>
            ` : ''}

            <!-- Device Tag / Technical Characteristics -->
            ${techPos.visible && techText ? `
              <text data-label="technicalDataPosition" x="${techPos.x}" y="${techPos.y}" font-size="${techPos.fontSize}" font-family="sans-serif" fill="${escapeSvg(techPos.fontColor || '#68d391')}" text-anchor="${techPos.anchor}" ${techPos.transform}>${labelText(techText, techPos.x, techPos.fontSize)}</text>
            ` : ''}

            <!-- Cross Reference -->
          ` : isTerminal ? `
            <!-- Terminal designation and BMK -->
            <text ${labelTransform(sym.width + 2, sym.height / 2 + 3, comp.rotation)} x="${sym.width + 2}" y="${sym.height / 2 + 3}" font-size="${comp.pinLabelFontSize ?? 7.5}" font-weight="bold" font-family="monospace" fill="#cbd5e0">${comp.deviceTag || comp.technicalCharacteristics || comp.functionText || '1'}</text>
            ${comp.bmk && bmkPos.visible && !comp.bmk.startsWith('comp_') ? `
              <text ${bmkPos.transform} x="${bmkPos.x}" y="${bmkPos.y}" font-size="${bmkPos.fontSize}" font-weight="bold" font-family="monospace" fill="#f6e05e" text-anchor="${bmkPos.anchor}">${labelText(comp.bmk, bmkPos.x, bmkPos.fontSize)}</text>
            ` : ''}
          ` : (isInterruptionSymbol(sym) || sym.id === 'potential_rail_source' ? (() => {
            const pos = arrowPos ?? { x: -4, y: sym.height / 2 + 3, anchor: 'end' };
            return `<text x="${pos.x}" y="${pos.y}" ${labelTransform(pos.x, pos.y, comp.rotation)} font-size="${comp.functionTextPosition?.fontSize ?? 8.5}" font-weight="bold" font-family="monospace" fill="#f56565" text-anchor="${pos.anchor}">${escapeSvg(comp.functionText || comp.bmk)}</text>`;
          })() : '')}

          ${additionalPos.visible && comp.additionalText ? `<text data-label="additionalTextPosition" class="additional-text" x="${additionalPos.x}" y="${additionalPos.y}" font-size="${additionalPos.fontSize}" font-family="sans-serif" fill="${escapeSvg(additionalPos.fontColor || '#e2e8f0')}" text-anchor="${additionalPos.anchor}" ${additionalPos.transform}>${labelText(comp.additionalText, additionalPos.x, additionalPos.fontSize)}</text>` : ''}

          ${crossRefDisplay}

          <!-- Symbol Vector Graphics -->
          <g color="${strokeColor}" ${comp.deviceBox?'pointer-events="none"':''}>
            ${superseded.has(comp.id) || comp.source?.routingUsed === false && !isSelected ? '' : sym.importedGraphics ? drawingToSvg(sym.importedGraphics, { color: 'currentColor', componentRotation: comp.rotation }) : uprightSymbolSvg(sym.svgContent, comp.rotation)}
          </g>

          <!-- Terminal Pins -->
          ${pinsSvg}
          ${comp.deviceBox?`<rect class="box-resize-handle" data-element-box-resize="${comp.id}" x="${sym.width-4}" y="${sym.height-4}" width="8" height="8" fill="#63b3ed" style="cursor:nwse-resize;display:${isSelected&&!this.multipleSelection?'block':'none'}"/>`:''}
        </g>
      `;
    }).join('');
  }

  private renderTexts(): string {
    if (!this.activePage.texts || this.activePage.texts.length === 0) return '';
    return this.activePage.texts.map(t => {
      const isHeader = t.fontSize && t.fontSize >= 11;
      const color = t.fontColor || (isHeader ? '#63b3ed' : '#cbd5e0');
      const weight = t.fontWeight || (isHeader ? 'bold' : 'normal');
      const size = t.fontSize || 9;
      const rot = t.rotation ? `transform="rotate(${t.rotation}, ${t.x}, ${t.y})"` : '';
      return `<g id="${escapeSvg(t.id)}" data-text-id="${escapeSvg(t.id)}" style="cursor:move"><text x="${t.x}" y="${t.y}" font-size="${size}" font-family="sans-serif" font-weight="${weight}" fill="${color}" ${rot} pointer-events="all">${escapeSvg(t.text)}</text></g>`;
    }).join('');
  }

  private renderImages(): string {
    if (!this.activePage.images || this.activePage.images.length === 0) return '';
    return this.activePage.images.map(img => `
      <g id="${escapeSvg(img.id)}" data-image-id="${escapeSvg(img.id)}" class="embedded-image ${this.getElementSelection().imageIds?.includes(img.id)?'selected':''}" style="cursor:move">
        <rect x="${img.x}" y="${img.y}" width="${img.width}" height="${img.height}" fill="transparent" pointer-events="all"/>
        <image href="${escapeSvg(img.dataUrl)}" x="${img.x}" y="${img.y}" width="${img.width}" height="${img.height}" preserveAspectRatio="xMidYMid meet" pointer-events="none"/>
        <rect class="image-selection-rect" x="${img.x}" y="${img.y}" width="${img.width}" height="${img.height}" fill="none" stroke="#63b3ed" stroke-width="1.5" stroke-dasharray="5 3" vector-effect="non-scaling-stroke" pointer-events="none" visibility="${this.getElementSelection().imageIds?.includes(img.id)?'visible':'hidden'}"/>
      </g>
    `).join('');
  }

  private renderBoxes(): string {
    return (this.activePage.boxes ?? []).map(box=>boxSvg(box,!!this.getElementSelection().boxIds?.includes(box.id))).join('');
  }


  private renderWires(): string {
    // native CAD junction ink is supplied by its library variant. Only the original
    // built-in symbols retain the editor's dot at a multiply connected pin.
    const pinCounts = new Map<string, { count: number; x: number; y: number }>();
    for (const wire of this.activePage.wires) {
      for (const endpoint of [wire.from, wire.to]) {
        const comp = this.activePage.components.find(c => c.id === endpoint.componentId);
        if (!comp || getSymbolForComponent(comp, this.project)?.source) continue;
        const point = this.getPinCoordinates(endpoint.componentId, endpoint.pinId);
        if (!point) continue;
        const key = `${endpoint.componentId}:${endpoint.pinId}`;
        const previous = pinCounts.get(key);
        pinCounts.set(key, { ...point, count: (previous?.count ?? 0) + 1 });
      }
    }
    const cutouts = connectionCutouts(this.activePage, this.project);
    const wiresHtml = this.activePage.wires.map(wire => {
      const points = this.wirePoints(wire);
      if (!points.length) return '';
      const pathData = points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
      const ink = visibleWireSegments(points, cutouts).map(([a, b]) => `M ${a.x} ${a.y} L ${b.x} ${b.y}`).join(' ');
      const isSelected = wire.id === this.selectedWireId||!!this.getElementSelection().wireIds?.includes(wire.id);
      const width = wire.lineWidth ?? 2;
      return `
        <g id="${wire.id}" class="wire ${isSelected ? 'selected' : ''}" style="cursor: pointer;">
          <path data-wire-role="hit" d="${pathData}" fill="none" stroke="transparent" stroke-width="12"/>
          <path data-wire-role="ink" d="${ink}" fill="none" stroke="${isSelected ? '#63b3ed' : this.getWireColor(wire.potential, wire.color)}" stroke-width="${isSelected ? Math.max(width, 2.5) : width}"/>
        </g>
      `;
    }).join('');
    const dots = [...pinCounts.values()].filter(p => p.count >= 2).map(p =>
      `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#e2e8f0" stroke="#1a202c" stroke-width="1" class="junction-dot"/>`).join('');
    return wiresHtml + dots;
  }

  private renderAutoconnectPreview(): string {
    let previews: AutoconnectPreviewSegment[] = [];

    if (this.mode === 'place_symbol' && this.activeSymbolToPlace) {
      const tempComp: PlacedComponent = {
        id: '__ghost__',
        symbolId: this.activeSymbolToPlace,
        bmk: '',
        functionText: '',
        ...this.placementPosition(this.currentMousePos.x, this.currentMousePos.y, getSymbolById(this.activeSymbolToPlace, this.project)!),
        rotation: this.ghostRotation || 0,
        pins: {}
      };
      previews = AutoconnectEngine.getAutoconnectPreview(this.activePage.components, tempComp, this.activePage);
    } else if (this.isDraggingComponent && this.selectedComponentId) {
      const comp = this.activePage.components.find(c => c.id === this.selectedComponentId);
      if (comp) {
        previews = AutoconnectEngine.getAutoconnectPreview(this.activePage.components, comp, this.activePage);
      }
    }

    if (previews.length === 0) return '';

    return previews.map(p => `
      <g class="autoconnect-preview" pointer-events="none">
        <line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="#00f0ff" stroke-width="2" stroke-dasharray="4,3"/>
        <circle cx="${p.targetX}" cy="${p.targetY}" r="7" fill="rgba(0, 240, 255, 0.25)" stroke="#00f0ff" stroke-width="1.5"/>
        <circle cx="${p.targetX}" cy="${p.targetY}" r="3" fill="#00f0ff"/>
        <circle cx="${p.x1}" cy="${p.y1}" r="3" fill="#00f0ff"/>
      </g>
    `).join('');
  }

  private updateAutoconnectPreviewLayer(): void {
    const layer = this.svg.getElementById('autoconnectPreviewLayer');
    if (layer) {
      layer.innerHTML = this.renderAutoconnectPreview();
    }
  }

  private renderInteractiveWire(): string {
    if (!this.wireStart) return '';
    const startCoord = this.getPinCoordinates(this.wireStart.componentId, this.wireStart.pinId);
    if (!startCoord) return '';

    const targetPin = this.hoveredPin && this.getPinCoordinates(this.hoveredPin.componentId, this.hoveredPin.pinId);
    const target = targetPin || { x: this.snap(this.currentMousePos.x), y: this.snap(this.currentMousePos.y, false, 'y') };
    const points = wirePolyline(startCoord, target, [], undefined, undefined, false, gridForPage(this.activePage, this.gridSize));
    const pathData = points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');

    return `
      <path d="${pathData}" fill="none" stroke="#63b3ed" stroke-width="2" stroke-dasharray="4,4"/>
      <circle cx="${startCoord.x}" cy="${startCoord.y}" r="4" fill="#63b3ed"/>
      <circle cx="${target.x}" cy="${target.y}" r="3" fill="#63b3ed"/>
    `;
  }

  private getWireColor(potential: string, customColor?: string): string {
    if (customColor) {
      if (customColor === 'RD') return '#fc8181';
      if (customColor === 'BU') return '#63b3ed';
      if (customColor === 'GNYE') return '#68d391';
      if (customColor === 'BK') return '#e2e8f0';
    }
    if (potential === 'PE') return '#68d391';
    if (potential === 'N') return '#63b3ed';
    if (potential === '+24V') return '#fc8181';
    if (potential === '0V') return '#4299e1';
    return '#cbd5e0';
  }

  private renderHoveredPin(): string {
    if (!this.hoveredPin) return '';
    const coord = this.getPinCoordinates(this.hoveredPin.componentId, this.hoveredPin.pinId);
    if (!coord) return '';

    return `
      <g class="pin-hover-marker" transform="translate(${coord.x}, ${coord.y})" pointer-events="none">
        <circle cx="0" cy="0" r="8" fill="none" stroke="#68d391" stroke-width="2" stroke-dasharray="3,2"/>
        <circle cx="0" cy="0" r="2.5" fill="#68d391"/>
      </g>
    `;
  }

  private renderGhostSymbol(): string {
    if(this.mode==='place_image' && this.activeImageToPlace){const p=this.currentMousePos,i=this.activeImageToPlace;return `<image href="${escapeSvg(i.dataUrl)}" x="${this.snap(p.x,false,'x')}" y="${this.snap(p.y,false,'y')}" width="${i.width}" height="${i.height}" opacity=".55" pointer-events="none"/>`;}
    if (this.mode === 'place_macro' && this.activeMacroToPlace) {
      const macro = this.activeMacroToPlace;
      const { x: gx, y: gy } = this.macroPlacementPosition(this.currentMousePos.x, this.currentMousePos.y, macro);
      const factor = MacroManager.getMacroScale(macro, this.project);

      let componentsGhost = '';
      for (const c of macro.components) {
        const sym = getSymbolForComponent(scalePlacedComponent(c,factor), { ...this.project, symbolLibrary: [...(this.project.symbolLibrary ?? []), ...(macro.symbolLibrary ?? [])] });
        if (sym) {
          const fn = computeFunctionTextPosition(scalePlacedComponent(c, factor), sym);
          componentsGhost += `
            <g transform="translate(${c.x * factor}, ${c.y * factor}) rotate(${c.rotation || 0}, ${sym.width / 2}, ${sym.height / 2})">
              <g color="#63b3ed" stroke="#63b3ed" fill="none">
                ${sym.importedGraphics ? drawingToSvg(sym.importedGraphics, { color: 'currentColor', componentRotation: c.rotation }) : uprightSymbolSvg(sym.svgContent, c.rotation)}
              </g>
              ${fn.visible && c.functionText ? `<text x="${fn.x}" y="${fn.y}" font-size="${fn.fontSize}" text-anchor="${fn.anchor}" ${fn.transform} fill="#e2e8f0">${escapeSvg(c.functionText)}</text>` : ''}
              <text ${labelTransform(0, -4, c.rotation)} x="0" y="-4" font-size="9" font-family="monospace" font-weight="bold" fill="#f6e05e">${escapeSvg(c.bmk)}</text>
            </g>
          `;
        }
      }

      const boxGhost=(macro.boxes??[]).map(box=>`<g transform="scale(${factor})">${drawingToSvg(boxDrawing(box),{color:'#63b3ed'})}</g>`).join('');
      const extrasGhost = (macro.images ?? []).map(i => `<image href="${escapeSvg(i.dataUrl)}" x="${i.x*factor}" y="${i.y*factor}" width="${i.width*factor}" height="${i.height*factor}" opacity=".6"/>`).join('')
        + (macro.cables ?? []).map(c => `<line x1="${c.start.x*factor}" y1="${c.start.y*factor}" x2="${c.end.x*factor}" y2="${c.end.y*factor}" stroke="#63b3ed"/>`).join('');
      return `
        <g id="ghostLayer" transform="translate(${gx}, ${gy})" opacity="0.8" pointer-events="none">
          <rect x="-6" y="-6" width="${macro.width * factor + 12}" height="${macro.height * factor + 12}" fill="rgba(66, 153, 225, 0.12)" stroke="#63b3ed" stroke-width="1.5" stroke-dasharray="4,3" rx="4"/>
          <text x="${macro.width / 2}" y="-10" font-size="11" font-weight="bold" font-family="sans-serif" fill="#63b3ed" text-anchor="middle">📦 ${escapeSvg(macro.name)} (Klick: Makro platzieren)</text>
          ${boxGhost}${componentsGhost}${extrasGhost}
        </g>
      `;
    }

    if (this.mode !== 'place_symbol' || !this.activeSymbolToPlace) return '';
    const sym = getSymbolById(this.activeSymbolToPlace, this.project);
    if (!sym) return '';

    const { x: gx, y: gy } = this.placementPosition(this.currentMousePos.x, this.currentMousePos.y, sym);

    const bmk = nextDeviceTag(this.project, sym.defaultBmkPrefix) || sym.name;

    return `
      <g id="ghostLayer" transform="translate(${gx}, ${gy}) rotate(${this.ghostRotation || 0}, ${sym.width / 2}, ${sym.height / 2})" opacity="0.75" pointer-events="none">
        <!-- Placement target box -->
        <rect x="-4" y="-4" width="${sym.width + 8}" height="${sym.height + 8}" fill="rgba(99, 179, 237, 0.15)" stroke="#63b3ed" stroke-width="1.5" stroke-dasharray="4,3" rx="4"/>
        
        <!-- BMK hint -->
        <text ${labelTransform(sym.width / 2, -8, this.ghostRotation)} x="${sym.width / 2}" y="-8" font-size="10" font-weight="bold" font-family="monospace" fill="#f6e05e" text-anchor="middle">${bmk} (Klick: Platzieren | Tab / R: Drehen)</text>

        <!-- Symbol Graphics -->
        <g color="#63b3ed">
          ${sym.importedGraphics ? drawingToSvg(sym.importedGraphics, { color: 'currentColor', componentRotation: this.ghostRotation }) : uprightSymbolSvg(sym.svgContent, this.ghostRotation)}
        </g>
      </g>
    `;
  }
}
