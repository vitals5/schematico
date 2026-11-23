import type { Page, PlacedComponent, Project } from './types';
import type { ComponentAddress } from './ArticleTypes';
import { componentRole } from './ComponentSemantics';
import { getSymbolForComponent } from './symbols';
import { terminalIdentity, terminalStripKey, terminalAddressKey, terminalStripBindings, type TerminalStripIdentity } from './TerminalStripTypes';

export type TerminalRecognitionReason = 'missing_strip' | 'missing_number' | 'conflicting_number' | 'duplicate_number' | 'ambiguous_identity' | 'existing_ownership';
export interface TerminalRecognitionIssue {
  reason: TerminalRecognitionReason;
  addresses: ComponentAddress[];
  strip: string;
  number: string;
}
export interface TerminalStructurePreview {
  recognised: number;
  converted: number;
  createdStrips: number;
  extendedStrips: number;
  alreadyConfigured: number;
  issues: TerminalRecognitionIssue[];
  rows: { identity: TerminalStripIdentity; placements: number; created: boolean }[];
}
interface Record {
  page: Page;
  component: PlacedComponent;
  address: ComponentAddress;
  identity: TerminalStripIdentity;
  number: string;
  protected: boolean;
  reason?: TerminalRecognitionReason;
}

/** Convert evidenced identities only. A mounting position represents one
 * placement; matching tags never prove shared housings, levels or bridges.
 * Imported symbol masters, printed labels and all electrical endpoints stay intact. */
export function structureImportedTerminals(source: Project) {
  const project = structuredClone(source);
  const preview: TerminalStructurePreview = { recognised: 0, converted: 0, createdStrips: 0,
    extendedStrips: 0, alreadyConfigured: 0, issues: [], rows: [] };
  const bindings = terminalStripBindings(project);
  const configured = new Set<string>(), owned = new Set<string>();
  for (const strip of project.terminalStrips ?? []) for (const pos of strip.positions)
    if (pos.kind === 'terminal') for (const a of pos.members) configured.add(terminalAddressKey(a));
  for (const device of project.physicalDevices ?? []) for (const a of device.members) owned.add(terminalAddressKey(a));
  const pageIds = new Map<string, number>(), componentIds = new Map<string, number>();
  for (const page of project.pages) {
    pageIds.set(page.id, (pageIds.get(page.id) ?? 0) + 1);
    for (const c of page.components) componentIds.set(c.id, (componentIds.get(c.id) ?? 0) + 1);
  }
  const records: Record[] = [], numbered = new Map<string, Record[]>();
  for (const page of project.pages) for (const component of page.components) {
    const symbol = getSymbolForComponent(component, project);
    if (componentRole(component, symbol) !== 'terminal') continue;
    preview.recognised++;
    const address = { pageId: page.id, componentId: component.id }, key = terminalAddressKey(address);
    const identity = terminalIdentity(page, component), colon = component.bmk.indexOf(':');
    const designation = colon > 0 ? component.bmk.slice(colon + 1).trim() : '';
    // The source terminal designation was retained as deviceTag by older imports.
    // Do not mine function text, pin labels, positions or arbitrary device descriptions.
    const nativeNumber = component.source?.format === 'NATIVE_CAD' && symbol?.source?.library === 'IEC_symbol'
      && [30, 1117].includes(symbol.source.number) && symbol.pins.length === 2
      && /^[\p{L}\p{N}_.+\-]{1,64}$/u.test(component.deviceTag?.trim() ?? '')
      ? component.deviceTag!.trim() : '';
    const number = component.terminal ? component.terminal.number.trim() : designation || nativeNumber;
    const record: Record = { page, component, address, identity, number, protected: configured.has(key) };
    if (record.protected) preview.alreadyConfigured++;
    if (pageIds.get(page.id) !== 1 || componentIds.get(component.id) !== 1 || !symbol || symbol.unresolved)
      record.reason = 'ambiguous_identity';
    else if (!identity.strip || !component.terminal && !/^-?X[\p{L}\p{N}_.-]*$/u.test(identity.strip)) record.reason = 'missing_strip';
    else if (!number) record.reason = 'missing_number';
    else if (!component.terminal && designation && nativeNumber && designation !== nativeNumber) record.reason = 'conflicting_number';
    else if (!record.protected && (owned.has(key) || (project.terminalStrips ?? []).some(s =>
      terminalStripKey(s) === terminalStripKey(identity) && bindings.issues.some(i => i.stripId === s.id)))) record.reason = 'existing_ownership';
    records.push(record);
    if (number && identity.strip) {
      const numberKey = JSON.stringify([terminalStripKey(identity), number, component.terminal?.level ?? '']);
      numbered.set(numberKey, [...numbered.get(numberKey) ?? [], record]);
    }
  }
  for (const same of numbered.values()) if (same.length > 1 && same.some(r => !r.protected)) {
    for (const r of same) if (!r.protected && !r.reason) r.reason = 'duplicate_number';
  }
  const candidates = new Map<string, Record[]>();
  for (const r of records) {
    if (r.protected) continue;
    if (r.reason) {
      preview.issues.push({ reason: r.reason, addresses: [r.address], strip: r.identity.strip, number: r.number });
      continue;
    }
    const key = terminalStripKey(r.identity);
    candidates.set(key, [...candidates.get(key) ?? [], r]);
  }
  const pageOrder = new Map(project.pages.map((p, i) => [p.id, i]));
  for (const members of candidates.values()) {
    members.sort((a, b) => pageOrder.get(a.page.id)! - pageOrder.get(b.page.id)! ||
      a.component.y - b.component.y || a.component.x - b.component.x || a.component.id.localeCompare(b.component.id));
    const identity = members[0].identity;
    let strip = project.terminalStrips?.find(s => terminalStripKey(s) === terminalStripKey(identity));
    const created = !strip;
    if (!strip) {
      strip = { ...identity, id: crypto.randomUUID(), positions: [] };
      (project.terminalStrips ??= []).push(strip);
      preview.createdStrips++;
    } else preview.extendedStrips++;
    for (const r of members) {
      r.component.terminal ??= { strip: identity.strip, number: r.number, level: '', sortingKey: r.number, pinSides: {} };
      strip.positions.push({ id: crypto.randomUUID(), kind: 'terminal', members: [r.address] });
      preview.converted++;
    }
    preview.rows.push({ identity, placements: members.length, created });
  }
  // A bad pre-existing configuration is left for review; conversion must never
  // introduce a new invalid binding or infer physical article ownership.
  const previous = new Set(bindings.issues.map(i => JSON.stringify([i.stripId, i.positionId, i.reason])));
  if (terminalStripBindings(project).issues.some(i => !previous.has(JSON.stringify([i.stripId, i.positionId, i.reason]))))
    throw new Error('terminalStripPositionInvalid');
  return { project, preview };
}
