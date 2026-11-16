import {jsPDF} from 'jspdf';
import {connectionColumns,connectionCells,type ConnectionRow} from '../reports/ConnectionList';
/** Wrapped, paginated landscape report; long cells continue instead of clipping. */
export function connectionListPdf(rows:ConnectionRow[],projectName:string):jsPDF{
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a3'});
  const widths=[17,31,21,46,46,20,17,23,25,20,22,112];let y=0,page=0;
  const header=()=>{page++;doc.setFont('helvetica','bold');doc.setFontSize(13);doc.text('Verbindungsliste',10,12);doc.setFontSize(8);doc.text(doc.splitTextToSize(projectName,350),10,18);doc.text(String(page),400,12);y=29;let x=10;doc.setFontSize(7);for(let i=0;i<widths.length;i++){doc.text(doc.splitTextToSize(connectionColumns[i],widths[i]-2),x,y);x+=widths[i];}y+=9;doc.setFont('helvetica','normal');};header();
  for(const row of rows){doc.setFontSize(7);const cells=connectionCells(row).map((c,i)=>doc.splitTextToSize(c||'—',widths[i]-2) as string[]);let at=0,total=Math.max(...cells.map(c=>c.length));
    while(at<total){if(y+4>283){doc.addPage();header();}const count=Math.min(total-at,Math.floor((283-y)/3.5));let x=10;for(let i=0;i<cells.length;i++){const lines=cells[i].slice(at,at+count);if(lines.length)doc.text(lines,x,y);x+=widths[i];}y+=count*3.5+2;at+=count;}
  }
  if(!rows.length)doc.text('Keine Verbindungen im gewählten Filter.',10,y);
  return doc;
}
