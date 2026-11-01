// Sending (webhooks.md "Delivery", "Security"): the dispatcher's alarm sends what is due, signed, in order per webhook,
// retries with backoff, gives up, pauses a webhook whose creator no longer runs its team or that keeps failing, and
// never sends to a private address or follows a redirect.
import {
  WEBHOOK_DELIVERY_HEADER,
  WEBHOOK_EVENT_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
} from '@liveworkspace/index-client';
import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { call, h, makeItem, person, useHarness } from '../test-support';
import { RETRY_DELAYS_MS } from './config';
import { dispatch, type DispatchDeps } from './dispatch';
import { WebhookDispatcher } from './durable-object';
import {
  addWebhook,
  answerWorld,
  deliveries,
  newWorld,
  WEBHOOK_KEY,
  type World,
} from './test-webhooks';

useHarness({ WEBHOOK_KEY });

type Sent = { url: string; init: RequestInit; body: string; headers: Headers };

let world: World;
let clock: number;
let sent: Sent[];
let answer: (s: Sent) => Response | Promise<Response>;

beforeEach(() => {
  world = newWorld();
  answerWorld(world);
  clock = Date.now();
  sent = [];
  answer = () => new Response('ok');
});

const deps = (over: Partial<DispatchDeps> = {}): DispatchDeps => ({
  now: () => clock,
  fetch: (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const s = {
      url: String(input),
      init,
      body: String(init.body),
      headers: new Headers(init.headers),
    };
    sent.push(s);
    return answer(s);
  }) as typeof fetch,
  resolve: async (host) => world.dns[host] ?? ['93.184.216.34'],
  adminTeams: async (personId) =>
    world.accountsDown
      ? null
      : new Set((world.roles[personId] ?? []).filter((t) => t.role === 'admin').map((t) => t.id)),
  ...over,
});

// The test's clock never runs behind what the rows were written at.
const sync = () => {
  clock = Math.max(clock, Date.now());
};
const run = (over: Partial<DispatchDeps> = {}) => {
  sync();
  return dispatch(h.db.env, deps(over));
};
const states = () => deliveries().map((d) => `${d.type}:${d.state}:${d.attempts}`);

async function personWithHook(id: string, input: Record<string, unknown> = {}) {
  const ada = await person(id);
  const hook = await addWebhook(ada.auth, { events: ['created', 'renamed'], ...input });
  return { ada, ...hook };
}

describe('a delivery', () => {
  it('is a signed JSON POST to the endpoint, never following a redirect', async () => {
    const { ada, secret, webhook } = await personWithHook('user_wd1');
    const item = await makeItem(ada.auth, { title: 'Roadmap' });
    const result = await run();
    expect(result).toEqual({ delivered: 1, failed: 0, retrying: 0, nextAt: null });
    expect(sent).toHaveLength(1);
    const s = sent[0]!;
    expect(s.url).toBe('https://hooks.example.com/in');
    expect(s.init.method).toBe('POST');
    expect(s.init.redirect).toBe('manual');
    expect(s.headers.get('Content-Type')).toBe('application/json');
    expect(s.headers.get(WEBHOOK_EVENT_HEADER)).toBe('created');
    const delivery = s.headers.get(WEBHOOK_DELIVERY_HEADER)!;
    const timestamp = s.headers.get(WEBHOOK_TIMESTAMP_HEADER)!;
    expect(Number(timestamp)).toBe(Math.floor(clock / 1000));
    const expected = createHmac('sha256', secret!).update(`${timestamp}.${s.body}`).digest('hex');
    expect(s.headers.get(WEBHOOK_SIGNATURE_HEADER)).toBe(`v1=${expected}`);
    const payload = JSON.parse(s.body);
    expect(payload).toMatchObject({
      id: delivery,
      type: 'created',
      app: 'liveplanner',
      item: { id: item.id, title: 'Roadmap', url: `https://liveplanner.app/project/${item.id}` },
      actor: { id: 'user_wd1' },
    });
    expect(deliveries()[0]).toMatchObject({
      state: 'delivered',
      attempts: 1,
      status: 200,
      error: null,
    });
    expect(deliveries()[0]!.webhook_id).toBe(webhook.id);
  });

  it('sends Slack its message, unsigned, and opens a card at the card', async () => {
    const ada = await person('user_wd2');
    await addWebhook(ada.auth, {
      kind: 'slack',
      url: 'https://hooks.slack.com/services/T/B/x',
      events: ['card_moved'],
    });
    const plan = await makeItem(ada.auth, { title: 'Sprint' });
    await call(`/app/items/${plan.id}/card-moves`, {
      method: 'PUT',
      auth: 'lp-key',
      headers: { 'X-Index-App': 'liveplanner' },
      body: {
        moves: [
          {
            cardId: 'c1',
            cardKey: 1,
            card: 'Fix',
            from: 'Doing',
            to: 'Done',
            actorName: 'Ada',
            at: clock,
          },
        ],
      },
    });
    await run();
    expect(sent[0]!.headers.get(WEBHOOK_SIGNATURE_HEADER)).toBeNull();
    const body = JSON.parse(sent[0]!.body);
    expect(body.text).toBe('Ada moved “Fix” from Doing to Done on “Sprint”');
    expect(body.blocks[0].text.text).toContain(
      `https://liveplanner.app/project/${plan.id}#item=c1|Open in liveplanner`,
    );
  });

  it('links nothing for an app with no origin set', async () => {
    const { ada } = await personWithHook('user_wd3');
    await makeItem(ada.auth);
    sync();
    await dispatch({ ...h.db.env, APP_ORIGIN_LIVEPLANNER: undefined }, deps());
    expect(JSON.parse(sent[0]!.body).item.url).toBeNull();
  });
});

