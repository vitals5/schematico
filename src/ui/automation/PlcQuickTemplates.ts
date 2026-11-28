import type {Project} from '../../model/types';
import {
  automationData,
  controllerLabel,
  editAutomation,
  plcAddress,
  type BusNode,
  type PlcChannel,
  type PlcController,
  type PlcModule,
} from '../../model/Automation';
import {isIpBus, isKnx, isLoxone, type BusProtocol} from '../../model/BusProfiles';
import {tr} from '../../i18n';

export type PlcTemplateCategory = 'io_digital' | 'io_analog' | 'io_combo' | 'safety' | 'system';
export type PlcHardwareRole = 'io' | 'safety' | 'ps' | 'coupler' | 'comm';

export interface PlcTemplateChannelSpec {
  number: string;
  kind: 'DI' | 'DO' | 'AI' | 'AO';
  relativeByte: number;
  bit?: number;
  addressPrefix: '%I' | '%Q' | '%IW' | '%QW' | '%ID' | '%QD';
  dataType: string;
  signalText?: string;
}

export interface PlcModuleTemplate {
  id: string;
  name: string;
  description: string;
  channelCount: number;
  kind: 'DI' | 'DO' | 'AI' | 'AO' | 'MIXED' | 'SYS';
  category?: PlcTemplateCategory;
  hardwareRole?: PlcHardwareRole;
  manufacturer?: string;
  articleHint?: string;
  channels: PlcTemplateChannelSpec[];
}

