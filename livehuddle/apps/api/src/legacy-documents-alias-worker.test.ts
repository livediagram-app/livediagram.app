import { beforeEach, describe, expect, it, vi } from 'vitest';

// The deprecated /api/diagrams alias through the real worker entry point
// (docs/specs/015-api/public-api-and-tokens.md, "Deprecated diagram routes").
vi.mock('./auth/accounts', () => ({
  getPersonIdentity: async (_env: unknown, request: Request) =>
    request.headers.get('Authorization') === 'Bearer guest-token'
      ? { kind: 'guest', guestId: 'guest_1' }
      : null,
  accountCredentials: () => null,
}));
const { resolveApiTokenMock } = vi.hoisted(() => ({ resolveApiTokenMock: vi.fn() }));
vi.mock('./db', () => ({ resolveApiToken: resolveApiTokenMock }));
// The caller's canvases are the index's (routes/document-index-routes.ts): an empty list.
vi.mock('./index-service', async (original) => ({
  ...(await original<typeof import('./index-service')>()),
  indexFor: () => ({ listItems: async () => ({ items: [], nextCursor: null }) }),
}));

import worker from './index';
import type { Env } from './types';

const env = () => ({}) as unknown as Env;
const get = (path: string, headers: Record<string, string> = {}) =>
  new Request(`https://api.test${path}`, { method: 'GET', headers });

describe('the deprecated /api/diagrams alias', () => {
  beforeEach(() => resolveApiTokenMock.mockResolvedValue(null));

  it('serves the documents route in the old shape, marked deprecated', async () => {
    const headers = { Authorization: 'Bearer guest-token' };
    const current = await worker.fetch(get('/api/documents', headers), env());
    const legacy = await worker.fetch(get('/api/diagrams', headers), env());
    expect(current.status).toBe(200);
    expect(legacy.status).toBe(200);
    expect(Object.keys(await current.json<object>())).toContain('documents');
    expect(Object.keys(await legacy.json<object>())).toContain('diagrams');
    expect(legacy.headers.get('Deprecation')).toBe('true');
    expect(current.headers.get('Deprecation')).toBeNull();
  });

  it('asks the alias for the same identity as the route it serves', async () => {
    const res = await worker.fetch(get('/api/diagrams'), env());
    expect(res.status).toBe(400);
  });
});
