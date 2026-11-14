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

  // Work Tracker 765: an editor's own flags (liveplanner's githubEnabled, livediagram's aiEnabled), each true only on
  // an exact true.
  it('answers the flags an editor names, false until the api says true', async () => {
    const useCapabilities = createCapabilities(
      async () => ({ emailEnabled: true, githubEnabled: true }),
      ['githubEnabled', 'aiEnabled'],
    );
    const off = renderHook(() => useCapabilities(false));
    expect(off.result.current).toEqual({
      emailEnabled: false,
      githubEnabled: false,
      aiEnabled: false,
    });
    const { result } = renderHook(() => useCapabilities());
    await waitFor(() =>
      expect(result.current).toEqual({ emailEnabled: true, githubEnabled: true, aiEnabled: false }),
    );
  });
});
