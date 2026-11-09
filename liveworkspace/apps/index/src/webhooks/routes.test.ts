// A document's webhooks (webhooks.md "Who adds one", "Managing them"): managed by an account who can edit the whole
// item (its owner, its team's people, an Editor link to every tab, sent or held), checked on every call; never a
// guest, an app or the Drive mirror acting for someone, a Viewer or Participant, or a one-tab Editor.
import type { Webhook, WebhookDelivery } from '@liveworkspace/index-client';
import { unseal, importSealKey } from '@liveworkspace/api-kit/sealed';
import { beforeEach, describe, expect, it } from 'vitest';
import { body, call, h, makeItem, person, useHarness } from '../test-support';
import { secretContext, urlContext } from './dispatch';
import {
  addWebhook,
  answerWorld,
  deliveries,
  newWorld,
  WEBHOOK_KEY,
  type World,
} from './test-webhooks';

useHarness({ WEBHOOK_KEY });

let world: World;
beforeEach(() => {
  world = newWorld();
  answerWorld(world);
});

const list = async (auth: string, itemId: string, headers: Record<string, string> = {}) =>
  (await body<{ webhooks: Webhook[] }>(await call(`/items/${itemId}/webhooks`, { auth, headers })))
    .webhooks;

const shareLink = async (
  auth: string,
  itemId: string,
  input: { level: 'view' | 'participate' | 'edit'; tabId?: string | null },
) =>
  (
    await body<{ link: { code: string } }>(
      await call(`/items/${itemId}/share`, { method: 'POST', auth, body: input }),
    )
  ).link.code;

const post = (
  auth: string,
  itemId: string,
  input: Record<string, unknown>,
  headers: Record<string, string> = {},
) =>
  call(`/items/${itemId}/webhooks`, {
    method: 'POST',
    auth,
    headers,
    body: {
      name: 'n',
      kind: 'json',
      url: 'https://hooks.example.com',
      events: ['renamed'],
      ...input,
    },
  });

