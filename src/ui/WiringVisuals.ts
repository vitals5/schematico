import type {ConnectorAssembly,ConnectorPairing,ConnectorRow} from '../model/Connectors';
import {connectorLabel} from '../model/Connectors';
import {connectorCells} from '../reports/ConnectorPlan';
import type {ConnectionRow} from '../reports/ConnectionList';
import {escapeSvg as esc} from '../model/ImportedDrawing';

export type ContactFilter='all'|'assigned'|'open'|'free'|'reserve'|'issues';
export const connectionKinds={autoconnect:'Autoconnect',manual:'Manuell',bridge:'Brücke',logical:'Logisch'};
export function contactStatus(row:ConnectorRow):Exclude<ContactFilter,'all'|'issues'> {
  return row.state==='Zugeordnet'?'assigned':row.state==='Frei'?'free':row.state==='Reserve'?'reserve':'open';
}
export function filterConnectorRows(rows:ConnectorRow[],assembly='',search='',status:ContactFilter='all') {
  const words=search.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return rows.filter(r=>(!assembly||r.connectorId===assembly)&&(status==='all'||(status==='issues'?r.issues.length>0:contactStatus(r)===status))&&words.every(w=>[...connectorCells(r),r.description].join(' ').toLocaleLowerCase().includes(w)));
}
export function connectorGraphicGroups(assemblies:ConnectorAssembly[],rows:ConnectorRow[],selected='',search='',status:ContactFilter='all') {
  const ids=new Set(rows.map(r=>r.connectorId)),words=search.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return assemblies.filter(c=>(!selected||c.id===selected)&&(ids.has(c.id)||!c.contacts.length&&status==='all'&&words.every(w=>(connectorLabel(c)+' '+c.description).toLocaleLowerCase().includes(w))));
}
export const wiringEmpty=(text:string)=>`<div class="wire-empty"><svg viewBox="0 0 40 32" aria-hidden="true"><path d="M4 4v12h32v12M14 4v24M25 4v24"/><circle cx="4" cy="3" r="2"/><circle cx="36" cy="29" r="2"/></svg><p>${esc(text)}</p></div>`;
const contactButton=(row:ConnectorRow,index:number)=>`<button type="button" class="wire-contact wire-contact--${contactStatus(row)} ${row.issues.length?'has-issues':''}" data-visual-contact="${index}" title="${esc([row.bmk+':'+row.position,row.state,row.endpoint,...row.issues].filter(Boolean).join('\n'))}" aria-label="${esc(row.bmk+':'+row.position+' · '+row.state+(row.issues.length?' · Hinweise':''))}"><span class="wire-pin wire-pin--${row.side==='Stecker'?'male':'female'}" aria-hidden="true"></span><strong>${esc(row.position)}</strong><span>${esc(row.state)}</span><small>${esc(row.endpoint||'Kein Anschluss zugeordnet')}</small>${row.issues.length?'<span class="wire-alert-mark" aria-label="Hinweise">!</span>':''}</button>`;

/** Schematic contact grid; order comes from the saved position list, not a guessed pinout. */
export function connectorCards(assemblies:ConnectorAssembly[],filtered:ConnectorRow[],allRows:ConnectorRow[]):string {
  const rowIndices=new Map(allRows.map((r,i)=>[r,i]));let remaining=192;
  return `<div class="wire-housings">${assemblies.map(c=>{
    const rows=filtered.filter(r=>r.connectorId===c.id),shown=rows.slice(0,Math.min(64,remaining));remaining-=shown.length;
    const all=allRows.filter(r=>r.connectorId===c.id),assigned=all.filter(r=>contactStatus(r)==='assigned').length,mates=[...new Set(all.map(r=>r.mate).filter(Boolean))];
    return `<section class="wire-housing"><header><span class="wire-housing-icon" aria-hidden="true">${c.side==='male'?'⇥':'⇤'}</span><button type="button" class="wire-heading-button" data-focus-housing="${esc(c.id)}" aria-label="${esc(connectorLabel(c)+' anzeigen')}"><strong>${esc(connectorLabel(c))}</strong><small>${c.side==='male'?'Stecker / Stift':'Buchse'} · ${c.contacts.length} Positionen</small></button><button type="button" class="btn" data-housing="${esc(c.id)}">Eigenschaften</button></header><p class="wire-housing-description">${esc(c.description||'Keine Beschreibung')}</p><div class="wire-housing-body wire-housing-body--${c.side==='male'?'male':'female'}"><div class="wire-contact-grid">${shown.map(r=>contactButton(r,rowIndices.get(r)!)).join('')||(rows.length?'<p class="wire-muted">Kontaktgrenze erreicht. Gehäusename anklicken oder Suche eingrenzen.</p>':'<p class="wire-muted">Keine Positionen in dieser Ansicht.</p>')}</div></div><footer><span>${assigned} / ${all.length} zugeordnet${all.some(r=>r.issues.length)?' · Hinweise vorhanden':''}</span><span>Gegenstück: ${esc(mates.join(' / ')||'nicht zugeordnet')}</span></footer>${shown.length<rows.length?'<p class="wire-muted wire-limit">Weitere Positionen über Suche oder Liste anzeigen.</p>':''}</section>`;
  }).join('')}</div>`;
}

