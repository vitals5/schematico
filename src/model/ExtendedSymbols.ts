import type { DrawingPrimitive as G, PinDefinition as Pin, SymbolDefinition as Symbol } from './types';
import { drawingToSvg } from './ImportedDrawing';

type Shape = { width: number; height: number; pins: Pin[]; graphics: G[] };
const ink = 'currentColor';
const line = (x1:number,y1:number,x2:number,y2:number,dash?:number[]):G => ({kind:'line',x1,y1,x2,y2,color:ink,width:.8,...(dash?{dash}:{})});
const rect = (x:number,y:number,width:number,height:number):G => ({kind:'rect',x,y,width,height,color:ink,lineWidth:.8});
const circle = (x:number,y:number,radius:number,fill?:string):G => ({kind:'circle',x,y,radius,color:ink,width:.8,...(fill?{fill}:{})});
const text = (x:number,y:number,value:string,size=7):G => ({kind:'text',x,y,text:value,size,color:ink,anchor:'middle'});
const pin = (id:string,x:number,y:number,direction:Pin['direction'],name=id):Pin => ({id,name,x,y,direction});
const ground = (x:number,y:number):G[] => [line(x,y-5,x,y),line(x-6,y,x+6,y),line(x-4,y+3,x+4,y+3),line(x-2,y+6,x+2,y+6)];
const coil = (x:number,y:number):G[] => [0,1,2].map(i=>({kind:'arc',x,y:y+4+i*8,radius:4,startAngle:-90,endAngle:90,color:ink,width:.8}));
const diode = (x:number,y:number):G[] => [{kind:'polygon',points:[{x:x-4,y:y-4},{x:x+4,y:y},{x:x-4,y:y+4}],color:ink,width:.8},line(x+4,y-4,x+4,y+4)];

