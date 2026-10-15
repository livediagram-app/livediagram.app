// A Form tab as the api reads it (docs/specs/030-forms/blueprints/forms.md §11): its form, the boards its destination
// names, and the backdrop its form page draws on.
import { getBuiltInTheme, tabKindOf } from '@livediagram/document';
import { readForm, type FormDefinition } from '@livediagram/forms';
import { normaliseBoardSetup, type PlanBoardSetup } from '@livediagram/items';
import type { FormBackdrop } from '@livediagram/api-schema';
import { getTab } from '../db';
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

// The tab theme's backdrop, light and dark (a custom theme draws the default's, as the spec says).
export function formBackdrop(tab: Pick<TabDTO, 'theme'>): FormBackdrop {
  return {
    light: getBuiltInTheme(tab.theme, 'light').backgroundColor,
    dark: getBuiltInTheme(tab.theme, 'dark').backgroundColor,
  };
}
