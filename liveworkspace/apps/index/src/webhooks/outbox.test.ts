// The outbox (webhooks.md "No event subscriptions", "Delivery"): nothing that happens to an item queues a delivery by
// itself. A connection sends a rule's message and Send Test's ping, and nothing else; the request that queued one
// wakes the dispatcher only after answering.
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { beforeEach, describe, expect, it } from 'vitest';
import { call, h, makeItem, person, useHarness } from '../test-support';
import { kickWebhooks, queuedCount } from './outbox';
import {
  addWebhook,
  answerWorld,
  deliveries,
  newWorld,
  sendThrough,
  WEBHOOK_KEY,
  type World,
} from './test-webhooks';

useHarness({ WEBHOOK_KEY });

let world: World;
beforeEach(() => {
  world = newWorld();
  answerWorld(world);
});

const asApp = (path: string, payload: unknown) =>
  call(path, {
    method: 'PUT',
    auth: 'lp-key',
    headers: { 'X-Index-App': 'liveplanner' },
    body: payload,
  });

describe('what happens to an item', () => {
  it('queues nothing: a rename, a move to the Trash, a share link, a comment, an action, a form response', async () => {
    const ada = await person('user_wo1');
    const item = await makeItem(ada.auth, { title: 'Roadmap' });
    await addWebhook(ada.auth, item.id);
    const before = queuedCount();
    await call(`/items/${item.id}`, { method: 'PATCH', auth: ada.auth, body: { title: 'New' } });
    await call(`/items/${item.id}/share`, {
      method: 'POST',
      auth: ada.auth,
      body: { level: 'view' },
    });
    const now = Date.now();
    const collab = await asApp(`/app/items/${item.id}/collab/tab1`, {
      threads: [
        {
          elementId: 'e1',
          elementLabel: 'Card',
          resolved: false,
          commentCount: 1,
          participantIds: ['user_wo1'],
          mentionedIds: [],
          latestText: 'Looks good',
          latestAuthorName: 'Ada',
          latestAuthorId: 'user_wo1',
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
          assignerId: 'user_wo1',
          teamId: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
    expect(collab.status).toBe(204);
    for (const responses of [0, 1, 3]) {
      const form = { heading: 'Bug Report', boardTabId: null, responses, latestAt: now };
      expect((await asApp(`/app/items/${item.id}/forms/f1`, { form })).status).toBe(204);
    }
    await call(`/items/${item.id}`, { method: 'DELETE', auth: ada.auth });
    // The events are in the log (History reads them); none reached the connection, and none asked for a wake.
    const logged = h.db.sql
      .prepare("SELECT type FROM events WHERE type <> 'created' ORDER BY type")
      .all()
      .map((r) => (r as { type: string }).type);
    expect(logged).toEqual(['action_assigned', 'commented', 'renamed', 'shared', 'trashed']);
    expect(h.db.sql.prepare('SELECT responses FROM collab_forms').get()).toEqual({ responses: 3 });
    expect(deliveries()).toEqual([]);
    expect(queuedCount()).toBe(before);
  });
});

describe('a document deleted for good', () => {
  it('takes its webhooks and their deliveries with it', async () => {
    const ada = await person('user_wo7');
    const item = await makeItem(ada.auth);
    const { webhook } = await addWebhook(ada.auth, item.id);
    await sendThrough(item.id, webhook.id);
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

// What removing the hand-off saves an event write (it rode every rename's batch): the request's CPU time with a
// connection on the item, logged for the PR. The budget is generous so a loaded machine never fails it.
describe('cost', () => {
  it('adds nothing to an event write, with a connection on the item or without', async () => {
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
    const without = await rename(runs);
    await addWebhook(ada.auth, item.id);
    const withOne = await rename(runs);
    expect(deliveries()).toEqual([]);
    console.info('[measure] event write', { withoutMs: without, withConnectionMs: withOne });
    expect(withOne - without).toBeLessThan(cpuBudgetMs(5));
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
    const { webhook } = await addWebhook(ada.auth, item.id);
    await call(`/items/${item.id}`, { method: 'PATCH', auth: ada.auth, body: { title: 'R' }, env });
    await Promise.all(h.pending.splice(0));
    expect(kicks).toEqual([]);
    const before = queuedCount();
    await call(`/webhooks/${webhook.id}/test`, { method: 'POST', auth: ada.auth, env });
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
    const { webhook } = await addWebhook(ada.auth, item.id);
    await sendThrough(item.id, webhook.id);
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
    const { webhook } = await addWebhook(ada.auth, item.id);
    await sendThrough(item.id, webhook.id);
    const { default: worker } = await import('../index');
    await worker.scheduled({ cron: '*/15 * * * *' } as ScheduledController, env);
    expect(kicks).toEqual(['deliveries']);
  });
});
