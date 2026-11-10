// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// docs/specs/007-editor/pages-mode.md "Image backgrounds", Blur: the sheet's blurred copy.

const { acquire, release } = vi.hoisted(() => {
  const release = vi.fn();
  const acquire = vi.fn((src: string, _page: unknown, sigma: number) => ({
    url: Promise.resolve(`blob:${src}:${sigma}`),
    release,
  }));
  return { acquire, release };
});
vi.mock('@/lib/page-image-blur', () => ({ acquireBlurredImage: acquire }));

const { useBlurredPageImage, BLUR_SETTLE_MS } = await import('./useBlurredPageImage');

const page = { width: 1920, height: 1080 };

afterEach(() => {
  acquire.mockClear();
  release.mockClear();
  vi.useRealTimers();
});

describe('useBlurredPageImage', () => {
  it('asks for nothing without a picture or a blur', () => {
    const none = renderHook(() => useBlurredPageImage(undefined, page, 10));
    const sharp = renderHook(() => useBlurredPageImage('a', page, 0));
    expect(none.result.current).toBeNull();
    expect(sharp.result.current).toBeNull();
    expect(acquire).not.toHaveBeenCalled();
  });

  it('shows the copy once made, the next strength after the slider settles, and lets go on unmount', async () => {
    vi.useFakeTimers();
    const hook = renderHook(({ sigma }) => useBlurredPageImage('a', page, sigma), {
      initialProps: { sigma: 10 },
    });
    await act(async () => {});
    expect(hook.result.current).toBe('blob:a:10');
    hook.rerender({ sigma: 12 });
    hook.rerender({ sigma: 14 });
    // The old copy shows meanwhile, and no copy is made per step.
    expect(hook.result.current).toBe('blob:a:10');
    expect(acquire).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(BLUR_SETTLE_MS);
    });
    expect(acquire).toHaveBeenCalledTimes(2);
    expect(hook.result.current).toBe('blob:a:14');
    hook.unmount();
    expect(release).toHaveBeenCalledTimes(2);
  });
});