export const PLC_MODULE_TEMPLATES: PlcModuleTemplate[] = [
  {
    id: 'di8',
    name: tr('DI 8x 24V DC', 'DI 8x 24V DC'),
    description: tr('Digitaleingabe 8-kanalig, 24V DC (IEC Typ 3)', 'Digital input 8 channels, 24V DC'),
    channelCount: 8,
    kind: 'DI',
    category: 'io_digital',
    hardwareRole: 'io',
    channels: Array.from({length: 8}, (_, i) => ({
      number: String(i + 1),
      kind: 'DI',
      relativeByte: 0,
      bit: i,
      addressPrefix: '%I',
      dataType: 'BOOL',
      signalText: `${tr('Eingang', 'Input')} ${i + 1}`,
    })),
  },
  {
    id: 'di16',
    name: tr('DI 16x 24V DC', 'DI 16x 24V DC'),
    description: tr('Digitaleingabe 16-kanalig, 24V DC', 'Digital input 16 channels, 24V DC'),
    channelCount: 16,
    kind: 'DI',
    category: 'io_digital',
    hardwareRole: 'io',
    channels: Array.from({length: 16}, (_, i) => ({
      number: String(i + 1),
      kind: 'DI',
      relativeByte: Math.floor(i / 8),
      bit: i % 8,
      addressPrefix: '%I',
      dataType: 'BOOL',
      signalText: `${tr('Eingang', 'Input')} ${i + 1}`,
    })),
  },
  {
    id: 'di32',
    name: tr('DI 32x 24V DC HF', 'DI 32x 24V DC HF'),
    description: tr('High-Density Digitaleingabe 32-kanalig, 24V DC', 'High-density digital input 32 channels, 24V DC'),
    channelCount: 32,
    kind: 'DI',
    category: 'io_digital',
    hardwareRole: 'io',
    channels: Array.from({length: 32}, (_, i) => ({
      number: String(i + 1),
      kind: 'DI',
      relativeByte: Math.floor(i / 8),
      bit: i % 8,
      addressPrefix: '%I',
      dataType: 'BOOL',
      signalText: `${tr('Eingang', 'Input')} ${i + 1}`,
    })),
  },
  {
    id: 'do8',
    name: tr('DQ 8x 24V DC / 0.5A', 'DQ 8x 24V DC / 0.5A'),
    description: tr('Digitalausgabe 8-kanalig, 24V DC 0.5A Transistor', 'Digital output 8 channels, 24V DC 0.5A transistor'),
    channelCount: 8,
    kind: 'DO',
    category: 'io_digital',
    hardwareRole: 'io',
    channels: Array.from({length: 8}, (_, i) => ({
      number: String(i + 1),
      kind: 'DO',
      relativeByte: 0,
      bit: i,
      addressPrefix: '%Q',
      dataType: 'BOOL',
      signalText: `${tr('Ausgang', 'Output')} ${i + 1}`,
    })),
  },
  {
    id: 'do16',
    name: tr('DQ 16x 24V DC / 0.5A', 'DQ 16x 24V DC / 0.5A'),
    description: tr('Digitalausgabe 16-kanalig, 24V DC 0.5A Transistor', 'Digital output 16 channels, 24V DC 0.5A transistor'),
    channelCount: 16,
    kind: 'DO',
    category: 'io_digital',
    hardwareRole: 'io',
    channels: Array.from({length: 16}, (_, i) => ({
      number: String(i + 1),
      kind: 'DO',
      relativeByte: Math.floor(i / 8),
      bit: i % 8,
      addressPrefix: '%Q',
      dataType: 'BOOL',
      signalText: `${tr('Ausgang', 'Output')} ${i + 1}`,
    })),
  },
  {
    id: 'do8_relay',
    name: tr('DQ 8x Relais 230V AC / 2A', 'DQ 8x Relay 230V AC / 2A'),
    description: tr('Relaisausgabe 8-kanalig, potenzialfrei 2A', 'Relay output 8 channels, dry contact 2A'),
    channelCount: 8,
    kind: 'DO',
    category: 'io_digital',
    hardwareRole: 'io',
    channels: Array.from({length: 8}, (_, i) => ({
      number: String(i + 1),
      kind: 'DO',
      relativeByte: 0,
      bit: i,
      addressPrefix: '%Q',
      dataType: 'BOOL',
      signalText: `${tr('Relaisausgang', 'Relay Output')} ${i + 1}`,
    })),
  },
  {
    id: 'dido_8_8',
    name: tr('DI 8x / DQ 8x 24V DC (Kombi)', 'DI 8x / DQ 8x 24V DC (Combo)'),
    description: tr('Kombimodul 8 Digitaleingänge + 8 Digitalausgänge 24V DC', 'Combo module 8 digital inputs + 8 digital outputs 24V DC'),
    channelCount: 16,
    kind: 'MIXED',
    category: 'io_combo',
    hardwareRole: 'io',
    channels: [
      ...Array.from({length: 8}, (_, i) => ({
        number: String(i + 1),
        kind: 'DI' as const,
        relativeByte: 0,
        bit: i,
        addressPrefix: '%I' as const,
        dataType: 'BOOL',
        signalText: `${tr('Eingang', 'Input')} ${i + 1}`,
      })),
      ...Array.from({length: 8}, (_, i) => ({
        number: String(i + 1),
        kind: 'DO' as const,
        relativeByte: 0,
        bit: i,
        addressPrefix: '%Q' as const,
        dataType: 'BOOL',
        signalText: `${tr('Ausgang', 'Output')} ${i + 1}`,
      })),
    ],
  },
  {
    id: 'ai4',
    name: tr('AI 4x U/I (16 Bit)', 'AI 4x U/I (16 Bit)'),
    description: tr('Analogeingabe 4-kanalig, 0..10V / 4..20mA', 'Analog input 4 channels, 0..10V / 4..20mA'),
    channelCount: 4,
    kind: 'AI',
    category: 'io_analog',
    hardwareRole: 'io',
    channels: Array.from({length: 4}, (_, i) => ({
      number: String(i + 1),
      kind: 'AI',
      relativeByte: i * 2,
      addressPrefix: '%IW',
      dataType: 'INT',
      signalText: `${tr('Analogeingang', 'Analog Input')} ${i + 1}`,
    })),
  },
  {
    id: 'ai8',
    name: tr('AI 8x U/I (16 Bit)', 'AI 8x U/I (16 Bit)'),
    description: tr('Analogeingabe 8-kanalig, 0..10V / 4..20mA', 'Analog input 8 channels, 0..10V / 4..20mA'),
    channelCount: 8,
    kind: 'AI',
    category: 'io_analog',
    hardwareRole: 'io',
    channels: Array.from({length: 8}, (_, i) => ({
      number: String(i + 1),
      kind: 'AI',
      relativeByte: i * 2,
      addressPrefix: '%IW',
      dataType: 'INT',
      signalText: `${tr('Analogeingang', 'Analog Input')} ${i + 1}`,
    })),
  },
  {
    id: 'ai4_rtd',
    name: tr('AI 4x RTD (PT100 / PT1000)', 'AI 4x RTD (PT100 / PT1000)'),
    description: tr('Temperaturmodul 4-kanalig für Widerstandsthermometer', 'Temperature input 4 channels for PT100 / PT1000'),
    channelCount: 4,
    kind: 'AI',
    category: 'io_analog',
    hardwareRole: 'io',
    channels: Array.from({length: 4}, (_, i) => ({
      number: String(i + 1),
      kind: 'AI',
      relativeByte: i * 2,
      addressPrefix: '%IW',
      dataType: 'INT',
      signalText: `${tr('Temperatur RTD', 'Temperature RTD')} ${i + 1}`,
    })),
  },
  {
    id: 'ai4_tc',
    name: tr('AI 4x TC (Thermoelement J/K)', 'AI 4x TC (Thermocouple J/K)'),
    description: tr('Analogeingabe 4-kanalig für Thermoelemente Typ J/K', 'Analog input 4 channels for Thermocouples type J/K'),
    channelCount: 4,
    kind: 'AI',
    category: 'io_analog',
    hardwareRole: 'io',
    channels: Array.from({length: 4}, (_, i) => ({
      number: String(i + 1),
      kind: 'AI',
      relativeByte: i * 2,
      addressPrefix: '%IW',
      dataType: 'INT',
      signalText: `${tr('Thermoelement', 'Thermocouple')} ${i + 1}`,
    })),
  },
  {
    id: 'ao4',
    name: tr('AQ 4x U/I (16 Bit)', 'AQ 4x U/I (16 Bit)'),
    description: tr('Analogausgabe 4-kanalig, 0..10V / 4..20mA', 'Analog output 4 channels, 0..10V / 4..20mA'),
    channelCount: 4,
    kind: 'AO',
    category: 'io_analog',
    hardwareRole: 'io',
    channels: Array.from({length: 4}, (_, i) => ({
      number: String(i + 1),
      kind: 'AO',
      relativeByte: i * 2,
      addressPrefix: '%QW',
      dataType: 'INT',
      signalText: `${tr('Analogausgang', 'Analog Output')} ${i + 1}`,
    })),
  },
  {
    id: 'tm_count2',
    name: tr('TM Count 2x 24V (Zähler / Encoder)', 'TM Count 2x 24V (Counter / Encoder)'),
    description: tr('Technologiemodul 2 schnelle Zählkanäle (32-Bit DINT)', 'Technology module 2 high-speed counter channels (32-bit DINT)'),
    channelCount: 2,
    kind: 'AI',
    category: 'io_analog',
    hardwareRole: 'io',
    channels: Array.from({length: 2}, (_, i) => ({
      number: String(i + 1),
      kind: 'AI',
      relativeByte: i * 4,
      addressPrefix: '%ID',
      dataType: 'DINT',
      signalText: `${tr('Zählerkanal', 'Counter Channel')} ${i + 1}`,
    })),
  },
  {
    id: 'fdi8',
    name: tr('F-DI 8x 24V DC HF (Fail-Safe SIL3)', 'F-DI 8x 24V DC HF (Fail-Safe SIL3)'),
    description: tr('Fehlersicherer Digitaleingang 8-kanalig bis SIL 3 / PL e', 'Fail-safe digital input 8 channels up to SIL 3 / PL e'),
    channelCount: 8,
    kind: 'DI',
    category: 'safety',
    hardwareRole: 'safety',
    channels: Array.from({length: 8}, (_, i) => ({
      number: String(i + 1),
      kind: 'DI',
      relativeByte: 0,
      bit: i,
      addressPrefix: '%I',
      dataType: 'BOOL',
      signalText: `${tr('Sicherheitseingang', 'Safety Input')} ${i + 1}`,
    })),
  },
  {
    id: 'fdo4',
    name: tr('F-DQ 4x 24V DC / 2A PM (Fail-Safe SIL3)', 'F-DQ 4x 24V DC / 2A PM (Fail-Safe SIL3)'),
    description: tr('Fehlersicherer Digitalausgang 4-kanalig, PP/PM-schaltend SIL 3', 'Fail-safe digital output 4 channels, SIL 3 / PL e'),
    channelCount: 4,
    kind: 'DO',
    category: 'safety',
    hardwareRole: 'safety',
    channels: Array.from({length: 4}, (_, i) => ({
      number: String(i + 1),
      kind: 'DO',
      relativeByte: 0,
      bit: i,
      addressPrefix: '%Q',
      dataType: 'BOOL',
      signalText: `${tr('Sicherheitsausgang', 'Safety Output')} ${i + 1}`,
    })),
  },
  {
    id: 'ps_24v',
    name: tr('PS 24V DC / 5A (System-Stromversorgung)', 'PS 24V DC / 5A (System Power Supply)'),
    description: tr('Rack-Stromversorgung 24V DC für Rückwandbus / Lastversorgung', 'Rack power supply 24V DC for backplane bus / load power'),
    channelCount: 0,
    kind: 'SYS',
    category: 'system',
    hardwareRole: 'ps',
    channels: [],
  },
  {
    id: 'im_pn',
    name: tr('IM 155-6 PN / Buskoppler (PROFINET)', 'IM 155-6 PN / Bus Coupler (PROFINET)'),
    description: tr('Interfacemodul / Feldbuskoppler für dezentrale Peripherie', 'Interface module / fieldbus coupler for remote I/O station'),
    channelCount: 0,
    kind: 'SYS',
    category: 'system',
    hardwareRole: 'coupler',
    channels: [],
  },
  {
    id: 'cm_ptp',
    name: tr('CM PtP RS485 / Modbus RTU', 'CM PtP RS485 / Modbus RTU'),
    description: tr('Kommunikationsmodul seriell RS422/485 (Modbus RTU / USS / Freeport)', 'Serial communication module RS422/485 (Modbus RTU / Freeport)'),
    channelCount: 0,
    kind: 'SYS',
    category: 'system',
    hardwareRole: 'comm',
    channels: [],
  },
  {
    id: 'cm_iolink',
    name: tr('CM 4x IO-Link Master', 'CM 4x IO-Link Master'),
    description: tr('IO-Link Mastermodul 4 Ports nach IEC 61131-9', 'IO-Link master module 4 ports per IEC 61131-9'),
    channelCount: 0,
    kind: 'SYS',
    category: 'system',
    hardwareRole: 'comm',
    channels: [],
  },
  {
    id: 'cp_eth',
    name: tr('CP Ethernet / OPC UA', 'CP Ethernet / OPC UA'),
    description: tr('Kommunikationsprozessor Ethernet (OPC UA / S7 / Modbus TCP)', 'Ethernet communication processor (OPC UA / Modbus TCP)'),
    channelCount: 0,
    kind: 'SYS',
    category: 'system',
    hardwareRole: 'comm',
    channels: [],
  },
];

