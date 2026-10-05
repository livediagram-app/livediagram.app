// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchImage = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiFetchCommunityImage: (...args: unknown[]) => fetchImage(...args),
}));

import { useModerationImage } from './useModerationImage';

const createObjectURL = vi.fn(() => 'blob:image-1');
const revokeObjectURL = vi.fn();

beforeEach(() => {
  fetchImage.mockReset();
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
});

afterEach(() => vi.unstubAllGlobals());

describe('useModerationImage', () => {
  it("fetches with the operator's session and releases the image when the card goes", async () => {
    fetchImage.mockResolvedValue(new Blob(['<svg/>'], { type: 'image/svg+xml' }));
    const { result, unmount } = renderHook(() => useModerationImage('user_op', 'CODE1'));
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe('blob:image-1'));
    expect(fetchImage).toHaveBeenCalledWith('user_op', 'CODE1');
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:image-1');
  });

  it('shows nothing without an image, a session, or when the fetch fails', async () => {
    fetchImage.mockResolvedValue(null);
    const none = renderHook(() => useModerationImage('user_op', 'CODE1'));
    await waitFor(() => expect(fetchImage).toHaveBeenCalled());
    expect(none.result.current).toBeNull();

    fetchImage.mockClear();
    renderHook(() => useModerationImage(null, 'CODE1'));
    expect(fetchImage).not.toHaveBeenCalled();

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchImage.mockRejectedValue(new Error('offline'));
    const failed = renderHook(() => useModerationImage('user_op', 'CODE2'));
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(failed.result.current).toBeNull();
    expect(createObjectURL).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
