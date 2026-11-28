import type {Project} from '../../model/types';
import {
  automationData,
  editAutomation,
  type BusNode,
  type KnxGroup,
  type KnxObject,
} from '../../model/Automation';
import {isIpBus, isKnx, isLoxone, knxGroupAddress, type BusProtocol} from '../../model/BusProfiles';
import {tr} from '../../i18n';

export interface BusDevicePreset {
  id: string;
  category: 'industrial_eth' | 'fieldbus_serial' | 'building_bus' | 'loxone';
  name: string;
  description: string;
  protocol: BusProtocol;
  defaultNetwork: string;
  interfaceRole: 'device' | 'interface';
  interfaceProfile?: 'generic' | 'air-base';
  nodePrefix: string;
}

export const BUS_DEVICE_PRESETS: BusDevicePreset[] = [
  // PROFINET / Industrial Ethernet
  {
    id: 'pn_switch',
    category: 'industrial_eth',
    name: tr('Industrial Ethernet Switch (Managed)', 'Industrial Ethernet Switch (Managed)'),
    description: tr('8-Port Managed PROFINET Switch (Scalance / FL Switch)', '8-port managed PROFINET switch'),
    protocol: 'PROFINET',
    defaultNetwork: 'PROFINET-1',
    interfaceRole: 'device',
    nodePrefix: 'Switch-PN',
  },
  {
    id: 'pn_et200sp',
    category: 'industrial_eth',
    name: tr('ET 200SP IO-Device (IM 155-6 PN)', 'ET 200SP IO-Device (IM 155-6 PN)'),
    description: tr('Dezentrale E/A-Station PROFINET', 'Decentralized PROFINET I/O station'),
    protocol: 'PROFINET',
    defaultNetwork: 'PROFINET-1',
    interfaceRole: 'device',
    nodePrefix: 'ET200SP',
  },
  {
    id: 'pn_drive',
    category: 'industrial_eth',
    name: tr('Frequenzumrichter (PROFINET)', 'Variable Frequency Drive (PROFINET)'),
    description: tr('Antriebsregler mit PROFINET-Schnittstelle', 'Drive inverter with PROFINET interface'),
    protocol: 'PROFINET',
    defaultNetwork: 'PROFINET-1',
    interfaceRole: 'device',
    nodePrefix: 'VFD-PN',
  },
  {
    id: 'pn_hmi',
    category: 'industrial_eth',
    name: tr('HMI Bedienpanel (PROFINET)', 'HMI Operator Panel (PROFINET)'),
    description: tr('Touch-Panel 7"/10" am Anlagennetz', 'Touch panel 7"/10" on automation network'),
    protocol: 'PROFINET',
    defaultNetwork: 'PROFINET-1',
    interfaceRole: 'device',
    nodePrefix: 'HMI',
  },
  {
    id: 'ecat_ek1100',
    category: 'industrial_eth',
    name: tr('EtherCAT Koppler EK1100', 'EtherCAT Coupler EK1100'),
    description: tr('EtherCAT E/A-Koppler (IN / OUT)', 'EtherCAT I/O coupler (IN / OUT)'),
    protocol: 'EtherCAT',
    defaultNetwork: 'EtherCAT-1',
    interfaceRole: 'device',
    nodePrefix: 'EK1100',
  },
  {
    id: 'ecat_servo',
    category: 'industrial_eth',
    name: tr('Servo-Antriebsregler (EtherCAT)', 'Servo Drive (EtherCAT)'),
    description: tr('Synchron-Servoverstärker am EtherCAT-Bus', 'Synchronous servo drive on EtherCAT'),
    protocol: 'EtherCAT',
    defaultNetwork: 'EtherCAT-1',
    interfaceRole: 'device',
    nodePrefix: 'AX-Servo',
  },
  {
    id: 'mbtcp_meter',
    category: 'industrial_eth',
    name: tr('Energiezähler / Wechselrichter (Modbus TCP)', 'Power Meter / Inverter (Modbus TCP)'),
    description: tr('Netzmessgerät oder PV-Wechselrichter über TCP/IP', 'Grid meter or PV inverter via TCP/IP'),
    protocol: 'Modbus TCP',
    defaultNetwork: 'Modbus-TCP',
    interfaceRole: 'device',
    nodePrefix: 'Meter-TCP',
  },
  {
    id: 'opcua_server',
    category: 'industrial_eth',
    name: tr('OPC UA Server / Leittechnik', 'OPC UA Server / SCADA'),
    description: tr('Übergeordnete SCADA-/MES-Anbindung über OPC UA', 'Higher-level SCADA / MES connection via OPC UA'),
    protocol: 'OPC UA',
    defaultNetwork: 'Leittechnik-ETH',
    interfaceRole: 'device',
    nodePrefix: 'OPC-Server',
  },
  // Feldbusse seriell / Sensorik
  {
    id: 'pbdp_slave',
    category: 'fieldbus_serial',
    name: tr('PROFIBUS DP Feldstation (Adr. 0–126)', 'PROFIBUS DP Field Station (Addr 0–126)'),
    description: tr('RS-485 DP-Slave mit 9-pol. Sub-D / Terminierung', 'RS-485 DP slave with bus termination'),
    protocol: 'PROFIBUS DP',
    defaultNetwork: 'PROFIBUS-1',
    interfaceRole: 'device',
    nodePrefix: 'DP-Slave',
  },
  {
    id: 'iolink_master',
    category: 'fieldbus_serial',
    name: tr('IO-Link Master 4-Port', 'IO-Link Master 4-Port'),
    description: tr('Feld-Master nach IEC 61131-9 (P1–P4 Punkt-zu-Punkt)', 'Field master per IEC 61131-9 (P1–P4 point-to-point)'),
    protocol: 'IO-Link',
    defaultNetwork: 'IO-Link-1',
    interfaceRole: 'interface',
    nodePrefix: 'IOL-Master',
  },
  {
    id: 'iolink_sensor',
    category: 'fieldbus_serial',
    name: tr('IO-Link Sensor / Ventilinsel (max. 20 m)', 'IO-Link Sensor / Valve Terminal (max 20 m)'),
    description: tr('Intelligenter Sensor oder Aktor über M12 (max. 20 m)', 'Smart sensor or valve island via M12 (max 20 m)'),
    protocol: 'IO-Link',
    defaultNetwork: 'IO-Link-1',
    interfaceRole: 'device',
    nodePrefix: 'IOL-Device',
  },
  {
    id: 'mbrtu_meter',
    category: 'fieldbus_serial',
    name: tr('Modbus RTU Energiezähler / Fühler (1–247)', 'Modbus RTU Power Meter / Sensor (1–247)'),
    description: tr('RS-485 Teilnehmer (A/B) mit eindeutiger Slave-ID', 'RS-485 node (A/B) with unique slave ID'),
    protocol: 'Modbus RTU',
    defaultNetwork: 'Modbus-RS485',
    interfaceRole: 'device',
    nodePrefix: 'RTU-Slave',
  },
  // Gebäudeautomation
  {
    id: 'dali_gateway',
    category: 'building_bus',
    name: tr('DALI-2 Lichtsteuerung / EVG (0–63)', 'DALI-2 Lighting Controller / Ballast (0–63)'),
    description: tr('DALI Steuergerät/Treiber nach IEC 62386 (max. 300 m)', 'DALI control gear per IEC 62386 (max 300 m)'),
    protocol: 'DALI',
    defaultNetwork: 'DALI-Linie-1',
    interfaceRole: 'device',
    nodePrefix: 'DALI-EVG',
  },
  {
    id: 'bacnet_ddc',
    category: 'building_bus',
    name: tr('BACnet/IP RLT- / HLK-Controller', 'BACnet/IP HVAC / AHU Controller'),
    description: tr('Gebäudeautomations-Unterstation nach ISO 16484-5', 'Building automation outstation per ISO 16484-5'),
    protocol: 'BACnet/IP',
    defaultNetwork: 'BACnet-GLZ',
    interfaceRole: 'device',
    nodePrefix: 'DDC-BACnet',
  },
  {
    id: 'knx_tp_device',
    category: 'building_bus',
    name: tr('KNX TP Feldgerät', 'KNX TP Field Device'),
    description: tr('KNX Twisted-Pair Teilnehmer (Bereich.Linie.Gerät)', 'KNX TP participant (Area.Line.Device)'),
    protocol: 'KNX TP',
    defaultNetwork: 'KNX',
    interfaceRole: 'device',
    nodePrefix: 'KNX-Teilnehmer',
  },
  // Loxone
  {
    id: 'lox_link_ext',
    category: 'loxone',
    name: tr('Loxone Extension (Relay / Dimmer / DI)', 'Loxone Extension (Relay / Dimmer / DI)'),
    description: tr('Erweiterungsmodul auf Loxone Link (Linie, max. 30)', 'Expansion module on Loxone Link (line, max 30)'),
    protocol: 'Loxone Link',
    defaultNetwork: 'Loxone Gebäude',
    interfaceRole: 'device',
    nodePrefix: 'Relay-Ext',
  },
  {
    id: 'lox_tree_dev',
    category: 'loxone',
    name: tr('Loxone Tree Gerät (Touch / Präsenz / Beschattung)', 'Loxone Tree Device (Touch / Presence / Shading)'),
    description: tr('Tree-Teilnehmer (max. 50 je Zweig / 500 m)', 'Tree device (max 50 per branch / 500 m)'),
    protocol: 'Loxone Tree',
    defaultNetwork: 'Loxone Gebäude',
    interfaceRole: 'device',
    nodePrefix: 'Tree-Gerät',
  },
  {
    id: 'lox_air_base',
    category: 'loxone',
    name: tr('Loxone Air Base Extension (128 Funkgeräte)', 'Loxone Air Base Extension (128 wireless)'),
    description: tr('Funk-Gateway Schnittstelle (Air Base Profil)', 'Wireless gateway interface (Air Base profile)'),
    protocol: 'Loxone Air',
    defaultNetwork: 'Loxone Gebäude',
    interfaceRole: 'interface',
    interfaceProfile: 'air-base',
    nodePrefix: 'Air-Base',
  },
  {
    id: 'lox_air_dev',
    category: 'loxone',
    name: tr('Loxone Air Funkteilnehmer', 'Loxone Air Wireless Device'),
    description: tr('Batterie-/230V-Funkteilnehmer mit Schnittstellenzuordnung', 'Wireless actuator/sensor paired with Air gateway'),
    protocol: 'Loxone Air',
    defaultNetwork: 'Loxone Gebäude',
    interfaceRole: 'device',
    nodePrefix: 'Air-Gerät',
  },
];