export interface PlcControllerPreset {
  id: string;
  name: string;
  description: string;
  bmkPrefix: string;
  plant: string;
  location: string;
  integratedModules?: string[];
  integratedCustomChannels?: PlcTemplateChannelSpec[];
  busInterfaces?: {
    protocol: BusProtocol;
    network: string;
    role: 'device' | 'interface';
    nameSuffix: string;
    profile?: 'generic' | 'air-base';
  }[];
}

export const PLC_CONTROLLER_PRESETS: PlcControllerPreset[] = [
  {
    id: 's7_1511',
    name: 'SIMATIC S7-1511-1 PN (Modular)',
    description: tr('Modulare Industrie-CPU mit PROFINET-Schnittstelle', 'Modular industrial CPU with PROFINET interface'),
    bmkPrefix: '-KF',
    plant: '=ST01',
    location: '+SP01',
    busInterfaces: [{protocol: 'PROFINET', network: 'PROFINET-1', role: 'interface', nameSuffix: 'PN-Controller'}],
  },
  {
    id: 's7_1515f',
    name: 'SIMATIC S7-1515F-2 PN (Fail-Safe)',
    description: tr('Fehlersichere CPU bis SIL 3 / PL e mit 2× PROFINET', 'Fail-safe CPU up to SIL 3 / PL e with 2× PROFINET'),
    bmkPrefix: '-KF',
    plant: '=ST01',
    location: '+SP01',
    busInterfaces: [{protocol: 'PROFINET', network: 'PROFINET-1', role: 'interface', nameSuffix: 'F-CPU'}],
  },
  {
    id: 's7_1214c',
    name: 'SIMATIC S7-1214C DC/DC/DC (14DI/10DO/2AI)',
    description: tr('Kompakt-CPU mit 14 DI, 10 DO, 2 AI an Bord', 'Compact CPU with onboard 14 DI, 10 DO, 2 AI'),
    bmkPrefix: '-KF',
    plant: '=ST01',
    location: '+SP01',
    integratedCustomChannels: [
      ...Array.from({length: 14}, (_, i) => ({
        number: String(i + 1),
        kind: 'DI' as const,
        relativeByte: Math.floor(i / 8),
        bit: i % 8,
        addressPrefix: '%I' as const,
        dataType: 'BOOL',
        signalText: `${tr('Onboard DI', 'Onboard DI')} ${i + 1}`,
      })),
      ...Array.from({length: 10}, (_, i) => ({
        number: String(i + 1),
        kind: 'DO' as const,
        relativeByte: Math.floor(i / 8),
        bit: i % 8,
        addressPrefix: '%Q' as const,
        dataType: 'BOOL',
        signalText: `${tr('Onboard DO', 'Onboard DO')} ${i + 1}`,
      })),
      ...Array.from({length: 2}, (_, i) => ({
        number: String(i + 1),
        kind: 'AI' as const,
        relativeByte: i * 2,
        addressPrefix: '%IW' as const,
        dataType: 'INT',
        signalText: `${tr('Onboard AI 0..10V', 'Onboard AI 0..10V')} ${i + 1}`,
      })),
    ],
    busInterfaces: [{protocol: 'PROFINET', network: 'PROFINET-1', role: 'interface', nameSuffix: 'PN'}],
  },
  {
    id: 'logo8',
    name: 'LOGO! 8 24CE (8DI / 4DO)',
    description: tr('Logikmodul / Kleinsteuerung 24V DC mit Ethernet', 'Compact logic controller 24V DC with Ethernet'),
    bmkPrefix: '-KF',
    plant: '=ST01',
    location: '+UV01',
    integratedCustomChannels: [
      ...Array.from({length: 8}, (_, i) => ({
        number: String(i + 1),
        kind: 'DI' as const,
        relativeByte: 0,
        bit: i,
        addressPrefix: '%I' as const,
        dataType: 'BOOL',
        signalText: `I${i + 1}`,
      })),
      ...Array.from({length: 4}, (_, i) => ({
        number: String(i + 1),
        kind: 'DO' as const,
        relativeByte: 0,
        bit: i,
        addressPrefix: '%Q' as const,
        dataType: 'BOOL',
        signalText: `Q${i + 1}`,
      })),
    ],
    busInterfaces: [{protocol: 'Modbus TCP', network: 'Steuerungsnetz', role: 'interface', nameSuffix: 'ETH'}],
  },
  {
    id: 'wago_pfc200',
    name: 'WAGO PFC200 Controller (750-8212)',
    description: tr('Reihenklemmen-Controller mit Codesys / Modbus / Ethernet', 'Modular rail controller with Ethernet / Modbus'),
    bmkPrefix: '-KF',
    plant: '=ST01',
    location: '+SP01',
    busInterfaces: [{protocol: 'Modbus TCP', network: 'Feldbus-ETH', role: 'interface', nameSuffix: 'PFC200'}],
  },
  {
    id: 'beckhoff_cx',
    name: 'Beckhoff CX5130 Embedded-PC (EtherCAT)',
    description: tr('Hutschienen-IPC mit integriertem EtherCAT-Master', 'DIN-rail IPC with integrated EtherCAT master'),
    bmkPrefix: '-KF',
    plant: '=ST01',
    location: '+SP01',
    busInterfaces: [{protocol: 'EtherCAT', network: 'EtherCAT-1', role: 'interface', nameSuffix: 'ECAT-Master'}],
  },
  {
    id: 'phoenix_axc',
    name: 'Phoenix Contact AXC F 2152 (PLCnext)',
    description: tr('Axioline F Steuerung mit PROFINET-Controller & OPC UA', 'Axioline F controller with PROFINET & OPC UA'),
    bmkPrefix: '-KF',
    plant: '=ST01',
    location: '+SP01',
    busInterfaces: [{protocol: 'PROFINET', network: 'PROFINET-1', role: 'interface', nameSuffix: 'AXC-PN'}],
  },
  {
    id: 'loxone_ms',
    name: 'Loxone Miniserver Gen. 2 (8DI/8DO/4AI)',
    description: tr('Gebäudeautomations-Zentrale mit Tree & Link Schnittstellen', 'Building automation server with Tree & Link interfaces'),
    bmkPrefix: '-A',
    plant: '=GA01',
    location: '+UV01',
    integratedCustomChannels: [
      ...Array.from({length: 8}, (_, i) => ({
        number: String(i + 1),
        kind: 'DI' as const,
        relativeByte: 0,
        bit: i,
        addressPrefix: '%I' as const,
        dataType: 'BOOL',
        signalText: `DI ${i + 1}`,
      })),
      ...Array.from({length: 8}, (_, i) => ({
        number: String(i + 1),
        kind: 'DO' as const,
        relativeByte: 0,
        bit: i,
        addressPrefix: '%Q' as const,
        dataType: 'BOOL',
        signalText: `${tr('Relais Q', 'Relay Q')}${i + 1}`,
      })),
      ...Array.from({length: 4}, (_, i) => ({
        number: String(i + 1),
        kind: 'AI' as const,
        relativeByte: i * 2,
        addressPrefix: '%IW' as const,
        dataType: 'INT',
        signalText: `AI ${i + 1} (0-10V)`,
      })),
    ],
    busInterfaces: [
      {protocol: 'Loxone Link', network: 'Loxone Gebäude', role: 'interface', nameSuffix: 'Link-Bus'},
      {protocol: 'Loxone Tree', network: 'Loxone Gebäude', role: 'interface', nameSuffix: 'Tree-Zweig'},
    ],
  },
  {
    id: 'custom_cpu',
    name: tr('Leere Standard-CPU (Benutzerdefiniert)', 'Empty Standard CPU (Custom)'),
    description: tr('Neutrale SPS-Steuerung ohne vorangelegte E/A-Karten', 'Neutral PLC controller without prebuilt I/O cards'),
    bmkPrefix: '-KF',
    plant: '=ST01',
    location: '+SP01',
  },
];

