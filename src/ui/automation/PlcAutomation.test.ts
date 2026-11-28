import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {automationWorkspaceFixture} from '../testing/AutomationWorkspaceFixture';
import {inspectAutomation, automationData} from '../../model/Automation';
import {ProjectIndex} from '../../model/ProjectIndex';
import {PLC_MODULE_TEMPLATES, calculateNextModulePlacement, instantiatePlcModuleTemplate} from './PlcQuickTemplates';
import {renderPlcRackVisualizer} from './PlcRackVisualizer';
import {renderPlcSignalMatrix, formatChannelBinding} from './PlcSignalMatrix';
import {PlcHardwareWorkspace} from './PlcHardwareWorkspace';
import {BusTopologyWorkspace} from './BusTopologyWorkspace';
import {KnxRouterWorkspace} from './KnxRouterWorkspace';

const here = path.dirname(fileURLToPath(import.meta.url));

// 1. Fixture & Baseline
const project = automationWorkspaceFixture();
const issues = inspectAutomation(project);
const index = new ProjectIndex(project);
const data = automationData(project);

// 2. Templates Test
assert(PLC_MODULE_TEMPLATES.length >= 7, 'Has at least 7 module templates');
const di8 = PLC_MODULE_TEMPLATES.find(t => t.id === 'di8')!;
assert.equal(di8.channelCount, 8);
assert.equal(di8.kind, 'DI');

const controllerId = data.controllers[0]?.id || 'plc-main';
const placement = calculateNextModulePlacement(project, controllerId, '0', 'DI');
assert(Number(placement.nextSlot) >= 1, 'Calculates next valid slot');
assert(placement.nextBmk.includes('.'), 'Generates sub-BMK');

const instantiated = instantiatePlcModuleTemplate(project, di8, controllerId, '0');
assert.equal(instantiated.channels.length, 8);
assert.equal(instantiated.module.controllerId, controllerId);
assert(instantiated.channels.every(c => c.kind === 'DI'));
assert.equal(instantiated.channels[0].address, '%I1.0');
assert.equal(instantiated.channels[7].address, '%I1.7');

// 3. Rack Visualizer Test
const rackHtml = renderPlcRackVisualizer({
  project,
  controllerId,
  rackId: '0',
  issues,
});
assert(rackHtml.includes('plc-din-rail'), 'Includes DIN rail');
assert(rackHtml.includes('plc-module-card'), 'Includes module cards');
assert(rackHtml.includes('plc-module-cpu'), 'Includes CPU faceplate');
assert(rackHtml.includes('plc-pin-matrix'), 'Includes pin terminal matrix');
assert(rackHtml.includes('Slot 0'), 'Includes Slot 0');
assert(rackHtml.includes('plc-module-add-card'), 'Includes + Baugruppe placeholder');

// 4. Signal Matrix Test
const channels = data.channels.slice(0, 10);
const modules = data.modules;
const matrixHtml = renderPlcSignalMatrix({
  project,
  channels,
  modules,
  issues,
  projectIndex: index,
});
assert(matrixHtml.includes('plc-signal-matrix-table'), 'Includes matrix table');
assert(matrixHtml.includes('plc-inline-input'), 'Includes inline inputs');
assert(matrixHtml.includes('col-address'), 'Includes address column');
assert(matrixHtml.includes('col-symbol'), 'Includes symbol column');
assert(matrixHtml.includes('col-binding'), 'Includes binding column');

const bindingText = formatChannelBinding(channels[0]?.signal, index);
assert(typeof bindingText === 'string', 'Binding formatting works');

// 5. Workspaces Render Verification
let updatedProject = structuredClone(project);
const callbacks = {
  onUpdateProject: (p: any) => { updatedProject = p; },
  onNavigate: (_p: string, _c: string) => {},
  onError: (_e: any) => {},
};

// Hardware Workspace
const hw = new PlcHardwareWorkspace(
  () => updatedProject,
  () => issues,
  () => index,
  callbacks
);
const hwHtml = hw.render();
assert(hwHtml.includes('plc-hw-workspace'), 'Hardware workspace renders');
assert(hwHtml.includes('plc-hw-nav'), 'Nav renders');
assert(hwHtml.includes('plc-template-dropdown-menu') && hwHtml.includes('data-template-id="di8"'), 'Quick presets dropdown renders');

// Bus Topology Workspace
const bus = new BusTopologyWorkspace(
  () => updatedProject,
  () => issues,
  () => index,
  callbacks
);
const busHtml = bus.render();
assert(busHtml.includes('bus-topo-workspace'), 'Bus workspace renders');
assert(busHtml.includes('bus-topo-svg'), 'Bus SVG renders');
assert(busHtml.includes('bus-topo-toolbar-network'), 'Bus toolbar renders');

