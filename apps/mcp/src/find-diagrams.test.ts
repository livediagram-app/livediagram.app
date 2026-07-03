import { describe, expect, it, vi } from 'vitest';
import type { DiagramSummary } from '@livediagram/api-schema';
import { fetchTeamLibraries, matchDiagrams } from './find-diagrams';
import type { Env } from './env';

function summary(overrides: Partial<DiagramSummary>): DiagramSummary {
  return {
    id: 'd1',
    ownerId: 'user-1',
    name: 'Untitled',
    shareable: false,
    shareCode: null,
    folderId: null,
    teamId: null,
    source: null,
    savedAt: 1,
    createdAt: 1,
    ...overrides,
  };
}

function envRouting(routes: Record<string, unknown | Error>): Env {
  return {
    API: {
      fetch: vi.fn(async (req: Request) => {
        const path = new URL(req.url).pathname.replace(/^\/api/, '');
        const hit = routes[path];
        if (hit === undefined) return new Response('not found', { status: 404 });
        if (hit instanceof Error) return new Response(hit.message, { status: 500 });
        return new Response(JSON.stringify(hit), {
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    } as unknown as Fetcher,
    OAUTH_KV: {} as KVNamespace,
  };
}

describe('fetchTeamLibraries', () => {
  it('returns each joined team’s shared library with its team name', async () => {
    const env = envRouting({
      '/teams': {
        teams: [
          { id: 't1', name: 'Crew' },
          { id: 't2', name: 'Ops' },
        ],
      },
      '/teams/t1/library': { folders: [], diagrams: [summary({ id: 'a', teamId: 't1' })] },
      '/teams/t2/library': { folders: [], diagrams: [] },
    });
    const libs = await fetchTeamLibraries(env, 'lvd_x');
    expect(libs).toEqual([
      { teamName: 'Crew', diagrams: [summary({ id: 'a', teamId: 't1' })] },
      { teamName: 'Ops', diagrams: [] },
    ]);
  });

  it('collapses a failed teams listing to no team diagrams (personal search must survive)', async () => {
    const env = envRouting({});
    expect(await fetchTeamLibraries(env, 'lvd_x')).toEqual([]);
  });

  it('collapses one failed library fetch without dropping the other teams', async () => {
    const env = envRouting({
      '/teams': {
        teams: [
          { id: 't1', name: 'Crew' },
          { id: 't2', name: 'Ops' },
        ],
      },
      '/teams/t2/library': { folders: [], diagrams: [summary({ id: 'b', teamId: 't2' })] },
    });
    const libs = await fetchTeamLibraries(env, 'lvd_x');
    expect(libs).toEqual([
      { teamName: 'Crew', diagrams: [] },
      { teamName: 'Ops', diagrams: [summary({ id: 'b', teamId: 't2' })] },
    ]);
  });
});

describe('matchDiagrams', () => {
  const personal = [
    summary({ id: 'p1', name: 'Auth flow', savedAt: 30 }),
    summary({ id: 'p2', name: 'Roadmap', savedAt: 10 }),
  ];
  const teamLibs = [
    { teamName: 'Crew', diagrams: [summary({ id: 'c1', name: 'Auth service map', savedAt: 20 })] },
  ];

  it('merges personal + team diagrams, newest saved first, labelled by library', async () => {
    expect(matchDiagrams(personal, teamLibs, undefined, 20)).toEqual([
      { id: 'p1', name: 'Auth flow', updatedAt: 30, library: 'personal' },
      { id: 'c1', name: 'Auth service map', updatedAt: 20, library: 'Crew' },
      { id: 'p2', name: 'Roadmap', updatedAt: 10, library: 'personal' },
    ]);
  });

  it('name-matches the query case-insensitively across both libraries', () => {
    const hits = matchDiagrams(personal, teamLibs, 'AUTH', 20);
    expect(hits.map((h) => h.id)).toEqual(['p1', 'c1']);
  });

  it('caps at the limit after ranking', () => {
    const hits = matchDiagrams(personal, teamLibs, undefined, 2);
    expect(hits.map((h) => h.id)).toEqual(['p1', 'c1']);
  });
});