export interface PlcRackStationPreset {
  id: string;
  name: string;
  description: string;
  couplerBmkSuffix: string;
  couplerDescription: string;
  busProtocol?: BusProtocol;
  defaultNetwork?: string;
}

export const PLC_RACK_STATION_PRESETS: PlcRackStationPreset[] = [
  {
    id: 'et200sp',
    name: 'ET 200SP Station (IM 155-6 PN)',
    description: tr('Dezentrale PROFINET-Peripheriestation als neues Rack', 'Decentralized PROFINET I/O station as new rack'),
    couplerBmkSuffix: 'IM',
    couplerDescription: 'IM 155-6 PN Buskoppler (PROFINET)',
    busProtocol: 'PROFINET',
    defaultNetwork: 'PROFINET-1',
  },
  {
    id: 'wago_750_pn',
    name: 'WAGO 750-362 Koppler (PROFINET)',
    description: tr('Dezentraler Feldbuskoppler Serie 750 als neues Rack', 'Decentralized fieldbus coupler 750 series as new rack'),
    couplerBmkSuffix: 'BK',
    couplerDescription: 'WAGO 750-362 PROFINET Feldbuskoppler',
    busProtocol: 'PROFINET',
    defaultNetwork: 'PROFINET-1',
  },
  {
    id: 'beckhoff_ek1100',
    name: 'Beckhoff EK1100 Koppler (EtherCAT)',
    description: tr('EtherCAT-Klemmenstation als neues Rack', 'EtherCAT terminal station as new rack'),
    couplerBmkSuffix: 'EK',
    couplerDescription: 'Beckhoff EK1100 EtherCAT-Koppler',
    busProtocol: 'EtherCAT',
    defaultNetwork: 'EtherCAT-1',
  },
  {
    id: 'phoenix_axl',
    name: 'Phoenix Contact AXL F BK PN',
    description: tr('Axioline F PROFINET-Buskoppler als neues Rack', 'Axioline F PROFINET bus coupler as new rack'),
    couplerBmkSuffix: 'BK',
    couplerDescription: 'AXL F BK PN PROFINET-Koppler',
    busProtocol: 'PROFINET',
    defaultNetwork: 'PROFINET-1',
  },
  {
    id: 'empty_rack',
    name: tr('Leeres Erweiterungs-Rack', 'Empty Expansion Rack'),
    description: tr('Rack-Erweiterung ohne Busknoten', 'Expansion rack without bus node'),
    couplerBmkSuffix: 'IM',
    couplerDescription: tr('Rack-Interfacemodul', 'Rack Interface Module'),
  },
];