// KNX Router Workspace
const knx = new KnxRouterWorkspace(
  () => updatedProject,
  () => issues,
  () => index,
  callbacks
);
const knxHtml = knx.render();
assert(knxHtml.includes('knx-router-workspace'), 'KNX workspace renders');
assert(knxHtml.includes('knx-3col-layout'), 'KNX 3-column layout renders');
assert(knxHtml.includes('knx-flow-container'), 'KNX flow router renders');
assert(knxHtml.includes('data-group-field="address"'), 'KNX group address is editable inline');

// 6. Regression Checks for Layout, Fokuslinse, and Interaction Bugs
const cssSource = fs.readFileSync(path.join(here, '..', 'AutomationWorkspace.css'), 'utf8');
assert(
  /#automationDialog\s+\.eng-body\{[^}]*flex-direction\s*:\s*column/.test(cssSource),
  'AutomationWorkspace.css must lay out #automationDialog .eng-body vertically'
);
for (const panelSelector of ['.plc-hw-nav', '.plc-hw-inspector', '.bus-topo-inspector', '.knx-col-devices']) {
  const hiddenRule = new RegExp(`${panelSelector.replace('.', '\\.')}[^}]*display\\s*:\\s*none`);
  assert(!hiddenRule.test(cssSource), `${panelSelector} must remain visible on narrow viewports`);
}

const lensSource = fs.readFileSync(path.join(here, '..', 'EngineeringVisualLens.ts'), 'utf8');
assert(!/automationDialog\s*:/.test(lensSource), 'EngineeringVisualLens must not register automationDialog');

const hwSource = fs.readFileSync(path.join(here, 'PlcHardwareWorkspace.ts'), 'utf8');
const channelIdx = hwSource.indexOf('[data-select-channel]');
const moduleIdx = hwSource.indexOf('[data-select-module]');
assert(channelIdx > 0 && moduleIdx > channelIdx, '[data-select-channel] must be checked before [data-select-module]');

const emptyProj = structuredClone(project);
emptyProj.automation = {controllers: [], modules: [], channels: [], nodes: [], links: [], knxGroups: [], knxObjects: []};
const emptyRackHtml = renderPlcRackVisualizer({
  project: emptyProj,
  controllerId: '',
  rackId: '0',
  issues: [],
});
assert(emptyRackHtml.includes('data-hw-action="new-controller"'), 'Empty rack offers controller creation');
assert(!emptyRackHtml.includes('data-add-module-prompt'), 'Empty rack does not offer adding module before controller');

// Verify adding >8 channels and controller/module add-delete sequences never collide
let seqProject = structuredClone(emptyProj);
let seqErrors: unknown[] = [];
const seqHw = new PlcHardwareWorkspace(
  () => seqProject,
  () => inspectAutomation(seqProject),
  () => new ProjectIndex(seqProject),
  {
    onUpdateProject: p => { seqProject = p; },
    onNavigate: () => {},
    onError: e => { seqErrors.push(e); },
  }
);
(seqHw as any).createController();
(seqHw as any).createController();
const firstCpuId = automationData(seqProject).controllers[0].id;
(seqHw as any).deleteController(firstCpuId);
(seqHw as any).createController(); // Should pick -KF1 instead of colliding with remaining -KF2
(seqHw as any).createCustomModule();
for (let i = 0; i < 10; i++) {
  (seqHw as any).addChannelToSelectedModule();
}
assert.equal(seqErrors.length, 0, `Expected no workspace errors, got: ${seqErrors.map(String).join('; ')}`);
assert.equal(automationData(seqProject).channels.length, 10, 'Added 10 non-overlapping channels cleanly');
assert.equal(inspectAutomation(seqProject).length, 0, 'Generated controllers, module, and >8 channels have zero inspection issues');

// Verify KNX error guard when adding K.O. without any group address
let knxErrProject = structuredClone(emptyProj);
let knxErrors: unknown[] = [];
const emptyKnx = new KnxRouterWorkspace(
  () => knxErrProject,
  () => [],
  () => new ProjectIndex(knxErrProject),
  {
    onUpdateProject: p => { knxErrProject = p; },
    onNavigate: () => {},
    onError: e => { knxErrors.push(e); },
  }
);
(emptyKnx as any).createNewKnxNode();
const knxNodeId = automationData(knxErrProject).nodes[0].id;
(emptyKnx as any).addObjectToDevice(knxNodeId);
assert.equal(knxErrors.length, 1, 'Adding K.O. without a group reports clear error instead of invalid save');
assert.equal(automationData(knxErrProject).knxObjects.length, 0, 'No invalid orphan K.O. created');