function uniqueBusName(nodes: BusNode[], network: string, prefix: string): {name: string; index: number} {
  const sameNet = nodes.filter((n) => n.network === network);
  let i = 1;
  while (sameNet.some((n) => n.name === `${prefix}-${i}`)) i++;
  return {name: `${prefix}-${i}`, index: i};
}

function allocateNodeAddress(
  nodes: BusNode[],
  network: string,
  protocol: BusProtocol,
): {address: string; ipAddress?: string} {
  const sameNet = nodes.filter(
    (n) => n.network === network && (n.protocol === protocol || (isKnx(n.protocol) && isKnx(protocol))),
  );

  if (isKnx(protocol)) {
    let dev = 1;
    while (sameNet.some((n) => n.address === `1.1.${dev}`)) dev++;
    const address = `1.1.${Math.min(255, dev)}`;
    if (protocol === 'KNX IP') {
      let host = 20;
      while (sameNet.some((n) => n.ipAddress === `192.168.1.${host}`)) host++;
      return {address, ipAddress: `192.168.1.${Math.min(254, host)}`};
    }
    return {address};
  }

  if (protocol === 'Modbus RTU') {
    let addr = 1;
    while (sameNet.some((n) => Number(n.address) === addr)) addr++;
    return {address: String(Math.min(247, addr))};
  }

  if (protocol === 'PROFIBUS DP') {
    let addr = 2;
    while (sameNet.some((n) => Number(n.address) === addr)) addr++;
    return {address: String(Math.min(126, addr))};
  }

  if (protocol === 'DALI') {
    let addr = 0;
    while (sameNet.some((n) => Number(n.address) === addr)) addr++;
    return {address: String(Math.min(63, addr))};
  }

  if (isLoxone(protocol)) {
    return {address: ''};
  }

  if (isIpBus(protocol)) {
    let host = 10;
    while (sameNet.some((n) => n.ipAddress === `192.168.1.${host}` || n.address === `192.168.1.${host}`)) host++;
    const ip = `192.168.1.${Math.min(254, host)}`;
    return {address: ip, ipAddress: ip};
  }

  let idx = 1;
  while (sameNet.some((n) => n.address === String(idx))) idx++;
  return {address: String(idx)};
}