describe('retries', () => {
  it('tries again after each delay, the later ones waiting behind, then gives up', async () => {
    const { ada, webhook } = await personWithHook('user_wr1');
    const item = await makeItem(ada.auth, { title: 'A' });
    await call(`/items/${item.id}`, { method: 'PATCH', auth: ada.auth, body: { title: 'B' } });
    answer = () => new Response('busy', { status: 503 });
    let result = await run();
    // The first failed; the second waits behind it, unsent.
    expect(sent).toHaveLength(1);
    expect(result).toMatchObject({
      delivered: 0,
      retrying: 2,
      nextAt: clock + RETRY_DELAYS_MS[0]!,
    });
    expect(states()).toEqual(['created:pending:1', 'renamed:pending:0']);
    expect(deliveries()[0]).toMatchObject({ status: 503, next_at: clock + RETRY_DELAYS_MS[0]! });
    expect(deliveries()[1]!.next_at).toBe(clock + RETRY_DELAYS_MS[0]!);
    // Nothing is due before then.
    sent = [];
    expect(await run()).toMatchObject({ retrying: 0 });
    expect(sent).toEqual([]);
    for (const delay of RETRY_DELAYS_MS) {
      clock += delay;
      await run();
    }
    // Seven tries, then given up; the next one goes on (and fails its first try in the same run).
    expect(states()).toEqual(['created:failed:7', 'renamed:pending:1']);
    expect(h.db.sql.prepare('SELECT failures FROM webhooks WHERE id = ?').get(webhook.id)).toEqual({
      failures: 1,
    });
    answer = () => new Response(null, { status: 204 });
    clock += RETRY_DELAYS_MS.at(-1)!;
    await run();
    expect(states()).toEqual(['created:failed:7', 'renamed:delivered:2']);
    expect(h.db.sql.prepare('SELECT failures FROM webhooks WHERE id = ?').get(webhook.id)).toEqual({
      failures: 0,
    });
  });

  it.each([
    [408, 'retry'],
    [429, 'retry'],
    [500, 'retry'],
    [400, 'final'],
    [404, 'final'],
    [301, 'final'],
  ])('reads %i as %s', async (status, kind) => {
    const { ada } = await personWithHook(`user_ws${status}`);
    await makeItem(ada.auth);
    answer = () => new Response(null, { status });
    await run();
    expect(deliveries()[0]!.state).toBe(kind === 'retry' ? 'pending' : 'failed');
    expect(deliveries()[0]!.status).toBe(status);
    if (status === 301) expect(deliveries()[0]!.error).toBe('redirect');
  });

  it('retries a timeout or a network failure, saying which', async () => {
    const { ada } = await personWithHook('user_wr2');
    await makeItem(ada.auth);
    answer = () => {
      throw Object.assign(new Error('slow'), { name: 'TimeoutError' });
    };
    await run();
    expect(deliveries()[0]).toMatchObject({ state: 'pending', error: 'timeout', status: null });
    clock += RETRY_DELAYS_MS[0]!;
    answer = () => {
      throw new TypeError('connection reset');
    };
    await run();
    expect(deliveries()[0]).toMatchObject({ state: 'pending', error: 'network', attempts: 2 });
  });

  it('pauses on 410 Gone, giving up what waited', async () => {
    const { ada, webhook } = await personWithHook('user_wr3');
    const item = await makeItem(ada.auth);
    await call(`/items/${item.id}`, { method: 'PATCH', auth: ada.auth, body: { title: 'B' } });
    answer = () => new Response(null, { status: 410 });
    await run();
    expect(sent).toHaveLength(1);
    expect(states()).toEqual(['created:failed:1', 'renamed:failed:0']);
    expect(
      h.db.sql.prepare('SELECT paused_reason FROM webhooks WHERE id = ?').get(webhook.id),
    ).toEqual({
      paused_reason: 'gone',
    });
  });

  it('pauses after 20 given up in a row', async () => {
    const { ada, webhook } = await personWithHook('user_wr4', {
      url: 'https://refuses.example.com/x',
    });
    for (let i = 0; i < 20; i++) await makeItem(ada.auth);
    answer = () => new Response(null, { status: 403 });
    await run();
    expect(
      h.db.sql.prepare('SELECT paused_reason, failures FROM webhooks WHERE id = ?').get(webhook.id),
    ).toEqual({
      paused_reason: 'failing',
      failures: 20,
    });
  });
});

