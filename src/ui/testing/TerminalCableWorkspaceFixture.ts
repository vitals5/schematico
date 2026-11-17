import {fixture,add} from '../../layout/testing/fixture';
/** Synthetic terminal/cable records, not a manufacturer assembly drawing. */
export function terminalCableWorkspaceFixture(){
 const p=fixture();p.name='Klemmen und Kabel';p.pages[0].title='Schrank und Feld';
 const a=add(p,'supply','circuit_breaker_3p',50,70),b=add(p,'load','circuit_breaker_3p',400,300);a.bmk='-Q1';b.bmk='-M1';
 for(let i=0;i<8;i++){const c=add(p,'terminal-'+i,'terminal_single',80+i*60,180);c.bmk='-X1:'+(i+1);c.functionText=['Sensor Versorgung','Rückmeldung','Freigabe','Temperatur','Reserve','Service','0 V','Schirm'][i];c.terminal={strip:'-X1',number:String(i+1),level:i===3?'2':'',pinSides:{'1':'internal','2':'external'}};
  if(i<3){p.pages[0].wires.push({id:'internal-'+i,from:{componentId:a.id,pinId:['1','3','5'][i]},to:{componentId:c.id,pinId:'1'},potential:['L1','N','PE'][i],color:['BN','BU','GNYE'][i],crossSection:'1.5'});p.pages[0].wires.push({id:'external-'+i,from:{componentId:c.id,pinId:'2'},to:{componentId:b.id,pinId:['1','3','5'][i]},potential:['L1','N','PE'][i],color:['BN','BU','GNYE'][i],crossSection:'1.5'});}
 }
 for(let i=0;i<4;i++){const c=add(p,'other-'+i,'terminal_single',80+i*60,380);c.bmk='-X2:'+(i+1);c.functionText='Digitaler Eingang '+(i+1);if(i!==3)c.terminal={strip:'-X2',number:String(i+1),level:'',pinSides:{'1':'external','2':'internal'}};}
 p.logicalConnections=[{id:'bridge-saved',terminalBridge:'plug',from:{componentId:'terminal-4',pinId:'1'},to:{componentId:'terminal-5',pinId:'1'},potential:'Signal'}];
 p.pages[0].cables=[{id:'control',bmk:'-W1',cableType:'Steuerleitung',coreCount:6,crossSection:'1.5',start:{x:300,y:220},end:{x:350,y:220},cores:[{id:'phase',designation:'1',color:'BN',wireIds:['external-0'],t:.2},{id:'neutral',designation:'2',color:'BU',wireIds:['external-1'],t:.4},{id:'earth',designation:'PE',color:'GNYE',wireIds:['external-2'],t:.6},{id:'spare',designation:'4',color:'BK',reserve:true,wireIds:[],t:.8}]},{id:'sensor',bmk:'-W2',cableType:'Sensorleitung',coreCount:3,crossSection:'0.5',start:{x:400,y:220},end:{x:440,y:220},cores:[{id:'plus',designation:'+',color:'RD',t:.25},{id:'minus',designation:'-',color:'BU',t:.5},{id:'signal',designation:'S',color:'WH',reserve:true,t:.75}]}];
 return p;
}