/** Ports use a 16-unit pitch (8 mm); every physical anchor is on the 8-unit grid. */
function power(poles:number,kind:'breaker'|'isolator'|'fuse'|'rcd'|'rcbo'|'afdd',neutral=false):Shape {
  const width=Math.max(48,(poles+1)*16),height=80,pins:Pin[]=[],graphics:G[]=[];
  for(let i=0;i<poles;i++) {
    const x=16+i*16,n=neutral&&i===poles-1, a=n?'N-in':String(2*i+1),b=n?'N-out':String(2*i+2);
    pins.push(pin(a,x,0,'top',n?'N':a),pin(b,x,height,'bottom',n?'N':b));
    if(kind==='fuse')graphics.push(line(x,0,x,24),rect(x-4,24,8,24),line(x,24,x,48),line(x,48,x,height));
    else graphics.push(line(x,0,x,24),circle(x,24,1),line(x,24,x+6,42),line(x,48,x,height));
  }
  if(poles>1)graphics.push(line(16,32,16+(poles-1)*16,32,[3,2]));
  if(['breaker','rcbo'].includes(kind))graphics.push(text(7,64,'I>',5));
  if(['rcd','rcbo'].includes(kind))graphics.push(rect(8,48,width-16,16),text(width/2,59,'I diff',5.5),line(8,56,4,56),line(4,56,4,16),line(4,16,16,16));
  if(kind==='afdd')graphics.push(rect(8,50,width-16,18),text(width/2,62,'ARC',7));
  return {width,height,pins,graphics};
}
function relay(contacts:number,changeover=false,label=''):Shape {
  const width=changeover?48+contacts*48:48+contacts*16,height=80,pins:Pin[]=[pin('A1',16,0,'top'),pin('A2',16,height,'bottom')];
  const graphics:G[]=[line(16,0,16,28),rect(8,28,16,24),line(16,52,16,height)];
  if(label)graphics.push(text(16,43,label,6));
  for(let i=0;i<contacts;i++) {
    if(changeover) {
      const x=64+i*48,n=(i+1)*10;
      pins.push(pin(String(n+1),x,0,'top'),pin(String(n+2),x-16,height,'bottom'),pin(String(n+4),x+16,height,'bottom'));
      graphics.push(line(x,0,x,24),line(x,24,x-16,48),line(x-16,48,x-16,height),line(x+16,48,x+16,height),circle(x,24,1));
    } else {
      const x=48+i*16;
      pins.push(pin(String(2*i+1),x,0,'top'),pin(String(2*i+2),x,height,'bottom'));
      graphics.push(line(x,0,x,24),line(x,24,x+6,42),line(x,48,x,height));
    }
  }
  graphics.push(line(24,40,width-16,40,[3,2]));
  return {width,height,pins,graphics};
}
function moduleShape(label:string,top:string[]=[],bottom:string[]=[],left:string[]=[],right:string[]=[],icon=''):Shape {
  const width=Math.max(112,16*(Math.max(top.length,bottom.length)+1)),height=Math.max(80,16*(Math.max(left.length,right.length)+3));
  const pins:Pin[]=[],graphics:G[]=[rect(8,8,width-16,height-16)];
  for(const[side,names]of([['top',top],['bottom',bottom],['left',left],['right',right]]as const))names.forEach((name,i)=>{
    const x=side==='left'?0:side==='right'?width:16+i*16,y=side==='top'?0:side==='bottom'?height:32+i*16;
    let id=name;while(pins.some(p=>p.id===id))id+='-out';
    const label=name.replace(/-out$|o$/, "'").replace(/-IN$/, '');
    const port=pin(id,x,y,side,label);
    port.labelPosition={x:side==='left'?12:side==='right'?width-12:x,
      y:side==='top'?18:side==='bottom'?height-12:y+2,fontSize:5.5,
      alignment:side==='left'?'start':side==='right'?'end':'middle'};
    pins.push(port);
    graphics.push(line(x,y,side==='left'?8:side==='right'?width-8:x,side==='top'?8:side==='bottom'?height-8:y));
  });
  graphics.push(text(width/2,height/2,label,9));
  if(icon)graphics.push(text(width/2,height/2+13,icon,7));
  return {width,height,pins,graphics};
}
function contact(kind:'no'|'nc'|'changeover'|'cross'|'series',actuator=''):Shape {
  if(kind==='changeover') {
    const s=relay(1,true);s.graphics=s.graphics.slice(3).filter(g=>g.kind!=='line'||!g.dash);s.pins=s.pins.slice(2);
    s.graphics.push(text(24,38,actuator,7));return s;
  }
  const width=kind==='cross'||kind==='series'?64:48,height=80,graphics:G[]=[],pins:Pin[]=[];
  const s:Shape={width,height,pins,graphics};
  if(kind==='cross') {
    pins.push(pin('1',16,0,'top'),pin('3',48,0,'top'),pin('2',16,80,'bottom'),pin('4',48,80,'bottom'));
    graphics.push(line(16,0,16,24),line(48,0,48,24),line(16,24,48,44),line(48,24,16,44),
      circle(16,24,1),circle(48,24,1),line(16,48,16,80),line(48,48,48,80),line(8,36,56,36,[3,2]));
  } else {
    const count=kind==='series'?2:1;
    for(let i=0;i<count;i++) {
      const x=16+i*32;
      if(i===0)pins.push(pin(kind==='series'?'L':kind==='nc'?'21':'13',x,0,'top'));
      pins.push(pin(kind==='series'?String(i+1):kind==='nc'?'22':'14',x,80,'bottom'));
      graphics.push(line(x,i===0?0:12,x,24),circle(x,24,1),line(x,48,x,80));
      if(kind==='nc')graphics.push(line(x,24,x-8,48),line(x-8,48,x,48));
      else graphics.push(line(x,24,x+8,44));
    }
    if(kind==='series')graphics.push(line(16,12,48,12),circle(16,12,1.5,ink));
  }
  if(actuator==='Not-Halt')s.graphics.push(line(7,12,25,12),line(7,12,7,8),line(25,12,25,8),line(7,8,25,8),line(16,12,16,24));
  else if(actuator==='Rolle')s.graphics.push(circle(6,16,4),line(6,20,16,24));
  else if(actuator==='Feder')s.graphics.push(line(4,12,10,16),line(10,16,4,20),line(4,20,16,24));
  else if(actuator==='Hebel')s.graphics.push(line(2,8,16,24));
  else if(actuator) s.graphics.push(text(s.width/2,13,actuator,6));
  return s;
}
function terminal(levels:number,pe=false,disconnect=false,fused=false):Shape {
  const width=Math.max(48,16*(levels+1)),height=64,pins:Pin[]=[],graphics:G[]=[rect(8,12,width-16,40)];
  for(let i=0;i<levels;i++) {
    const x=16+i*16;
    pins.push(pin(`${i+1}.1`,x,0,'top',pe?'PE':String(i+1)),pin(`${i+1}.2`,x,height,'bottom',pe?'PE':String(i+1)));
    graphics.push(line(x,0,x,22),circle(x,24,2),circle(x,40,2),line(x,42,x,height));
    if(fused)graphics.push(rect(x-3,26,6,12),line(x,26,x,38));
    else if(disconnect)graphics.push(line(x,26,x+6,36));else graphics.push(line(x,26,x,38));
    if(pe)graphics.push(...ground(x,46));
  }
  return {width,height,pins,graphics};
}
function sockets(names:string[]):Shape {
  const width=Math.max(64,16*(names.length+1)),height=64,pins=names.map((n,i)=>pin(n,16+i*16,0,'top'));
  const graphics:G[]=[rect(8,16,width-16,40)];
  names.forEach((n,i)=>{const x=16+i*16;graphics.push(line(x,0,x,36),circle(x,40,4));if(n==='PE')graphics.push(...ground(x,47));});
  return {width,height,pins,graphics};
}
function transformer(taps=false):Shape {
  const width=80,height=80,pins=[pin('P1',16,0,'top'),pin('P2',16,80,'bottom'),pin('S1',64,0,'top'),pin('S2',64,80,'bottom')];
  const graphics:G[]=[line(16,0,16,24),...coil(16,24),line(16,48,16,80),line(64,0,64,24),...coil(64,24),line(64,48,64,80),line(36,20,36,56),line(44,20,44,56)];
  if(taps){pins.push(pin('S3',80,40,'right','12V'));graphics.push(line(64,40,80,40));}
  return {width,height,pins,graphics};
}
function sensor(label:string,output:'2wire'|'3wire'|'passive'='3wire',kind=''):Shape {
  const s=output==='3wire'?moduleShape(label,['1+'],['3-'],[],['4Q']):output==='2wire'?moduleShape(label,['1+'],['2-']):moduleShape(label,['1'],['2']);
  const cx=s.width/2,cy=s.height/2-18;
  if(kind==='inductive')s.graphics.push(...coil(cx-8,cy-8));
  if(kind)s.graphics=s.graphics.map(g=>g.kind==='text'&&g.text===label?{...g,y:58}:g);
  if(kind==='capacitive')s.graphics.push(line(cx-5,cy-8,cx-5,cy+8),line(cx+5,cy-8,cx+5,cy+8));
  if(kind==='optical')s.graphics.push(line(cx-14,cy+4,cx+10,cy-6),line(cx+10,cy-6,cx+4,cy-6),line(cx+10,cy-6,cx+7,cy));
  return s;
}
const FAMILY_KEYWORDS:Record<string,string[]>={
  mcb:['Leitungsschutzschalter','LS','MCB'],rcd:['Fehlerstromschutzschalter','FI','RCD'],rcbo:['FI/LS','RCBO'],
  afdd:['Brandschutzschalter','AFDD'],mpcb:['Motorschutzschalter','MSS','MPCB'],fuses:['Schmelzsicherung','Sicherung'],
  spd:['Überspannungsschutz','SPD'],power_breaker:['Leistungsschalter'],power_contactor:['Leistungsschütz','Schütz'],
  aux_relay:['Hilfsschütz','Schaltrelais','Hilfsrelais'],impulse_relay:['Stromstoßschalter','Teleruptor'],
  installation_contactor:['Installationsschütz'],ssr:['Halbleiterrelais','SSR'],timer_relay:['Zeitrelais'],
  safety_relay:['Sicherheitsschaltgerät','Sicherheitsrelais'],isolator:['Lasttrennschalter','Hauptschalter'],
  feed_terminal:['Durchgangsklemme','Reihenklemme'],installation_terminal:['Installationsklemme','Etagenklemme'],
  pe_terminal:['PE-Klemme','Schutzleiterklemme'],disconnect_terminal:['Trennklemme','Messklemme'],
  fused_terminal:['Sicherungsklemme'],phase_busbar:['Sammelschienenkamm','Phasenschiene'],distribution_block:['Potenzialverteilerblock','Sammelschiene'],
  psu:['Schaltnetzteil','PSU'],transformer:['Transformator','Trafo'],ups:['USV','Unterbrechungsfreie Stromversorgung'],
  converter:['Spannungswandler','Wandlung'],current_transformer:['Stromwandler'],energy_meter:['Energiezähler','Multifunktionsmessgerät'],
  command:['Befehlsgerät'],signal:['Meldeleuchte','Signalgeber'],limit_switch:['Positionsschalter','Endschalter'],
  proximity:['Näherungsschalter'],process_sensor:['Prozesssensor','Temperatursensor'],plc:['SPS','PLC'],io:['I/O-Modul','IO-Modul'],
  knx:['KNX','Gebäudeautomation'],network:['Netzwerkkomponente','Buskomponente'],interface:['Schnittstellenmodul'],
  vfd:['Frequenzumrichter','FU','VFD'],softstarter:['Sanftstarter'],brake_resistor:['Bremswiderstand'],line_filter:['Netzfilter','Netzdrossel'],
  light_switch:['Lichtschalter','Taster'],socket:['Steckdose'],twilight:['Dämmerungsschalter'],motion:['Bewegungsmelder','Präsenzmelder'],
  time_switch:['Zeitschaltuhr'],rail:['Tragschiene','Hutschiene'],duct:['Verdrahtungskanal'],climate:['Schrankklimatisierung'],
  cabinet_accessory:['Beleuchtung','Schrankzubehör']
};
const symbols:Symbol[]=[];
type Meta={ properties?:Record<string,string>; keywords?:string[]; alternatives?:string[]; technical?:string; master?:boolean; standard?:string; functionText?:string };
function add(family:string,id:string,name:string,category:Symbol['category'],prefix:string,shape:Shape,meta:Meta={}) {
  const key=id.toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').replace(/\+/g,'plus').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
  symbols.push({id:`catalog_${family}_${key}`,name,category,standard:meta.standard??'DIN EN 60617',defaultBmkPrefix:prefix,
    defaultFunctionText:meta.functionText??name.split(' – ')[0],description:name,unitsPerMm:2,width:shape.width,height:shape.height,
    insertionPoint:shape.pins[0]?{x:shape.pins[0].x,y:shape.pins[0].y}:{x:0,y:0},pins:shape.pins,importedGraphics:shape.graphics,svgContent:drawingToSvg(shape.graphics),
    family,keywords:[...FAMILY_KEYWORDS[family]??[],...meta.keywords??[]],bmkPrefixes:[prefix,...meta.alternatives??[]].filter(Boolean),variantProperties:meta.properties??{},
    technicalCharacteristics:meta.technical??Object.values(meta.properties??{}).join(' | '),...(meta.master?{isMaster:true}:{})});
}
const seq=(n:number,prefix:string)=>Array.from({length:n},(_,i)=>prefix+(i+1));

