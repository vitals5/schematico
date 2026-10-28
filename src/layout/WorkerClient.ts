import { clone, type LayoutSnapshot, type LayoutSolution } from './types';
type Port = Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror' | 'onmessageerror'>;
/** Keep completed, independently validated variants when a later variant runs out of time.
* A timed-out worker without a result is an unsuccessful attempt, not a reason to skip
* the normal multi-sheet fallback. Actual worker/protocol failures still reject. */
export function runLayoutWorker(worker: Port, snapshot: LayoutSnapshot, timeoutMs = 15000): Promise<LayoutSolution[]> {
  return new Promise((resolve, reject) => {
    let settled = false, completed: LayoutSolution[] = [];
    const finish = (solutions?: LayoutSolution[], error?: string) => {
      if (settled)
        return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      if (solutions)
        resolve(solutions);
      else
        reject(new Error(error));
    };
    const timer = setTimeout(() => {
      const message = 'Zeitbudget der Layoutvariante erreicht. Fertige Varianten bleiben erhalten; bei Bedarf wird eine weitere Blattaufteilung versucht.';
      if (completed.length) {
        finish(completed.map(s => ({ ...s, report: { ...s.report, issues: [...s.report.issues, { type: 'layout_timeout', severity: 'warning', objectIds: [snapshot.pageId], message }] } })));
      }
      else {
        const input = clone(snapshot);
        const issue = { type: 'layout_timeout', severity: 'error' as const, objectIds: [snapshot.pageId], message };
        input.issues.push(issue);
        finish([{ profile: 'readability', snapshot: input, report: { valid: false, issues: input.issues, metrics: { bodyOverlaps: 0, textOverlaps: 0, wireObstacles: 0, overflows: 0, crossings: 0, bends: 0, length: 0, displacement: 0 } } }]);
      }
    }, timeoutMs);
    worker.onmessage = e => {
      if (settled)
        return;
      if (Array.isArray(e.data?.progress))
        completed = e.data.progress;
      else if (Array.isArray(e.data?.solutions))
        finish(e.data.solutions);
      else
        finish(undefined, e.data?.error ?? 'Ungültige Antwort des Layout-Workers.');
    };
    worker.onerror = () => finish(undefined, 'Layout-Worker fehlgeschlagen.');
    worker.onmessageerror = () => finish(undefined, 'Layoutdaten konnten nicht übertragen werden.');
    try {
      worker.postMessage(snapshot);
    }
    catch (error) {
      finish(undefined, String(error));
    }
  });
}
