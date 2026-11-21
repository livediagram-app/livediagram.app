// An item's Automations routes as its editor calls them (blueprint item-ui.md "The helper"; item-engine.md
// "Routes"): stage 3's client with the refusals an item's routes answer and a subject that is a tab. Test Rule sends
// `{ rule, tab? }`, Run Rule `{ tab? }`. Light: the host's plumbing holds it at first load.

import {
  AUTOMATION_ERRORS,
  type AutomationListedRule,
  type AutomationRunNowRequest,
  type AutomationTestRequest,
} from '@liveworkspace/api-schema/automations';
import type { ItemRef, ItemRule, ItemRuleBody, ItemRun } from '@liveworkspace/automations/item';
import {
  createAutomationsClient,
  type AutomationsApi,
  type AutomationsClient,
} from '../automations-client';
import type { AutomationsScope } from '../kit';

/** A rule as an item's list answers it: what it needs is a reference (a tab, a snapshot, a connection). */
export type ItemListedRule = AutomationListedRule<ItemRule, ItemRef>;

export type ItemAutomationsClient = AutomationsClient<ItemRuleBody, ItemListedRule, ItemRun>;

/** What an app hands in to reach its routes. */
export interface ItemAutomationsApi {
  /** The item's Automations address, no trailing slash: `…/<items>/<id>/automations`. */
  base: (scope: AutomationsScope) => string;
  fetch: AutomationsApi['fetch'];
  headers: AutomationsApi['headers'];
  /** The app's reading of an answer (its own error for anything but 2xx). */
  expectOk: AutomationsApi['expectOk'];
  expectOkVoid: AutomationsApi['expectOkVoid'];
}

/** The codes an item's routes refuse with: the engine's, and a tab the item lacks (Test Rule, Run Rule). */
export const ITEM_AUTOMATION_ERRORS: readonly string[] = [...AUTOMATION_ERRORS, 'tab_not_found'];

/** How a test and a run name the tab they run on (`AutomationTestRequest`, `AutomationRunNowRequest`): none for
 *  the item alone. */
export function tabSubject(tab: string | null): { tab?: string } {
  const named: AutomationRunNowRequest & Pick<AutomationTestRequest<unknown>, 'tab'> = tab
    ? { tab }
    : {};
  return { ...named };
}

export function createItemAutomationsClient(api: ItemAutomationsApi): ItemAutomationsClient {
  return createAutomationsClient<ItemRuleBody, ItemListedRule, ItemRun>({
    url: api.base,
    fetch: api.fetch,
    headers: api.headers,
    expectOk: api.expectOk,
    expectOkVoid: api.expectOkVoid,
    errors: ITEM_AUTOMATION_ERRORS,
    subject: tabSubject,
  });
}
