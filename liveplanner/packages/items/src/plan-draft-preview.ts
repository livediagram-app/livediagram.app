// Describe a Plan's preview and Make Plan (docs/specs/026-plan/describe-a-plan.md "The preview"; blueprint
// describe-a-plan.md "Editor"): what the person changed, held to the draft's checks, each problem said at its place;
// and the board and the new card types Make Plan adds, made against the plan as it is. Pure: the editor places the
// board and saves the types.

import type { PlanBoardSetup } from './board-model';
import type { ItemTypeDef } from './item-types';
import {
  checkPlanDraft,
  type PlanDraft,
  type PlanDraftPlan,
  keptPlanDraftTypes,
} from './plan-draft';
import { statusKey } from './status-names';
import { typesOf } from './type-catalogue';

export interface PlanDraftProblem {
  // The place at fault, as checkPlanDraft names it: `title`, `columns.2`, `cardTypes.1.fields.3.options.0`.
  path: string;
  message: string;
}

type Say = (path: string, message: string) => void;

// Each name in a list: an empty one asks for a name, a second of the same name (case and spacing aside) says so.
function names(list: readonly string[], at: (i: number) => string, noun: string, say: Say): void {
  const seen = new Set<string>();
  for (const [i, raw] of list.entries()) {
    const name = raw.trim();
    if (!name) {
      say(at(i), `Give this ${noun} a name.`);
      continue;
    }
    const key = statusKey(name);
    if (seen.has(key)) say(at(i), `Two ${noun}s are called “${name}”.`);
    seen.add(key);
  }
}

/** Every problem in the draft as the person left it, in the preview's order: the names first, each at its place, and
 *  once they all read, whatever checkPlanDraft still finds (a cap, the catalogue's rules). None: Make Plan may go. */
export function planDraftProblems(draft: PlanDraft, plan?: PlanDraftPlan): PlanDraftProblem[] {
  const out: PlanDraftProblem[] = [];
  const say: Say = (path, message) => out.push({ path, message });
  if (!draft.title.trim()) say('title', 'Give the board a name.');
  if (draft.columns.length === 0) say('columns', 'A board needs at least one column.');
  names(draft.columns, (i) => `columns.${i}`, 'column', say);
  if (draft.cardTypes.length === 0) say('cardTypes', 'Keep at least one card type.');
  names(
    draft.cardTypes.map((t) => t.name),
    (i) => `cardTypes.${i}.name`,
    'card type',
    say,
  );
  const kept = keptPlanDraftTypes(draft, plan?.catalogue ?? null);
  for (const [i, t] of draft.cardTypes.entries()) {
    // A kept type is the plan's own and never made: nothing of its draft to fix.
    if (kept.includes(i)) continue;
    names(
      t.fields.map((f) => f.name),
      (j) => `cardTypes.${i}.fields.${j}.name`,
      'field',
      say,
    );
    for (const [j, f] of t.fields.entries())
      if (f.options)
        names(f.options, (k) => `cardTypes.${i}.fields.${j}.options.${k}`, 'option', say);
  }
  if (out.length > 0) return out;
  const checked = checkPlanDraft(draft, plan);
  return checked.ok ? [] : [{ path: checked.path, message: checked.message }];
}

export type PlanFromDraft =
  | {
      ok: true;
      // The board to place: the draft's title and columns, taking every drafted type (the plan's own where kept).
      setup: PlanBoardSetup;
      // The card types the plan lacks, made as the type editor's Add Type makes them.
      newTypes: ItemTypeDef[];
    }
  | { ok: false; path: string; message: string };

/** Make Plan's board and types: the draft checked against the plan, its new statuses given a fresh suffix
 *  (`random`), the types the plan lacks added and the ones it has kept, and the board taking them all. */
export function planFromDraft(
  draft: PlanDraft,
  plan: PlanDraftPlan,
  random: () => number = Math.random,
): PlanFromDraft {
  const checked = checkPlanDraft(draft, plan, random);
  if (!checked.ok) return checked;
  const own = typesOf(plan.catalogue);
  const all = typesOf(checked.catalogue);
  const newTypes = all.filter((t) => !own.some((o) => o.id === t.id));
  // Every drafted type is in the catalogue the check left: kept by its name, or added under it.
  const ids = draft.cardTypes.map(
    (d) => all.find((t) => statusKey(t.label) === statusKey(d.name.trim()))!.id,
  );
  return { ok: true, setup: { ...checked.setup, addTypes: [...new Set(ids)] }, newTypes };
}