// 1. Overcurrent, residual-current, arc, motor and surge protection.
for(const [id,poles,n]of [['1p',1,false],['1p_n',2,true],['3p',3,false],['3p_n',4,true]]as const)
  for(const curve of ['B','C','D','K','Z'])add('mcb',`${id}_${curve}`,`Leitungsschutzschalter LS / MCB – ${id.replace('_','+').toUpperCase()}, ${curve}`,'protection','-F',power(poles,'breaker',n),{keywords:['Überstrom','Leitungsschutz'],properties:{Pole:id.replace('_','+').toUpperCase(),Charakteristik:curve},functionText:'Leitungsschutzschalter'});
for(const poles of [2,4])for(const type of ['A','F','B','B+'])for(const ma of [10,30,100,300])
  add('rcd',`${poles}p_${type==='B+'?'Bplus':type}_${ma}`,`Fehlerstrom-Schutzschalter FI / RCD – ${poles}P, Typ ${type}, ${ma} mA`,'protection','-F',power(poles,'rcd',true),{keywords:['FI','RCD','Fehlerstrom'],properties:{Pole:`${poles}P`,Typ:type,Auslösestrom:`${ma} mA`},functionText:'Fehlerstromschutzschalter'});
for(const te of [1,2])for(const curve of ['B','C'])add('rcbo',`${te}te_${curve}`,`FI/LS-Kombischalter RCBO – 1P+N, ${curve}, Typ A 30 mA, ${te} TE`,'protection','-F',power(2,'rcbo',true),{properties:{Pole:'1P+N',Charakteristik:curve,Typ:'A',Auslösestrom:'30 mA',Baubreite:`${te} TE`},functionText:'FI/LS-Kombischalter'});
for(const kind of ['AFDD','AFDD + LS B','AFDD + LS C','AFDD + FI/LS']) {
  const s=power(2,'afdd',true);
  s.graphics=s.graphics.map(g=>g.kind==='text'&&g.text==='ARC'?{...g,text:kind.includes('FI')?'ARC / I> / DI':kind.includes('LS')?'ARC / I>':'ARC',size:kind.includes('FI')?4:6}:g);
  add('afdd',kind,`Brandschutzschalter – ${kind}, 1P+N`,'protection','-F',s,{keywords:['Lichtbogen','Arc Fault Detection'],properties:{Ausführung:kind,Pole:'1P+N'},functionText:'Brandschutzschalter'});
}
for(const range of ['0,1–0,16','0,63–1','1–1,6','2,5–4','4–6,3','6–10','9–14','13–18','24–32','37–50','48–65'])add('mpcb',range.replace(/[^0-9]/g,'_'),`Motorschutzschalter MSS / MPCB – ${range} A`,'protection','-Q',power(3,'breaker'),{alternatives:['-F'],keywords:['thermisch','magnetisch','einstellbar','Überlast'],properties:{Einstellbereich:`${range} A`,Pole:'3P'},functionText:'Motorschutzschalter'});
for(const size of ['D01','D02','D03'])add('fuses',`neozed_${size}`,`Schmelzsicherung Neozed – ${size}`,'protection','-F',power(1,'fuse'),{properties:{System:'Neozed',Größe:size}});
for(const size of ['DII','DIII','DIV','DV'])add('fuses',`diazed_${size}`,`Schmelzsicherung Diazed – ${size}`,'protection','-F',power(1,'fuse'),{properties:{System:'Diazed',Größe:size}});
for(const size of ['00','0','1','2','3','4','4a']) {
  add('fuses',`nh_${size}`,`NH-Schmelzsicherung – Größe ${size}`,'protection','-F',power(1,'fuse'),{properties:{System:'NH',Größe:size}});
  const s=power(3,'fuse');s.graphics=s.graphics.filter(g=>!(g.kind==='line'&&g.y1===48&&g.y2===80));
  for(let i=0;i<3;i++){const x=16+i*16;s.graphics.push(line(x,48,x,56),line(x,56,x+6,68),line(x,72,x,80));}
  s.graphics.push(line(8,64,s.width-8,64,[3,2]));
  add('fuses',`nh_switch_${size}`,`NH-Sicherungs-Lasttrenner – 3P, Größe ${size}`,'protection','-F',s,{properties:{System:'NH-Trenner',Größe:size,Pole:'3P'}});
}
for(const curve of ['F','T'])add('fuses',`fine_${curve}`,`Feinsicherung – 5×20 mm, ${curve}`,'protection','-F',power(1,'fuse'),{properties:{Bauform:'5×20 mm',Charakteristik:curve}});
for(const size of ['10×38','14×51','22×58'])add('fuses','pv_'+size.replace('×','_'),`PV-Zylindersicherung gPV – ${size} mm`,'protection','-F',power(1,'fuse'),{properties:{Bauform:size+' mm',Klasse:'gPV',Anwendung:'Photovoltaik DC'}});
for(const[type,poles]of [['1',4],['2',2],['2',4],['3',2],['1+2',4],['2+3',2]]as const) {
  const width=16*(poles+1),graphics:G[]=[],pins:Pin[]=[];
  for(let i=0;i<poles;i++){const x=16+i*16; pins.push(pin(i===poles-1?'N':'L'+(i+1),x,0,'top'));graphics.push(line(x,0,x,24),rect(x-4,24,8,20),line(x-6,46,x+6,22),line(x,44,x,56));}
  pins.push(pin('PE',width/2,80,'bottom'));graphics.push(line(16,56,width-16,56),line(width/2,56,width/2,80),text(width/2,70,'SPD '+type,6));
  add('spd',`type_${type.replace('+','_')}_${poles}p`,`Überspannungsschutz SPD – Typ ${type}, ${poles===4?'3P+N':'1P+N'}`,'protection','-F',{width,height:80,pins,graphics},{properties:{Typ:type,Pole:poles===4?'3P+N':'1P+N'},keywords:['Blitzstromableiter','Grobschutz','Mittelschutz','Feinschutz']});
}
for(const type of ['MCCB','ACB'])for(const poles of [3,4])add('power_breaker',`${type}_${poles}p`,`Leistungsschalter ${type} – ${poles}P`,'protection','-Q',power(poles,'breaker'),{properties:{Bauform:type==='MCCB'?'Kompaktleistungsschalter':'Offener Leistungsschalter',Pole:`${poles}P`}});

