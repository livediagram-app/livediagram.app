// Automations: the Incoming Webhook trigger's pure parts (docs/specs/026-plan/automations.md "Incoming Webhook";
// blueprint automations.md "Phase 3"). What a call's body names (the cards, by number) and gives (the payload the
// rule's `{{webhook.…}}` values read), which values a rule names, whether a rule can run with no card, and the Audit
// Trail's trigger line. The secret, its checks and the queue are the api's (automation-incoming.ts). Pure.

import { cutText } from '@liveworkspace/model-core/text-cut';
import type { Item } from '../item';
import { INCOMING_WEBHOOK_PERSON, type AutomationRuleBody } from './types';
import { valuesIn } from './values';
import { webhookPathOf, type WebhookValue, type WebhookValues } from './webhook-paths';

export * from './webhook-paths';

// Limits (spec "Limits").
export const WEBHOOK_BODY_MAX = 16 * 1024;
export const WEBHOOK_CARDS_MAX = 10;
export const WEBHOOK_CALLS_PER_MINUTE = 60;
export const WEBHOOK_VALUE_MAX = 500;
// The secret: `lwh_` and base64url of 64 random bytes (86 characters), so it is longer than HMAC-SHA256's 64-byte
// block and HMAC(secret) is HMAC(SHA-256(secret)) (RFC 2104 §2): the plan keeps only the hash and still checks a
// signature keyed with the secret.
export const WEBHOOK_SECRET_PREFIX = 'lwh_';
export const WEBHOOK_SECRET_BYTES = 64;
export const WEBHOOK_SIGNATURE_HEADER = 'X-Liveplanner-Signature';
// The largest card number a call may name.
const CARD_NUMBER_MAX = 2 ** 31 - 1;
// A list's place, as its number: `0`, `12`, never `012` (so two paths never read one place).
const INDEX = /^(0|[1-9][0-9]*)$/;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

// Every string a rule's steps hold, wherever it sits (a comment, a title, a message, a field's text).
function stringsOf(v: unknown, out: string[]): void {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) for (const x of v) stringsOf(x, out);
  else if (isObj(v)) for (const x of Object.values(v)) stringsOf(x, out);
}

/** The `{{webhook.…}}` paths a rule's steps name, each once (`build.status`). */
export function webhookPathsIn(steps: AutomationRuleBody['steps']): string[] {
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

export type HookBody = { cards: number[]; payload: Obj } | { error: string };

/** A call's body, parsed JSON: the card numbers it names (none: an empty list) and the payload; or why not. */
export function readHookBody(raw: unknown): HookBody {
  if (!isObj(raw)) return { error: 'The body must be a JSON object' };
  const cards = raw['cards'];
  if (cards === undefined) return { cards: [], payload: raw };
  if (
    !Array.isArray(cards) ||
    cards.length > WEBHOOK_CARDS_MAX ||
    !cards.every(
      (n) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= CARD_NUMBER_MAX,
    )
  )
    return { error: `cards must be a list of up to ${WEBHOOK_CARDS_MAX} card numbers` };
  return { cards: [...new Set(cards as number[])], payload: raw };
}

/** Whether a rule can run with no card: no conditions, and only Create Card (copying and linking nothing from the
 *  triggering card) and outgoing actions. */
export function runsWithoutCard(rule: Pick<AutomationRuleBody, 'conditions' | 'steps'>): boolean {
  return (
    rule.conditions.length === 0 &&
    rule.steps.length > 0 &&
    rule.steps.every(
      (s) => s.kind === 'notify' || (s.kind === 'create_card' && !s.copy?.length && !s.linkField),
    )
  );
}

export const NO_CARDS_NAMED = "No cards named: this rule's steps need a card";

/** The Audit Trail's first line for a call that named `cards` cards. */
export const incomingTriggerWords = (cards: number): string =>
  cards === 0
    ? 'Webhook received: no card'
    : `Webhook received: ${cards} card${cards === 1 ? '' : 's'}`;

/** The card a run with no card walks: no id, no number, no fields. Its steps (Create Card, outgoing actions) never
 *  write it, and its `card.…` values read nothing (values.ts `cardless`). */
export const cardlessCard = (): Item => ({
  id: '',
  type: '',
  key: 0,
  rank: '',
  fields: {},
  rev: 0,
  createdAt: 0,
  updatedAt: 0,
  createdBy: INCOMING_WEBHOOK_PERSON,
  updatedBy: INCOMING_WEBHOOK_PERSON,
});
