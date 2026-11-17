import {fixture,add} from '../../layout/testing/fixture';
import {editConnectors,type ConnectorAssembly} from '../../model/Connectors';

/** Synthetic contacts and connections for UI checks; not a manufacturer pinout. */
export function wiringWorkspaceFixture(){
  let p=fixture();p.name='Stecker und Verdrahtung';p.pages[0].title='Schrank und Feld';
  for(let i=0;i<4;i++){
    const a=add(p,'cabinet-'+i,'socket_schuko',80+i*140,100),b=add(p,'field-'+i,'socket_schuko',80+i*140,260);a.bmk='-X'+(i+1);b.bmk='-X'+(i+11);
    for(const [j,pin]of ['L','N','PE'].entries())p.pages[0].wires.push({id:'wire-'+i+'-'+pin,wireNumber:String(i*3+j+1),from:{componentId:a.id,pinId:pin==='L'?'1':pin},to:{componentId:b.id,pinId:pin==='L'?'1':pin},potential:pin==='L'?'L1':pin,color:pin==='L'?'BN':pin==='N'?'BU':'GNYE',crossSection:'2,5 mm²',...(i===1?{isAutoconnect:true}:{}),...(i===2?{lengthMm:1200+j*100}:{})});
  }
  const save=(c:ConnectorAssembly)=>{p=editConnectors(p,{kind:'save',connector:c});};
  for(const side of ['male','female'] as const){const male=side==='male',id=male?'housing-m':'housing-f';save({id,bmk:male?'-X20':'-X21',plant:'Fertigung',location:male?'Schrank':'Feld',side,description:male?'Sensorik · Schaltschrankseite':'Sensorik · Feldseite',contacts:[{position:'1',binding:{pageId:'p',componentId:male?'cabinet-0':'field-0',pinId:'1'}},{position:'2',binding:{pageId:'p',componentId:male?'cabinet-0':'field-0',pinId:'N'}},{position:'3',disposition:'free'},{position:'4',disposition:'reserve'},{position:'5'},{position:'6'},{position:'PE',binding:{pageId:'p',componentId:male?'cabinet-0':'field-0',pinId:'PE'}}]});}
  p=editConnectors(p,{kind:'pair',pair:{id:'mechanical-pair',maleId:'housing-m',femaleId:'housing-f',contacts:['1','2','3','4','5','6','PE'].map(v=>({malePosition:v,femalePosition:v}))}});
  save({id:'housing-spare',bmk:'-X30',plant:'Fertigung',location:'Reserve',side:'female',description:'Serviceanschluss · noch nicht zugeordnet',contacts:[{position:'1'},{position:'2'},{position:'3'},{position:'4',disposition:'reserve'}]});
  return p;
}
