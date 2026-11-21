import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WEBHOOK_BODY_MAX, WEBHOOK_CALLS_PER_MINUTE } from '../../incoming';
import type { ItemRun } from '../../item';
import { AUTOMATION_QUEUE_MAX, AUTOMATION_RUNS_PER_DAY } from '../../limits';
import { makeHookSecret, sha256Hex, signatureOf, type HookCall } from '../automation-incoming';
import { listRuns } from '../automation-log';
import { answerItemHook, itemHookResponse, itemOptOut, readItemHookCall } from './hook';
import { queued, rowsOf, world, type World } from './test-kit';
import { runItemAutomations } from './wake';

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const enc = new TextEncoder();
const NOW = Date.UTC(2027, 0, 4, 12, 0);

async function hooked(w: World) {
  const rule = w.rule({
    trigger: { kind: 'incoming_webhook' },
    conditions: [{ kind: 'text', value: 'webhook.env', op: 'contains', text: 'prod' }],
    steps: [{ kind: 'take_snapshot', name: 'Before {{webhook.version}} on {{tab.name}}' }],
  });
  const { secret } = await makeHookSecret(w.kit.hookUrl, w.sql, rule.id, NOW);
  const call = (body: unknown, over: Partial<HookCall> = {}): HookCall => ({
    body: enc.encode(typeof body === 'string' ? body : JSON.stringify(body)),
    authorization: `Bearer ${secret}`,
    signature: null,
    ...over,
  });
  return { rule, secret, call };
}

