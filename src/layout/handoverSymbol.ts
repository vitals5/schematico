import type { Page, Project, Wire } from '../model/types';
import { getSymbolForComponent } from '../model/symbols';
import { AutoconnectEngine } from '../model/AutoconnectEngine';

/** Select only the newly added handover symbol. Original devices/pins/rotations
 * remain untouched; wire storage order is not an electrical flow direction. */
export function handoverSymbol(project: Project, page: Page, endpoint: Wire['from'], fallback: 'right' | 'left'): string {
    const c = page.components.find(c => c.id === endpoint.componentId);
    const symbol = c && getSymbolForComponent(c, project);
    const pin = symbol?.pins.find(p => p.id === endpoint.pinId);
    if (!c || !symbol || !pin) return 'potential_arrow_' + fallback;
    const direction = AutoconnectEngine.getRotatedPinInfo(c, pin, symbol).direction;
    return 'potential_arrow_' + ({ top: 'up', bottom: 'down', left: 'left', right: 'right' } as const)[direction];
}
