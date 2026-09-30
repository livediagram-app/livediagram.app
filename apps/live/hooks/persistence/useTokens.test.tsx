// @vitest-environment jsdom
// Two token controllers can be mounted at once (the Explorer's, for its
// timeline token menus, and the Settings token manager's): a revoke in one
// must refresh the other, or the timeline keeps offering Revoke on a token
// that is already gone (docs/specs/015-api/public-api-and-tokens.md).
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const api = vi.hoisted(() => ({
  apiListTokens: vi.fn(),
  apiCreateToken: vi.fn(),
  apiRevokeToken: vi.fn(),
}));
vi.mock('@/lib/api-client', () => api);

import { useTokens } from './useTokens';

const TOKEN = {
  id: 'tok1',
  name: 'CI',
  createdAt: 1,
  expiresAt: Date.now() + 1e9,
  lastUsedAt: null,
  readOnly: false,
};

describe('useTokens', () => {
  it('refreshes every mounted controller after a revoke in one of them', async () => {
    api.apiListTokens.mockResolvedValue([TOKEN]);
    api.apiRevokeToken.mockResolvedValue(undefined);
    const explorer = renderHook(() => useTokens('user_1', { enabled: true }));
    const settings = renderHook(() => useTokens('user_1', { enabled: true }));
    await waitFor(() => expect(explorer.result.current.list).toHaveLength(1));

    api.apiListTokens.mockResolvedValue([]);
    await act(() => settings.result.current.revoke('tok1'));
    await waitFor(() => expect(explorer.result.current.list).toEqual([]));
    expect(settings.result.current.list).toEqual([]);
  });

  it('never fetches for a guest, even when another controller changes', async () => {
    api.apiListTokens.mockClear();
    renderHook(() => useTokens(null, { enabled: false }));
    window.dispatchEvent(new Event('livediagram:tokens-changed'));
    expect(api.apiListTokens).not.toHaveBeenCalled();
  });
});
