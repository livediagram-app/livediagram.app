import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the two async deps the request path touches before dispatch, so we can
// drive the worker's top-level §4 guest-signature gate (docs/specs/015-api/public-api-and-tokens.md) directly.
vi.mock('./auth/clerk', () => ({ getClerkIdentity: async () => null }));
const { resolveApiTokenMock } = vi.hoisted(() => ({ resolveApiTokenMock: vi.fn() }));
vi.mock('./db', () => ({
  resolveApiToken: resolveApiTokenMock,
  listDocumentsByOwner: async () => [],
  deleteOldEvents: async () => {},
}));

import worker from './index';
import { signOwnerId } from './auth/owner-signature';
import type { Env } from './types';

const SECRET = 'test-hmac-secret';

// Enforcement on: secret set + a cutoff in the past.
function env(): Env {
  return { GUEST_ID_HMAC_SECRET: SECRET, GUEST_SIG_ENFORCE_AFTER: '1' } as unknown as Env;
}
function get(path: string, headers: Record<string, string> = {}): Request {
  return new Request(`https://api.test${path}`, { method: 'GET', headers });
}

describe('worker §4 guest X-Owner-Id signature gate', () => {
  beforeEach(() => resolveApiTokenMock.mockResolvedValue(null));
  it('401s an unsigned X-Owner-Id on an owner-scoped route when enforcing', async () => {
    const res = await worker.fetch(get('/api/documents', { 'X-Owner-Id': 'guest-1' }), env());
    expect(res.status).toBe(401);
  });

  it('401s an X-Owner-Id carrying a Clerk sub with no signature (signed-up Bearer-only)', async () => {
    const res = await worker.fetch(get('/api/documents', { 'X-Owner-Id': 'user_abc' }), env());
    expect(res.status).toBe(401);
  });

  it('401s an invalid signature', async () => {
    const res = await worker.fetch(
      get('/api/documents', { 'X-Owner-Id': 'guest-1', 'X-Owner-Sig': 'bogus' }),
      env(),
    );
    expect(res.status).toBe(401);
  });

  it('lets a validly signed X-Owner-Id through the gate', async () => {
    const sig = (await signOwnerId(SECRET, 'guest-1'))!;
    const res = await worker.fetch(
      get('/api/documents', { 'X-Owner-Id': 'guest-1', 'X-Owner-Sig': sig }),
      env(),
    );
    expect(res.status).not.toBe(401);
  });

  it('does not gate when no X-Owner-Id is presented (public reads still resolve)', async () => {
    const res = await worker.fetch(get('/api/documents'), env());
    expect(res.status).not.toBe(401);
  });
});

// The Clerk-shape refusal sits BEFORE the signature gate above and, unlike it,
// is unconditional — the shape has never been a legitimate guest credential, so
// there is no legacy caller to grandfather and nothing to arm. That matters
// because the signature gate ships OFF by default (`GUEST_SIG_ENFORCE_AFTER`
// unset), which is the configuration these tests use.
describe('worker refusal of a Clerk account id in X-Owner-Id', () => {
  // Enforcement OFF: no secret, no cutoff. The gate above cannot fire here.
  const noEnforcement = () => ({}) as unknown as Env;

  beforeEach(() => resolveApiTokenMock.mockResolvedValue(null));

  it('401s a Clerk sub presented as the guest header, with the gate disarmed', async () => {
    const res = await worker.fetch(
      get('/api/documents', { 'X-Owner-Id': 'user_2abcDEF' }),
      noEnforcement(),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'account_id_not_a_guest_credential' });
  });

  it('covers every owner-scoped resource, not just documents', async () => {
    for (const seg of ['folders', 'images', 'custom-themes', 'preferences', 'shared', 'timeline']) {
      const res = await worker.fetch(
        get(`/api/${seg}`, { 'X-Owner-Id': 'user_2abcDEF' }),
        noEnforcement(),
      );
      expect(res.status, seg).toBe(401);
    }
  });

  // The share resolver compares the header with the document owner, so a
  // harvested Clerk sub must not reach it either.
  it('refuses a Clerk sub as the guest header on the share resolver', async () => {
    const res = await worker.fetch(
      get('/api/share/abc', { 'X-Owner-Id': 'user_2abcDEF' }),
      noEnforcement(),
    );
    expect(res.status).toBe(401);
  });

  // An empty header must not be a shared owner everyone can write as.
  it('treats an empty guest header as no owner at all', async () => {
    const res = await worker.fetch(
      new Request('https://x.test/api/folders', {
        method: 'POST',
        headers: { 'X-Owner-Id': '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'f' }),
      }),
      noEnforcement(),
    );
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain('authentication required');
  });

  it('lets a real guest UUID through (the shape the server actually mints)', async () => {
    const res = await worker.fetch(
      get('/api/documents', { 'X-Owner-Id': crypto.randomUUID() }),
      noEnforcement(),
    );
    expect(res.status).not.toBe(401);
  });

  it('does not touch a Bearer caller, whose owner id IS a Clerk sub', async () => {
    // A token request resolves its owner from the hashed-token lookup, so the
    // account id never arrives as a header and must not be penalised for
    // being one.
    resolveApiTokenMock.mockResolvedValue({
      ownerId: 'user_2abcDEF',
      tokenId: 'tok-1',
      readOnly: false,
    });
    const res = await worker.fetch(
      get('/api/documents', { Authorization: `Bearer lvd_${'a'.repeat(40)}` }),
      noEnforcement(),
    );
    expect(res.status).not.toBe(401);
  });
});