describe('who may manage a document’s webhooks', () => {
  it('lets the owner add one, its secret shown once and sealed at rest', async () => {
    const ada = await person('user_wh1');
    const item = await makeItem(ada.auth);
    const { webhook, secret } = await addWebhook(ada.auth, item.id, { name: '  Build bot ' });
    expect(webhook).toMatchObject({
      itemId: item.id,
      app: 'liveplanner',
      name: 'Build bot',
      kind: 'json',
      host: 'hooks.example.com',
      events: ['renamed', 'commented', 'card_moved'],
      who: 'anyone',
      mine: true,
      pausedAt: null,
      lastDelivery: null,
    });
    expect(secret).toMatch(/^whsec_/);
    const row = h.db.sql.prepare('SELECT * FROM webhooks').get() as Record<string, string>;
    expect(row.item_id).toBe(item.id);
    expect(row.url_sealed).not.toContain('example');
    expect(row.secret_sealed).not.toContain(secret!);
    const key = (await importSealKey(WEBHOOK_KEY))!;
    expect(await unseal(key, urlContext(webhook.id), row.url_sealed!)).toBe(
      'https://hooks.example.com/in',
    );
    expect(await unseal(key, secretContext(webhook.id), row.secret_sealed!)).toBe(secret);
    // Copied to another webhook's row, it doesn't open.
    expect(await unseal(key, urlContext('other'), row.url_sealed!)).toBeNull();
    expect(await list(ada.auth, item.id)).toEqual([webhook]);
  });

  it("keeps each document's webhooks to that document", async () => {
    const ada = await person('user_wh11');
    const one = await makeItem(ada.auth);
    const two = await makeItem(ada.auth);
    const { webhook } = await addWebhook(ada.auth, one.id);
    expect((await list(ada.auth, one.id)).map((w) => w.id)).toEqual([webhook.id]);
    expect(await list(ada.auth, two.id)).toEqual([]);
  });

  it('gives Slack and Teams no secret', async () => {
    const ada = await person('user_wh2');
    const item = await makeItem(ada.auth);
    const slack = await addWebhook(ada.auth, item.id, {
      kind: 'slack',
      url: 'https://hooks.slack.com/services/T/B/x',
    });
    expect(slack.secret).toBeNull();
    const teams = await addWebhook(ada.auth, item.id, {
      kind: 'teams',
      url: 'https://prod-01.westus.logic.azure.com/workflows/a/triggers/manual/paths/invoke',
    });
    expect(teams.webhook.host).toBe('prod-01.westus.logic.azure.com');
  });

  it("lets any of a team document's people manage its webhooks, each seeing who added them", async () => {
    const bo = await person('user_wh3', { teams: [{ id: 'team1' }] });
    const item = await makeItem(bo.auth, { teamId: 'team1' });
    const { webhook } = await addWebhook(bo.auth, item.id);
    const cy = await person('user_wh4', { teams: [{ id: 'team1' }] });
    const [seen] = await list(cy.auth, item.id);
    expect(seen).toMatchObject({ id: webhook.id, mine: false });
    const renamed = await call(`/webhooks/${webhook.id}`, {
      method: 'PATCH',
      auth: cy.auth,
      body: { name: 'Ops' },
    });
    expect(renamed.status).toBe(200);
  });

  it('lets an Editor link to every tab in, sent with the request or held under Shared', async () => {
    const ada = await person('user_wh8');
    const item = await makeItem(ada.auth);
    const code = await shareLink(ada.auth, item.id, { level: 'edit' });
    const ed = await person('user_wh9');
    const { webhook } = await addWebhook(ed.auth, item.id, {}, { 'X-Share-Code': code });
    expect(webhook.mine).toBe(true);
    // Adding through the link records it under Shared, so the dispatcher finds it.
    expect(
      h.db.sql
        .prepare('SELECT share_code FROM shared_with WHERE person_id = ? AND item_id = ?')
        .get('user_wh9', item.id),
    ).toEqual({ share_code: code });
    // Held, it no longer needs sending.
    expect((await list(ed.auth, item.id)).map((w) => w.id)).toEqual([webhook.id]);
    // The owner sees it, not as theirs.
    expect((await list(ada.auth, item.id))[0]).toMatchObject({ id: webhook.id, mine: false });
  });

  it('refuses a Viewer, a Participant and a one-tab Editor with webhooks_need_editor', async () => {
    const ada = await person('user_wh12');
    const item = await makeItem(ada.auth);
    const { webhook } = await addWebhook(ada.auth, item.id);
    const visitor = await person('user_wh13');
    for (const link of [
      { level: 'view' as const },
      { level: 'participate' as const },
      { level: 'edit' as const, tabId: 'tab-1' },
    ]) {
      const code = await shareLink(ada.auth, item.id, link);
      const headers = { 'X-Share-Code': code };
      const listed = await call(`/items/${item.id}/webhooks`, { auth: visitor.auth, headers });
      expect(listed.status, JSON.stringify(link)).toBe(403);
      expect(await body(listed)).toEqual({ error: 'webhooks_need_editor' });
      expect((await post(visitor.auth, item.id, {}, headers)).status).toBe(403);
      const deleted = await call(`/webhooks/${webhook.id}`, {
        method: 'DELETE',
        auth: visitor.auth,
        headers,
      });
      expect(deleted.status).toBe(403);
      expect(await body(deleted)).toEqual({ error: 'webhooks_need_editor' });
    }
    expect(await list(ada.auth, item.id)).toHaveLength(1);
  });

  it('answers a stranger as though nothing were there', async () => {
    const ada = await person('user_wh14');
    const item = await makeItem(ada.auth);
    const { webhook } = await addWebhook(ada.auth, item.id);
    const di = await person('user_wh5');
    expect((await call(`/items/${item.id}/webhooks`, { auth: di.auth })).status).toBe(404);
    for (const [method, path] of [
      ['PATCH', `/webhooks/${webhook.id}`],
      ['DELETE', `/webhooks/${webhook.id}`],
      ['POST', `/webhooks/${webhook.id}/test`],
      ['GET', `/webhooks/${webhook.id}/deliveries`],
    ] as const) {
      const res = await call(path, {
        method,
        auth: di.auth,
        body: method === 'PATCH' ? { name: 'n' } : undefined,
      });
      expect(res.status, `${method} ${path}`).toBe(404);
      expect(await body(res)).toEqual({ error: 'webhook_not_found' });
    }
  });

  it('refuses a guest, an app or the Drive mirror acting for someone, and anyone with no token', async () => {
    const ada = await person('user_wh7');
    const item = await makeItem(ada.auth);
    const guest = await person('guest_00000000-0000-4000-8000-000000000001', { guest: true });
    expect((await call(`/items/${item.id}/webhooks`, { auth: guest.auth })).status).toBe(403);
    const asApp = await call(`/items/${item.id}/webhooks`, {
      auth: 'lp-key',
      headers: { 'X-Index-App': 'liveplanner', 'X-Index-Person': 'user_wh7' },
    });
    expect(asApp.status).toBe(403);
    expect(await body(asApp)).toEqual({ error: 'webhooks_need_account' });
    const drive = await call(`/items/${item.id}/webhooks`, {
      auth: 'drive-key',
      headers: { 'X-Index-App': 'drive', 'X-Index-Person': 'user_wh7' },
      env: { ...h.db.env, INDEX_KEY_DRIVE: 'drive-key' },
    });
    expect([403, 404]).toContain(drive.status);
    expect((await call(`/items/${item.id}/webhooks`)).status).toBe(401);
  });

  it('answers 503 without WEBHOOK_KEY', async () => {
    const ada = await person('user_wh10');
    const item = await makeItem(ada.auth);
    const res = await call(`/items/${item.id}/webhooks`, {
      auth: ada.auth,
      env: { ...h.db.env, WEBHOOK_KEY: undefined },
    });
    expect(res.status).toBe(503);
    expect(await body(res)).toEqual({ error: 'webhooks_unavailable' });
  });
});