/**
 * Instantiates a real-world bus device preset with valid addresses, IPv4s,
 * and automatic Loxone interface creation when needed.
 */
export function instantiateBusDevicePreset(
  project: Project,
  preset: BusDevicePreset,
  activeNetworkKey?: string,
): {next: Project; node: BusNode; createdInterface?: BusNode} {
  let network = preset.defaultNetwork;
  if (activeNetworkKey) {
    try {
      const parsed = JSON.parse(activeNetworkKey);
      if (parsed[0] === preset.protocol && parsed[1]) {
        network = String(parsed[1]);
      } else {
        const existingSameProto = automationData(project).nodes.find((n) => n.protocol === preset.protocol);
        if (existingSameProto) network = existingSameProto.network;
      }
    } catch {}
  } else {
    const existingSameProto = automationData(project).nodes.find((n) => n.protocol === preset.protocol);
    if (existingSameProto) network = existingSameProto.network;
  }

  let next = project;
  let createdInterface: BusNode | undefined;
  let interfaceId: string | undefined;

  if (isLoxone(preset.protocol) && preset.interfaceRole === 'device') {
    const d = automationData(next);
    const defaultLimit = preset.protocol === 'Loxone Link' ? 30 : preset.protocol === 'Loxone Tree' ? 50 : 128;
    let targetIface = d.nodes.find((n) => {
      if (n.protocol !== preset.protocol || n.network !== network || n.interfaceRole !== 'interface') return false;
      const limit = n.capacity ?? defaultLimit;
      const used = d.nodes.filter((v) => v.interfaceId === n.id).length;
      return used < limit;
    });

    if (!targetIface) {
      const ifacePrefix =
        preset.protocol === 'Loxone Link'
          ? 'Link-Schnittstelle'
          : preset.protocol === 'Loxone Tree'
            ? 'Tree-Zweig'
            : 'Air-Base';
      const {name: ifaceName} = uniqueBusName(d.nodes, network, ifacePrefix);
      createdInterface = {
        id: crypto.randomUUID(),
        name: ifaceName,
        network,
        protocol: preset.protocol,
        address: '',
        interfaceRole: 'interface',
        ...(preset.protocol === 'Loxone Air' ? {interfaceProfile: 'air-base' as const} : {}),
      };
      next = editAutomation(next, {kind: 'save', entity: 'nodes', value: createdInterface});
      targetIface = createdInterface;
    }
    interfaceId = targetIface.id;
  }

  const dNow = automationData(next);
  const {name} = uniqueBusName(dNow.nodes, network, preset.nodePrefix);
  const {address, ipAddress} = allocateNodeAddress(dNow.nodes, network, preset.protocol);

  const node: BusNode = {
    id: crypto.randomUUID(),
    name,
    network,
    protocol: preset.protocol,
    address,
    ...(ipAddress ? {ipAddress} : {}),
    ...(isLoxone(preset.protocol)
      ? {
          interfaceRole: preset.interfaceRole,
          ...(preset.interfaceProfile ? {interfaceProfile: preset.interfaceProfile} : {}),
          ...(interfaceId ? {interfaceId} : {}),
        }
      : {}),
  };

  next = editAutomation(next, {kind: 'save', entity: 'nodes', value: node});
  return {next, node, ...(createdInterface ? {createdInterface} : {})};
}

