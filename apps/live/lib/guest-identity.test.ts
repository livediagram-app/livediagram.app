import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api/self', () => ({
  apiMintGuestId: vi.fn(),
  apiUpgradeGuestId: vi.fn(),
}));
vi.mock('./telemetry', () => ({ track: vi.fn() }));

import { apiMintGuestId, apiUpgradeGuestId } from './api/self';
import { ensureSignedGuestIdentity, retrySignedGuestIdentity } from './guest-identity';

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
    mockUpgrade.mockResolvedValue('moved');
    expect(await ensureSignedGuestIdentity()).toEqual({ id: 'signed', sig: 'sig' });
    expect(mockUpgrade).toHaveBeenCalledWith('legacy', 'signed', 'sig');
    expect(window.localStorage.getItem(ID)).toBe('signed');
  });

  it('keeps the legacy id (no data loss) when the upgrade cannot reach the worker', async () => {
    window.localStorage.setItem(ID, 'legacy');
    mockMint.mockResolvedValue({ ownerId: 'signed', ownerSig: 'sig' });
    mockUpgrade.mockResolvedValue('failed');
    expect(await ensureSignedGuestIdentity()).toEqual({ id: 'legacy', sig: null });
    expect(window.localStorage.getItem(ID)).toBe('legacy');
  });

  // A refusal is definitive: under enforcement only a pre-signing id may upgrade unsigned, and any
  // other unsigned id's server data is unreachable already. Keeping it would lock the browser out.
  it('adopts the signed id when the worker refuses the upgrade', async () => {
    window.localStorage.setItem(ID, 'unsigned-after-signing');
    mockMint.mockResolvedValue({ ownerId: 'signed', ownerSig: 'sig' });
    mockUpgrade.mockResolvedValue('refused');
    expect(await ensureSignedGuestIdentity()).toEqual({ id: 'signed', sig: 'sig' });
    expect(window.localStorage.getItem(ID)).toBe('signed');
    expect(window.localStorage.getItem(SIG)).toBe('sig');
    expect(window.localStorage.getItem('livediagram:v2:pending-signed-id')).toBeNull();
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

// A reload can land after the worker moved the data but before the browser kept the new id
// (docs/specs/014-identity/auth-and-guest-access.md, "An interrupted upgrade resumes").
describe('an interrupted guest id upgrade', () => {
  const PENDING = 'livediagram:v2:pending-signed-id';

  it('records the pending upgrade before asking the worker to move the data', async () => {
    window.localStorage.setItem(ID, 'legacy');
    mockMint.mockResolvedValue({ ownerId: 'signed', ownerSig: 'sig' });
    let seenDuringMove: string | null = null;
    mockUpgrade.mockImplementation(async () => {
      seenDuringMove = window.localStorage.getItem(PENDING);
      return 'moved';
    });
    await ensureSignedGuestIdentity();
    expect(JSON.parse(seenDuringMove!)).toEqual({ from: 'legacy', to: 'signed', sig: 'sig' });
    expect(window.localStorage.getItem(PENDING)).toBeNull();
  });

  it('resumes the recorded upgrade on the next load instead of minting another id', async () => {
    window.localStorage.setItem(ID, 'legacy');
    window.localStorage.setItem(
      PENDING,
      JSON.stringify({ from: 'legacy', to: 'signed', sig: 'sig' }),
    );
    mockUpgrade.mockResolvedValue('moved');
    expect(await ensureSignedGuestIdentity()).toEqual({ id: 'signed', sig: 'sig' });
    expect(mockMint).not.toHaveBeenCalled();
    expect(mockUpgrade).toHaveBeenCalledWith('legacy', 'signed', 'sig');
    expect(window.localStorage.getItem(ID)).toBe('signed');
    expect(window.localStorage.getItem(SIG)).toBe('sig');
    expect(window.localStorage.getItem(PENDING)).toBeNull();
  });

  it('keeps the record and the old id when the resumed move fails, still without minting', async () => {
    window.localStorage.setItem(ID, 'legacy');
    window.localStorage.setItem(
      PENDING,
      JSON.stringify({ from: 'legacy', to: 'signed', sig: 'sig' }),
    );
    mockUpgrade.mockResolvedValue('failed');
    expect(await ensureSignedGuestIdentity()).toEqual({ id: 'legacy', sig: null });
    expect(mockMint).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(PENDING)).not.toBeNull();
  });

  it('adopts the recorded signed id when the resumed move is refused', async () => {
    window.localStorage.setItem(ID, 'legacy');
    window.localStorage.setItem(
      PENDING,
      JSON.stringify({ from: 'legacy', to: 'signed', sig: 'sig' }),
    );
    mockUpgrade.mockResolvedValue('refused');
    expect(await ensureSignedGuestIdentity()).toEqual({ id: 'signed', sig: 'sig' });
    expect(mockMint).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(ID)).toBe('signed');
    expect(window.localStorage.getItem(PENDING)).toBeNull();
  });

  it('ignores a record that does not start from the id this browser holds', async () => {
    window.localStorage.setItem(ID, 'other');
    window.localStorage.setItem(
      PENDING,
      JSON.stringify({ from: 'legacy', to: 'signed', sig: 'sig' }),
    );
    mockMint.mockResolvedValue({ ownerId: 'fresh', ownerSig: 'fsig' });
    mockUpgrade.mockResolvedValue('moved');
    expect(await ensureSignedGuestIdentity()).toEqual({ id: 'fresh', sig: 'fsig' });
    expect(mockUpgrade).toHaveBeenCalledWith('other', 'fresh', 'fsig');
    expect(window.localStorage.getItem(PENDING)).toBeNull();
  });
});

