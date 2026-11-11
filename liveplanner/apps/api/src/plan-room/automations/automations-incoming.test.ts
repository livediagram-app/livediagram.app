import { createHash, createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultCatalogue,
  type AutomationRule,
  type AutomationRun,
  type Item,
} from '@liveplanner/items';
import type { AutomationSecretResponse, AutomationsListResponse } from '@liveplanner/api-schema';
import { timingSafeEqual } from '@liveworkspace/index-app/timing-safe';
import { createPlan, endRepeatWorld } from '../test-repeat-world';
import { automationWorld, type AutomationWorld, type Caller } from './test-automation-world';
import { signatureOf } from './automation-incoming';

// Incoming Webhook (docs/specs/026-plan/automations.md "Incoming Webhook"; blueprint automations.md "Phase 3"), end
// to end through the real worker and the plan's room: the secret made, shown once and kept only as a hash; a call
// proving it by Bearer or by signature, refused the same way for every wrong case; the body's limits; the rule's
// minute and the plan's day; the cards it names and the values it gives, filled as plain text.
vi.mock('../../auth/accounts', async () => (await import('../test-accounts-mock')).accountsMock);
vi.mock('@liveworkspace/index-app/timing-safe', async (original) => {
  const real = await original<typeof import('@liveworkspace/index-app/timing-safe')>();
  return { ...real, timingSafeEqual: vi.fn(real.timingSafeEqual) };
});

let w: AutomationWorld;
// Every line the api logged, to look for the secret in.
let logged: string[];
beforeEach(async () => {
  logged = [];
  for (const level of ['info', 'warn', 'log', 'error', 'debug'] as const)
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logged.push(JSON.stringify(args));
    });
  w = await automationWorld();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  endRepeatWorld();
});

const plan = () => w.plans.get('A')!;
const room = () => plan().room;
const runs = async () =>
  (await (await w.call('GET', '/runs')).json<{ runs: AutomationRun[] }>()).runs;
const card = async (id: string) => (await w.items('A')).find((i) => i.id === id)!;
const threadTexts = (cardId: string) =>
  (
    plan()
      .db.prepare("SELECT comments FROM card_threads WHERE cards LIKE '%' || ? || '%'")
      .all(cardId) as { comments: string }[]
  ).map((r) => (JSON.parse(r.comments) as { text: string }[])[0]!.text);

const incoming = (extra: Partial<AutomationRule> = {}) =>
  w.rule({
    name: 'From CI',
    trigger: { kind: 'incoming_webhook' },
    steps: [
      { kind: 'add_label', label: 'built' },
      { kind: 'comment', text: 'Build {{webhook.build.status}} by {{person}}' },
    ],
    ...extra,
  });

async function secretOf(ruleId: string, who: Caller = 'owner'): Promise<AutomationSecretResponse> {
  const res = await w.call('POST', `/${ruleId}/secret`, undefined, who);
  expect(res.status).toBe(201);
  return res.json<AutomationSecretResponse>();
}

type CallInit = { headers?: Record<string, string>; body?: string; method?: string; path?: string };
function hook(ruleId: string, init: CallInit = {}): Promise<Response> {
  return w.raw(
    new Request(init.path ?? `https://api.test/api/hooks/automations/A/${ruleId}`, {
      method: init.method ?? 'POST',
      headers: { 'Content-Type': 'application/json', ...init.headers },
      ...(init.method === 'GET' ? {} : { body: init.body ?? '{}' }),
    }),
  );
}
const bearer = (secret: string) => ({ Authorization: `Bearer ${secret}` });
const signed = (secret: string, body: string) => ({
  'X-Liveplanner-Signature': `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`,
});
const drain = () => room().alarm();