describe('what an add checks', () => {
  it.each([
    [{ name: '' }, 'invalid_webhook'],
    [{ name: 'x'.repeat(81) }, 'invalid_webhook'],
    // Only invisible characters, or only bidi controls: a name that would look blank.
    [{ name: '​⁠﻿' }, 'invalid_webhook'],
    [{ name: '‮⁦' }, 'invalid_webhook'],
    [{ events: [] }, 'invalid_webhook'],
    [{ events: ['edited'] }, 'invalid_webhook'],
    // Retired: a document is never made again, and mentions are gone.
    [{ events: ['created'] }, 'invalid_webhook'],
    [{ events: ['mention'] }, 'invalid_webhook'],
    // The per-app topics of before are not events.
    [{ events: ['livediagram:shared'] }, 'invalid_webhook'],
    [{ events: ['shared', 7] }, 'invalid_webhook'],
    // Object.prototype's names are no events (once a 500: they have no app list).
    [{ events: ['constructor'] }, 'invalid_webhook'],
    [{ events: ['toString', 'shared'] }, 'invalid_webhook'],
    [{ events: ['__proto__'] }, 'invalid_webhook'],
    [{ who: 'everyone' }, 'invalid_webhook'],
    [{ kind: 'discord' }, 'invalid_webhook'],
    [{ url: 'http://hooks.example.com' }, 'webhook_url_invalid'],
    [{ url: 'https://10.0.0.1/x' }, 'webhook_url_private'],
    [{ kind: 'slack', url: 'https://hooks.example.com/services/x' }, 'webhook_url_invalid'],
  ])('refuses %o', async (input, error) => {
    const ada = await person('user_wa1');
    const item = await makeItem(ada.auth);
    const res = await post(ada.auth, item.id, input);
    expect(res.status).toBe(400);
    expect(await body(res)).toEqual({ error });
  });

  it("offers a document only its app's events: a canvas has no card moves or forms", async () => {
    const ada = await person('user_wa4');
    const canvas = await makeItem(ada.auth, { app: 'livediagram' });
    for (const events of [['card_moved'], ['form_response'], ['shared', 'card_moved']]) {
      expect(await body(await post(ada.auth, canvas.id, { events }))).toEqual({
        error: 'invalid_webhook',
      });
    }
    const { webhook } = await addWebhook(ada.auth, canvas.id, {
      events: ['commented', 'shared', 'commented'],
    });
    // De-duplicated, in WEBHOOK_EVENTS order, stored comma-wrapped.
    expect(webhook.events).toEqual(['shared', 'commented']);
    expect(h.db.sql.prepare('SELECT events FROM webhooks').get()).toEqual({
      events: ',shared,commented,',
    });
  });

  it('takes Who Did It: Anyone by default, Only Me when asked', async () => {
    const ada = await person('user_wa5');
    const item = await makeItem(ada.auth);
    expect((await addWebhook(ada.auth, item.id)).webhook.who).toBe('anyone');
    expect((await addWebhook(ada.auth, item.id, { who: 'me' })).webhook.who).toBe('me');
  });

  it('refuses a host that resolves to a private address, or to nothing', async () => {
    const ada = await person('user_wa2');
    const item = await makeItem(ada.auth);
    world.dns['rebind.example.com'] = ['93.184.216.34', '169.254.169.254'];
    world.dns['gone.example.com'] = [];
    expect(
      await body(await post(ada.auth, item.id, { url: 'https://rebind.example.com/x' })),
    ).toEqual({ error: 'webhook_url_private' });
    expect(
      await body(await post(ada.auth, item.id, { url: 'https://gone.example.com/x' })),
    ).toEqual({ error: 'webhook_url_invalid' });
    expect(
      (await call(`/items/${item.id}/webhooks`, { method: 'POST', auth: ada.auth, body: [] }))
        .status,
    ).toBe(400);
  });

  it('holds a document to 10, another document still taking its own', async () => {
    const ada = await person('user_wa3');
    const item = await makeItem(ada.auth);
    for (let i = 0; i < 10; i++) await addWebhook(ada.auth, item.id);
    const res = await post(ada.auth, item.id, {});
    expect(res.status).toBe(409);
    expect(await body(res)).toEqual({ error: 'webhook_limit' });
    const other = await makeItem(ada.auth);
    expect((await post(ada.auth, other.id, {})).status).toBe(201);
  });
});