export interface KnxObjectTemplate {
  number: string;
  name: string;
  dpt: string;
  direction: 'send' | 'receive' | 'both';
}

export interface KnxDevicePreset {
  id: string;
  name: string;
  description: string;
  protocol: 'KNX TP' | 'KNX IP';
  prefix: string;
  isRouterOrCoupler?: boolean;
  objects: KnxObjectTemplate[];
}

export const KNX_DEVICE_PRESETS: KnxDevicePreset[] = [
  {
    id: 'knx_switch_8',
    name: tr('KNX Schaltaktor 8-fach', 'KNX Switch Actuator 8-gang'),
    description: tr('8 Relaisausgänge 16A für Beleuchtung / Steckdosen', '8 relay outputs 16A for lighting / sockets'),
    protocol: 'KNX TP',
    prefix: 'Schaltaktor-8x',
    objects: [
      {number: '0', name: 'Kanal A Schalten', dpt: '1.001', direction: 'receive'},
      {number: '1', name: 'Kanal A Status', dpt: '1.001', direction: 'send'},
      {number: '2', name: 'Kanal B Schalten', dpt: '1.001', direction: 'receive'},
      {number: '3', name: 'Kanal B Status', dpt: '1.001', direction: 'send'},
    ],
  },
  {
    id: 'knx_dim_4',
    name: tr('KNX Dimmaktor 4-fach', 'KNX Dimming Actuator 4-gang'),
    description: tr('Universal-LED-Dimmaktor 4× 250W', 'Universal LED dimming actuator 4× 250W'),
    protocol: 'KNX TP',
    prefix: 'Dimmaktor-4x',
    objects: [
      {number: '0', name: 'Kanal A Schalten', dpt: '1.001', direction: 'receive'},
      {number: '1', name: 'Kanal A Dimmen relativ', dpt: '3.007', direction: 'receive'},
      {number: '2', name: 'Kanal A Dimmwert absolut', dpt: '5.001', direction: 'receive'},
      {number: '3', name: 'Kanal A Status Dimmwert', dpt: '5.001', direction: 'send'},
    ],
  },
  {
    id: 'knx_blind_4',
    name: tr('KNX Jalousieaktor 4-fach', 'KNX Blind/Shutter Actuator 4-gang'),
    description: tr('Antriebsaktor 230V AC für Rollläden / Raffstores', 'Motor actuator 230V AC for blinds / shutters'),
    protocol: 'KNX TP',
    prefix: 'Jalousieaktor-4x',
    objects: [
      {number: '0', name: 'Kanal A Auf/Ab', dpt: '1.008', direction: 'receive'},
      {number: '1', name: 'Kanal A Stopp/Lamelle', dpt: '1.010', direction: 'receive'},
      {number: '2', name: 'Kanal A Position Behang', dpt: '5.001', direction: 'receive'},
      {number: '3', name: 'Kanal A Status Position', dpt: '5.001', direction: 'send'},
    ],
  },
  {
    id: 'knx_push_4',
    name: tr('KNX Tastsensor 4-fach', 'KNX Pushbutton Sensor 4-gang'),
    description: tr('Wand-Bedienelement mit Status-LEDs & Temperaturfühler', 'Wall switch with status LEDs & temperature sensor'),
    protocol: 'KNX TP',
    prefix: 'Tastsensor-4x',
    objects: [
      {number: '0', name: 'Wippe 1 Schalten', dpt: '1.001', direction: 'send'},
      {number: '1', name: 'Wippe 2 Dimmen rel.', dpt: '3.007', direction: 'send'},
      {number: '2', name: 'Wippe 3 Jalousie Auf/Ab', dpt: '1.008', direction: 'send'},
      {number: '3', name: 'LED 1 Statusanzeige', dpt: '1.001', direction: 'receive'},
    ],
  },
  {
    id: 'knx_presence',
    name: tr('KNX Präsenzmelder 360°', 'KNX Presence Detector 360°'),
    description: tr('Deckeneinbau-Melder mit Lichtregelung & HLK-Ausgang', 'Ceiling detector with light control & HVAC output'),
    protocol: 'KNX TP',
    prefix: 'Praesenzmelder',
    objects: [
      {number: '0', name: 'Präsenz Beleuchtung', dpt: '1.001', direction: 'send'},
      {number: '1', name: 'Helligkeitsmesswert (Lux)', dpt: '9.004', direction: 'send'},
      {number: '2', name: 'Präsenz HLK', dpt: '1.001', direction: 'send'},
    ],
  },
  {
    id: 'knx_rtr',
    name: tr('KNX Raumtemperaturregler (RTR)', 'KNX Room Temperature Controller'),
    description: tr('PI-Regler für Fußbodenheizung / Gebläsekonvektor', 'PI controller for floor heating / fan coil'),
    protocol: 'KNX TP',
    prefix: 'RTR',
    objects: [
      {number: '0', name: 'Ist-Temperatur', dpt: '9.001', direction: 'send'},
      {number: '1', name: 'Sollwert Basis', dpt: '9.001', direction: 'both'},
      {number: '2', name: 'Stellgröße Heizen', dpt: '5.001', direction: 'send'},
      {number: '3', name: 'Betriebsartvorwahl', dpt: '20.102', direction: 'both'},
    ],
  },
  {
    id: 'knx_weather',
    name: tr('KNX Wetterstation', 'KNX Weather Station'),
    description: tr('Erfassung von Außentemperatur, Wind, Regen & Helligkeit', 'Outdoor temperature, wind, rain & brightness'),
    protocol: 'KNX TP',
    prefix: 'Wetterstation',
    objects: [
      {number: '0', name: 'Außentemperatur', dpt: '9.001', direction: 'send'},
      {number: '1', name: 'Windgeschwindigkeit', dpt: '9.005', direction: 'send'},
      {number: '2', name: 'Windalarm', dpt: '1.001', direction: 'send'},
      {number: '3', name: 'Helligkeit Süd', dpt: '9.004', direction: 'send'},
    ],
  },
  {
    id: 'knx_psu',
    name: tr('KNX Spannungsversorgung 640 mA', 'KNX Power Supply 640 mA'),
    description: tr('Busspannungsversorgung mit integrierter Drossel', 'Bus power supply with integrated choke'),
    protocol: 'KNX TP',
    prefix: 'KNX-Versorgung-640mA',
    objects: [],
  },
  {
    id: 'knx_ip_router',
    name: tr('KNX IP-Router / Schnittstelle', 'KNX IP Router / Interface'),
    description: tr('Linien-/Bereichskoppler mit KNXnet/IP Tunneling/Routing', 'Line/area coupler with KNXnet/IP routing'),
    protocol: 'KNX IP',
    prefix: 'KNX-IP-Router',
    isRouterOrCoupler: true,
    objects: [],
  },
];

