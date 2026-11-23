// Words for a refusal the api gives a rule call (docs/specs/026-plan/automations.md "Agents and the CLI",
// "Refusals"; plan-agents.md "Errors that teach"): the api's code, the part of the rule at fault as the api names it,
// and the next call to make. Anything else is the shared refusals' (apiRefusalOf); a 5xx is no refusal.
import { ApiError } from '@liveworkspace/api-client';
import { AUTOMATION_RULES_MAX, AUTOMATION_RUNS_PER_DAY } from '@liveplanner/items';
import { apiRefusalOf } from '../plan/api-refusal';

export type RuleRefusal = { code: string; message: string };

// A rule that does not read: the api names the part at fault.
const BODY_WORDS: Readonly<Record<string, string>> = {
  automation_invalid: 'fix that part and send the change again.',
  automation_value_unknown:
    'a {{value}} the rule does not know: the values are listed in change_rules’ rule format.',
  automation_condition_unsupported:
    'a time trigger (scheduled, due_in, overdue, stuck), an incoming_webhook, an email_received or a GitHub trigger has nobody of the plan behind it: leave out who conditions and the "trigger" assignee or recipient.',
  automation_step_unsupported:
    'that step cannot go there: an if or a for holds actions only (no if, for, notify, ai or wait), and a for takes no create_card or copy_card either.',
};

// A limit: the plan's own fixed bounds, or with Pro on the owner's (the refusal names their tier's most, `max`).
const LIMIT_WORDS: Readonly<Record<string, (max: number | undefined) => string>> = {
  automation_rules_full: (max) =>
    max === undefined
      ? `the plan holds ${AUTOMATION_RULES_MAX.toLocaleString('en-GB')} rules, the most one can: delete one first.`
      : `its owner holds ${max.toLocaleString('en-GB')} rules across everything they own, the most their subscription allows: delete one first.`,
  automation_budget_spent: () =>
    `the plan has made its ${AUTOMATION_RUNS_PER_DAY.toLocaleString('en-GB')} runs today: rules run again tomorrow (UTC). test still works.`,
  automation_runs_used: () =>
    'the owner’s automation runs for this month are used, across everything they own: rules run again on the 1st (UTC). test still works.',
};

const WORDS: Readonly<Record<string, string>> = {
  automations_need_editor:
    'rules are an Editor’s of the whole plan: this token’s person must be an Editor of the whole plan (not of one tab, a Participant or a Viewer).',
  read_only_token:
    'this token is read-only: it may list rules and the Audit Trail (list_rules), never change, test or run them.',
  automation_name_taken: 'a rule of that name is in this plan: pick another name.',
  automation_not_found: 'that rule is gone. list_rules lists the rules.',
  automation_not_manual:
    'run takes only a Run from a Card rule (trigger manual) that is on: turn it on, or try another rule with test.',
  item_not_found: 'that card is gone or in the Trash. list_items lists the cards.',
  automation_needs_a_person:
    'a rule that reverts the plan (revert_snapshot) is saved by a person, in the builder: ask an Editor to add that step there. take_snapshot is yours to add.',
  automation_snapshots_full:
    'the plan keeps at most 5 snapshots for its rules: point this rule at a snapshot another rule already reverts to, or change one of those rules first.',
};

// The body's `path`, `message` and `max`. It is JSON: the api client read its `error` from it.
function detailOf(body: string): { path?: string; message?: string; max?: number } {
  const parsed = JSON.parse(body) as { path?: unknown; message?: unknown; max?: unknown };
  return {
    ...(typeof parsed.path === 'string' ? { path: parsed.path } : {}),
    ...(typeof parsed.message === 'string' ? { message: parsed.message } : {}),
    ...(typeof parsed.max === 'number' ? { max: parsed.max } : {}),
  };
}

export function ruleRefusalOf(err: unknown): RuleRefusal | null {
  if (!(err instanceof ApiError) || err.status >= 500 || !err.code) return apiRefusalOf(err);
  const code = err.code;
  const body = BODY_WORDS[code];
  if (body) {
    const { path, message } = detailOf(err.body);
    return {
      code,
      message: `The api refused the rule (${code}${path ? ` at ${path}` : ''})${message ? `: ${message}` : ''}. ${body[0]!.toUpperCase()}${body.slice(1)}`,
    };
  }
  const words = LIMIT_WORDS[code]?.(detailOf(err.body).max) ?? WORDS[code];
  return words ? { code, message: `The api refused it (${code}): ${words}` } : apiRefusalOf(err);
}
