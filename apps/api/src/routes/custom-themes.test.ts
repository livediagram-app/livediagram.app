import { makeTestRouteContext } from './test-route-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Authorisation surface for handleCustomThemes (spec/44). Owner-scoped
// like folders: an unauthenticated caller is rejected (400), a missing
// theme is 404, a foreign-owned theme is 403, and the owner's own CRUD
// succeeds. Guests are first-class (the owner id is just a string here).

const { db } = vi.hoisted(() => ({
  db: {
    listCustomThemesByOwner: vi.fn(),
    getCustomTheme: vi.fn(),
    createCustomTheme: vi.fn(),
    updateCustomTheme: vi.fn(),
    deleteCustomTheme: vi.fn(),
  },
}));
vi.mock('../db', () => db);

import type { RouteContext } from './context';
import { handleCustomThemes } from './custom-themes';

const DEF = {
  backgroundColor: '#ffffff',
  backgroundPattern: 'grid' as const,
  patternColor: '#cbd5e1',
  elementFill: '#dbeafe',
  elementStroke: '#2563eb',
  elementText: '#1e3a8a',
};

// Guest-shaped context: resolveOwner yields 'owner-1' unless overridden.
const makeCtx = (
  method: string,
  path: string,
  opts: { owner?: string | null; body?: unknown } = {},
): RouteContext =>
  makeTestRouteContext(method, path, {
    body: opts.body,
    owner: opts.owner === undefined ? 'owner-1' : opts.owner,
  });

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
});

describe('handleCustomThemes auth', () => {
  it('400 when no owner resolves', async () => {
    const res = await handleCustomThemes(makeCtx('GET', '/api/custom-themes', { owner: null }));
    expect(res.status).toBe(400);
  });

  it('200 lists the owner-scoped themes', async () => {
    db.listCustomThemesByOwner.mockResolvedValue([{ id: 'custom:1' }]);
    const res = await handleCustomThemes(makeCtx('GET', '/api/custom-themes'));
    expect(res.status).toBe(200);
    expect(db.listCustomThemesByOwner).toHaveBeenCalledWith({}, 'owner-1');
  });

  it('201 creates a theme for the owner', async () => {
    db.createCustomTheme.mockResolvedValue({ id: 'custom:1' });
    const res = await handleCustomThemes(
      makeCtx('POST', '/api/custom-themes', {
        body: { id: 'custom:1', name: 'Brandy', definition: DEF },
      }),
    );
    expect(res.status).toBe(201);
    expect(db.createCustomTheme).toHaveBeenCalledWith(
      {},
      {
        id: 'custom:1',
        ownerId: 'owner-1',
        name: 'Brandy',
        definition: DEF,
      },
    );
  });

  it('400 when creating without id/name/definition', async () => {
    const res = await handleCustomThemes(
      makeCtx('POST', '/api/custom-themes', { body: { name: 'x' } }),
    );
    expect(res.status).toBe(400);
    expect(db.createCustomTheme).not.toHaveBeenCalled();
  });

  it('404 when updating a theme that does not exist', async () => {
    db.getCustomTheme.mockResolvedValue(null);
    const res = await handleCustomThemes(
      makeCtx('PUT', '/api/custom-themes/custom:9', { body: { name: 'x' } }),
    );
    expect(res.status).toBe(404);
    expect(db.updateCustomTheme).not.toHaveBeenCalled();
  });

  it('403 when updating a theme owned by someone else', async () => {
    db.getCustomTheme.mockResolvedValue({ id: 'custom:1', ownerId: 'someone-else' });
    const res = await handleCustomThemes(
      makeCtx('PUT', '/api/custom-themes/custom:1', { body: { name: 'x' } }),
    );
    expect(res.status).toBe(403);
    expect(db.updateCustomTheme).not.toHaveBeenCalled();
  });

  it('200 when the owner updates their theme', async () => {
    db.getCustomTheme.mockResolvedValue({ id: 'custom:1', ownerId: 'owner-1' });
    const res = await handleCustomThemes(
      makeCtx('PUT', '/api/custom-themes/custom:1', { body: { name: 'Renamed' } }),
    );
    expect(res.status).toBe(200);
    expect(db.updateCustomTheme).toHaveBeenCalledWith({}, 'custom:1', {
      name: 'Renamed',
      definition: undefined,
    });
  });

  it('204 when the owner deletes their theme', async () => {
    db.getCustomTheme.mockResolvedValue({ id: 'custom:1', ownerId: 'owner-1' });
    const res = await handleCustomThemes(makeCtx('DELETE', '/api/custom-themes/custom:1'));
    expect(res.status).toBe(204);
    expect(db.deleteCustomTheme).toHaveBeenCalledWith({}, 'custom:1');
  });

  it('403 when deleting a theme owned by someone else', async () => {
    db.getCustomTheme.mockResolvedValue({ id: 'custom:1', ownerId: 'someone-else' });
    const res = await handleCustomThemes(makeCtx('DELETE', '/api/custom-themes/custom:1'));
    expect(res.status).toBe(403);
    expect(db.deleteCustomTheme).not.toHaveBeenCalled();
  });
});
