import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '@livedocuments/document';
import type { PageTidyCheckRequest, PageTidyCheckResponse } from './page-tidy-check-protocol';

// docs/specs/007-editor/pages-mode.md "Tidy": the Tidy check worker's side.
afterEach(() => vi.unstubAllGlobals());

const box = (id: string, x: number, y: number) =>
  ({ id, type: 'shape', shape: 'square', x, y, width: 100, height: 80 }) as Element;
const input = (ids: string[]) => ({
  ids: new Set(ids),
  rect: { x: -397, y: -561.5, width: 794, height: 1123 },
  margin: 56,
  lockedIds: new Set<string>(),
});

describe('the Tidy check worker', () => {
  it('answers each check by its id, true when a Tidy would change the page', async () => {
    const posted: PageTidyCheckResponse[] = [];
    let onMessage: (e: { data: PageTidyCheckRequest }) => void = () => {};
    vi.stubGlobal('self', {
      postMessage: (m: PageTidyCheckResponse) => posted.push(m),
      addEventListener: (_: 'message', fn: typeof onMessage) => (onMessage = fn),
    });
    vi.resetModules();
    await import('./page-tidy-check.worker');
    onMessage({
      data: {
        id: 3,
        elements: [box('a', -200, -300), box('b', -188, -100)],
        input: input(['a', 'b']),
      },
    });
    onMessage({ data: { id: 4, elements: [box('a', -341, -305.5)], input: input(['a']) } });
    expect(posted).toEqual([
      { id: 3, can: true },
      { id: 4, can: false },
    ]);
  });
});