const LVD = `lvd_${'a'.repeat(40)}`;

describe('read-only API token enforcement (docs/specs/015-api/mcp-server.md §4.11)', () => {
  beforeEach(() => {
    resolveApiTokenMock.mockReset();
    resolveApiTokenMock.mockResolvedValue({
      ownerId: 'user_ro',
      tokenId: 'tok-ro',
      readOnly: true,
    });
  });

  const RO = { Authorization: `Bearer ${LVD}` };
  const req = (method: string) =>
    new Request('https://api.test/api/documents', { method, headers: RO });

  it('403s a POST from a read-only token', async () => {
    const res = await worker.fetch(req('POST'), env());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'read_only_token' });
  });

  it('403s a PUT from a read-only token', async () => {
    const res = await worker.fetch(
      new Request('https://api.test/api/documents/d1', { method: 'PUT', headers: RO }),
      env(),
    );
    expect(res.status).toBe(403);
  });

  it('403s a DELETE from a read-only token', async () => {
    const res = await worker.fetch(
      new Request('https://api.test/api/documents/d1', { method: 'DELETE', headers: RO }),
      env(),
    );
    expect(res.status).toBe(403);
  });

  it('403s the share-link list, which holds every code and the password', async () => {
    // A read-only token must not be able to lift an edit link.
    const res = await worker.fetch(
      new Request('https://api.test/api/documents/d1/share', { headers: RO }),
      env(),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'read_only_token' });
  });

  it('lets a read-only token revoke itself, and only itself', async () => {
    const self = await worker.fetch(
      new Request('https://api.test/api/tokens/current', { method: 'DELETE', headers: RO }),
      env(),
    );
    expect(self.status).not.toBe(403);
    const other = await worker.fetch(
      new Request('https://api.test/api/tokens/tok-other', { method: 'DELETE', headers: RO }),
      env(),
    );
    expect(other.status).toBe(403);
  });

  it('lets a GET through (reads are allowed)', async () => {
    const res = await worker.fetch(req('GET'), env());
    expect(res.status).not.toBe(403);
  });

  it('does NOT block a full (read+write) token', async () => {
    resolveApiTokenMock.mockResolvedValue({
      ownerId: 'user_rw',
      tokenId: 'tok-rw',
      readOnly: false,
    });
    const res = await worker.fetch(req('POST'), env());
    expect(res.status).not.toBe(403);
  });
});

// An `lvd_` bearer is a claim to be a token; one that resolves to no live row (unknown, revoked or expired) is
// refused at the front door with 401 `invalid_token`, never treated as a guest or as nobody
// (docs/specs/015-api/public-api-and-tokens.md §3.3).
describe('worker refusal of an unknown API token', () => {
  const noEnforcement = () => ({}) as unknown as Env;
  const TOKEN = `lvd_${'x'.repeat(43)}`;
  beforeEach(() => resolveApiTokenMock.mockResolvedValue(null));

  it('401s an lvd_ bearer that resolves to no live token, on owner-scoped and token routes alike', async () => {
    for (const path of ['/api/documents', '/api/tokens/current', '/api/teams']) {
      const res = await worker.fetch(
        get(path, { Authorization: `Bearer ${TOKEN}` }),
        noEnforcement(),
      );
      expect(res.status, path).toBe(401);
      expect(await res.json(), path).toEqual({ error: 'invalid_token' });
      expect(res.headers.get('WWW-Authenticate'), path).toBe('Bearer error="invalid_token"');
    }
  });

  it('refuses it even beside a guest header, so a dead token never falls back to a guest', async () => {
    const res = await worker.fetch(
      get('/api/documents', { Authorization: `Bearer ${TOKEN}`, 'X-Owner-Id': 'guest-1' }),
      noEnforcement(),
    );
    expect(res.status).toBe(401);
  });

  it('leaves a bearer that is not token-shaped to the Clerk path', async () => {
    const res = await worker.fetch(
      get('/api/documents', { Authorization: 'Bearer eyJ.jwt.sig' }),
      noEnforcement(),
    );
    expect(res.status).not.toBe(401);
  });
});

// Room-ticket mints skip the per-owner write budget (autosave shares it), but
// each is a D1 write, so they have their own bucket keyed on the network.
describe('worker room-ticket throttle', () => {
  beforeEach(() => resolveApiTokenMock.mockResolvedValue(null));

  it('429s a mint once the per-network bucket is spent, keyed on the /64', async () => {
    const limit = vi.fn(async () => ({ success: false }));
    const res = await worker.fetch(
      new Request('https://api.test/api/documents/d1/room-ticket', {
        method: 'POST',
        headers: { 'X-Owner-Id': crypto.randomUUID(), 'CF-Connecting-IP': '2001:db8:0:1::9' },
      }),
      { WRITE_RATE_LIMITER: { limit } } as unknown as Env,
    );
    expect(res.status).toBe(429);
    expect(limit).toHaveBeenCalledWith({ key: 'room-ticket:2001:0db8:0000:0001::/64' });
  });
});
