import { describe, expect, it, vi } from 'vitest';
import type { DocumentSummary } from '@livediagram/api-schema';
import { fetchTeamLibraries, matchDocuments } from './find-documents';
import type { Env } from './env';

function summary(overrides: Partial<DocumentSummary>): DocumentSummary {
  return {
    id: 'd1',
    ownerId: 'user-1',
    name: 'Untitled',
    shareable: false,
    shareCode: null,
    folderId: null,
    teamId: null,
    source: null,
    opensIn: null,
    tabKind: null,
    templateFamily: null,
    savedAt: 1,
    createdAt: 1,
    empty: false,
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
      '/teams/t1/library': { folders: [], documents: [summary({ id: 'a', teamId: 't1' })] },
      '/teams/t2/library': { folders: [], documents: [] },
    });
    const libs = await fetchTeamLibraries(env, 'lvd_x');
    expect(libs).toEqual([
      { teamName: 'Crew', documents: [summary({ id: 'a', teamId: 't1' })] },
      { teamName: 'Ops', documents: [] },
    ]);
  });

  it('collapses a failed teams listing to no team documents (personal search must survive)', async () => {
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
      '/teams/t2/library': { folders: [], documents: [summary({ id: 'b', teamId: 't2' })] },
    });
    const libs = await fetchTeamLibraries(env, 'lvd_x');
    expect(libs).toEqual([
      { teamName: 'Crew', documents: [] },
      { teamName: 'Ops', documents: [summary({ id: 'b', teamId: 't2' })] },
    ]);
  });
});

describe('matchDocuments', () => {
  const personal = [
    summary({ id: 'p1', name: 'Auth flow', savedAt: 30 }),
    summary({ id: 'p2', name: 'Roadmap', savedAt: 10 }),
  ];
  const teamLibs = [
    { teamName: 'Crew', documents: [summary({ id: 'c1', name: 'Auth service map', savedAt: 20 })] },
  ];

  it('merges personal + team documents, newest saved first, labelled by library', async () => {
    expect(matchDocuments(personal, teamLibs, undefined, 20)).toEqual([
      { id: 'p1', name: 'Auth flow', updatedAt: 30, library: 'personal' },
      { id: 'c1', name: 'Auth service map', updatedAt: 20, library: 'Crew' },
      { id: 'p2', name: 'Roadmap', updatedAt: 10, library: 'personal' },
    ]);
  });

  it('name-matches the query case-insensitively across both libraries', () => {
    const hits = matchDocuments(personal, teamLibs, 'AUTH', 20);
    expect(hits.map((h) => h.id)).toEqual(['p1', 'c1']);
  });

  it('caps at the limit after ranking', () => {
    const hits = matchDocuments(personal, teamLibs, undefined, 2);
    expect(hits.map((h) => h.id)).toEqual(['p1', 'c1']);
  });
});
