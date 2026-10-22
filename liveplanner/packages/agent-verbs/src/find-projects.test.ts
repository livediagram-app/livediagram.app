import { describe, expect, it, vi } from 'vitest';
import type { ProjectSummary } from '@liveplanner/api-schema';
import {
  fetchTeamLibraries,
  listAllProjects,
  matchProjects,
  readLibraries,
} from './find-projects';
import { createApiClient, type ApiClient } from '@liveplanner/api-client';

function summary(overrides: Partial<ProjectSummary>): ProjectSummary {
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
    stats: null,
    ...overrides,
  };
}

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
      '/teams/t1/library': { folders: [], projects: [summary({ id: 'a', teamId: 't1' })] },
      '/teams/t2/library': { folders: [], projects: [] },
    });
    const libs = await fetchTeamLibraries(api);
    expect(libs).toEqual([
      { teamName: 'Crew', projects: [summary({ id: 'a', teamId: 't1' })] },
      { teamName: 'Ops', projects: [] },
    ]);
  });

  it('collapses a failed teams listing to no team projects (personal search must survive)', async () => {
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
      '/teams/t2/library': { folders: [], projects: [summary({ id: 'b', teamId: 't2' })] },
    });
    const libs = await fetchTeamLibraries(api);
    expect(libs).toEqual([
      { teamName: 'Crew', projects: [] },
      { teamName: 'Ops', projects: [summary({ id: 'b', teamId: 't2' })] },
    ]);
  });
});

describe('matchProjects', () => {
  const personal = [
    summary({ id: 'p1', name: 'Auth flow', savedAt: 30 }),
    summary({ id: 'p2', name: 'Roadmap', savedAt: 10 }),
  ];
  const teamLibs = [
    { teamName: 'Crew', projects: [summary({ id: 'c1', name: 'Auth service map', savedAt: 20 })] },
  ];

  it('merges personal + team projects, newest saved first, labelled by library', async () => {
    expect(matchProjects(personal, teamLibs, undefined, 20)).toEqual([
      { id: 'p1', name: 'Auth flow', updatedAt: 30, library: 'personal' },
      { id: 'c1', name: 'Auth service map', updatedAt: 20, library: 'Crew' },
      { id: 'p2', name: 'Roadmap', updatedAt: 10, library: 'personal' },
    ]);
  });

  it('name-matches the query case-insensitively across both libraries', () => {
    const hits = matchProjects(personal, teamLibs, 'AUTH', 20);
    expect(hits.map((h) => h.id)).toEqual(['p1', 'c1']);
  });

  it('caps at the limit after ranking', () => {
    const hits = matchProjects(personal, teamLibs, undefined, 2);
    expect(hits.map((h) => h.id)).toEqual(['p1', 'c1']);
  });
});

describe('listAllProjects', () => {
  it('sweeps the personal library and every joined team, newest first', async () => {
    const api = apiRouting({
      '/projects': { projects: [summary({ id: 'p1', name: 'Mine', savedAt: 5 })] },
      '/teams': { teams: [{ id: 't1', name: 'Crew' }] },
      '/teams/t1/library': {
        folders: [],
        projects: [summary({ id: 'c1', name: 'Ours', savedAt: 9 })],
      },
    });
    expect(await listAllProjects(api)).toEqual([
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

  it('reads the personal projects and folders and each joined team’s, in one sweep', async () => {
    const api = apiRouting({
      '/projects': { projects: [summary({ id: 'p1' })] },
      '/folders': { folders: [folder('f1', 'Games', null, null)] },
      '/teams': { teams: [{ id: 't1', name: 'Crew' }] },
      '/teams/t1/library': {
        folders: [folder('f2', 'Shared', null, 't1')],
        projects: [summary({ id: 'a', teamId: 't1', folderId: 'f2' })],
      },
    });
    expect(await readLibraries(api)).toEqual({
      personal: {
        projects: [summary({ id: 'p1' })],
        folders: [folder('f1', 'Games', null, null)],
      },
      teams: [
        {
          id: 't1',
          name: 'Crew',
          projects: [summary({ id: 'a', teamId: 't1', folderId: 'f2' })],
          folders: [folder('f2', 'Shared', null, 't1')],
        },
      ],
    });
  });

  it('degrades a team that fails to no projects and no folders, and no teams to none', async () => {
    const failing = apiRouting({
      '/projects': { projects: [] },
      '/folders': { folders: [] },
      '/teams': { teams: [{ id: 't1', name: 'Crew' }] },
      '/teams/t1/library': new Error('boom'),
    });
    expect((await readLibraries(failing)).teams).toEqual([
      { id: 't1', name: 'Crew', projects: [], folders: [] },
    ]);
    const noTeams = apiRouting({
      '/projects': { projects: [] },
      '/folders': { folders: [] },
      '/teams': new Error('boom'),
    });
    expect((await readLibraries(noTeams)).teams).toEqual([]);
  });
});