// 2. Power and control switching, including assembled contactors.
for(const poles of [3,4])add('power_contactor',`${poles}p`,`Leistungsschütz – ${poles}P, AC-3`,'relays','-K',relay(poles),{master:true,alternatives:['-Q'],properties:{Pole:`${poles}P`,Gebrauchskategorie:'AC-3'}});
for(const type of ['reversing','star_delta']) {
  const star=type==='star_delta',s=moduleShape(star?'Y / D':'L / R',['L1','L2','L3'],star?['U1','V1','W1','U2','V2','W2']:['U','V','W'],star?['K1+','K1-','KY+','KY-','KD+','KD-']:['KF+','KF-','KR+','KR-']);
  for(let i=0;i<(star?3:2);i++){const x=40+i*24;s.graphics.push(rect(x-5,22,10,10),line(x,32,x,40),line(x,40,x+5,49),line(x,54,x,64));}
  if(!star)s.graphics.push(line(40,65,64,73),line(64,65,40,73));
  add('power_contactor',type,star?'Stern-Dreieck-Schützkombination':'Wendeschützkombination','relays','-K',s,{master:true,alternatives:['-Q'],properties:{Schaltung:star?'Stern-Dreieck':'Rechts-/Linkslauf'},keywords:['Motor','Verriegelung']});
}
for(const type of ['Koppelrelais','Miniaturrelais','Printrelais'])for(const count of [1,2,4])add('aux_relay',type+'_'+count,`${type} – ${count} Wechsler, 24 V DC`,'relays','-K',relay(count,true),{master:true,properties:{Kontakte:`${count} Wechsler`,Spule:'24 V DC'}});
for(const type of ['elektromechanisch','elektronisch'])for(const count of [1,2])add('impulse_relay',type+'_'+count,`Stromstoßschalter – ${type}, ${count} Schließer`,'relays','-K',relay(count,false,'I'),{master:true,properties:{Ausführung:type,Kontakte:`${count} Schließer`},keywords:['Teleruptor','Taster-Schaltung']});
for(const count of [2,4])for(const voltage of ['24 V DC','230 V AC'])add('installation_contactor',`${count}_${voltage.replaceAll(' ','_')}`,`Installationsschütz – ${count}P, ${voltage}`,'relays','-K',relay(count),{master:true,properties:{Pole:`${count}P`,Spule:voltage,Anwendung:'Verteilereinbau'},keywords:['geräuscharm','Licht','Heizung','Wallbox']});
for(const type of ['AC 1-phasig','DC 1-polig','AC 3-phasig']) {
  const s=moduleShape('SSR',type.includes('3-')?['1/L1','3/L2','5/L3']:['1/L'],type.includes('3-')?['2/T1','4/T2','6/T3']:['2/T'],['A1+','A2-']);
  s.graphics.push(...diode(s.width/2-24,24),line(s.width/2-12,18,s.width/2-6,12),line(s.width/2-12,24,s.width/2-6,18));
  add('ssr',type.replaceAll(' ','_'),`Halbleiterrelais SSR – ${type}`,'relays','-K',s,{properties:{Ausgang:type},keywords:['Solid State','verschleißfrei']});
}
for(const [id,label,mark]of [['on','ansprechverzögert','t ON'],['off','rückfallverzögert','t OFF'],['blink','blinkend','BLINK'],['multi','Multifunktion','t MULTI']]) {
  const s=relay(1,true,'t');s.pins.push(pin('B1',0,16,'left'));s.graphics.push(line(0,16,8,16),text(s.width/2,67,mark,6));
  add('timer_relay',id,`Zeitrelais – ${label}`,'relays','-K',s,{master:true,properties:{Funktion:label},keywords:['Zeitfunktion','Verzögerung']});
}
for(const [id,label]of [['estop','Not-Halt-Überwachung'],['guard','Schutztürüberwachung'],['osdd','Lichtgitter-Auswertung OSSD']]) {
  const s=moduleShape('SAFE',['A1','A2'],['13','14','23','24','33','34'],['S11','S12','S21','S22'],['Y1','Y2'],'2 CH');
  s.graphics.push(line(32,20,56,20),line(32,28,56,28),line(44,20,44,28,[2,2]));
  add('safety_relay',id,`Sicherheitsrelais – ${label}`,'relays','-K',s,{master:true,properties:{Funktion:label,Kanäle:'2'},keywords:['Sicherheitsschaltgerät','SIL','PLr','Rückführkreis']});
}
for(const poles of [3,4,5,6,7,8])add('isolator',`${poles}p`,`Lasttrennschalter / Hauptschalter – ${poles}P`,'relays','-Q',power(poles,'isolator'),{properties:{Pole:`${poles}P`}});
for(const poles of [3,4])add('isolator',`repair_${poles}p`,`Reparaturschalter – ${poles}P, abschließbar`,'relays','-Q',power(poles,'isolator'),{properties:{Pole:`${poles}P`,Ausführung:'abschließbar'}});

