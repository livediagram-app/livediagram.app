// A Form tab as the api reads it (docs/specs/030-forms/blueprints/forms.md §11): its form, the boards that show its
// destination's cards, and the backdrop its form page draws on.
import { tabKindOf } from '@liveplanner/project';
import {
  destinationProblem,
  readForm,
  type DestinationProblem,
  type FormDefinition,
} from '@liveplanner/forms';
import { normaliseBoardSetup, type ItemTypeDef, type PlanBoardSetup } from '@liveplanner/items';
import {
  planHasTab,
  getTab,
  liveFormLinksOf,
  readSheetHead,
  setFormLinkOpen,
  tabBodiesWithBoards,
} from '../db';
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

const setupsOf = (elements: readonly unknown[] | undefined): PlanBoardSetup[] => {
  const boards: PlanBoardSetup[] = [];
  for (const el of elements ?? []) {
    const raw = (el as { planBoard?: unknown }).planBoard;
    const setup = raw === undefined ? null : normaliseBoardSetup(raw);
    if (setup) boards.push(setup);
  }
  return boards;
};

// The boards on a tab of the project (none when it is gone or holds none).
export async function boardsOnTab(
  env: PlanEnv,
  projectId: string,
  tabId: string,
): Promise<PlanBoardSetup[]> {
  const tab = await getTab(env, projectId, tabId);
  if (!tab || tabKindOf(tab) !== 'board') return [];
  return setupsOf(tab.elements);
}

// Tabs read per query, as the plan route reads them.
const BOARD_TAB_BATCH = 20;

// Every board of the plan, in tab order: only the tabs holding one are read, a batch at a time.
export async function planBoards(env: PlanEnv, projectId: string): Promise<PlanBoardSetup[]> {
  const boards: PlanBoardSetup[] = [];
  for (let offset = 0; ; offset += BOARD_TAB_BATCH) {
    const page = await tabBodiesWithBoards(env, projectId, offset, BOARD_TAB_BATCH);
    for (const tab of page) boards.push(...setupsOf(tab.elements));
    if (page.length < BOARD_TAB_BATCH) return boards;
  }
}

// The boards a board form's destination is judged against (docs/specs/030-forms/forms.md "Responses Go To"): every
// board of the plan, as a card shows on whichever takes its type. The tab the destination was last seen on is read
// first and alone answers while its cards still show there and the form has no card type rules (which may name any
// board's type), so the usual response reads one tab, as it always did, however many boards the plan holds.
export async function destinationBoards(
  env: PlanEnv,
  projectId: string,
  form: Pick<FormDefinition, 'destination'>,
  types: readonly ItemTypeDef[],
): Promise<PlanBoardSetup[]> {
  const dest = form.destination;
  if (!dest) return [];
  if (dest.tabId && !dest.typeRules) {
    const home = await boardsOnTab(env, projectId, dest.tabId);
    if (!destinationProblem(dest, home, types)) return home;
  }
  return planBoards(env, projectId);
}

// Whether a Sheet destination still holds: its sheet on its tab, and that tab still in the project (a deleted Sheet
// tab can leave its sheet behind until it is swept, and a row written there is never seen).
export async function sheetOnItsTab(
  env: PlanEnv,
  projectId: string,
  sheet: FormSheetDestination,
): Promise<boolean> {
  const head = await readSheetHead(env, projectId, sheet.sheetId);
  return !!head && head.tabId === sheet.tabId && (await planHasTab(env, projectId, sheet.tabId));
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
  return destinationProblem(
    form.destination,
    await destinationBoards(env, projectId, form, types),
    types,
  );
}

// A board or sheet tab deleted (docs/specs/030-forms/forms.md "Publishing and the form link"): each live form whose
// responses now have nowhere to go stops taking them (its link closed, never deleted). A sheet form's sheet was on
// that tab; a board form pauses only when no board left in the plan shows its cards, so deleting one of two boards
// that show them pauses nothing. It opens again only once it has somewhere to send them. Answers how many.
export async function pauseFormsFeeding(
  env: PlanEnv,
  projectId: string,
  tabId: string,
  types: readonly ItemTypeDef[],
): Promise<number> {
  let paused = 0;
  // Read once, and only when a board form is live: every form is judged against the same boards.
  let boards: PlanBoardSetup[] | null = null;
  for (const link of await liveFormLinksOf(env, projectId)) {
    if (link.tab_id === tabId) continue;
    const found = await readFormTab(env, projectId, link.tab_id);
    if (!found) continue;
    const { form } = found;
    if (form.sheet) {
      if (form.sheet.tabId !== tabId) continue;
    } else {
      if (!form.destination) continue;
      boards ??= await planBoards(env, projectId);
      if (!destinationProblem(form.destination, boards, types)) continue;
    }
    await setFormLinkOpen(env, link.code, false);
    console.info('[forms] form.paused.destination_deleted', { projectId });
    paused += 1;
  }
  return paused;
}
