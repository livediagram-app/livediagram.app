// A Form tab as the api reads it (docs/specs/030-forms/blueprints/forms.md §11): its form, the boards its destination
// names, and the backdrop its form page draws on.
import { tabKindOf } from '@liveplanner/project';
import {
  destinationProblem,
  readForm,
  type DestinationProblem,
  type FormDefinition,
} from '@liveplanner/forms';
import { normaliseBoardSetup, type ItemTypeDef, type PlanBoardSetup } from '@liveplanner/items';
import { planHasTab, getTab, liveFormLinksOf, readSheetHead, setFormLinkOpen } from '../db';
import type { FormSheetDestination } from '@liveplanner/forms';
import type { PlanEnv, TabDTO } from '../types';

type FormTab = { tab: TabDTO; form: FormDefinition };

// The project's Form tab and its form; null when the tab is gone, is no Form tab, or holds no form.
export async function readFormTab(
  env: PlanEnv,
  projectId: string,
  tabId: string,
): Promise<FormTab | null> {
  const tab = await getTab(env, projectId, tabId);
  if (!tab || tabKindOf(tab) !== 'form') return null;
  const form = readForm(tab.form);
  return form ? { tab, form } : null;
}

// The boards on a tab of the project (none when it is gone or holds none).
export async function boardsOnTab(
  env: PlanEnv,
  projectId: string,
  tabId: string,
): Promise<PlanBoardSetup[]> {
  const tab = await getTab(env, projectId, tabId);
  if (!tab || tabKindOf(tab) !== 'board') return [];
  const boards: PlanBoardSetup[] = [];
  for (const el of tab.elements ?? []) {
    const raw = (el as { planBoard?: unknown }).planBoard;
    const setup = raw === undefined ? null : normaliseBoardSetup(raw);
    if (setup) boards.push(setup);
  }
  return boards;
}

// Whether a Sheet destination still holds: its sheet on its tab, and that tab still in the project (a deleted Sheet
// tab can leave its sheet behind until it is swept, and a row written there is never seen).
export async function sheetOnItsTab(
  env: PlanEnv,
  projectId: string,
  sheet: FormSheetDestination,
): Promise<boolean> {
  const head = await readSheetHead(env, projectId, sheet.sheetId);
  return (
    !!head && head.tabId === sheet.tabId && (await planHasTab(env, projectId, sheet.tabId))
  );
}

// Why responses could not land now, or null when they can (docs/specs/030-forms/forms.md "Responses to a Sheet",
// "Publishing and the form link"): the sheet gone from its tab, or the board destination's problem.
export async function responsesProblem(
  env: PlanEnv,
  projectId: string,
  form: FormDefinition,
  types: readonly ItemTypeDef[],
): Promise<DestinationProblem | 'sheet_missing' | null> {
  if (form.sheet) {
    return (await sheetOnItsTab(env, projectId, form.sheet)) ? null : 'sheet_missing';
  }
  const boards = form.destination ? await boardsOnTab(env, projectId, form.destination.tabId) : [];
  return destinationProblem(form.destination, boards, types);
}

// A board or sheet tab deleted (docs/specs/030-forms/forms.md "Publishing and the form link"): each live form whose
// responses went there stops taking responses (its link closed, never deleted), as they would have nowhere to go. It
// opens again only once it has somewhere to send them. Answers how many.
export async function pauseFormsFeeding(
  env: PlanEnv,
  projectId: string,
  tabId: string,
): Promise<number> {
  let paused = 0;
  for (const link of await liveFormLinksOf(env, projectId)) {
    if (link.tab_id === tabId) continue;
    const found = await readFormTab(env, projectId, link.tab_id);
    const to = found?.form.sheet?.tabId ?? found?.form.destination?.tabId;
    if (to !== tabId) continue;
    await setFormLinkOpen(env, link.code, false);
    console.info('[forms] form.paused.destination_deleted', { projectId });
    paused += 1;
  }
  return paused;
}
