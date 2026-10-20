import type { PageBox } from '../model/types';
import { escapeSvg } from '../model/ImportedDrawing';
import { t } from '../i18n';

export function renderDeviceBoxProperties(container:HTMLElement,box:PageBox,units:number,onApply:()=>void,onDelete:()=>void):void {
  const fields=[['X',t('boxLabelPosX'),box.x],['Y',t('boxLabelPosY'),box.y],['Width',t('boxLabelWidth'),box.width],['Height',t('boxLabelHeight'),box.height],['LineWidth',t('boxLabelLineWidth'),box.lineWidth??1.2],['FontSize',t('boxLabelFontSize'),box.fontSize??11]] as const;
  container.innerHTML=`<h3>${t('boxHeading')}</h3>
    <label class="form-label">${t('boxLabelBmk')}<input class="form-input" id="boxBmk" value="${escapeSvg(box.bmk??'')}"></label>
    <label class="form-label">${t('boxLabelFunction')}<textarea class="form-input" id="boxLabel" rows="2">${escapeSvg(box.label??'')}</textarea></label>
    <label class="form-label">${t('boxLabelDescription')}<textarea class="form-input" id="boxDescription" rows="2">${escapeSvg(box.description??'')}</textarea></label>
    <label class="form-label">${t('boxLabelSubLabel')}<input class="form-input" id="boxSubLabel" value="${escapeSvg(box.subLabel??'')}"></label>
    ${fields.map(([id,label,value])=>`<label class="form-label">${label} (mm)<input class="form-input" id="box${id}" type="number" step="any" ${id!=='X'&&id!=='Y'?`min="${id==='LineWidth'?.05:.1}"`:''} ${id==='FontSize'?'max="20"':id==='LineWidth'?'max="5"':''} value="${Number((value/units).toFixed(4))}"></label>`).join('')}
    <label class="form-label">${t('boxLabelLineStyle')}<select class="form-input" id="boxLineStyle"><option value="solid">${t('boxStyleSolid')}</option><option value="dashed">${t('boxStyleDashed')}</option></select></label>
    <label class="form-label"><input type="checkbox" id="boxOwnColor" ${box.color?'checked':''}> ${t('boxLabelOwnColor')}</label>
    <input id="boxColor" type="color" value="${escapeSvg(box.color??'#4299e1')}" ${box.color?'':'disabled'} aria-label="${t('boxAriaColor')}">
    <p style="font-size:12px;color:var(--text-muted)">${t('boxHint')}</p>
    <p id="boxPropertyError" role="alert" style="color:var(--danger)"></p>
    <button class="btn btn-primary" id="applyBoxProperties">${t('btnApply')}</button> <button class="btn" id="deleteBox">${t('btnDelete')}</button>`;
  const style=container.querySelector<HTMLSelectElement>('#boxLineStyle')!;
  style.value=box.lineStyle??(box.kind==='device'?'solid':'dashed');
  const ownColor=container.querySelector<HTMLInputElement>('#boxOwnColor')!,color=container.querySelector<HTMLInputElement>('#boxColor')!;
  ownColor.addEventListener('change',()=>color.disabled=!ownColor.checked);
  const originals=new Map(fields.map(([id])=>[id,container.querySelector<HTMLInputElement>('#box'+id)!.value]));
  container.querySelector('#applyBoxProperties')!.addEventListener('click',()=>{
    const values=fields.map(([id])=>container.querySelector<HTMLInputElement>('#box'+id)!);
    if(values.some(input=>!input.value.trim()||!input.validity.valid||!Number.isFinite(Number(input.value)))){
      container.querySelector('#boxPropertyError')!.textContent=t('boxErrorInvalid');return;
    }
    const before=JSON.stringify(box);
    for(const [i,[id]]of fields.entries())if(values[i].value!==originals.get(id)){
      const key=({X:'x',Y:'y',Width:'width',Height:'height',LineWidth:'lineWidth',FontSize:'fontSize'} as const)[id];box[key]=Number(values[i].value)*units;
    }
    box.bmk=container.querySelector<HTMLInputElement>('#boxBmk')!.value;
    box.label=container.querySelector<HTMLTextAreaElement>('#boxLabel')!.value;
    box.description=container.querySelector<HTMLTextAreaElement>('#boxDescription')!.value;
    box.subLabel=container.querySelector<HTMLInputElement>('#boxSubLabel')!.value;
    box.lineStyle=style.value as 'solid'|'dashed';
    if(ownColor.checked)box.color=color.value;else delete box.color;
    if(JSON.stringify(box)!==before)onApply();
  });
  container.querySelector('#deleteBox')!.addEventListener('click',onDelete);
}
