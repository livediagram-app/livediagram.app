// An Incoming Webhook rule's secret and the proof a call gives of it, inside the item's room
// (liveworkspace/docs/specs/018-automations/automations.md "Triggers every app has", "Runs, limits and loops";
// blueprint engine.md "The room entry"). The secret is made here and shown once; the item keeps only its SHA-256
// hash (`automation_hooks`), its last 4 characters, when it was made and last used, and its rate limit's minute. A
// call proves it holds the secret by `Authorization: Bearer lwh_…` or by an HMAC-SHA256 of `<timestamp>.<body>` in
// the signature header, `sha256=<hex>`, with the unix seconds in `X-Liveworkspace-Timestamp`, both compared in
// constant time. A signed call more than 5 minutes off the room's clock fails the proof, and one whose signature the
// rule took in the last 10 minutes is a replay (`automation_hook_seen`). Every refusal before the proof (no item, no
// rule, a rule off or of another trigger, no secret made, a wrong one, a stale or replayed signature) is the same
// 401, after the same work, so a caller learns nothing of what exists. What a call that passes is about, and its
// queueing, are the app's. Nothing here logs or answers the secret, its hash, a signature or the body.
import { timingSafeEqual } from '@liveworkspace/index-app/timing-safe';
import {
  WEBHOOK_REPLAY_MS,
  WEBHOOK_SECRET_BYTES,
  WEBHOOK_SECRET_PREFIX,
  WEBHOOK_SEEN_MAX,
  WEBHOOK_SKEW_MS,
} from '../incoming';
import type { AutomationHookInfo } from '../types';
import type { Sql } from './sql';

const MINUTE_MS = 60_000;
const SIGNATURE_PREFIX = 'sha256=';
// What an unknown rule's proof is checked against, so a refusal takes the same work as a wrong secret's.
const NO_HASH = '0'.repeat(64);

// A call as the worker read it: the raw body (its bytes, as signed) and the headers that may prove it (a signature
// with its timestamp, unix seconds; absent reads as none).
export type HookCall = {
  body: Uint8Array;
  authorization: string | null;
  signature: string | null;
  timestamp?: string | null;
};
// The room's answer, made into a response by the worker.
export type HookAnswer = { status: number; body: Record<string, unknown>; retryAfter?: number };

export const HOOK_UNAUTHORIZED: HookAnswer = {
  status: 401,
  body: { error: 'webhook_unauthorized' },
};

const enc = new TextEncoder();
const hex = (bytes: ArrayBuffer | Uint8Array) =>
  Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');

export const sha256Hex = async (text: string): Promise<string> =>
  hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));

