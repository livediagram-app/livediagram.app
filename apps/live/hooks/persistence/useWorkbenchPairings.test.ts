// @vitest-environment jsdom
// Settings > API tokens' paired workbenches (docs/specs/013-workspace/blueprints/workbench-embeds.md
// "Settings > API tokens", WB46): one list read, grouped by token, and Unpair removing the row once it lands.
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { WorkbenchPairing } from '@livediagram/api-schema';
import { afterEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  apiListWorkbenchPairings: vi.fn(),
  apiUnpairWorkbench: vi.fn(),
}));
vi.mock('@/lib/api-client', () => api);

import { useWorkbenchPairings } from './useWorkbenchPairings';

const pairing = (id: string, tokenId: string): WorkbenchPairing => ({
  id,
  tokenId,
  origin: `https://${id}.example`,
  name: id,
  pairedAt: 1_000,
});
const A1 = pairing('a1', 'tokA');
const B1 = pairing('b1', 'tokB');
const A2 = pairing('a2', 'tokA');

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('useWorkbenchPairings', () => {
  it('reads nothing while disabled', () => {
    const { result } = renderHook(() => useWorkbenchPairings('user_1', { enabled: false }));
    expect(api.apiListWorkbenchPairings).not.toHaveBeenCalled();
    expect(result.current.forToken('tokA')).toEqual([]);
  });

  it('reads nothing without an owner', () => {
    renderHook(() => useWorkbenchPairings(null, { enabled: true }));
    expect(api.apiListWorkbenchPairings).not.toHaveBeenCalled();
  });

  it('lists once and groups by token, keeping the api’s order', async () => {
    api.apiListWorkbenchPairings.mockResolvedValue([A1, B1, A2]);
    const { result, rerender } = renderHook(() =>
      useWorkbenchPairings('user_1', { enabled: true }),
    );
    await waitFor(() => expect(result.current.forToken('tokA')).toEqual([A1, A2]));
    expect(result.current.forToken('tokB')).toEqual([B1]);
    expect(result.current.forToken('tokC')).toEqual([]);
    rerender();
    expect(api.apiListWorkbenchPairings).toHaveBeenCalledTimes(1);
    expect(api.apiListWorkbenchPairings).toHaveBeenCalledWith('user_1');
  });

  it('logs a list that fails and shows no pairings', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    api.apiListWorkbenchPairings.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useWorkbenchPairings('user_1', { enabled: true }));
    await waitFor(() => expect(warn).toHaveBeenCalledWith('[workbench] pairings-list-failed'));
    expect(result.current.forToken('tokA')).toEqual([]);
  });

  it('ignores a list that lands after unmount', async () => {
    let resolve!: (value: WorkbenchPairing[]) => void;
    api.apiListWorkbenchPairings.mockReturnValue(new Promise((r) => (resolve = r)));
    const { result, unmount } = renderHook(() => useWorkbenchPairings('user_1', { enabled: true }));
    unmount();
    await act(async () => resolve([A1]));
    expect(result.current.forToken('tokA')).toEqual([]);
  });

  it('unpairs, removing the row after success', async () => {
    api.apiListWorkbenchPairings.mockResolvedValue([A1, A2]);
    let done!: () => void;
    api.apiUnpairWorkbench.mockReturnValue(new Promise<void>((r) => (done = r)));
    const { result } = renderHook(() => useWorkbenchPairings('user_1', { enabled: true }));
    await waitFor(() => expect(result.current.forToken('tokA')).toHaveLength(2));

    let unpaired!: Promise<void>;
    act(() => {
      unpaired = result.current.unpair('a1');
    });
    expect(api.apiUnpairWorkbench).toHaveBeenCalledWith('user_1', 'a1');
    expect(result.current.forToken('tokA')).toEqual([A1, A2]);

    await act(async () => {
      done();
      await unpaired;
    });
    expect(result.current.forToken('tokA')).toEqual([A2]);
  });

  it('keeps the row and logs when Unpair fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    api.apiListWorkbenchPairings.mockResolvedValue([A1]);
    api.apiUnpairWorkbench.mockRejectedValue(new Error('500'));
    const { result } = renderHook(() => useWorkbenchPairings('user_1', { enabled: true }));
    await waitFor(() => expect(result.current.forToken('tokA')).toHaveLength(1));
    await act(() => result.current.unpair('a1'));
    expect(result.current.forToken('tokA')).toEqual([A1]);
    expect(warn).toHaveBeenCalledWith('[workbench] unpair-failed');
  });

  it('unpairs nothing without an owner', async () => {
    const { result } = renderHook(() => useWorkbenchPairings(null, { enabled: true }));
    await act(() => result.current.unpair('a1'));
    expect(api.apiUnpairWorkbench).not.toHaveBeenCalled();
  });
});
