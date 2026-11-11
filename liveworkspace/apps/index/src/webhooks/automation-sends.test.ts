// Automation sends (webhooks.md "Automation sends"): a plan's automation rule posts a message through the one webhook
// it names, whatever that webhook picked, and no other webhook hears it; each send is answered queued or refused, in
// the order sent, and the same key again queues nothing new.
import { AUTOMATION_SENDS_MAX, type AutomationSendResult } from '@liveworkspace/index-client';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { beforeEach, describe, expect, it } from 'vitest';
import { body, call, h, makeItem, person, useHarness } from '../test-support';
import { dispatch, type DispatchDeps } from './dispatch';
import { queuedCount } from './outbox';
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

const push = (itemId: string, payload: unknown, app = 'liveplanner', key = 'lp-key') =>
  call(`/app/items/${itemId}/automation-sends`, {
    method: 'POST',
    auth: key,
    headers: { 'X-Index-App': app },
    body: payload,
  });

const results = async (itemId: string, sends: unknown[]) => {
  const res = await push(itemId, { sends });
  expect(res.status).toBe(200);
  return (await body<{ results: AutomationSendResult[] }>(res)).results;
};

const send = (webhookId: string, over: Record<string, unknown> = {}) => ({
  key: 'run1:step1',
  webhookId,
  rule: 'Tell the channel',
  card: {
    key: 48,
    title: 'Publish pricing page',
    url: 'https://liveplanner.app/project/p#item=c1',
  },
  text: 'Pricing is live',
  at: Date.now(),
  ...over,
});

// A plan with a webhook that hears nothing an automation sends, and another listening for every event.
async function planWithHooks(id: string, input: Record<string, unknown> = {}) {
  const ada = await person(id);
  const plan = await makeItem(ada.auth, { title: 'Launch' });
  const { webhook: named } = await addWebhook(ada.auth, plan.id, {
    events: ['renamed'],
    who: 'me',
    ...input,
  });
  const { webhook: other } = await addWebhook(ada.auth, plan.id, {
    events: ['renamed', 'commented', 'card_moved', 'form_response'],
  });
  return { ada, plan, named, other };
}

const pause = (webhookId: string, reason: string) =>
  h.db.sql
    .prepare('UPDATE webhooks SET paused_at = 1, paused_reason = ? WHERE id = ?')
    .run(reason, webhookId);

const fillPending = (webhookId: string, count: number) =>
  h.db.sql
    .prepare(
      `WITH RECURSIVE n(v) AS (SELECT 1 UNION ALL SELECT v + 1 FROM n WHERE v < ?)
       INSERT INTO webhook_deliveries (webhook_id, event_id, type, app, title, occurred_at, next_at)
       SELECT ?, 'old' || v, 'renamed', 'liveplanner', 't', 0, 0 FROM n`,
    )
    .run(count, webhookId);

