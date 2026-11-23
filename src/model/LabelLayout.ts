// src/model/LabelLayout.ts
// Calculates exact screen coordinates, anchors, rotations, and styles for component labels

import { PlacedComponent, TextFormatConfig, SymbolDefinition, PinDefinition, Project } from './types';
import { getSymbolById } from './symbols';
import { interruptionLabelPosition, interruptionReferencePosition, isInterruptionSymbol } from './ConnectionSymbols';
import { standardTerminalId, rotatedLocalPoint } from './SymbolGeometry';
import { splitCrossReferenceLines } from './CrossReferenceNavigation';
import {terminalLevelValues} from './TerminalFunctions';

export interface CalculatedLabelPosition {
  maxWidth?: number;
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  rotation: number;
  fontSize: number;
  fontColor?: string;
  fontWeight?: 'normal' | 'bold';
  visible: boolean;
  transform: string;
}

type LabelKey = 'bmkPosition' | 'functionTextPosition' | 'technicalDataPosition' | 'additionalTextPosition' | 'crossRefPosition';
export function labelWrapWidth(cfg: TextFormatConfig | undefined, sym: SymbolDefinition, key: LabelKey): number | undefined {
  if (sym.family === 'feed_terminal' || sym.family === 'pe_terminal' || isInterruptionSymbol(sym)) return cfg?.maxWidth;
  return cfg?.maxWidth ?? (['functionTextPosition','technicalDataPosition','additionalTextPosition'].includes(key) ? Math.max(40 * (sym.unitsPerMm ?? 2),16 * (cfg?.fontSize ?? 8)) : undefined);
}
const automatic = (cfg?: TextFormatConfig) => !cfg?.preset || cfg.preset === 'auto';
/** Strip presentation never changes the device identity used in reports/references. */
export function componentBmkText(comp:PlacedComponent,sym?:SymbolDefinition):string {
  if(comp.terminal?.rowDisplay&&sym?.terminalDefinition)return comp.terminal.rowDisplay==='start'?comp.terminal.strip:comp.terminal.number;
  return comp.bmk;
}
export function terminalRowAnchor(sym:SymbolDefinition){const circle=sym.importedGraphics?.find(g=>g.kind==='circle');return circle?.kind==='circle'?{x:circle.x,y:circle.y}:{x:sym.pins[0]?.x??sym.width/2,y:sym.height/2};}
function rowNumberPosition(comp:PlacedComponent,sym:SymbolDefinition,scale=1):CalculatedLabelPosition{
 const u=(sym.unitsPerMm??2)/2,anchor=terminalRowAnchor(sym),cfg=comp.bmkPosition;
 const x=(anchor.x+4*u)*scale,y=(anchor.y-4*u)*scale,rotation=cfg?.rotation??0;
 return {x,y,anchor:cfg?.alignment??'start',rotation,fontSize:(cfg?.fontSize??5*u)*scale,visible:cfg?.visible!==false,transform:labelTransform(x,y,comp.rotation,rotation),fontColor:cfg?.fontColor,fontWeight:'bold'};
}
/** Display-only word wrapping; stored equipment text and font sizes stay intact. */
export function wrapLabelText(text:string,size:number,width?:number):string {
  if(!width||width<=0)return text;
  const measure=(s:string)=>[...s].reduce((n,c)=>n+size*(/[MW@%]/.test(c) ? 0.95 : /[ilI., :/]/.test(c) ? 0.33 : 0.63),0);
  return text.split(/\r?\n/).flatMap(line=>{
    const rows:string[]=[];let current='';
    for(const word of line.split(/\s+/)){
      if(measure(word)>width){
        if(current){rows.push(current);current='';}
        for(const char of word){if(current&&measure(current+char)>width){rows.push(current);current='';}current+=char;}
      }else if(current&&measure(current+' '+word)>width){rows.push(current);current=word;}else current=current?current+' '+word:word;
    }
    return [...rows,current];
  }).join('\n');
}

