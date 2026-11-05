import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';

// The levels the index was asked to make a link at.
const { made } = vi.hoisted(() => ({ made: [] as { id: string; level?: string }[] }));
vi.mock('../index-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../index-service')>()),
  indexFor: () => ({
    createShareLink: async (id: string, input: { level?: string } = {}) => {
      made.push({ id, ...input });
      return {
        link: {
          code: 'ABCDEFGHJKLMNP',
          itemId: id,
          // The index's default for a livehuddle item.
          level: input.level ?? 'participate',
          tabId: null,
          expiry: 'never',
          expiresAt: null,
          createdAt: 1,
        },
      };
    },
  }),
}));

import { makeTestRouteContext } from './test-route-context';
import { handleDocumentIndexRoutes } from './document-index-routes';

// livehuddle offers no new Viewer link (docs/specs/013-workspace/share-roles.md "What a new share offers"): the api
// refuses one before the index is asked, and makes an Editor or a Participant link as asked.
const share = async (body: unknown) =>
  (await handleDocumentIndexRoutes(
    makeTestRouteContext('POST', '/api/documents/D/share', {
      env: sqliteD1().env,
      owner: 'owner',
      body,
    }),
  ))!;

beforeEach(() => {
  made.length = 0;
});

describe('POST /api/documents/:id/share levels', () => {
  it('refuses a new Viewer link, asking the index nothing', async () => {
    const res = await share({ role: 'view' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'level_not_offered' });
    expect(made).toEqual([]);
  });

  it('makes a Participant or an Editor link as asked', async () => {
    for (const role of ['participate', 'edit'] as const) {
      const res = await share({ role });
      expect(res.status).toBe(201);
      expect((await res.json<{ link: { role: string } }>()).link.role).toBe(role);
    }
    expect(made.map((m) => m.level)).toEqual(['participate', 'edit']);
  });

  it('leaves the level to the index when none is named: a Participant link', async () => {
    const res = await share({});
    expect(made).toEqual([{ id: 'D' }]);
    expect((await res.json<{ link: { role: string } }>()).link.role).toBe('participate');
  });
});
