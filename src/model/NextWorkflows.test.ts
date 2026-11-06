import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { fixture, add } from '../layout/testing/fixture';
import { DeviceNavigatorPlan, deviceNavigator } from './DeviceNavigator';
import {
  WiringEditPlan,
  inspectWiring,
  cableSchedule,
} from './WiringManagement';
import { ProjectHistory } from './ProjectHistory';
import { ProjectIndex } from './ProjectIndex';
import { ElectricalNetService } from './ElectricalNetService';
import { TerminalDiagramGenerator } from '../reports/TerminalDiagram';
import { inspectElectricalProject } from './ElectricalInspection';
import { functionType } from './FunctionDefinitions';
import { getSymbolById } from './symbols';
import { TeamSyncPlan, teamUrl, type TeamSnapshot } from './TeamCatalog';
import {
  validateCatalogArticle,
  ArticleCatalog,
  catalogRevision,
} from './ArticleCatalog';
const p = fixture(),
  a = add(p, 'a', 'terminal_single'),
  b = add(p, 'b', 'terminal_single', 100, 30),
  load = add(p, 'load', 'contactor_coil', 200, 60);
a.bmk = '-X1:1';
b.bmk = '-X1:2';
p.pages[0].wires.push({
  id: 'w',
  from: { componentId: b.id, pinId: '2' },
  to: { componentId: load.id, pinId: 'A1' },
  potential: 'Signal',
});
p.pages[0].cables = [
  {
    id: 'cable',
    bmk: '-W1',
    cableType: 'Test',
    crossSection: '1.5',
    coreCount: 3,
    start: { x: 0, y: 0 },
    end: { x: 100, y: 0 },
    cores: [{ id: 'core1', t: 0.5, designation: '1', wireIds: ['w'] }],
  },
];
const original = structuredClone(p),
  plan = new DeviceNavigatorPlan(p, {
    kind: 'save',
    device: {
      id: 'planned',
      plant: 'A',
      location: 'S',
      bmk: '-K2',
      description: 'Future device',
      items: [],
    },
  }),
  planned = plan.apply(p);
assert.equal(
  deviceNavigator(planned).filter((d) => d.state === 'unplaced').length,
  1,
);
assert.deepEqual(p, original);
const placed = new DeviceNavigatorPlan(planned, {
  kind: 'allocate',
  id: 'planned',
  target: { pageId: 'p', componentId: 'load' },
}).apply(planned);
assert.equal(placed.pages[0].components[2].bmk, '-K2');
assert(!deviceNavigator(placed).some((d) => d.state === 'unplaced'));
assert.equal(placed.pages[0].components[2].x, load.x);
const history = new ProjectHistory();
history.reset(planned);
history.record(placed);
assert.deepEqual(history.undo(), planned);
assert.deepEqual(history.redo(), placed);
assert.throws(
  () =>
    new DeviceNavigatorPlan(planned, {
      kind: 'save',
      device: { ...planned.plannedDevices![0], id: 'other' },
    }),
  /deviceDuplicate/,
);
const bridge = new WiringEditPlan(p, {
  kind: 'bridge',
  from: { pageId: 'p', componentId: a.id, pinId: '2' },
  to: { pageId: 'p', componentId: b.id, pinId: '1' },
  bridgeType: 'plug',
}).apply(p);
const index = new ProjectIndex(bridge),
  nets = new ElectricalNetService(index);
assert.equal(
  nets.netForPin(index.pin(index.component(a.id)!, '1')!)?.id,
  nets.netForPin(index.pin(index.component(load.id)!, 'A1')!)?.id,
);
assert(
  TerminalDiagramGenerator.generateTerminalReport(bridge)
    .get('-X1')![0]
    .functionText.includes('Brücke'),
);
assert.throws(
  () =>
    new WiringEditPlan(bridge, {
      kind: 'bridge',
      from: { pageId: 'p', componentId: a.id, pinId: '2' },
      to: { pageId: 'p', componentId: b.id, pinId: '1' },
      bridgeType: 'wire',
    }),
  /wiringAlreadyConnected/,
);
const removed = new WiringEditPlan(bridge, {
  kind: 'remove_bridge',
  id: bridge.logicalConnections![0].id,
}).apply(bridge);
assert.equal(removed.logicalConnections!.length, 0);
assert.deepEqual(
  removed.pages,
  p.pages,
  'Bridge edits never redraw page wires or symbols',
);
const constrained = structuredClone(p);
constrained.pages[0].components[0].pins['2'].potentialConstraint = 'L1';
constrained.pages[0].components[1].pins['1'].potentialConstraint = 'L2';
assert.throws(
  () =>
    new WiringEditPlan(constrained, {
      kind: 'bridge',
      from: { pageId: 'p', componentId: a.id, pinId: '2' },
      to: { pageId: 'p', componentId: b.id, pinId: '1' },
      bridgeType: 'plug',
    }),
  /wiringPotentialConflict/,
);
const terminal = new WiringEditPlan(p, {
  kind: 'terminal',
  target: { pageId: 'p', componentId: a.id },
  settings: {
    strip: '-X1',
    number: '2',
    level: 'upper',
    pinSides: { '1': 'external', '2': 'internal' },
  },
}).apply(p);
assert(
  !inspectWiring(terminal).some((i) => i.code === 'terminal_number_duplicate'),
);
assert(
  TerminalDiagramGenerator.generateTerminalReport(terminal)
    .get('-X1')!
    .some((t) => t.terminalNumber === '2/upper'),
);
const duplicate = structuredClone(terminal);
duplicate.pages[0].components[1].terminal = {
  strip: '-X1',
  number: '2',
  level: 'upper',
  pinSides: {},
};
assert(
  inspectElectricalProject(duplicate).messages.some(
    (i) => i.ruleId === 'terminal_number_duplicate',
  ),
);
assert(inspectWiring(p).some((i) => i.code === 'cable_count_mismatch'));
const reserves = new WiringEditPlan(p, {
  kind: 'reserves',
  pageId: 'p',
  cableId: 'cable',
}).apply(p);
assert.equal(reserves.pages[0].cables![0].cores.length, 3);
assert(
  reserves.pages[0]
    .cables![0].cores.slice(1)
    .every((c) => c.reserve && !c.wireIds?.length),
);
assert(
  !inspectWiring(reserves).some(
    (i) =>
      i.code === 'cable_core_unassigned' || i.code === 'cable_count_mismatch',
  ),
);
assert(cableSchedule(reserves)[0].targets.some((s) => s.includes('load')));
assert.throws(
  () =>
    new WiringEditPlan(p, {
      kind: 'core',
      pageId: 'p',
      cableId: 'cable',
      coreId: 'core1',
      designation: '1',
      color: 'BK',
      crossSection: '1.5',
      reserve: true,
      wireIds: ['w'],
    }),
  /wiringInvalid/,
);
const stale = structuredClone(p);
stale.pages[0].title = 'changed';
assert.throws(
  () =>
    new WiringEditPlan(p, {
      kind: 'reserves',
      pageId: 'p',
      cableId: 'cable',
    }).apply(stale),
  /articlesProjectStale/,
);
assert.equal(functionType(getSymbolById('contactor_coil', p)!), 'relay_coil');
const old = { ...getSymbolById('contact_no', p)! };
delete old.functionDefinition;
assert.equal(functionType(old), 'contact_no');
old.source = { library: 'CUSTOM', number: 1, variant: 0 };
assert.equal(functionType(old), undefined);
const article = (description: string) =>
  validateCatalogArticle({
    articleNumber: 'A',
    manufacturer: 'ACME',
    variant: '',
    description,
    origin: 'user',
    verification: 'unverified',
  });