/** A readable, right-aligned block on the world-left of the rotated symbol.
 * Only automatic, visible, populated labels consume lines in this block. */
function automaticLeftPosition(comp: PlacedComponent, sym: SymbolDefinition, key: LabelKey): CalculatedLabelPosition {
  const data: [LabelKey, string, number][] = [
    ['bmkPosition', componentBmkText(comp,sym) ?? '', comp.terminal?.rowDisplay?5*(sym.unitsPerMm??2)/2:10], ['functionTextPosition', comp.functionText ?? '', 8],
    ['technicalDataPosition', [comp.deviceTag, comp.technicalCharacteristics].filter(Boolean).join(' · '), 8],
    ['additionalTextPosition', comp.additionalText ?? '', 8], ['crossRefPosition', comp.crossRef ?? '', comp.crossRefFontSize ?? 8]
  ];
  const rows = data.filter(([id, text]) => id === key || automatic(comp[id]) && comp[id]?.visible !== false && !!text);
  const height = ([id, text, size]: typeof data[number]) => Math.max(1, (id === 'crossRefPosition' ? splitCrossReferenceLines(text) : wrapLabelText(text,comp[id]?.fontSize??size,labelWrapWidth(comp[id],sym,id)).split(/\r?\n/)).length)
    * (id === 'crossRefPosition' ? comp.crossRefFontSize ?? comp[id]?.fontSize ?? size : comp[id]?.fontSize ?? size) * 1.4;
  const total = rows.reduce((sum, row) => sum + height(row), 0);
  let y = sym.height / 2 - total / 2;
  for (const row of rows) {
    if (row[0] !== key) { y += height(row); continue; }
    const cfg = comp[key], size = key === 'crossRefPosition' ? comp.crossRefFontSize ?? cfg?.fontSize ?? row[2] : cfg?.fontSize ?? row[2];
    y += size;
    const rotatedWidth = comp.rotation % 180 ? sym.height : sym.width;
    const local = rotatedLocalPoint({ x: sym.width / 2 - rotatedWidth / 2 - 4 * (sym.unitsPerMm ?? 2), y }, sym, -comp.rotation);
    const x = local.x + (cfg?.offsetX ?? 0), py = local.y + (cfg?.offsetY ?? 0), rotation = cfg?.rotation ?? 0;
    return { x, y: py, anchor: cfg?.alignment ?? 'end', rotation, fontSize: size, maxWidth:labelWrapWidth(cfg,sym,key),
      visible: cfg?.visible ?? (key === 'technicalDataPosition' ? !!row[1] : true),
      transform: labelTransform(x, py, comp.rotation, rotation), fontColor: cfg?.fontColor, fontWeight: cfg?.fontWeight };
  }
  throw new Error('Beschriftungsposition fehlt.');
}

export function computeBmkPosition(comp: PlacedComponent, sym: SymbolDefinition, scale=1): CalculatedLabelPosition {
  const cfg = comp.bmkPosition;
  if(automatic(cfg)&&comp.terminal?.rowDisplay==='continuation')return rowNumberPosition(comp,sym,scale);
  if(comp.terminal?.rowDisplay&&scale!==1)sym={...sym,width:sym.width*scale,height:sym.height*scale};
  if (automatic(cfg)) return automaticLeftPosition(comp, sym, 'bmkPosition');
  const preset = cfg?.preset || 'top';
  let x = sym.width / 2;
  let y = -8;
  let anchor: 'start' | 'middle' | 'end' = 'middle';

  switch (preset) {
    case 'top':
      x = sym.width / 2;
      y = -8;
      anchor = 'middle';
      break;
    case 'top_left':
      x = 0;
      y = -8;
      anchor = 'start';
      break;
    case 'top_right':
      x = sym.width;
      y = -8;
      anchor = 'end';
      break;
    case 'bottom':
      x = sym.width / 2;
      y = sym.height + 26;
      anchor = 'middle';
      break;
    case 'bottom_left':
      x = 0;
      y = sym.height + 26;
      anchor = 'start';
      break;
    case 'bottom_right':
      x = sym.width;
      y = sym.height + 26;
      anchor = 'end';
      break;
    case 'left':
      x = -8;
      y = sym.height / 2;
      anchor = 'end';
      break;
    case 'right':
      x = sym.width + 8;
      y = sym.height / 2;
      anchor = 'start';
      break;
    case 'custom':
    default:
      x = sym.width / 2;
      y = -8;
      anchor = 'middle';
      break;
  }

  x += (cfg?.offsetX || 0);
  y += (cfg?.offsetY || 0);

  if (cfg?.alignment) {
    anchor = cfg.alignment;
  }

  const rotation = cfg?.rotation || 0;
  const fontSize = cfg?.fontSize || 10;
  const visible = cfg?.visible !== false;
  const transform = labelTransform(x, y, comp.rotation, rotation);

  return { x, y, anchor, rotation, fontSize, visible, transform, maxWidth:cfg?.maxWidth, ...(cfg?.fontColor ? { fontColor: cfg.fontColor } : {}), ...(cfg?.fontWeight ? { fontWeight: cfg.fontWeight } : {}) };
}

