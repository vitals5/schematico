import type { PlacedComponent, Project } from '../model/types';
import { getSymbolForComponent } from '../model/symbols';
import { escapeSvg as esc } from '../model/ImportedDrawing';
import { t } from '../i18n';
const componentFields = ['articleRequirement', 'referenceRequirement'] as const;
const pinFields = ['connectionRequirement', 'potentialConstraint'] as const;
const controlId = (field: string, pinId?: string) => 'inspection-' + field + (pinId === undefined ? '' : '-' + encodeURIComponent(pinId));
export function renderInspectionFields(component: PlacedComponent, components: PlacedComponent[], project: Project, dirty: ReadonlySet<string>): string {
    const common = (getSymbolForComponent(component, project)?.pins ?? []).filter(p => components.every(c => getSymbolForComponent(c, project)?.pins.some(q => q.id === p.id)));
    const control = (field: string, label: string, options: [
        string,
        string
    ][] | undefined, pinId?: string) => {
        const id = controlId(field, pinId), get = (c: PlacedComponent) => (pinId === undefined ? (c as any)[field] : (c.pins[pinId] as any)?.[field]) ?? '';
        const mixed = !dirty.has(id) && components.some(c => get(c) !== get(components[0])), value = dirty.has(id) ? get(component) : get(components[0]);
        const attrs = `id="${esc(id)}" data-inspection-control="${esc(field)}" ${pinId === undefined ? '' : `data-inspection-pin="${esc(pinId)}"`} class="form-input" style="font-size:11px;max-width:185px"`;
        return `<label style="font-size:11px;display:inline-flex;flex-direction:column;margin:4px">${esc(label)}${options ? `<select ${attrs}>${mixed ? `<option value="__mixed" disabled selected>${esc(t('sharedDifferentValues'))}</option>` : ''}${options.map(([v, l]) => `<option value="${esc(v)}" ${!mixed && v === value ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>` : `<input ${attrs} value="${mixed ? '' : esc(value)}" placeholder="${mixed ? esc(t('sharedDifferentValues')) : ''}">`}</label>`;
    };
    const inherit: [
        string,
        string
    ] = ['', t('inspectionInherit')], required: [
        string,
        string
    ] = ['required', t('inspectionRequired')], optional: [
        string,
        string
    ] = ['optional', t('inspectionOptional')];
    return `<details class="inspection-policies"><summary>${esc(t('inspectionSettings'))}</summary>
    ${control('articleRequirement', t('inspectionArticle'), [inherit, required, optional, ['none', t('inspectionNone')]])}
    ${control('referenceRequirement', t('inspectionReference'), [inherit, required, optional])}
    ${common.map(p => `<div><span style="font-family:monospace">${esc(p.name)} (${esc(p.id)})</span>${control('connectionRequirement', t('inspectionSettings'), [inherit, required, optional, ['reserve', t('inspectionReserve')]], p.id)}${control('potentialConstraint', t('inspectionPotential'), undefined, p.id)}</div>`).join('')}</details>`;
}
export function collectInspectionFields(modal: HTMLElement, component: PlacedComponent, dirty: ReadonlySet<string>): void {
    modal.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-inspection-control]').forEach(input => {
        if (!dirty.has(input.id) || input.value === '__mixed')
            return;
        const field = input.dataset.inspectionControl!, pinId = input.dataset.inspectionPin;
        const value = input.value.trim();
        if (pinId === undefined && componentFields.includes(field as any)) {
            if (value)
                (component as any)[field] = value;
            else
                delete (component as any)[field];
        }
        else if (pinId !== undefined && pinFields.includes(field as any)) {
            component.pins[pinId] ??= {};
            if (value || field === 'potentialConstraint')
                (component.pins[pinId] as any)[field] = value;
            else
                delete (component.pins[pinId] as any)[field];
        }
    });
}
export function applyInspectionFields(source: PlacedComponent, target: PlacedComponent, dirty: ReadonlySet<string>): void {
    for (const field of componentFields)
        if (dirty.has(controlId(field))) {
            if (source[field] === undefined)
                delete target[field];
            else
                (target as any)[field] = source[field];
        }
    for (const [pinId, state] of Object.entries(source.pins))
        for (const field of pinFields)
            if (dirty.has(controlId(field, pinId))) {
                target.pins[pinId] ??= {};
                if (state[field] === undefined)
                    delete target.pins[pinId][field];
                else
                    (target.pins[pinId] as any)[field] = state[field];
            }
}
