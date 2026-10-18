import { PageImage } from '../model/types';

/** Store a self-contained PNG so the same image works in editor and PDF. */
export async function readImageFile(file:File,unitsPerMm:number):Promise<Omit<PageImage,'id'|'x'|'y'>> {
  if(file.size>32*1024*1024)throw new Error('Die Grafikdatei darf höchstens 32 MB groß sein.');
  const url=URL.createObjectURL(file);
  try {
    const image=new Image();image.src=url;await image.decode();
    if(!image.naturalWidth||!image.naturalHeight)throw new Error('Die Grafik enthält kein lesbares Bild.');
    const scale=Math.min(1,4096/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Die Grafik kann nicht verarbeitet werden.');
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const widthMm=Math.min(100,75*image.naturalWidth/image.naturalHeight);
    return {dataUrl:canvas.toDataURL('image/png'),width:widthMm*unitsPerMm,height:widthMm*image.naturalHeight/image.naturalWidth*unitsPerMm,caption:file.name};
  } catch(error) {
    if(error instanceof Error && error.message.startsWith('Die Grafik'))throw error;
    throw new Error('Diese Grafikdatei kann nicht gelesen werden. Bitte eine unterstützte Bilddatei wie PNG, JPEG, WebP, GIF, BMP oder SVG wählen.');
  } finally {URL.revokeObjectURL(url);}
}
