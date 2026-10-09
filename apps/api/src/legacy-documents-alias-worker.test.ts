import { beforeEach, describe, expect, it, vi } from 'vitest';

// The deprecated /api/diagrams alias through the real worker entry point
// (docs/specs/015-api/public-api-and-tokens.md, "Deprecated diagram routes").
vi.mock('./auth/clerk', () => ({ getClerkIdentity: async () => null }));
const { resolveApiTokenMock } = vi.hoisted(() => ({ resolveApiTokenMock: vi.fn() }));
vi.mock('./db', () => ({
  resolveApiToken: resolveApiTokenMock,
  listDocumentsByOwner: async () => [],
  deleteOldEvents: async () => {},
}));

import { fetchWithRuntime } from './index';
import { signOwnerId } from './auth/owner-signature';
import type { Runtime } from './types';

const SECRET = 'test-hmac-secret';
const env = () =>
  ({ GUEST_ID_HMAC_SECRET: SECRET, GUEST_SIG_ENFORCE_AFTER: '1' }) as unknown as Runtime;
const get = (path: string, headers: Record<string, string> = {}) =>
  new Request(`https://api.test${path}`, { method: 'GET', headers });

describe('the deprecated /api/diagrams alias', () => {
  beforeEach(() => resolveApiTokenMock.mockResolvedValue(null));

  it('serves the documents route in the old shape, marked deprecated', async () => {
    const sig = (await signOwnerId(SECRET, 'guest-1'))!;
    const headers = { 'X-Owner-Id': 'guest-1', 'X-Owner-Sig': sig };
    const current = await fetchWithRuntime(get('/api/documents', headers), env());
    const legacy = await fetchWithRuntime(get('/api/diagrams', headers), env());
    expect(current.status).toBe(200);
    expect(legacy.status).toBe(200);
    expect(Object.keys((await current.json()) as object)).toContain('documents');
    expect(Object.keys((await legacy.json()) as object)).toContain('diagrams');
    expect(legacy.headers.get('Deprecation')).toBe('true');
    expect(current.headers.get('Deprecation')).toBeNull();
  });

  it('keeps the signature gate on the alias', async () => {
    const res = await fetchWithRuntime(get('/api/diagrams', { 'X-Owner-Id': 'guest-1' }), env());
    expect(res.status).toBe(401);
  });
});
