/** Protocol-specific planning rules. Source register: docs/automation-sources.md. */
export const busProtocols = ['PROFINET', 'EtherCAT', 'Modbus TCP', 'Modbus RTU', 'KNX TP', 'KNX IP', 'Loxone Link', 'Loxone Tree', 'Loxone Air', 'Other'] as const;
export type BusProtocol = typeof busProtocols[number];
export const isKnx = (protocol: string) => protocol === 'KNX TP' || protocol === 'KNX IP';
export const isLoxone = (protocol: string) => protocol.startsWith('Loxone ');
export const sharedBusPort = (protocol: string) => ['Modbus RTU', 'Other', 'KNX TP', 'Loxone Link', 'Loxone Tree', 'Loxone Air'].includes(protocol);
export function knxIndividualAddress(value: string): string | undefined {
 const m = value.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
 if (!m) return; const parts = m.slice(1).map(Number);
 if (parts[0] > 15 || parts[1] > 15 || parts[2] > 255) return;
 return parts.join('.');
}
/** Two and three level notation identify the same 16-bit group; zero is reserved. */
export function knxGroupAddress(value: string): number | undefined {
 const parts = value.trim().split('/'); if (![2,3].includes(parts.length) || parts.some(p => !/^\d{1,4}$/.test(p))) return;
 const n = parts.map(Number); if (n[0] > 31 || (n.length === 3 ? n[1] > 7 || n[2] > 255 : n[1] > 2047)) return;
 const address = n[0] * 2048 + (n.length === 3 ? n[1] * 256 + n[2] : n[1]);
 return address > 0 ? address : undefined;
}
/** Syntax only, not a registry of manufacturer-supported datapoints. */
export function knxDpt(value: string): string | undefined {
 const m = value.trim().match(/^(?:DPT[- ]?)?(\d{1,5})\.(\d{3})$/i);
 return m && Number(m[1]) > 0 ? Number(m[1]) + '.' + m[2] : undefined;
}
export const busProtocolHelp = (protocol: string): string => isKnx(protocol)
 ? 'KNX: Busadresse = individuelle Adresse (Bereich.Linie.Gerät). Gruppenadressen und Kommunikationsobjekte separat verwalten. IP-Adresse ist ein eigenes Feld.'
 : protocol === 'Loxone Link' ? 'Je Link-Schnittstelle einen Schnittstellen-Eintrag anlegen, Extensions diesem zuordnen. Max. 30 Extensions, Linie, max. 500 m Datenleitung; Abschluss am letzten Gerät dokumentieren.'
 : protocol === 'Loxone Tree' ? 'Je Tree-Zweig einen Schnittstellen-Eintrag anlegen. Max. 50 Geräte und 500 m Datenleitung pro Zweig. Zweige bleiben getrennt; Verzweigungen sind erlaubt.'
 : protocol === 'Loxone Air' ? 'Air: Funkzuordnung zur Schnittstelle, keine Kabelstrecke. Profil Air Base: 128 Geräte. Bei anderen Schnittstellen Kapazität laut Datenblatt erfassen; Funkreichweite wird nicht berechnet.'
 : 'Dokumentierte Kommunikationstopologie. Ports und Netzzugehörigkeit prüfen; es wird keine Hardware konfiguriert.';