describe('the secret', () => {
  it('is made once, shown in that answer only, kept as its hash, its last 4 shown after', async () => {
    const rule = await incoming();
    const res = await w.call('POST', `/${rule.id}/secret`);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const made = await res.json<AutomationSecretResponse>();
    expect(made.secret).toMatch(/^lwh_[A-Za-z0-9_-]{86}$/);
    expect(made.hook).toEqual({
      url: `https://www.liveplanner.app/api/hooks/automations/A/${rule.id}`,
      secret: { last4: made.secret.slice(-4), madeAt: expect.any(Number), usedAt: null },
    });
    const row = plan().db.prepare('SELECT * FROM automation_hooks').get() as Record<
      string,
      unknown
    >;
    expect(row['hash']).toBe(createHash('sha256').update(made.secret).digest('hex'));
    expect(Object.values(row)).not.toContain(made.secret);
    // The list, a save's answer, the Audit Trail and the stored rule never hold the secret or its hash.
    await hook(rule.id, { headers: bearer(made.secret) });
    await drain();
    const list = await (await w.call('GET', '')).text();
    expect((JSON.parse(list) as AutomationsListResponse).rules[0]!.hook!.secret).toMatchObject({
      last4: made.secret.slice(-4),
    });
    const saved = await (await w.call('PUT', `/${rule.id}`, { ...rule, name: 'From CI 2' })).text();
    const trail = await (await w.call('GET', '/runs')).text();
    const bodies = JSON.stringify(plan().db.prepare('SELECT body FROM automation_rules').all());
    for (const text of [list, saved, trail, bodies, ...logged]) {
      expect(text).not.toContain(made.secret);
      expect(text).not.toContain(row['hash'] as string);
    }
  });

  it('is an Editor of the whole plan’s to make, signed in, never a token’s or a narrower link’s', async () => {
    const rule = await incoming();
    const status = async (who: Caller) =>
      (await w.call('POST', `/${rule.id}/secret`, undefined, who)).status;
    expect(await status('owner')).toBe(201);
    expect(await status('team')).toBe(201);
    expect(await status('editor_link')).toBe(201);
    for (const who of ['tab_editor_link', 'participant', 'viewer', 'token', 'guest'] as const)
      expect(await status(who)).toBe(403);
  });

  it('is refused for a rule of another trigger, and dropped when the trigger changes', async () => {
    const other = await w.rule({ name: 'Moved' });
    const res = await w.call('POST', `/${other.id}/secret`);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'automation_not_incoming' });
    const rule = await incoming({ steps: [{ kind: 'flag' }] });
    const { secret } = await secretOf(rule.id);
    const list = await (await w.call('GET', '')).json<AutomationsListResponse>();
    expect(list.rules.find((r) => r.id === other.id)).not.toHaveProperty('hook');
    await w.call('PUT', `/${rule.id}`, { ...rule, trigger: { kind: 'manual' } });
    expect(plan().db.prepare('SELECT COUNT(*) AS n FROM automation_hooks').get()).toEqual({ n: 0 });
    await w.call('PUT', `/${rule.id}`, { ...rule, trigger: { kind: 'incoming_webhook' } });
    expect((await hook(rule.id, { headers: bearer(secret) })).status).toBe(401);
    const back = await (await w.call('GET', '')).json<AutomationsListResponse>();
    expect(back.rules.find((r) => r.id === rule.id)!.hook).toEqual({
      url: `https://www.liveplanner.app/api/hooks/automations/A/${rule.id}`,
      secret: null,
    });
  });

  it('signs as HMAC keyed with the secret itself, though the plan keeps only its hash', async () => {
    const rule = await incoming();
    const { secret } = await secretOf(rule.id);
    const body = new TextEncoder().encode('{"cards":[1]}');
    const hash = createHash('sha256').update(secret).digest('hex');
    expect(await signatureOf(hash, body)).toBe(
      createHmac('sha256', secret).update(body).digest('hex'),
    );
  });
});

