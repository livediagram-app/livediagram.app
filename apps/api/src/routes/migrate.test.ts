import { beforeEach, describe, expect, it, vi } from 'vitest';

// Flow 2 of /api/migrate (legacy unsigned guest -> signed guest) takes its
// SOURCE from the unsigned X-Owner-Id header. These cases pin that the
// header can't name an account (a harvestable Clerk id) and that, once
// signature enforcement is armed, the source must prove possession too.

const { migrateOwnerId } = vi.hoisted(() => ({ migrateOwnerId: vi.fn() }));
vi.mock('../db', () => ({ migrateOwnerId }));

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
  migrateOwnerId.mockReset();
  migrateOwnerId.mockResolvedValue({ diagrams: 1, folders: 0, shared: 0, images: 0 });
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

  it('accepts a signed source once enforcement is armed', async () => {
    const res = await flow2(
      LEGACY,
      { GUEST_SIG_ENFORCE_AFTER: '0' },
      { 'X-Owner-Sig': await signOwnerId(SECRET, LEGACY) },
    );
    expect(res.status).toBe(200);
  });
});
