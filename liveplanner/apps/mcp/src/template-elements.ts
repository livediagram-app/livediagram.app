// Elements given with a template on create_project / add_tab (docs/specs/015-api/mcp-server.md §4.3):
// the template builds the tab, then the elements are added to it as update_project's `add` ops would add
// them, so a Board or Sheet template's tab holds them instead of dropping them.
import type { ChangesetResponse, TabResponse } from '@liveplanner/api-schema';
import type { Tab } from '@liveplanner/project';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { apiJson } from './api';
import { baseFor, submitChangeset, mcpOpsToEditOperations } from './changeset-client';
import { elementsIssue } from './element-values';
import { templateAddOperations } from '@liveworkspace/mcp-kit/template-elements';

// The add operations for the elements, checked as every other element input is, or what is wrong with
// them, checked against the tab the template built (@liveworkspace/mcp-kit/template-elements holds the flow
// every product shares).
export function addOperationsFor(
  elements: readonly unknown[],
  built: Tab,
): { operations: unknown[] } | { error: string } {
  return templateAddOperations(elements, built, {
    issue: elementsIssue,
    toOperations: mcpOpsToEditOperations,
  });
}

// Adds them to the stored tab in one changeset, based on the tab as it is now.
export function addToTemplateTab(
  env: Env,
  token: string,
  projectId: string,
  tabId: string,
  stored: Tab & { rev: number },
  operations: unknown[],
): Promise<ChangesetResponse> {
  return submitChangeset(env, token, projectId, tabId, {
    operations,
    base: baseFor([], stored),
  });
}

// The tab as the api now stores it.
export async function getTab(
  env: Env,
  token: string,
  projectId: string,
  tabId: string,
): Promise<TabResponse['tab']> {
  const { tab } = await apiJson<TabResponse>(
    env,
    token,
    `/projects/${encodeURIComponent(projectId)}/tabs/${encodeURIComponent(tabId)}`,
  );
  return tab;
}

// A dashboard makes the whole tab, so a template or elements beside it would be dropped: refused instead.
export const DASHBOARD_ALONE =
  'A "dashboard" makes the whole tab: give it alone, not with "template" or "elements". Put the elements ' +
  'on a tab of their own.';