export const KNX_STARTER_GROUPS: readonly {address: string; name: string; dpt: string; description: string}[] = [
  {address: '1/1/1', name: 'Wohnen · Deckenlicht Schalten', dpt: '1.001', description: 'Hauptgruppe 1 Beleuchtung EG'},
  {address: '1/1/2', name: 'Wohnen · Deckenlicht Status', dpt: '1.001', description: 'Rückmeldung Schaltzustand'},
  {address: '1/1/3', name: 'Wohnen · Deckenlicht Dimmen', dpt: '3.007', description: 'Relatives Dimmen'},
  {address: '1/1/4', name: 'Wohnen · Deckenlicht Dimmwert', dpt: '5.001', description: 'Dimmwert 0..100 %'},
  {address: '2/1/1', name: 'Wohnen · Jalousie Auf/Ab', dpt: '1.008', description: 'Hauptgruppe 2 Beschattung'},
  {address: '2/1/2', name: 'Wohnen · Jalousie Stopp/Lamelle', dpt: '1.010', description: 'Stopp / Lamellenverstellung'},
  {address: '2/1/3', name: 'Zentral · Windalarm Sperre', dpt: '1.001', description: 'Wetterstation Sicherheitsfahrt'},
  {address: '3/1/1', name: 'Wohnen · Ist-Temperatur', dpt: '9.001', description: 'Hauptgruppe 3 Heizung / Klima'},
  {address: '3/1/2', name: 'Wohnen · Stellgröße Ventil', dpt: '5.001', description: 'Heizungsaktor 0..100 %'},
];

