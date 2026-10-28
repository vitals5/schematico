import ELK from 'elkjs/lib/elk-api';
import ElkWorker from 'elkjs/lib/elk-worker.min.js?worker';
import { solveLayouts } from './engine';
import type { LayoutSnapshot } from './types';
self.onmessage = async (event: MessageEvent<LayoutSnapshot>) => {
  try {
    const solutions = await solveLayouts(
      event.data,
      () => new ELK({ workerFactory: () => new ElkWorker() }),
      progress => self.postMessage({progress}),
    );
    self.postMessage({ solutions });
  } catch (e) {
    self.postMessage({ error: e instanceof Error ? e.message : String(e) });
  }
};
