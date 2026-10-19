const key=(path:string)=>path.replace(/\\/g,'/').replace(/\/+/g,'/').toLowerCase();
const basename=(path:string)=>key(path).split('/').at(-1)!;

function imageUrl(node:Element):string {
  if(node.getAttribute('Coding')!=='Hex')throw new Error('Unbekannte Kodierung eines eingebetteten Bildes.');
  const hex=(node.textContent??'').replace(/\s+/g,'');
  if(!hex.length||hex.length%2||hex.length>64*1024*1024||/[^0-9a-f]/i.test(hex))throw new Error('Ungültige eingebettete Bilddaten.');
  const data=Uint8Array.from(hex.match(/../g)!,part=>parseInt(part,16));
  const type=data[0]===0x89&&data[1]===0x50?'image/png':data[0]===0xff&&data[1]===0xd8?'image/jpeg'
    :data[0]===0x47&&data[1]===0x49?'image/gif':data[0]===0x42&&data[1]===0x4d?'image/bmp'
    :String.fromCharCode(...data.subarray(8,12))==='WEBP'?'image/webp':undefined;
  if(!type)throw new Error('Das eingebettete Bildformat wird noch nicht unterstützt.');
  let binary='';for(let i=0;i<data.length;i+=32768)binary+=String.fromCharCode(...data.subarray(i,i+32768));
  return `data:${type};base64,${btoa(binary)}`;
}

/** Local embedded files only. Importing a macro never fetches remote URLs. */
export function embeddedXmlImages(root:Element,page:Element) {
  const nodes=[...Array.from(page.getElementsByTagName('ExternalFile')),...Array.from(root.getElementsByTagName('ExternalFile'))];
  const byPath=new Map<string,Element>(),byName=new Map<string,Set<string>>(),urls=new Map<Element,string>();
  for(const node of nodes){
    const path=node.getAttribute('Path')??'';if(!path)continue;
    if(!byPath.has(key(path)))byPath.set(key(path),node);
    const name=basename(path);if(!byName.has(name))byName.set(name,new Set());byName.get(name)!.add(key(path));
  }
  return (path:string):string|undefined=>{
    const alternatives=byName.get(basename(path));
    const node=byPath.get(key(path))??(alternatives?.size===1?byPath.get([...alternatives][0]):undefined);
    if(!node)return;
    if(!urls.has(node))urls.set(node,imageUrl(node));return urls.get(node);
  };
}
