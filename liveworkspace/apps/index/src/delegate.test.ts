// An app's server acting for an account it checked itself (an API token's): the app's key, X-Index-App and
// X-Index-Person. It reaches that app's items only, as that account.
import type { GrantClaims, GrantResponse, Item } from '@liveworkspace/index-client';
import { createGrantVerifier, createIndexDelegateClient } from '@liveworkspace/index-client';
import { decodeJwt } from 'jose';
import { describe, expect, it } from 'vitest';
import worker from './index';
import { BASE, body, call, h, makeItem, person, useHarness } from './test-support';

useHarness();

const asDelegate = (
  path: string,
  options: {
    method?: string;
    body?: unknown;
    personId?: string;
    teams?: string;
    app?: string;
    key?: string;
  } = {},
) =>
  call(path, {
    method: options.method ?? 'GET',
    auth: options.key ?? 'lp-key',
    headers: {
      'X-Index-App': options.app ?? 'liveplanner',
      'X-Index-Person': options.personId ?? 'user_a',
      ...(options.teams !== undefined ? { 'X-Index-Teams': options.teams } : {}),
    },
    ...(options.body !== undefined ? { body: options.body } : {}),
  });

describe('an app acting for a person', () => {
  it('is that person for its own app’s items: list, read, grant, rename, trash', async () => {
    const ada = await person('user_a');
    const plan = await makeItem(ada.auth, { title: 'Roadmap' });
    const canvas = await makeItem(ada.auth, { app: 'livediagram', title: 'Sketch' });

    const list = await body<{ items: Item[] }>(await asDelegate('/items'));
    expect(list.items.map((i) => i.id)).toEqual([plan.id]);

    expect((await asDelegate(`/items/${plan.id}`)).status).toBe(200);
    // Another app's item answers as missing, whatever the person may do with it.
    expect((await asDelegate(`/items/${canvas.id}`)).status).toBe(404);
    expect((await asDelegate(`/items/${canvas.id}/grant`, { method: 'POST' })).status).toBe(404);

    const granted = await body<GrantResponse>(
      await asDelegate(`/items/${plan.id}/grant`, { method: 'POST' }),
    );
    expect(granted.level).toBe('edit');
    const claims = decodeJwt(granted.grant) as unknown as GrantClaims;
    expect(claims).toMatchObject({ sub: 'user_a', item: plan.id, aud: 'liveplanner' });

    const renamed = await asDelegate(`/items/${plan.id}`, {
      method: 'PATCH',
      body: { title: 'Roadmap 2' },
    });
    expect(((await body<{ item: Item }>(renamed)).item.title)).toBe('Roadmap 2');
    expect((await asDelegate(`/items/${plan.id}`, { method: 'DELETE' })).status).toBe(204);
    const trash = await body<{ items: Item[] }>(await asDelegate('/trash'));
    expect(trash.items.map((i) => i.id)).toEqual([plan.id]);
  });

  it('makes only its own kind, and empties only its own kind from the Trash', async () => {
    const made = await asDelegate('/items', { method: 'POST', body: { app: 'liveplanner' } });
    expect(made.status).toBe(201);
    const madeItem = (await body<{ item: Item }>(made)).item;
    expect(madeItem.ownerId).toBe('user_a');
    const other = await asDelegate('/items', { method: 'POST', body: { app: 'livediagram' } });
    expect(other.status).toBe(403);
    expect(await body(other)).toEqual({ error: 'wrong_app' });
    // Its lists, the Trash among them, are its own app's: emptying it leaves every other app's items.
    const ada = await person('user_a');
    const canvas = await makeItem(ada.auth, { app: 'livediagram' });
    await call(`/items/${canvas.id}`, { method: 'DELETE', auth: ada.auth });
    await asDelegate(`/items/${madeItem.id}`, { method: 'DELETE' });
    const emptied = await asDelegate('/trash?app=livediagram', { method: 'DELETE' });
    expect(await body(emptied)).toEqual({ purged: 1 });
    expect(h.db.sql.prepare('SELECT id FROM items WHERE app = ?').all('livediagram')).toEqual([
      { id: canvas.id },
    ]);
  });

  it('carries the teams it names, and only those', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team_1' }] });
    const teamPlan = await makeItem(ada.auth, { teamId: 'team_1' });
    expect((await asDelegate(`/items/${teamPlan.id}`, { personId: 'user_b' })).status).toBe(404);
    const asMember = await asDelegate(`/items/${teamPlan.id}/grant`, {
      method: 'POST',
      personId: 'user_b',
      teams: 'team_1',
    });
    expect(asMember.status).toBe(200);
    expect((await body<GrantResponse>(asMember)).level).toBe('edit');
  });

  it('is refused without the app’s key, for a guest, or for a malformed person', async () => {
    expect((await asDelegate('/items', { key: 'wrong' })).status).toBe(401);
    expect((await asDelegate('/items', { app: 'nope' })).status).toBe(401);
    expect((await asDelegate('/items', { personId: 'guest_123' })).status).toBe(401);
    expect((await asDelegate('/items', { personId: 'link:ABCD' })).status).toBe(401);
    expect((await asDelegate('/items', { teams: Array(60).fill('t').join(',') })).status).toBe(
      401,
    );
    // A person's own token cannot name someone else.
    const ada = await person('user_a');
    const res = await call('/items', {
      auth: ada.auth,
      headers: { 'X-Index-Person': 'user_b' },
    });
    expect(res.status).toBe(401);
  });

  it('works through createIndexDelegateClient, and its grants check like any other', async () => {
    const ada = await person('user_a');
    const plan = await makeItem(ada.auth);
    const client = createIndexDelegateClient({
      app: 'liveplanner',
      key: 'lp-key',
      personId: 'user_a',
      baseUrl: BASE,
      fetch: (input, init) =>
        worker.fetch(new Request(input as string, init), h.db.env, {
          waitUntil: () => {},
          passThroughOnException: () => {},
        } as unknown as ExecutionContext),
    });
    const { items } = await client.listItems();
    expect(items.map((i) => i.id)).toEqual([plan.id]);
    const { grant } = await client.grant(plan.id);
    const jwks = await body<{ keys: unknown[] }>(await call('/jwks'));
    const { createLocalJWKSet } = await import('jose');
    const verify = createGrantVerifier({
      jwksUrl: `${BASE}/jwks`,
      audience: 'liveplanner',
      keys: createLocalJWKSet(jwks as Parameters<typeof createLocalJWKSet>[0]),
    });
    expect((await verify(grant))?.item).toBe(plan.id);
  });
});
