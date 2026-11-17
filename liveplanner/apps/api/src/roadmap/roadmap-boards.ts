// What a roadmap is made from (docs/specs/026-plan/public-roadmap.md "The settings"; blueprint public-roadmap.md
// "Files"): the plan's boards with their columns and the card types they show, the forms that may be suggestion
// forms, and the plan's type catalogue. Read from the plan's own tables in its room.
import type { RoadmapBoard, RoadmapForm } from '@liveplanner/api-schema';
import type { FormDefinition } from '@liveplanner/forms';
import {
  boardAddTypes,
  normaliseBoardSetup,
  typesOf,
  type ItemTypeDef,
  type PlanBoardSetup,
} from '@liveplanner/items';
import { liveFormLinksOf } from '../db';
import { readFormTab } from '../forms/form-tab';
import { parseTypes } from '../plan-room/plan-cards-push';
import { planTabs } from '../routes/plan-route';
import type { PlanEnv } from '../types';

/** The plan's card type catalogue, read from its row. */
export async function planTypesOf(env: PlanEnv, planId: string): Promise<readonly ItemTypeDef[]> {
  const row = await env.PLAN_DB.prepare('SELECT item_types FROM plan WHERE id = ?')
    .bind(planId)
    .first<{ item_types: string | null }>();
  return typesOf(parseTypes(row?.item_types ?? null));
}

/** The board element `boardId` among `elements` and its set-up, or null when it is not a Plan board there. */
export function boardOnTab(
  elements: readonly unknown[] | undefined,
  boardId: string,
): PlanBoardSetup | null {
  for (const el of elements ?? []) {
    const e = el as { id?: unknown; shape?: unknown; planBoard?: unknown };
    if (e.id !== boardId || e.shape !== 'plan-board') continue;
    return normaliseBoardSetup(e.planBoard);
  }
  return null;
}

/** Whether a board has columns to publish: not an All Cards or archive board. */
export const publishable = (setup: PlanBoardSetup): boolean =>
  !setup.allCards && !setup.archive && setup.columns.length > 0;

/** A board as the dialog lists it. */
export function roadmapBoardOf(
  tab: { id: string; name: string },
  boardId: string,
  setup: PlanBoardSetup,
  types: readonly ItemTypeDef[],
): RoadmapBoard {
  return {
    id: boardId,
    title: setup.title.trim() || 'Board',
    tabId: tab.id,
    tabName: tab.name,
    columns: setup.columns.map((c) => ({ status: c.status, name: c.name, color: c.color ?? null })),
    types: boardAddTypes(setup, types).map((t) => ({
      id: t.id,
      name: t.label,
      glyph: t.glyph,
      color: t.color,
    })),
    publishable: publishable(setup),
  };
}

/** Every Plan board on the plan's tabs, in tab order. */
export async function roadmapBoardsOf(
  env: PlanEnv,
  planId: string,
  types: readonly ItemTypeDef[],
): Promise<RoadmapBoard[]> {
  const boards: RoadmapBoard[] = [];
  for (const tab of await planTabs({ env }, planId, null)) {
    for (const el of tab.elements) {
      const e = el as { id?: unknown; shape?: unknown; planBoard?: unknown };
      if (e.shape !== 'plan-board' || typeof e.id !== 'string') continue;
      const setup = normaliseBoardSetup(e.planBoard);
      if (setup) boards.push(roadmapBoardOf(tab, e.id, setup, types));
    }
  }
  return boards;
}

/** The columns (statuses) a form's cards may land in: its default and each card type rule's. Empty for a form that
 *  sends to a Sheet or nowhere. */
export function formStatusesOf(form: FormDefinition): string[] {
  if (form.sheet || !form.destination) return [];
  const out = new Set([form.destination.status]);
  for (const rule of form.destination.typeRules ?? []) out.add(rule.status);
  return [...out];
}

/** The plan's forms with a live link that send their responses to a board: what Suggest an Idea may name. */
export async function roadmapFormsOf(env: PlanEnv, planId: string): Promise<RoadmapForm[]> {
  const forms: RoadmapForm[] = [];
  for (const link of await liveFormLinksOf(env, planId)) {
    const found = await readFormTab(env, planId, link.tab_id);
    const statuses = found ? formStatusesOf(found.form) : [];
    if (!found || statuses.length === 0) continue;
    forms.push({ code: link.code, heading: found.form.heading, tabName: found.tab.name, statuses });
  }
  return forms;
}

/** Whether a suggestion form would put its cards straight onto the roadmap: any of its columns is a shown one. */
export const landsOnRoadmap = (statuses: readonly string[], columns: readonly string[]): boolean =>
  statuses.some((s) => columns.includes(s));
