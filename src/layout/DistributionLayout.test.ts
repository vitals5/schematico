import assert from 'node:assert/strict';
import { fixture } from './testing/fixture';
import { buildDraft } from './tools';
import { previewLayout, applyLayout } from './service';
import { auditMultiPage } from './multipage';
import { topology } from './types';
import { AutoconnectEngine } from '../model/AutoconnectEngine';
import { ProjectHistory } from '../model/ProjectHistory';
// Generated distribution: 24 devices, 44 conductors, eight functional groups.
// Models the timeout topology without including a user's project or diagnostic file.
const project = fixture(), components: any[] = [], connections: any[] = [], groups: any[] = [];
const add = (id: string, symbolId: string, functionText = id) => components.push({ id, symbolId, bmk: '-' + id, functionText });
const connect = (a: string, p: string, b: string, q: string, potential: string) => connections.push({ id: 'wire-' + connections.length, from: { componentId: a, pinId: p }, to: { componentId: b, pinId: q }, potential });
for (const phase of ['L1', 'L2', 'L3', 'N', 'PE'])
  add('in-' + phase, phase === 'PE' ? 'terminal_pe' : 'terminal_single', 'Incoming supply ' + phase);
add('R', 'rcd_4p', 'Residual current protection');
add('L', 'catalog_distribution_block_copper', 'Phase distribution');
add('N', 'catalog_distribution_block_neutral', 'Neutral distribution');
add('PE', 'catalog_distribution_block_pe', 'Protective conductor distribution');
groups.push({ id: 'incoming', members: ['L1', 'L2', 'L3', 'N', 'PE'].map(p => 'in-' + p) }, { id: 'protection', members: ['R'] }, { id: 'distribution', members: ['L', 'N', 'PE'] });
for (const [index, pin] of ['1', '3', '5', 'N_in'].entries())
  connect('in-' + ['L1', 'L2', 'L3', 'N'][index], '2', 'R', pin, ['L1', 'L2', 'L3', 'N'][index]);
connect('in-PE', '2', 'PE', 'PE-IN', 'PE');
for (let i = 0; i < 3; i++)
  connect('R', String(2 + i * 2), 'L', 'L' + (i + 1) + '-IN', 'L' + (i + 1));
connect('R', 'N_out', 'N', 'N-IN', 'N');
for (let i = 0; i < 5; i++) {
  const phase = 'L' + (i % 3 + 1), breaker = 'F' + i, a = 'socket-' + i + 'a', b = 'socket-' + i + 'b';
  add(breaker, 'catalog_mcb_1p_b', 'Branch circuit protection ' + i);
  add(a, 'catalog_socket_schuko', 'Socket outlet A');
  add(b, 'catalog_socket_schuko', 'Socket outlet B');
  groups.push({ id: 'branch-' + i, members: [breaker, a, b] });
  connect('L', phase + '.' + (Math.floor(i / 3) + 1), breaker, '1', phase);
  for (const socket of [a, b]) {
    connect(breaker, '2', socket, 'L', phase);
    connect('N', 'N' + (i + 1), socket, 'N', 'N');
    connect('PE', 'PE' + (i + 1), socket, 'PE', 'PE');
  }
}
assert.equal(components.length, 24);
assert.equal(connections.length, 44);
const args = { components, connections, groups }, draft = buildDraft(project, 'p', args), original = JSON.stringify(project), net = topology(draft);
const preview = await previewLayout(project, 'p', {}, draft);
assert.equal(preview.status, 'preview_ready');
assert.equal(JSON.stringify(project), original);
const candidate = preview.candidates[0];
if (candidate.multiPage)
  auditMultiPage(draft, 'p', candidate.multiPage);
const history = new ProjectHistory();
history.reset(project);
applyLayout(project, candidate, draft);
history.record(project);
if (!candidate.multiPage)
  assert.equal(topology(project), net);
assert(project.pages.flatMap(p => p.components).filter(c => components.some(x => 'ai-' + x.id === c.id)).length === 24);
for (const wire of connections)
  assert.equal(project.pages.flatMap(p => p.wires).filter(w => w.id === 'ai-' + wire.id).length, 1);
const checked = topology(project);
for (const page of project.pages)
  AutoconnectEngine.updatePageAutoconnections(page);
assert.equal(topology(project), checked);
assert.deepEqual(history.undo(), JSON.parse(original));
console.log('✓ Checked 24-device, 44-wire distribution preview, preserved groups/net graph, protected autoconnect and single-step undo');