function bytesOfHex(h: string): Uint8Array {
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** HMAC-SHA256 of `body` keyed with the secret's hash, as hex: equal to the HMAC keyed with the secret itself, since
 *  the secret is longer than the hash's 64-byte block (RFC 2104 §2). That is what lets the room keep only the hash
 *  and still check a signature keyed with the secret; it is no protection at rest, since whoever reads the hash can
 *  sign calls with it, as with any HMAC check. The hash never leaves the item's room: no answer, list, file, copy or
 *  log holds it. */
export async function signatureOf(hash: string, body: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    bytesOfHex(hash),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return hex(await crypto.subtle.sign('HMAC', key, body));
}

function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A new secret: `lwh_` and 64 random bytes, base64url (90 characters). */
export const newHookSecret = (): string =>
  `${WEBHOOK_SECRET_PREFIX}${base64url(crypto.getRandomValues(new Uint8Array(WEBHOOK_SECRET_BYTES)))}`;

// ---- Storage ---------------------------------------------------------------------------------------------------------

type HookRow = { hash: string; last4: string; made_at: number; used_at: number | null };

/** The hash of the rule's secret, or null when none was made. */
export function hookHash(sql: Sql, ruleId: string): string | null {
  const row = sql.exec('SELECT hash FROM automation_hooks WHERE rule_id = ?', ruleId).toArray()[0];
  return typeof row?.['hash'] === 'string' ? row['hash'] : null;
}

const infoOf = (url: string, row: Omit<HookRow, 'hash'> | undefined): AutomationHookInfo => ({
  url,
  secret: row
    ? {
        last4: row.last4,
        madeAt: Number(row.made_at),
        usedAt: row.used_at === null ? null : Number(row.used_at),
      }
    : null,
});

/** Every Incoming Webhook rule's address and secret as an Editor sees them, by rule. Never the hash. `url`: the
 *  rule's address on the app's own origin. */
export function hookInfos(
  url: (ruleId: string) => string,
  sql: Sql,
  rules: readonly { id: string; trigger: { kind: string } }[],
): Map<string, AutomationHookInfo> {
  const incoming = rules.filter((r) => r.trigger.kind === 'incoming_webhook');
  const out = new Map<string, AutomationHookInfo>();
  if (incoming.length === 0) return out;
  const rows = sql
    .exec('SELECT rule_id, last4, made_at, used_at FROM automation_hooks')
    .toArray() as unknown as (Omit<HookRow, 'hash'> & { rule_id: string })[];
  const byRule = new Map(rows.map((r) => [r.rule_id, r]));
  for (const rule of incoming) out.set(rule.id, infoOf(url(rule.id), byRule.get(rule.id)));
  return out;
}

/** A new secret for the rule, replacing any it had (Regenerate: the old one stops at once). Answers the secret,
 *  which is never kept, and the hook as the list shows it. */
export async function makeHookSecret(
  url: (ruleId: string) => string,
  sql: Sql,
  ruleId: string,
  now: number,
): Promise<{ secret: string; hook: AutomationHookInfo }> {
  const secret = newHookSecret();
  const row: HookRow = {
    hash: await sha256Hex(secret),
    last4: secret.slice(-4),
    made_at: now,
    used_at: null,
  };
  sql.exec(
    `INSERT INTO automation_hooks (rule_id, hash, last4, made_at, used_at, window_at, window_calls)
     VALUES (?, ?, ?, ?, NULL, 0, 0)
     ON CONFLICT (rule_id) DO UPDATE SET hash = excluded.hash, last4 = excluded.last4,
       made_at = excluded.made_at, used_at = NULL, window_at = 0, window_calls = 0`,
    ruleId,
    row.hash,
    row.last4,
    now,
  );
  return { secret, hook: infoOf(url(ruleId), row) };
}

// ---- A call ----------------------------------------------------------------------------------------------------------

// A timestamp as sent: unix seconds, digits only.
const SECONDS = /^[0-9]{1,12}$/;

const bearerOf = (call: HookCall): string => {
  const auth = call.authorization ?? '';
  return auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : '';
};

/** The signature a signed call sent (lowercase hex, its prefix off), or null for a Bearer call or one with none. */
export function hookSignature(call: HookCall): string | null {
  if (bearerOf(call) || !call.signature?.startsWith(SIGNATURE_PREFIX)) return null;
  return call.signature.slice(SIGNATURE_PREFIX.length).trim().toLowerCase();
}

// What a signed call signs: its timestamp as sent, a full stop, then the body's exact bytes.
function signedBytes(timestamp: string, body: Uint8Array): Uint8Array {
  const head = enc.encode(`${timestamp}.`);
  const out = new Uint8Array(head.byteLength + body.byteLength);
  out.set(head, 0);
  out.set(body, head.byteLength);
  return out;
}

/** Whether the call proves it holds the secret whose hash is `hash` (null: none, checked against a dummy all the
 *  same). The Bearer is hashed and compared; else the signature over `<timestamp>.<body>` is worked out and compared,
 *  both in constant time, and the timestamp must be within 5 minutes of `now` either way (checked after the
 *  comparison, so a stale call costs the same work as a wrong one). */
export async function provesSecret(
  call: HookCall,
  hash: string | null,
  now: number = Date.now(),
): Promise<boolean> {
  const stored = hash ?? NO_HASH;
  const bearer = bearerOf(call);
  let ok = false;
  if (bearer) ok = await timingSafeEqual(await sha256Hex(bearer), stored);
  else {
    const sent = hookSignature(call);
    if (sent !== null) {
      const timestamp = (call.timestamp ?? '').trim();
      const signed = await signatureOf(stored, signedBytes(timestamp, call.body));
      ok = await timingSafeEqual(signed, sent);
      ok =
        ok &&
        SECONDS.test(timestamp) &&
        Math.abs(Number(timestamp) * 1000 - now) <= WEBHOOK_SKEW_MS;
    }
  }
  return ok && hash !== null;
}

/** Whether the rule already took this signed call's signature in the last 10 minutes: a replay, answered as a wrong
 *  secret is. A Bearer call is never one. */
export function hookReplayed(sql: Sql, ruleId: string, call: HookCall, now: number): boolean {
  const signature = hookSignature(call);
  if (signature === null) return false;
  return (
    sql
      .exec(
        'SELECT 1 FROM automation_hook_seen WHERE rule_id = ? AND signature = ? AND at >= ?',
        ruleId,
        signature,
        now - WEBHOOK_REPLAY_MS,
      )
      .toArray().length > 0
  );
}

/** A signed call accepted: its signature kept for 10 minutes, so the same call is refused if sent again. Rows past
 *  the window go (every rule's, by `at`), and the rule keeps its newest WEBHOOK_SEEN_MAX. Nothing for a Bearer call. */
export function takeHookSignature(sql: Sql, ruleId: string, call: HookCall, now: number): void {
  const signature = hookSignature(call);
  if (signature === null) return;
  sql.exec('DELETE FROM automation_hook_seen WHERE at < ?', now - WEBHOOK_REPLAY_MS);
  sql.exec(
    `INSERT INTO automation_hook_seen (rule_id, signature, at) VALUES (?, ?, ?)
     ON CONFLICT (rule_id, signature) DO UPDATE SET at = excluded.at`,
    ruleId,
    signature,
    now,
  );
  sql.exec(
    `DELETE FROM automation_hook_seen WHERE rule_id = ? AND signature IN
       (SELECT signature FROM automation_hook_seen WHERE rule_id = ? ORDER BY at DESC LIMIT -1 OFFSET ?)`,
    ruleId,
    ruleId,
    WEBHOOK_SEEN_MAX,
  );
}

// The rule's minute: this call counted in it, and the last use stamped, in one statement (every SET reads the row as
// it was). Answers the calls so far and when the minute started.
export function countHookCall(
  sql: Sql,
  ruleId: string,
  now: number,
): { calls: number; since: number } {
  const row = sql
    .exec(
      `UPDATE automation_hooks SET used_at = ?,
         window_calls = CASE WHEN window_at + ? > ? THEN window_calls + 1 ELSE 1 END,
         window_at = CASE WHEN window_at + ? > ? THEN window_at ELSE ? END
       WHERE rule_id = ? RETURNING window_at, window_calls`,
      now,
      MINUTE_MS,
      now,
      MINUTE_MS,
      now,
      now,
      ruleId,
    )
    .toArray()[0];
  return { calls: Number(row?.['window_calls'] ?? 0), since: Number(row?.['window_at'] ?? now) };
}

/** Seconds until the rule's minute, which began at `since`, ends: a rate-limited call's Retry-After. */
export const hookRetryAfter = (since: number, now: number): number =>
  Math.max(1, Math.ceil((since + MINUTE_MS - now) / 1000));

/** A call's raw body as JSON, or undefined when it is not UTF-8 JSON. */
export function hookJson(body: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(body));
  } catch {
    return undefined;
  }
}
