import type { PlacedComponent } from '../model/types';
import { escapeSvg } from '../model/ImportedDrawing';
import { resizeDeviceBox } from '../model/DeviceBoxElement';
import { t } from '../i18n';

export function deviceBoxFields(component:PlacedComponent,units:number):string {
  const box=component.deviceBox;if(!box)return '';
  return `<fieldset style="border:1px solid var(--border-color);padding:10px;margin:8px 0"><legend>${t('legendDeviceBox')}</legend>
    ${[['Width',t('boxLabelWidth'),box.width],['Height',t('boxLabelHeight'),box.height],['LineWidth',t('boxLabelLineWidth'),box.lineWidth]].map(([id,label,n])=>{
      const value=String(Number((Number(n)/units).toFixed(4)));
      return `<label class="form-label">${label} (mm)<input class="form-input" type="number" step="any" min="${id==='LineWidth'?.05:.1}" ${id==='LineWidth'?'max="5"':''} id="box${id}" value="${value}" data-initial="${value}"></label>`;
    }).join('')}
    <label class="form-label">${t('boxLabelLineStyle')}<select class="form-input" id="boxLineStyle"><option value="solid" ${box.lineStyle==='solid'?'selected':''}>${t('boxStyleSolid')}</option><option value="dashed" ${box.lineStyle==='dashed'?'selected':''}>${t('boxStyleDashed')}</option></select></label>
    <label class="form-label"><input id="boxOwnColor" type="checkbox" ${box.color?'checked':''}> ${t('boxLabelFrameColor')}</label>
    <input id="boxColor" type="color" aria-label="${t('boxAriaFrameColor')}" value="${escapeSvg(box.color??'#4299e1')}">
    <p style="font-size:11px;color:var(--text-muted)">${t('boxLabelDisplayHint')}</p></fieldset>`;
}
export function collectDeviceBoxFields(container:ParentNode,component:PlacedComponent,units:number):boolean {
  const box=component.deviceBox;if(!box||!container.querySelector('#boxWidth'))return true;
  const fields=['Width','Height','LineWidth'].map(key=>container.querySelector<HTMLInputElement>('#box'+key)!);
  const invalid=fields.find(input=>!input.value.trim()||!Number.isFinite(Number(input.value))||!input.validity.valid);
  if(invalid){invalid.reportValidity();return false;}
  const width=fields[0].value===fields[0].dataset.initial?box.width:Number(fields[0].value)*units;
  const height=fields[1].value===fields[1].dataset.initial?box.height:Number(fields[1].value)*units;
  resizeDeviceBox(component,width,height);
  if(fields[2].value!==fields[2].dataset.initial)box.lineWidth=Number(fields[2].value)*units;
  box.lineStyle=container.querySelector<HTMLSelectElement>('#boxLineStyle')!.value as 'solid'|'dashed';
  if(container.querySelector<HTMLInputElement>('#boxOwnColor')!.checked)box.color=container.querySelector<HTMLInputElement>('#boxColor')!.value;else delete box.color;
  return true;
}
