import { describe, expect, it, vi } from 'vitest';
import { body, call, h, makeItem, person, useHarness } from './test-support';

useHarness();

// accounts' answer to the index's teams question: Ada joined team2 since her token was minted.
const accountsSays = (teams: string[]) => {
  h.appAnswer = (c) =>
    c.url.endsWith('/api/account/index/teams')
      ? Response.json({ teams: teams.map((id) => ({ id, name: id, role: 'member' })) })
      : new Response(null, { status: 200 });
};

describe('a team made or joined since the token was minted', () => {
  it('is usable at once: made in, listed and opened', async () => {
    const bea = await person('user_b', { teams: [{ id: 'team2' }] });
    const item = await makeItem(bea.auth, { teamId: 'team2' });
    const ada = await person('user_a', { teams: [] });
    accountsSays(['team2']);
    const made = await call('/items', {
      method: 'POST',
      auth: ada.auth,
      body: { app: 'liveplanner', teamId: 'team2' },
    });
    expect(made.status).toBe(201);
    expect((await call('/items?team=team2', { auth: ada.auth })).status).toBe(200);
    const grant = await call(`/items/${item.id}/grant`, {
      method: 'POST',
      auth: ada.auth,
      body: {},
    });
    expect(grant.status).toBe(200);
    // One question to accounts for the whole burst.
    expect(h.appCalls.filter((c) => c.url.endsWith('/index/teams'))).toHaveLength(1);
  });

  it('is still refused when accounts says they are not in it, and asks nothing for a team the claim holds', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    accountsSays([]);
    const ada = await person('user_a', { teams: [{ id: 'team1' }] });
    const res = await call('/items', {
      method: 'POST',
      auth: ada.auth,
      body: { app: 'liveplanner', teamId: 'team2' },
    });
    expect(await body(res)).toEqual({ error: 'not_team_member' });
    h.appCalls = [];
    await call('/items', {
      method: 'POST',
      auth: ada.auth,
      body: { app: 'liveplanner', teamId: 'team1' },
    });
    expect(h.appCalls.filter((c) => c.url.endsWith('/index/teams'))).toHaveLength(0);
  });
});
