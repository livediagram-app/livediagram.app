// @vitest-environment jsdom

// A diagram's snapshot thumbnail (docs/specs/006-diagram/diagram-snapshots.md): fetched once in view,
// shown when it lands, and a new version never shows the previous one's (revoked) image.

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiagramThumbnail } from './DiagramThumbnail';

type Result = { url: string; backgroundColor: string | null } | null;
const pending: ((r: Result) => void)[] = [];
vi.mock('@/lib/api-client', () => ({
  apiFetchDiagramThumbnailUrl: () => new Promise<Result>((resolve) => pending.push(resolve)),
}));

beforeAll(() => {
  // Everything is in view at once.
  globalThis.IntersectionObserver = class {
    private cb: IntersectionObserverCallback;
    constructor(cb: IntersectionObserverCallback) {
      this.cb = cb;
    }
    observe() {
      this.cb([{ isIntersecting: true } as IntersectionObserverEntry], this as never);
    }
    disconnect() {}
    unobserve() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
  URL.revokeObjectURL = vi.fn();
});
beforeEach(() => {
  pending.length = 0;
});
afterEach(() => cleanup());

const thumb = (version: number) => (
  <DiagramThumbnail ownerId="me" diagramId="d1" version={version} />
);
const img = () => document.querySelector('img');

describe('DiagramThumbnail', () => {
  it('shows the snapshot once it lands', async () => {
    render(thumb(1));
    expect(img()).toBeNull();
    await act(async () => pending[0]!({ url: 'blob:one', backgroundColor: '#fff' }));
    expect(img()?.getAttribute('src')).toBe('blob:one');
  });

  it('drops the previous image while a new version loads', async () => {
    const { rerender } = render(thumb(1));
    await act(async () => pending[0]!({ url: 'blob:one', backgroundColor: null }));
    rerender(thumb(2));
    expect(img()).toBeNull();
    await act(async () => pending[1]!({ url: 'blob:two', backgroundColor: null }));
    expect(img()?.getAttribute('src')).toBe('blob:two');
  });

  it('captions a diagram with no snapshot', async () => {
    const { container } = render(thumb(1));
    await act(async () => pending[0]!(null));
    expect(img()).toBeNull();
    expect(container.textContent).not.toBe('');
  });
});