export function connectorPairVisual(id:string,pairs:ConnectorPairing[],assemblies:ConnectorAssembly[],rows:ConnectorRow[]):string {
  const matches=pairs.filter(p=>p.maleId===id||p.femaleId===id);if(matches.length!==1)return '';
  const pair=matches[0],male=assemblies.filter(c=>c.id===pair.maleId),female=assemblies.filter(c=>c.id===pair.femaleId);
  if(male.length!==1||female.length!==1)return '<p class="wire-muted">Gegenstück ist nicht eindeutig. Hinweise in der Liste prüfen.</p>';
  const position=(assembly:string,pos:string)=>{const matches=rows.map((r,i)=>({r,i})).filter(v=>v.r.connectorId===assembly&&v.r.position===pos);return matches.length===1?`<button type="button" data-visual-contact="${matches[0].i}" class="wire-pair-position">${esc(pos)}<small>${esc(matches[0].r.endpoint||matches[0].r.state)}</small></button>`:`<span>${esc(pos)} · nicht eindeutig</span>`;};
  return `<section class="wire-pair-visual"><header><h3>Mechanische Kontaktpaarung</h3><span class="wire-muted">Gespeicherte Zuordnung</span></header><div class="wire-pair-head"><button type="button" class="wire-heading-button" data-housing="${esc(male[0].id)}">${esc(connectorLabel(male[0]))} · Stecker</button><span aria-hidden="true">⇄</span><button type="button" class="wire-heading-button" data-housing="${esc(female[0].id)}">${esc(connectorLabel(female[0]))} · Buchse</button></div>${pair.contacts.slice(0,60).map(m=>`<div class="wire-pair-row">${position(pair.maleId,m.malePosition)}<span class="wire-mate-link" aria-label="Mechanisch gepaart">⇄</span>${position(pair.femaleId,m.femalePosition)}</div>`).join('')}<p class="wire-muted">Mechanische Zuordnung; erzeugt keine elektrische Verbindung.${pair.contacts.length>60?' Weitere Paarungen stehen in der Liste.':''}</p></section>`;
}

/** Only saved colour data is painted; arbitrary CSS from imported metadata is not accepted. */
export function wireColour(value:string):string {
  const key=value.toLocaleLowerCase().replace(/[\s_/-]/g,'');
  if(['gnye','grüngelb','greenyellow'].includes(key))return 'background:repeating-linear-gradient(120deg,#e7d95f 0 7px,#69bd87 7px 14px)';
  const palette:Record<string,string>={bn:'#ba8a67',braun:'#ba8a67',brown:'#ba8a67',bk:'#99a3b0',schwarz:'#99a3b0',black:'#99a3b0',bu:'#73b9ff',blau:'#73b9ff',blue:'#73b9ff',gy:'#a7aeb9',grau:'#a7aeb9',grey:'#a7aeb9',gray:'#a7aeb9',wh:'#edf3fa',weiß:'#edf3fa',white:'#edf3fa',rd:'#ee8b8b',rot:'#ee8b8b',red:'#ee8b8b',gn:'#6bc595',grün:'#6bc595',green:'#6bc595',ye:'#e5d46e',gelb:'#e5d46e',yellow:'#e5d46e'};
  const colour=palette[key]??(/^#(?:[a-f\d]{3}|[a-f\d]{4}|[a-f\d]{6}|[a-f\d]{8})$/i.test(value)?value:'#7799b9');return `background:${colour}`;
}
export function connectionCards(rows:ConnectionRow[],indices:ReadonlyMap<ConnectionRow,number>):string {
  return `<div class="wire-connection-cards">${rows.map(r=>`<button type="button" class="wire-connection-card ${r.issues.length?'has-issues':''}" data-row="${indices.get(r)}"><span class="wire-card-heading"><strong>${esc(r.number||r.wireId)}</strong><span class="wire-kind wire-kind--${r.kind}">${connectionKinds[r.kind]}</span><span class="wire-page">Blatt ${esc(r.pageNumber)}</span></span><span class="wire-endpoints"><span><small>Quelle</small><strong>${esc(r.from)}</strong></span><span class="wire-conductor wire-conductor--${r.kind}" style="${wireColour(r.color)}" aria-hidden="true"></span><span><small>Ziel</small><strong>${esc(r.to)}</strong></span></span><span class="wire-card-meta"><span>${esc(r.potential||'Potenzial offen')}</span><span>${esc(r.color||'Farbe offen')}</span><span>${esc(r.crossSection||'Querschnitt offen')}</span>${r.cable?`<span>${esc(r.cable)}${r.core?' · '+esc(r.core):''}</span>`:''}<span>${r.lengthMm===undefined?'Länge nicht erfasst':esc(String(r.lengthMm))+' mm'}</span></span><span class="wire-card-status">${r.issues.length?`<span class="wire-warning">${r.issues.length} Hinweise</span>`:'Details öffnen'}<span>→</span></span></button>`).join('')}</div>`;
}