export function controllerProcessImageIntervals(project: Project, controllerId: string) {
  const d = automationData(project);
  const cpuModuleIds = new Set(d.modules.filter((m) => m.controllerId === controllerId).map((m) => m.id));
  const intervals: {area: 'I' | 'Q'; start: number; end: number}[] = [];
  for (const ch of d.channels) {
    if (!cpuModuleIds.has(ch.moduleId)) continue;
    const parsed = plcAddress(ch.address);
    if (parsed) intervals.push(parsed);
  }
  return intervals;
}

/**
 * Allocates the lowest non-overlapping process-image byte address within a controller
 * respecting IEC bit/byte/word/dword ranges (including German E/A aliases).
 */
export function allocateProcessImageByte(
  project: Project,
  controllerId: string,
  area: 'I' | 'Q',
  byteSpan: number,
  startByte = 0,
  alignStep = 1,
  extraOccupied: {area: 'I' | 'Q'; start: number; end: number}[] = [],
): number {
  const occupied = [
    ...controllerProcessImageIntervals(project, controllerId),
    ...extraOccupied,
  ].filter((iv) => iv.area === area);

  const widthBits = Math.max(8, byteSpan * 8);
  let byte = Math.max(0, startByte);
  while (true) {
    const startBit = byte * 8;
    const endBit = startBit + widthBits;
    const collides = occupied.some((iv) => startBit < iv.end && endBit > iv.start);
    if (!collides) return byte;
    byte += Math.max(1, alignStep);
  }
}