// 3. Isolated terminal levels, PE paths, testing and separate phase buses.
for(const technology of ['Federzug','Schraube','Push-in'])for(const levels of [1,2,3])add('feed_terminal',technology+'_'+levels,`Durchgangsklemme – ${technology}, ${levels}-stöckig`,'terminals','-X',terminal(levels),{properties:{Anschlusstechnik:technology,Etagen:String(levels)}});
for(const technology of ['Federzug','Schraube','Push-in'])for(const kind of ['L/L/PE','L/N/PE']) {
  const s=terminal(3);s.pins.forEach((p,i)=>p.name=kind.split('/')[Math.floor(i/2)]);s.graphics.push(...ground(48,46));
  if(kind.includes('N')){s.graphics=s.graphics.filter(g=>!(g.kind==='line'&&g.x1===32&&g.y1===26));s.graphics.push(line(32,26,38,36));}
  add('installation_terminal',technology+'_'+kind.replaceAll('/','_'),`Installations-Etagenklemme – ${kind}, ${technology}`,'terminals','-X',s,{properties:{Belegung:kind,Anschlusstechnik:technology,...(kind.includes('N')?{Neutralleiter:'N-Sammeltrennschieber'}:{})}});
}
for(const technology of ['Federzug','Schraube','Push-in'])add('pe_terminal',technology,`PE-Schutzleiterklemme – ${technology}`,'terminals','-X',terminal(1,true),{properties:{Anschlusstechnik:technology,Tragschienenkontakt:'PE'},keywords:['grüngelb','Schutzleiter']});
add('disconnect_terminal','knife','Trennklemme – Messertrennung','terminals','-X',terminal(1,false,true),{keywords:['Signalprüfung','Messklemme']});
add('disconnect_terminal','ct','Stromwandler-Prüfklemme – 2-polige Messtrennung','terminals','-X',terminal(2,false,true),{keywords:['Stromwandlerprüfung','Messklemme']});
for(const led of ['ohne LED','LED 24 V','LED 230 V']) {
  const s=terminal(1,false,false,true);
  if(led!=='ohne LED')s.graphics.push(line(16,20,24,20),line(24,20,24,32),line(24,32,28,32),
    ...diode(32,32),line(36,32,40,32),line(40,32,40,44),line(40,44,16,44),
    line(34,26,38,22),line(38,22,36,22),line(38,22,38,24));
  add('fused_terminal',led.replaceAll(' ','_'),`Sicherungsklemme – G-Sicherung 5×20 mm, ${led}`,'terminals','-X',s,{properties:{Sicherung:'5×20 mm',Defektanzeige:led}});
}
for(const phases of [1,3])for(const style of ['Gabel','Stift']) {
  const count=phases===1?6:9,width=(count+1)*16,pins:Pin[]=[],graphics:G[]=[];
  for(let k=0;k<phases;k++)graphics.push(line(16,24+k*16,width-16,24+k*16));
  for(let i=0;i<count;i++){const x=16+i*16,y=24+(i%phases)*16;pins.push(pin(`L${i%phases+1}.${Math.floor(i/phases)+1}`,x,0,'top'));graphics.push(line(x,0,x,y),circle(x,y,1.5,ink));if(style==='Gabel')graphics.push(line(x-3,0,x-3,8),line(x-3,8,x+3,8),line(x+3,8,x+3,0));}
  add('phase_busbar',`${phases}_${style}`,`Phasenschiene / Sammelschienenkamm – ${phases}-phasig, ${style}`,'terminals','-W',{width,height:80,pins,graphics},{alternatives:['-X'],properties:{Phasen:String(phases),Ausführung:style}});
}
for(const [id,label,count,prefix]of [['ptfix6','PTFIX-Potenzialverteiler 6-fach',6,'P'],['ptfix12','PTFIX-Potenzialverteiler 12-fach',12,'P'],['ptfix18','PTFIX-Potenzialverteiler 18-fach',18,'P'],['neutral','N-Verteilerblock / N-Sammelschiene',8,'N'],['pe','PE-Verteilerblock / PE-Sammelschiene',8,'PE'],['copper','Cu-Sammelschienensystem 60 mm',9,'L']]as const) {
  const copper=id==='copper';
  const s=moduleShape(copper?'3~ Cu':prefix,copper?['L1-IN','L2-IN','L3-IN']:[prefix+'-IN'],
    copper?Array.from({length:9},(_,i)=>`L${i%3+1}.${Math.floor(i/3)+1}`):seq(count,prefix));
  if(!copper){s.graphics.push(line(16,8,16,s.height-24),line(16,s.height-24,s.width-16,s.height-24));for(let i=0;i<count;i++)s.graphics.push(line(16+i*16,s.height-24,16+i*16,s.height-8));}
  else {
    // Inputs are at x=16/32/48; outputs start at x=80 so phase drops do not overlap.
    const w=240;s.width=w;s.graphics=[rect(8,8,w-16,64),text(w-36,24,'Cu',8)];
    s.pins=[];
    for(let phase=0;phase<3;phase++){
      const x=16+phase*16,y=24+phase*16;s.pins.push({...pin(`L${phase+1}-IN`,x,0,'top',`L${phase+1}`),labelPosition:{x,y:18,fontSize:5.5,alignment:'middle'}});
      s.graphics.push(line(x,0,x,y),line(x,y,w-16,y));
      for(let out=0;out<3;out++){
        const ox=80+(out*3+phase)*16;s.pins.push({...pin(`L${phase+1}.${out+1}`,ox,80,'bottom'),labelPosition:{x:ox,y:68,fontSize:5.5,alignment:'middle'}});
        s.graphics.push(line(ox,y,ox,80),circle(ox,y,1.5,ink));
      }
    }
  }
  if(id==='pe')s.graphics.push(...ground(s.width/2,s.height-24));
  add('distribution_block',id,label,'terminals','-X',s,{properties:{Abgänge:String(count),System:id==='copper'?'60 mm':prefix},keywords:['Potenzialverteiler','Potentialverteiler','Verteilerblock']});
}

// 4. Supplies, galvanic isolation, energy storage and measurement.
for(const voltage of [12,24,48])for(const redundancy of [false,true]) {
  const s=moduleShape('AC / DC',['L','N','PE'],['+','-'],[],redundancy?['13','14']:[]);
  s.graphics.push(line(24,24,s.width-24,s.height-24),text(32,s.height-25,'~',12),text(s.width-30,29,'=',12));
  add('psu',`${voltage}_${redundancy?'redundant':'standard'}`,`Schaltnetzteil PSU – 230 V AC / ${voltage} V DC${redundancy?', redundanzfähig':''}`,'supply','-G',s,{alternatives:['-T'],properties:{Eingang:'230 V AC',Ausgang:`${voltage} V DC`,Redundanz:redundancy?'redundanzfähig, DC-OK-Kontakt':'Standard'}});
}
add('psu','redundancy_module','Redundanzmodul – zwei DC-Eingänge','supply','-G',moduleShape('OR',['+1','-1','+2','-2'],['+','-']),{alternatives:['-T'],keywords:['Diodenentkopplung','redundant']});
for(const [id,label,ratio]of [['control','Steuertransformator','230 / 24 V AC'],['control400','Steuertransformator','400 / 230 V AC'],['bell8','Klingeltransformator','230 / 8 V AC'],['bell12','Klingeltransformator','230 / 12 V AC'],['bell_tapped','Klingeltransformator mit Anzapfung','230 / 8–12 V AC'],['isolation','Trenntransformator','230 / 230 V AC']])
  add('transformer',id,`${label} – ${ratio}`,'supply','-T',transformer(id==='bell_tapped'),{properties:{Übersetzung:ratio}});
