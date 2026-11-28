/** Protocol-specific planning rules. Source register: docs/automation-sources.md. */
export const busProtocols = [
  'PROFINET',
  'EtherCAT',
  'PROFIBUS DP',
  'IO-Link',
  'Modbus TCP',
  'Modbus RTU',
  'OPC UA',
  'BACnet/IP',
  'KNX TP',
  'KNX IP',
  'DALI',
  'Loxone Link',
  'Loxone Tree',
  'Loxone Air',
  'Other',
] as const;
export type BusProtocol = (typeof busProtocols)[number];
export const isKnx = (protocol: string) => protocol === 'KNX TP' || protocol === 'KNX IP';
export const isLoxone = (protocol: string) => protocol.startsWith('Loxone ');
export const isIpBus = (protocol: string) =>
  ['PROFINET', 'EtherCAT', 'Modbus TCP', 'OPC UA', 'BACnet/IP', 'KNX IP', 'Other'].includes(protocol);
export const sharedBusPort = (protocol: string) =>
  ['Modbus RTU', 'PROFIBUS DP', 'DALI', 'Other', 'KNX TP', 'Loxone Link', 'Loxone Tree', 'Loxone Air'].includes(
    protocol,
  );

export function defaultPortsForProtocol(protocol: string, role?: 'device' | 'interface'): string[] {
  switch (protocol) {
    case 'PROFINET':
      return ['X1P1', 'X1P2'];
    case 'EtherCAT':
      return ['IN', 'OUT'];
    case 'PROFIBUS DP':
    case 'Modbus RTU':
      return ['RS485'];
    case 'IO-Link':
      return role === 'interface' ? ['P1', 'P2', 'P3', 'P4'] : ['M12'];
    case 'DALI':
      return ['DA+/DA-'];
    case 'KNX TP':
      return ['BUS'];
    case 'KNX IP':
    case 'Modbus TCP':
    case 'OPC UA':
    case 'BACnet/IP':
      return ['ETH1', 'ETH2'];
    case 'Loxone Link':
      return ['Link'];
    case 'Loxone Tree':
      return ['Tree'];
    case 'Loxone Air':
      return ['Air'];
    default:
      return ['P1', 'P2'];
  }
}

export const KNX_COMMON_DPTS: readonly {code: string; label: string}[] = [
  {code: '1.001', label: 'Schalten (Switch)'},
  {code: '1.002', label: 'Boolesch'},
  {code: '1.008', label: 'Auf/Ab (Up/Down)'},
  {code: '1.010', label: 'Start/Stopp'},
  {code: '1.017', label: 'Trigger'},
  {code: '3.007', label: 'Dimmen relativ'},
  {code: '5.001', label: 'Prozentwert (0..100%)'},
  {code: '5.010', label: 'Zählerwert (0..255)'},
  {code: '9.001', label: 'Temperatur (°C)'},
  {code: '9.004', label: 'Helligkeit (Lux)'},
  {code: '9.005', label: 'Windgeschwindigkeit (m/s)'},
  {code: '9.007', label: 'Luftfeuchte (%)'},
  {code: '13.010', label: 'Wirkarbeit (Wh)'},
  {code: '14.056', label: 'Leistung (W)'},
  {code: '16.001', label: 'Text (ASCII)'},
  {code: '20.102', label: 'HLK-Betriebsart (HVAC)'},
];

