// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createCapabilities } from './useCapabilities';

describe('createCapabilities', () => {
  it('reads the capabilities once, and only when enabled', async () => {
    const apiGetCapabilities = vi.fn(async () => ({ emailEnabled: true }));
    const useCapabilities = createCapabilities(apiGetCapabilities);
    const off = renderHook(() => useCapabilities(false));
    expect(off.result.current).toEqual({ emailEnabled: false });
    expect(apiGetCapabilities).not.toHaveBeenCalled();
    const { result } = renderHook(() => useCapabilities());
    await waitFor(() => expect(result.current).toEqual({ emailEnabled: true }));
  });

  it('fails closed on an answer without the feature', async () => {
    const useCapabilities = createCapabilities(async () => ({}));
    const { result } = renderHook(() => useCapabilities());
    await waitFor(() => expect(result.current).toEqual({ emailEnabled: false }));
  });
});
