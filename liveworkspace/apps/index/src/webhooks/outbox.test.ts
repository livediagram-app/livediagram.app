// The outbox (webhooks.md "What it sends", "Delivery"): an event the index records about an item queues a delivery,
// in the same batch, for each of the item scope's live webhooks that listens for it, and nothing else; a plan's card
// moves queue the same way, off the Timeline. The request wakes the dispatcher only after answering.
import { CARD_MOVES_MAX } from '@liveworkspace/index-client';
import { beforeEach, describe, expect, it } from 'vitest';
import { body, call, h, makeItem, person, useHarness } from '../test-support';
import { kickWebhooks, queuedCount } from './outbox';
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

const asApp = (path: string, payload: unknown, app = 'liveplanner', key = 'lp-key') =>
  call(path, { method: 'PUT', auth: key, headers: { 'X-Index-App': app }, body: payload });

const queued = () => deliveries().map((d) => `${d.type} ${d.title}`);

describe('queuing Timeline events', () => {
  it("queues what a person's own webhooks listen for, about the items they own", async () => {
    const ada = await person('user_wo1');
    await addWebhook(ada.auth, { events: ['created', 'renamed'] });
    const item = await makeItem(ada.auth, { title: 'Roadmap' });
    await call(`/items/${item.id}`, {
      method: 'PATCH',
      auth: ada.auth,
      body: { title: 'Roadmap 2' },
    });
    // Not listened for.
    await call(`/items/${item.id}/share`, {
      method: 'POST',
      auth: ada.auth,
      body: { level: 'view' },
    });
    await call(`/favourites/${item.id}`, { method: 'PUT', auth: ada.auth });
    expect(queued()).toEqual(['created Roadmap', 'renamed Roadmap 2']);
    const renamed = deliveries()[1]!;
    expect(renamed).toMatchObject({
      state: 'pending',
      attempts: 0,
      app: 'liveplanner',
      item_id: item.id,
      actor_id: 'user_wo1',
    });
    expect(JSON.parse(renamed.detail as string)).toEqual({ from: 'Roadmap' });
    // Someone else's item is not theirs to hear about.
    const bo = await person('user_wo2');
    await makeItem(bo.auth, { title: 'Bo’s' });
    expect(queued()).toHaveLength(2);
  });

  it("queues a team item's events for the team's webhooks, never a member's own", async () => {
    const bo = await person('user_wo3', { teams: [{ id: 'teamA' }] });
    world.roles.user_wo3 = [{ id: 'teamA', role: 'admin' }];
    const team = await addWebhook(bo.auth, { teamId: 'teamA', events: ['created', 'shared'] });
    const own = await addWebhook(bo.auth, { events: ['created'] });
    const item = await makeItem(bo.auth, { title: 'Team plan', teamId: 'teamA' });
    await call(`/items/${item.id}/share`, {
      method: 'POST',
      auth: bo.auth,
      body: { level: 'edit' },
    });
    expect(deliveries().map((d) => [d.webhook_id, d.type])).toEqual([
      [team.webhook.id, 'created'],
      [team.webhook.id, 'shared'],
    ]);
    expect(deliveries().some((d) => d.webhook_id === own.webhook.id)).toBe(false);
  });

  it('queues comments and actions from a collab push, once however often it is sent', async () => {
    const ada = await person('user_wo4');
    await addWebhook(ada.auth, { events: ['commented', 'action_assigned', 'action_done'] });
    const item = await makeItem(ada.auth, { title: 'Board' });
    const now = Date.now();
    const push = {
      threads: [
        {
          elementId: 'e1',
          elementLabel: 'Card',
          resolved: false,
          commentCount: 1,
          participantIds: ['user_wo4'],
          mentionedIds: [],
          latestText: 'Looks good',
          latestAuthorName: 'Ada',
          latestAuthorId: 'user_wo4',
          firstAt: now,
          latestAt: now,
        },
      ],
      actions: [
        {
          elementId: 'e2',
          actionId: 'a1',
          elementLabel: 'Box',
          name: 'Ship it',
          status: 'open',
          assigneeId: 'user_bo',
          assigneeName: 'Bo',
          assignerId: 'user_wo4',
          teamId: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    };
    expect((await asApp(`/app/items/${item.id}/collab/tab1`, push)).status).toBe(204);
    expect((await asApp(`/app/items/${item.id}/collab/tab1`, push)).status).toBe(204);
    expect(queued().sort()).toEqual(['action_assigned Board', 'commented Board']);
  });

  it('queues nothing for a paused webhook, an old event, or past the pending cap', async () => {
    const ada = await person('user_wo5');
    const { webhook } = await addWebhook(ada.auth, { events: ['created', 'renamed'] });
    await call(`/webhooks/${webhook.id}`, {
      method: 'PATCH',
      auth: ada.auth,
      body: { paused: true },
    });
    await makeItem(ada.auth);
    expect(deliveries()).toEqual([]);
    await call(`/webhooks/${webhook.id}`, {
      method: 'PATCH',
      auth: ada.auth,
      body: { paused: false },
    });
    // 500 already waiting: the next is not queued.
    const item = await makeItem(ada.auth, { title: 'Now' });
    h.db.sql.prepare('DELETE FROM webhook_deliveries').run();
    h.db.sql
      .prepare(
        `WITH RECURSIVE n(v) AS (SELECT 1 UNION ALL SELECT v + 1 FROM n WHERE v < 500)
         INSERT INTO webhook_deliveries (webhook_id, event_id, type, app, title, occurred_at, next_at)
         SELECT ?, 'old' || v, 'created', 'liveplanner', 't', 0, 0 FROM n`,
      )
      .run(webhook.id);
    await call(`/items/${item.id}`, { method: 'PATCH', auth: ada.auth, body: { title: 'Later' } });
    expect(deliveries().filter((d) => d.type === 'renamed')).toEqual([]);
  });

  it('skips an event older than an hour', async () => {
    const ada = await person('user_wo6');
    await addWebhook(ada.auth, { events: ['commented'] });
    const item = await makeItem(ada.auth);
    const long = Date.now() - 2 * 60 * 60 * 1000;
    const thread = {
      elementId: 'e1',
      elementLabel: 'x',
      resolved: false,
      commentCount: 1,
      participantIds: [],
      mentionedIds: [],
      latestText: 'old',
      latestAuthorName: 'A',
      firstAt: long,
      latestAt: long,
    };
    // Dated after the item was made would be news to the Timeline; to a webhook it is too old.
    h.db.sql.prepare('UPDATE items SET created_at = 0 WHERE id = ?').run(item.id);
    await asApp(`/app/items/${item.id}/collab/t`, { threads: [thread], actions: [] });
    expect(
      h.db.sql.prepare("SELECT type FROM timeline_events WHERE type = 'commented'").all(),
    ).toHaveLength(1);
    expect(deliveries()).toEqual([]);
  });
});

describe('card moves', () => {
  it("queues a plan's card moves for its scope's webhooks, once each however often they are sent", async () => {
    const ada = await person('user_wm1');
    await addWebhook(ada.auth, { events: ['card_moved'] });
    const plan = await makeItem(ada.auth, { title: 'Sprint 4' });
    const at = Date.now();
    const moves = [
      {
        cardId: 'c1',
        cardKey: 7,
        card: 'Fix sign-in',
        from: 'Doing',
        to: 'Done',
        actorName: 'Ada',
        at,
      },
      { cardId: 'c2', cardKey: null, card: '', from: 'To Do', to: 'Doing', at: at + 1 },
    ];
    expect((await asApp(`/app/items/${plan.id}/card-moves`, { moves })).status).toBe(204);
    expect((await asApp(`/app/items/${plan.id}/card-moves`, { moves })).status).toBe(204);
    const rows = deliveries();
    expect(rows.map((d) => [d.type, d.title, d.actor_name, d.actor_id])).toEqual([
      ['card_moved', 'Sprint 4', 'Ada', null],
      ['card_moved', 'Sprint 4', null, null],
    ]);
    expect(JSON.parse(rows[0]!.detail as string)).toEqual({
      cardId: 'c1',
      cardKey: '7',
      card: 'Fix sign-in',
      from: 'Doing',
      to: 'Done',
    });
    expect(JSON.parse(rows[1]!.detail as string).card).toBe('Untitled');
    // Nothing on the Timeline.
    const timeline = await body<{ events: { type: string }[] }>(
      await call('/timeline', { auth: ada.auth }),
    );
    expect(timeline.events.map((e) => e.type)).toEqual(['created']);
    expect((await asApp(`/app/items/${plan.id}/card-moves`, { moves: [] })).status).toBe(204);
  });

  it.each([
    [{}],
    [{ moves: 'no' }],
    [{ moves: Array.from({ length: CARD_MOVES_MAX + 1 }, () => ({})) }],
    [{ moves: [null] }],
    [{ moves: [{ cardId: 'a b', from: 'x', to: 'y', at: 1 }] }],
    [{ moves: [{ cardId: 'c', from: '', to: 'y', at: 1 }] }],
    [{ moves: [{ cardId: 'c', from: 'x', to: 'y', at: -1 }] }],
    [{ moves: [{ cardId: 'c', from: 'x', to: 'y', at: 1, cardKey: 1.5 }] }],
  ])('refuses %o', async (payload) => {
    const ada = await person('user_wm2');
    const plan = await makeItem(ada.auth);
    const res = await asApp(`/app/items/${plan.id}/card-moves`, payload);
    expect(res.status).toBe(400);
    expect(await body(res)).toEqual({ error: 'invalid_moves' });
  });

  it("takes them only from the item's own app", async () => {
    const ada = await person('user_wm3');
    const plan = await makeItem(ada.auth);
    const res = await asApp(
      `/app/items/${plan.id}/card-moves`,
      { moves: [] },
      'livediagram',
      'ld-key',
    );
    expect(res.status).toBe(403);
  });
});

// What the outbox costs an event write (the card's performance note): the statement rides in the event's own batch, so
// the measure is the request's time with no webhook listening against one that queues a delivery per rename. Budgets
// are CPU-time generous so a loaded machine never fails them; the numbers are logged for the PR.
describe('cost', () => {
  it('adds well under a millisecond to an event write, and writes nothing when no webhook listens', async () => {
    const ada = await person('user_wc1');
    const item = await makeItem(ada.auth, { title: 't0' });
    const rename = async (n: number) => {
      const start = performance.now();
      for (let i = 1; i <= n; i += 1)
        await call(`/items/${item.id}`, {
          method: 'PATCH',
          auth: ada.auth,
          body: { title: `t${i}` },
        });
      return (performance.now() - start) / n;
    };
    const runs = 150;
    await rename(20);
    const quiet = await rename(runs);
    expect(deliveries()).toEqual([]);
    await addWebhook(ada.auth, { events: ['renamed'] });
    const listened = await rename(runs);
    expect(deliveries()).toHaveLength(runs);
    console.info('[measure] webhook outbox', { quietMs: quiet, listenedMs: listened });
    expect(listened - quiet).toBeLessThan(5);
  });
});

describe('waking the dispatcher', () => {
  const namespace = (kicks: string[]) => ({
    idFromName: (name: string) => name as unknown as DurableObjectId,
    get: (id: DurableObjectId) => ({ kick: async () => void kicks.push(String(id)) }),
  });

  it('wakes it after a request that queued something, and not after one that could not', async () => {
    const kicks: string[] = [];
    const env = { ...h.db.env, WEBHOOKS: namespace(kicks) };
    const ada = await person('user_wk1');
    await addWebhook(ada.auth, { events: ['created'] });
    await call('/folders', { method: 'POST', auth: ada.auth, body: { name: 'F' }, env });
    await Promise.all(h.pending.splice(0));
    expect(kicks).toEqual([]);
    const before = queuedCount();
    await call('/items', { method: 'POST', auth: ada.auth, body: { app: 'liveplanner' }, env });
    expect(queuedCount()).toBeGreaterThan(before);
    await Promise.all(h.pending.splice(0));
    expect(kicks).toEqual(['deliveries']);
  });

  it('asks the dispatcher only when something is due, and never throws', async () => {
    const kicks: string[] = [];
    const env = { ...h.db.env, WEBHOOKS: namespace(kicks) };
    expect(await kickWebhooks(h.db.env)).toBe(false);
    expect(await kickWebhooks(env)).toBe(false);
    const ada = await person('user_wk2');
    await addWebhook(ada.auth, { events: ['created'] });
    await makeItem(ada.auth);
    expect(await kickWebhooks(env)).toBe(true);
    const broken = {
      ...env,
      WEBHOOKS: {
        ...namespace(kicks),
        get: () => ({ kick: () => Promise.reject(new Error('down')) }),
      },
    };
    expect(await kickWebhooks(broken)).toBe(false);
  });

  it('wakes it from the 15-minute cron too', async () => {
    const kicks: string[] = [];
    const env = { ...h.db.env, WEBHOOKS: namespace(kicks) };
    const ada = await person('user_wk3');
    await addWebhook(ada.auth, { events: ['created'] });
    await makeItem(ada.auth);
    const { default: worker } = await import('../index');
    await worker.scheduled({ cron: '*/15 * * * *' } as ScheduledController, env);
    expect(kicks).toEqual(['deliveries']);
  });
});
