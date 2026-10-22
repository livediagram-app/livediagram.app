// @vitest-environment jsdom

// The project list leaves the landing page its note of recent diagrams, and the thumbnail calls
// behind it and the Explorer (docs/specs/019-marketing/returning-visitor.md).

import { RECENT_DIAGRAMS_KEY, parseRecentDiagrams } from '@liveplanner/api-schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { __setOfflineBackend, offlineCreateProject } from '../offline/offline-store';
import { memBackend } from '../offline/offline-test-utils';
import {
  apiFetchProjectThumbnailSvg,
  apiFetchProjectThumbnailUrl,
  apiListProjects,
  apiListProjectsWithTeamRecent,
} from './projects';

const SVG = '<svg viewBox="0 0 4 2" width="400" height="200"><rect fill="#fafafa"/></svg>';

function stubFetch(answer: (url: string) => Response): string[] {
  const seen: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      seen.push(String(url));
      return answer(String(url));
    }),
  );
  return seen;
}

afterEach(() => {
  vi.unstubAllGlobals();
  __setOfflineBackend(null);
  localStorage.clear();
});

describe('apiListProjects', () => {
  it('leaves the note of recent diagrams for the landing page', async () => {
    __setOfflineBackend(memBackend());
    stubFetch(() =>
      Response.json({
        projects: [
          { id: 'old', name: 'Old', savedAt: 1, empty: false, opensIn: 'draw' },
          { id: 'new', name: 'New', savedAt: 2, empty: false, opensIn: null },
        ],
      }),
    );

    await apiListProjects('owner-recent');

    expect(parseRecentDiagrams(localStorage.getItem(RECENT_DIAGRAMS_KEY))).toEqual([
      { id: 'new', name: 'New', savedAt: 2, mode: null, teamName: null },
      // A retired mode is read as Plan, the only one.
      { id: 'old', name: 'Old', savedAt: 1, mode: 'plan', teamName: null },
    ]);
  });

  it('asks for the team projects and notes them with their team, newest first', async () => {
    __setOfflineBackend(memBackend());
    const seen = stubFetch(() =>
      Response.json({
        projects: [{ id: 'mine', name: 'Mine', savedAt: 1, empty: false, opensIn: null }],
        teamRecent: [
          {
            id: 'team',
            name: 'Team',
            savedAt: 3,
            empty: false,
            opensIn: 'plan',
            teamName: 'Design',
          },
        ],
      }),
    );

    // The personal library never mixes in the team ones; only the recent note does.
    expect((await apiListProjects('owner-team')).map((d) => d.id)).toEqual(['mine']);

    expect(seen[0]).toMatch(/\/projects\?include=team-recent$/);
    expect(parseRecentDiagrams(localStorage.getItem(RECENT_DIAGRAMS_KEY))).toEqual([
      { id: 'team', name: 'Team', savedAt: 3, mode: 'plan', teamName: 'Design' },
      { id: 'mine', name: 'Mine', savedAt: 1, mode: null, teamName: null },
    ]);
  });

  it('reads a list without team projects (an older api) as none', async () => {
    __setOfflineBackend(memBackend());
    stubFetch(() => Response.json({ projects: [] }));
    expect(await apiListProjectsWithTeamRecent('owner-old-api')).toEqual({
      projects: [],
      teamRecent: [],
    });
  });
});

describe('apiListProjects thumbnails', () => {
  it('never asks the server for an offline project’s snapshot, and draws it here instead', async () => {
    // docs/specs/006-project/offline-mode.md: offline rows never trigger a server fetch.
    __setOfflineBackend(memBackend());
    await offlineCreateProject(
      {
        id: 'local',
        name: 'Local',
        tabs: [
          {
            id: 't',
            name: 't',
            elements: [
              {
                id: 'a',
                type: 'shape',
                shape: 'rectangle',
                x: 0,
                y: 0,
                width: 80,
                height: 40,
              } as never,
            ],
          },
        ],
      },
      5,
    );
    const stored = new Map<string, Response>();
    vi.stubGlobal('caches', {
      open: async () => ({
        keys: async () => [],
        match: async (url: string) => stored.get(url),
        put: async (url: string, res: Response) => void stored.set(url, res),
        delete: async () => true,
      }),
    });
    const seen = stubFetch((url) =>
      url.includes('/thumbnail')
        ? new Response(SVG)
        : Response.json({
            projects: [{ id: 'cloud', name: 'Cloud', savedAt: 1, empty: false, opensIn: null }],
          }),
    );

    await apiListProjects('owner-thumbs');
    // Both diagrams' entries land: the cloud one's snapshot from the server, the local one drawn in the
    // browser (lib/local-snapshot.ts). (An earlier list's idle pass may add its own entries; only these
    // two are asserted.)
    const cachedFor = (id: string) => [...stored.keys()].some((url) => url.includes(id));
    await vi.waitFor(() => expect(cachedFor('cloud') && cachedFor('local')).toBe(true), {
      timeout: 5000,
    });

    const thumbnails = seen.filter((u) => u.includes('/thumbnail'));
    expect(thumbnails).toContainEqual(expect.stringMatching(/\/projects\/cloud\/thumbnail/));
    expect(thumbnails.filter((u) => u.includes('/projects/local/'))).toEqual([]);
    const local = [...stored.entries()].find(([url]) => url.includes('local'))![1];
    expect(local.ok).toBe(true);
    expect(await local.text()).toMatch(/^<svg/);
  });
});

describe('apiFetchProjectThumbnailSvg', () => {
  it('returns the snapshot text, versioned by save', async () => {
    const seen = stubFetch(() => new Response(SVG));

    expect(await apiFetchProjectThumbnailSvg('owner', 'd 1', { version: 7 })).toBe(SVG);
    expect(seen[0]).toMatch(/\/projects\/d%201\/thumbnail\?v=7$/);
  });

  it('is null when the server has no snapshot', async () => {
    stubFetch(() => new Response('', { status: 404 }));

    expect(await apiFetchProjectThumbnailSvg('owner', 'd1')).toBeNull();
  });
});

describe('apiFetchProjectThumbnailUrl', () => {
  it('hands back a blob URL of the scalable snapshot and its background colour', async () => {
    stubFetch(() => new Response(SVG));
    const blobs: Blob[] = [];
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: (b: Blob) => (blobs.push(b), 'blob:thumb'),
    });

    const thumb = await apiFetchProjectThumbnailUrl('owner', 'd1');

    expect(thumb).toEqual({ url: 'blob:thumb', backgroundColor: '#fafafa' });
    expect(await blobs[0]!.text()).toBe('<svg viewBox="0 0 4 2"><rect fill="#fafafa"/></svg>');
  });

  it('is null when there is no snapshot', async () => {
    stubFetch(() => new Response('', { status: 403 }));

    expect(await apiFetchProjectThumbnailUrl('owner', 'd1')).toBeNull();
  });
});