export function computeFunctionTextPosition(comp: PlacedComponent, sym: SymbolDefinition): CalculatedLabelPosition {
  const cfg = comp.functionTextPosition;
  if (automatic(cfg)) return automaticLeftPosition(comp, sym, 'functionTextPosition');
  const preset = cfg?.preset || 'bottom';
  let x = sym.width / 2;
  let y = sym.height + 12;
  let anchor: 'start' | 'middle' | 'end' = 'middle';

  switch (preset) {
    case 'bottom':
      x = sym.width / 2;
      y = sym.height + 12;
      anchor = 'middle';
      break;
    case 'bottom_left':
      x = 0;
      y = sym.height + 12;
      anchor = 'start';
      break;
    case 'bottom_right':
      x = sym.width;
      y = sym.height + 12;
      anchor = 'end';
      break;
    case 'top':
      x = sym.width / 2;
      y = -20;
      anchor = 'middle';
      break;
    case 'top_left':
      x = 0;
      y = -20;
      anchor = 'start';
      break;
    case 'top_right':
      x = sym.width;
      y = -20;
      anchor = 'end';
      break;
    case 'left':
      x = -8;
      y = sym.height / 2 + 12;
      anchor = 'end';
      break;
    case 'right':
      x = sym.width + 8;
      y = sym.height / 2 + 12;
      anchor = 'start';
      break;
    case 'custom':
    default:
      x = sym.width / 2;
      y = sym.height + 12;
      anchor = 'middle';
      break;
  }

  x += (cfg?.offsetX || 0);
  y += (cfg?.offsetY || 0);

  if (cfg?.alignment) {
    anchor = cfg.alignment;
  }

  const rotation = cfg?.rotation || 0;
  const fontSize = cfg?.fontSize || 8;
  const visible = cfg?.visible !== false;
  const transform = labelTransform(x, y, comp.rotation, rotation);

  return { x, y, anchor, rotation, fontSize, visible, transform, maxWidth:labelWrapWidth(cfg,sym,'functionTextPosition'), ...(cfg?.fontColor ? { fontColor: cfg.fontColor } : {}), ...(cfg?.fontWeight ? { fontWeight: cfg.fontWeight } : {}) };
}

