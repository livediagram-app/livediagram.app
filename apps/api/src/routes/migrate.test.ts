import { beforeEach, describe, expect, it, vi } from 'vitest';

// Flow 2 of /api/migrate (legacy unsigned guest -> signed guest) takes its
// SOURCE from the unsigned X-Owner-Id header. These cases pin that the
// header can't name an account (a harvestable Clerk id) and that, once
// signature enforcement is armed, the source must prove possession too.

const { migrateOwnerId, getParticipant } = vi.hoisted(() => ({
  migrateOwnerId: vi.fn(),
  getParticipant: vi.fn(),
}));
vi.mock('../db', () => ({ migrateOwnerId, getParticipant }));

import { signOwnerId } from '../auth/owner-signature';
import type { Env } from '../types';
import { handleMigrate } from './migrate';
import { makeTestRouteContext } from './test-route-context';

const SECRET = 'test-secret';
const LEGACY = '0f5ca4af-9a8a-4a60-be5e-1179e5555880';
const TARGET = '7d2c1b8e-3f4a-4c5d-9e6f-0a1b2c3d4e5f';

async function flow2(
  from: string,
  env: Partial<Env>,
  headers: Record<string, string> = {},
): Promise<Response> {
  return handleMigrate(
    makeTestRouteContext('POST', '/api/migrate', {
      owner: from,
      env: { GUEST_ID_HMAC_SECRET: SECRET, ...env } as Env,
      headers,
      body: { toOwnerId: TARGET, toSignature: await signOwnerId(SECRET, TARGET) },
    }),
  );
}

beforeEach(() => {
  getParticipant.mockReset();
  getParticipant.mockResolvedValue(null);
  migrateOwnerId.mockReset();
  migrateOwnerId.mockResolvedValue({ documents: 1, folders: 0, shared: 0, images: 0 });
});

describe('POST /api/migrate flow 2 (legacy guest upgrade)', () => {
  it('moves a legacy guest onto a freshly-signed id', async () => {
    const res = await flow2(LEGACY, {});
    expect(res.status).toBe(200);
    expect(migrateOwnerId).toHaveBeenCalledWith(expect.anything(), LEGACY, TARGET);
  });

  it('refuses an account id as the source', async () => {
    const res = await flow2('user_victim', {});
    expect(res.status).toBe(403);
    expect(migrateOwnerId).not.toHaveBeenCalled();
  });

  it('refuses an unsigned source once enforcement is armed', async () => {
    const res = await flow2(LEGACY, { GUEST_SIG_ENFORCE_AFTER: '0' });
    expect(res.status).toBe(403);
    expect(migrateOwnerId).not.toHaveBeenCalled();
  });

  // Enforcement armed with a stated signing date: an id that existed before the
  // deployment signed anything can still make its one-time upgrade unsigned.
  describe('the legacy exception', () => {
    const LIVE_AT = 1_000_000;
    const armed = { GUEST_SIG_ENFORCE_AFTER: '0', GUEST_SIGNING_LIVE_AT: String(LIVE_AT) };

    it('lets a pre-signing guest upgrade unsigned', async () => {
      getParticipant.mockResolvedValue({ id: LEGACY, createdAt: LIVE_AT - 1 });
      const res = await flow2(LEGACY, armed);
      expect(res.status).toBe(200);
      expect(migrateOwnerId).toHaveBeenCalledWith(expect.anything(), LEGACY, TARGET);
    });

    it('refuses an unsigned id minted after signing went live', async () => {
      getParticipant.mockResolvedValue({ id: LEGACY, createdAt: LIVE_AT });
      expect((await flow2(LEGACY, armed)).status).toBe(403);
      expect(migrateOwnerId).not.toHaveBeenCalled();
    });

    it('refuses an unsigned id with no participant row', async () => {
      expect((await flow2(LEGACY, armed)).status).toBe(403);
      expect(migrateOwnerId).not.toHaveBeenCalled();
    });

    it('grants no exception when the signing date is not stated', async () => {
      getParticipant.mockResolvedValue({ id: LEGACY, createdAt: 1 });
      expect((await flow2(LEGACY, { GUEST_SIG_ENFORCE_AFTER: '0' })).status).toBe(403);
    });

    it('still refuses an account id, whatever its age', async () => {
      getParticipant.mockResolvedValue({ id: 'user_victim', createdAt: 1 });
      expect((await flow2('user_victim', armed)).status).toBe(403);
      expect(migrateOwnerId).not.toHaveBeenCalled();
    });
  });

  it('accepts a signed source once enforcement is armed', async () => {
    const res = await flow2(
      LEGACY,
      { GUEST_SIG_ENFORCE_AFTER: '0' },
      { 'X-Owner-Sig': (await signOwnerId(SECRET, LEGACY))! },
    );
    expect(res.status).toBe(200);
  });
});

describe('POST /api/migrate flow 1 (sign-up claim)', () => {
  // A self-host with Clerk on but no GUEST_ID_HMAC_SECRET skips the signature
  // check, so the account-id shape is the only thing standing between a
  // signed-in user and another account's workspace.
  it('refuses an account id as the guest source even with no secret configured', async () => {
    const ctx = makeTestRouteContext('POST', '/api/migrate', {
      env: {} as Env,
      body: { guestOwnerId: 'user_victim' },
    });
    ctx.clerkUserId = 'user_attacker';
    const res = await handleMigrate(ctx);
    expect(res.status).toBe(403);
    expect(migrateOwnerId).not.toHaveBeenCalled();
  });

  it('still claims a guest UUID with no secret configured', async () => {
    const ctx = makeTestRouteContext('POST', '/api/migrate', {
      env: {} as Env,
      body: { guestOwnerId: LEGACY },
    });
    ctx.clerkUserId = 'user_me';
    const res = await handleMigrate(ctx);
    expect(res.status).toBe(200);
    expect(migrateOwnerId).toHaveBeenCalledWith(expect.anything(), LEGACY, 'user_me');
  });
});