describe('a call to a rule’s address', () => {
  it('queues one run with the values the rule names, and nothing else of the body', async () => {
    const w = world();
    w.addTab('t1', 'Roadmap');
    const { rule, call } = await hooked(w);
    const answer = await answerItemHook(
      w.engine,
      rule.id,
      call({ version: '2.1', env: 'Prod', secretish: 'never kept', tab: 'roadmap' }),
      NOW,
    );
    expect(answer).toEqual({ status: 202, body: { queued: 1 } });
    const [event] = queued(w.sql);
    expect(event).toMatchObject({
      kind: 'incoming',
      ruleId: rule.id,
      tab: 't1',
      data: { 'webhook.version': '2.1', 'webhook.env': 'Prod' },
    });
    expect(JSON.stringify(event)).not.toContain('never kept');
    await runItemAutomations(w.engine, Date.now());
    const [run] = listRuns<ItemRun>(w.sql, {});
    expect(run!.steps.map((s) => ('text' in s ? s.text : ''))).toEqual([
      'An Incoming Webhook call',
      '{{webhook.env}} contains “prod”',
      'Took a snapshot named “Before 2.1 on Roadmap”',
    ]);
    await w.settled();
    expect(w.events.map((e) => e.type)).toContain('AutomationHookAccepted');
  });

  // A call signed over `<timestamp>.<body>`, the room's way (keyed with the secret's hash, the same HMAC).
  const signedCall = async (
    secret: string,
    json: string,
    ts = String(NOW / 1000),
  ): Promise<HookCall> => ({
    body: enc.encode(json),
    authorization: null,
    signature: `sha256=${await signatureOf(await sha256Hex(secret), enc.encode(`${ts}.${json}`))}`,
    timestamp: ts,
  });

  it('takes a signature of the timestamp and raw body in place of the secret, and a tab by id or none at all', async () => {
    const w = world();
    w.addTab('t1', 'Roadmap');
    const { rule, secret, call } = await hooked(w);
    const signed = await answerItemHook(
      w.engine,
      rule.id,
      await signedCall(secret, JSON.stringify({ tab: 't1' })),
      NOW,
    );
    expect(signed.status).toBe(202);
    expect((await answerItemHook(w.engine, rule.id, call({}), NOW)).body).toEqual({ queued: 1 });
    expect(queued(w.sql).map((e) => e.tab)).toEqual(['t1', undefined]);
  });

  it('refuses a signed call sent again, or stale, with the same 401; a Bearer call may come again', async () => {
    const w = world();
    const { rule, secret, call } = await hooked(w);
    const unauthorized = { status: 401, body: { error: 'webhook_unauthorized' } };
    const once = await signedCall(secret, '{"n":1}');
    expect((await answerItemHook(w.engine, rule.id, once, NOW)).status).toBe(202);
    expect(await answerItemHook(w.engine, rule.id, once, NOW + 1000)).toEqual(unauthorized);
    // The same body at another moment is another call.
    const later = await signedCall(secret, '{"n":1}', String(NOW / 1000 + 1));
    expect((await answerItemHook(w.engine, rule.id, later, NOW + 1000)).status).toBe(202);
    // Older than 5 minutes, or with no timestamp: refused as a wrong secret is.
    const stale = await signedCall(secret, '{"n":2}', String(NOW / 1000 - 301));
    expect(await answerItemHook(w.engine, rule.id, stale, NOW)).toEqual(unauthorized);
    const bare = { ...(await signedCall(secret, '{"n":3}')), timestamp: null };
    expect(await answerItemHook(w.engine, rule.id, bare, NOW)).toEqual(unauthorized);
    for (let i = 0; i < 2; i += 1)
      expect((await answerItemHook(w.engine, rule.id, call({}), NOW + 2000)).status).toBe(202);
    expect(queued(w.sql)).toHaveLength(4);
    await w.settled();
    expect(w.events.filter((e) => e.type === 'AutomationHookUnauthorized')).toHaveLength(3);
  });

  it('takes a signed call answered 429 or 400 again as it is', async () => {
    const w = world();
    const { rule, secret } = await hooked(w);
    const invalid = await signedCall(secret, '[1]');
    expect((await answerItemHook(w.engine, rule.id, invalid, NOW)).status).toBe(400);
    expect((await answerItemHook(w.engine, rule.id, invalid, NOW)).status).toBe(400);
    const call = await signedCall(secret, '{}');
    w.sql.exec(
      'UPDATE automation_hooks SET window_at = ?, window_calls = ?',
      NOW,
      WEBHOOK_CALLS_PER_MINUTE,
    );
    expect((await answerItemHook(w.engine, rule.id, call, NOW)).status).toBe(429);
    w.sql.exec('UPDATE automation_hooks SET window_calls = 0');
    expect((await answerItemHook(w.engine, rule.id, call, NOW)).status).toBe(202);
  });

  it('answers the same 401 for a wrong secret, a rule off, another trigger, an unknown rule and no item', async () => {
    const w = world();
    const { rule, call } = await hooked(w);
    const other = w.rule({ trigger: { kind: 'manual' } });
    const unauthorized = { status: 401, body: { error: 'webhook_unauthorized' } };
    const wrong = call({}, { authorization: 'Bearer lwh_wrong' });
    expect(await answerItemHook(w.engine, rule.id, wrong, NOW)).toEqual(unauthorized);
    expect(await answerItemHook(w.engine, rule.id, call({}, { authorization: null }), NOW)).toEqual(
      unauthorized,
    );
    expect(await answerItemHook(w.engine, other.id, call({}), NOW)).toEqual(unauthorized);
    expect(await answerItemHook(w.engine, 'nobody', call({}), NOW)).toEqual(unauthorized);
    w.engine.store.update({ ...rule, enabled: false });
    expect(await answerItemHook(w.engine, rule.id, call({}), NOW)).toEqual(unauthorized);
    w.state.held = false;
    expect(await answerItemHook(w.engine, rule.id, call({}), NOW)).toEqual(unauthorized);
    await w.settled();
    // Only a wrong proof at a live rule's address is counted.
    expect(w.events.map((e) => e.type)).toEqual([
      'AutomationHookUnauthorized',
      'AutomationHookUnauthorized',
    ]);
    expect(queued(w.sql)).toEqual([]);
  });

  it('takes the call and runs nothing while the item is put away, or for a tab it lacks', async () => {
    const w = world();
    const { rule, call } = await hooked(w);
    expect(await answerItemHook(w.engine, rule.id, call({ tab: 'No Such Tab' }), NOW)).toEqual({
      status: 202,
      body: { queued: 0 },
    });
    w.kit.putAway = () => true;
    expect(await answerItemHook(w.engine, rule.id, call({}), NOW)).toEqual({
      status: 202,
      body: { queued: 0 },
    });
    expect(queued(w.sql)).toEqual([]);
  });

  it('refuses a body that is no JSON object, or a tab that is no name', async () => {
    const w = world();
    const { rule, call } = await hooked(w);
    for (const body of ['not json', [1], { tab: 7 }, { tab: '' }]) {
      const answer = await answerItemHook(w.engine, rule.id, call(body), NOW);
      expect(answer).toMatchObject({ status: 400, body: { error: 'webhook_body_invalid' } });
    }
  });

  it('holds a rule to 60 calls a minute, and the item to its day', async () => {
    const w = world();
    const { rule, call } = await hooked(w);
    for (let i = 0; i < WEBHOOK_CALLS_PER_MINUTE; i += 1)
      expect((await answerItemHook(w.engine, rule.id, call({}), NOW + i)).status).toBe(202);
    expect(await answerItemHook(w.engine, rule.id, call({}), NOW + 30_000)).toEqual({
      status: 429,
      body: { error: 'webhook_rate_limited' },
      retryAfter: 30,
    });
    w.sql.exec(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${AUTOMATION_RUNS_PER_DAY})
       INSERT INTO automation_runs (id, rule_id, at, result, body) SELECT 'x' || i, 'r', ?, 'done', '{}' FROM n`,
      NOW + 120_000,
    );
    expect(await answerItemHook(w.engine, rule.id, call({}), NOW + 120_000)).toEqual({
      status: 429,
      body: { error: 'automation_budget_spent' },
      retryAfter: 12 * 60 * 60 - 120,
    });
  });

  it('says a call the queue had no room for was dropped', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const w = world();
    const { rule, call } = await hooked(w);
    w.sql.exec(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${AUTOMATION_QUEUE_MAX})
       INSERT INTO automation_queue (event, at) SELECT '{}', 0 FROM n`,
    );
    expect((await answerItemHook(w.engine, rule.id, call({}), NOW)).body).toEqual({ queued: 0 });
    expect(w.engine.schedule.dropped).toBe(1);
  });
});