export function computeTechnicalDataPosition(comp: PlacedComponent, sym: SymbolDefinition): CalculatedLabelPosition {
  const cfg = comp.technicalDataPosition;
  if (automatic(cfg)) return automaticLeftPosition(comp, sym, 'technicalDataPosition');
  const preset = cfg?.preset || 'bottom';
  let x = sym.width / 2;
  let y = sym.height + 22;
  let anchor: 'start' | 'middle' | 'end' = 'middle';

  switch (preset) {
    case 'bottom':
      x = sym.width / 2;
      y = sym.height + 22;
      anchor = 'middle';
      break;
    case 'bottom_left':
      x = 0;
      y = sym.height + 22;
      anchor = 'start';
      break;
    case 'bottom_right':
      x = sym.width;
      y = sym.height + 22;
      anchor = 'end';
      break;
    case 'top':
      x = sym.width / 2;
      y = -32;
      anchor = 'middle';
      break;
    case 'top_left':
      x = 0;
      y = -32;
      anchor = 'start';
      break;
    case 'top_right':
      x = sym.width;
      y = -32;
      anchor = 'end';
      break;
    case 'left':
      x = -8;
      y = sym.height / 2 + 22;
      anchor = 'end';
      break;
    case 'right':
      x = sym.width + 8;
      y = sym.height / 2 + 22;
      anchor = 'start';
      break;
    case 'custom':
    default:
      x = sym.width / 2;
      y = sym.height + 22;
      anchor = 'middle';
      break;
  }

  x += (cfg?.offsetX || 0);
  y += (cfg?.offsetY || 0);

  if (cfg?.alignment) {
    anchor = cfg.alignment;
  }

  const rotation = cfg?.rotation || 0;
  const fontSize = cfg?.fontSize || 8;
  const visible = cfg?.visible !== undefined ? cfg.visible : !!(comp.deviceTag || comp.technicalCharacteristics);
  const transform = labelTransform(x, y, comp.rotation, rotation);

  return { x, y, anchor, rotation, fontSize, visible, transform, maxWidth:labelWrapWidth(cfg,sym,'technicalDataPosition'), ...(cfg?.fontColor ? { fontColor: cfg.fontColor } : {}), ...(cfg?.fontWeight ? { fontWeight: cfg.fontWeight } : {}) };
}

/** Keep the automatic interruption layout unless an instance overrides it. */
export function computeCrossReferencePosition(comp: PlacedComponent, sym: SymbolDefinition, project: Project): CalculatedLabelPosition {
  const cfg = comp.crossRefPosition;
  if (automatic(cfg) && !isInterruptionSymbol(sym)) return automaticLeftPosition(comp, sym, 'crossRefPosition');
  const arrow = interruptionReferencePosition(project, comp, sym) ?? interruptionLabelPosition(project, comp, sym);
  const hasTech = computeTechnicalDataPosition(comp, sym).visible && !!(comp.deviceTag || comp.technicalCharacteristics);
  const extra = comp.additionalText && computeAdditionalTextPosition(comp,sym);
  const bottom = Math.max(sym.height + (hasTech ? 38 : 24), extra && extra.visible ? extra.y + extra.fontSize * 1.7 : 0);
  let x = arrow?.referenceX ?? sym.width / 2;
  let y = arrow?.referenceY ?? bottom;
  let anchor: CalculatedLabelPosition['anchor'] = arrow?.anchor ?? 'middle';
  switch (cfg?.preset) {
    case 'top': x = sym.width / 2; y = -20; anchor = 'middle'; break;
    case 'top_left': x = 0; y = -20; anchor = 'start'; break;
    case 'top_right': x = sym.width; y = -20; anchor = 'end'; break;
    case 'bottom': x = sym.width / 2; y = bottom; anchor = 'middle'; break;
    case 'bottom_left': x = 0; y = bottom; anchor = 'start'; break;
    case 'bottom_right': x = sym.width; y = bottom; anchor = 'end'; break;
    case 'left': x = -8; y = sym.height / 2; anchor = 'end'; break;
    case 'right': x = sym.width + 8; y = sym.height / 2; anchor = 'start'; break;
  }
  x += cfg?.offsetX ?? 0;
  y += cfg?.offsetY ?? 0;
  anchor = cfg?.alignment ?? anchor;
  const rotation = cfg?.rotation ?? 0;
  return { x, y, anchor, rotation, visible: cfg?.visible !== false,
    fontSize: comp.crossRefFontSize ?? cfg?.fontSize ?? 8, transform: labelTransform(x, y, comp.rotation, rotation) };
}