describe('queuing a send', () => {
  it('queues one delivery on the webhook it names alone, whatever its events or Who Did It', async () => {
    const { ada, plan, named } = await planWithHooks('user_as1');
    const before = queuedCount();
    expect(await results(plan.id, [send(named.id)])).toEqual([{ key: 'run1:step1', queued: true }]);
    expect(queuedCount()).toBe(before + 1);
    const rows = deliveries();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      webhook_id: named.id,
      type: 'automation',
      app: 'liveplanner',
      item_id: plan.id,
      title: 'Launch',
      actor_id: null,
      actor_name: 'Automation',
      state: 'pending',
    });
    expect(rows[0]!.event_id).toMatch(/^aut:[0-9a-f]{64}$/);
    expect(JSON.parse(rows[0]!.detail as string)).toEqual({
      rule: 'Tell the channel',
      card: {
        key: 48,
        title: 'Publish pricing page',
        url: 'https://liveplanner.app/project/p#item=c1',
      },
      text: 'Pricing is live',
    });
    // Nothing on the Timeline.
    const timeline = await body<{ events: { type: string }[] }>(
      await call('/timeline', { auth: ada.auth }),
    );
    expect(timeline.events.map((e) => e.type)).toEqual(['created']);
  });

  it('is never heard by another webhook, even one listening for every event', async () => {
    const { plan, named, other } = await planWithHooks('user_as2');
    await results(plan.id, [send(named.id), send(named.id, { key: 'run1:step2' })]);
    expect(deliveries().map((d) => d.webhook_id)).toEqual([named.id, named.id]);
    expect(deliveries().some((d) => d.webhook_id === other.id)).toBe(false);
  });

  it('queues nothing new for a key sent again, in a later push or the same one, and answers queued', async () => {
    const { plan, named } = await planWithHooks('user_as3');
    await results(plan.id, [send(named.id)]);
    expect(await results(plan.id, [send(named.id), send(named.id)])).toEqual([
      { key: 'run1:step1', queued: true },
      { key: 'run1:step1', queued: true },
    ]);
    expect(deliveries()).toHaveLength(1);
    // Even once its webhook is paused or full: it was queued.
    pause(named.id, 'paused');
    expect(await results(plan.id, [send(named.id)])).toEqual([{ key: 'run1:step1', queued: true }]);
    // A new key on the same webhook is its own delivery.
    h.db.sql.prepare('UPDATE webhooks SET paused_at = NULL, paused_reason = NULL').run();
    await results(plan.id, [send(named.id, { key: 'run2:step1' })]);
    expect(deliveries()).toHaveLength(2);
  });

  it('cuts its texts, keeps a card link only on the app’s origin, and dates it no later than now', async () => {
    const { plan, named } = await planWithHooks('user_as4');
    const now = Date.now();
    await results(plan.id, [
      send(named.id, {
        key: 'a',
        rule: `  ${'r'.repeat(80)}  `,
        text: 'x'.repeat(2500),
        card: { key: 1, title: 't'.repeat(300), url: 'https://evil.example/phish' },
        at: now + 3_600_000,
      }),
      send(named.id, {
        key: 'b',
        rule: '   ',
        card: { key: 2, title: '', url: 'https://liveplanner.app/project/p?a=1|2' },
      }),
      send(named.id, { key: 'c', card: { key: 3, title: 'Bad', url: 'not a url' } }),
      send(named.id, { key: 'd', card: null }),
    ]);
    const details = deliveries().map((d) => JSON.parse(d.detail as string));
    expect(details[0].rule).toBe('r'.repeat(60));
    expect(details[0].text).toHaveLength(2000);
    expect(details[0].card).toEqual({ key: 1, title: 't'.repeat(200), url: null });
    expect(deliveries()[0]!.occurred_at).toBeLessThanOrEqual(Date.now());
    expect(deliveries()[0]!.occurred_at).toBeGreaterThanOrEqual(now);
    expect(details[1].rule).toBe('Untitled');
    expect(details[1].card).toEqual({
      key: 2,
      title: 'Untitled',
      url: 'https://liveplanner.app/project/p?a=1%7C2',
    });
    expect(details[2].card.url).toBeNull();
    expect(details[3].card).toBeNull();
  });

  it('keeps no card link while the app has no origin set', async () => {
    const { plan, named } = await planWithHooks('user_as5');
    const { pushAutomationSends } = await import('./automation-sends');
    const request = new Request('https://x/', {
      method: 'POST',
      body: JSON.stringify({ sends: [send(named.id)] }),
    });
    const env = { ...h.db.env, APP_ORIGIN_LIVEPLANNER: undefined };
    expect((await pushAutomationSends(env, plan.id, 'liveplanner', request)).status).toBe(200);
    expect(JSON.parse(deliveries()[0]!.detail as string).card.url).toBeNull();
  });

  it('answers an empty push with no results, writing nothing', async () => {
    const { plan } = await planWithHooks('user_as6');
    const before = queuedCount();
    expect(await results(plan.id, [])).toEqual([]);
    expect(queuedCount()).toBe(before);
    expect(deliveries()).toEqual([]);
  });
});

