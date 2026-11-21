// liveplanner's Automations routes (docs/specs/026-plan/automations.md, blueprint automations.md "Routes"): the
// platform's client (@liveworkspace/automations-ui/automations-client) over this editor's fetch, headers and
// `/api/projects/:id/automations`, typed with @liveplanner/api-schema. A plan in Offline never calls them (its
// footer opens the gate). A refusal the api names (`automation_*`, with the `path` of the step at fault) throws
// AutomationRefusal, an answer the builder shows rather than an error to report.

import {
  AUTOMATION_ERRORS,
  type AutomationDraftResponse,
  type AutomationRuleBody,
  type AutomationRuleResponse,
  type AutomationRunResponse,
  type AutomationRunsQuery,
  type AutomationRunsResponse,
  type AutomationSecretResponse,
  type AutomationSummaryResponse,
  type AutomationsListResponse,
} from '@liveplanner/api-schema';
import {
  AutomationRefusal,
  createAutomationsClient,
} from '@liveworkspace/automations-ui/automations-client';
import type { AutomationsScope } from '@liveworkspace/automations-ui/kit';
import { API_BASE, apiFetch, apiHeaders, expectOk, expectOkVoid } from '@/lib/api/core';

export { AutomationRefusal };
// Who is asking, about which plan: the items scope's parts (a share link's code rides along). `itemId` is the
// project's id.
export type { AutomationsScope };

const client = createAutomationsClient({
  url: (scope) => `${API_BASE}/projects/${encodeURIComponent(scope.itemId)}/automations`,
  fetch: (url, init) => apiFetch(url, init),
  headers: (scope, body) => apiHeaders(scope.ownerId, { share: scope.shareCode, body }),
  expectOk,
  expectOkVoid,
  errors: AUTOMATION_ERRORS,
  // A test and a run name their card as `item`.
  subject: (item) => ({ item }),
});

export const listAutomations = (scope: AutomationsScope) =>
  client.list(scope) as Promise<AutomationsListResponse>;

export const createRule = (scope: AutomationsScope, rule: AutomationRuleBody) =>
  client.create(scope, rule) as Promise<AutomationRuleResponse>;

export const updateRule = (scope: AutomationsScope, id: string, rule: AutomationRuleBody) =>
  client.update(scope, id, rule) as Promise<AutomationRuleResponse>;

export const toggleRule = (scope: AutomationsScope, id: string, enabled: boolean) =>
  client.toggle(scope, id, enabled) as Promise<AutomationRuleResponse>;

export const duplicateRule = (scope: AutomationsScope, id: string) =>
  client.duplicate(scope, id) as Promise<AutomationRuleResponse>;

export const deleteRule = (scope: AutomationsScope, id: string) => client.remove(scope, id);

export const testRule = (scope: AutomationsScope, rule: AutomationRuleBody, item: string) =>
  client.test(scope, rule, item) as Promise<AutomationRunResponse>;

// Describe a Rule: the person's words drafted into a rule to open in the builder, unsaved and off.
export const draftRule = (scope: AutomationsScope, prompt: string, timeZone: string) =>
  client.draft(scope, prompt, timeZone) as Promise<AutomationDraftResponse>;

export const runRule = (scope: AutomationsScope, id: string, item: string) =>
  client.run(scope, id, item) as Promise<AutomationRunResponse>;

export const listRuns = (scope: AutomationsScope, query: AutomationRunsQuery = {}) =>
  client.runs(scope, query) as Promise<AutomationRunsResponse>;

// Make Secret and Regenerate for an Incoming Webhook rule: the secret, in this answer only.
export const makeHookSecret = (scope: AutomationsScope, id: string) =>
  client.makeSecret(scope, id) as Promise<AutomationSecretResponse>;

/** A rule as a reader sees it (spec "On cards"): by its id (a comment's mark) or its name (a history line's), on a tab
 *  link with its tab. A rule gone throws AutomationRefusal `automation_not_found`. */
export const readRuleSummary = (
  scope: AutomationsScope & { tabId: string | null },
  ask: { ruleId?: string | undefined; name: string },
) => client.summary(scope, ask) as Promise<AutomationSummaryResponse>;