// docs/specs/014-identity/auth-and-guest-access.md "Server-minted": a refused first mint leaves an
// unsigned id; the user's retry mints again instead of retrying with it.
describe('retrySignedGuestIdentity', () => {
  it('does nothing for a guest that already holds a signature', async () => {
    window.localStorage.setItem(ID, 'id-1');
    window.localStorage.setItem(SIG, 'sig-1');
    expect(await retrySignedGuestIdentity()).toBeNull();
    expect(mockMint).not.toHaveBeenCalled();
  });

  it('mints a signed id for a guest left on an unsigned one', async () => {
    // A brand-new id with no data behind it: the fallback a refused mint leaves.
    mockMint.mockResolvedValueOnce(null);
    const unsigned = await ensureSignedGuestIdentity();
    expect(unsigned.sig).toBeNull();
    mockMint.mockResolvedValueOnce({ ownerId: 'signed', ownerSig: 'sig' });
    mockUpgrade.mockResolvedValueOnce('moved');
    expect(await retrySignedGuestIdentity()).toEqual({ id: 'signed', sig: 'sig' });
    expect(window.localStorage.getItem(SIG)).toBe('sig');
  });

  it('reports nothing changed when the mint is still refused', async () => {
    mockMint.mockResolvedValue(null);
    expect(await retrySignedGuestIdentity()).toBeNull();
  });
});

// Two tabs opening at once on a legacy unsigned id: each loads its own copy of the module, so the
// per-module `inflight` share cannot help; the Web Lock must serialise them across tabs.
describe('the signed-id upgrade across tabs', () => {
  function fakeLocks() {
    let tail: Promise<unknown> = Promise.resolve();
    const names: string[] = [];
    return {
      names,
      request: (name: string, run: () => Promise<unknown>) => {
        names.push(name);
        const next = tail.then(run);
        tail = next.catch(() => undefined);
        return next;
      },
    };
  }

  async function loadTab() {
    vi.resetModules();
    return { guest: await import('./guest-identity') };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lets the second tab adopt the identity the first one wrote, never minting again', async () => {
    const locks = fakeLocks();
    vi.stubGlobal('navigator', { locks });
    window.localStorage.setItem(ID, 'legacy');
    const tabA = await loadTab();
    const tabB = await loadTab();
    // The api mock is shared by both tabs: without the lock each would mint, A then B.
    mockMint
      .mockResolvedValueOnce({ ownerId: 'signed-a', ownerSig: 'sig-a' })
      .mockResolvedValueOnce({ ownerId: 'signed-b', ownerSig: 'sig-b' });
    mockUpgrade.mockResolvedValue('moved');

    const [a, b] = await Promise.all([
      tabA.guest.ensureSignedGuestIdentity(),
      tabB.guest.ensureSignedGuestIdentity(),
    ]);

    expect(a).toEqual({ id: 'signed-a', sig: 'sig-a' });
    expect(b).toEqual({ id: 'signed-a', sig: 'sig-a' });
    expect(locks.names).toEqual([
      tabA.guest.GUEST_UPGRADE_LOCK_NAME,
      tabB.guest.GUEST_UPGRADE_LOCK_NAME,
    ]);
    expect(mockMint).toHaveBeenCalledTimes(1);
    expect(mockUpgrade).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(ID)).toBe('signed-a');
    expect(window.localStorage.getItem(SIG)).toBe('sig-a');
  });

  it('still resolves without navigator.locks', async () => {
    vi.stubGlobal('navigator', {});
    window.localStorage.setItem(ID, 'legacy');
    const tab = await loadTab();
    mockMint.mockResolvedValue({ ownerId: 'signed', ownerSig: 'sig' });
    mockUpgrade.mockResolvedValue('moved');
    expect(await tab.guest.ensureSignedGuestIdentity()).toEqual({ id: 'signed', sig: 'sig' });
  });
});