describe('refusing a send', () => {
  it('answers each send in the order sent: not the plan’s, gone, paused with its reason, full', async () => {
    const { ada, plan, named, other } = await planWithHooks('user_ar1');
    const elsewhere = await makeItem(ada.auth);
    const { webhook: theirs } = await addWebhook(ada.auth, elsewhere.id, { events: ['renamed'] });
    pause(other.id, 'gone');
    const answer = await results(plan.id, [
      send(theirs.id, { key: 'k1' }),
      send('no-such-webhook', { key: 'k2' }),
      send(other.id, { key: 'k3' }),
      send(named.id, { key: 'k4' }),
    ]);
    expect(answer).toEqual([
      {
        key: 'k1',
        queued: false,
        reason: 'This webhook isn’t on this plan any more',
        code: 'webhook_not_found',
      },
      {
        key: 'k2',
        queued: false,
        reason: 'This webhook isn’t on this plan any more',
        code: 'webhook_not_found',
      },
      {
        key: 'k3',
        queued: false,
        reason: 'This webhook is paused: the address said it’s gone',
        code: 'webhook_paused',
      },
      { key: 'k4', queued: true },
    ]);
    expect(deliveries().map((d) => [d.webhook_id, d.type])).toEqual([[named.id, 'automation']]);
  });

  it.each([
    ['paused', 'an editor paused it'],
    ['creator_left', 'the person who added it can no longer edit this plan'],
    ['failing', 'its last 20 messages failed'],
    ['gone', 'the address said it’s gone'],
  ])('gives a webhook paused %s its reason', async (reason, words) => {
    const { plan, named } = await planWithHooks(`user_ap_${reason}`);
    pause(named.id, reason);
    expect(await results(plan.id, [send(named.id)])).toEqual([
      {
        key: 'run1:step1',
        queued: false,
        reason: `This webhook is paused: ${words}`,
        code: 'webhook_paused',
      },
    ]);
  });

  it('holds the 500-pending cap, counting the sends ahead in the same push', async () => {
    const { plan, named } = await planWithHooks('user_ar2');
    fillPending(named.id, 498);
    expect(
      await results(plan.id, [
        send(named.id, { key: 'a' }),
        send(named.id, { key: 'b' }),
        send(named.id, { key: 'c' }),
      ]),
    ).toEqual([
      { key: 'a', queued: true },
      { key: 'b', queued: true },
      {
        key: 'c',
        queued: false,
        reason: 'Too many messages waiting for this webhook',
        code: 'webhook_full',
      },
    ]);
    expect(deliveries().filter((d) => d.state === 'pending')).toHaveLength(500);
  });

  it('writes no row for a webhook paused after the push read it', async () => {
    const { plan, named } = await planWithHooks('user_ar3');
    const { automationSendStatement } = await import('./outbox');
    pause(named.id, 'paused');
    const detail = { rule: 'r', card: null, text: 't' };
    await automationSendStatement(h.db.env.INDEX_DB, plan.id, [
      { id: 'aut:x', webhookId: named.id, ahead: 0, at: Date.now(), detail },
    ]).run();
    // Nor one past the cap.
    h.db.sql.prepare('UPDATE webhooks SET paused_at = NULL').run();
    fillPending(named.id, 500);
    await automationSendStatement(h.db.env.INDEX_DB, plan.id, [
      { id: 'aut:y', webhookId: named.id, ahead: 0, at: Date.now(), detail },
    ]).run();
    expect(deliveries().filter((d) => d.type === 'automation')).toEqual([]);
  });

  it.each([
    [{}],
    [{ sends: 'no' }],
    [{ sends: [null] }],
    [{ sends: [[]] }],
    [{ sends: [send('w', { key: '' })] }],
    [{ sends: [send('w', { key: 'k'.repeat(201) })] }],
    [{ sends: [send('w', { key: 7 })] }],
    [{ sends: [send('')] }],
    [{ sends: [send('w', { rule: 3 })] }],
    [{ sends: [send('w', { text: '  ' })] }],
    [{ sends: [send('w', { text: null })] }],
    [{ sends: [send('w', { at: -1 })] }],
    [{ sends: [send('w', { at: 'now' })] }],
    [{ sends: [send('w', { card: undefined })] }],
    [{ sends: [send('w', { card: [] })] }],
    [{ sends: [send('w', { card: { key: 1.5, title: 't', url: 'u' } })] }],
    [{ sends: [send('w', { card: { key: 1, title: 2, url: 'u' } })] }],
    [{ sends: [send('w', { card: { key: 1, title: 't' } })] }],
    [
      {
        sends: Array.from({ length: AUTOMATION_SENDS_MAX + 1 }, (_, k) =>
          send('w', { key: `${k}` }),
        ),
      },
    ],
  ])('refuses %o as invalid_sends, queuing none of it', async (payload) => {
    const ada = await person('user_ar4');
    const plan = await makeItem(ada.auth);
    const res = await push(plan.id, payload);
    expect(res.status).toBe(400);
    expect(await body(res)).toEqual({ error: 'invalid_sends' });
    expect(deliveries()).toEqual([]);
  });

  it('takes five at most, and only from liveplanner for its own plan', async () => {
    const { ada, plan, named } = await planWithHooks('user_ar5');
    const five = Array.from({ length: AUTOMATION_SENDS_MAX }, (_, k) =>
      send(named.id, { key: `k${k}` }),
    );
    expect((await results(plan.id, five)).every((r) => r.queued)).toBe(true);
    // Another app, for a plan: the item's own app only.
    const wrong = await push(plan.id, { sends: [] }, 'livediagram', 'ld-key');
    expect(wrong.status).toBe(403);
    expect(await body(wrong)).toEqual({ error: 'wrong_app' });
    // Another app for its own document: automations are liveplanner's alone.
    const canvas = await makeItem(ada.auth, { app: 'livediagram' });
    const own = await push(canvas.id, { sends: [] }, 'livediagram', 'ld-key');
    expect(own.status).toBe(403);
    expect(await body(own)).toEqual({ error: 'wrong_app' });
    // Not an app's key, or not a POST.
    expect((await push(plan.id, { sends: [] }, 'liveplanner', 'nope')).status).toBe(401);
    const put = await call(`/app/items/${plan.id}/automation-sends`, {
      method: 'PUT',
      auth: 'lp-key',
      headers: { 'X-Index-App': 'liveplanner' },
      body: { sends: [] },
    });
    expect(put.status).toBe(404);
  });
});