export function instantiateKnxDevicePreset(
  project: Project,
  preset: KnxDevicePreset,
  network = 'KNX',
): {next: Project; node: BusNode} {
  const d = automationData(project);
  const net = network.trim() || 'KNX';
  const sameNet = d.nodes.filter((n) => n.network === net && isKnx(n.protocol));

  let nameIdx = 1;
  while (sameNet.some((n) => n.name === `${preset.prefix}-${nameIdx}`)) nameIdx++;
  const name = `${preset.prefix}-${nameIdx}`;

  let devAddr = preset.isRouterOrCoupler ? 0 : 1;
  while (sameNet.some((n) => n.address === `1.1.${devAddr}`)) devAddr++;
  const address = `1.1.${Math.min(255, devAddr)}`;

  let ipAddress: string | undefined;
  if (preset.protocol === 'KNX IP') {
    let host = 20;
    while (sameNet.some((n) => n.ipAddress === `192.168.1.${host}`)) host++;
    ipAddress = `192.168.1.${Math.min(254, host)}`;
  }

  const node: BusNode = {
    id: crypto.randomUUID(),
    name,
    network: net,
    protocol: preset.protocol,
    address,
    ...(ipAddress ? {ipAddress} : {}),
    interfaceRole: 'device',
  };

  const next = editAutomation(project, {kind: 'save', entity: 'nodes', value: node});
  return {next, node};
}

