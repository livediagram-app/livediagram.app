// Automation sends (webhooks.md "Automation sends"): an item's automation rule, in any app, posts a message through
// the one connection it names, and no other hears it; each send is answered queued or refused, in the order sent, and
// the same key again queues nothing new. What it is about is its subject (a card or a tab); `card` is the field's
// name from when only liveplanner sent, still read.
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
  subject: {
    ref: 'WI-48',
    title: 'Publish pricing page',
    url: 'https://liveplanner.app/project/p#item=c1',
  },
  text: 'Pricing is live',
  at: Date.now(),
  ...over,
});

// A plan with two connections: the one a rule names, and another.
async function planWithHooks(id: string, input: Record<string, unknown> = {}) {
  const ada = await person(id);
  const plan = await makeItem(ada.auth, { title: 'Launch' });
  const { webhook: named } = await addWebhook(ada.auth, plan.id, input);
  const { webhook: other } = await addWebhook(ada.auth, plan.id);
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
       SELECT ?, 'old' || v, 'ping', 'liveplanner', 't', 0, 0 FROM n`,
    )
    .run(count, webhookId);

describe('queuing a send', () => {
  it('queues one delivery on the connection it names alone', async () => {
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
    // A plan's subject that is a card is also written as `card`, as a plain endpoint read it before subjects.
    const about = {
      title: 'Publish pricing page',
      url: 'https://liveplanner.app/project/p#item=c1',
    };
    expect(JSON.parse(rows[0]!.detail as string)).toEqual({
      rule: 'Tell the channel',
      subject: { ref: 'WI-48', ...about },
      card: { key: 48, ref: 'WI-48', ...about },
      text: 'Pricing is live',
    });
    // Nothing in History.
    const history = await body<{ events: { type: string }[] }>(
      await call(`/items/${plan.id}/history`, { auth: ada.auth }),
    );
    expect(history.events.map((e) => e.type)).toEqual(['created']);
  });

  it('is never heard by another connection of the item', async () => {
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

  it('cuts its texts, keeps a subject link only on the app’s origin, and dates it no later than now', async () => {
    const { plan, named } = await planWithHooks('user_as4');
    const now = Date.now();
    const on = 'https://liveplanner.app/project/p';
    await results(plan.id, [
      send(named.id, {
        key: 'a',
        rule: `  ${'r'.repeat(80)}  `,
        text: 'x'.repeat(2500),
        subject: {
          ref: ` ${'R'.repeat(60)} `,
          title: 't'.repeat(300),
          url: 'https://evil.example/phish',
        },
        at: now + 3_600_000,
      }),
      send(named.id, { key: 'b', rule: '   ', subject: { title: '', url: `${on}?a=1|2` } }),
      send(named.id, { key: 'c', subject: { ref: 7, title: 'Bad', url: 'not a url' } }),
      send(named.id, { key: 'd', subject: null }),
      // Neither field: about the plan alone.
      send(named.id, { key: 'e', subject: undefined }),
    ]);
    const details = deliveries().map((d) => JSON.parse(d.detail as string));
    expect(details[0].rule).toBe('r'.repeat(60));
    expect(details[0].text).toHaveLength(2000);
    // A reference with no number at its end is no card: `subject` alone.
    expect(details[0]).not.toHaveProperty('card');
    expect(details[0].subject).toEqual({ ref: 'R'.repeat(40), title: 't'.repeat(200), url: null });
    expect(deliveries()[0]!.occurred_at).toBeLessThanOrEqual(Date.now());
    expect(deliveries()[0]!.occurred_at).toBeGreaterThanOrEqual(now);
    expect(details[1].rule).toBe('Untitled');
    expect(details[1].subject).toEqual({ title: 'Untitled', url: `${on}?a=1%7C2` });
    // A reference that is not text is dropped, never the send refused.
    expect(details[2].subject).toEqual({ title: 'Bad', url: null });
    expect(details[3].subject).toBeNull();
    expect(details[4].subject).toBeNull();
    expect(details.slice(1).some((d) => 'card' in d)).toBe(false);
  });

  // One release: liveplanner's api still sends `card: {key, ref?, title, url}`.
  it('reads `card` when no subject is sent: its ref, else #<key>, and `subject` first when both are', async () => {
    const { plan, named } = await planWithHooks('user_as7');
    const url = 'https://liveplanner.app/project/p';
    await results(plan.id, [
      send(named.id, {
        key: 'a',
        subject: undefined,
        card: { key: 48, ref: 'WI-48', title: 'Ref', url },
      }),
      // A ref that names another card's number is dropped (Work Tracker 1295).
      send(named.id, {
        key: 'b',
        subject: undefined,
        card: { key: 49, ref: 'WI-48', title: 'Off', url },
      }),
      send(named.id, { key: 'c', subject: undefined, card: null }),
      send(named.id, { key: 'd', card: { key: 1, title: 'Card', url } }),
      send(named.id, { key: 'e', subject: null, card: { key: 1, title: 'Card', url } }),
    ]);
    const details = deliveries().map((d) => JSON.parse(d.detail as string));
    expect(details[0]).toMatchObject({
      subject: { ref: 'WI-48', title: 'Ref', url },
      card: { key: 48, ref: 'WI-48', title: 'Ref', url },
    });
    expect(details[1].subject).toEqual({ ref: '#49', title: 'Off', url });
    expect(details[1].card).toEqual({ key: 49, title: 'Off', url });
    expect(details[2].subject).toBeNull();
    expect(details[3].subject.ref).toBe('WI-48');
    expect(details[4].subject).toBeNull();
  });

  it('takes any app’s rule sends for its own item, naming a tab, with no `card` beside it', async () => {
    const ada = await person('user_as8');
    const canvas = await makeItem(ada.auth, { app: 'livediagram', title: 'Workshop' });
    const { webhook } = await addWebhook(ada.auth, canvas.id);
    const tab = { ref: '#2', title: 'Retro', url: `https://livediagram.app/d/${canvas.id}?tab=t2` };
    const res = await push(
      canvas.id,
      { sends: [send(webhook.id, { subject: tab })] },
      'livediagram',
      'ld-key',
    );
    expect(await body(res)).toEqual({ results: [{ key: 'run1:step1', queued: true }] });
    expect(deliveries()[0]).toMatchObject({
      type: 'automation',
      app: 'livediagram',
      title: 'Workshop',
    });
    const detail = JSON.parse(deliveries()[0]!.detail as string);
    expect(detail.subject.ref).toBe('#2');
    expect(detail).not.toHaveProperty('card');
    // Its refusals name the item in its app's word.
    const gone = await push(canvas.id, { sends: [send('nope')] }, 'livediagram', 'ld-key');
    expect((await body<{ results: AutomationSendResult[] }>(gone)).results[0]).toMatchObject({
      reason: 'This connection isn’t on this document any more',
    });
  });

  it('keeps no subject link while the app has no origin set', async () => {
    const { plan, named } = await planWithHooks('user_as5');
    const { pushAutomationSends } = await import('./automation-sends');
    const request = new Request('https://x/', {
      method: 'POST',
      body: JSON.stringify({ sends: [send(named.id)] }),
    });
    const env = { ...h.db.env, APP_ORIGIN_LIVEPLANNER: undefined };
    expect((await pushAutomationSends(env, plan.id, 'liveplanner', request)).status).toBe(200);
    expect(JSON.parse(deliveries()[0]!.detail as string).subject.url).toBeNull();
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
    const { webhook: theirs } = await addWebhook(ada.auth, elsewhere.id);
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
        reason: 'This connection isn’t on this plan any more',
        code: 'webhook_not_found',
      },
      {
        key: 'k2',
        queued: false,
        reason: 'This connection isn’t on this plan any more',
        code: 'webhook_not_found',
      },
      {
        key: 'k3',
        queued: false,
        reason: 'This connection is paused: the address said it’s gone',
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
        reason: `This connection is paused: ${words}`,
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
        reason: 'Too many messages waiting for this connection',
        code: 'webhook_full',
      },
    ]);
    expect(deliveries().filter((d) => d.state === 'pending')).toHaveLength(500);
  });

  it('writes no row for a webhook paused after the push read it', async () => {
    const { plan, named } = await planWithHooks('user_ar3');
    const { automationSendStatement } = await import('./outbox');
    pause(named.id, 'paused');
    const detail = { rule: 'r', subject: null, text: 't' };
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
    [{ sends: [send('w', { subject: [] })] }],
    [{ sends: [send('w', { subject: 'Card' })] }],
    [{ sends: [send('w', { subject: { title: 2, url: 'u' } })] }],
    [{ sends: [send('w', { subject: { title: 't' } })] }],
    [{ sends: [send('w', { subject: undefined, card: [] })] }],
    [{ sends: [send('w', { subject: undefined, card: { key: 1.5, title: 't', url: 'u' } })] }],
    [{ sends: [send('w', { subject: undefined, card: { key: 1, title: 2, url: 'u' } })] }],
    [{ sends: [send('w', { subject: undefined, card: { key: 1, title: 't' } })] }],
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

  it('takes five at most, and only from the item’s own app', async () => {
    const { ada, plan, named } = await planWithHooks('user_ar5');
    const five = Array.from({ length: AUTOMATION_SENDS_MAX }, (_, k) =>
      send(named.id, { key: `k${k}` }),
    );
    expect((await results(plan.id, five)).every((r) => r.queued)).toBe(true);
    // Another app, for a plan: the item's own app only.
    const wrong = await push(plan.id, { sends: [] }, 'livediagram', 'ld-key');
    expect(wrong.status).toBe(403);
    expect(await body(wrong)).toEqual({ error: 'wrong_app' });
    // And a plan's app for another app's document.
    const canvas = await makeItem(ada.auth, { app: 'livediagram' });
    expect((await push(canvas.id, { sends: [] })).status).toBe(403);
    expect((await push(canvas.id, { sends: [] }, 'livediagram', 'ld-key')).status).toBe(200);
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

  it('sends a plain endpoint the rule, subject, card and message, from Automation', async () => {
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
        subject: {
          ref: 'WI-48',
          title: 'Publish pricing page',
          url: 'https://liveplanner.app/project/p#item=c1',
        },
        card: {
          key: 48,
          ref: 'WI-48',
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
