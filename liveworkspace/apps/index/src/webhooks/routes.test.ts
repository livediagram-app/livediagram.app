// Managing webhooks (webhooks.md "Who adds one", "Managing them"): an account's own, and a team's by its admins only,
// checked against accounts now; never a guest, an app or the Drive mirror acting for someone, or a link visitor.
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

const list = async (auth: string) =>
  (await body<{ webhooks: Webhook[] }>(await call('/webhooks', { auth }))).webhooks;

describe('who may add one', () => {
  it('lets an account add one for its own items, its secret shown once and sealed at rest', async () => {
    const ada = await person('user_wh1');
    const { webhook, secret } = await addWebhook(ada.auth, { name: '  Build bot ' });
    expect(webhook).toMatchObject({
      name: 'Build bot',
      kind: 'json',
      teamId: null,
      host: 'hooks.example.com',
      events: ['created', 'renamed', 'commented', 'card_moved'],
      pausedAt: null,
      lastDelivery: null,
    });
    expect(secret).toMatch(/^whsec_/);
    const row = h.db.sql.prepare('SELECT * FROM webhooks').get() as Record<string, string>;
    expect(row.url_sealed).not.toContain('example');
    expect(row.secret_sealed).not.toContain(secret!);
    const key = (await importSealKey(WEBHOOK_KEY))!;
    expect(await unseal(key, urlContext(webhook.id), row.url_sealed!)).toBe(
      'https://hooks.example.com/in',
    );
    expect(await unseal(key, secretContext(webhook.id), row.secret_sealed!)).toBe(secret);
    // Copied to another webhook's row, it doesn't open.
    expect(await unseal(key, urlContext('other'), row.url_sealed!)).toBeNull();
    expect(await list(ada.auth)).toEqual([webhook]);
  });

  it('gives Slack and Teams no secret', async () => {
    const ada = await person('user_wh2');
    const slack = await addWebhook(ada.auth, {
      kind: 'slack',
      url: 'https://hooks.slack.com/services/T/B/x',
    });
    expect(slack.secret).toBeNull();
    const teams = await addWebhook(ada.auth, {
      kind: 'teams',
      url: 'https://prod-01.westus.logic.azure.com/workflows/a/triggers/manual/paths/invoke',
    });
    expect(teams.webhook.host).toBe('prod-01.westus.logic.azure.com');
  });

  it("lets a team's admin add one, and refuses a member, checking accounts rather than the token", async () => {
    // The token says admin; accounts says member now.
    const bo = await person('user_wh3', { teams: [{ id: 'team1', role: 'admin' }] });
    world.roles.user_wh3 = [{ id: 'team1', role: 'member' }];
    const refused = await call('/webhooks', {
      method: 'POST',
      auth: bo.auth,
      body: {
        name: 'x',
        kind: 'json',
        url: 'https://a.example.com',
        events: ['created'],
        teamId: 'team1',
      },
    });
    expect(refused.status).toBe(403);
    expect(await body(refused)).toEqual({ error: 'not_team_admin' });
    world.roles.user_wh3 = [{ id: 'team1', role: 'admin' }];
    const { webhook } = await addWebhook(bo.auth, { teamId: 'team1' });
    expect(webhook.teamId).toBe('team1');
    // Another admin sees and manages it; a member doesn't see it at all.
    const cy = await person('user_wh4');
    world.roles.user_wh4 = [{ id: 'team1', role: 'admin' }];
    expect((await list(cy.auth)).map((w) => w.id)).toEqual([webhook.id]);
    const di = await person('user_wh5');
    world.roles.user_wh5 = [{ id: 'team1', role: 'member' }];
    expect(await list(di.auth)).toEqual([]);
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

  it("can't say who runs a team when accounts is down: a team's add is 503, the list shows one's own", async () => {
    const ada = await person('user_wh6');
    const own = await addWebhook(ada.auth);
    world.accountsDown = true;
    const res = await call('/webhooks', {
      method: 'POST',
      auth: ada.auth,
      body: {
        name: 'x',
        kind: 'json',
        url: 'https://a.example.com',
        events: ['created'],
        teamId: 'team1',
      },
    });
    expect(res.status).toBe(503);
    expect((await list(ada.auth)).map((w) => w.id)).toEqual([own.webhook.id]);
  });

  it('refuses a guest, an app or the Drive mirror acting for someone, and anyone with no token', async () => {
    const guest = await person('guest_00000000-0000-4000-8000-000000000001', { guest: true });
    expect((await call('/webhooks', { auth: guest.auth })).status).toBe(403);
    const asApp = await call('/webhooks', {
      auth: 'lp-key',
      headers: { 'X-Index-App': 'liveplanner', 'X-Index-Person': 'user_wh7' },
    });
    expect(asApp.status).toBe(403);
    expect(await body(asApp)).toEqual({ error: 'webhooks_need_account' });
    const drive = await call('/webhooks', {
      auth: 'drive-key',
      headers: { 'X-Index-App': 'drive', 'X-Index-Person': 'user_wh7' },
      env: { ...h.db.env, INDEX_KEY_DRIVE: 'drive-key' },
    });
    expect(drive.status).toBe(404);
    expect((await call('/webhooks')).status).toBe(401);
  });

  it("is never a share link's: a link Editor reaches the item, never its scope's webhooks", async () => {
    const ada = await person('user_wh8');
    const item = await makeItem(ada.auth);
    const link = await body<{ link: { code: string } }>(
      await call(`/items/${item.id}/share`, {
        method: 'POST',
        auth: ada.auth,
        body: { level: 'edit' },
      }),
    );
    const { webhook } = await addWebhook(ada.auth);
    const visitor = await person('user_wh9');
    const asVisitor = { auth: visitor.auth, headers: { 'X-Share-Code': link.link.code } };
    expect(await list(visitor.auth)).toEqual([]);
    expect((await call(`/webhooks/${webhook.id}/deliveries`, asVisitor)).status).toBe(404);
    expect((await call(`/webhooks/${webhook.id}`, { ...asVisitor, method: 'DELETE' })).status).toBe(
      404,
    );
  });

  it('answers 503 without WEBHOOK_KEY', async () => {
    const ada = await person('user_wh10');
    const res = await call('/webhooks', {
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
    [{ events: [] }, 'invalid_webhook'],
    [{ events: ['edited'] }, 'invalid_webhook'],
    [{ kind: 'discord' }, 'invalid_webhook'],
    [{ teamId: 'a b' }, 'invalid_webhook'],
    [{ url: 'http://hooks.example.com' }, 'webhook_url_invalid'],
    [{ url: 'https://10.0.0.1/x' }, 'webhook_url_private'],
    [{ kind: 'slack', url: 'https://hooks.example.com/services/x' }, 'webhook_url_invalid'],
  ])('refuses %o', async (input, error) => {
    const ada = await person('user_wa1');
    const res = await call('/webhooks', {
      method: 'POST',
      auth: ada.auth,
      body: {
        name: 'n',
        kind: 'json',
        url: 'https://hooks.example.com',
        events: ['created'],
        ...input,
      },
    });
    expect(res.status).toBe(400);
    expect(await body(res)).toEqual({ error });
  });

  it('refuses a host that resolves to a private address, or to nothing', async () => {
    const ada = await person('user_wa2');
    world.dns['rebind.example.com'] = ['93.184.216.34', '169.254.169.254'];
    world.dns['gone.example.com'] = [];
    const add = (url: string) =>
      call('/webhooks', {
        method: 'POST',
        auth: ada.auth,
        body: { name: 'n', kind: 'json', url, events: ['created'] },
      });
    expect(await body(await add('https://rebind.example.com/x'))).toEqual({
      error: 'webhook_url_private',
    });
    expect(await body(await add('https://gone.example.com/x'))).toEqual({
      error: 'webhook_url_invalid',
    });
    expect((await call('/webhooks', { method: 'POST', auth: ada.auth, body: [] })).status).toBe(
      400,
    );
  });

  it('holds a scope to 10', async () => {
    const ada = await person('user_wa3');
    for (let i = 0; i < 10; i++) await addWebhook(ada.auth);
    const res = await call('/webhooks', {
      method: 'POST',
      auth: ada.auth,
      body: { name: 'n', kind: 'json', url: 'https://hooks.example.com', events: ['created'] },
    });
    expect(res.status).toBe(409);
    expect(await body(res)).toEqual({ error: 'webhook_limit' });
  });
});

describe('changing one', () => {
  it('renames it and changes its events', async () => {
    const ada = await person('user_wc1');
    const { webhook } = await addWebhook(ada.auth);
    const res = await call(`/webhooks/${webhook.id}`, {
      method: 'PATCH',
      auth: ada.auth,
      body: { name: 'Renamed', events: ['trashed', 'trashed'] },
    });
    expect((await body<{ webhook: Webhook }>(res)).webhook).toMatchObject({
      name: 'Renamed',
      events: ['trashed'],
    });
    for (const bad of [{ name: '' }, { events: [] }, { paused: 'yes' }, []]) {
      expect(
        (await call(`/webhooks/${webhook.id}`, { method: 'PATCH', auth: ada.auth, body: bad }))
          .status,
      ).toBe(400);
    }
  });

  it('pauses it (giving up what waited) and resumes it, a team admin resuming becoming its creator', async () => {
    const bo = await person('user_wc2');
    world.roles.user_wc2 = [{ id: 'team2', role: 'admin' }];
    const { webhook } = await addWebhook(bo.auth, { teamId: 'team2' });
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
    // A test of a paused webhook is refused.
    expect(
      (await call(`/webhooks/${webhook.id}/test`, { method: 'POST', auth: bo.auth })).status,
    ).toBe(409);
    const cy = await person('user_wc3');
    world.roles.user_wc3 = [{ id: 'team2', role: 'admin' }];
    h.db.sql.prepare('UPDATE webhooks SET failures = 7').run();
    const resumed = await call(`/webhooks/${webhook.id}`, {
      method: 'PATCH',
      auth: cy.auth,
      body: { paused: false },
    });
    expect((await body<{ webhook: Webhook }>(resumed)).webhook).toMatchObject({
      pausedAt: null,
      pausedReason: null,
    });
    expect(h.db.sql.prepare('SELECT created_by, failures FROM webhooks').get()).toEqual({
      created_by: 'user_wc3',
      failures: 0,
    });
  });

  it('deletes it with its deliveries, and refuses an id that is not one', async () => {
    const ada = await person('user_wc4');
    const { webhook } = await addWebhook(ada.auth);
    await call(`/webhooks/${webhook.id}/test`, { method: 'POST', auth: ada.auth });
    expect(
      (await call(`/webhooks/${webhook.id}`, { method: 'DELETE', auth: ada.auth })).status,
    ).toBe(204);
    expect(deliveries()).toEqual([]);
    expect(await list(ada.auth)).toEqual([]);
    expect((await call('/webhooks/a%20b', { auth: ada.auth })).status).toBe(404);
    expect((await call('/webhooks', { method: 'PUT', auth: ada.auth })).status).toBe(404);
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
    const { webhook } = await addWebhook(ada.auth, { name: 'Ops' });
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
    expect((await list(ada.auth))[0]!.lastDelivery).toEqual({
      state: 'delivered',
      status: 200,
      at: 5,
    });
  });
});