/**
 * Calculates next available slot, unique module BMK, and non-overlapping base byte
 * for a given controller, rack, and primary channel kind.
 */
export function calculateNextModulePlacement(
  project: Project,
  controllerId: string,
  rack = '0',
  kind: 'DI' | 'DO' | 'AI' | 'AO' | 'MIXED' | 'SYS' = 'DI',
): {nextSlot: string; nextBmk: string; baseByte: number} {
  const d = automationData(project);
  const controller = d.controllers.find((c) => c.id === controllerId);
  const controllerBmk = controller?.bmk || '-KF1';
  const existingModules = d.modules.filter((m) => m.controllerId === controllerId && (m.rack || '0') === rack);

  let maxSlot = 0;
  for (const m of existingModules) {
    const s = parseInt(m.slot, 10);
    if (!isNaN(s) && s > maxSlot) maxSlot = s;
  }
  let s = maxSlot + 1;
  while (existingModules.some((m) => m.slot === String(s))) s++;
  const nextSlot = String(s);

  const prefix = rack === '0' ? `${controllerBmk}.` : `${controllerBmk}.R${rack}.`;
  let bmkIdx = s;
  while (d.modules.some((m) => m.controllerId === controllerId && m.bmk === `${prefix}${bmkIdx}`)) bmkIdx++;
  const nextBmk = `${prefix}${bmkIdx}`;

  let baseByte = 0;
  if (kind === 'DI' || kind === 'DO') {
    baseByte = allocateProcessImageByte(project, controllerId, kind === 'DI' ? 'I' : 'Q', 1, 0, 1);
  } else if (kind === 'AI' || kind === 'AO') {
    baseByte = allocateProcessImageByte(project, controllerId, kind === 'AI' ? 'I' : 'Q', 2, 64, 2);
  }

  return {nextSlot, nextBmk, baseByte};
}

