// What every form verb reads first (docs/specs/030-forms/forms.md "Agents", blueprint §15 "Engine flow"): the
// document's tabs in order with their bodies, its card types and column names, in parallel, once a call; and a Form
// tab's link when the verb needs its state.
import type { ApiClient } from '@livediagram/api-client';
import type {
  DocumentResponse,
  FormLinkResponse,
  PlanResponse,
  PlanStatusName,
  TabResponse,
} from '@livediagram/api-schema';
import type { Tab } from '@livediagram/document';
import type { ItemTypeDef } from '@livediagram/items';
import { planPath } from '../plan/plan-state';
import { tabPath } from '../verbs/shared';

export type WorldTab = Tab & { rev: number };

export interface FormWorld {
  documentId: string;
  documentName: string;
  // Every tab with its body, in the document's order.
  tabs: WorldTab[];
  types: readonly ItemTypeDef[];
  statuses: readonly PlanStatusName[];
  itemTypesRev: number;
}

export const formLinkPath = (documentId: string, tabId: string) =>
  `${tabPath(documentId, tabId)}/form-link`;

export async function readFormWorld(api: ApiClient, documentId: string): Promise<FormWorld> {
  const [{ document }, plan] = await Promise.all([
    api.json<DocumentResponse>(`/documents/${encodeURIComponent(documentId)}`),
    api.json<PlanResponse>(planPath(documentId)),
  ]);
  const ordered = [...document.tabs].sort((a, b) => a.orderIndex - b.orderIndex);
  const tabs = await Promise.all(
    ordered.map(async (t) => (await api.json<TabResponse>(tabPath(documentId, t.id))).tab),
  );
  return {
    documentId,
    documentName: document.name,
    tabs: tabs as WorldTab[],
    types: plan.types,
    statuses: plan.statuses,
    itemTypesRev: plan.itemTypesRev,
  };
}

// The link of a Form tab as its reader may see it (the code only for an Editor); null when the api will not say.
export async function readFormLink(
  api: ApiClient,
  documentId: string,
  tabId: string,
): Promise<FormLinkResponse | null> {
  try {
    return await api.json<FormLinkResponse>(formLinkPath(documentId, tabId));
  } catch {
    return null;
  }
}
