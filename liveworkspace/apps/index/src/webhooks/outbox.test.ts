// The outbox (webhooks.md "What it sends", "Delivery"): an event the index records about an item queues a delivery,
// in the same batch, for each of that item's own live webhooks that listens for it (and, set to Only Me, only for its
// creator's own actions), and nothing else; a plan's card moves queue the same way, off the Timeline. The request
// wakes the dispatcher only after answering.
import { CARD_MOVES_MAX } from '@liveworkspace/index-client';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
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
  it("queues what a document's own webhooks listen for, about that document", async () => {
    const ada = await person('user_wo1');
    const item = await makeItem(ada.auth, { title: 'Roadmap' });
    await addWebhook(ada.auth, item.id, { events: ['renamed'] });
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
    expect(queued()).toEqual(['renamed Roadmap 2']);
    const renamed = deliveries()[0]!;
    expect(renamed).toMatchObject({
      state: 'pending',
      attempts: 0,
      app: 'liveplanner',
      item_id: item.id,
      actor_id: 'user_wo1',
    });
    expect(JSON.parse(renamed.detail as string)).toEqual({ from: 'Roadmap' });
  });

  it("never queues another document's events, even the same owner's", async () => {
    const ada = await person('user_wo9');
    const canvas = await makeItem(ada.auth, { app: 'livediagram', title: 'Canvas' });
    const plan = await makeItem(ada.auth, { title: 'Plan' });
    const hook = await addWebhook(ada.auth, canvas.id, { events: ['shared', 'renamed'] });
    for (const item of [canvas, plan]) {
      await call(`/items/${item.id}/share`, {
        method: 'POST',
        auth: ada.auth,
        body: { level: 'view' },
      });
      await call(`/items/${item.id}`, { method: 'PATCH', auth: ada.auth, body: { title: 'New' } });
    }
    expect(deliveries().map((d) => `${d.app} ${d.type}`)).toEqual([
      'livediagram shared',
      'livediagram renamed',
    ]);
    expect(deliveries().every((d) => d.webhook_id === hook.webhook.id)).toBe(true);
  });

  it("sends an Only Me webhook its creator's actions alone, an Anyone webhook everyone's", async () => {
    const bo = await person('user_wo3', { teams: [{ id: 'teamA' }] });
    const cy = await person('user_wo10', { teams: [{ id: 'teamA' }] });
    const item = await makeItem(bo.auth, { title: 'Team plan', teamId: 'teamA' });
    const mine = await addWebhook(bo.auth, item.id, { events: ['renamed'], who: 'me' });
    const anyone = await addWebhook(bo.auth, item.id, { events: ['renamed'] });
    await call(`/items/${item.id}`, { method: 'PATCH', auth: bo.auth, body: { title: 'By Bo' } });
    await call(`/items/${item.id}`, { method: 'PATCH', auth: cy.auth, body: { title: 'By Cy' } });
    expect(
      deliveries()
        .map((d) => `${d.webhook_id} ${d.title}`)
        .sort(),
    ).toEqual(
      [
        `${mine.webhook.id} By Bo`,
        `${anyone.webhook.id} By Bo`,
        `${anyone.webhook.id} By Cy`,
      ].sort(),
    );
  });

  it('queues comments and actions from a collab push, once however often it is sent', async () => {
    const ada = await person('user_wo4');
    const item = await makeItem(ada.auth, { title: 'Board' });
    await addWebhook(ada.auth, item.id, {
      events: ['commented', 'action_assigned', 'action_done'],
    });
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
    const item = await makeItem(ada.auth, { title: 'Now' });
    const { webhook } = await addWebhook(ada.auth, item.id, { events: ['renamed'] });
    await call(`/webhooks/${webhook.id}`, {
      method: 'PATCH',
      auth: ada.auth,
      body: { paused: true },
    });
    await call(`/items/${item.id}`, { method: 'PATCH', auth: ada.auth, body: { title: 'Paused' } });
    expect(deliveries()).toEqual([]);
    await call(`/webhooks/${webhook.id}`, {
      method: 'PATCH',
      auth: ada.auth,
      body: { paused: false },
    });
    // 500 already waiting: the next is not queued.
    h.db.sql.prepare('DELETE FROM webhook_deliveries').run();
    h.db.sql
      .prepare(
        `WITH RECURSIVE n(v) AS (SELECT 1 UNION ALL SELECT v + 1 FROM n WHERE v < 500)
         INSERT INTO webhook_deliveries (webhook_id, event_id, type, app, title, occurred_at, next_at)
         SELECT ?, 'old' || v, 'renamed', 'liveplanner', 't', 0, 0 FROM n`,
      )
      .run(webhook.id);
    await call(`/items/${item.id}`, { method: 'PATCH', auth: ada.auth, body: { title: 'Later' } });
    expect(deliveries().filter((d) => d.title === 'Later')).toEqual([]);
  });

  it('skips an event older than an hour', async () => {
    const ada = await person('user_wo6');
    const item = await makeItem(ada.auth);
    await addWebhook(ada.auth, item.id, { events: ['commented'] });
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

describe('a document deleted for good', () => {
  it('takes its webhooks and their deliveries with it', async () => {
    const ada = await person('user_wo7');
    const item = await makeItem(ada.auth);
    const { webhook } = await addWebhook(ada.auth, item.id, { events: ['renamed'] });
    await call(`/items/${item.id}`, { method: 'PATCH', auth: ada.auth, body: { title: 'x' } });
    expect(deliveries()).toHaveLength(1);
    const res = await call(`/items/${item.id}?permanent=true`, {
      method: 'DELETE',
      auth: ada.auth,
    });
    expect(res.status).toBeLessThan(300);
    expect(h.db.sql.prepare('SELECT id FROM webhooks WHERE id = ?').all(webhook.id)).toEqual([]);
    expect(deliveries()).toEqual([]);
  });
});

describe('card moves', () => {
  it("queues a plan's card moves for its own webhooks, once each however often they are sent", async () => {
    const ada = await person('user_wm1');
    const plan = await makeItem(ada.auth, { title: 'Sprint 4' });
    await addWebhook(ada.auth, plan.id, { events: ['card_moved'] });
    const at = Date.now();
    const moves = [
      {
        cardId: 'c1',
        cardKey: 7,
        card: 'Fix sign-in',
        from: 'Doing',
        to: 'Done',
        actorId: 'user_wm1',
        actorName: 'Ada',
        at,
      },
      { cardId: 'c2', cardKey: null, card: '', from: 'To Do', to: 'Doing', at: at + 1 },
    ];
    expect((await asApp(`/app/items/${plan.id}/card-moves`, { moves })).status).toBe(204);
    expect((await asApp(`/app/items/${plan.id}/card-moves`, { moves })).status).toBe(204);
    const rows = deliveries();
    expect(rows.map((d) => [d.type, d.title, d.actor_name, d.actor_id])).toEqual([
      ['card_moved', 'Sprint 4', 'Ada', 'user_wm1'],
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

  it("sends an Only Me webhook its creator's moves alone, never one with no mover", async () => {
    const ada = await person('user_wm4');
    const plan = await makeItem(ada.auth);
    const { webhook } = await addWebhook(ada.auth, plan.id, { events: ['card_moved'], who: 'me' });
    const at = Date.now();
    const move = (cardId: string, actorId?: string) => ({
      cardId,
      cardKey: null,
      card: cardId,
      from: 'A',
      to: 'B',
      ...(actorId ? { actorId } : {}),
      at,
    });
    await asApp(`/app/items/${plan.id}/card-moves`, {
      moves: [move('c1', 'user_wm4'), move('c2', 'user_other'), move('c3')],
    });
    expect(deliveries().map((d) => [d.webhook_id, d.title, d.actor_id])).toEqual([
      [webhook.id, expect.any(String), 'user_wm4'],
    ]);
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

describe('form responses', () => {
  const pushForm = (itemId: string, responses: number, extra: Record<string, unknown> = {}) =>
    asApp(`/app/items/${itemId}/forms/f1`, {
      form: { heading: 'Bug Report', boardTabId: null, responses, latestAt: Date.now(), ...extra },
    });

  it("queues the rise in a form's responses for its plan's own webhooks, once, never the answers", async () => {
    const ada = await person('user_wf1');
    const plan = await makeItem(ada.auth, { title: 'Triage' });
    await addWebhook(ada.auth, plan.id, { events: ['form_response'] });
    // Only Me: a response has no account behind it, so never reaches it.
    await addWebhook(ada.auth, plan.id, { events: ['form_response'], who: 'me' });
    const bo = await person('user_wf2');
    const bos = await makeItem(bo.auth);
    await addWebhook(bo.auth, bos.id, { events: ['form_response'] });
    // Published with none, then one response, the same push again, then two more at once.
    expect((await pushForm(plan.id, 0, { code: 'abc123' })).status).toBe(204);
    expect((await pushForm(plan.id, 1)).status).toBe(204);
    await pushForm(plan.id, 1);
    await pushForm(plan.id, 3);
    const rows = deliveries();
    expect(rows.map((d) => [d.type, d.title, d.actor_id, d.actor_name])).toEqual([
      ['form_response', 'Triage', null, null],
      ['form_response', 'Triage', null, null],
    ]);
    expect(rows.map((d) => JSON.parse(d.detail as string))).toEqual([
      { form: 'Bug Report', responses: '1', total: '1' },
      { form: 'Bug Report', responses: '2', total: '3' },
    ]);
    // One webhook: not the Only Me one, and not Bo's on his own plan.
    expect(new Set(rows.map((d) => d.webhook_id)).size).toBe(1);
    // Nothing on the Timeline.
    const timeline = await body<{ events: { type: string }[] }>(
      await call('/timeline', { auth: ada.auth }),
    );
    expect(timeline.events.map((e) => e.type)).toEqual(['created']);
  });

  it('queues nothing for a form never pushed, or published again, or for a webhook not listening', async () => {
    const ada = await person('user_wf3');
    const plan = await makeItem(ada.auth);
    const { webhook } = await addWebhook(ada.auth, plan.id, { events: ['renamed'] });
    await pushForm(plan.id, 2);
    await pushForm(plan.id, 4);
    expect(deliveries()).toEqual([]);
    await call(`/webhooks/${webhook.id}`, {
      method: 'PATCH',
      auth: ada.auth,
      body: { events: ['form_response'] },
    });
    // Taken off, then published again with the count it had: not news.
    await asApp(`/app/items/${plan.id}/forms/f1`, { form: null });
    await pushForm(plan.id, 4);
    expect(deliveries()).toEqual([]);
    await pushForm(plan.id, 5);
    expect(deliveries().map((d) => d.type)).toEqual(['form_response']);
  });

  it('costs a form push one round trip', async () => {
    const ada = await person('user_wf4');
    const plan = await makeItem(ada.auth);
    await addWebhook(ada.auth, plan.id, { events: ['form_response'] });
    await pushForm(plan.id, 1);
    let trips = 0;
    const db = h.db.env.INDEX_DB;
    const env = {
      ...h.db.env,
      INDEX_DB: {
        prepare: (q: string) => db.prepare(q),
        batch: (s: D1PreparedStatement[]) => (trips++, db.batch(s)),
      } as unknown as D1Database,
    };
    await call(`/app/items/${plan.id}/forms/f1`, {
      method: 'PUT',
      auth: 'lp-key',
      headers: { 'X-Index-App': 'liveplanner' },
      body: { form: { heading: 'Q', boardTabId: null, responses: 2, latestAt: Date.now() } },
      env,
    });
    expect(trips).toBe(1);
    // The first push held no count; the second queued its rise.
    expect(deliveries()).toHaveLength(1);
  });
});

// What the outbox costs an event write (the card's performance note): the statement rides in the event's own batch, so
// the measure is the request's time with no webhook listening against one that queues a delivery per rename. Budgets
// are CPU-time generous so a loaded machine never fails them; the numbers are logged for the PR.
describe('cost', () => {
  it('adds well under a millisecond to an event write, and writes nothing when no webhook listens', async () => {
    const ada = await person('user_wc1');
    const item = await makeItem(ada.auth, { title: 't0' });
    const rename = async (n: number) =>
      (await cpuMsOfAsync(async () => {
        for (let i = 1; i <= n; i += 1)
          await call(`/items/${item.id}`, {
            method: 'PATCH',
            auth: ada.auth,
            body: { title: `t${i}` },
          });
      })) / n;
    const runs = 150;
    await rename(20);
    const quiet = await rename(runs);
    expect(deliveries()).toEqual([]);
    await addWebhook(ada.auth, item.id, { events: ['renamed'] });
    const listened = await rename(runs);
    expect(deliveries()).toHaveLength(runs);
    console.info('[measure] webhook outbox', { quietMs: quiet, listenedMs: listened });
    expect(listened - quiet).toBeLessThan(cpuBudgetMs(5));
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
    const item = await makeItem(ada.auth);
    await addWebhook(ada.auth, item.id, { events: ['renamed'] });
    await call('/folders', { method: 'POST', auth: ada.auth, body: { name: 'F' }, env });
    await Promise.all(h.pending.splice(0));
    expect(kicks).toEqual([]);
    const before = queuedCount();
    await call(`/items/${item.id}`, { method: 'PATCH', auth: ada.auth, body: { title: 'R' }, env });
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
    const item = await makeItem(ada.auth);
    await addWebhook(ada.auth, item.id, { events: ['renamed'] });
    await call(`/items/${item.id}`, { method: 'PATCH', auth: ada.auth, body: { title: 'R' } });
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
    const item = await makeItem(ada.auth);
    await addWebhook(ada.auth, item.id, { events: ['renamed'] });
    await call(`/items/${item.id}`, { method: 'PATCH', auth: ada.auth, body: { title: 'R' } });
    const { default: worker } = await import('../index');
    await worker.scheduled({ cron: '*/15 * * * *' } as ScheduledController, env);
    expect(kicks).toEqual(['deliveries']);
  });
});
