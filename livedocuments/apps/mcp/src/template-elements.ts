// Elements given with a template on create_document / add_tab (docs/specs/015-api/mcp-server.md §4.3):
// the template builds the tab, then the elements are added to it as update_document's `add` ops would add
// them, so a page template (blank-infographic, blank-slide-deck, ...) holds them instead of dropping them.
import type { ChangesetResponse, TabResponse } from '@livedocuments/api-schema';
import type { Tab } from '@livedocuments/document';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { apiJson } from './api';
import { baseFor, submitChangeset, mcpOpsToEditOperations } from './changeset-client';
import { elementsIssue } from './element-values';
import { packFreehandPoints } from './freehand-points';
import { templateAddOperations } from '@liveworkspace/mcp-kit/template-elements';

// The add operations for the elements, checked as every other element input is, or what is wrong with
// them. Checked against the tab the template built, so an arrow may pin to one of its elements
// (@liveworkspace/mcp-kit/template-elements holds the flow every product shares).
export function addOperationsFor(
  elements: readonly unknown[],
  built: Tab,
): { operations: unknown[] } | { error: string } {
  return templateAddOperations(elements, built, {
    pack: packFreehandPoints,
    issue: elementsIssue,
    toOperations: mcpOpsToEditOperations,
  });
}

// Adds them to the stored tab in one changeset, based on the tab as it is now.
export function addToTemplateTab(
  env: Env,
  token: string,
  documentId: string,
  tabId: string,
  stored: Tab & { rev: number },
  operations: unknown[],
): Promise<ChangesetResponse> {
  return submitChangeset(env, token, documentId, tabId, {
    operations,
    base: baseFor([], stored),
  });
}

// The tab as the api now stores it.
export async function getTab(
  env: Env,
  token: string,
  documentId: string,
  tabId: string,
): Promise<TabResponse['tab']> {
  const { tab } = await apiJson<TabResponse>(
    env,
    token,
    `/documents/${encodeURIComponent(documentId)}/tabs/${encodeURIComponent(tabId)}`,
  );
  return tab;
}