/** Counter-rotate text about its own anchor; the component still moves the anchor. */
export function labelTransform(x: number, y: number, componentRotation = 0, textRotation = 0): string {
  const angle = textRotation - componentRotation;
  return angle ? `transform="rotate(${angle}, ${x}, ${y})"` : '';
}

/** Text entered by the user reveals an inherited hidden import label, while an
 * explicit visibility choice always remains in force. */
export function setComponentLabelText(comp: PlacedComponent,
  property: 'functionText' | 'additionalText' | 'deviceTag' | 'technicalCharacteristics', value: string): boolean {
  if (comp[property] === value) return false;
  comp[property] = value;
  const key = property === 'functionText' ? 'functionTextPosition' : property === 'additionalText' ? 'additionalTextPosition' : 'technicalDataPosition';
  if (value.trim() && comp.source && comp[key]?.visible === false && !comp[key]?.visibilityExplicit)
    comp[key] = { ...comp[key], visible: true };
  return true;
}

/** Zusatztext has its own editable layout, below the other populated labels. */
export function computeAdditionalTextPosition(comp: PlacedComponent, sym: SymbolDefinition): CalculatedLabelPosition {
  const cfg = comp.additionalTextPosition;
  if (automatic(cfg)) return automaticLeftPosition(comp, sym, 'additionalTextPosition');
  const pos = computeTechnicalDataPosition({ ...comp, technicalDataPosition: cfg }, sym);
  if (cfg?.preset === 'custom') {
    pos.y = sym.height + 34 + (cfg.offsetY || 0);
    pos.transform = labelTransform(pos.x, pos.y, comp.rotation, pos.rotation);
  } else if (!cfg?.preset || cfg.preset === 'bottom' || cfg.preset === 'bottom_left' || cfg.preset === 'bottom_right') {
    const fnWidth = labelWrapWidth(comp.functionTextPosition,sym,'functionTextPosition');
    const lines = Math.max(1, wrapLabelText(comp.functionText || '',comp.functionTextPosition?.fontSize ?? 8,fnWidth).split('\n').length);
    const fn = computeFunctionTextPosition(comp, sym), tech = computeTechnicalDataPosition(comp, sym);
    const lowest = Math.max(sym.height + 12,
      comp.functionText && fn.visible ? fn.y + (lines - 1) * fn.fontSize * 1.2 : 0,
      (comp.deviceTag || comp.technicalCharacteristics) && tech.visible ? tech.y + Math.max(0, (wrapLabelText([comp.deviceTag,comp.technicalCharacteristics].filter(Boolean).join(' · '),tech.fontSize,tech.maxWidth).split('\n').length - 1)) * tech.fontSize * 1.2 : 0);
    pos.y = lowest + pos.fontSize * 1.4 + (cfg?.offsetY || 0);
    pos.transform = labelTransform(pos.x, pos.y, comp.rotation, pos.rotation);
  }
  pos.visible = cfg?.visible !== false;
  return pos;
}

/** The terminal designation is stored device/function text, never an invented
 * pin number. Its source field controls visibility in every renderer. */
export function terminalDesignation(comp: PlacedComponent, sym: SymbolDefinition): string {
  const technical = comp.deviceTag || comp.technicalCharacteristics;
  if (technical) return computeTechnicalDataPosition(comp, sym).visible ? technical : '';
  return computeFunctionTextPosition(comp, sym).visible ? comp.functionText : '';
}

