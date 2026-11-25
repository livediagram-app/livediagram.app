import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavedPageDesignsResponse } from '@livedocuments/api-schema';
import {
  savedDesignElement,
  SAVED_DESIGN_HEIGHT,
  SAVED_DESIGN_WIDTH,
} from '@livedocuments/document';
import { makeTestRouteContext } from './test-route-context';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { mediaServiceFor } from '../test-media-service';
import { clearMediaOwnersForTests } from '../media';
import { handleLibrary } from './library';
import { handlePageDesigns } from './page-designs';

// Saved Page Designs (docs/specs/011-theme/page-designs.md "Saved designs"): saved through the Library's door as one
// element of their own kind, kept out of every element list, and read back with their tuning by /api/page-designs, by
// a person or an API token.

let db: SqliteD1;
beforeEach(() => {
  db = sqliteD1();
  mediaServiceFor(db.env);
  clearMediaOwnersForTests();
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const TEAM = { id: 'team_1', name: 'Brand', role: 'member' as const };
type Who = { owner?: string; teams?: (typeof TEAM)[]; token?: { id: string } };
const ctxOf = (method: string, path: string, who: Who, body?: unknown) => {
  const ctx = makeTestRouteContext(method, path, {
    owner: who.owner ?? 'user_ada',
    env: db.env,
    teams: who.teams ?? null,
    ...(who.token ? { token: who.token } : {}),
  });
  return body === undefined
    ? ctx
    : {
        ...ctx,
        request: new Request(`https://api.test${path}`, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
      };
};
const saveDesign = (who: Who, body: Record<string, unknown>) =>
  handleLibrary(
    ctxOf('POST', '/api/library', who, {
      scope: 'personal',
      folder: '',
      title: 'Brand Aurora',
      width: SAVED_DESIGN_WIDTH,
      height: SAVED_DESIGN_HEIGHT,
      elements: [savedDesignElement({ id: 'aurora', scale: 1.4, flow: true })],
      ...body,
    }),
  );
const designs = async (who: Who = {}) => {
  const res = await handlePageDesigns(ctxOf('GET', '/api/page-designs', who));
  expect(res.status).toBe(200);
  return (await res.json<SavedPageDesignsResponse>()).designs;
};

describe('/api/page-designs', () => {
  it('lists the designs saved to My Work and the teams, with their tuning, to a person and a token', async () => {
    expect((await saveDesign({}, {})).status).toBe(201);
    expect(
      (await saveDesign({ teams: [TEAM] }, { scope: 'team', teamId: 'team_1', title: 'Team' }))
        .status,
    ).toBe(201);
    const mine = await designs({ teams: [TEAM] });
    expect(mine.map((d) => [d.title, d.scope, d.team])).toEqual(
      expect.arrayContaining([
        ['Brand Aurora', 'personal', null],
        ['Team', 'team', 'Brand'],
      ]),
    );
    expect(mine[0]!.id).toMatch(/^saved:/);
    expect(mine[0]!.design).toMatchObject({ id: 'aurora', scale: 1.4, flow: true });
    // An API token reads them too.
    expect(await designs({ token: { id: 'tok_1' } })).toHaveLength(1);
    // Someone else sees none of Ada's.
    expect(await designs({ owner: 'user_other' })).toEqual([]);
  });

  it('keeps a saved design out of the Library’s element list, and refuses one mixed with elements', async () => {
    await saveDesign({}, {});
    const res = await handleLibrary(ctxOf('GET', '/api/library', {}));
    const listed = await res.json<{ items: { kinds: string[] }[] }>();
    expect(listed.items.map((i) => i.kinds)).toEqual([['page-design']]);
    const mixed = await saveDesign(
      {},
      {
        elements: [
          savedDesignElement({ id: 'aurora' }),
          { id: 'b', type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10 },
        ],
      },
    );
    expect(mixed.status).toBe(400);
  });

  it('answers only GET, and only to a caller', async () => {
    const posted = await handlePageDesigns(ctxOf('POST', '/api/page-designs', {}, {}));
    expect(posted.status).toBe(404);
  });
});
