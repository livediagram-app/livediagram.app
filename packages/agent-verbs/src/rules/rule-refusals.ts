// Words for a refusal the api gives a rule call (liveworkspace/docs/specs/018-automations/automations.md "Who may do
// what", "Agents"; "Errors that teach"): the api's code, the part of the rule at fault as the engine's check names it,
// and the next call to make. Anything else is the product's shared refusals' (its apiRefusalOf); a 5xx is no refusal.
import { ApiError } from '@liveworkspace/api-client';
import {
  AUTOMATION_NAME_MAX,
  AUTOMATION_RULES_MAX,
  AUTOMATION_RUNS_PER_DAY,
} from '@liveworkspace/automations';
import {
  AUTOMATION_KEPT_SNAPSHOTS_MAX,
  inTabWords,
  type ItemWord,
} from '@liveworkspace/automations/item';
import type { AgentProduct } from '../product';

export type RuleRefusal = { code: string; message: string };

// A rule that does not read: the api names the part at fault.
const BODY_WORDS: Readonly<Record<string, string>> = {
  automation_invalid: 'fix that part and send the change again.',
  automation_value_unknown:
    'a {{value}} the rule does not know there: the values, and the triggers each is read under, are in change_rules’ rule format.',
  automation_condition_unsupported:
    'nobody is behind that trigger (a time, an Incoming Webhook, a poll or a question): leave out who conditions and an email to "trigger".',
  automation_step_unsupported:
    'that step cannot go there: an if holds actions only (no if, wait, ai or notify), and a step that ends the rule must be its last.',
};

function wordsOf(word: string): Readonly<Record<string, string>> {
  // A knowledgebase's tabs are its pages (automations.md "Naming"); every other item's stay tabs.
  const said = rawWordsOf(word);
  return Object.fromEntries(
    Object.entries(said).map(([code, text]) => [code, inTabWords(text, word as ItemWord)]),
  );
}

function rawWordsOf(word: string): Readonly<Record<string, string>> {
  return {
    automations_need_editor: `rules are an Editor’s of the whole ${word}: this token’s person must be an Editor of the whole ${word} (not through a link to one tab, a Participant or a Viewer). An Incoming Webhook’s secret is made and read only in the editor, never through a token.`,
    read_only_token:
      'this token is read-only: it may list rules and the Audit Trail (list_rules), never change, test or run them.',
    automation_needs_a_person:
      'a rule holding Revert to Snapshot is saved only by a person, in the editor, never through an API token: leave the revert_snapshot step out.',
    automation_connection_needs_a_person:
      'a rule’s connection (where a Post to Slack, Teams or a service sends) is picked only by a person, in the editor: keep the connection the rule already has, or leave that step out.',
    automation_snapshots_full: `the rules would keep more than ${AUTOMATION_KEPT_SNAPSHOTS_MAX} snapshots: name one the rules already keep.`,
    automation_name_taken: `a rule of that name is in this ${word}: pick another name (1 to ${AUTOMATION_NAME_MAX} characters).`,
    automation_rules_full: `the ${word} holds ${AUTOMATION_RULES_MAX} rules, the most it can: delete one first.`,
    automation_not_found: 'that rule is gone. list_rules lists the rules.',
    automation_not_manual:
      'run takes only a Run by Hand rule (trigger manual) that is on: turn it on, or try another rule with test.',
    automation_budget_spent: `the ${word} has made its ${AUTOMATION_RUNS_PER_DAY.toLocaleString('en-GB')} runs today: rules run again tomorrow (UTC). test still works.`,
    tab_not_found: `that tab is gone from the ${word}. list_rules lists the tabs.`,
  };
}

// The body's `path` and `message`, when it is JSON (the api client read its `error` from it).
function detailOf(body: string): { path?: string; message?: string } {
  const parsed = JSON.parse(body) as { path?: unknown; message?: unknown };
  return {
    ...(typeof parsed.path === 'string' ? { path: parsed.path } : {}),
    ...(typeof parsed.message === 'string' ? { message: parsed.message } : {}),
  };
}

const capital = (s: string) => `${s[0]!.toUpperCase()}${s.slice(1)}`;

/** The rule refusals in a product's words, falling back to its shared ones. */
export function createRuleRefusal(
  product: Pick<AgentProduct, 'noun' | 'word'>,
  apiRefusalOf: (err: unknown) => RuleRefusal | null,
) {
  const words = wordsOf(product.word ?? product.noun);
  return function ruleRefusalOf(err: unknown): RuleRefusal | null {
    if (!(err instanceof ApiError) || err.status >= 500 || !err.code) return apiRefusalOf(err);
    const code = err.code;
    const body = BODY_WORDS[code];
    if (body) {
      const { path, message } = detailOf(err.body);
      return {
        code,
        message: `The api refused the rule (${code}${path ? ` at ${path}` : ''})${message ? `: ${message}` : ''}. ${capital(body)}`,
      };
    }
    const said = words[code];
    return said ? { code, message: `The api refused it (${code}): ${said}` } : apiRefusalOf(err);
  };
}