describe('changing one', () => {
  it('renames it and changes its events and Who Did It', async () => {
    const ada = await person('user_wc1');
    const item = await makeItem(ada.auth);
    const { webhook } = await addWebhook(ada.auth, item.id);
    const res = await call(`/webhooks/${webhook.id}`, {
      method: 'PATCH',
      auth: ada.auth,
      body: { name: 'Renamed', events: ['trashed', 'trashed'], who: 'me' },
    });
    expect((await body<{ webhook: Webhook }>(res)).webhook).toMatchObject({
      name: 'Renamed',
      events: ['trashed'],
      who: 'me',
    });
    for (const bad of [
      { name: '' },
      { events: [] },
      { events: ['mention'] },
      { who: 'all' },
      { paused: 'yes' },
      [],
    ]) {
      expect(
        (await call(`/webhooks/${webhook.id}`, { method: 'PATCH', auth: ada.auth, body: bad }))
          .status,
      ).toBe(400);
    }
  });

  it("refuses an event the document's app never sends", async () => {
    const ada = await person('user_wc6');
    const canvas = await makeItem(ada.auth, { app: 'livediagram' });
    const { webhook } = await addWebhook(ada.auth, canvas.id, { events: ['shared'] });
    const res = await call(`/webhooks/${webhook.id}`, {
      method: 'PATCH',
      auth: ada.auth,
      body: { events: ['card_moved'] },
    });
    expect(res.status).toBe(400);
  });

  it('keeps a name without bidi controls or invisible ends, as added and as renamed', async () => {
    const ada = await person('user_wc5');
    const item = await makeItem(ada.auth);
    // Left in, the override turned the name and the words drawn after it around ("‮evil" read "live").
    const { webhook } = await addWebhook(ada.auth, item.id, {
      name: '​ ‮evil‬ bot﻿',
    });
    expect(webhook.name).toBe('evil bot');
    const res = await call(`/webhooks/${webhook.id}`, {
      method: 'PATCH',
      auth: ada.auth,
      body: { name: '⁧ops⁩ ­' },
    });
    expect((await body<{ webhook: Webhook }>(res)).webhook.name).toBe('ops');
  });

  it('pauses it (giving up what waited) and resumes it, whoever resumes becoming its creator', async () => {
    const bo = await person('user_wc2', { teams: [{ id: 'team2' }] });
    const item = await makeItem(bo.auth, { teamId: 'team2' });
    const { webhook } = await addWebhook(bo.auth, item.id);
    await call(`/webhooks/${webhook.id}/test`, { method: 'POST', auth: bo.auth });
    const paused = await call(`/webhooks/${webhook.id}`, {
      method: 'PATCH',
      auth: bo.auth,
      body: { paused: true },
    });
    expect((await body<{ webhook: Webhook }>(paused)).webhook).toMatchObject({
      pausedReason: 'paused',
    });
    expect(deliveries().map((d) => [d.state, d.error])).toEqual([['failed', 'paused']]);
    // Given up untried, it has no last try: the list dates it when it was given up, never null (1 Jan 1970).
    const [listed] = await list(bo.auth, item.id);
    expect(listed!.lastDelivery).toEqual({ state: 'failed', status: null, at: expect.any(Number) });
    expect(listed!.lastDelivery!.at).toBeGreaterThan(0);
    // A test of a paused webhook is refused.
    expect(
      (await call(`/webhooks/${webhook.id}/test`, { method: 'POST', auth: bo.auth })).status,
    ).toBe(409);
    const cy = await person('user_wc3', { teams: [{ id: 'team2' }] });
    h.db.sql.prepare('UPDATE webhooks SET failures = 7').run();
    const resumed = await call(`/webhooks/${webhook.id}`, {
      method: 'PATCH',
      auth: cy.auth,
      body: { paused: false },
    });
    expect((await body<{ webhook: Webhook }>(resumed)).webhook).toMatchObject({
      pausedAt: null,
      pausedReason: null,
      mine: true,
    });
    expect(h.db.sql.prepare('SELECT created_by, failures FROM webhooks').get()).toEqual({
      created_by: 'user_wc3',
      failures: 0,
    });
  });

  it('makes whoever sets Only Me its creator, so Only Me means them', async () => {
    const bo = await person('user_wc7', { teams: [{ id: 'team3' }] });
    const item = await makeItem(bo.auth, { teamId: 'team3' });
    const { webhook } = await addWebhook(bo.auth, item.id);
    const cy = await person('user_wc8', { teams: [{ id: 'team3' }] });
    // A rename leaves the creator alone.
    await call(`/webhooks/${webhook.id}`, { method: 'PATCH', auth: cy.auth, body: { name: 'x' } });
    expect(h.db.sql.prepare('SELECT created_by FROM webhooks').get()).toEqual({
      created_by: 'user_wc7',
    });
    const res = await call(`/webhooks/${webhook.id}`, {
      method: 'PATCH',
      auth: cy.auth,
      body: { who: 'me' },
    });
    expect((await body<{ webhook: Webhook }>(res)).webhook).toMatchObject({
      who: 'me',
      mine: true,
    });
    expect(h.db.sql.prepare('SELECT created_by, who FROM webhooks').get()).toEqual({
      created_by: 'user_wc8',
      who: 'me',
    });
  });

  it('deletes it with its deliveries, and refuses an id that is not one', async () => {
    const ada = await person('user_wc4');
    const item = await makeItem(ada.auth);
    const { webhook } = await addWebhook(ada.auth, item.id);
    await call(`/webhooks/${webhook.id}/test`, { method: 'POST', auth: ada.auth });
    expect(
      (await call(`/webhooks/${webhook.id}`, { method: 'DELETE', auth: ada.auth })).status,
    ).toBe(204);
    expect(deliveries()).toEqual([]);
    expect(await list(ada.auth, item.id)).toEqual([]);
    expect((await call('/webhooks/a%20b', { auth: ada.auth })).status).toBe(404);
    expect(
      (await call(`/items/${item.id}/webhooks`, { method: 'PUT', auth: ada.auth })).status,
    ).toBe(404);
  });
});

