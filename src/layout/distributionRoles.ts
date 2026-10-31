import type {SymbolDefinition, PinDefinition} from '../model/types';
import {isInterruptionSymbol} from '../model/ConnectionSymbols';

/** Resolve functional port roles from master-data family and actual port geometry.
 * Human descriptions, BMKs and manufacturer part numbers are never classifiers. */
export function rcdPorts(symbol:SymbolDefinition|undefined){
 if(!symbol || !(symbol.family==='rcd'||symbol.id==='rcd_4p') || symbol.pins.length!==8)return;
 const top=symbol.pins.filter(p=>p.direction==='top').sort((a,b)=>a.x-b.x);
 const bottom=symbol.pins.filter(p=>p.direction==='bottom').sort((a,b)=>a.x-b.x);
 if(top.length!==4||bottom.length!==4||top.some((p,i)=>Math.abs(p.x-bottom[i].x)>1e-6))return;
 const neutral=(p:PinDefinition)=>p.name.trim().toUpperCase()==='N'||/^N[-_](in|out)$/i.test(p.id);
 const ni=top.filter(neutral),no=bottom.filter(neutral);
 if(ni.length!==1||no.length!==1||Math.abs(ni[0].x-no[0].x)>1e-6)return;
 return {inputs:top.filter(p=>!neutral(p)).map(p=>p.id),outputs:bottom.filter(p=>!neutral(p)).map(p=>p.id),neutralIn:ni[0].id,neutralOut:no[0].id};
}
export function breakerPorts(symbol:SymbolDefinition|undefined){
 if(!symbol || !(symbol.family==='mcb'||symbol.id==='circuit_breaker_1p') || symbol.pins.length!==2)return;
 const top=symbol.pins.filter(p=>p.direction==='top'),bottom=symbol.pins.filter(p=>p.direction==='bottom');
 if(top.length!==1||bottom.length!==1||Math.abs(top[0].x-bottom[0].x)>1e-6)return;
 return {input:top[0].id,output:bottom[0].id};
}
export function socketPorts(symbol:SymbolDefinition|undefined){
 if(!symbol || !(symbol.family==='socket'||symbol.id==='socket_schuko') || symbol.pins.length!==3 || symbol.pins.some(p=>p.direction!=='top'))return;
 const named=(name:string)=>symbol.pins.filter(p=>p.name.trim().toUpperCase()===name);
 const live=symbol.id==='socket_schuko'?symbol.pins.filter(p=>p.id==='1'):named('L'),n=named('N'),pe=named('PE');
 if(live.length!==1||n.length!==1||pe.length!==1||new Set([live[0].id,n[0].id,pe[0].id]).size!==3 || n[0].x<=live[0].x || pe[0].x<=live[0].x || Math.abs(n[0].x-pe[0].x)<1e-6)return;
 return {live:live[0].id,N:n[0].id,PE:pe[0].id};
}
export function isDistributionFeed(symbol:SymbolDefinition|undefined):boolean{
 if(!symbol)return false;
 if(isInterruptionSymbol(symbol))return true;
 if(!(['feed_terminal','pe_terminal'].includes(symbol.family??'')||['terminal_single','terminal_pe'].includes(symbol.id))||symbol.pins.length!==2)return false;
 const top=symbol.pins.filter(p=>p.direction==='top'),bottom=symbol.pins.filter(p=>p.direction==='bottom');
 return top.length===1&&bottom.length===1&&Math.abs(top[0].x-bottom[0].x)<1e-6;
}
