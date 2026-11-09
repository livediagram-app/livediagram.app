import { describe, expect, it, vi } from 'vitest';
import { createApiClient, type ApiClient } from '@liveworkspace/api-client';
import { createFind } from './find';
import { TEST_PRODUCT } from './testing/product';

// A product's summary carries more than the sweep reads; the extra fields pass through untouched.
type Summary = {
  id: string;
  name: string;
  savedAt: number;
  folderId: string | null;
  teamId: string | null;
};
type Folder = { id: string; name: string; parentId: string | null };

function summary(overrides: Partial<Summary>): Summary {
  return { id: 'd1', name: 'Untitled', folderId: null, teamId: null, savedAt: 1, ...overrides };
}

const { fetchTeamLibraries, listAllFiles, matchFiles, readLibraries, searchFiles } = createFind<
  Summary,
  Folder,
  'sketches'
>(TEST_PRODUCT);

// Each path answers its body as JSON, or a 500 with the message when it is an Error.
function apiRouting(routes: Record<string, unknown>): ApiClient & { calls: string[] } {
  const calls: string[] = [];
  const api = createApiClient({
    baseUrl: 'https://x/api',
    headers: () => ({}),
    fetch: vi.fn(async (req: Request) => {
      const path = new URL(req.url).pathname.replace(/^\/api/, '');
      calls.push(path);
      const hit = routes[path];
      if (hit === undefined) return new Response('not found', { status: 404 });
      if (hit instanceof Error) return new Response(hit.message, { status: 500 });
      return Response.json(hit);
    }),
  });
  return Object.assign(api, { calls });
}

describe('fetchTeamLibraries', () => {
  it('returns each joined team’s shared library with its team name', async () => {
    const api = apiRouting({
      '/teams': {
        teams: [
          { id: 't1', name: 'Crew' },
          { id: 't2', name: 'Ops' },
        ],
      },
      '/teams/t1/library': { folders: [], sketches: [summary({ id: 'a', teamId: 't1' })] },
      '/teams/t2/library': { folders: [], sketches: [] },
    });
    const libs = await fetchTeamLibraries(api);
    expect(libs).toEqual([
      { teamName: 'Crew', sketches: [summary({ id: 'a', teamId: 't1' })] },
      { teamName: 'Ops', sketches: [] },
    ]);
  });

  it('collapses a failed teams listing to no team sketches (personal search must survive)', async () => {
    const api = apiRouting({});
    expect(await fetchTeamLibraries(api)).toEqual([]);
  });

  it('collapses one failed library fetch without dropping the other teams', async () => {
    const api = apiRouting({
      '/teams': {
        teams: [
          { id: 't1', name: 'Crew' },
          { id: 't2', name: 'Ops' },
        ],
      },
      '/teams/t2/library': { folders: [], sketches: [summary({ id: 'b', teamId: 't2' })] },
    });
    const libs = await fetchTeamLibraries(api);
    expect(libs).toEqual([
      { teamName: 'Crew', sketches: [] },
      { teamName: 'Ops', sketches: [summary({ id: 'b', teamId: 't2' })] },
    ]);
  });
});

describe('matchFiles', () => {
  const personal = [
    summary({ id: 'p1', name: 'Auth flow', savedAt: 30 }),
    summary({ id: 'p2', name: 'Roadmap', savedAt: 10 }),
  ];
  const teamLibs = [
    { teamName: 'Crew', sketches: [summary({ id: 'c1', name: 'Auth service map', savedAt: 20 })] },
  ];

  it('merges personal + team sketches, newest saved first, labelled by library', async () => {
    expect(matchFiles(personal, teamLibs, undefined, 20)).toEqual([
      { id: 'p1', name: 'Auth flow', updatedAt: 30, library: 'personal' },
      { id: 'c1', name: 'Auth service map', updatedAt: 20, library: 'Crew' },
      { id: 'p2', name: 'Roadmap', updatedAt: 10, library: 'personal' },
    ]);
  });

  it('name-matches the query case-insensitively across both libraries', () => {
    const hits = matchFiles(personal, teamLibs, 'AUTH', 20);
    expect(hits.map((h) => h.id)).toEqual(['p1', 'c1']);
  });

  it('caps at the limit after ranking', () => {
    const hits = matchFiles(personal, teamLibs, undefined, 2);
    expect(hits.map((h) => h.id)).toEqual(['p1', 'c1']);
  });
});

describe('listAllFiles', () => {
  it('sweeps the personal library and every joined team, newest first', async () => {
    const api = apiRouting({
      '/sketches': { sketches: [summary({ id: 'p1', name: 'Mine', savedAt: 5 })] },
      '/teams': { teams: [{ id: 't1', name: 'Crew' }] },
      '/teams/t1/library': {
        folders: [],
        sketches: [summary({ id: 'c1', name: 'Ours', savedAt: 9 })],
      },
    });
    expect(await listAllFiles(api)).toEqual([
      { id: 'c1', name: 'Ours', updatedAt: 9, library: 'Crew' },
      { id: 'p1', name: 'Mine', updatedAt: 5, library: 'personal' },
    ]);
    expect(api.calls).toContain('/teams/t1/library');
  });
});

