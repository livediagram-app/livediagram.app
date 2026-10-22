// @vitest-environment jsdom
// docs/specs/031-photo/photo-pages.md "The Photo panel": the histogram shows as the panel opens, and is worked out
// again a moment after each change.
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { solid } from '@/lib/photo-editor/photo-test-utils';
import { photoView } from './photo-view-test-utils';
import { HISTOGRAM_DELAY_MS, usePhotoHistogram } from './usePhotoHistogram';

vi.mock('@/lib/photo-editor/preview', () => ({
  previewRaster: vi.fn(() => Promise.resolve(solid(4, 4, [200, 100, 50, 255]))),
}));

afterEach(() => vi.useRealTimers());

describe('the photo histogram', () => {
  it('is worked out at once the first time, then after the delay', async () => {
    vi.useFakeTimers();
    const { view } = photoView();
    const { result, rerender } = renderHook(({ v }) => usePhotoHistogram(v), {
      initialProps: { v: view },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current).not.toBeNull();
    const first = result.current;
    rerender({ v: { ...view, version: 1 } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(HISTOGRAM_DELAY_MS - 50);
    });
    expect(result.current).toBe(first);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(result.current).not.toBe(first);
  });
});
