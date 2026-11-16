// The edges of the person's own routes (personal.ts): who reaches an item at all (an app's or the Drive mirror's
// delegate, a team the token does not yet list), a foreign key lost between the read and the write, and the paths
// that answer 404 or 400. Called with a context built here, so a delegate and a failing database are one line each.
import { describe, expect, it } from 'vitest';
import type { Person } from './auth';
import type { PersonContext } from './context';
import type { Env } from './env';
import { handleFavourites, handlePlacementDefaults, handleRecentHidden } from './personal';
import { h, useHarness } from './test-support';

useHarness();

const ADA: Person = { id: 'user_ada', kind: 'account', teams: [] };

function ctx(
  person: Person,
  method: string,
  path: string,
  options: { body?: unknown; env?: Env } = {},
): PersonContext {
  const url = new URL(`https://liveworkspace.app/api/index${path}`);
  const request = new Request(url, {
    method,
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body), headers: { 'Content-Type': 'application/json' } }),
  });
  return {
    request,
    env: options.env ?? h.db.env,
    url,
    segments: url.pathname.replace('/api/index/', '').split('/').filter(Boolean),
    caller: {} as never,
    waitUntil: () => {},
    drive: new Set(),
    person,
  };
}

function item(
  id: string,
  over: Partial<{
    app: string;
    owner: string;
    team: string | null;
    trashed: number | null;
    archived: number | null;
  }> = {},
) {
  const team = over.team ?? null;
  const owner = over.owner ?? ADA.id;
  h.db.sql
    .prepare(
      `INSERT INTO items (id, app, kind, owner_id, team_id, scope, title, created_at, updated_at, trashed_at, archived_at)
       VALUES (?, ?, 'plan', ?, ?, ?, 'T', 1, 1, ?, ?)`,
    )
    .run(
      id,
      over.app ?? 'liveplanner',
      owner,
      team,
      team ? `t:${team}` : `p:${owner}`,
      over.trashed ?? null,
      over.archived ?? null,
    );
}

