// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureGuestIdentity = vi.fn<typeof import('@/lib/guest-identity').ensureGuestIdentity>();
vi.mock('@/lib/guest-identity', () => ({
  ensureGuestIdentity: () => ensureGuestIdentity(),
}));

const { useGuestId } = await import('./useGuestId');

// The guest token before the first owner-scoped call, on every entry path
// (docs/specs/014-identity/auth-and-guest-access.md).
describe('useGuestId', () => {
  beforeEach(() => {
    ensureGuestIdentity.mockReset();
  });

  it('holds no id until the guest identity resolves', async () => {
    let resolve!: (v: { id: string }) => void;
    ensureGuestIdentity.mockReturnValue(new Promise((r) => (resolve = r)));
    const { result } = renderHook(() => useGuestId(true, null));
    expect(result.current).toBeNull();
    await act(async () => resolve({ id: 'guest_1' }));
    expect(result.current).toBe('guest_1');
  });

  it('waits for auth to settle before resolving anything', () => {
    renderHook(() => useGuestId(false, null));
    expect(ensureGuestIdentity).not.toHaveBeenCalled();
  });

  it('resolves nothing for a signed-in user', () => {
    const { result } = renderHook(() => useGuestId(true, 'user_1'));
    expect(ensureGuestIdentity).not.toHaveBeenCalled();
    expect(result.current).toBeNull();
  });

  it('drops a resolution that lands after unmount', async () => {
    let resolve!: (v: { id: string }) => void;
    ensureGuestIdentity.mockReturnValue(new Promise((r) => (resolve = r)));
    const { result, unmount } = renderHook(() => useGuestId(true, null));
    unmount();
    await act(async () => resolve({ id: 'late' }));
    expect(result.current).toBeNull();
  });
});
