// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useImageBlobUrl } from './useImageBlobUrl';

const apiFetchImageBlobUrl = vi.fn<(ownerId: string, imageId: string) => Promise<string | null>>();
vi.mock('@/lib/api-client', () => ({
  apiFetchImageBlobUrl: (ownerId: string, imageId: string) => apiFetchImageBlobUrl(ownerId, imageId),
}));

const revoked: string[] = [];
beforeEach(() => {
  URL.revokeObjectURL = (url: string) => void revoked.push(url);
});
afterEach(() => {
  vi.clearAllMocks();
  revoked.length = 0;
});

describe('useImageBlobUrl', () => {
  it('is idle without an image', () => {
    expect(renderHook(() => useImageBlobUrl('u', null)).result.current).toEqual({ status: 'idle' });
  });

  it('uses an embedded data URI as is (docs/specs/006-diagram/offline-mode.md)', () => {
    const { result } = renderHook(() => useImageBlobUrl('u', 'data:image/png;base64,AA'));
    expect(result.current).toEqual({ status: 'ready', src: 'data:image/png;base64,AA' });
    expect(apiFetchImageBlobUrl).not.toHaveBeenCalled();
  });

  it('loads, then is ready with the blob URL, revoked on unmount', async () => {
    apiFetchImageBlobUrl.mockResolvedValue('blob:1');
    const { result, unmount } = renderHook(() => useImageBlobUrl('u', 'img1'));
    expect(result.current).toEqual({ status: 'loading' });
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', src: 'blob:1' }));
    unmount();
    expect(revoked).toEqual(['blob:1']);
  });

  it('is broken when the fetch finds nothing or fails', async () => {
    apiFetchImageBlobUrl.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('503'));
    const gone = renderHook(() => useImageBlobUrl('u', 'img-gone'));
    await waitFor(() => expect(gone.result.current).toEqual({ status: 'broken' }));
    const failed = renderHook(() => useImageBlobUrl('u', 'img-fail'));
    await waitFor(() => expect(failed.result.current).toEqual({ status: 'broken' }));
  });

  it('shows loading, never the previous image, as soon as the image changes', async () => {
    apiFetchImageBlobUrl.mockResolvedValueOnce('blob:a').mockResolvedValueOnce('blob:b');
    const { result, rerender } = renderHook(({ id }) => useImageBlobUrl('u', id), {
      initialProps: { id: 'a' as string | null },
    });
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', src: 'blob:a' }));
    rerender({ id: 'b' });
    expect(result.current).toEqual({ status: 'loading' });
    expect(revoked).toEqual(['blob:a']);
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', src: 'blob:b' }));
    rerender({ id: null });
    expect(result.current).toEqual({ status: 'idle' });
  });
});
