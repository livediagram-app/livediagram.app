// What every form verb reads first (docs/specs/030-forms/forms.md "Agents", blueprint §15 "Engine flow"): the
// document's plan, whose tabs name each tab's kind and a Sheet tab's sheets and whose boards name their columns and
// card types, so no tab body is read but the Form tab's own. One plan read a call, whatever the document's size.
import type { ApiClient } from '@livediagram/api-client';
import type {
  FormLinkResponse,
  PlanResponse,
  PlanStatusName,
  PlanTabOutline,
  TabResponse,
} from '@livediagram/api-schema';
import type { Tab } from '@livediagram/document';
import type { ItemTypeDef } from '@livediagram/items';
import { planPath } from '../plan/plan-state';
import { tabPath } from '../verbs/shared';

export type TabRef = PlanTabOutline;

// A board responses may go to: a Board tab's live board (no All Cards or Archive), as Responses Go To lists them.
export interface BoardRef {
  tabId: string;
  tabName: string;
  elementId: string;
  title: string;
  // The card types it takes by id; null is every type.
  types: string[] | null;
  columns: { status: string; name: string }[];
}

// A sheet responses may go to, named as Responses Go To names it ("Budget", "Budget 2").
export interface SheetRef {
  tabId: string;
  sheetId: string;
  name: string;
}

export interface FormWorld {
  documentId: string;
  tabs: TabRef[];
  boards: BoardRef[];
  sheets: SheetRef[];
  types: readonly ItemTypeDef[];
  statuses: readonly PlanStatusName[];
  itemTypesRev: number;
}

export type FormTabBody = Tab & { rev: number };

export const formLinkPath = (documentId: string, tabId: string) =>
  `${tabPath(documentId, tabId)}/form-link`;

// Each Sheet tab's sheets by the names Responses Go To gives them.
export function sheetRefsOf(tabs: readonly TabRef[]): SheetRef[] {
  return tabs.flatMap((t) =>
    t.kind === 'sheet'
      ? (t.sheetIds ?? []).map((sheetId, i) => ({
          tabId: t.id,
          sheetId,
          name: i === 0 ? t.name : `${t.name} ${i + 1}`,
        }))
      : [],
  );
}

export function worldOf(documentId: string, plan: PlanResponse): FormWorld {
  const tabs = plan.tabs ?? [];
  const boardTabs = new Set(tabs.filter((t) => t.kind === 'board').map((t) => t.id));
  return {
    documentId,
    tabs,
    boards: plan.boards
      .filter((b) => b.kind === 'board' && boardTabs.has(b.tabId) && b.columns.length > 0)
      .map((b) => ({
        tabId: b.tabId,
        tabName: b.tabName,
        elementId: b.elementId,
        title: b.title,
        types: b.types,
        columns: b.columns.map((c) => ({ status: c.status, name: c.name })),
      })),
    sheets: sheetRefsOf(tabs),
    types: plan.types,
    statuses: plan.statuses,
    itemTypesRev: plan.itemTypesRev,
  };
}

export async function readFormWorld(api: ApiClient, documentId: string): Promise<FormWorld> {
  return worldOf(documentId, await api.json<PlanResponse>(planPath(documentId)));
}

export async function readFormTabBody(
  api: ApiClient,
  documentId: string,
  tabId: string,
): Promise<FormTabBody> {
  return (await api.json<TabResponse>(tabPath(documentId, tabId))).tab;
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
