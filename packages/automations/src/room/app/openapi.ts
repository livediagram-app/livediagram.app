// An app's Automations routes as its OpenAPI manifest lists them (blueprint item-engine.md "Routes", "An app's
// bindings"): the thirteen routes of handleItemAutomationRoutes under the app's own collection, and the two public
// doors (worker-doors.ts). The shape is the route entry every api's manifest holds; the body schemas are named as
// @liveworkspace/api-schema/automations names them, which the app's generator roots.
import type { ItemWord } from '../../item';

export interface ItemOperation {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  segment: string;
  tag: string;
  summary: string;
  auth: 'public' | 'guest-or-clerk' | 'clerk';
  tokenUsable?: boolean;
  query?: { name: string; required: boolean; description: string }[];
  requestSchema?: string;
  responseSchema?: string;
  statuses: number[];
}

export interface ItemOperationsInput {
  // The collection the items are served under: `documents`, `designs`.
  collection: string;
  itemWord: ItemWord;
  // The item id's name in the public doors' paths; `<itemWord>Id` by default.
  itemParam?: string;
}

export const AUTOMATIONS_TAG = 'Automations';

/** The tag's line in the document. */
export const automationsTagDescription = (itemWord: ItemWord): string =>
  `Rules a ${itemWord} runs on its own: when something happens, if some conditions hold, then do these steps.`;

type Editor = Pick<ItemOperation, 'method' | 'path' | 'summary' | 'statuses'> &
  Pick<Partial<ItemOperation>, 'requestSchema' | 'responseSchema' | 'query'>;

