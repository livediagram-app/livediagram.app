// Automations: the Incoming Webhook trigger's pure parts (docs/specs/026-plan/automations.md "Incoming Webhook";
// blueprint automations.md "Phase 3"). What a call's body names (the cards, by number) and gives (the payload the
// rule's `{{webhook.…}}` values read), which values a rule names, whether a rule can run with no card, and the Audit
// Trail's trigger line. The secret, its checks and the queue are the api's (automation-incoming.ts). Pure.

import { readHookBody as readBody, type Obj } from '@liveworkspace/automations';
import { isSnapshotKind } from '@liveworkspace/automations/item';
import type { Item } from '../item';
import { INCOMING_WEBHOOK_PERSON, type AutomationRuleBody } from './types';

// The secret's shape, the call's limits, the `{{webhook.…}}` paths and what a body gives them are
// @liveworkspace/automations' (liveworkspace/docs/specs/018-automations/blueprints/engine.md "Incoming Webhook").
export {
  WEBHOOK_BODY_MAX,
  WEBHOOK_CALLS_PER_MINUTE,
  WEBHOOK_PATH_DEPTH_MAX,
  WEBHOOK_PATH_NAME_MAX,
  WEBHOOK_SECRET_BYTES,
  WEBHOOK_SECRET_PREFIX,
  WEBHOOK_VALUE_MAX,
  WEBHOOK_VALUE_PREFIX,
  webhookPathOf,
  webhookPathsIn,
  webhookValues,
  type WebhookValue,
  type WebhookValues,
} from '@liveworkspace/automations';
// A plan's rules shipped with this header, and keep it (the platform's is `X-Liveworkspace-Signature`).
export { WEBHOOK_SIGNATURE_HEADER_LEGACY as WEBHOOK_SIGNATURE_HEADER } from '@liveworkspace/automations';

export const WEBHOOK_CARDS_MAX = 10;
// The largest card number a call may name.
const CARD_NUMBER_MAX = 2 ** 31 - 1;

export type HookBody = { cards: number[]; payload: Obj } | { error: string };

// A call's `cards`: up to WEBHOOK_CARDS_MAX card numbers, each once.
const readCards = (cards: unknown): number[] | { error: string } =>
  !Array.isArray(cards) ||
  cards.length > WEBHOOK_CARDS_MAX ||
  !cards.every((n) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= CARD_NUMBER_MAX)
    ? { error: `cards must be a list of up to ${WEBHOOK_CARDS_MAX} card numbers` }
    : [...new Set(cards as number[])];

/** A call's body, parsed JSON: the card numbers it names (none: an empty list) and the payload; or why not. */
export function readHookBody(raw: unknown): HookBody {
  const read = readBody(raw, { key: 'cards', read: readCards });
  return 'error' in read ? read : { cards: read.subjects, payload: read.payload };
}

/** Whether a rule can run with no card: no conditions, and only Create Card (copying and linking nothing from the
 *  triggering card), outgoing actions and the snapshot steps (automations.md "Snapshot steps"). */
export function runsWithoutCard(rule: Pick<AutomationRuleBody, 'conditions' | 'steps'>): boolean {
  return (
    rule.conditions.length === 0 &&
    rule.steps.length > 0 &&
    rule.steps.every(
      (s) =>
        s.kind === 'notify' ||
        isSnapshotKind(s.kind) ||
        (s.kind === 'create_card' && !s.copy?.length && !s.linkField),
    )
  );
}

/** Whether a rule holds Take Snapshot or Revert to Snapshot (at its top level, their one place). */
export const holdsSnapshotStep = (rule: Pick<AutomationRuleBody, 'steps'>): boolean =>
  rule.steps.some((s) => isSnapshotKind(s.kind));

/** Whether a rule reverts the plan: only a person saves one (automations.md "Snapshot steps"). */
export const ruleReverts = (rule: Pick<AutomationRuleBody, 'steps'>): boolean =>
  rule.steps.some((s) => s.kind === 'revert_snapshot');

/** Whether a time rule runs once a moment for the plan, with no card, rather than once for each card: a Scheduled rule
 *  that holds a snapshot step and can run without a card. */
export const runsForPlan = (rule: Pick<AutomationRuleBody, 'trigger' | 'conditions' | 'steps'>) =>
  rule.trigger.kind === 'scheduled' && holdsSnapshotStep(rule) && runsWithoutCard(rule);

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
