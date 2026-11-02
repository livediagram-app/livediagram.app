import { beforeEach, describe, expect, it, vi } from 'vitest';

// docs/specs/014-identity/auth-and-guest-access.md: a guest is liveworkspace's guest token; with none (the handoff
// could not run) the page carries on with a stand-in id for this load.
const ensureGuestToken =
  vi.fn<() => Promise<{ token: string; id: string; expiresAt: number } | null>>();
vi.mock('./guest-token', () => ({
  ensureGuestToken: () => ensureGuestToken(),
  readGuestToken: () => null,
}));
vi.mock('./telemetry', () => ({ track: vi.fn() }));

const { ensureGuestIdentity } = await import('./guest-identity');

beforeEach(() => ensureGuestToken.mockReset());

describe('ensureGuestIdentity', () => {
  it("is the guest token's id", async () => {
    ensureGuestToken.mockResolvedValue({ token: 't', id: 'guest_abc', expiresAt: 1 });
    expect(await ensureGuestIdentity()).toEqual({ id: 'guest_abc' });
  });

  it('carries on with one stand-in id for the page load when there is no token', async () => {
    ensureGuestToken.mockResolvedValue(null);
    const first = await ensureGuestIdentity();
    expect(first.id).toMatch(/^guest_[0-9a-f-]{36}$/);
    expect(await ensureGuestIdentity()).toEqual(first);
  });
});
