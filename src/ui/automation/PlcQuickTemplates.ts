import type {Project} from '../../model/types';
import {automationData,type PlcModule,type PlcChannel} from '../../model/Automation';
import {tr} from '../../i18n';

export interface PlcModuleTemplate {
  id: string;
  name: string;
  description: string;
  channelCount: number;
  kind: 'DI' | 'DO' | 'AI' | 'AO';
  channels: {
    number: string;
    kind: 'DI' | 'DO' | 'AI' | 'AO';
    relativeByte: number;
    bit?: number;
    addressPrefix: string;
    dataType: string;
    signalText?: string;
  }[];
}

export const PLC_MODULE_TEMPLATES: PlcModuleTemplate[] = [
  {
    id: 'di8',
    name: tr('DI 8x 24V DC', 'DI 8x 24V DC'),
    description: tr('Digitaleingabe 8-kanalig, 24V DC', 'Digital input 8 channels, 24V DC'),
    channelCount: 8,
    kind: 'DI',
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
    id: 'do8',
    name: tr('DQ 8x 24V DC / 0.5A', 'DQ 8x 24V DC / 0.5A'),
    description: tr('Digitalausgabe 8-kanalig, 24V DC 0.5A Transistor', 'Digital output 8 channels, 24V DC 0.5A transistor'),
    channelCount: 8,
    kind: 'DO',
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
    id: 'ai4',
    name: tr('AI 4x U/I (16 Bit)', 'AI 4x U/I (16 Bit)'),
    description: tr('Analogeingabe 4-kanalig, 0..10V / 4..20mA', 'Analog input 4 channels, 0..10V / 4..20mA'),
    channelCount: 4,
    kind: 'AI',
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
    id: 'ao4',
    name: tr('AQ 4x U/I (16 Bit)', 'AQ 4x U/I (16 Bit)'),
    description: tr('Analogausgabe 4-kanalig, 0..10V / 4..20mA', 'Analog output 4 channels, 0..10V / 4..20mA'),
    channelCount: 4,
    kind: 'AO',
    channels: Array.from({length: 4}, (_, i) => ({
      number: String(i + 1),
      kind: 'AO',
      relativeByte: i * 2,
      addressPrefix: '%QW',
      dataType: 'INT',
      signalText: `${tr('Analogausgang', 'Analog Output')} ${i + 1}`,
    })),
  },
];

/**
 * Calculates next available slot and byte address for a given controller and rack.
 */
export function calculateNextModulePlacement(
  project: Project,
  controllerId: string,
  rack = '0',
  kind: 'DI' | 'DO' | 'AI' | 'AO' = 'DI'
): {nextSlot: string; nextBmk: string; baseByte: number} {
  const d = automationData(project);
  const controller = d.controllers.find(c => c.id === controllerId);
  const controllerBmk = controller?.bmk || '-KF1';
  
  const existingModules = d.modules.filter(m => m.controllerId === controllerId && (m.rack || '0') === rack);
  
  // Find highest slot number
  let maxSlot = 0;
  for (const m of existingModules) {
    const s = parseInt(m.slot, 10);
    if (!isNaN(s) && s > maxSlot) {
      maxSlot = s;
    }
  }
  const nextSlot = String(maxSlot + 1);

  // Generate BMK (e.g., -KF1.2 or -A2)
  const nextBmk = `${controllerBmk}.${nextSlot}`;

  // Find next address offset for given kind
  const allChannels = d.channels.filter(c => {
    const mod = d.modules.find(m => m.id === c.moduleId);
    return mod && mod.controllerId === controllerId && c.kind === kind;
  });

  let maxByte = kind === 'AI' || kind === 'AO' ? 64 : 0;
  for (const c of allChannels) {
    if (!c.address) continue;
    const match = c.address.match(/(?:%[I|Q|IW|QW])(\d+)(?:\.(\d+))?/i);
    if (match) {
      const b = parseInt(match[1], 10);
      if (!isNaN(b) && b >= maxByte) {
        maxByte = b + (kind === 'AI' || kind === 'AO' ? 2 : 1);
      }
    }
  }

  return {
    nextSlot,
    nextBmk,
    baseByte: maxByte,
  };
}

/**
 * Creates module and channels from a template in one operation.
 */
export function instantiatePlcModuleTemplate(
  project: Project,
  template: PlcModuleTemplate,
  controllerId: string,
  rack = '0'
): {module: PlcModule; channels: PlcChannel[]} {
  const {nextSlot, nextBmk, baseByte} = calculateNextModulePlacement(project, controllerId, rack, template.kind);
  const moduleId = crypto.randomUUID();

  const module: PlcModule = {
    id: moduleId,
    controllerId,
    rack,
    slot: nextSlot,
    bmk: nextBmk,
    description: template.name,
  };

  const channels: PlcChannel[] = template.channels.map(ch => {
    const channelId = crypto.randomUUID();
    const address = ch.bit !== undefined
      ? `${ch.addressPrefix}${baseByte + ch.relativeByte}.${ch.bit}`
      : `${ch.addressPrefix}${baseByte + ch.relativeByte}`;

    return {
      id: channelId,
      moduleId,
      number: ch.number,
      kind: ch.kind,
      address,
      signalText: ch.signalText || '',
      dataType: ch.dataType,
      reserve: false,
    };
  });

  return {module, channels};
}