export function instantiateKnxStarterGroups(
  project: Project,
  network = 'KNX',
): {next: Project; added: KnxGroup[]} {
  const net = network.trim() || 'KNX';
  let next = project;
  const added: KnxGroup[] = [];

  for (const item of KNX_STARTER_GROUPS) {
    const d = automationData(next);
    const numAddr = knxGroupAddress(item.address);
    const exists = d.knxGroups.some(
      (g) => g.network === net && numAddr !== undefined && knxGroupAddress(g.address) === numAddr,
    );
    if (exists) continue;
    const grp: KnxGroup = {
      id: crypto.randomUUID(),
      network: net,
      name: item.name,
      address: item.address,
      dpt: item.dpt,
      description: item.description,
    };
    next = editAutomation(next, {kind: 'save', entity: 'knxGroups', value: grp});
    added.push(grp);
  }

  return {next, added};
}

/**
 * Returns typical KNX communication objects matching a device's preset name,
 * so newly added devices can link authentic K.O.s in 1 click without creating orphans.
 */
export function suggestedKnxTemplatesForNode(
  node: BusNode,
  existingObjects: KnxObject[],
): KnxObjectTemplate[] {
  const matched = KNX_DEVICE_PRESETS.find((p) => node.name.startsWith(p.prefix));
  if (!matched) return [];
  return matched.objects.filter(
    (tmpl) => !existingObjects.some((o) => Number(o.number) === Number(tmpl.number)),
  );
}
