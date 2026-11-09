// `POST /items/lookup`: many items in one request, each kept by `GET /items/:id`'s rule (owner, team, a live link
// without a password, an app's own items, the Drive mirror's personal ones), in the order asked, each once.
import { ITEM_LOOKUP_IDS_MAX, type Item } from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import type { Person } from './auth';
import { lookupItems } from './lookup';
import { body, call, h, makeItem, person, useHarness } from './test-support';

useHarness();

const lookup = async (auth: string, ids: unknown, headers: Record<string, string> = {}) =>
  call('/items/lookup', { method: 'POST', auth, body: { ids }, headers });

const ids = async (auth: string, asked: string[]) =>
  (await body<{ items: Item[] }>(await lookup(auth, asked))).items.map((i) => i.id);

const share = async (auth: string, itemId: string, input: Record<string, unknown> = {}) =>
  (
    await body<{ link: { code: string } }>(
      await call(`/items/${itemId}/share`, {
        method: 'POST',
        auth,
        body: { level: 'view', ...input },
      }),
    )
  ).link.code;

describe('POST /items/lookup', () => {
  it('answers each item GET /items/:id would, in the order asked, once each', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team1' }] });
    const bob = await person('user_b', { teams: [{ id: 'team1' }] });
    const eve = await person('user_e');
    const mine = await makeItem(ada.auth, { title: 'Mine' });
    const team = await makeItem(bob.auth, { title: 'Team', teamId: 'team1' });
    const bobs = await makeItem(bob.auth, { title: "Bob's own" });
    const trashed = await makeItem(ada.auth, { title: 'Trashed' });
    await call(`/items/${trashed.id}`, { method: 'DELETE', auth: ada.auth });
    const eves = await makeItem(eve.auth, { title: "Eve's" });

    const asked = [team.id, 'missing', mine.id, bobs.id, trashed.id, mine.id, eves.id];
    const answered = await body<{ items: Item[] }>(await lookup(ada.auth, asked));
    // Her own (the Trash too, as GET /items/:id answers it) and her team's; not Bob's own, not Eve's.
    expect(answered.items.map((i) => i.id)).toEqual([team.id, mine.id, trashed.id]);
    expect(answered.items[0]).toMatchObject({ title: 'Team', access: 'edit', sharedVia: null });
    for (const id of asked) {
      const one = await call(`/items/${id}`, { auth: ada.auth });
      expect(one.status === 200, id).toBe(answered.items.some((i) => i.id === id));
    }
  });

  it('reaches what a live link the person opened reaches, never behind a password or in the Trash', async () => {
    const ada = await person('user_a');
    const eve = await person('user_e');
    const open = await makeItem(ada.auth, { title: 'Open' });
    const lapsed = await makeItem(ada.auth, { title: 'Lapsed' });
    const locked = await makeItem(ada.auth, { title: 'Locked' });
    const binned = await makeItem(ada.auth, { title: 'Binned' });
    const codes = new Map<string, string>();
    for (const item of [open, lapsed, locked, binned]) {
      const code = await share(ada.auth, item.id);
      codes.set(item.id, code);
      expect((await call(`/share/${code}`, { auth: eve.auth })).status).toBe(200);
    }
    h.db.sql.prepare('UPDATE share_links SET expires_at = 1 WHERE item_id = ?').run(lapsed.id);
    await call(`/items/${locked.id}/share-password`, {
      method: 'PUT',
      auth: ada.auth,
      body: { password: 'hunter2' },
    });
    await call(`/items/${binned.id}`, { method: 'DELETE', auth: ada.auth });

    const asked = [open.id, lapsed.id, locked.id, binned.id];
    const answered = await body<{ items: Item[] }>(await lookup(eve.auth, asked));
    expect(answered.items.map((i) => i.title)).toEqual(['Open']);
    expect(answered.items[0]).toMatchObject({ access: 'view', sharedVia: codes.get(open.id) });
    for (const id of asked) {
      const one = await call(`/items/${id}`, { auth: eve.auth });
      expect(one.status === 200, id).toBe(id === open.id);
    }
  });

  it('asks accounts about a team joined since the token, once', async () => {
    const bea = await person('user_b', { teams: [{ id: 'team2' }] });
    const a = await makeItem(bea.auth, { teamId: 'team2' });
    const b = await makeItem(bea.auth, { teamId: 'team2' });
    const ada = await person('user_a', { teams: [] });
    h.appAnswer = (c) =>
      c.url.endsWith('/api/account/index/teams')
        ? Response.json({ teams: [{ id: 'team2', name: 'Two', role: 'member' }] })
        : new Response(null, { status: 200 });
    expect(await ids(ada.auth, [a.id, b.id])).toEqual([a.id, b.id]);
    expect(h.appCalls.filter((c) => c.url.endsWith('/index/teams'))).toHaveLength(1);
  });

  it('keeps an app acting for a person to its own items, and the Drive mirror to personal ones', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team1' }] });
    const plan = await makeItem(ada.auth, { title: 'Plan' });
    const canvas = await makeItem(ada.auth, { title: 'Canvas', app: 'livediagram' });
    const team = await makeItem(ada.auth, { title: 'Team', teamId: 'team1' });
    const asked = [plan.id, canvas.id, team.id];
    const delegated = await lookup('lp-key', asked, {
      'X-Index-App': 'liveplanner',
      'X-Index-Person': 'user_a',
      'X-Index-Teams': 'team1',
    });
    expect((await body<{ items: Item[] }>(delegated)).items.map((i) => i.title)).toEqual([
      'Plan',
      'Team',
    ]);
    const drive: Person = { id: 'user_a', kind: 'account', teams: [], drive: true };
    const mirrored = await lookupItems(h.db.env, drive, asked);
    expect(mirrored.map((i) => i.title)).toEqual(['Plan', 'Canvas']);
  });

  it('refuses a bad body, too many ids, and a caller with no person', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    for (const bad of [
      undefined,
      [],
      'x',
      [1],
      ['bad id'],
      Array(ITEM_LOOKUP_IDS_MAX + 1).fill(item.id),
    ]) {
      expect((await lookup(ada.auth, bad)).status, JSON.stringify(bad)?.slice(0, 40)).toBe(400);
    }
    expect(await ids(ada.auth, Array(ITEM_LOOKUP_IDS_MAX).fill(item.id))).toEqual([item.id]);
    const code = await share(ada.auth, item.id);
    const visitor = await call('/items/lookup', {
      method: 'POST',
      headers: { 'X-Share-Code': code },
      body: { ids: [item.id] },
    });
    expect(visitor.status).toBe(401);
    expect(await lookupItems(h.db.env, { id: 'user_a', kind: 'account', teams: [] }, [])).toEqual(
      [],
    );
  });

  it('is one read, one link read and one decoration, whatever the number of ids', async () => {
    const ada = await person('user_a');
    const db = h.db.sql;
    const insert = db.prepare(
      `INSERT INTO items (id, app, kind, owner_id, team_id, scope, title, summary, created_at, updated_at)
       VALUES (?, 'liveplanner', 'plan', ?, NULL, ?, ?, '{}', 1, 1)`,
    );
    db.exec('BEGIN');
    for (let i = 0; i < ITEM_LOOKUP_IDS_MAX; i++) {
      const owner = i % 2 ? 'user_a' : 'user_o';
      insert.run(`lk-${i}`, owner, `p:${owner}`, `Item ${i}`);
    }
    db.exec('COMMIT');
    let statements = 0;
    const env = {
      ...h.db.env,
      INDEX_DB: new Proxy(h.db.env.INDEX_DB, {
        get(target, key, receiver) {
          if (key === 'prepare') {
            return (sql: string) => {
              statements++;
              return target.prepare(sql);
            };
          }
          const value = Reflect.get(target, key, receiver) as unknown;
          return typeof value === 'function' ? value.bind(target) : value;
        },
      }),
    };
    const asked = Array.from({ length: ITEM_LOOKUP_IDS_MAX }, (_, i) => `lk-${i}`);
    const found = await lookupItems(env, { id: ada.id, kind: 'account', teams: [] }, asked);
    expect(found).toHaveLength(ITEM_LOOKUP_IDS_MAX / 2);
    // The rows, the links for the rest, and decorate's batch of four.
    expect(statements).toBe(6);
  });
});
