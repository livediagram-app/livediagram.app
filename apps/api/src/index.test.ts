import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the two async deps the request path touches before dispatch, so we can
// drive the worker's top-level §4 guest-signature gate (spec/61) directly.
vi.mock('./auth/clerk', () => ({ getClerkIdentity: async () => null }));
const { resolveApiTokenMock } = vi.hoisted(() => ({ resolveApiTokenMock: vi.fn() }));
vi.mock('./db', () => ({
  resolveApiToken: resolveApiTokenMock,
  listDiagramsByOwner: async () => [],
  deleteOldChangeLogEntries: async () => {},
  deleteOldEvents: async () => {},
  deleteOldUnusedImages: async () => {},
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
    const res = await worker.fetch(get('/api/diagrams', { 'X-Owner-Id': 'guest-1' }), env());
    expect(res.status).toBe(401);
  });

  it('401s an X-Owner-Id carrying a Clerk sub with no signature (signed-up Bearer-only)', async () => {
    const res = await worker.fetch(get('/api/diagrams', { 'X-Owner-Id': 'user_abc' }), env());
    expect(res.status).toBe(401);
  });

  it('401s an invalid signature', async () => {
    const res = await worker.fetch(
      get('/api/diagrams', { 'X-Owner-Id': 'guest-1', 'X-Owner-Sig': 'bogus' }),
      env(),
    );
    expect(res.status).toBe(401);
  });

  it('lets a validly signed X-Owner-Id through the gate', async () => {
    const sig = (await signOwnerId(SECRET, 'guest-1'))!;
    const res = await worker.fetch(
      get('/api/diagrams', { 'X-Owner-Id': 'guest-1', 'X-Owner-Sig': sig }),
      env(),
    );
    expect(res.status).not.toBe(401);
  });

  it('does not gate when no X-Owner-Id is presented (public reads still resolve)', async () => {
    const res = await worker.fetch(get('/api/diagrams'), env());
    expect(res.status).not.toBe(401);
  });
});

const LVD = `lvd_${'a'.repeat(40)}`;

describe('read-only API token enforcement (spec/62 §4.11)', () => {
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
    new Request('https://api.test/api/diagrams', { method, headers: RO });

  it('403s a POST from a read-only token', async () => {
    const res = await worker.fetch(req('POST'), env());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'read_only_token' });
  });

  it('403s a PUT from a read-only token', async () => {
    const res = await worker.fetch(
      new Request('https://api.test/api/diagrams/d1', { method: 'PUT', headers: RO }),
      env(),
    );
    expect(res.status).toBe(403);
  });

  it('403s a DELETE from a read-only token', async () => {
    const res = await worker.fetch(
      new Request('https://api.test/api/diagrams/d1', { method: 'DELETE', headers: RO }),
      env(),
    );
    expect(res.status).toBe(403);
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
