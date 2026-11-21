import { describe, expect, it } from 'vitest';
import { WEBHOOK_SECRET_PREFIX } from '../incoming';
import {
  HOOK_UNAUTHORIZED,
  countHookCall,
  hookHash,
  hookInfos,
  hookJson,
  hookReplayed,
  hookRetryAfter,
  hookSignature,
  makeHookSecret,
  newHookSecret,
  provesSecret,
  sha256Hex,
  signatureOf,
  takeHookSignature,
  type HookCall,
} from './automation-incoming';
import { rowsOf, testSql } from './test-sql';

const enc = new TextEncoder();
const url = (ruleId: string) => `https://app.example/api/hooks/automations/i1/${ruleId}`;
const call = (over: Partial<HookCall> = {}): HookCall => ({
  body: enc.encode('{"a":1}'),
  authorization: null,
  signature: null,
  ...over,
});

// HMAC-SHA256 keyed with the secret itself, as another tool would sign a call.
async function signedWith(secret: string, body: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, body));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

describe('a secret', () => {
  it('is lwh_ and 64 random bytes, never the same twice', () => {
    const secret = newHookSecret();
    expect(secret).toMatch(/^lwh_[A-Za-z0-9_-]{86}$/);
    expect(newHookSecret()).not.toBe(secret);
    expect(secret.startsWith(WEBHOOK_SECRET_PREFIX)).toBe(true);
  });

  it('is kept as its hash and last 4 characters, and replaced by a new one', async () => {
    const sql = testSql();
    expect(hookHash(sql, 'r1')).toBeNull();
    const made = await makeHookSecret(url, sql, 'r1', 100);
    expect(made.hook).toEqual({
      url: url('r1'),
      secret: { last4: made.secret.slice(-4), madeAt: 100, usedAt: null },
    });
    expect(hookHash(sql, 'r1')).toBe(await sha256Hex(made.secret));
    expect(JSON.stringify(rowsOf(sql, 'SELECT * FROM automation_hooks'))).not.toContain(
      made.secret,
    );
    countHookCall(sql, 'r1', 150);
    const again = await makeHookSecret(url, sql, 'r1', 200);
    expect(again.secret).not.toBe(made.secret);
    expect(again.hook.secret).toMatchObject({ madeAt: 200, usedAt: null });
    expect(rowsOf(sql, 'SELECT window_calls FROM automation_hooks')[0]?.['window_calls']).toBe(0);
  });

  it('is listed for each Incoming Webhook rule, with or without one made', async () => {
    const sql = testSql();
    const rules = [
      { id: 'r1', trigger: { kind: 'incoming_webhook' } },
      { id: 'r2', trigger: { kind: 'incoming_webhook' } },
      { id: 'r3', trigger: { kind: 'scheduled' } },
    ];
    expect(hookInfos(url, sql, [rules[2]!])).toEqual(new Map());
    await makeHookSecret(url, sql, 'r1', 100);
    countHookCall(sql, 'r1', 150);
    const infos = hookInfos(url, sql, rules);
    expect([...infos.keys()]).toEqual(['r1', 'r2']);
    expect(infos.get('r1')?.secret).toMatchObject({ madeAt: 100, usedAt: 150 });
    expect(infos.get('r2')).toEqual({ url: url('r2'), secret: null });
  });
});

