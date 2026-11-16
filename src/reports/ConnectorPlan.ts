import type {ConnectorRow} from '../model/Connectors';
export const connectorColumns=['Steckverbinder','Typ','Position','Belegung','Blatt','Anschluss','Gegenstück','Gegenposition','Gegenanschluss','Verdrahtungsziele','Hinweise'];
export const connectorCells=(r:ConnectorRow)=>[r.bmk,r.side,r.position,r.state,r.page,r.endpoint,r.mate,r.matePosition,r.mateEndpoint,r.targets.join(' | '),r.issues.join('; ')];
export function connectorCsv(rows:ConnectorRow[]):string{return '\uFEFF'+[connectorColumns,...rows.map(connectorCells)].map(row=>row.map(v=>'"'+(/^[=+@\-\t\r]/.test(v)?"'":'')+v.replaceAll('"','""')+'"').join(';')).join('\r\n');}