describe('what is checked before sending', () => {
  it('never sends to a host that now resolves to a private address, and waits out one that resolves to nothing', async () => {
    const { ada } = await personWithHook('user_wx1');
    await makeItem(ada.auth);
    world.dns['hooks.example.com'] = ['127.0.0.1'];
    await run();
    expect(sent).toEqual([]);
    expect(deliveries()[0]).toMatchObject({ state: 'failed', error: 'private_address' });
    const { ada: bo } = await personWithHook('user_wx2', { url: 'https://flaky.example.com/x' });
    await makeItem(bo.auth);
    world.dns['flaky.example.com'] = [];
    await run();
    expect(deliveries()[1]).toMatchObject({ state: 'pending', error: 'dns', attempts: 1 });
  });

  it("gives up what it can't open: a URL sealed under another key", async () => {
    const { ada } = await personWithHook('user_wx3');
    await makeItem(ada.auth);
    h.db.sql.prepare("UPDATE webhooks SET url_sealed = 'v1.AAAA.BBBB'").run();
    await run();
    expect(deliveries()[0]).toMatchObject({ state: 'failed', error: 'unreadable' });
  });

  it("pauses a team's webhook once its creator no longer runs the team, and holds it while accounts can't say", async () => {
    const bo = await person('user_wx4', { teams: [{ id: 'teamX' }] });
    world.roles.user_wx4 = [{ id: 'teamX', role: 'admin' }];
    const { webhook } = await addWebhook(bo.auth, { teamId: 'teamX', events: ['created'] });
    await makeItem(bo.auth, { teamId: 'teamX' });
    world.accountsDown = true;
    expect(await run()).toMatchObject({ retrying: 1, delivered: 0 });
    expect(sent).toEqual([]);
    expect(states()).toEqual(['created:pending:0']);
    world.accountsDown = false;
    world.roles.user_wx4 = [{ id: 'teamX', role: 'member' }];
    clock += 60_000;
    await run();
    expect(sent).toEqual([]);
    expect(deliveries()[0]).toMatchObject({ state: 'failed', error: 'paused' });
    expect(
      h.db.sql.prepare('SELECT paused_reason FROM webhooks WHERE id = ?').get(webhook.id),
    ).toEqual({
      paused_reason: 'creator_left',
    });
  });

  it('sends nothing without WEBHOOK_KEY', async () => {
    const { ada } = await personWithHook('user_wx5');
    await makeItem(ada.auth);
    expect(await dispatch({ ...h.db.env, WEBHOOK_KEY: undefined }, deps())).toEqual({
      delivered: 0,
      failed: 0,
      retrying: 0,
      nextAt: null,
    });
  });
});

