import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api/self', () => ({
  apiMintGuestId: vi.fn(),
  apiUpgradeGuestId: vi.fn(),
}));
vi.mock('./telemetry', () => ({ track: vi.fn() }));

import { apiMintGuestId, apiUpgradeGuestId } from './api/self';
import { ensureSignedGuestIdentity } from './guest-identity';

const mockMint = vi.mocked(apiMintGuestId);
const mockUpgrade = vi.mocked(apiUpgradeGuestId);

const ID = 'livediagram:v2:self-id';
const SIG = 'livediagram:v2:self-sig';

function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

beforeEach(() => {
  mockMint.mockReset();
  mockUpgrade.mockReset();
  (globalThis as unknown as { window: unknown }).window = { localStorage: fakeStorage() };
});
afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

describe('ensureSignedGuestIdentity', () => {
  it('returns the stored identity without minting when already signed', async () => {
    window.localStorage.setItem(ID, 'id-1');
    window.localStorage.setItem(SIG, 'sig-1');
    expect(await ensureSignedGuestIdentity()).toEqual({ id: 'id-1', sig: 'sig-1' });
    expect(mockMint).not.toHaveBeenCalled();
  });

  it('mints a fresh signed id for a brand-new guest', async () => {
    mockMint.mockResolvedValue({ ownerId: 'new', ownerSig: 'newsig' });
    expect(await ensureSignedGuestIdentity()).toEqual({ id: 'new', sig: 'newsig' });
    expect(window.localStorage.getItem(ID)).toBe('new');
    expect(window.localStorage.getItem(SIG)).toBe('newsig');
    expect(mockUpgrade).not.toHaveBeenCalled();
  });

  it('upgrades a legacy unsigned id by migrating its data onto the signed id', async () => {
    window.localStorage.setItem(ID, 'legacy');
    mockMint.mockResolvedValue({ ownerId: 'signed', ownerSig: 'sig' });
    mockUpgrade.mockResolvedValue(true);
    expect(await ensureSignedGuestIdentity()).toEqual({ id: 'signed', sig: 'sig' });
    expect(mockUpgrade).toHaveBeenCalledWith('legacy', 'signed', 'sig');
    expect(window.localStorage.getItem(ID)).toBe('signed');
  });

  it('keeps the legacy id (no data loss) when the upgrade migration fails', async () => {
    window.localStorage.setItem(ID, 'legacy');
    mockMint.mockResolvedValue({ ownerId: 'signed', ownerSig: 'sig' });
    mockUpgrade.mockResolvedValue(false);
    expect(await ensureSignedGuestIdentity()).toEqual({ id: 'legacy', sig: null });
    expect(window.localStorage.getItem(ID)).toBe('legacy');
  });

  it('falls back to the existing unsigned id when minting fails (offline)', async () => {
    window.localStorage.setItem(ID, 'existing');
    mockMint.mockResolvedValue(null);
    expect(await ensureSignedGuestIdentity()).toEqual({ id: 'existing', sig: null });
  });

  it('keeps the existing id when the worker has signing disabled (null sig)', async () => {
    window.localStorage.setItem(ID, 'existing');
    mockMint.mockResolvedValue({ ownerId: 'fresh', ownerSig: null });
    expect(await ensureSignedGuestIdentity()).toEqual({ id: 'existing', sig: null });
    expect(mockUpgrade).not.toHaveBeenCalled();
  });
});

// New Visitors (`Participant`/`Created`, docs/specs/017-telemetry/telemetry.md) must count a browser once.
// The once-per-load guard is module state, so each case loads the modules
// fresh rather than inheriting a flag an earlier test already set.
describe('Participant·Created counts once per browser', () => {
  async function fresh() {
    vi.resetModules();
    const self = await import('./api/self');
    const telemetry = await import('./telemetry');
    const guest = await import('./guest-identity');
    const local = await import('./local-identity');
    const created = () =>
      vi
        .mocked(telemetry.track)
        .mock.calls.filter(([c, a]) => c === 'Participant' && a === 'Created').length;
    return { self: vi.mocked(self), guest, local, created };
  }

  it('shares one mint between concurrent callers', async () => {
    const { self, guest, created } = await fresh();
    self.apiMintGuestId.mockResolvedValue({ ownerId: 'new', ownerSig: 'sig' });
    const [a, b] = await Promise.all([
      guest.ensureSignedGuestIdentity(),
      guest.ensureSignedGuestIdentity(),
    ]);
    expect(a).toEqual(b);
    expect(self.apiMintGuestId).toHaveBeenCalledTimes(1);
    expect(created()).toBe(1);
  });

  it('counts once when a local mint races the signed mint', async () => {
    // TeamInviteJoin / the /new fallback mint synchronously while the signed
    // mint is still waiting on the network: one browser, one count.
    const { self, guest, local, created } = await fresh();
    let release: (v: { ownerId: string; ownerSig: string }) => void = () => {};
    self.apiMintGuestId.mockReturnValue(new Promise((r) => (release = r)));
    const signed = guest.ensureSignedGuestIdentity();
    local.ensureGuestSelfId();
    release({ ownerId: 'new', ownerSig: 'sig' });
    await signed;
    expect(created()).toBe(1);
  });

  it('counts once when storage is unavailable and every call re-mints', async () => {
    const { local, created } = await fresh();
    (globalThis as unknown as { window: unknown }).window = {};
    local.ensureGuestSelfId();
    local.ensureGuestSelfId();
    expect(created()).toBe(1);
  });

  it('does not count a returning browser', async () => {
    const { local, created } = await fresh();
    window.localStorage.setItem(ID, 'existing');
    local.ensureGuestSelfId();
    expect(created()).toBe(0);
  });
});