describe('readLibraries', () => {
  const folder = (id: string, name: string, parentId: string | null, teamId: string | null) => ({
    id,
    ownerId: 'user-1',
    parentId,
    teamId,
    name,
    createdAt: 1,
    updatedAt: 1,
  });

  it('reads the personal sketches and folders and each joined team’s, in one sweep', async () => {
    const api = apiRouting({
      '/sketches': { sketches: [summary({ id: 'p1' })] },
      '/folders': { folders: [folder('f1', 'Games', null, null)] },
      '/teams': { teams: [{ id: 't1', name: 'Crew' }] },
      '/teams/t1/library': {
        folders: [folder('f2', 'Shared', null, 't1')],
        sketches: [summary({ id: 'a', teamId: 't1', folderId: 'f2' })],
      },
    });
    expect(await readLibraries(api)).toEqual({
      personal: {
        sketches: [summary({ id: 'p1' })],
        folders: [folder('f1', 'Games', null, null)],
      },
      teams: [
        {
          id: 't1',
          name: 'Crew',
          sketches: [summary({ id: 'a', teamId: 't1', folderId: 'f2' })],
          folders: [folder('f2', 'Shared', null, 't1')],
        },
      ],
    });
  });

  it('degrades a team that fails to no sketches and no folders, and no teams to none', async () => {
    const failing = apiRouting({
      '/sketches': { sketches: [] },
      '/folders': { folders: [] },
      '/teams': { teams: [{ id: 't1', name: 'Crew' }] },
      '/teams/t1/library': new Error('boom'),
    });
    expect((await readLibraries(failing)).teams).toEqual([
      { id: 't1', name: 'Crew', sketches: [], folders: [] },
    ]);
    const noTeams = apiRouting({
      '/sketches': { sketches: [] },
      '/folders': { folders: [] },
      '/teams': new Error('boom'),
    });
    expect((await readLibraries(noTeams)).teams).toEqual([]);
  });
});

describe('searchFiles', () => {
  // Each request (path and query) answers its body as JSON, or a status with no body when it is a number.
  function api(routes: Record<string, unknown>): ApiClient & { calls: string[] } {
    const calls: string[] = [];
    const client = createApiClient({
      baseUrl: 'https://x/api',
      headers: () => ({}),
      fetch: vi.fn(async (req: Request) => {
        const url = new URL(req.url);
        const key = `${url.pathname.replace(/^\/api/, '')}${url.search}`;
        calls.push(key);
        const hit = routes[key];
        if (hit === undefined) return new Response('not found', { status: 404 });
        if (typeof hit === 'number')
          return Response.json({ error: 'invalid_query' }, { status: hit });
        return Response.json(hit);
      }),
    });
    return Object.assign(client, { calls });
  }
  const TEAMS = { teams: [{ id: 't1', name: 'Crew' }] };

  it('asks the index once for every library, searched and capped, and names each library', async () => {
    const client = api({
      '/sketches?team=all&limit=5&q=road+map': {
        sketches: [
          summary({ id: 'b', name: 'Road map', teamId: 't1', savedAt: 9 }),
          summary({ id: 'a', name: 'Map of the road', savedAt: 5 }),
          summary({ id: 'c', name: 'Road map', teamId: 'gone', savedAt: 3 }),
        ],
      },
      '/teams': TEAMS,
    });
    expect(await searchFiles(client, '  road map ', 5)).toEqual([
      { id: 'b', name: 'Road map', updatedAt: 9, library: 'Crew' },
      { id: 'a', name: 'Map of the road', updatedAt: 5, library: 'personal' },
      { id: 'c', name: 'Road map', updatedAt: 3, library: 'gone' },
    ]);
    expect(client.calls.sort()).toEqual(['/sketches?team=all&limit=5&q=road+map', '/teams']);
  });

  it('lists the newest without a query, and names teams by id when the teams list fails', async () => {
    const client = api({
      '/sketches?team=all&limit=2': { sketches: [summary({ id: 'a', teamId: 't1' })] },
      '/teams': 500,
    });
    expect(await searchFiles(client, undefined, 2)).toEqual([
      { id: 'a', name: 'Untitled', updatedAt: 1, library: 't1' },
    ]);
  });

  it('matches a query the index would fold differently, or refuses, over the sweep', async () => {
    const sweep = {
      '/sketches': {
        sketches: [summary({ id: 'a', name: 'Über plan' }), summary({ id: 'b', name: 'Plan' })],
      },
      '/teams': TEAMS,
      '/teams/t1/library': {
        folders: [],
        sketches: [summary({ id: 'c', name: 'über', savedAt: 4 })],
      },
    };
    const accented = api(sweep);
    expect((await searchFiles(accented, 'ÜBER', 5)).map((f) => f.id)).toEqual(['c', 'a']);
    expect(accented.calls).not.toContain(expect.stringContaining('team=all'));
    const long = 'plan '.repeat(20).trim();
    const refused = api({
      ...sweep,
      [`/sketches?team=all&limit=5&q=${long.replace(/ /g, '+')}`]: 400,
    });
    expect(await searchFiles(refused, long, 5)).toEqual([]);
    expect(refused.calls).toContain('/teams/t1/library');
  });

  it('passes any other failure on', async () => {
    const client = api({ '/sketches?team=all&limit=5': 503, '/teams': TEAMS });
    await expect(searchFiles(client, '', 5)).rejects.toThrow('api 503');
  });
});
