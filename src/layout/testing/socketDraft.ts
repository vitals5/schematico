export function socketDraft(count=5,perCircuit=2){
 const components:any[]=[{id:'R',symbolId:'rcd_4p',bmk:'-F1',functionText:'FI-Schutzschalter 30 mA',technicalCharacteristics:'40 A / 30 mA Typ A'}];
 const connections:any[]=[],groups:any[]=[];
 const connect=(a:string,p:string,b:string,q:string,potential:string)=>connections.push({id:'w'+connections.length,from:{componentId:a,pinId:p},to:{componentId:b,pinId:q},potential});
 ['L1','L2','L3','N','PE'].forEach((p,i)=>{components.push({id:'IN'+i,symbolId:p==='PE'?'terminal_pe':'terminal_single',bmk:'-X1:'+i,functionText:'Einspeisung '+p});if(i<4)connect('IN'+i,'1','R',['1','3','5','N_in'][i],p);});
 for(let i=0;i<count;i++){
  const breaker='F'+i,phase=i%3;
  components.push({id:breaker,symbolId:'catalog_mcb_1p_b',bmk:'-F'+(i+2),functionText:`Steckdosenkreis ${i+1} (L${phase+1})`,technicalCharacteristics:'B16 A'});
  connect('R',['2','4','6'][phase],breaker,'1','L'+(phase+1));
  const members=[breaker];
  for(let j=0;j<perCircuit;j++){
   const id='X'+i+'_'+j;members.push(id);
   components.push({id,symbolId:'socket_schuko',bmk:'-X'+(i*perCircuit+j+2),functionText:`Steckdose ${i+1}.${j+1} (Kreis ${i+1})`});
   connect(breaker,'2',id,'1','L'+(phase+1));
   connect(j?members[members.length-2]:'R',j?'N':'N_out',id,'N','N');
   connect(j?members[members.length-2]:'IN4',j?'PE':'1',id,'PE','PE');
  }
  groups.push({id:'group'+i,members});
 }
 return {components,connections,groups};
}