describe('what it is not', () => {
  it('is never an event a person picks for a webhook', async () => {
    const ada = await person('user_an1');
    const plan = await makeItem(ada.auth);
    for (const events of [['automation'], ['renamed', 'automation']]) {
      const res = await call(`/items/${plan.id}/webhooks`, {
        method: 'POST',
        auth: ada.auth,
        body: { name: 'Hook', kind: 'json', url: 'https://hooks.example.com/in', events },
      });
      expect(res.status).toBe(400);
      expect(await body(res)).toEqual({ error: 'invalid_webhook' });
    }
  });
});

describe('sending one', () => {
  const run = (sent: { body: string }[]) => {
    const deps: DispatchDeps = {
      now: () => Date.now() + 1_000,
      fetch: (async (_input: RequestInfo | URL, init: RequestInit = {}) => {
        sent.push({ body: String(init.body) });
        return new Response('ok');
      }) as typeof fetch,
      resolve: async () => ['93.184.216.34'],
      personTeams: async () => new Set(),
    };
    return dispatch(h.db.env, deps);
  };

  it('sends a plain endpoint the rule, card and message, from Automation', async () => {
    const { plan, named } = await planWithHooks('user_ad1');
    await results(plan.id, [send(named.id)]);
    const sent: { body: string }[] = [];
    await run(sent);
    const json = JSON.parse(sent[0]!.body);
    expect(json).toMatchObject({
      type: 'automation',
      app: 'liveplanner',
      item: { id: plan.id, title: 'Launch', url: `https://liveplanner.app/project/${plan.id}` },
      actor: { id: null, name: 'Automation' },
      detail: {
        rule: 'Tell the channel',
        card: {
          key: 48,
          title: 'Publish pricing page',
          url: 'https://liveplanner.app/project/p#item=c1',
        },
        text: 'Pricing is live',
      },
    });
    expect(deliveries()[0]!.state).toBe('delivered');
  });

  it('posts Slack the message escaped, so a rule cannot ping a channel', async () => {
    const { plan, named } = await planWithHooks('user_ad2', {
      kind: 'slack',
      url: 'https://hooks.slack.com/services/T/B/x',
    });
    await results(plan.id, [send(named.id, { text: '<!channel> ship it', rule: '<!here>' })]);
    const sent: { body: string }[] = [];
    await run(sent);
    const slack = JSON.parse(sent[0]!.body);
    expect(sent[0]!.body).not.toContain('<!channel>');
    expect(sent[0]!.body).not.toContain('<!here>');
    expect(slack.text).toBe('&lt;!channel&gt; ship it');
    expect(slack.blocks[1].elements[0].text).toBe('Automation · &lt;!here&gt;');
  });
});

describe('cost', () => {
  it('settles a full push in one read and queues it in one write, within a CPU budget', async () => {
    const { plan, named } = await planWithHooks('user_ac1');
    const five = Array.from({ length: AUTOMATION_SENDS_MAX }, (_, k) =>
      send(named.id, { key: `k${k}` }),
    );
    const ms = await cpuMsOfAsync(async () => {
      for (let i = 0; i < 20; i++) {
        await results(
          plan.id,
          five.map((s) => ({ ...s, key: `${i}:${s.key}` })),
        );
      }
    });
    expect(deliveries()).toHaveLength(100);
    console.info('[measure] automation sends', { perPushMs: ms / 20 });
    expect(ms).toBeLessThan(cpuBudgetMs(1_000));
  });
});
