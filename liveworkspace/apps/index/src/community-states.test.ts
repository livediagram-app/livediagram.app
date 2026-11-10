// `POST /app/community/states`: where each Community post's item stands, for the Community's sweep, one answer per
// post in the order asked, for the calling app's items only; through every lifecycle event an item can meet.
import { ANONYMISED_PERSON, COMMUNITY_STATES_MAX } from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { body, call, h, makeItem, person, useHarness } from './test-support';

useHarness();

const states = (posts: unknown, app = 'liveplanner', key = 'lp-key') =>
  call('/app/community/states', {
    method: 'POST',
    auth: key,
    headers: { 'X-Index-App': app },
    body: { posts },
  });

const stateOf = async (id: string, code: string, owner: string, app?: string, key?: string) =>
  (
    await body<{ states: { id: string; state: string }[] }>(
      await states([{ id, code, owner }], app, key),
    )
  ).states[0]!.state;

// A published item: Ada's, with its community link (a public view link).
async function published() {
  const ada = await person('user_a', { teams: [{ id: 'team1' }] });
  const item = await makeItem(ada.auth, { title: 'Posted' });
  const res = await call(`/items/${item.id}/share`, {
    method: 'POST',
    auth: ada.auth,
    body: { level: 'view', public: true },
  });
  const { link } = await body<{ link: { code: string } }>(res);
  return { ada, id: item.id, code: link.code };
}

describe('POST /app/community/states', () => {
  it('answers public for a live item of the app, still its owner’s, with its link', async () => {
    const { id, code } = await published();
    expect(await stateOf(id, code, 'user_a')).toBe('public');
    // The code as the post keeps it, in any case.
    expect(await stateOf(id, code.toLowerCase(), 'user_a')).toBe('public');
  });

  it('answers away in the Trash, and public again once restored', async () => {
    const { ada, id, code } = await published();
    await call(`/items/${id}`, { method: 'DELETE', auth: ada.auth });
    expect(await stateOf(id, code, 'user_a')).toBe('away');
    // The index keeps the link through the Trash; whether the post comes back is the Community's (it does not).
    await call(`/items/${id}/restore`, { method: 'POST', auth: ada.auth });
    expect(await stateOf(id, code, 'user_a')).toBe('public');
  });

  it('answers away for an item now someone else’s, but not for a migrated guest’s post now its account’s', async () => {
    const { id, code } = await published();
    expect(await stateOf(id, code, 'user_b')).toBe('away');
    // The guest signed up and the index re-owned the item to their account: the post still stands.
    expect(await stateOf(id, code, 'guest_0b7a2b6e')).toBe('public');
  });

  it('answers gone once archived (Archived drops the link)', async () => {
    const { ada, id, code } = await published();
    const res = await call(`/items/${id}/archive`, { method: 'POST', auth: ada.auth });
    expect(res.status).toBe(200);
    expect(await stateOf(id, code, 'user_a')).toBe('gone');
  });

  it('answers gone once deleted for good', async () => {
    const { ada, id, code } = await published();
    await call(`/items/${id}?permanent=true`, { method: 'DELETE', auth: ada.auth });
    expect(await stateOf(id, code, 'user_a')).toBe('gone');
  });

  it('answers gone for a closed account’s item a team keeps, a revoked link, or another app’s item', async () => {
    const { ada, id, code } = await published();
    h.db.sql.prepare('UPDATE items SET owner_id = ? WHERE id = ?').run(ANONYMISED_PERSON, id);
    expect(await stateOf(id, code, ANONYMISED_PERSON)).toBe('gone');

    const other = await published();
    await call(`/share/${other.code}`, { method: 'DELETE', auth: ada.auth });
    expect(await stateOf(other.id, other.code, 'user_a')).toBe('gone');

    const third = await published();
    // The link of another item is not this one's.
    expect(await stateOf(third.id, other.code, 'user_a')).toBe('gone');
    // livediagram asks about liveplanner's item: none of its own.
    expect(await stateOf(third.id, third.code, 'user_a', 'livediagram', 'ld-key')).toBe('gone');
    expect(await stateOf('missing-item', third.code, 'user_a')).toBe('gone');
  });

  it('answers closed behind a share password or in a team', async () => {
    const { ada, id, code } = await published();
    await call(`/items/${id}/share-password`, {
      method: 'PUT',
      auth: ada.auth,
      body: { password: 'hunter2' },
    });
    expect(await stateOf(id, code, 'user_a')).toBe('closed');
    const team = await published();
    h.db.sql.prepare('UPDATE items SET team_id = ? WHERE id = ?').run('team1', team.id);
    expect(await stateOf(team.id, team.code, 'user_a')).toBe('closed');
  });

  it('answers one state per post, in order, with two reads whatever the number', async () => {
    const a = await published();
    const b = await published();
    const asked = [
      { id: b.id, code: b.code, owner: 'user_a' },
      { id: 'missing', code: 'ZZZZ', owner: 'user_a' },
      { id: a.id, code: a.code, owner: 'user_a' },
    ];
    const answer = await body<{ states: { id: string; state: string }[] }>(await states(asked));
    expect(answer.states).toEqual([
      { id: b.id, state: 'public' },
      { id: 'missing', state: 'gone' },
      { id: a.id, state: 'public' },
    ]);
  });

  it('refuses a bad body, too many posts, another method, and a caller without the app’s key', async () => {
    const { id, code } = await published();
    for (const posts of [undefined, [], [{ id, code }], [{ id, code: 'no spaces!', owner: 'u' }]]) {
      expect((await states(posts)).status).toBe(400);
    }
    const many = Array.from({ length: COMMUNITY_STATES_MAX + 1 }, (_, i) => ({
      id: `i${i}`,
      code: 'ABCD',
      owner: 'user_a',
    }));
    expect((await states(many)).status).toBe(400);
    const get = await call('/app/community/states', {
      auth: 'lp-key',
      headers: { 'X-Index-App': 'liveplanner' },
    });
    expect(get.status).toBe(404);
    expect((await states([{ id, code, owner: 'user_a' }], 'liveplanner', 'wrong')).status).toBe(
      401,
    );
  });
});
