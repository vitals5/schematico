import assert from 'node:assert/strict';
import {automationWorkspaceFixture} from '../testing/AutomationWorkspaceFixture';
import {inspectAutomation, automationData} from '../../model/Automation';
import {ProjectIndex} from '../../model/ProjectIndex';
import {PLC_MODULE_TEMPLATES, calculateNextModulePlacement, instantiatePlcModuleTemplate} from './PlcQuickTemplates';
import {renderPlcRackVisualizer} from './PlcRackVisualizer';
import {renderPlcSignalMatrix, formatChannelBinding} from './PlcSignalMatrix';
import {PlcHardwareWorkspace} from './PlcHardwareWorkspace';
import {BusTopologyWorkspace} from './BusTopologyWorkspace';
import {KnxRouterWorkspace} from './KnxRouterWorkspace';

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
assert.equal(instantiated.channels[0].address, '%I0.0');
assert.equal(instantiated.channels[7].address, '%I0.7');

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

console.log('✓ PlcAutomation.test.ts: All templates, rack visualization, signal matrix and 3 workspaces validated successfully');
