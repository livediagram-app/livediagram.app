import { describe, expect, it, vi } from 'vitest';
import type { DocumentSummary } from '@livediagram/api-schema';
import { fetchTeamLibraries, listAllDocuments, matchDocuments } from './find-documents';
import { createApiClient, type ApiClient } from '@livediagram/api-client';

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

function apiRouting(routes: Record<string, unknown | Error>): ApiClient & { calls: string[] } {
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
      '/teams/t1/library': { folders: [], documents: [summary({ id: 'a', teamId: 't1' })] },
      '/teams/t2/library': { folders: [], documents: [] },
    });
    const libs = await fetchTeamLibraries(api);
    expect(libs).toEqual([
      { teamName: 'Crew', documents: [summary({ id: 'a', teamId: 't1' })] },
      { teamName: 'Ops', documents: [] },
    ]);
  });

  it('collapses a failed teams listing to no team documents (personal search must survive)', async () => {
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
      '/teams/t2/library': { folders: [], documents: [summary({ id: 'b', teamId: 't2' })] },
    });
    const libs = await fetchTeamLibraries(api);
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

describe('listAllDocuments', () => {
  it('sweeps the personal library and every joined team, newest first', async () => {
    const api = apiRouting({
      '/documents': { documents: [summary({ id: 'p1', name: 'Mine', savedAt: 5 })] },
      '/teams': { teams: [{ id: 't1', name: 'Crew' }] },
      '/teams/t1/library': {
        folders: [],
        documents: [summary({ id: 'c1', name: 'Ours', savedAt: 9 })],
      },
    });
    expect(await listAllDocuments(api)).toEqual([
      { id: 'c1', name: 'Ours', updatedAt: 9, library: 'Crew' },
      { id: 'p1', name: 'Mine', updatedAt: 5, library: 'personal' },
    ]);
    expect(api.calls).toContain('/teams/t1/library');
  });
});