function buildChannelsFromSpecs(
  project: Project,
  controllerId: string,
  moduleId: string,
  specs: PlcTemplateChannelSpec[],
): PlcChannel[] {
  if (!specs.length) return [];

  // Partition specs by addressing bucket: (area, widthKind: 'bit' | 'word' | 'dword')
  type BucketKey = `${'I' | 'Q'}:${'bit' | 'word' | 'dword'}`;
  const buckets = new Map<BucketKey, PlcTemplateChannelSpec[]>();
  for (const spec of specs) {
    const area: 'I' | 'Q' = spec.addressPrefix.includes('Q') ? 'Q' : 'I';
    const widthKind = spec.addressPrefix.endsWith('D')
      ? 'dword'
      : spec.addressPrefix.endsWith('W')
        ? 'word'
        : 'bit';
    const key: BucketKey = `${area}:${widthKind}`;
    const list = buckets.get(key) ?? [];
    list.push(spec);
    buckets.set(key, list);
  }

  const baseByteByBucket = new Map<BucketKey, number>();
  const stagedIntervals: {area: 'I' | 'Q'; start: number; end: number}[] = [];

  for (const [key, list] of buckets.entries()) {
    const [area, widthKind] = key.split(':') as ['I' | 'Q', 'bit' | 'word' | 'dword'];
    const elemBytes = widthKind === 'dword' ? 4 : widthKind === 'word' ? 2 : 1;
    const minRel = Math.min(...list.map((c) => c.relativeByte));
    const maxRel = Math.max(...list.map((c) => c.relativeByte));
    const byteSpan = Math.max(elemBytes, maxRel - minRel + elemBytes);
    const preferredStart = widthKind === 'bit' ? 0 : 64;
    const alignStep = elemBytes;
    const allocStart = allocateProcessImageByte(
      project,
      controllerId,
      area,
      byteSpan,
      preferredStart,
      alignStep,
      stagedIntervals,
    );
    baseByteByBucket.set(key, allocStart - minRel);
    stagedIntervals.push({area, start: allocStart * 8, end: (allocStart + byteSpan) * 8});
  }

  return specs.map((ch) => {
    const area: 'I' | 'Q' = ch.addressPrefix.includes('Q') ? 'Q' : 'I';
    const widthKind = ch.addressPrefix.endsWith('D')
      ? 'dword'
      : ch.addressPrefix.endsWith('W')
        ? 'word'
        : 'bit';
    const key: BucketKey = `${area}:${widthKind}`;
    const base = baseByteByBucket.get(key) ?? 0;
    const byteNum = base + ch.relativeByte;
    const address = ch.bit !== undefined ? `${ch.addressPrefix}${byteNum}.${ch.bit}` : `${ch.addressPrefix}${byteNum}`;

    return {
      id: crypto.randomUUID(),
      moduleId,
      number: ch.number,
      kind: ch.kind,
      address,
      signalText: ch.signalText || '',
      dataType: ch.dataType,
      reserve: false,
    };
  });
}

/**
 * Creates a module and non-overlapping channels from a template for a controller & rack.
 */
export function instantiatePlcModuleTemplate(
  project: Project,
  template: PlcModuleTemplate,
  controllerId: string,
  rack = '0',
): {module: PlcModule; channels: PlcChannel[]} {
  const {nextSlot, nextBmk} = calculateNextModulePlacement(project, controllerId, rack, template.kind);
  const moduleId = crypto.randomUUID();

  const module: PlcModule = {
    id: moduleId,
    controllerId,
    rack,
    slot: nextSlot,
    bmk: nextBmk,
    description: template.name,
  };

  const channels = buildChannelsFromSpecs(project, controllerId, moduleId, template.channels);
  return {module, channels};
}

function allocateUniqueBusNode(
  project: Project,
  protocol: BusProtocol,
  network: string,
  baseName: string,
  controllerId: string,
  role: 'device' | 'interface',
  profile?: 'generic' | 'air-base',
): BusNode {
  const d = automationData(project);
  const sameNet = d.nodes.filter((n) => n.network === network);

  let idx = 1;
  while (sameNet.some((n) => n.name === `${baseName}` || n.name === `${baseName}-${idx}`)) {
    if (!sameNet.some((n) => n.name === baseName)) break;
    idx++;
  }
  const name = !sameNet.some((n) => n.name === baseName) ? baseName : `${baseName}-${idx}`;

  const needsIp = isIpBus(protocol) && !isLoxone(protocol);
  let ipAddress: string | undefined;
  let address = '';

  if (needsIp) {
    let host = 10;
    while (
      sameNet.some(
        (n) =>
          n.ipAddress === `192.168.1.${host}` ||
          n.address === `192.168.1.${host}`,
      )
    ) {
      host++;
    }
    ipAddress = `192.168.1.${Math.min(254, host)}`;
    if (isKnx(protocol)) {
      let member = 1;
      while (sameNet.some((n) => n.address === `1.1.${member}`)) member++;
      address = `1.1.${Math.min(254, member)}`;
    } else {
      address = ipAddress;
    }
  } else if (isKnx(protocol)) {
    let member = 1;
    while (sameNet.some((n) => n.address === `1.1.${member}`)) member++;
    address = `1.1.${Math.min(254, member)}`;
  } else if (protocol === 'PROFIBUS DP' || protocol === 'Modbus RTU' || protocol === 'DALI') {
    const start = protocol === 'DALI' ? 0 : protocol === 'PROFIBUS DP' ? 2 : 1;
    let addr = start;
    while (sameNet.some((n) => n.address.trim() === String(addr))) addr++;
    address = String(addr);
  }

  return {
    id: crypto.randomUUID(),
    name,
    network,
    protocol,
    address,
    ...(ipAddress ? {ipAddress} : {}),
    ...(isLoxone(protocol)
      ? {
          interfaceRole: role,
          ...(profile ? {interfaceProfile: profile} : {}),
        }
      : {}),
    controllerId,
  };
}

