// Connected tabs from the host app's side (connection-doors.ts): confirming and removing with the app's key, the
// sweep of tabs that never appeared (Work Tracker #571), purges, and the pass's mark on the Share dialog's list.
import {
  appConnectionPath,
  type ConnectionMade,
  type ShareLink,
} from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { CONNECTION_CONFIRM_GRACE_MS } from './config';
import { sweepUnconfirmedConnections } from './connection-doors';
import { body, call, h, makeItem, person, settle, useHarness } from './test-support';

useHarness();

const rows = (table: string, where = '1 = 1', ...args: string[]) =>
  h.db.sql.prepare(`SELECT * FROM ${table} WHERE ${where}`).all(...args);

async function connected(both = false) {
  const ada = await person('user_a');
  const host = await makeItem(ada.auth, { app: 'livediagram', title: 'Flow' });
  const target = await makeItem(ada.auth, { title: 'Roadmap' });
  const grantRes = await call(`/items/${host.id}/grant`, { method: 'POST', auth: ada.auth });
  const grant = (await body<{ grant: string }>(grantRes)).grant;
  if (both) {
    h.appAnswer = (c) =>
      c.url.endsWith('/connected-tabs')
        ? Response.json({ tabId: 'back' })
        : new Response(null, { status: 200 });
  }
  const res = await call(`/items/${host.id}/connections`, {
    method: 'POST',
    auth: ada.auth,
    body: { targetId: target.id, tabId: 'tab-1', both },
    headers: { 'X-Index-Grant': grant },
  });
  expect(res.status).toBe(201);
  const made = await body<ConnectionMade>(res);
  await settle();
  h.appCalls = [];
  const code = rows('connections', 'id = ?', made.connection.id)[0]!.share_code as string;
  return { ada, host, target, made, id: made.connection.id, code };
}

// The host app's door: its key and name, PUT to confirm, DELETE to remove.
const door = (
  method: 'PUT' | 'DELETE',
  hostId: string,
  id: string,
  tab: string,
  app = 'livediagram',
  key = 'ld-key',
) =>
  call(`${appConnectionPath(hostId, id, tab)}`, {
    method,
    auth: key,
    headers: { 'X-Index-App': app },
  });

describe("the host app's doors", () => {
  it('confirm only the matching host, tab and app', async () => {
    const { host, id } = await connected();
    const confirmed = () => rows('connections', 'id = ?', id)[0]!.confirmed_at;
    expect((await door('PUT', host.id, id, 'tab-1', 'liveplanner', 'lp-key')).status).toBe(204);
    expect((await door('PUT', host.id, id, 'other')).status).toBe(204);
    expect((await door('PUT', 'other-item', id, 'tab-1')).status).toBe(204);
    expect((await door('PUT', host.id, 'nope', 'tab-1')).status).toBe(204);
    expect(confirmed()).toBeNull();
    expect((await door('PUT', host.id, id, 'tab-1')).status).toBe(204);
    const at = confirmed();
    expect(at).toEqual(expect.any(Number));
    // A second confirmation keeps the first moment.
    await door('PUT', host.id, id, 'tab-1');
    expect(confirmed()).toBe(at);
    // Without the app's key, nothing.
    expect((await call(appConnectionPath(host.id, id, 'tab-1'), { method: 'PUT' })).status).toBe(
      401,
    );
    expect(
      (
        await call(appConnectionPath(host.id, id, 'tab-1'), {
          method: 'POST',
          auth: 'ld-key',
          headers: { 'X-Index-App': 'livediagram' },
        })
      ).status,
    ).toBe(404);
  });

  it('remove the connection and its pass once the tab has left, and only then', async () => {
    const { host, target, id, code } = await connected();
    h.db.sql.prepare('INSERT INTO shared_with VALUES (?, ?, ?, 1)').run('user_v', target.id, code);
    expect((await door('DELETE', host.id, id, 'other')).status).toBe(204);
    expect((await door('DELETE', host.id, id, 'tab-1', 'liveplanner', 'lp-key')).status).toBe(204);
    expect(rows('connections')).toHaveLength(1);

    expect((await door('DELETE', host.id, id, 'tab-1')).status).toBe(204);
    expect(rows('connections')).toEqual([]);
    expect(rows('share_links', 'code = ?', code)).toEqual([]);
    expect(rows('shared_with')).toEqual([]);
    expect(rows('timeline_events', "item_id = ? AND type = 'unshared'", target.id)).toHaveLength(1);
    await settle();
    expect(h.appCalls.map((c) => [c.url, c.body])).toEqual([
      [`https://liveplanner.app/api/internal/items/${target.id}/revoke`, { codes: [code] }],
    ]);
    // A second call changes nothing.
    h.appCalls = [];
    expect((await door('DELETE', host.id, id, 'tab-1')).status).toBe(204);
    await settle();
    expect(h.appCalls).toEqual([]);
  });

  it('remove a connection whose pass already went, and log a revoke the app missed', async () => {
    const { ada, host, id, code } = await connected();
    await call(`/share/${code}`, { method: 'DELETE', auth: ada.auth });
    const before = rows('timeline_events', "type = 'unshared'").length;
    expect((await door('DELETE', host.id, id, 'tab-1')).status).toBe(204);
    expect(rows('connections')).toEqual([]);
    expect(rows('timeline_events', "type = 'unshared'")).toHaveLength(before);

    const second = await connected();
    h.appAnswer = () => new Response(null, { status: 500 });
    expect((await door('DELETE', second.host.id, second.id, 'tab-1')).status).toBe(204);
    await settle();
    expect(h.appCalls.map((c) => c.url)).toEqual([
      `https://liveplanner.app/api/internal/items/${second.target.id}/revoke`,
    ]);
  });

  it('keep the pair when one of two both-ways tabs goes', async () => {
    const { host, target, id } = await connected(true);
    const back = rows('connections', 'host_item_id = ?', target.id)[0]!;
    expect(
      (await door('DELETE', target.id, back.id as string, 'back', 'liveplanner', 'lp-key')).status,
    ).toBe(204);
    expect(rows('connections', 'id = ?', id)[0]).toMatchObject({ pair_id: null });
    expect(rows('share_links', 'item_id = ?', target.id)).toHaveLength(1);
    expect(rows('share_links', 'item_id = ?', host.id)).toEqual([]);
  });
});

