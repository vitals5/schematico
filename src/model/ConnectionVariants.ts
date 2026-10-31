import type { SymbolDefinition, PinDefinition } from './types';
/** Independently constructed editor glyphs; no project master data is embedded. */
export const CONNECTION_VARIANTS: SymbolDefinition[] = [];
type Dir = PinDefinition['direction'];
const point = { top: [8,0], right: [16,8], bottom: [8,16], left: [0,8] } as const;
const label = { top:'oben', right:'rechts', bottom:'unten', left:'links' };
const line = (a: readonly number[], b: readonly number[], width = 1) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="currentColor" stroke-width="${width}"/>`;
const add = (id: string, name: string, dirs: Dir[], svg: string, description = name) => CONNECTION_VARIANTS.push({
    id, name, description, category:'connections', standard:'', defaultBmkPrefix:'', defaultFunctionText:'', width:16, height:16,
    pins:dirs.map((d,i)=>({id:String(i+1), name:String(i+1), x:point[d][0], y:point[d][1], direction:d})), svgContent:svg,
});
for (const side of ['top','right','bottom','left'] as const) {
    const through: Dir[] = side === 'top' || side === 'bottom' ? ['left','right'] : ['top','bottom'];
    for (const target of through) {
        const end = point[target], arm = point[side];
        const bend = [(8+end[0])/2,(8+end[1])/2];
        add(`t_piece_directed_${side}_${target}`, `T-Stück ${label[side]} – Abzweig nach ${label[target]}`,
            [...through,side], line(point[through[0]],point[through[1]]) + line(arm,bend));
    }
    const dirs = [...through,side];
    add(`t_piece_bus_${side}`, `T-Stück ${label[side]} – Sammelschienenabgang`, dirs,
        line(point[through[0]],point[through[1]],3)+line([8,8],point[side]));
    add(`potential_arrow_open_${side === 'top' ? 'up' : side === 'bottom' ? 'down' : side}`,
        `Abbruchstelle ${label[side]} – offene Pfeilspitze`, [({top:'bottom',bottom:'top',left:'right',right:'left'} as const)[side],side],
        line(point[({top:'bottom',bottom:'top',left:'right',right:'left'} as const)[side]],[8,8])+
        (side==='top'||side==='bottom' ? line([4,8],point[side])+line(point[side],[12,8]) : line([8,4],point[side])+line(point[side],[8,12])));
    add(`connection_point_${side}`, `Anschlusspunkt – Anschluss ${label[side]}`, [side],
        line(point[side],[8,8])+'<circle cx="8" cy="8" r="2" fill="none" stroke="currentColor"/>');
}
for (const horizontal of ['left','right'] as const) for (const vertical of ['top','bottom'] as const) for (const bus of [horizontal,vertical]) {
    add(`corner_bus_${horizontal}_${vertical}_${bus}`, `Winkel ${label[horizontal]} / ${label[vertical]} – Sammelschiene ${label[bus]}`,
        [horizontal,vertical],line(point[horizontal],[8,8],bus===horizontal?3:1)+line([8,8],point[vertical],bus===vertical?3:1));
}
// Same 8-unit port pitch as directed T-pieces and the three socket contacts.
for (const horizontal of ['left','right'] as const) for (const vertical of ['top','bottom'] as const) {
    add(`corner_compact_${horizontal}_${vertical}`, `Winkel ${label[horizontal]} / ${label[vertical]} – kompaktes Raster`,
        [horizontal,vertical],line(point[horizontal],[8,8])+line([8,8],point[vertical]));
}
for (const side of ['top','right','bottom','left'] as const) {
    const opposite = ({top:'bottom',bottom:'top',left:'right',right:'left'} as const)[side];
    add(`cross_junction_bus_${side}`, `Kreuzverteiler – Sammelschienenabgang ${label[side]}`, ['top','bottom','left','right'],
        line(point.top,point.bottom,side==='top'||side==='bottom'?1:3)+line(point.left,point.right,side==='left'||side==='right'?1:3)+line([8,8],point[opposite],3)+
        '<circle cx="8" cy="8" r="1.5" fill="currentColor"/>', 'Vier elektrisch verbundene Anschlüsse; hervorgehobene Sammelschiene und dünner Abgang '+label[side]+'.');
}
