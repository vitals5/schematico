import type { SymbolDefinition } from './types';
const registered = new Map<string, { type: string; pins: string }>();
const aliases: Record<string, string> = {
  contactor_coil: 'relay_coil',
  contact_no: 'contact_no',
  contact_nc: 'contact_nc',
  contactor_power_3p: 'power_contact_3p',
};
const signature = (s: SymbolDefinition) =>
  JSON.stringify(s.pins.map((p) => [p.id, p.name]).sort());
export function registerFunctionDefinition(s: SymbolDefinition) {
  s.functionDefinition ??= aliases[s.id] ?? 'symbol:' + s.id;
  registered.set(s.id, { type: s.functionDefinition, pins: signature(s) });
}
export function functionType(s: SymbolDefinition) {
  if (s.functionDefinition !== undefined)
    return s.functionDefinition.trim() || undefined;
  const standard = !s.source && registered.get(s.id);
  return standard && standard.pins === signature(s) ? standard.type : undefined;
}
export const knownFunctionTypes = () =>
  [...new Set([...registered.values()].map((v) => v.type))].sort();