describe('a run', () => {
  it('sends at most 50, then asks to run again at once; keeps 20 finished per webhook', async () => {
    const { ada, webhook } = await personWithHook('user_wb1');
    for (let i = 0; i < 55; i++) await makeItem(ada.auth);
    const first = await run();
    expect(first).toMatchObject({ delivered: 50, nextAt: clock });
    expect(await run()).toMatchObject({ delivered: 5, nextAt: null });
    const kept = h.db.sql
      .prepare(
        "SELECT COUNT(*) AS n FROM webhook_deliveries WHERE webhook_id = ? AND state <> 'pending'",
      )
      .get(webhook.id);
    expect(kept).toEqual({ n: 20 });
  });
});

describe('the dispatcher', () => {
  function fakeState() {
    let alarm: number | null = null;
    return {
      get alarm() {
        return alarm;
      },
      storage: {
        getAlarm: async () => alarm,
        setAlarm: async (at: number) => {
          alarm = at;
        },
      },
    };
  }

  it('runs its alarm now on a kick, unless it is about to run anyway', async () => {
    const state = fakeState();
    const dispatcher = new WebhookDispatcher(state as unknown as DurableObjectState, h.db.env);
    await dispatcher.kick();
    const first = state.alarm!;
    expect(first).toBeLessThanOrEqual(Date.now());
    await state.storage.setAlarm(Date.now() + 100);
    await dispatcher.kick();
    expect(state.alarm).toBeGreaterThan(first);
    await state.storage.setAlarm(Date.now() + 60_000);
    await dispatcher.kick();
    expect(state.alarm).toBeLessThanOrEqual(Date.now());
  });

  it('sends on its alarm, and sets the next for the soonest retry', async () => {
    const state = fakeState();
    const dispatcher = new WebhookDispatcher(state as unknown as DurableObjectState, h.db.env);
    dispatcher.deps = deps();
    const { ada } = await personWithHook('user_wb2');
    await makeItem(ada.auth);
    answer = () => new Response(null, { status: 500 });
    sync();
    await dispatcher.alarm();
    expect(state.alarm).toBe(clock + RETRY_DELAYS_MS[0]!);
    answer = () => new Response(null);
    clock += RETRY_DELAYS_MS[0]!;
    await state.storage.setAlarm(0);
    await dispatcher.alarm();
    expect(states()).toEqual(['created:delivered:2']);
    // Nothing left: no alarm set again.
    expect(state.alarm).toBe(0);
    expect(dispatcher.deps.adminTeams).toBeTypeOf('function');
    expect(
      new WebhookDispatcher(state as unknown as DurableObjectState, h.db.env).deps.now(),
    ).toBeTypeOf('number');
  });
});

describe('closing an account', () => {
  it("deletes its own webhooks and a closed team's, and pauses an outliving team's, anonymised", async () => {
    const ada = await person('user_wp1');
    world.roles.user_wp1 = [
      { id: 'kept', role: 'admin' },
      { id: 'closed', role: 'admin' },
    ];
    await addWebhook(ada.auth);
    await addWebhook(ada.auth, { teamId: 'closed' });
    const kept = await addWebhook(ada.auth, { teamId: 'kept' });
    await call(`/webhooks/${kept.webhook.id}/test`, { method: 'POST', auth: ada.auth });
    const res = await call('/internal/purge-person', {
      method: 'POST',
      auth: 'merge-key',
      body: { personId: 'user_wp1', teamIds: ['closed'] },
    });
    expect(res.status).toBe(200);
    expect(h.db.sql.prepare('SELECT id, created_by, paused_reason FROM webhooks').all()).toEqual([
      { id: kept.webhook.id, created_by: 'deleted', paused_reason: 'creator_left' },
    ]);
    expect(states()).toEqual(['ping:failed:0']);
  });
});
