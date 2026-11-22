import type { SymbolDefinition, DrawingPrimitive, PinDefinition } from './types';
import type { TerminalDefinition } from './TerminalFunctions';
import { drawingToSvg } from './ImportedDrawing';

const line = (x1:number,y1:number,x2:number,y2:number):DrawingPrimitive =>
  ({kind:'line',x1,y1,x2,y2,color:'currentColor',width:1});
const circle = (x:number,y:number,pe=false):DrawingPrimitive =>
  ({kind:'circle',x,y,radius:2,color:'currentColor',width:1,...(pe?{fill:'currentColor'}:{})});
const symbols: SymbolDefinition[] = [];
function add(id:string,name:string,width:number,height:number,pins:PinDefinition[],graphics:DrawingPrimitive[],definition:TerminalDefinition) {
  for(const pin of pins)pin.labelPosition={fontSize:4,
    x:pin.x+(pin.direction==='left'?-4:pin.direction==='right'?4:0),
    y:pin.y+(pin.direction==='top'?-4:pin.direction==='bottom'?7:1.5),
    alignment:pin.direction==='left'?'end':pin.direction==='right'?'start':'middle'};
  const permanent = definition.levels.filter(l=>!l.disconnectable).map(l=>l.pinIds);
  const conditional = definition.levels.filter(l=>l.disconnectable).map(l=>l.pinIds);
  symbols.push({id,name,category:'terminals',standard:'DIN EN 60617',defaultBmkPrefix:'-X',defaultFunctionText:'',
    width,height,unitsPerMm:2,insertionPoint:{x:pins[0].x,y:pins[0].y},pins,importedGraphics:graphics,
    svgContent:drawingToSvg(graphics),description:name,terminalDefinition:definition,
    electrical:{permanentConnections:permanent,...(conditional.length?{conditionalConnections:conditional}:{})},
    family:definition.kind==='installation'?'installation_terminal':'feed_terminal',
    keywords:['Klemme','Reihenklemme',...(definition.levels.length>1?['Mehrstockklemme','Etagenklemme']:['Durchgangsklemme','Potenzialverteilung']),
      ...definition.levels.map(l=>l.designation)],
    variantProperties:{Etagen:String(definition.levels.length),Klemmstellen:String(pins.length)},
  });
}
for (const count of [3,4]) {
  const pins:PinDefinition[]=[{id:'a',name:'a',x:8,y:0,direction:'top'},
    {id:'b',name:'b',x:8,y:24,direction:'bottom'},{id:'c',name:'c',x:16,y:8,direction:'right'},
    ...(count===4?[{id:'d',name:'d',x:0,y:8,direction:'left'} as PinDefinition]:[])];
  add(`terminal_feed_${count}`,`${count}-Leiter-Durchgangsklemme`,16,24,pins,
    [line(8,0,8,6),circle(8,8),line(8,10,8,24),line(10,8,16,8),...(count===4?[line(0,8,6,8)]:[])],
    {kind:'feed_through',mainLevel:'0',levels:[{id:'0',designation:'0',potential:'undefined',pinIds:pins.map(p=>p.id)}]});
}
for (const [id,name,potentials,disconnectN] of [
  ['terminal_double','Doppelstockklemme',['undefined','undefined'],false],
  ['terminal_triple','Dreistockklemme',['undefined','undefined','undefined'],false],
  ['terminal_installation_l_n_pe','Installationsetagenklemme L/N/PE',['L','N','PE'],false],
  ['terminal_installation_l_l_pe','Installationsetagenklemme L/L/PE',['L','L','PE'],false],
  ['terminal_installation_l_n_pe_disconnect','Installationsetagenklemme L/N/PE mit N-Trennung',['L','N','PE'],true],
] as const) {
  const pins:PinDefinition[]=[],graphics:DrawingPrimitive[]=[],levels:TerminalDefinition['levels']=[];
  potentials.forEach((potential,i)=>{
    const x=6+i*16,level=String(i+1),open=disconnectN&&potential==='N';
    const designation=potential==='undefined'?level:potential==='L'&&potentials.filter(p=>p==='L').length>1?'L'+(i+1):potential;
    const pinIds=[level+'.a',level+'.b'];
    pins.push(...pinIds.map((id,j):PinDefinition=>({id,name:id,x,y:j?20:0,direction:j?'bottom':'top',
      electricalRole:potential==='PE'?'protective_earth':potential==='N'?'neutral':potential==='L'?'power':'unknown'})));
    graphics.push(line(x,0,x,8),circle(x,10,potential==='PE'),line(x,12,x,open?14:20));
    if(open)graphics.push(line(x,14,x+4,17),line(x,18,x,20));
    if(i)graphics.push({kind:'line',x1:x-14,y1:10,x2:x-2,y2:10,color:'currentColor',width:.5,dash:[2,2]});
    levels.push({id:level,designation,potential,pinIds,...(open?{disconnectable:true}:{})});
  });
  add(id,name,12+(levels.length-1)*16,20,pins,graphics,{kind:id.includes('installation')?'installation':'multi_level',mainLevel:'1',levels});
}
export const TERMINAL_SYMBOLS = symbols;
