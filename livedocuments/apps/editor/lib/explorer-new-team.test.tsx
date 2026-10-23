// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const bearer = vi.hoisted(() => ({ token: 'tok' as string | null }));
vi.mock('./api/core', () => ({
  API_BASE: '/api',
  apiFetch: (input: string, init?: RequestInit) => fetch(input, init),
  currentBearer: async () => bearer.token,
}));

import { createTeam, useExplorerNewTeam } from './explorer-new-team';

afterEach(() => {
  vi.unstubAllGlobals();
  bearer.token = 'tok';
});

describe('New Team in the Move dialog', () => {
  it("makes the team through this app's API as the person", async () => {
    const fetch = vi.fn(async () =>
      Response.json({ team: { id: 'team_new', name: 'Studio' } }, { status: 201 }),
    );
    vi.stubGlobal('fetch', fetch);
    expect(await createTeam('Studio')).toEqual({ id: 'team_new', name: 'Studio' });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/teams');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok');
    expect(JSON.parse(init.body as string)).toEqual({ name: 'Studio' });
  });

  it('answers null when refused or without a person', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'nope' }, { status: 403 })));
    expect(await createTeam('Studio')).toBeNull();
    bearer.token = null;
    expect(await createTeam('Studio')).toBeNull();
  });

  it('adds the made team to the teams, and offers New Team only when signed in', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ team: { id: 'team_new', name: 'Studio' } })),
    );
    const mine = [{ id: 'team_a', name: 'A' }];
    const { result } = renderHook(() => useExplorerNewTeam(true, mine));
    expect(result.current.teams).toBe(mine);
    await act(async () => {
      await result.current.onCreateTeam!('Studio');
    });
    expect(result.current.teams.map((t) => t.id)).toEqual(['team_a', 'team_new']);
    expect(renderHook(() => useExplorerNewTeam(false, [])).result.current.onCreateTeam).toBe(
      undefined,
    );
  });
});