describe('the Worker’s door', () => {
  const request = (init: RequestInit & { type?: string | null } = {}) =>
    new Request('https://app.example/api/hooks/automations/item-1/r1', {
      method: 'POST',
      ...init,
      headers: {
        ...(init.type === null
          ? {}
          : { 'Content-Type': init.type ?? 'application/json; charset=utf-8' }),
        ...init.headers,
      },
    });

  it('reads a JSON POST as a call, with the two headers that may prove it', async () => {
    const call = (await readItemHookCall(
      request({
        body: '{"a":1}',
        headers: { Authorization: 'Bearer lwh_x', 'X-Liveworkspace-Signature': 'sha256=ab' },
      }),
    )) as HookCall;
    expect(new TextDecoder().decode(call.body)).toBe('{"a":1}');
    expect(call).toMatchObject({
      authorization: 'Bearer lwh_x',
      signature: 'sha256=ab',
      timestamp: null,
    });
    const timed = (await readItemHookCall(
      request({ body: '{}', headers: { 'X-Liveworkspace-Timestamp': '1800000000' } }),
    )) as HookCall;
    expect(timed.timestamp).toBe('1800000000');
    const empty = (await readItemHookCall(request())) as HookCall;
    expect(empty.body.byteLength).toBe(0);
  });

  it('refuses another method, another type and a body past 16 KB, declared or read', async () => {
    const refused = async (r: Request) => {
      const response = (await readItemHookCall(r)) as Response;
      return [response.status, (await response.json<{ error: string }>()).error];
    };
    expect(await refused(request({ method: 'GET' }))).toEqual([405, 'method_not_allowed']);
    expect(await refused(request({ body: 'x', type: 'text/plain' }))).toEqual([
      415,
      'webhook_json_only',
    ]);
    expect(
      await refused(request({ body: 'x', type: null, headers: { 'Content-Type': '' } })),
    ).toEqual([415, 'webhook_json_only']);
    expect(await refused(request({ type: null }))).toEqual([415, 'webhook_json_only']);
    expect(await refused(request({ body: '{}', headers: { 'Content-Length': '99999' } }))).toEqual([
      413,
      'webhook_too_large',
    ]);
    const big = 'x'.repeat(WEBHOOK_BODY_MAX + 1);
    expect(await refused(request({ body: big }))).toEqual([413, 'webhook_too_large']);
    // A stream that declares no length is cut off as it is read.
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(enc.encode(big.slice(0, 9000)));
        controller.enqueue(enc.encode(big.slice(0, 9000)));
        controller.close();
      },
    });
    const streamed = request({ body: stream, duplex: 'half' } as RequestInit);
    expect(await refused(streamed)).toEqual([413, 'webhook_too_large']);
  });

  it('answers with no-store, and Retry-After when the room says when', async () => {
    const limited = itemHookResponse({
      status: 429,
      body: { error: 'webhook_rate_limited' },
      retryAfter: 7,
    });
    expect(limited.headers.get('Retry-After')).toBe('7');
    expect(limited.headers.get('Cache-Control')).toBe('no-store');
    expect(
      itemHookResponse({ status: 202, body: { queued: 1 } }).headers.get('Retry-After'),
    ).toBeNull();
  });
});

describe('the email opt-out', () => {
  it('stops a token’s address, and answers false for a token the item never made', () => {
    const w = world();
    const token = 'a'.repeat(43);
    w.sql.exec(
      "INSERT INTO automation_email_addresses (address, token, unsubscribed_at) VALUES ('a@example.com', ?, NULL)",
      token,
    );
    expect(itemOptOut(w.engine, 'b'.repeat(43), NOW)).toBe(false);
    expect(itemOptOut(w.engine, token, NOW)).toBe(true);
    expect(rowsOf(w.sql, 'SELECT unsubscribed_at FROM automation_email_addresses')).toEqual([
      { unsubscribed_at: NOW },
    ]);
    w.state.held = false;
    expect(itemOptOut(w.engine, token, NOW)).toBe(false);
  });
});