const remote = (articles = [article('base')], revision = 1): TeamSnapshot => ({
  schema: 'schematico-team-catalog',
  version: 1,
  teamId: 'team',
  user: { id: 'u', role: 'editor' },
  revision,
  articles,
});
const base = { revision: 1, base: [article('base')] },
  conflict = new TeamSyncPlan(
    [article('local')],
    remote([article('remote')], 2),
    base,
  );
assert(conflict.rows[0].conflict);
assert.throws(() => conflict.result(), /teamResolveConflicts/);
assert.equal(
  conflict.result({ [conflict.rows[0].key]: 'remote' }).local[0].description,
  'remote',
);
assert.equal(
  conflict.result({ [conflict.rows[0].key]: 'local' }).remote[0].description,
  'local',
);
const deleted = new TeamSyncPlan([article('base')], remote([], 2), base);
assert.equal(deleted.result().local.length, 0);
const deleteConflict = new TeamSyncPlan(
  [article('edited')],
  remote([], 2),
  base,
);
assert(deleteConflict.rows[0].conflict);
assert.equal(
  deleteConflict.result({ [deleteConflict.rows[0].key]: 'local' }, true).remote
    .length,
  0,
);
assert.throws(() => teamUrl('http://example.com'), /teamUrlInvalid/);
assert.throws(
  () => teamUrl('https://user:password@example.com'),
  /teamUrlInvalid/,
);
assert.equal(teamUrl('https://example.com/'), 'https://example.com');
const store = new ArticleCatalog();
await store.merge([article('old')], false, catalogRevision([]));
await store.replaceForSync(
  [article('new')],
  catalogRevision(await store.list()),
  'test',
  { revision: 2, base: [article('new')] },
);
assert.equal((await store.syncState('test'))!.revision, 2);
assert.equal((await store.list())[0].description, 'new');
await assert.rejects(
  () =>
    store.replaceForSync([], catalogRevision([]), 'test', {
      revision: 3,
      base: [],
    }),
  /articlesCatalogStale/,
);
assert.equal((await store.syncState('test'))!.revision, 2);
console.log(
  '✓ Planned device lifecycle, exact navigation, bridge topology/constraint checks, terminal levels/sides, reserves, shared findings, function metadata, 3-way sync/deletion conflicts and atomic catalog state',
);

const checked = { ...article('base'), verification: 'user_checked' as const };
const checkedBase = {
  revision: 1,
  base: [article('base')],
  localBase: [checked],
};
const peerChange = new TeamSyncPlan(
  [checked],
  remote([article('peer change')], 2),
  checkedBase,
);
assert(!peerChange.rows.some((r) => r.conflict));
assert.equal(peerChange.result().local[0].description, 'peer change');
const pendingPull = new TeamSyncPlan(
  [article('local pending')],
  remote(),
  base,
).result({}, true);
assert.equal(pendingPull.localBase[0].description, 'base');
assert.equal(
  new TeamSyncPlan(pendingPull.local, remote(), {
    revision: 1,
    base: base.base,
    localBase: pendingPull.localBase,
  }).result().remote[0].description,
  'local pending',
);
assert.throws(
  () =>
    new WiringEditPlan(p, {
      kind: 'terminal',
      target: { pageId: 'p', componentId: a.id },
      settings: { strip: '-X1', number: '2', level: '', pinSides: {} },
    }),
  /wiringDuplicate/,
);
const unsaved = { ...planned.plannedDevices![0], description: 'not saved' };
assert.throws(
  () =>
    new DeviceNavigatorPlan(planned, {
      kind: 'allocate',
      id: 'planned',
      target: { pageId: 'p', componentId: 'load' },
      expected: unsaved,
    }),
  /deviceSaveFirst/,
);
