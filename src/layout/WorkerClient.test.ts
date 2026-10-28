import assert from 'node:assert/strict';
import { runLayoutWorker } from './WorkerClient';
import { solveLayouts } from './engine';
import { snapshotPage } from './geometry';
import { fixture, add } from './testing/fixture';
import { previewLayout } from './service';
import { clone, type LayoutSnapshot, type LayoutSolution } from './types';
class TestWorker {
  onmessage: any = null;
  onerror: any = null;
  onmessageerror: any = null;
  terminated = 0;
  constructor(public send: (s: LayoutSnapshot, w: TestWorker) => void = () => { }) { }
  postMessage(s: LayoutSnapshot) { this.send(s, this); }
  terminate() { this.terminated++; }
  message(data: any) { this.onmessage?.({ data }); }
}
const project = fixture();
add(project, 'load');
const snapshot = snapshotPage(project.pages[0], project);
const checkpoints: LayoutSolution[][] = [];
const solutions = await solveLayouts(snapshot, undefined, s => checkpoints.push(clone(s)));
assert.equal(checkpoints.length, 5);
assert.deepEqual(checkpoints.at(-1), solutions);
const good = solutions.find(s => s.report.valid)!;
assert(good);
const source = JSON.stringify(snapshot);
const completed = JSON.stringify(good);
const partial = new TestWorker((_s, w) => w.message({ progress: [good] }));
const retained = await runLayoutWorker(partial as any, snapshot, 10);
assert.equal(partial.terminated, 1);
assert(retained[0].report.valid);
assert.deepEqual(retained[0].snapshot, good.snapshot);
assert(retained[0].report.issues.some(i => i.type === 'layout_timeout' && i.severity === 'warning'));
assert.equal(JSON.stringify(good), completed, 'Checkpoint objects are immutable');
const silent = new TestWorker();
const failed = await runLayoutWorker(silent as any, snapshot, 10);
assert.equal(failed[0].report.valid, false);
assert(failed[0].report.issues.some(i => i.type === 'layout_timeout' && i.severity === 'error'));
assert.equal(JSON.stringify(snapshot), source, 'A timeout must not poison the source for multi-sheet fallback');
assert.equal(silent.terminated, 1);
const normal = new TestWorker((_s, w) => { w.message({ progress: [] }); w.message({ solutions }); });
assert.deepEqual(await runLayoutWorker(normal as any, snapshot, 10), solutions);
const broken = new TestWorker((_s, w) => { w.message({ progress: [good] }); w.onerror(); });
await assert.rejects(runLayoutWorker(broken as any, snapshot, 10), /fehlgeschlagen/);
const malformed = new TestWorker((_s, w) => w.message({ unexpected: true }));
await assert.rejects(runLayoutWorker(malformed as any, snapshot, 10), /Ungültige Antwort/);
console.log('✓ Partial worker results survive timeout; empty timeouts stay invalid; real worker/protocol failures are reported');
// A first-attempt timeout must reach the existing checked multi-sheet fallback.
const multi = fixture();
add(multi, 'one');
add(multi, 'two');
multi.pages[0].groups = ['one', 'two'].map(id => ({ id: 'g-' + id, members: [{ kind: 'component' as const, id }] }));
const original = JSON.stringify(multi);
const realWorker = globalThis.Worker, realTimer = globalThis.setTimeout;
let created = 0, timers = 0;
class FallbackWorker extends TestWorker {
  constructor() {
    const index = ++created;
    super((s, w) => {
      if (index === 1)
        return;
      queueMicrotask(async () => {
        const ctor = globalThis.Worker;
        delete (globalThis as any).Worker;
        try {
          w.message({ solutions: await solveLayouts(s) });
        }
        finally {
          (globalThis as any).Worker = ctor;
        }
      });
    });
  }
}
try {
  (globalThis as any).Worker = FallbackWorker;
  (globalThis as any).setTimeout = (fn: any, ms: number, ...args: any[]) => realTimer(fn, ms === 15000 && ++timers === 1 ? 10 : ms, ...args);
  const preview = await previewLayout(multi, 'p');
  assert.equal(preview.status, 'preview_ready');
  assert.equal(preview.candidates[0].multiPage?.pages.length, 2);
  assert.equal(JSON.stringify(multi), original);
  assert(created >= 3);
}
finally {
  if (realWorker)
    (globalThis as any).Worker = realWorker;
  else
    delete (globalThis as any).Worker;
  globalThis.setTimeout = realTimer;
}
console.log('✓ Timed-out first attempt still produces an independently validated multi-sheet preview without changing the project');