export function itemAutomationOperations(input: ItemOperationsInput): ItemOperation[] {
  const { collection, itemWord: item } = input;
  const itemParam = input.itemParam ?? `${item.toLowerCase()}Id`;
  const base = `/${collection}/{id}/automations`;
  // Who may call the Editor's routes, said once.
  const editors = `Needs edit access to the whole ${item}, signed in or through that person’s API token (a read-only token only reads); never a link to one tab.`;
  const editor = (route: Editor): ItemOperation => ({
    segment: collection,
    tag: AUTOMATIONS_TAG,
    auth: 'clerk',
    tokenUsable: true,
    ...route,
    summary: `${route.summary} ${editors}`,
  });
  return [
    editor({
      method: 'GET',
      path: base,
      summary: `The ${item}'s rules in their order, each with its last run, its next time, its runs this week, its failures in a row and what it names that the ${item} lacks; and the runs today against the ${item}'s fixed 1,000 a day.`,
      responseSchema: 'AutomationsListResponse',
      statuses: [200, 401, 403, 404, 405, 410],
    }),
    editor({
      method: 'POST',
      path: base,
      summary:
        'Make a rule, last in the list: on once it has a step. Up to 50 rules, names unique. A token may not save a rule holding Revert to Snapshot (403 automation_needs_a_person), nor name a connection (403 automation_connection_needs_a_person).',
      requestSchema: 'AutomationRuleBody',
      responseSchema: 'AutomationRuleResponse',
      statuses: [201, 400, 401, 403, 404, 409, 410],
    }),
    editor({
      method: 'PUT',
      path: `${base}/{ruleId}`,
      summary:
        "Save a rule's trigger, conditions, steps and details. A sixth snapshot kept for rules is refused (409 automation_snapshots_full); a token keeps the connections a rule names and picks none (403 automation_connection_needs_a_person).",
      requestSchema: 'AutomationRuleBody',
      responseSchema: 'AutomationRuleResponse',
      statuses: [200, 400, 401, 403, 404, 405, 409, 410],
    }),
    editor({
      method: 'DELETE',
      path: `${base}/{ruleId}`,
      summary: 'Delete a rule. Its runs stay in the Audit Trail until they age out.',
      statuses: [204, 401, 403, 404, 405, 410],
    }),
    editor({
      method: 'POST',
      path: `${base}/{ruleId}/toggle`,
      summary:
        'Turn a rule on or off. On clears a pause and its failures; a rule with no step, or with something left to pick, stays off (400).',
      requestSchema: 'AutomationToggleRequest',
      responseSchema: 'AutomationRuleResponse',
      statuses: [200, 400, 401, 403, 404, 405, 410],
    }),
    editor({
      method: 'POST',
      path: `${base}/{ruleId}/duplicate`,
      summary:
        'Copy a rule, off, as "<name> copy". A token may not copy a rule that names a connection (403 automation_connection_needs_a_person).',
      responseSchema: 'AutomationRuleResponse',
      statuses: [201, 401, 403, 404, 405, 409, 410],
    }),
    editor({
      method: 'POST',
      path: `${base}/{ruleId}/run`,
      summary: `Run a Run by Hand rule that is on, now, on a tab or on the ${item} alone. 429 automation_budget_spent past the ${item}’s 1,000 runs a day, 429 automation_runs_used once the owner’s month of automation runs is used (Retry-After until the 1st, UTC), 500 automation_run_failed when the run could not start.`,
      requestSchema: 'AutomationRunNowRequest',
      responseSchema: 'AutomationRunResponse',
      statuses: [200, 400, 401, 403, 404, 405, 409, 410, 429, 500],
    }),
    {
      method: 'POST',
      path: `${base}/{ruleId}/secret`,
      segment: collection,
      tag: AUTOMATIONS_TAG,
      summary: `Make Secret or Regenerate for an Incoming Webhook rule: a new secret, in this answer only and never again, the old one stopped at once. Needs edit access to the whole ${item}, signed in; never an API token or a link to one tab.`,
      auth: 'clerk',
      responseSchema: 'AutomationSecretResponse',
      statuses: [201, 401, 403, 404, 405, 409, 410],
    },
    editor({
      method: 'POST',
      path: `${base}/order`,
      summary: "Set the rules' order: every rule's id, once each.",
      requestSchema: 'AutomationOrderRequest',
      statuses: [204, 400, 401, 403, 404, 405, 410],
    }),
    editor({
      method: 'POST',
      path: `${base}/test`,
      summary:
        'Test Rule: run the rule as the builder holds it, now, changing nothing. Each condition and step answers what it would do.',
      requestSchema: 'AutomationTestRequest',
      responseSchema: 'AutomationRunResponse',
      statuses: [200, 400, 401, 403, 404, 405, 410],
    }),
    editor({
      method: 'POST',
      path: `${base}/draft`,
      summary:
        'Describe a Rule: a rule drafted from a sentence, to open in the builder; nothing is saved. The model sees the tab names and the kinds, never content, people or connections. 422 for a request that is not a rule, 429 past the day’s AI asks, 503 with no model.',
      requestSchema: 'AutomationDraftRequest',
      responseSchema: 'AutomationDraftResponse',
      statuses: [200, 400, 401, 403, 404, 405, 410, 422, 429, 503],
    }),
    editor({
      method: 'GET',
      path: `${base}/runs`,
      summary: 'The Audit Trail: the latest runs, newest first, at most 200.',
      query: [
        { name: 'rule', required: false, description: "Only this rule's runs, by id." },
        {
          name: 'result',
          required: false,
          description: 'Only runs that ended this way: done, failed, skipped, waiting or no_match.',
        },
      ],
      responseSchema: 'AutomationRunsResponse',
      statuses: [200, 401, 403, 404, 405, 410],
    }),
    {
      method: 'GET',
      path: `${base}/summary`,
      segment: collection,
      tag: AUTOMATIONS_TAG,
      summary: `One rule as anyone who may read the ${item} sees it: its trigger, conditions and steps in words, with no address, connection or AI ask. Names the rule by \`rule\` (its id) or \`name\`.`,
      auth: 'guest-or-clerk',
      tokenUsable: true,
      query: [
        { name: 'rule', required: false, description: "The rule's id." },
        { name: 'name', required: false, description: "The rule's name, any case." },
      ],
      responseSchema: 'AutomationSummaryResponse',
      statuses: [200, 401, 403, 404, 405, 410],
    },
    {
      method: 'POST',
      path: `/hooks/automations/{${itemParam}}/{ruleId}`,
      segment: 'hooks',
      tag: AUTOMATIONS_TAG,
      summary:
        "Another tool starts an Incoming Webhook rule. Prove the rule's secret with Authorization: Bearer lwh_… or X-Liveworkspace-Signature: sha256=<hex HMAC-SHA256 of the raw body, keyed with the secret>. JSON only, at most 16 KB; `tab` names a tab by name or id. 60 calls a minute a rule. Every wrong secret, unknown rule or rule turned off answers the same 401.",
      auth: 'public',
      requestSchema: 'AutomationHookRequest',
      responseSchema: 'AutomationHookAccepted',
      statuses: [202, 400, 401, 404, 405, 413, 415, 429],
    },
    {
      method: 'POST',
      path: `/email-optout/{${itemParam}}/{token}`,
      segment: 'email-optout',
      tag: AUTOMATIONS_TAG,
      summary: `Unsubscribe a typed-in address from the ${item}'s rule emails: the one-click POST (RFC 8058) a rule's email names in List-Unsubscribe, and the button on its unsubscribe page. The token is the whole proof; the body is never read. 404 for a token the ${item} never made.`,
      auth: 'public',
      statuses: [200, 404, 405, 429],
    },
  ];
}

// The body schemas the operations name, for the app's generator roots.
export const AUTOMATION_SCHEMA_ROOTS = [
  'AutomationsListResponse',
  'AutomationRuleResponse',
  'AutomationRuleBody',
  'AutomationToggleRequest',
  'AutomationOrderRequest',
  'AutomationTestRequest',
  'AutomationRunNowRequest',
  'AutomationDraftRequest',
  'AutomationDraftResponse',
  'AutomationRunResponse',
  'AutomationRunsResponse',
  'AutomationSummaryResponse',
  'AutomationSecretResponse',
  'AutomationHookRequest',
  'AutomationHookAccepted',
] as const;