describe('testing one and its deliveries', () => {
  it('queues a ping, wakes the dispatcher after answering, and lists it', async () => {
    const kicks: string[] = [];
    const env = {
      ...h.db.env,
      WEBHOOKS: {
        idFromName: (name: string) => name as unknown as DurableObjectId,
        get: (id: DurableObjectId) => ({ kick: async () => void kicks.push(String(id)) }),
      },
    };
    const ada = await person('user_wt1');
    const item = await makeItem(ada.auth);
    const { webhook } = await addWebhook(ada.auth, item.id, { name: 'Ops' });
    const res = await call(`/webhooks/${webhook.id}/test`, { method: 'POST', auth: ada.auth, env });
    expect(res.status).toBe(202);
    await Promise.all(h.pending);
    expect(kicks).toEqual(['deliveries']);
    const listed = await body<{ deliveries: WebhookDelivery[] }>(
      await call(`/webhooks/${webhook.id}/deliveries`, { auth: ada.auth }),
    );
    expect(listed.deliveries).toEqual([
      expect.objectContaining({
        type: 'ping',
        app: 'liveworkspace',
        title: 'Ops',
        state: 'pending',
        attempts: 0,
        status: null,
      }),
    ]);
    expect(listed.deliveries[0]!.nextAttemptAt).toEqual(expect.any(Number));
    h.db.sql
      .prepare("UPDATE webhook_deliveries SET state = 'delivered', status = 200, last_at = 5")
      .run();
    const after = await body<{ deliveries: WebhookDelivery[] }>(
      await call(`/webhooks/${webhook.id}/deliveries`, { auth: ada.auth }),
    );
    expect(after.deliveries[0]).toMatchObject({
      state: 'delivered',
      nextAttemptAt: null,
      lastAttemptAt: 5,
    });
    expect((await list(ada.auth, item.id))[0]!.lastDelivery).toEqual({
      state: 'delivered',
      status: 200,
      at: 5,
    });
  });

  it('keeps the finished ones listed beside a backlog of retries', async () => {
    const ada = await person('user_wt3');
    const item = await makeItem(ada.auth);
    const { webhook } = await addWebhook(ada.auth, item.id, { name: 'Ops' });
    const insert = h.db.sql.prepare(
      `INSERT INTO webhook_deliveries (id, webhook_id, event_id, type, app, title, occurred_at, state, next_at)
       VALUES (?, ?, ?, 'ping', 'liveworkspace', 'Ops', 1, ?, 1)`,
    );
    // Three finished first, then 45 still waiting behind a failing endpoint.
    for (let i = 1; i <= 48; i++) {
      insert.run(i, webhook.id, `e${i}`, i <= 3 ? (i === 2 ? 'failed' : 'delivered') : 'pending');
    }
    const listed = await body<{ deliveries: WebhookDelivery[] }>(
      await call(`/webhooks/${webhook.id}/deliveries`, { auth: ada.auth }),
    );
    expect(listed.deliveries.map((d) => d.id)).toEqual([
      ...Array.from({ length: 20 }, (_, i) => 48 - i),
      3,
      2,
      1,
    ]);
  });

  it('writes no ping when a pause lands between reading the webhook and queuing it', async () => {
    const ada = await person('user_wt2');
    const item = await makeItem(ada.auth);
    const { webhook } = await addWebhook(ada.auth, item.id, { name: 'Ops' });
    const db = h.db.env.INDEX_DB;
    // The pause lands just before the insert runs.
    const racing = new Proxy(db, {
      get(target, key) {
        if (key !== 'prepare') return Reflect.get(target, key);
        return (sql: string) => {
          if (sql.includes("'ping'")) {
            h.db.sql.prepare('UPDATE webhooks SET paused_at = 1 WHERE id = ?').run(webhook.id);
          }
          return target.prepare(sql);
        };
      },
    });
    const env = { ...h.db.env, INDEX_DB: racing };
    const res = await call(`/webhooks/${webhook.id}/test`, { method: 'POST', auth: ada.auth, env });
    expect(res.status).toBe(409);
    expect(await body(res)).toMatchObject({ error: 'webhook_paused' });
    expect(deliveries()).toEqual([]);
  });
});

