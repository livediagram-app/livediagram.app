import { describe, expect, it, vi } from 'vitest';
import type { Element } from '@livedocuments/document';
import type { PageTidyInput } from '../page-tidy';
import { pageTidyChecker } from './page-tidy-checker';
import type { PageTidyCheckRequest, PageTidyCheckResponse } from './page-tidy-check-protocol';

// docs/specs/007-editor/pages-mode.md "Tidy": whether a Tidy would change a page, asked of a worker, else on the page.
// Page 1 (A4 portrait) spans x -397..397; a box off its left margin line is untidy.
const box = (id: string, x: number, y: number) =>
  ({ id, type: 'shape', shape: 'square', x, y, width: 100, height: 80 }) as Element;
const messy = [box('a', -200, -300), box('b', -188, -100)];
const input: PageTidyInput = {
  ids: new Set(['a', 'b']),
  rect: { x: -397, y: -561.5, width: 794, height: 1123 },
  margin: 56,
  lockedIds: new Set(),
};

function fakeWorker() {
  const posted: PageTidyCheckRequest[] = [];
  const on: {
    message?: (e: MessageEvent<PageTidyCheckResponse>) => void;
    error?: (e: Event) => void;
  } = {};
  const worker = {
    postMessage: vi.fn((m: PageTidyCheckRequest) => posted.push(m)),
    addEventListener: (type: 'message' | 'error', fn: never) => (on[type] = fn),
    terminate: vi.fn(),
  };
  const reply = (id: number, can: boolean) =>
    on.message!({ data: { id, can } } as MessageEvent<PageTidyCheckResponse>);
  return { worker, posted, reply, error: () => on.error!(new Event('error')) };
}

describe('the Tidy checker', () => {
  it('answers on the page with no worker', () => {
    const done = vi.fn();
    expect(pageTidyChecker(null).check(messy, input, done)).toBe(true);
    expect(
      pageTidyChecker(null).check(
        [box('a', -341, -305.5)],
        { ...input, ids: new Set(['a']) },
        done,
      ),
    ).toBe(false);
    expect(done).not.toHaveBeenCalled();
  });

  it('asks the worker, started once, and passes each answer to its own check', () => {
    const f = fakeWorker();
    const create = vi.fn(() => f.worker);
    const checker = pageTidyChecker(create);
    const first = vi.fn();
    const second = vi.fn();
    expect(checker.check(messy, input, first)).toBeUndefined();
    expect(checker.check(messy, input, second)).toBeUndefined();
    expect(create).toHaveBeenCalledTimes(1);
    expect(f.posted.map((m) => m.id)).toEqual([1, 2]);
    f.reply(2, false);
    f.reply(1, true);
    // An answer for no check (already answered) is let go.
    f.reply(1, false);
    expect(first.mock.calls).toEqual([[true]]);
    expect(second.mock.calls).toEqual([[false]]);
  });

  it('answers what is waiting on the page when the worker fails, and every check after', () => {
    const f = fakeWorker();
    const checker = pageTidyChecker(() => f.worker);
    const waiting = vi.fn();
    checker.check(messy, input, waiting);
    f.error();
    expect(waiting.mock.calls).toEqual([[true]]);
    expect(f.worker.terminate).toHaveBeenCalled();
    expect(checker.check(messy, input, vi.fn())).toBe(true);
    expect(f.posted).toHaveLength(1);
  });

  it('answers on the page when the worker cannot start, or a check cannot be sent', () => {
    const throws = pageTidyChecker(() => {
      throw new Error('blocked');
    });
    expect(throws.check(messy, input, vi.fn())).toBe(true);
    const f = fakeWorker();
    f.worker.postMessage.mockImplementation(() => {
      throw new Error('DataCloneError');
    });
    const done = vi.fn();
    expect(pageTidyChecker(() => f.worker).check(messy, input, done)).toBe(true);
    f.reply(1, false);
    expect(done).not.toHaveBeenCalled();
  });
});
