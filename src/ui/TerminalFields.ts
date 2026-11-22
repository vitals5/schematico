import type {PlacedComponent,SymbolDefinition} from '../model/types';
import type {TerminalSettings} from '../model/WiringManagement';
import {terminalSettings} from '../model/WiringManagement';
import {terminalLevels,terminalLevelValues,terminalPinSide,validTerminalLevelSettings} from '../model/TerminalFunctions';
import {escapeSvg as esc} from '../model/ImportedDrawing';
import {tr} from '../i18n';

/** Shared by component properties and the terminal workbench. */
export function terminalFields(c:PlacedComponent,s:SymbolDefinition,identity=true):string {
  const definitions=terminalLevels(s);
  if(!definitions.length&&!c.terminal)return '';
  const settings=terminalSettings(c),levels=terminalLevelValues(c,s);
  const field=(key:string,label:string,value:string)=>`<label style="display:grid;gap:4px">${esc(label)}<input class="form-input" id="terminal-${key}" data-terminal-field="${key}" value="${esc(value)}"></label>`;
  return `<fieldset class="terminal-fields" data-terminal-original="${esc(JSON.stringify(settings))}" data-terminal-original-bmk="${esc(c.bmk)}" data-terminal-function-text="${esc(c.functionText)}" style="border:1px solid #526170;border-radius:6px;padding:12px;display:grid;gap:10px"><legend>${tr('Klemmenfunktionen','Terminal functions')}</legend>
    <p style="font-size:12px;margin:0;color:var(--text-muted,#a0aec0)">${levels.length>1?tr('Ein physisches Gerät mit elektrisch getrennten Etagen. Eine Artikelzuordnung für das gesamte Gehäuse.','One physical device with electrically separate levels. One article assignment for the whole housing.'):tr('Eine Klemmenfunktion; ihre Klemmstellen sind gemäß Anschlusslogik miteinander verbunden.','One terminal function; its connection points follow the defined internal connection logic.')}</p>
    ${identity?`<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">${field('strip',tr('Klemmenleiste','Terminal strip'),settings.strip)}${field('number',tr('Klemmennummer','Terminal number'),settings.number)}${levels.length<2?field('level',tr('Etage','Level'),settings.level):''}</div>`:''}
    ${levels.map(level=>`<section style="padding:10px;background:var(--bg-input,#131b27);border:1px solid #3e4656;border-radius:4px" data-terminal-level="${esc(level.id)}">
      <div style="display:flex;gap:8px;align-items:center"><svg width="84" height="28" viewBox="0 0 84 28" role="img" aria-label="${esc(level.pinIds.join(', '))}"><line x1="4" y1="14" x2="34" y2="14" stroke="currentColor"/><circle cx="40" cy="14" r="5" stroke="currentColor" fill="${level.potential==='PE'?'#68d391':'none'}"/><line x1="46" y1="14" x2="80" y2="14" stroke="currentColor" ${level.disconnectable?'stroke-dasharray="3 3"':''}/></svg><strong>${tr('Etage','Level')} ${esc(level.designation)}</strong><span>${level.potential==='undefined'?tr('Freies Potenzial','Undefined potential'):level.potential}</span>${level.id===s.terminalDefinition?.mainLevel?`<small>${tr('Hauptfunktion','Main function')}</small>`:''}${level.disconnectable?`<small>${tr('Trennfunktion – keine feste Durchverbindung','Disconnect function – no permanent through connection')}</small>`:''}</div>
      ${levels.length>1?`<div style="display:grid;grid-template-columns:1fr 2fr;gap:8px;margin:6px 0">${field('designation-'+level.id,tr('Etagenbezeichnung','Level designation'),level.designation)}${field('text-'+level.id,tr('Funktionstext der Etage','Level function text'),level.functionText)}</div>`:''}
      <div style="display:flex;gap:8px;flex-wrap:wrap">${level.pinIds.map(id=>`<label style="display:grid;gap:3px;font-size:11px">${esc(c.pins[id]?.customLabel??s.pins.find(p=>p.id===id)?.name??id)}<select class="form-input" id="terminal-side-${esc(id)}" data-terminal-side="${esc(id)}"><option value="internal" ${terminalPinSide(c,s,id)==='internal'?'selected':''}>${tr('Intern','Internal')}</option><option value="external" ${terminalPinSide(c,s,id)==='external'?'selected':''}>${tr('Extern','External')}</option></select></label>`).join('')}</div>
    </section>`).join('')}
    <p data-terminal-error role="alert" style="color:#fca5a5;margin:0"></p></fieldset>`;
}

export function collectTerminalFields(root:HTMLElement,c:PlacedComponent,s:SymbolDefinition):TerminalSettings|undefined {
  const wrapper=root.querySelector<HTMLElement>('.terminal-fields');if(!wrapper)return undefined;
  const original=JSON.parse(wrapper.dataset.terminalOriginal!) as TerminalSettings;
  const next=structuredClone(original),value=(key:string)=>wrapper.querySelector<HTMLInputElement>(`[data-terminal-field="${key}"]`)?.value.trim();
  for(const key of ['strip','number','level'] as const)if(value(key)!==undefined)next[key]=value(key)!;
  for(const field of wrapper.querySelectorAll<HTMLSelectElement>('[data-terminal-side]'))next.pinSides[field.dataset.terminalSide!]=field.value as 'internal'|'external';
  const levels=terminalLevels(s);
  if(levels.length>1)for(const level of levels){
    const designation=value('designation-'+level.id)??level.designation;
    const text=value('text-'+level.id)??c.functionText;
    const before=original.levels?.[level.id];
    const previousText=before?.functionText??wrapper.dataset.terminalFunctionText??'';
    if(designation!==(before?.designation||level.designation)||text!==previousText)
      (next.levels??={})[level.id]={...before,designation,...(text!==previousText?{functionText:text}:{})};
  }
  if(next.number.trim()&&!next.strip.trim()||!validTerminalLevelSettings({...c,terminal:next},s))throw new Error('wiringInvalid');
  return next;
}

export function applyTerminalFields(root:HTMLElement,c:PlacedComponent,s:SymbolDefinition):boolean {
  const wrapper=root.querySelector<HTMLElement>('.terminal-fields');if(!wrapper)return true;
  try {
    const next=collectTerminalFields(root,c,s)!;
    // Merely opening properties must not turn inferred defaults into explicit data.
    const baseline=JSON.parse(wrapper.dataset.terminalOriginal!) as TerminalSettings;
    if(c.bmk!==wrapper.dataset.terminalOriginalBmk&&next.strip===baseline.strip&&next.number===baseline.number){
      const colon=c.bmk.indexOf(':');next.strip=colon>0?c.bmk.slice(0,colon):c.bmk;next.number=colon>0?c.bmk.slice(colon+1):'';
    }
    const explicitSides=Object.fromEntries(Object.entries(next.pinSides).filter(([id,side])=>baseline.pinSides[id]!==undefined||side!==terminalPinSide({...c,terminal:baseline},s,id)));
    if(JSON.stringify({...next,pinSides:explicitSides})!==JSON.stringify(baseline)){
      c.terminal=next;c.bmk=next.strip+(next.number?':'+next.number:'');
    }
    return true;
  }catch{wrapper.querySelector('[data-terminal-error]')!.textContent=tr('Etagenbezeichnungen müssen eindeutig sein; Klemmenleiste und Anschlusszuordnung prüfen.','Level designations must be unique; check strip and connection assignments.');return false;}
}
