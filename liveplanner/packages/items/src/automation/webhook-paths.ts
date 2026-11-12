// Automations: an Incoming Webhook rule's values, `{{webhook.<path>}}` (docs/specs/026-plan/automations.md "Values";
// blueprint automations.md "Phase 3"). The path's rules, kept apart from incoming.ts so values.ts can read them
// without a cycle. A path is checked by a split and one anchored character-class test per name, never a pattern that
// could backtrack on a long hostile name (CodeQL polynomial-regex). Pure.

export const WEBHOOK_VALUE_PREFIX = 'webhook.';
// A path is 1 to 5 names deep, each 1 to 64 letters, digits, `_` or `-`.
export const WEBHOOK_PATH_DEPTH_MAX = 5;
export const WEBHOOK_PATH_NAME_MAX = 64;

// What a call's body gives a value: a string (cut), a number or a boolean.
export type WebhookValue = string | number | boolean;
// The values a waiting run carries, by path (`build.status`): only those the rule's text names.
export type WebhookValues = Readonly<Record<string, WebhookValue>>;

const NAME = /^[A-Za-z0-9_-]+$/;

/** The names of `webhook.<path>`, or null when `name` is not one. */
export function webhookPathOf(name: string): string[] | null {
  if (!name.startsWith(WEBHOOK_VALUE_PREFIX)) return null;
  const parts = name.slice(WEBHOOK_VALUE_PREFIX.length).split('.');
  if (parts.length > WEBHOOK_PATH_DEPTH_MAX) return null;
  return parts.every((p) => p.length > 0 && p.length <= WEBHOOK_PATH_NAME_MAX && NAME.test(p))
    ? parts
    : null;
}