describe('the sweep of tabs that never appeared', () => {
  it('takes back connections unconfirmed past the grace, oldest first, up to its cap', async () => {
    const { target, id, code } = await connected();
    const made = rows('connections', 'id = ?', id)[0]!.created_at as number;
    // Within the grace, kept.
    expect(await sweepUnconfirmedConnections(h.db.env, made + CONNECTION_CONFIRM_GRACE_MS)).toBe(0);
    expect(rows('connections')).toHaveLength(1);
    // A confirmed one is never swept; a capped run takes the oldest.
    h.db.sql
      .prepare(
        'INSERT INTO connections (id, host_item_id, host_tab_id, created_at, confirmed_at) SELECT ?, host_item_id, ?, 0, 1 FROM connections',
      )
      .run('cn_confirmedconfirmed0001', 'kept');
    h.db.sql
      .prepare(
        'INSERT INTO connections (id, host_item_id, host_tab_id, created_at) SELECT ?, host_item_id, ?, 0 FROM connections WHERE id = ?',
      )
      .run('cn_oldestoldestoldest0001', 'old', id);
    const later = made + CONNECTION_CONFIRM_GRACE_MS + 1;
    expect(await sweepUnconfirmedConnections(h.db.env, later, 1)).toBe(1);
    expect(
      rows('connections')
        .map((r) => r.id)
        .sort(),
    ).toEqual(['cn_confirmedconfirmed0001', id].sort());
    expect(await sweepUnconfirmedConnections(h.db.env, later)).toBe(1);
    expect(rows('connections').map((r) => r.id)).toEqual(['cn_confirmedconfirmed0001']);
    expect(rows('share_links', 'code = ?', code)).toEqual([]);
    expect(h.appCalls.map((c) => [c.url, c.body])).toEqual([
      [`https://liveplanner.app/api/internal/items/${target.id}/revoke`, { codes: [code] }],
    ]);
  });

  it('runs every 15 minutes', async () => {
    const { id } = await connected();
    h.db.sql.prepare('UPDATE connections SET created_at = 0 WHERE id = ?').run(id);
    const { default: worker } = await import('./index');
    await worker.scheduled({ cron: '*/15 * * * *' } as ScheduledController, h.db.env);
    expect(rows('connections')).toEqual([]);
  });
});

describe('purges and the Share dialog', () => {
  it('purging the host deletes its connections and the passes they made on other items', async () => {
    const { ada, host, target, code } = await connected();
    h.db.sql.prepare('INSERT INTO shared_with VALUES (?, ?, ?, 1)').run('user_v', target.id, code);
    expect(
      (await call(`/items/${host.id}?permanent=true`, { method: 'DELETE', auth: ada.auth })).status,
    ).toBe(204);
    expect(rows('connections')).toEqual([]);
    expect(rows('share_links', 'item_id = ?', target.id)).toEqual([]);
    expect(rows('shared_with')).toEqual([]);
    expect(rows('items', 'id = ?', target.id)).toHaveLength(1);
  });

  it('marks a pass with the item whose tab it was made for, and no other link', async () => {
    const { ada, target, host, code } = await connected();
    await call(`/items/${target.id}/share`, { method: 'POST', auth: ada.auth, body: {} });
    const listed = await body<{ links: ShareLink[] }>(
      await call(`/items/${target.id}/share`, { auth: ada.auth }),
    );
    expect(listed.links).toHaveLength(2);
    expect(listed.links.find((l) => l.code === code)?.connection).toEqual({
      hostItemId: host.id,
      hostApp: 'livediagram',
      hostTitle: 'Flow',
    });
    expect(listed.links.find((l) => l.code !== code)).not.toHaveProperty('connection');
  });
});
