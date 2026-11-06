import assert from 'node:assert/strict';
import { fixture, add } from '../layout/testing/fixture';
import { inspectElectricalProject } from './ElectricalInspection';
import {
  inspectionTasks,
  filterInspectionTasks,
  InspectionWorkflowPlan,
  findingFingerprint,
} from './InspectionWorkflow';
import { ProjectHistory } from './ProjectHistory';
import { handleInspectionReview } from '../ai/mcp-tools/inspectionReview';
const p = fixture(),
  a = add(p, 'a', 'contactor_coil');
const report = inspectElectricalProject(p),
  finding = report.messages.find((f) => f.ruleId === 'missing_article')!;
assert(finding);
assert(inspectionTasks(p, report).every((t) => t.change === 'uncompared'));
assert.throws(
  () =>
    new InspectionWorkflowPlan(p, {
      kind: 'status',
      ids: [finding.id],
      status: 'exception',
      reason: '',
    }),
  /worklistInvalid/,
);
const reviewed = new InspectionWorkflowPlan(p, {
  kind: 'status',
  ids: [finding.id],
  status: 'exception',
  reason: 'Manufacturer data requested',
}).apply(p);
assert.equal(
  inspectionTasks(reviewed).find((t) => t.finding.id === finding.id)?.status,
  'exception',
);
assert.deepEqual(
  inspectElectricalProject(reviewed).summary,
  report.summary,
  'Acknowledging a finding does not hide electrical errors',
);
assert.equal(
  findingFingerprint(p, { ...finding, message: 'Translated' }),
  findingFingerprint(p, finding),
);
const changed = structuredClone(reviewed);
changed.pages[0].components[0].functionText = 'Changed technical context';
const reopened = inspectionTasks(changed).find(
  (t) => t.finding.id === finding.id,
)!;
assert.equal(reopened.status, 'open');
assert(reopened.staleDecision);
const baseline = new InspectionWorkflowPlan(reviewed, {
  kind: 'baseline',
}).apply(reviewed);
assert(inspectionTasks(baseline).every((t) => t.change === 'existing'));
const after = structuredClone(baseline);
after.pages[0].components[0].articleNumber = 'A';
add(after, 'b', 'motor_3phase');
const tasks = inspectionTasks(after);
assert(
  tasks.some(
    (t) => t.finding.id === finding.id && !t.current && t.change === 'resolved',
  ),
);
assert(tasks.some((t) => t.current && t.change === 'new'));
assert(
  filterInspectionTasks(tasks, undefined, 'resolved').every((t) => !t.current),
);
assert(filterInspectionTasks(tasks).every((t) => t.current));
assert.throws(
  () =>
    new InspectionWorkflowPlan(after, {
      kind: 'status',
      ids: [finding.id],
      status: 'in_progress',
      reason: '',
    }),
  /worklistInvalid/,
);
const stale = new InspectionWorkflowPlan(p, { kind: 'baseline' });
assert.throws(() => stale.apply(changed), /articlesProjectStale/);
const history = new ProjectHistory();
history.reset(p);
history.record(reviewed);
assert.deepEqual(history.undo(), p);
assert.deepEqual(history.redo(), reviewed);
const manager = { getProject: () => after } as any;
const api = await handleInspectionReview({ change: 'resolved' }, manager);
assert.equal(
  api.matchingFindings,
  filterInspectionTasks(tasks, undefined, 'resolved').length,
);
assert.deepEqual(api.summary, inspectElectricalProject(after).summary);
await assert.rejects(() =>
  handleInspectionReview({ taskStatus: 'hide_errors' }, manager),
);
assert.equal(
  JSON.parse(JSON.stringify(reviewed)).inspectionWorkflow.decisions[0].reason,
  'Manufacturer data requested',
);
console.log(
  '✓ Persistent inspection worklist: reasoned exceptions, evidence-bound reopening, explicit baseline, new/no-longer-reported comparison, unchanged raw inspection, MCP parity, serialization and undo',
);