describe('a call', () => {
  it('runs the rule on each named card by Bearer, by Automation, its values filled', async () => {
    const a = await w.make('A', { title: 'One' });
    const b = await w.make('A', { title: 'Two' });
    const rule = await incoming();
    const { secret } = await secretOf(rule.id);
    const body = JSON.stringify({ cards: [a.key, b.key, a.key], build: { status: 'green' } });
    const res = await hook(rule.id, { headers: bearer(secret), body });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ queued: 2 });
    await drain();
    for (const c of [a, b]) {
      const now = await card(c.id);
      expect(now.fields['labels']).toEqual(['built']);
      expect(now.updatedBy.id).toBe('automation');
      expect(threadTexts(c.id)).toEqual(['Build green by Incoming webhook']);
    }
    const trail = await runs();
    expect(trail.map((r) => r.result)).toEqual(['done', 'done']);
    expect(trail[0]!.steps[0]).toEqual({ kind: 'trigger', text: 'Webhook received: 2 cards' });
    const listed = await (await w.call('GET', '')).json<AutomationsListResponse>();
    expect(listed.rules[0]!.hook!.secret!.usedAt).toEqual(expect.any(Number));
  });

  it('is accepted by a signature over its exact bytes', async () => {
    const a = await w.make('A', { title: 'One' });
    const rule = await incoming();
    const { secret } = await secretOf(rule.id);
    const body = JSON.stringify({ cards: [a.key] });
    expect((await hook(rule.id, { headers: signed(secret, body), body })).status).toBe(202);
    expect(vi.mocked(timingSafeEqual)).toHaveBeenCalled();
  });

  it('is refused 401, the same every time, for every wrong proof and every rule it can’t start', async () => {
    const rule = await incoming();
    const { secret } = await secretOf(rule.id);
    const body = JSON.stringify({ cards: [1] });
    const other = await incoming({ name: 'No secret yet' });
    const answers: Response[] = [
      // No proof, a wrong secret, a token-shaped one, a bad signature, one over other bytes, one without its prefix.
      await hook(rule.id, { body }),
      await hook(rule.id, { body, headers: bearer(`${secret.slice(0, -1)}x`) }),
      await hook(rule.id, { body, headers: bearer('lwt_abc') }),
      await hook(rule.id, {
        body,
        headers: { 'X-Liveplanner-Signature': `sha256=${'0'.repeat(64)}` },
      }),
      await hook(rule.id, { body: '{"cards":[2]}', headers: signed(secret, body) }),
      await hook(rule.id, {
        body,
        headers: {
          'X-Liveplanner-Signature': signed(secret, body)['X-Liveplanner-Signature'].slice(7),
        },
      }),
      // A rule with no secret, an unknown rule, another plan's address, a plan nothing has written.
      await hook(other.id, { body, headers: bearer(secret) }),
      await hook('nope', { body, headers: bearer(secret) }),
      await hook(rule.id, {
        body,
        headers: bearer(secret),
        path: `https://api.test/api/hooks/automations/Z/${rule.id}`,
      }),
    ];
    for (const res of answers) {
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'webhook_unauthorized' });
    }
    // The plan nothing had written stays empty.
    expect(w.plans.get('Z')!.room.storedSchema()).toBe(false);
    expect(await runs()).toEqual([]);
  });

  it('stops for an old secret after Regenerate, a rule turned off, and a deleted rule', async () => {
    const a = await w.make('A', { title: 'One' });
    const rule = await incoming();
    const first = await secretOf(rule.id);
    const second = await secretOf(rule.id);
    expect(second.secret).not.toBe(first.secret);
    const body = JSON.stringify({ cards: [a.key] });
    expect((await hook(rule.id, { body, headers: bearer(first.secret) })).status).toBe(401);
    expect((await hook(rule.id, { body, headers: signed(first.secret, body) })).status).toBe(401);
    expect((await hook(rule.id, { body, headers: bearer(second.secret) })).status).toBe(202);
    await w.call('POST', `/${rule.id}/toggle`, { enabled: false });
    expect((await hook(rule.id, { body, headers: bearer(second.secret) })).status).toBe(401);
    await w.call('POST', `/${rule.id}/toggle`, { enabled: true });
    expect((await hook(rule.id, { body, headers: bearer(second.secret) })).status).toBe(202);
    await w.call('DELETE', `/${rule.id}`);
    expect((await hook(rule.id, { body, headers: bearer(second.secret) })).status).toBe(401);
    expect(plan().db.prepare('SELECT COUNT(*) AS n FROM automation_hooks').get()).toEqual({ n: 0 });
  });

  it('answers 404 for an address that isn’t one, 405 for another method, 415 for another type', async () => {
    const rule = await incoming();
    const { secret } = await secretOf(rule.id);
    for (const path of [
      'https://api.test/api/hooks/automations/A',
      'https://api.test/api/hooks/automations/A/x/y',
      'https://api.test/api/hooks/other/A/x',
      'https://api.test/api/hooks/automations/A/bad%20id',
    ])
      expect((await hook(rule.id, { path, headers: bearer(secret) })).status).toBe(404);
    expect((await hook(rule.id, { method: 'GET', headers: bearer(secret) })).status).toBe(405);
    const typed = await hook(rule.id, {
      headers: { ...bearer(secret), 'Content-Type': 'text/plain' },
    });
    expect(typed.status).toBe(415);
    expect(await typed.json()).toEqual({ error: 'webhook_json_only' });
    expect(
      (
        await hook(rule.id, {
          headers: { ...bearer(secret), 'Content-Type': 'application/json; charset=utf-8' },
        })
      ).status,
    ).toBe(202);
  });

  it('is refused 413 past 16 KB, declared or not, before the plan is asked', async () => {
    const rule = await incoming();
    const { secret } = await secretOf(rule.id);
    const big = JSON.stringify({ pad: 'x'.repeat(16 * 1024) });
    const res = await hook(rule.id, { body: big, headers: bearer(secret) });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'webhook_too_large' });
    const declared = await hook(rule.id, {
      body: '{}',
      headers: { ...bearer(secret), 'Content-Length': String(20_000) },
    });
    expect(declared.status).toBe(413);
    // Exactly 16 KB is a call.
    const fits = JSON.stringify({ pad: 'x'.repeat(16 * 1024 - 10) });
    expect(new TextEncoder().encode(fits).length).toBe(16 * 1024);
    expect((await hook(rule.id, { body: fits, headers: bearer(secret) })).status).toBe(202);
  });

  it('refuses a body that isn’t an object, or cards that aren’t numbers, 400', async () => {
    const rule = await incoming();
    const { secret } = await secretOf(rule.id);
    for (const body of [
      'not json',
      '[1,2]',
      '"x"',
      '{"cards":"12"}',
      '{"cards":[0]}',
      '{"cards":[1.5]}',
      '{"cards":["c1"]}',
      `{"cards":[${Array.from({ length: 11 }, (_, i) => i + 1).join(',')}]}`,
    ]) {
      const res = await hook(rule.id, { body, headers: bearer(secret) });
      expect(res.status).toBe(400);
      expect((await res.json<{ error: string }>()).error).toBe('webhook_body_invalid');
    }
  });

  it('answers the 61st call in a minute 429 with Retry-After, then takes calls the next minute', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: Date.UTC(2026, 10, 11, 10, 0, 0) });
    const rule = await incoming({ steps: [{ kind: 'add_label', label: 'built' }] });
    const { secret } = await secretOf(rule.id);
    for (let i = 0; i < 60; i += 1)
      expect((await hook(rule.id, { headers: bearer(secret) })).status).toBe(202);
    vi.setSystemTime(Date.UTC(2026, 10, 11, 10, 0, 20));
    const over = await hook(rule.id, { headers: bearer(secret) });
    expect(over.status).toBe(429);
    expect(over.headers.get('Retry-After')).toBe('40');
    expect(await over.json()).toEqual({ error: 'webhook_rate_limited' });
    // A wrong secret is still 401: the minute counts only calls that proved the secret.
    expect((await hook(rule.id, { headers: bearer('lwh_wrong') })).status).toBe(401);
    vi.setSystemTime(Date.UTC(2026, 10, 11, 10, 1, 1));
    expect((await hook(rule.id, { headers: bearer(secret) })).status).toBe(202);
  });

  it('answers 429 until midnight once the plan’s day is spent', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: Date.UTC(2026, 10, 11, 23, 0, 0) });
    const rule = await incoming();
    const { secret } = await secretOf(rule.id);
    const insert = plan().db.prepare(
      "INSERT INTO automation_runs (id, rule_id, at, result, body) VALUES (?, 'r', ?, 'done', '{}')",
    );
    for (let i = 0; i < 1000; i += 1) insert.run(`r${i}`, Date.now());
    const res = await hook(rule.id, { headers: bearer(secret) });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('3600');
    expect(await res.json()).toEqual({ error: 'automation_budget_spent' });
  });

  it('fills a payload’s text as plain text: values and markup in it stay as written', async () => {
    const a = await w.make('A', { title: 'Secret title' });
    const rule = await incoming();
    const { secret } = await secretOf(rule.id);
    const status = '{{card.title}} <script>alert(1)</script> {{webhook.build.status}}';
    await hook(rule.id, {
      headers: bearer(secret),
      body: JSON.stringify({ cards: [a.key], build: { status } }),
    });
    await drain();
    expect(threadTexts(a.id)).toEqual([`Build ${status} by Incoming webhook`]);
  });

  it('reads a path 5 deep, cuts a long string at 500, and reads nothing for an object or a 6-deep path', async () => {
    const a = await w.make('A', { title: 'One' });
    const rule = await incoming({
      steps: [
        {
          kind: 'comment',
          text: '[{{webhook.a.b.c.d.e}}][{{webhook.long}}][{{webhook.a}}][{{webhook.list.1}}]',
        },
      ],
    });
    const six = await w.call('POST', '', {
      ...rule,
      name: 'Six',
      steps: [{ kind: 'comment', text: '{{webhook.a.b.c.d.e.f}}' }],
    });
    expect(six.status).toBe(400);
    expect((await six.json<{ error: string }>()).error).toBe('automation_value_unknown');
    const { secret } = await secretOf(rule.id);
    const body = JSON.stringify({
      cards: [a.key],
      a: { b: { c: { d: { e: 'deep' } } } },
      long: 'y'.repeat(15_000),
      list: [1, true],
    });
    expect((await hook(rule.id, { body, headers: bearer(secret) })).status).toBe(202);
    await drain();
    expect(threadTexts(a.id)).toEqual([`[deep][${'y'.repeat(500)}][][true]`]);
    // The waiting run kept only what the rule names, never the whole body.
    expect(logged.join('')).not.toContain('yyyyyyyyyy');
  });

  it('runs only on this plan’s cards: numbers it lacks and cards in the Trash are passed over', async () => {
    await createPlan(w, 'B');
    const other = await w.make('B', { title: 'In B' });
    const a = await w.make('A', { title: 'In A' });
    const gone = await w.make('A', { title: 'Trashed' });
    await w.send('DELETE', `/api/projects/A/items/${gone.id}`);
    const rule = await incoming();
    const { secret } = await secretOf(rule.id);
    const res = await hook(rule.id, {
      headers: bearer(secret),
      body: JSON.stringify({ cards: [999, gone.key, a.key] }),
    });
    expect(await res.json()).toEqual({ queued: 1 });
    await drain();
    expect((await card(a.id)).fields['labels']).toEqual(['built']);
    expect(((await w.items('B'))[0] as Item).fields['labels']).toBeUndefined();
    expect(other.key).toBe(1);
    const none = await hook(rule.id, { headers: bearer(secret), body: '{"cards":[999]}' });
    expect(await none.json()).toEqual({ queued: 0 });
  });

  it('with no cards named, runs once with no card when its steps need none, else logs Skipped', async () => {
    await w.send('PUT', '/api/projects/A/item-types', { itemTypes: defaultCatalogue() });
    const maker = await incoming({
      name: 'Make',
      steps: [{ kind: 'create_card', type: 'task', title: 'Deploy {{webhook.v}}{{card.title}}' }],
    });
    const { secret } = await secretOf(maker.id);
    const res = await hook(maker.id, { headers: bearer(secret), body: '{"v":"1.2"}' });
    expect(await res.json()).toEqual({ queued: 1 });
    await drain();
    const made = (await w.items('A')).find((i) => i.fields['title'] === 'Deploy 1.2');
    expect(made?.createdBy.id).toBe('automation');
    const [run] = await runs();
    expect(run).toMatchObject({ result: 'done', card: null });
    expect(run!.steps[0]).toEqual({ kind: 'trigger', text: 'Webhook received: no card' });

    const labeller = await incoming({ name: 'Label' });
    const second = await secretOf(labeller.id);
    await hook(labeller.id, { headers: bearer(second.secret) });
    await drain();
    expect((await runs())[0]).toMatchObject({
      result: 'skipped',
      reason: "No cards named: this rule's steps need a card",
    });
  });

  it('is refused a person: Who Did It and whoever triggered it can’t be saved on one', async () => {
    const who = await w.call('POST', '', {
      name: 'Who',
      trigger: { kind: 'incoming_webhook' },
      conditions: [{ kind: 'who', who: [{ role: 'editor' }] }],
      steps: [{ kind: 'flag' }],
      chain: false,
      timeZone: 'UTC',
    });
    expect(who.status).toBe(400);
    expect(await who.json()).toMatchObject({ error: 'automation_condition_unsupported' });
  });

  it('tests on a card as if a call had named it, its values empty', async () => {
    const a = await w.make('A', { title: 'One' });
    const rule = await incoming();
    const res = await w.call('POST', '/test', { rule, item: a.id });
    const { run } = await res.json<{ run: AutomationRun }>();
    expect(run.steps[0]).toEqual({ kind: 'trigger', text: 'Webhook received: 1 card' });
    expect(run.result).toBe('done');
  });
});
