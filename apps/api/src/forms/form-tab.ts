// A Form tab as the api reads it (docs/specs/030-forms/blueprints/forms.md §11): its form, the boards its destination
// names, and the backdrop its form page draws on.
import { tabKindOf } from '@livediagram/document';
import {
  destinationProblem,
  readForm,
  type DestinationProblem,
  type FormDefinition,
} from '@livediagram/forms';
import { normaliseBoardSetup, type ItemTypeDef, type PlanBoardSetup } from '@livediagram/items';
import { documentLinksTab, getTab, readSheetHead } from '../db';
import type { FormSheetDestination } from '@livediagram/forms';
import type { Env, TabDTO } from '../types';

export type FormTab = { tab: TabDTO; form: FormDefinition };

// The document's Form tab and its form; null when the tab is gone, is no Form tab, or holds no form.
export async function readFormTab(
  env: Env,
  documentId: string,
  tabId: string,
): Promise<FormTab | null> {
  const tab = await getTab(env, documentId, tabId);
  if (!tab || tabKindOf(tab) !== 'form') return null;
  const form = readForm(tab.form);
  return form ? { tab, form } : null;
}

// The boards on a tab of the document (none when it is gone or holds none).
export async function boardsOnTab(
  env: Env,
  documentId: string,
  tabId: string,
): Promise<PlanBoardSetup[]> {
  const tab = await getTab(env, documentId, tabId);
  if (!tab || tabKindOf(tab) !== 'board') return [];
  const boards: PlanBoardSetup[] = [];
  for (const el of tab.elements ?? []) {
    const raw = (el as { planBoard?: unknown }).planBoard;
    const setup = raw === undefined ? null : normaliseBoardSetup(raw);
    if (setup) boards.push(setup);
  }
  return boards;
}

// Whether a Sheet destination still holds: its sheet on its tab, and that tab still in the document (a deleted Sheet
// tab can leave its sheet behind until it is swept, and a row written there is never seen).
export async function sheetOnItsTab(
  env: Env,
  documentId: string,
  sheet: FormSheetDestination,
): Promise<boolean> {
  const head = await readSheetHead(env, documentId, sheet.sheetId);
  return (
    !!head && head.tabId === sheet.tabId && (await documentLinksTab(env, documentId, sheet.tabId))
  );
}

// Why responses could not land now, or null when they can (docs/specs/030-forms/forms.md "Responses to a Sheet",
// "Publishing and the form link"): the sheet gone from its tab, or the board destination's problem.
export async function responsesProblem(
  env: Env,
  documentId: string,
  form: FormDefinition,
  types: readonly ItemTypeDef[],
): Promise<DestinationProblem | 'sheet_missing' | null> {
  if (form.sheet) {
    return (await sheetOnItsTab(env, documentId, form.sheet)) ? null : 'sheet_missing';
  }
  const boards = form.destination ? await boardsOnTab(env, documentId, form.destination.tabId) : [];
  return destinationProblem(form.destination, boards, types);
}
