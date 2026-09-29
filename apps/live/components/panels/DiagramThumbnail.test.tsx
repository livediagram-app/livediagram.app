// @vitest-environment jsdom

// A diagram's snapshot thumbnail (docs/specs/006-diagram/diagram-snapshots.md): fetched once in view,
// shown when it lands, and a new version never shows the previous one's (revoked) image.

import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiagramThumbnail } from './DiagramThumbnail';
import { resetThumbnailCache } from '@/lib/thumbnail-cache';

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
  resetThumbnailCache();
});
afterEach(() => cleanup());

const thumb = (version: number) => (
  <DiagramThumbnail ownerId="me" diagramId="d1" version={version} />
);
const img = () => document.querySelector('img');
const loader = () => document.querySelector('[data-testid="thumbnail-loader"]');

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

  it('crossfades from the loader once the snapshot has decoded, then drops the loader', async () => {
    vi.useFakeTimers();
    try {
      render(thumb(1));
      expect(loader()).not.toBeNull();
      await act(async () => pending[0]!({ url: 'blob:one', backgroundColor: null }));
      // Fetched but not yet decoded: the picture waits, invisible, behind
      // the loader, so there is never a blank frame between the two.
      expect(img()?.className).toContain('opacity-0');
      expect(loader()).not.toBeNull();
      fireEvent.load(img()!);
      expect(img()?.className).toContain('opacity-100');
      expect(loader()).not.toBeNull();
      act(() => vi.advanceTimersByTime(250));
      expect(loader()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the still placeholder, not the loader, for a diagram with no snapshot', async () => {
    render(thumb(1));
    await act(async () => pending[0]!(null));
    expect(loader()).toBeNull();
    expect(document.body.textContent).toContain('Nothing drawn yet');
  });

  it('paints a remount straight from the cache without refetching', async () => {
    const first = render(thumb(1));
    await act(async () => pending[0]!({ url: 'blob:one', backgroundColor: null }));
    first.unmount();
    render(thumb(1));
    expect(img()?.getAttribute('src')).toBe('blob:one');
    // No crossfade from a loader that was never needed.
    expect(img()?.className).toContain('opacity-100');
    expect(loader()).toBeNull();
    expect(pending).toHaveLength(1);
  });

  it('fetches once for two thumbnails of the same diagram', async () => {
    render(
      <>
        {thumb(1)}
        {thumb(1)}
      </>,
    );
    expect(pending).toHaveLength(1);
    await act(async () => pending[0]!({ url: 'blob:one', backgroundColor: null }));
    expect(document.querySelectorAll('img')).toHaveLength(2);
  });
});