// Verify real PLC presets, process image allocator, stations, Bus presets, Loxone Air links & ETS multi-group KNX linking
{
  const {
    PLC_CONTROLLER_PRESETS,
    PLC_RACK_STATION_PRESETS,
    instantiatePlcControllerPreset,
    instantiateDecentralizedStation,
  } = await import('./PlcQuickTemplates');
  const {
    BUS_DEVICE_PRESETS,
    KNX_DEVICE_PRESETS,
    instantiateBusDevicePreset,
    instantiateKnxDevicePreset,
    instantiateKnxStarterGroups,
  } = await import('./AutomationDevicePresets');
  const {inspectAutomation, editAutomation} = await import('../../model/Automation');

  // Empty CPU allocates %I0.0..%I0.7 then %I1.0..%I2.7, analog %IW64..%IW70 and %IW72..%IW78, AO %QW64..%QW70, combo DI+DO, safety, 0-channel PS/IM
  const s7Res = instantiatePlcControllerPreset(emptyProj, PLC_CONTROLLER_PRESETS[1].id);
  assert.equal(inspectAutomation(s7Res.next).length, 0, 'Controller preset passes inspectAutomation');

  let cpuProj = instantiatePlcControllerPreset(emptyProj, 's7_1515_pn').next;
  assert.equal(inspectAutomation(cpuProj).length, 0, 'S7-1515 controller preset valid');
  const cpuId = automationData(cpuProj).controllers[0].id;

  const commitModule = (p: any, tpl: any) => {
    const res = instantiatePlcModuleTemplate(p, tpl, cpuId, '0');
    let next = editAutomation(p, {kind: 'save', entity: 'modules', value: res.module});
    for (const ch of res.channels) {
      next = editAutomation(next, {kind: 'save', entity: 'channels', value: ch});
    }
    return {next, res};
  };

  const byId = (id: string) => PLC_MODULE_TEMPLATES.find(t => t.id === id)!;
  const di8Mod = commitModule(cpuProj, byId('di8'));
  cpuProj = di8Mod.next;
  assert.equal(di8Mod.res.channels[0].address, '%I0.0');
  assert.equal(di8Mod.res.channels[7].address, '%I0.7');

  const di16Mod = commitModule(cpuProj, byId('di16'));
  cpuProj = di16Mod.next;
  assert.equal(di16Mod.res.channels[0].address, '%I1.0');
  assert.equal(di16Mod.res.channels[15].address, '%I2.7');

  const ai4Mod1 = commitModule(cpuProj, byId('ai4'));
  cpuProj = ai4Mod1.next;
  assert.equal(ai4Mod1.res.channels[0].address, '%IW64');
  assert.equal(ai4Mod1.res.channels[3].address, '%IW70');

  const ai4Mod2 = commitModule(cpuProj, byId('ai4'));
  cpuProj = ai4Mod2.next;
  assert.equal(ai4Mod2.res.channels[0].address, '%IW72');
  assert.equal(ai4Mod2.res.channels[3].address, '%IW78');

  const ao4Mod = commitModule(cpuProj, byId('ao4'));
  cpuProj = ao4Mod.next;
  assert.equal(ao4Mod.res.channels[0].address, '%QW64');
  assert.equal(ao4Mod.res.channels[3].address, '%QW70');

  const comboMod = commitModule(cpuProj, byId('dido_8_8'));
  cpuProj = comboMod.next;
  assert.equal(comboMod.res.channels.filter((c: any) => c.kind === 'DI')[0].address, '%I3.0');
  assert.equal(comboMod.res.channels.filter((c: any) => c.kind === 'DO')[0].address, '%Q0.0');

  const fdiMod = commitModule(cpuProj, byId('fdi8'));
  cpuProj = fdiMod.next;
  assert.equal(fdiMod.res.channels.length, 8);

  const psMod = commitModule(cpuProj, byId('ps_24v'));
  cpuProj = psMod.next;
  assert.equal(psMod.res.channels.length, 0);

  const imMod = commitModule(cpuProj, byId('im_pn'));
  cpuProj = imMod.next;
  assert.equal(imMod.res.channels.length, 0);

  const stationRes = instantiateDecentralizedStation(cpuProj, cpuId, PLC_RACK_STATION_PRESETS[0].id);
  cpuProj = stationRes.next;
  assert.equal(stationRes.coupler.slot, '0', 'Decentralized ET station places IM coupler in slot 0');
  const remoteDi = instantiatePlcModuleTemplate(cpuProj, byId('di16'), cpuId, stationRes.rack);
  cpuProj = editAutomation(cpuProj, {kind: 'save', entity: 'modules', value: remoteDi.module});
  for (const ch of remoteDi.channels) {
    cpuProj = editAutomation(cpuProj, {kind: 'save', entity: 'channels', value: ch});
  }
  assert.equal(
    automationData(cpuProj).modules.filter(m => m.rack === stationRes.rack).length,
    2,
    'Decentralized ET station holds coupler + added I/O module'
  );
  assert.equal(inspectAutomation(cpuProj).length, 0, 'Full mixed PLC rack + ET station valid');

  // Bus presets (including Loxone auto-interface creation & linking + Loxone Air link rules + switch port non-collision)
  let busProj = structuredClone(emptyProj);
  for (const preset of BUS_DEVICE_PRESETS) {
    const res = instantiateBusDevicePreset(busProj, preset);
    busProj = res.next;
    assert.equal(inspectAutomation(busProj).length, 0, `Preset ${preset.id} passes inspectAutomation`);
  }

  const airIface = automationData(busProj).nodes.find(n => n.protocol === 'Loxone Air' && n.interfaceRole === 'interface')!;
  const airDev = automationData(busProj).nodes.find(n => n.protocol === 'Loxone Air' && n.interfaceRole === 'device')!;
  assert(airIface && airDev, 'Loxone Air interface + device exist');

  const pnNodes = automationData(busProj).nodes.filter(n => n.protocol === 'PROFINET');
  assert(pnNodes.length >= 3, 'PROFINET nodes exist for multi-port test');

  const busWs = new BusTopologyWorkspace(
    () => busProj,
    () => inspectAutomation(busProj),
    () => new ProjectIndex(busProj),
    {
      onUpdateProject: p => { busProj = p; },
      onNavigate: () => {},
      onError: e => { throw e instanceof Error ? e : new Error(String(e)); },
    }
  );
  (busWs as any).connectPorts(airIface.id, 'P1', airDev.id, 'P2');
  const airLink = automationData(busProj).links.find(l => l.from === airIface.id && l.to === airDev.id);
  assert(airLink && airLink.fromPort === '' && airLink.toPort === '' && airLink.lengthM === undefined, 'Loxone Air link strips ports and length');

  (busWs as any).connectPorts(pnNodes[0].id, '', pnNodes[1].id, '');
  (busWs as any).connectPorts(pnNodes[0].id, '', pnNodes[2].id, '');
  const pnLinks = automationData(busProj).links.filter(l => l.from === pnNodes[0].id);
  assert.equal(pnLinks.length, 2);
  assert.notEqual(pnLinks[0].fromPort, pnLinks[1].fromPort, 'PROFINET switch assigns distinct ports');
  assert.equal(inspectAutomation(busProj).length, 0, 'All connected bus presets valid');

  // KNX workspace: honors Gebäude-KNX network, starter groups, KNX presets, direction editing & ETS multi-group K.O. assignment
  let knxProj = structuredClone(project);
  const knxWs = new KnxRouterWorkspace(
    () => knxProj,
    () => inspectAutomation(knxProj),
    () => new ProjectIndex(knxProj),
    {
      onUpdateProject: p => { knxProj = p; },
      onNavigate: () => {},
      onError: e => { throw e instanceof Error ? e : new Error(String(e)); },
    }
  );
  assert(knxWs.render().includes('Gebäude-KNX'), 'KNX router detects Gebäude-KNX network');
  knxProj = instantiateKnxStarterGroups(knxProj, 'Gebäude-KNX').next;
  knxProj = instantiateKnxDevicePreset(knxProj, KNX_DEVICE_PRESETS[0], 'Gebäude-KNX').next;
  const targetGroups = automationData(knxProj).knxGroups.filter(g => g.network === 'Gebäude-KNX');
  assert(targetGroups.length >= 2, 'Multiple KNX groups exist for multi-group linking');

  const objBeforeCount = automationData(knxProj).knxObjects.length;
  const firstObj = automationData(knxProj).knxObjects[0];
  (knxWs as any).updateObjectField(firstObj.id, 'direction', 'send');
  assert.equal(
    automationData(knxProj).knxObjects.find(o => o.id === firstObj.id)?.direction,
    'send',
    'KnxObject direction edited'
  );

  const secondGroup = targetGroups.find(
    g => g.id !== firstObj.groupId && (!g.dpt || !firstObj.dpt || g.dpt === firstObj.dpt)
  );
  if (secondGroup) {
    (knxWs as any).selectedGroupId = secondGroup.id;
    (knxWs as any).assignObjectToGroup(firstObj.id);
    const afterObjs = automationData(knxProj).knxObjects;
    assert.equal(afterObjs.length, objBeforeCount + 1, 'Multi-group ETS assignment preserves existing link and adds second object link');
    assert(afterObjs.some(o => o.groupId === firstObj.groupId && o.nodeId === firstObj.nodeId && o.number === firstObj.number));
    assert(afterObjs.some(o => o.groupId === secondGroup.id && o.nodeId === firstObj.nodeId && o.number === firstObj.number));
  }
  assert.equal(inspectAutomation(knxProj).length, 0, 'Expanded KNX project passes inspectAutomation');
}

console.log('✓ PlcAutomation.test.ts: All templates, rack visualization, signal matrix, 3 workspaces and layout/interaction fixes validated successfully');