/** Dynamic level text shares the pin-label visibility, rotation and scale rules. */
export function terminalFunctionLabels(comp:PlacedComponent,sym:SymbolDefinition,scale=1):{key:string;text:string;position:CalculatedLabelPosition}[] {
  const headingNumber=comp.terminal?.rowDisplay==='start'?[{key:'terminal-number',text:comp.terminal.number,position:rowNumberPosition(comp,sym,scale)}]:[];
  const levels=terminalLevelValues(comp,sym);if(!levels.length||levels.length<2&&!comp.terminal?.level)return headingNumber;
  return [...headingNumber,...levels.flatMap(level=>{
    const pins=sym.pins.filter(p=>level.pinIds.includes(p.id)),x=pins.reduce((sum,p)=>sum+p.x,0)/pins.length;
    const pos=(x:number,y:number,fontSize:number,visible:boolean,anchor:CalculatedLabelPosition['anchor']='start',maxWidth?:number,rotation=0):CalculatedLabelPosition=>
      ({x:x*scale,y:y*scale,fontSize:fontSize*scale,visible,anchor,rotation,transform:labelTransform(x*scale,y*scale,comp.rotation,rotation),...(maxWidth?{maxWidth:maxWidth*scale}:{})});
    const pinCfg=comp.pinLabelPosition,fnCfg=comp.functionTextPosition;
    const designation=levels.length===1?(comp.terminal?.levelDesignation??(level.designation==='0'?comp.terminal?.level:level.designation)):level.designation;
    const labels=[{key:'level-'+level.id,text:designation??'',position:pos(x+3+(pinCfg?.offsetX??0),(sym.height>32?12:sym.height/2+2)+(pinCfg?.offsetY??0),comp.pinLabelFontSize??pinCfg?.fontSize??5,pinCfg?.visible!==false,'start',pinCfg?.maxWidth??10,pinCfg?.rotation??0)}];
    const own=comp.terminal?.levels?.[level.id]?.functionText;
    if(own&&own!==comp.functionText)labels.push({key:'level-text-'+level.id,text:own,
      position:pos(x+(fnCfg?.offsetX??0),sym.height+10+(fnCfg?.offsetY??0),fnCfg?.fontSize??5,fnCfg?.visible!==false,'middle',fnCfg?.maxWidth??14,fnCfg?.rotation??0)});
    return labels;
  })];
}

export function arePinLabelsVisible(comp: PlacedComponent, sym?: SymbolDefinition): boolean {
  if (comp.pinLabelPosition?.visible !== undefined) return comp.pinLabelPosition.visible;
  if (!sym || sym.pins.length === 0) return false;
  if(comp.terminal?.rowDisplay)return sym.pins.some(pin=>comp.pins[pin.id]?.labelPosition?.visible===true);
  const isConn = !sym.importedGraphics && sym.category === 'connections';
  const isTerminal = standardTerminalId(sym) === 'terminal_single';
  return sym.pins.some(pin => {
    const label = comp.pins[pin.id]?.labelPosition ?? pin.labelPosition;
    if (sym.source || label) return !!label && label.visible !== false;
    return !isConn && !isTerminal;
  });
}