for(const [id,label]of [['ac','USV – 230 V AC'],['dc','USV-Steuerung – 24 V DC'],['battery12','Batteriemodul – 12 V'],['battery24','Batteriemodul – 24 V'],['capacitor','Pufferkondensatormodul – 24 V']]) {
  const battery=id.startsWith('battery'),s=battery||id==='capacitor'?moduleShape(battery?'BAT':'CAP',['+'],['-']):moduleShape('UPS',id==='ac'?['L','N','PE']:['IN+','IN-'],id==='ac'?['L-out','N-out','PE-out']:['OUT+','OUT-'],id==='dc'?['BAT+','BAT-']:[]);
  if(battery)s.graphics.push(line(s.width/2-8,19,s.width/2-8,35),line(s.width/2+2,23,s.width/2+2,31));
  if(id==='capacitor')s.graphics.push(line(s.width/2-6,20,s.width/2-6,34),line(s.width/2+6,20,s.width/2+6,34));
  add('ups',id,label,'supply','-G',s,{keywords:['Unterbrechungsfreie Stromversorgung','Puffer','Batterie']});
}
add('converter','rectifier','Gleichrichterbrücke AC/DC','supply','-T',moduleShape('AC / DC',['~1','~2'],['+','-']),{alternatives:['-U'],keywords:['Gleichrichter','Brückengleichrichter']});
for(const [input,output]of [[24,12],[24,48],[48,24]])add('converter',`dc_${input}_${output}`,`DC/DC-Wandler – ${input} / ${output} V`,'supply','-U',moduleShape('DC / DC',['IN+','IN-'],['OUT+','OUT-']),{alternatives:['-T'],properties:{Eingang:`${input} V DC`,Ausgang:`${output} V DC`}});
for(const [id,label]of [['bar','Aufsteck-Stromwandler'],['wound','Wickel-Stromwandler'],['split','Klapp-Stromwandler'],['rogowski','Rogowskispule mit Integrator']]) {
  const s=moduleShape(id==='rogowski'?'Rogowski':'100 / 5 A',['P1'],['P2'],[],['S1','S2']);
  s.graphics.push(line(16,8,16,s.height-8),circle(16,s.height/2,9),circle(16,s.height/2,13));
  if(id==='split')s.graphics.push(line(4,s.height/2-14,28,s.height/2+14));
  add('current_transformer',id,label+(id==='rogowski'?'':' – 100/5 A'),'supply','-T',s,{properties:{Bauform:label,Übersetzung:id==='rogowski'?'Signal / Integrator':'100/5 A'},keywords:['Strommessung','Stromwandler']});
}
for(const mode of ['1ph_direct','3ph_direct','3ph_ct'])for(const bus of ['Modbus','M-Bus']) {
  const names=mode==='1ph_direct'?['L','N']:['L1','L2','L3','N'];
  const s=moduleShape('kWh',names,mode.endsWith('ct')?[]:names.map(n=>n+'o'),mode.endsWith('ct')?['I1+','I1-','I2+','I2-','I3+','I3-']:[],bus==='Modbus'?['A','B']:['M+','M-'],'MID');
  add('energy_meter',mode+'_'+bus,`Energiezähler / Multifunktionsmessgerät – ${mode==='1ph_direct'?'1-phasig direkt':mode==='3ph_direct'?'3-phasig direkt':'Wandlermessung'}, ${bus}`,'supply','-P',s,{properties:{Messung:mode,Bus:bus,Ausführung:'MID'},keywords:['MID','Direktmessung','Wandlermessung','Leistungsmessung']});
}

// 5. Operator controls, signals and process sensors.
for(const [id,label,kind,act]of [['push_no','Drucktaster Schließer','no','Taster'],['push_nc','Drucktaster Öffner','nc','Taster'],['selector2','Wahlschalter 2 Stellungen','changeover','0 / I'],['selector3','Wahlschalter 3 Stellungen','changeover','I 0 II'],['key','Schlüsselschalter','changeover','KEY'],['estop','Not-Halt-Pilztaster','nc','Not-Halt']]as const)
  add('command',id,label,'controls','-S',contact(kind,act),{keywords:['Schalttafel','Tür','Befehlsgerät']});
for(const color of ['rot','gelb','grün','blau','weiß']) {
  const s:Shape={width:48,height:64,pins:[pin('X1',24,0,'top'),pin('X2',24,64,'bottom')],graphics:[line(24,0,24,20),circle(24,32,12),line(16,24,32,40),line(16,40,32,24),line(24,44,24,64)]};
  add('signal','led_'+color,`LED-Meldeleuchte – ${color}`,'controls','-P',s,{properties:{Farbe:color},keywords:['Signalleuchte']});
}
for(const count of [3,5])add('signal','tower_'+count,`Signalsäule / Ampelleuchte – ${count} Segmente`,'controls','-P',moduleShape('SIGNAL',['COM'],seq(count,'H')),{properties:{Segmente:String(count)},keywords:['Ampel','Signalsäule']});
for(const label of ['Summer','Hupe']) {
  const s=moduleShape(label.toUpperCase(),['+'],['-']);s.graphics.push(line(32,20,40,16),line(40,16,40,32),line(40,32,32,28));
  add('signal',label,label,'controls','-P',s,{keywords:['akustisch','Signalgeber']});
}
for(const [id,act]of [['roller','Rolle'],['spring','Feder'],['lever','Hebel']]as const)for(const nc of [false,true])add('limit_switch',`${id}_${nc?'nc':'no'}`,`Positions-/Endschalter – ${act}, ${nc?'Öffner':'Schließer'}`,'sensors','-S',contact(nc?'nc':'no',act),{properties:{Betätigung:act,Kontakt:nc?'Öffner':'Schließer'}});
for(const type of ['inductive','capacitive'])for(const output of ['PNP','NPN'])add('proximity',type+'_'+output,`Näherungsschalter – ${type==='inductive'?'induktiv':'kapazitiv'}, ${output}`,'sensors','-B',sensor(output,'3wire',type),{properties:{Prinzip:type==='inductive'?'induktiv':'kapazitiv',Ausgang:output},keywords:['Metall','Flüssigkeiten','Schüttgut']});
for(const [id,label]of [['diffuse','Lichttaster'],['retro','Reflexions-Lichtschranke'],['receiver','Einweg-Lichtschranke Empfänger']])add('proximity',id,label,'sensors','-B',sensor('OPT','3wire','optical'),{properties:{Prinzip:'optisch'},keywords:['Lichtschranke','optisch']});
add('proximity','transmitter','Einweg-Lichtschranke Sender','sensors','-B',sensor('TX','2wire','optical'),{keywords:['optisch','Lichtschranke']});
for(const type of ['PT100','PT1000'])for(const count of [2,3,4]) {
  const s=moduleShape(type,seq(count,'R'));s.graphics.push(rect(s.width/2-5,18,10,16),line(s.width/2-10,36,s.width/2+10,16),text(s.width/2+16,22,'t',6));
  add('process_sensor',type+'_'+count,`Temperatursensor ${type} – ${count}-Leiter`,'sensors','-B',s,{properties:{Typ:type,Leiter:String(count)},keywords:['Widerstandsthermometer','Temperatur']});
}
for(const type of ['J','K'])add('process_sensor','thermocouple_'+type,`Thermoelement – Typ ${type}`,'sensors','-B',sensor('TC '+type,'passive'),{properties:{Typ:type},keywords:['Temperatur','Thermoelement']});
for(const type of ['Drucksensor','Temperaturtransmitter'])for(const output of ['0–10 V','4–20 mA'])add('process_sensor',type+'_'+output.replace(/[^0-9]/g,'_'),`${type} – ${output}`,'sensors','-B',sensor(type==='Drucksensor'?'p':'t',output.includes('mA')?'2wire':'3wire'),{properties:{Ausgang:output},keywords:['Prozesssensor','Temperatur','Druck']});