// A database whose writes of one kind fail with `message`, every read as it was.
function failing(match: RegExp, message: string, on: 'run' | 'batch'): Env {
  const real = h.db.env.INDEX_DB;
  const db = new Proxy(real, {
    get(target, prop) {
      if (prop === 'batch' && on === 'batch') return () => Promise.reject(new Error(message));
      if (prop === 'prepare') {
        return (sql: string) => {
          const stmt = target.prepare(sql);
          if (on !== 'run' || !match.test(sql)) return stmt;
          return { bind: () => ({ run: () => Promise.reject(new Error(message)) }) };
        };
      }
      const value = Reflect.get(target, prop);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return { ...h.db.env, INDEX_DB: db as never };
}

const status = async (c: PersonContext, handler: (c: PersonContext) => Promise<Response>) =>
  (await handler(c)).status;

describe('who reaches an item to star or hide it', () => {
  it('refuses an app’s delegate for another app’s item, and the Drive mirror for a team’s or another’s', async () => {
    item('i1', { app: 'livediagram' });
    item('i2', { team: 'team1' });
    item('i3', { owner: 'user_bob' });
    const app = { ...ADA, app: 'liveplanner' } as Person;
    expect(await status(ctx(app, 'PUT', '/favourites/i1'), handleFavourites)).toBe(404);
    const drive = { ...ADA, drive: true } as Person;
    expect(await status(ctx(drive, 'PUT', '/favourites/i2'), handleFavourites)).toBe(404);
    expect(await status(ctx(drive, 'PUT', '/favourites/i3'), handleFavourites)).toBe(404);
    expect(await status(ctx(drive, 'PUT', '/favourites/i1'), handleFavourites)).toBe(204);
  });

  it('reaches a team’s item through a team the token lacks only when accounts says they joined', async () => {
    item('t1', { team: 'team9' });
    // Accounts is asked, and the person is in the team now.
    const joined: Person = { id: 'user_new', kind: 'account', teams: [] };
    const stubbed = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input instanceof Request ? input.url : input).includes('/index/teams')
        ? Response.json({ teams: [{ id: 'team9', name: 'Nine', role: 'member' }] })
        : stubbed(input, init)) as typeof fetch;
    try {
      expect(await status(ctx(joined, 'PUT', '/favourites/t1'), handleFavourites)).toBe(204);
    } finally {
      globalThis.fetch = stubbed;
    }
  });

  it('keeps a trashed item out of reach of someone it was only shared with', async () => {
    item('gone', { owner: 'user_bob', trashed: 5 });
    expect(await status(ctx(ADA, 'PUT', '/favourites/gone'), handleFavourites)).toBe(404);
  });
});

describe('favourites', () => {
  it('refuses a page size or cursor it cannot read', async () => {
    expect(await status(ctx(ADA, 'GET', '/favourites?limit=0'), handleFavourites)).toBe(400);
    expect(await status(ctx(ADA, 'GET', '/favourites?cursor=%25'), handleFavourites)).toBe(400);
  });

  it('answers 404 for an id it cannot read, and for a method it does not take', async () => {
    expect(await status(ctx(ADA, 'PUT', '/favourites/bad%20id'), handleFavourites)).toBe(404);
    item('i1');
    expect(await status(ctx(ADA, 'POST', '/favourites/i1'), handleFavourites)).toBe(404);
    expect(await status(ctx(ADA, 'GET', '/favourites/i1/more'), handleFavourites)).toBe(404);
  });

  it('answers 404 when the item goes between the read and the write, and rethrows anything else', async () => {
    item('i1');
    const lost = failing(/./, 'FOREIGN KEY constraint failed', 'batch');
    expect(await status(ctx(ADA, 'PUT', '/favourites/i1', { env: lost }), handleFavourites)).toBe(
      404,
    );
    const broken = failing(/./, 'disk gone', 'batch');
    await expect(
      handleFavourites(ctx(ADA, 'PUT', '/favourites/i1', { env: broken })),
    ).rejects.toThrow('disk gone');
  });
});

describe('hidden from Recent', () => {
  it('refuses a path or method it does not take', async () => {
    expect(await status(ctx(ADA, 'PUT', '/recent-hidden'), handleRecentHidden)).toBe(404);
    expect(await status(ctx(ADA, 'PUT', '/recent-hidden/bad%20id'), handleRecentHidden)).toBe(404);
    item('i1');
    expect(await status(ctx(ADA, 'GET', '/recent-hidden/i1'), handleRecentHidden)).toBe(404);
  });

  it('answers 404 for an item out of reach, and refuses an archived one', async () => {
    item('theirs', { owner: 'user_bob' });
    expect(await status(ctx(ADA, 'PUT', '/recent-hidden/theirs'), handleRecentHidden)).toBe(404);
    item('old', { archived: 5 });
    expect(await status(ctx(ADA, 'PUT', '/recent-hidden/old'), handleRecentHidden)).toBe(409);
  });

  it('hides and shows an item, and answers 404 when it goes between the read and the write', async () => {
    item('i1');
    expect(await status(ctx(ADA, 'PUT', '/recent-hidden/i1'), handleRecentHidden)).toBe(204);
    expect(await status(ctx(ADA, 'DELETE', '/recent-hidden/i1'), handleRecentHidden)).toBe(204);
    const lost = failing(/INSERT INTO opens/, 'FOREIGN KEY constraint failed', 'run');
    expect(
      await status(ctx(ADA, 'PUT', '/recent-hidden/i1', { env: lost }), handleRecentHidden),
    ).toBe(404);
    const broken = failing(/INSERT INTO opens/, 'disk gone', 'run');
    await expect(
      handleRecentHidden(ctx(ADA, 'PUT', '/recent-hidden/i1', { env: broken })),
    ).rejects.toThrow('disk gone');
  });
});

describe('placement defaults', () => {
  it('refuses a key, a body or a folder it cannot take', async () => {
    expect(await status(ctx(ADA, 'PUT', '/placement-defaults/-bad'), handlePlacementDefaults)).toBe(
      400,
    );
    expect(
      await status(ctx(ADA, 'PUT', '/placement-defaults/mode:plan'), handlePlacementDefaults),
    ).toBe(400);
    expect(
      await status(
        ctx(ADA, 'PUT', '/placement-defaults/mode:plan', { body: { folderId: 'nope' } }),
        handlePlacementDefaults,
      ),
    ).toBe(404);
  });

  it('answers 404 for a path or method it does not take, and clears a default', async () => {
    expect(await status(ctx(ADA, 'GET', '/placement-defaults/a/b'), handlePlacementDefaults)).toBe(
      404,
    );
    expect(await status(ctx(ADA, 'POST', '/placement-defaults'), handlePlacementDefaults)).toBe(
      404,
    );
    expect(
      await status(ctx(ADA, 'GET', '/placement-defaults/mode:plan'), handlePlacementDefaults),
    ).toBe(404);
    expect(
      await status(ctx(ADA, 'DELETE', '/placement-defaults/mode:plan'), handlePlacementDefaults),
    ).toBe(204);
  });
});
