// Describe a Plan's preview and Make Plan (docs/specs/026-plan/describe-a-plan.md "The preview"; blueprint
// describe-a-plan.md "Editor"): what the person changed, held to the draft's checks, each problem said at its place;
// and the board and the new card types Make Plan adds, made against the plan as it is. Pure: the editor places the
// board and saves the types.

import type { AutomationRuleBody } from './automation/types';
import type { PlanBoardSetup } from './board-model';
import type { ItemTypeDef } from './item-types';
import {
  checkPlanDraft,
  type PlanDraft,
  type PlanDraftPlan,
  keptPlanDraftTypes,
} from './plan-draft';
import {
  planDraftRuleBodies,
  planDraftRuleProblems,
  renameFollows,
  renameInPlanDraftRules,
} from './plan-draft-rules';
import { statusKey } from './status-names';
import { typesOf } from './type-catalogue';

export interface PlanDraftProblem {
  // The place at fault, as checkPlanDraft names it: `title`, `columns.2`, `cardTypes.1.fields.3.options.0`.
  path: string;
  message: string;
}

type Say = (path: string, message: string) => void;

// Each name in a list: an empty one asks for a name, and every one of a name held twice (case and spacing aside) says
// so, the first as well as the second, so neither hides the problem behind its focus ring, each in the same words
// (the name as it was first written).
function names(list: readonly string[], at: (i: number) => string, noun: string, say: Say): void {
  const held = new Map<string, { first: string; count: number }>();
  for (const raw of list) {
    const name = raw.trim();
    const seen = held.get(statusKey(name));
    if (seen) seen.count += 1;
    else held.set(statusKey(name), { first: name, count: 1 });
  }
  for (const [i, raw] of list.entries()) {
    const seen = held.get(statusKey(raw.trim()))!;
    if (!seen.first) say(at(i), `Give this ${noun} a name.`);
    else if (seen.count > 1) say(at(i), `Two ${noun}s are called “${seen.first}”.`);
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
  const rules = draft.rules ?? [];
  names(
    rules.map((r) => r.name),
    (i) => `rules.${i}.name`,
    'rule',
    say,
  );
  if (out.length > 0) return out;
  const checked = checkPlanDraft(draft, plan);
  if (!checked.ok) return [{ path: checked.path, message: checked.message }];
  return planDraftRuleProblems(rules, checked);
}

export type PlanFromDraft =
  | {
      ok: true;
      // The board to place: the draft's title and columns, taking every drafted type (the plan's own where kept).
      setup: PlanBoardSetup;
      // The card types the plan lacks, made as the type editor's Add Type makes them.
      newTypes: ItemTypeDef[];
      // The starter rules, named against the board and types as made, each with whether it is made on.
      rules: { body: AutomationRuleBody; on: boolean }[];
    }
  | { ok: false; path: string; message: string };

/** Make Plan's board, types and rules: the draft checked against the plan, its new statuses given a fresh suffix
 *  (`random`), the types the plan lacks added and the ones it has kept, the board taking them all, and the starter
 *  rules named against them in the person's `timeZone`. */
export function planFromDraft(
  draft: PlanDraft,
  plan: PlanDraftPlan,
  random: () => number = Math.random,
  timeZone = 'UTC',
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
  return {
    ok: true,
    setup: { ...checked.setup, addTypes: [...new Set(ids)] },
    newTypes,
    rules: planDraftRuleBodies(draft.rules ?? [], checked, timeZone),
  };
}

// ---- Renames that follow into the rules -------------------------------------------------------------------------

// The draft's rules with a rename followed, when it should (renameFollows), else as they were.
function followed(
  draft: PlanDraft,
  kind: 'column' | 'type' | 'field',
  all: readonly string[],
  at: number,
  name: string,
): PlanDraft['rules'] {
  const rules = draft.rules;
  if (!rules?.length || !renameFollows(all, at, name)) return rules;
  return renameInPlanDraftRules(rules, kind, all[at]!, name);
}

const withRules = (draft: PlanDraft, rules: PlanDraft['rules']): PlanDraft =>
  rules ? { ...draft, rules } : draft;

/** Column `i` renamed, the starter rules that name it following. */
export function withColumnName(draft: PlanDraft, i: number, name: string): PlanDraft {
  const rules = followed(draft, 'column', draft.columns, i, name);
  return withRules({ ...draft, columns: draft.columns.map((c, k) => (k === i ? name : c)) }, rules);
}

/** Card type `i` renamed, the starter rules that name it following. */
export function withTypeName(draft: PlanDraft, i: number, name: string): PlanDraft {
  const all = draft.cardTypes.map((t) => t.name);
  const rules = followed(draft, 'type', all, i, name);
  return withRules(
    { ...draft, cardTypes: draft.cardTypes.map((t, k) => (k === i ? { ...t, name } : t)) },
    rules,
  );
}

/** Field `j` of card type `i` renamed, the starter rules that name it following: a rule names a field by its name
 *  alone, so the name must be its alone across every type. */
export function withFieldName(draft: PlanDraft, i: number, j: number, name: string): PlanDraft {
  const all: string[] = [];
  let at = -1;
  for (const [ti, t] of draft.cardTypes.entries())
    for (const [fj, f] of t.fields.entries()) {
      if (ti === i && fj === j) at = all.length;
      all.push(f.name);
    }
  const rules = at < 0 ? draft.rules : followed(draft, 'field', all, at, name);
  return withRules(
    {
      ...draft,
      cardTypes: draft.cardTypes.map((t, k) =>
        k === i ? { ...t, fields: t.fields.map((f, x) => (x === j ? { ...f, name } : f)) } : t,
      ),
    },
    rules,
  );
}