// 6. Automation and communications: signal ports remain independently editable.
add('plc','compact','SPS / PLC Kompakt-CPU – 8 DI / 8 DO','automation','-A',moduleShape('CPU',['L+','M'],[],seq(8,'I'),[...seq(8,'Q'),'ETH']),{alternatives:['-K'],properties:{Aufbau:'Kompakt',DI:'8',DO:'8'},keywords:['Speicherprogrammierbare Steuerung']});
add('plc','modular','SPS / PLC modulare CPU','automation','-A',moduleShape('CPU',['L+','M'],[],['ETH1','ETH2'],['BUS']),{alternatives:['-K'],properties:{Aufbau:'modular'},keywords:['Rack','SPS']});
add('plc','rack','SPS Rack / Baugruppenträger','automation','-A',moduleShape('RACK',['L+','M'],[],[],['BUS1','BUS2','BUS3','BUS4']),{alternatives:['-K'],keywords:['Baugruppenträger','Backplane']});
add('plc','supply','SPS Rack-Spannungsversorgung','automation','-A',moduleShape('PS',['L','N','PE'],['L+','M'],[],['BUS']),{alternatives:['-G'],keywords:['SPS','Rack','Versorgung']});
for(const count of [8,16]) {
  add('io','di_'+count,`Digitaleingangsmodul DI – ${count} Kanäle`,'automation','-A',moduleShape('DI',['L+','M'],[],seq(count,'I'),['BUS']),{properties:{Kanäle:String(count),Signal:'24 V DC'}});
  add('io','do_'+count,`Digitalausgangsmodul DO – ${count} Kanäle PNP`,'automation','-A',moduleShape('DO',['L+','M'],[],['BUS'],seq(count,'Q')),{properties:{Kanäle:String(count),Signal:'24 V DC PNP'}});
}
for(const type of ['AI','AO'])for(const signal of ['0–10 V','4–20 mA']) {
  const pins=Array.from({length:4},(_,i)=>[`${i+1}+`,`${i+1}-`]).flat();
  add('io',type+'_'+signal.replace(/[^0-9]/g,'_'),`Analog${type==='AI'?'eingangs':'ausgangs'}modul ${type} – 4 Kanäle, ${signal}`,'automation','-A',moduleShape(type,['L+','M'],[],type==='AI'?pins:['BUS'],type==='AO'?pins:['BUS']),{properties:{Kanäle:'4',Signal:signal}});
}
add('knx','supply','KNX-Spannungsversorgung – 30 V DC','automation','-A',moduleShape('KNX PS',['L','N'],['BUS+','BUS-']),{properties:{Bus:'KNX',Ausgang:'30 V DC'},keywords:['Gebäudeautomation']});
for(const count of [4,8,12])add('knx','switch_'+count,`KNX-Schaltaktor – ${count} Kanäle`,'automation','-A',moduleShape('KNX SW',['L','N'],[],['BUS+','BUS-'],Array.from({length:count},(_,i)=>[`${i+1}L`,`${i+1}Q`]).flat()),{properties:{Kanäle:String(count),Bus:'KNX'}});
for(const count of [2,4]) {
  add('knx','dim_'+count,`KNX-Dimmaktor – ${count} Kanäle`,'automation','-A',moduleShape('KNX DIM',['L','N'],[],['BUS+','BUS-'],seq(count,'DIM')),{properties:{Kanäle:String(count),Bus:'KNX'}});
  add('knx','blind_'+count,`KNX-Jalousieaktor – ${count} Kanäle`,'automation','-A',moduleShape('KNX UP/DN',['L','N'],[],['BUS+','BUS-'],Array.from({length:count},(_,i)=>[`${i+1}L`,`${i+1}UP`,`${i+1}DN`]).flat()),{properties:{Kanäle:String(count),Bus:'KNX'},keywords:['Rollladen','Jalousie']});
}
add('knx','dali','KNX-DALI-Gateway','automation','-A',moduleShape('KNX / DALI',['L','N'],[],['BUS+','BUS-'],['DA+','DA-']),{properties:{Bus:'KNX / DALI'}});
for(const count of [5,8,16])for(const mode of ['managed','unmanaged'])add('network','switch_'+count+'_'+mode,`Ethernet-Switch – ${count} Ports, ${mode}`,'automation','-K',moduleShape('SWITCH',['L+','M'],[],[],seq(count,'ETH')),{alternatives:['-T'],properties:{Ports:String(count),Management:mode},keywords:['LAN','Netzwerk']});
for(const bus of ['PROFINET','EtherCAT','Modbus'])add('network','coupler_'+bus,`Buskoppler – ${bus}`,'automation','-K',moduleShape(bus,['L+','M'],[],bus==='Modbus'?['A','B','GND']:['ETH1','ETH2'],['BUS']),{alternatives:['-T'],properties:{Bus:bus},keywords:['Feldbus','Buskoppler']});
add('network','media','Medienkonverter – Ethernet / Lichtwellenleiter','automation','-T',moduleShape('ETH / FO',['L+','M'],[],['ETH'],['TX','RX']),{alternatives:['-K'],keywords:['LWL','Glasfaser','Netzwerk']});
add('interface','opto','Optokoppler-Schnittstellenmodul','automation','-A',moduleShape('OPTO',[],[],['IN+','IN-'],['C','E']),{keywords:['galvanische Trennung','Schnittstelle']});
for(const levels of ['24 / 5 V','5 / 3,3 V'])add('interface','level_'+levels.replace(/[^0-9]/g,'_'),`Pegelwandler – ${levels}`,'automation','-A',moduleShape('LEVEL',['V+','GND'],[],['IN'],['OUT']),{properties:{Pegel:levels},keywords:['TTL','Schnittstelle']});
add('interface','usb_rs485','USB/RS485-Gateway','automation','-A',moduleShape('USB / RS485',[],[],['USB'],['A','B','GND']),{keywords:['Schnittstelle','Gateway']});

// 7. Drives and power electronics.
for(const phases of [1,3])add('vfd',phases+'ph',`Frequenzumrichter FU / VFD – ${phases}-phasige Einspeisung`,'motors','-U',moduleShape('VFD',phases===1?['L','N','PE']:['L1','L2','L3','PE'],['U','V','W','PE'],['RUN','AI','COM'],['BR+','BR-']),{alternatives:['-T'],properties:{Einspeisung:phases===1?'1~':'3~',Ausgang:'3~ variabel'},keywords:['Drehzahlregelung','FU','Umrichter']});
const soft=moduleShape('SOFTSTART',['L1','L2','L3'],['U','V','W'],['A1','A2','EN']);soft.graphics.push(...diode(soft.width/2,24));
add('softstarter','3ph','Sanftstarter – 3-phasig','motors','-U',soft,{keywords:['Motoranlauf','Strombegrenzung']});
for(const thermal of [false,true]) {
  const s=moduleShape('R', ['R+'],['R-'],[],thermal?['T1','T2']:[]);s.graphics.push(rect(s.width/2-5,18,10,16));
  add('brake_resistor',thermal?'thermal':'basic',`Bremswiderstand${thermal?' mit Temperaturkontakt':''}`,'motors','-R',s,{properties:{Überwachung:thermal?'Temperaturkontakt':'ohne'},keywords:['generatorisch','Bremsenergie']});
}
for(const [id,label,phases]of [['mains1','EMV-Netzfilter',1],['mains3','EMV-Netzfilter',3],['choke','Netzdrossel',3],['output','Ausgangsfilter',3],['sine','Sinusfilter',3]]as const) {
  const names=phases===1?['L','N','PE']:['L1','L2','L3','PE'];
  const s=moduleShape(id==='choke'?'L':id==='sine'?'SIN LC':'EMC LC',names,names.map(n=>n+'o'));
  for(let i=0;i<phases;i++)s.graphics.push(...coil(24+i*16,20));
  add('line_filter',id,`${label} – ${phases}-phasig`,'motors','-L',s,{properties:{Phasen:String(phases),Funktion:label},keywords:['EMV','Filter','Drossel']});
}