describe('a call’s proof', () => {
  const NOW = 1_800_000_000_000;
  const TS = String(NOW / 1000);
  const signedCall = async (secret: string, body: Uint8Array, ts = TS) =>
    call({
      body,
      timestamp: ts,
      signature: `sha256=${await signedWith(secret, enc.encode(`${ts}.${new TextDecoder().decode(body)}`))}`,
    });

  it('is the secret as a Bearer, or a signature of `<timestamp>.<body>` keyed with it', async () => {
    const secret = newHookSecret();
    const hash = await sha256Hex(secret);
    const body = enc.encode('{"build":"green"}');
    expect(await provesSecret(call({ authorization: `Bearer ${secret}` }), hash, NOW)).toBe(true);
    expect(await provesSecret(call({ authorization: 'Bearer lwh_wrong' }), hash, NOW)).toBe(false);
    const signed = await signedCall(secret, body);
    // Keyed with the hash, the room works out what the other tool keyed with the secret.
    expect(`sha256=${await signatureOf(hash, enc.encode(`${TS}.{"build":"green"}`))}`).toBe(
      signed.signature,
    );
    expect(await provesSecret(signed, hash, NOW)).toBe(true);
    expect(
      await provesSecret(
        { ...signed, signature: `${signed.signature!.toUpperCase()} ` },
        hash,
        NOW,
      ),
    ).toBe(false);
    expect(
      await provesSecret(
        { ...signed, signature: `sha256=${signed.signature!.slice(7).toUpperCase()} ` },
        hash,
        NOW,
      ),
    ).toBe(true);
    expect(
      await provesSecret({ ...signed, signature: `sha256=${'0'.repeat(64)}` }, hash, NOW),
    ).toBe(false);
    // Other bytes, or the body alone signed (the old form), prove nothing.
    expect(await provesSecret({ ...signed, body: enc.encode('{}') }, hash, NOW)).toBe(false);
    const bodyOnly = `sha256=${await signedWith(secret, body)}`;
    expect(await provesSecret(call({ body, timestamp: TS, signature: bodyOnly }), hash, NOW)).toBe(
      false,
    );
  });

  it('refuses a signed call with no timestamp, or one more than 5 minutes off either way', async () => {
    const secret = newHookSecret();
    const hash = await sha256Hex(secret);
    const body = enc.encode('{}');
    const at = async (seconds: number) =>
      provesSecret(await signedCall(secret, body, String(NOW / 1000 + seconds)), hash, NOW);
    expect(await at(300)).toBe(true);
    expect(await at(-300)).toBe(true);
    expect(await at(301)).toBe(false);
    expect(await at(-301)).toBe(false);
    const signed = await signedCall(secret, body);
    expect(await provesSecret({ ...signed, timestamp: null }, hash, NOW)).toBe(false);
    expect(await provesSecret({ ...signed, timestamp: undefined }, hash, NOW)).toBe(false);
    // Signed over what was sent, but not digits: refused all the same.
    expect(await provesSecret(await signedCall(secret, body, '1.8e9'), hash, NOW)).toBe(false);
    expect(await provesSecret(await signedCall(secret, body, ''), hash, NOW)).toBe(false);
  });

  it('is never given by a call with no proof, or for a rule with no secret', async () => {
    const hash = await sha256Hex('lwh_x');
    expect(await provesSecret(call(), hash)).toBe(false);
    expect(await provesSecret(call({ authorization: 'Basic abc' }), hash)).toBe(false);
    expect(await provesSecret(call({ signature: 'md5=abc' }), hash)).toBe(false);
    // Checked against a dummy all the same, and refused whatever it matches.
    expect(await provesSecret(call({ authorization: 'Bearer lwh_x' }), null)).toBe(false);
    const dummy = await signatureOf('0'.repeat(64), enc.encode(`${TS}.{"a":1}`));
    expect(
      await provesSecret(call({ timestamp: TS, signature: `sha256=${dummy}` }), null, NOW),
    ).toBe(false);
    expect(HOOK_UNAUTHORIZED).toEqual({ status: 401, body: { error: 'webhook_unauthorized' } });
  });

  it('names the signature a signed call sent, and none for a Bearer call', () => {
    expect(hookSignature(call({ signature: 'sha256=AB ' }))).toBe('ab');
    expect(hookSignature(call({ authorization: 'Bearer lwh_x', signature: 'sha256=ab' }))).toBe(
      null,
    );
    expect(hookSignature(call({ signature: 'md5=ab' }))).toBeNull();
    expect(hookSignature(call())).toBeNull();
  });
});