describe("a team's audit log", () => {
  it("logs a team document's webhook added and removed, with who, its kind and host, never a personal one's", async () => {
    const eve = await person('user_wa6', { teams: [{ id: 'team_wa', role: 'member' }] });
    const teamItem = await makeItem(eve.auth, { teamId: 'team_wa' });
    const ownItem = await makeItem(eve.auth);
    const { webhook } = await addWebhook(eve.auth, teamItem.id, { name: 'Ops' });
    const own = await addWebhook(eve.auth, ownItem.id);
    const removed = await call(`/webhooks/${webhook.id}`, { method: 'DELETE', auth: eve.auth });
    expect(removed.status).toBe(204);
    await call(`/webhooks/${own.webhook.id}`, { method: 'DELETE', auth: eve.auth });
    const detail = JSON.stringify({ webhookId: webhook.id, kind: 'json', host: webhook.host });
    const row = (type: string) => ({
      team_id: 'team_wa',
      type,
      app: 'liveworkspace',
      actor_id: 'user_wa6',
      title: 'Ops',
      detail,
    });
    expect(
      h.db.sql
        .prepare(
          `SELECT team_id, type, app, actor_id, title, detail FROM team_audit_events
           WHERE type LIKE 'webhook_%' ORDER BY type`,
        )
        .all(),
    ).toEqual([row('webhook_added'), row('webhook_removed')]);
  });
});

describe("a plan's card moves", () => {
  it("keeps the mover's id, so an Only Me webhook hears only its creator's moves", async () => {
    const ada = await person('user_wm1');
    const plan = await makeItem(ada.auth);
    await addWebhook(ada.auth, plan.id, { events: ['card_moved'], who: 'me' });
    const at = Date.now();
    const move = (cardId: string, actorId: string) => ({
      cardId,
      cardKey: 1,
      card: 'Fix',
      from: 'Doing',
      to: 'Done',
      actorId,
      actorName: 'Someone',
      at,
    });
    const res = await call(`/app/items/${plan.id}/card-moves`, {
      method: 'PUT',
      auth: 'lp-key',
      headers: { 'X-Index-App': 'liveplanner' },
      body: { moves: [move('c1', 'user_wm1'), move('c2', 'user_someone')] },
    });
    expect(res.status).toBe(204);
    expect(deliveries().map((d) => [d.type, d.actor_id])).toEqual([['card_moved', 'user_wm1']]);
  });
});