// 8. Building installation and field equipment.
for(const[id,label,kind]of [['off','Ausschalter','no'],['changeover','Wechselschalter','changeover'],['cross','Kreuzschalter','cross'],['series','Serienschalter','series'],['push','Lichttaster Schließer','no']]as const)add('light_switch',id,label,'installation','-S',contact(kind,id==='push'?'Taster':''),{keywords:['Licht','Installation']});
add('socket','schuko','Schuko-Steckdose – L/N/PE','installation','-X',sockets(['L','N','PE']),{properties:{Ausführung:'Schuko'},keywords:['Schutzkontakt']});
for(const color of ['rot','orange'])add('socket','edv_'+color,`EDV-Steckdose – ${color}, L/N/PE`,'installation','-X',sockets(['L','N','PE']),{properties:{Ausführung:'EDV',Farbe:color},keywords:['Schuko','Schutzkontakt']});
for(const amps of [16,32,63])for(const neutral of [false,true])add('socket',`cee_${amps}_${neutral?5:4}p`,`CEE-Steckdose – ${amps} A, ${neutral?'3P+N+PE':'3P+PE'}`,'installation','-X',sockets(neutral?['L1','L2','L3','N','PE']:['L1','L2','L3','PE']),{properties:{Strom:`${amps} A`,Pole:neutral?'3P+N+PE':'3P+PE'},keywords:['Drehstrom','CEE']});
add('twilight','controller','Dämmerungsschalter mit externem Lichtfühler','installation','-B',moduleShape('LUX',['L','N'],['11','12','14'],['S1','S2']),{keywords:['Helligkeit','Lichtfühler']});
add('twilight','sensor','Externer Lichtfühler','installation','-B',sensor('LUX','passive','optical'),{keywords:['Dämmerung','Fotozelle']});
for(const[id,label]of [['pir','PIR-Bewegungsmelder'],['hf','Radar-/HF-Bewegungsmelder'],['presence','PIR-Präsenzmelder']])add('motion',id,label,'installation','-B',moduleShape(id==='hf'?'HF':'PIR',['L','N'],['L-out']),{properties:{Prinzip:id==='hf'?'Radar / HF':'PIR'},keywords:['Präsenz','Bewegung']});
add('motion','presence_dali','Präsenzmelder DALI','installation','-B',moduleShape('PRESENCE',['L','N'],['DA+','DA-']),{properties:{Bus:'DALI'},keywords:['PIR','Präsenz']});
for(const[id,label]of [['daily','Mechanische Tages-Zeitschaltuhr'],['year','Digitale Jahres-Zeitschaltuhr'],['astro','Astro-Zeitschaltuhr']]) {
  const s=relay(1,true,'CLK');s.pins[0].name='L';s.pins[1].name='N';s.graphics.push(circle(16,40,6),line(16,40,16,36),line(16,40,20,42));
  add('time_switch',id,label,'installation','-K',s,{properties:{Programm:label},keywords:['Zeitschaltuhr','Kalender','Astro']});
}

// 9. Mechanical items have no fictitious electrical pins; powered accessories do.
for(const depth of [7.5,15]) {
  const width=80,height=48,low=8+depth*2;
  const graphics:G[]=[line(5,8,16,8),line(16,8,16,low),line(16,low,64,low),line(64,low,64,8),line(64,8,75,8),text(40,45,'TH35',7)];
  add('rail',String(depth).replace('.','_'),`Hutschiene / Tragschiene TH35 – ${String(depth).replace('.',',')} mm`,'structure','',{width,height,pins:[],graphics},{standard:'EN 60715',properties:{Profil:'TH35',Tiefe:depth+' mm'},keywords:['DIN-Schiene','Hutschiene']});
}
for(const size of [30,40])add('rail','c_'+size,`C-Profilschiene – C${size}`,'structure','',{width:80,height:48,pins:[],graphics:[line(24,12,56,12),line(56,12,56,36),line(56,36,24,36),line(24,12,24,18),line(24,36,24,30)]},{standard:'EN 60715',properties:{Profil:'C'+size},keywords:['Tragschiene']});
for(const size of ['25×40','40×60','60×80'])for(const halogenFree of [false,true]) {
  const width=80,height=96,graphics:G[]=[rect(8,8,64,80)];for(let i=0;i<5;i++)graphics.push(line(8,20+i*12,20,20+i*12),line(60,20+i*12,72,20+i*12));
  add('duct',size.replace('×','_')+'_'+(halogenFree?'hf':'standard'),`Verdrahtungskanal – ${size} mm, ${halogenFree?'halogenfrei':'geschlitzt'}`,'structure','',{width,height,pins:[],graphics},{standard:'EN 50085',properties:{Querschnitt:size+' mm',Material:halogenFree?'halogenfrei':'Standard'},keywords:['Kabelkanal','geschlitzt']});
}
add('climate','heater','Schaltschrankheizung – 230 V AC','structure','-E',moduleShape('HEAT',['L','N','PE']),{keywords:['Heizung','Schrankklimatisierung']});
for(const voltage of ['230 V AC','24 V DC']) {
  const s=moduleShape('FAN',voltage.startsWith('230')?['L','N','PE']:['+','-']);s.graphics.push(circle(s.width/2,25,10),line(s.width/2-7,18,s.width/2+7,32),line(s.width/2-7,32,s.width/2+7,18));
  add('climate','fan_'+voltage.replaceAll(' ','_'),`Filterlüfter – ${voltage}`,'structure','-M',s,{properties:{Versorgung:voltage},keywords:['Filter','Lüfter','Schrankklimatisierung']});
}
add('climate','cooler','Schaltschrankkühlgerät','structure','-E',moduleShape('COOL',['L','N','PE'],[],[],['13','14']),{keywords:['Kühlgerät','Schrankklimatisierung']});
for(const kind of ['Thermostat','Hygrostat'])for(const nc of [true,false])add('climate',kind+'_'+(nc?'nc':'no'),`${kind} – ${nc?'Öffner':'Schließer'}`,'structure','-B',contact(nc?'nc':'no',kind==='Thermostat'?'t':'%'),{properties:{Kontakt:nc?'Öffner':'Schließer'},keywords:['Schrankklimatisierung','Temperatur','Feuchte']});
const lamp=moduleShape('LIGHT',['L','N','PE']);lamp.graphics.push(circle(lamp.width/2,24,8),line(lamp.width/2-5,19,lamp.width/2+5,29),line(lamp.width/2-5,29,lamp.width/2+5,19),line(20,55,32,55),line(32,55,40,63));
add('cabinet_accessory','light','Schaltschrankleuchte mit Türkontaktschalter','structure','-E',lamp,{keywords:['Beleuchtung','Türkontakt','Zubehör']});
add('cabinet_accessory','service_socket','Servicesteckdose für Tragschiene','structure','-X',sockets(['L','N','PE']),{keywords:['Hutschiene','Service','Schuko','Zubehör']});

export const EXTENDED_SYMBOL_DEFINITIONS: Symbol[] = symbols;