/**
 * Instantiates a realistic PLC controller preset including optional integrated I/O
 * and linked fieldbus / Loxone interface nodes.
 */
export function instantiatePlcControllerPreset(
  project: Project,
  presetId: string,
): {next: Project; controller: PlcController; modules: PlcModule[]; channels: PlcChannel[]; nodes: BusNode[]} {
  const preset = PLC_CONTROLLER_PRESETS.find((p) => p.id === presetId) ?? PLC_CONTROLLER_PRESETS[0];
  const d = automationData(project);

  let num = 1;
  while (
    d.controllers.some(
      (c) =>
        c.bmk === `${preset.bmkPrefix}${num}` ||
        controllerLabel(c) === controllerLabel({id: '', bmk: `${preset.bmkPrefix}${num}`, plant: preset.plant, location: preset.location, description: ''}),
    )
  ) {
    num++;
  }

  const controller: PlcController = {
    id: crypto.randomUUID(),
    bmk: `${preset.bmkPrefix}${num}`,
    plant: preset.plant,
    location: preset.location,
    description: preset.name,
  };

  let next = editAutomation(project, {kind: 'save', entity: 'controllers', value: controller});
  const createdModules: PlcModule[] = [];
  const createdChannels: PlcChannel[] = [];
  const createdNodes: BusNode[] = [];

  if (preset.integratedCustomChannels?.length) {
    const modId = crypto.randomUUID();
    const mod: PlcModule = {
      id: modId,
      controllerId: controller.id,
      rack: '0',
      slot: '1',
      bmk: `${controller.bmk}.1`,
      description: `${preset.name} (${tr('Integrierte E/A', 'Onboard I/O')})`,
    };
    next = editAutomation(next, {kind: 'save', entity: 'modules', value: mod});
    createdModules.push(mod);

    const chans = buildChannelsFromSpecs(next, controller.id, modId, preset.integratedCustomChannels);
    for (const ch of chans) {
      next = editAutomation(next, {kind: 'save', entity: 'channels', value: ch});
      createdChannels.push(ch);
    }
  }

  for (const bi of preset.busInterfaces ?? []) {
    const node = allocateUniqueBusNode(
      next,
      bi.protocol,
      bi.network,
      `${controller.bmk} ${bi.nameSuffix}`,
      controller.id,
      bi.role,
      bi.profile,
    );
    next = editAutomation(next, {kind: 'save', entity: 'nodes', value: node});
    createdNodes.push(node);
  }

  return {next, controller, modules: createdModules, channels: createdChannels, nodes: createdNodes};
}

/**
 * Creates a decentralized I/O station (Rack 1+) with Slot 0 bus coupler module
 * and optional linked PROFINET / EtherCAT bus device.
 */
export function instantiateDecentralizedStation(
  project: Project,
  controllerId: string,
  presetId: string,
): {next: Project; rack: string; coupler: PlcModule; node?: BusNode} {
  const preset = PLC_RACK_STATION_PRESETS.find((p) => p.id === presetId) ?? PLC_RACK_STATION_PRESETS[0];
  const d = automationData(project);
  const cpu = d.controllers.find((c) => c.id === controllerId);
  if (!cpu) throw new Error(tr('Zuerst eine Steuerung anlegen.', 'Create a controller first.'));

  const cpuModules = d.modules.filter((m) => m.controllerId === controllerId);
  let r = 1;
  while (cpuModules.some((m) => (m.rack || '0') === String(r))) r++;
  const rack = String(r);

  const coupler: PlcModule = {
    id: crypto.randomUUID(),
    controllerId,
    rack,
    slot: '0',
    bmk: `${cpu.bmk}.R${rack}.${preset.couplerBmkSuffix}`,
    description: preset.couplerDescription,
  };

  let next = editAutomation(project, {kind: 'save', entity: 'modules', value: coupler});
  let createdNode: BusNode | undefined;

  if (preset.busProtocol && preset.defaultNetwork) {
    const existingSameProto = d.nodes.find((n) => n.protocol === preset.busProtocol);
    const network = existingSameProto?.network || preset.defaultNetwork;
    createdNode = allocateUniqueBusNode(
      next,
      preset.busProtocol,
      network,
      `${coupler.bmk} (${preset.name.split(' ')[0]})`,
      controllerId,
      'device',
    );
    next = editAutomation(next, {kind: 'save', entity: 'nodes', value: createdNode});
  }

  return {next, rack, coupler, node: createdNode};
}