export function computePinLabelPosition(comp: PlacedComponent, sym: SymbolDefinition, pin: PinDefinition, scale: number = comp.scale ?? 1): CalculatedLabelPosition {
  const cfg = comp.pinLabelPosition;
  const label = comp.pins[pin.id]?.labelPosition ?? pin.labelPosition;
  const isConn = !sym.importedGraphics && sym.category === 'connections';
  const isTerminal = standardTerminalId(sym) === 'terminal_single';
  const defaultVisible = comp.terminal?.rowDisplay ? comp.pins[pin.id]?.labelPosition?.visible===true : (sym.source || label) ? (!!label && label.visible !== false) : (!isConn && !isTerminal);
  const visible = cfg?.visible !== undefined ? cfg.visible : defaultVisible;

  let x: number;
  let y: number;
  let anchor: CalculatedLabelPosition['anchor'];
  let baseRotation: number;
  let baseFontSize: number;

  if (label) {
    x = label.x * scale;
    y = label.y * scale;
    anchor = label.alignment;
    baseRotation = label.rotation ?? 0;
    baseFontSize = label.fontSize * scale;
  } else if (sym.source) {
    if (pin.direction === 'top') {
      x = (pin.x + 2) * scale;
      y = (pin.y - 2) * scale;
      anchor = 'start';
    } else if (pin.direction === 'bottom') {
      x = (pin.x + 2) * scale;
      y = (pin.y + 6) * scale;
      anchor = 'start';
    } else if (pin.direction === 'left') {
      x = (pin.x - 3) * scale;
      y = (pin.y - 2) * scale;
      anchor = 'end';
    } else {
      x = (pin.x + 3) * scale;
      y = (pin.y - 2) * scale;
      anchor = 'start';
    }
    baseRotation = 0;
    baseFontSize = 4.5 * scale;
  } else {
    x = (pin.x + (pin.direction === 'top' ? 0 : 5)) * scale;
    y = (pin.y + (pin.direction === 'top' ? -4 : 3.5)) * scale;
    anchor = pin.direction === 'top' ? 'middle' : 'start';
    baseRotation = 0;
    baseFontSize = 6.5 * scale;
  }

  if (cfg?.preset && cfg.preset !== 'auto' && cfg.preset !== 'custom') {
    switch (cfg.preset) {
      case 'top': x = pin.x * scale; y = (pin.y - 4) * scale; anchor = 'middle'; break;
      case 'top_left': x = (pin.x - 3) * scale; y = (pin.y - 3) * scale; anchor = 'end'; break;
      case 'top_right': x = (pin.x + 3) * scale; y = (pin.y - 3) * scale; anchor = 'start'; break;
      case 'bottom': x = pin.x * scale; y = (pin.y + 7) * scale; anchor = 'middle'; break;
      case 'bottom_left': x = (pin.x - 3) * scale; y = (pin.y + 7) * scale; anchor = 'end'; break;
      case 'bottom_right': x = (pin.x + 3) * scale; y = (pin.y + 7) * scale; anchor = 'start'; break;
      case 'left': x = (pin.x - 4) * scale; y = (pin.y + 2) * scale; anchor = 'end'; break;
      case 'right': x = (pin.x + 4) * scale; y = (pin.y + 2) * scale; anchor = 'start'; break;
    }
  }

  x += (cfg?.offsetX ?? 0) * scale;
  y += (cfg?.offsetY ?? 0) * scale;
  if (cfg?.alignment) anchor = cfg.alignment;
  const rotation = cfg?.rotation ?? baseRotation;
  const fontSize = comp.pinLabelFontSize ? comp.pinLabelFontSize * scale : (cfg?.fontSize ? cfg.fontSize * scale : baseFontSize);
  const transform = labelTransform(x, y, comp.rotation, rotation);

  return { x, y, anchor, rotation, fontSize, visible, transform };
}

/** Upgrade inherited hidden defaults and legacy left-side alignments in already saved imported projects once.
 * New user visibility choices are persisted and are never changed here. */
export function revealImportedComponentLabels(project: Project): void {
  const projectSymbols = new Map(
    (project.symbolLibrary ?? []).map(s => [s.id, s])
  );
  for (const page of project.pages) for (const comp of page.components) {
    if (!comp.source) continue;
    for (const [property, hasText] of [
      ['functionTextPosition', !!comp.functionText?.trim()],
      ['additionalTextPosition', !!comp.additionalText?.trim()],
      ['technicalDataPosition', !!(comp.deviceTag?.trim() || comp.technicalCharacteristics?.trim())],
    ] as const) {
      if (hasText && comp[property]?.visible === false && !comp[property]?.visibilityExplicit)
        comp[property] = { ...comp[property], visible: true };
    }
    const sym = projectSymbols.get(comp.symbolId) ?? getSymbolById(comp.symbolId);
    if (sym && !comp.deviceBox && !sym.deviceBox) {
      for (const key of ['bmkPosition', 'functionTextPosition', 'technicalDataPosition', 'additionalTextPosition'] as const) {
        const cfg = comp[key];
        if (cfg?.preset === 'custom' && cfg.alignment === 'start' && sym.width / 2 + (cfg.offsetX ?? 0) <= 0) {
          comp[key] = { ...cfg, alignment: 'end' };
        }
      }
    }
  }
}