describe('a replay', () => {
  const T = 1_800_000_000_000;
  const signed = (sig: string) => call({ timestamp: '1', signature: `sha256=${sig}` });

  it('is a signature the rule took in the last 10 minutes; another rule’s, or a Bearer, is none', () => {
    const sql = testSql();
    expect(hookReplayed(sql, 'r1', signed('aa'), T)).toBe(false);
    takeHookSignature(sql, 'r1', signed('aa'), T);
    expect(hookReplayed(sql, 'r1', signed('AA'), T + 1)).toBe(true);
    expect(hookReplayed(sql, 'r1', signed('aa'), T + 10 * 60_000)).toBe(true);
    expect(hookReplayed(sql, 'r1', signed('aa'), T + 10 * 60_000 + 1)).toBe(false);
    expect(hookReplayed(sql, 'r2', signed('aa'), T + 1)).toBe(false);
    const bearer = call({ authorization: 'Bearer lwh_x', signature: 'sha256=aa' });
    expect(hookReplayed(sql, 'r1', bearer, T + 1)).toBe(false);
    takeHookSignature(sql, 'r1', call({ authorization: 'Bearer lwh_x' }), T);
    expect(rowsOf(sql, 'SELECT COUNT(*) AS n FROM automation_hook_seen')[0]?.['n']).toBe(1);
  });

  it('keeps 10 minutes of signatures, at most 600 a rule, pruned on each take', () => {
    const sql = testSql();
    takeHookSignature(sql, 'old', signed('o1'), T);
    for (let i = 0; i < 605; i += 1) takeHookSignature(sql, 'r1', signed(`s${i}`), T + i);
    const count = (rule: string) =>
      rowsOf(sql, `SELECT COUNT(*) AS n FROM automation_hook_seen WHERE rule_id = '${rule}'`)[0]?.[
        'n'
      ];
    expect(count('r1')).toBe(600);
    // The oldest five went; the newest stay.
    expect(hookReplayed(sql, 'r1', signed('s4'), T + 605)).toBe(false);
    expect(hookReplayed(sql, 'r1', signed('s5'), T + 605)).toBe(true);
    expect(count('old')).toBe(1);
    takeHookSignature(sql, 'r2', signed('n1'), T + 10 * 60_000 + 1);
    expect(count('old')).toBe(0);
  });
});

describe('a rule’s minute', () => {
  it('counts the calls in it, starts again once it has passed, and stamps the last use', async () => {
    const sql = testSql();
    await makeHookSecret(url, sql, 'r1', 0);
    const T = 1_000_000;
    expect(countHookCall(sql, 'r1', T)).toEqual({ calls: 1, since: T });
    expect(countHookCall(sql, 'r1', T + 30_000)).toEqual({ calls: 2, since: T });
    expect(countHookCall(sql, 'r1', T + 60_000)).toEqual({ calls: 1, since: T + 60_000 });
    expect(rowsOf(sql, 'SELECT used_at FROM automation_hooks')[0]?.['used_at']).toBe(T + 60_000);
    expect(countHookCall(sql, 'missing', 5)).toEqual({ calls: 0, since: 5 });
  });

  it('says when a rate-limited call may come again, a second at least', () => {
    expect(hookRetryAfter(1000, 31_000)).toBe(30);
    expect(hookRetryAfter(1000, 70_000)).toBe(1);
  });
});

describe('a call’s body', () => {
  it('reads as UTF-8 JSON, or not at all', () => {
    expect(hookJson(enc.encode('{"a":[1]}'))).toEqual({ a: [1] });
    expect(hookJson(enc.encode('{nope'))).toBeUndefined();
    expect(hookJson(new Uint8Array([0xff, 0xfe, 0x00]))).toBeUndefined();
  });
});
