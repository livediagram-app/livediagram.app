// Whether a Tidy would change a page (docs/specs/007-editor/pages-mode.md "Tidy"): asked of a worker where one starts,
// so the page's Tidy button is decided off the main thread, and answered on the page otherwise (no Worker, as in tests,
// or one that fails to start or load).
import type { Element } from '@livedocuments/document';
import { tidyPageElements, type PageTidyInput } from '../page-tidy';
import type { PageTidyCheckRequest, PageTidyCheckResponse } from './page-tidy-check-protocol';

type WorkerLike = {
  postMessage(message: PageTidyCheckRequest): void;
  addEventListener(type: 'message', fn: (e: MessageEvent<PageTidyCheckResponse>) => void): void;
  addEventListener(type: 'error', fn: (e: Event) => void): void;
  terminate(): void;
};

export type PageTidyChecker = {
  /** Whether a Tidy would change the page: at once (true or false) on the page, or later through `done` from the
   *  worker (undefined now). */
  check(
    elements: Element[],
    input: PageTidyInput,
    done: (can: boolean) => void,
  ): boolean | undefined;
};

const newWorker = (): WorkerLike =>
  new Worker(new URL('./page-tidy-check.worker.ts', import.meta.url), { type: 'module' });

const onPage = (elements: Element[], input: PageTidyInput) =>
  tidyPageElements(elements, input) !== elements;

export function pageTidyChecker(
  createWorker: (() => WorkerLike) | null = typeof Worker === 'undefined' ? null : newWorker,
): PageTidyChecker {
  // Started on the first check; gone for good after a failure, when every check (those waiting too) runs on the page.
  let worker: WorkerLike | null = null;
  let failed = createWorker === null;
  let next = 0;
  const waiting = new Map<
    number,
    { elements: Element[]; input: PageTidyInput; done: (can: boolean) => void }
  >();
  const fail = () => {
    failed = true;
    worker?.terminate();
    worker = null;
    const left = [...waiting.values()];
    waiting.clear();
    for (const w of left) w.done(onPage(w.elements, w.input));
  };
  const start = (): WorkerLike | null => {
    if (worker || failed) return worker;
    try {
      const w = createWorker!();
      w.addEventListener('message', ({ data }) => {
        const w = waiting.get(data.id);
        waiting.delete(data.id);
        w?.done(data.can);
      });
      w.addEventListener('error', fail);
      worker = w;
    } catch {
      failed = true;
    }
    return worker;
  };
  return {
    check(elements, input, done) {
      const w = start();
      if (!w) return onPage(elements, input);
      const id = ++next;
      waiting.set(id, { elements, input, done });
      try {
        w.postMessage({ id, elements, input });
      } catch {
        // Something in the page that cannot be cloned: this one is answered here.
        waiting.delete(id);
        return onPage(elements, input);
      }
      return undefined;
    },
  };
}
