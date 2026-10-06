// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureSignedGuestIdentity = vi.fn();
vi.mock('@/lib/guest-identity', () => ({
  ensureSignedGuestIdentity: () => ensureSignedGuestIdentity(),
}));

const { useSignedGuestId } = await import('./useSignedGuestId');

// Signed before the first owner-scoped call, on every entry path
// (docs/specs/014-identity/auth-and-guest-access.md "Signed guest ids").
describe('useSignedGuestId', () => {
  beforeEach(() => {
    ensureSignedGuestIdentity.mockReset();
  });

  it('holds no id until the signed identity resolves', async () => {
    let resolve!: (v: { id: string; sig: string }) => void;
    ensureSignedGuestIdentity.mockReturnValue(new Promise((r) => (resolve = r)));
    const { result } = renderHook(() => useSignedGuestId(true, null));
    expect(result.current).toBeNull();
    await act(async () => resolve({ id: 'guest-signed', sig: 'sig' }));
    expect(result.current).toBe('guest-signed');
  });

  it('waits for auth to settle before resolving anything', () => {
    renderHook(() => useSignedGuestId(false, null));
    expect(ensureSignedGuestIdentity).not.toHaveBeenCalled();
  });

  it('resolves nothing for a signed-in user', () => {
    const { result } = renderHook(() => useSignedGuestId(true, 'user_1'));
    expect(ensureSignedGuestIdentity).not.toHaveBeenCalled();
    expect(result.current).toBeNull();
  });

  it('drops a resolution that lands after unmount', async () => {
    let resolve!: (v: { id: string; sig: string }) => void;
    ensureSignedGuestIdentity.mockReturnValue(new Promise((r) => (resolve = r)));
    const { result, unmount } = renderHook(() => useSignedGuestId(true, null));
    unmount();
    await act(async () => resolve({ id: 'late', sig: 'sig' }));
    expect(result.current).toBeNull();
  });
});