export function knxIndividualAddress(value: string): string | undefined {
  const m = value.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return;
  const parts = m.slice(1).map(Number);
  if (parts[0] > 15 || parts[1] > 15 || parts[2] > 255) return;
  return parts.join('.');
}
/** Two and three level notation identify the same 16-bit group; zero is reserved. */
export function knxGroupAddress(value: string): number | undefined {
  const parts = value.trim().split('/');
  if (![2, 3].includes(parts.length) || parts.some((p) => !/^\d{1,4}$/.test(p))) return;
  const n = parts.map(Number);
  if (n[0] > 31 || (n.length === 3 ? n[1] > 7 || n[2] > 255 : n[1] > 2047)) return;
  const address = n[0] * 2048 + (n.length === 3 ? n[1] * 256 + n[2] : n[1]);
  return address > 0 ? address : undefined;
}
/** Syntax only, not a registry of manufacturer-supported datapoints. */
export function knxDpt(value: string): string | undefined {
  const m = value.trim().match(/^(?:DPT[- ]?)?(\d{1,5})\.(\d{3})$/i);
  return m && Number(m[1]) > 0 ? Number(m[1]) + '.' + m[2] : undefined;
}
export const busProtocolHelp = (protocol: string): string =>
  isKnx(protocol)
    ? 'KNX: Busadresse = individuelle Adresse (Bereich.Linie.Gerät). Gruppenadressen und Kommunikationsobjekte separat verwalten. IP-Adresse ist ein eigenes Feld.'
    : protocol === 'Loxone Link'
      ? 'Je Link-Schnittstelle einen Schnittstellen-Eintrag anlegen, Extensions diesem zuordnen. Max. 30 Extensions, Linie, max. 500 m Datenleitung; Abschluss am letzten Gerät dokumentieren.'
      : protocol === 'Loxone Tree'
        ? 'Je Tree-Zweig einen Schnittstellen-Eintrag anlegen. Max. 50 Geräte und 500 m Datenleitung pro Zweig. Zweige bleiben getrennt; Verzweigungen sind erlaubt.'
        : protocol === 'Loxone Air'
          ? 'Air: Funkzuordnung zur Schnittstelle, keine Kabelstrecke. Profil Air Base: 128 Geräte. Bei anderen Schnittstellen Kapazität laut Datenblatt erfassen; Funkreichweite wird nicht berechnet.'
          : protocol === 'PROFIBUS DP'
            ? 'PROFIBUS DP (RS-485): Stationsadresse 0–126 (127 ist Broadcast). Linienbus ohne geschlossene Ringe; aktiver Busabschluss (Terminierung) an beiden Leitungsenden beachten.'
            : protocol === 'IO-Link'
              ? 'IO-Link (IEC 61131-9): Punkt-zu-Punkt-Verbindung je Master-Port (keine Abzweige/Ringe, gemeinsame Ports nicht zulässig). Max. 20 m ungeschirmte Leitung pro Port.'
              : protocol === 'DALI'
                ? 'DALI (IEC 62386): Kurzadresse 0–63 je DALI-Steuergerät. Polaritätsfreie 2-Draht-Busleitung (Linie/Baum/Stern, kein geschlossener Ring), max. 300 m Gesamtleitungslänge je Netz.'
                : protocol === 'Modbus RTU'
                  ? 'Modbus RTU (RS-485): Slave-Adresse 1–247 (0 ist Broadcast). Linienbus ohne Ringe; 120-Ω-Abschlusswiderstände an beiden Busenden.'
                  : protocol === 'PROFINET'
                    ? 'PROFINET: Gerätename + IPv4-Adresse eindeutig im Netz. Punkt-zu-Punkt-Ports (X1P1/X1P2); Switch oder integrierte 2-Port-Teilnehmer für Linien/Ringe (MRP).'
                    : protocol === 'EtherCAT'
                      ? 'EtherCAT: Feste Portreihenfolge IN → OUT (keine doppelte Portbelegung). Topologie bestimmt logische Verarbeitungsreihenfolge.'
                      : protocol === 'Modbus TCP' || protocol === 'OPC UA' || protocol === 'BACnet/IP'
                        ? `${protocol}: Ethernet/IP-Kommunikation mit eindeutiger IPv4-Adresse je Netz und separaten Switch-Ports.`
                        : 'Dokumentierte Kommunikationstopologie. Ports und Netzzugehörigkeit prüfen; es wird keine Hardware konfiguriert.';
