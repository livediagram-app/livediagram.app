// Automations: the Incoming Webhook trigger's pure parts (liveworkspace/docs/specs/018-automations/automations.md
// "Triggers every app has", "Values", "Runs, limits and loops"). The secret's shape and the call's limits, the values
// a rule names (`{{webhook.…}}`), what a call's body gives them, and the body read: a JSON object, with the app's
// own list of what the call is about read by the app. The secret's checks and the queue are the room's
// (room/automation-incoming.ts). Pure.

import { cutText } from '@liveworkspace/model-core/text-cut';
import type { AutomationKind } from './types';
import { isObj, type Obj } from './validate-read';
import { valuesIn } from './values';
import { webhookPathOf, type WebhookValue, type WebhookValues } from './webhook-paths';

// Limits (spec "Runs, limits and loops").
export const WEBHOOK_BODY_MAX = 16 * 1024;
export const WEBHOOK_CALLS_PER_MINUTE = 60;
export const WEBHOOK_VALUE_MAX = 500;
// The secret: `lwh_` and base64url of 64 random bytes (86 characters), so it is longer than HMAC-SHA256's 64-byte
// block and HMAC(secret) is HMAC(SHA-256(secret)) (RFC 2104 §2): the item keeps only the hash and still checks a
// signature keyed with the secret.
export const WEBHOOK_SECRET_PREFIX = 'lwh_';
export const WEBHOOK_SECRET_BYTES = 64;
// The header a signed call carries. The first app's rules shipped with a header of their own, which that app keeps
// accepting and documenting: both are here, and the app's route chooses.
export const WEBHOOK_SIGNATURE_HEADER = 'X-Liveworkspace-Signature';
export const WEBHOOK_SIGNATURE_HEADER_LEGACY = 'X-Liveplanner-Signature';
// A signed call's moment, unix seconds, in every app: the outgoing deliveries' own header and format. The signature
// is over `<timestamp>.<body>`; a timestamp more than WEBHOOK_SKEW_MS off the room's clock, either way, is refused,
// and a signature a rule took in the last WEBHOOK_REPLAY_MS is refused as a replay (at most WEBHOOK_SEEN_MAX kept a
// rule: its 60 calls a minute for the window).
export const WEBHOOK_TIMESTAMP_HEADER = 'X-Liveworkspace-Timestamp';
export const WEBHOOK_SKEW_MS = 5 * 60_000;
export const WEBHOOK_REPLAY_MS = 10 * 60_000;
export const WEBHOOK_SEEN_MAX = 600;
// A list's place, as its number: `0`, `12`, never `012` (so two paths never read one place).
const INDEX = /^(0|[1-9][0-9]*)$/;

// Every string a rule's steps hold, wherever it sits (a message, a title, a field's text).
function stringsOf(v: unknown, out: string[]): void {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) for (const x of v) stringsOf(x, out);
  else if (isObj(v)) for (const x of Object.values(v)) stringsOf(x, out);
}

/** The `{{webhook.…}}` paths a rule's steps name, each once (`build.status`). */
export function webhookPathsIn(steps: readonly AutomationKind[]): string[] {
  const texts: string[] = [];
  stringsOf(steps, texts);
  const out = new Set<string>();
  for (const text of texts)
    for (const name of valuesIn(text)) {
      const path = webhookPathOf(name);
      if (path) out.add(path.join('.'));
    }
  return [...out];
}

// One path read from the body: a string (cut), a finite number or a boolean; anything else, or nothing there, is
// undefined. Own properties only, so a path never reads the prototype.
function readPath(payload: unknown, path: readonly string[]): WebhookValue | undefined {
  let at: unknown = payload;
  for (const name of path) {
    if (Array.isArray(at)) at = INDEX.test(name) ? at[Number(name)] : undefined;
    else if (isObj(at)) at = Object.hasOwn(at, name) ? at[name] : undefined;
    else return undefined;
  }
  if (typeof at === 'string') return cutText(at, WEBHOOK_VALUE_MAX);
  if (typeof at === 'number') return Number.isFinite(at) ? at : undefined;
  return typeof at === 'boolean' ? at : undefined;
}

/** The values `paths` read from a call's body, by path: what a waiting run keeps (the rest is never stored). */
export function webhookValues(payload: unknown, paths: readonly string[]): WebhookValues {
  const out: Record<string, WebhookValue> = {};
  for (const path of paths) {
    const value = readPath(payload, path.split('.'));
    // Defined, not assigned: a `__proto__` path is kept as the call's own value, never set as the prototype.
    if (value !== undefined)
      Object.defineProperty(out, path, {
        value,
        enumerable: true,
        writable: true,
        configurable: true,
      });
  }
  return out;
}

// How an app reads what a call is about: the body's key that lists them, and the list read (or why it is refused).
export type HookSubjects<Subject> = {
  key: string;
  read: (v: unknown) => Subject[] | { error: string };
};

export type HookBody<Subject> = { subjects: Subject[]; payload: Obj } | { error: string };

/** A call's body, parsed JSON: what it names (none: an empty list) and the payload; or why not. */
export function readHookBody<Subject = never>(
  raw: unknown,
  subjects?: HookSubjects<Subject>,
): HookBody<Subject> {
  if (!isObj(raw)) return { error: 'The body must be a JSON object' };
  const named = subjects ? raw[subjects.key] : undefined;
  if (!subjects || named === undefined) return { subjects: [], payload: raw };
  const read = subjects.read(named);
  return Array.isArray(read) ? { subjects: read, payload: raw } : read;
}
