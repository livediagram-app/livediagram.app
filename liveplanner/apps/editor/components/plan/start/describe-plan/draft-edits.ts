// The parts of Describe a Plan's preview edits (docs/specs/026-plan/describe-a-plan.md "The preview"): the names a new
// column, field, option or type starts with, a field's kind changed, and the problems by place. Pure.

import {
  PLAN_DRAFT_COLOURS,
  type PlanDraft,
  type PlanDraftField,
  type PlanDraftFieldKind,
  type PlanDraftProblem,
} from '@liveplanner/items';

/** `base`, or `base 2`, `base 3`… the first not among `taken` (case aside). */
export function freshName(base: string, taken: readonly string[]): string {
  const used = new Set(taken.map((t) => t.trim().toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) if (!used.has(`${base} ${n}`.toLowerCase())) return `${base} ${n}`;
}

const OPTION_KINDS: readonly PlanDraftFieldKind[] = ['choice', 'multichoice'];
export const holdsOptions = (kind: PlanDraftFieldKind) => OPTION_KINDS.includes(kind);

/** A field given another kind: a Choice keeps its options, and gains a first one when it had none; any other kind
 *  holds none. */
export function withKind(field: PlanDraftField, kind: PlanDraftFieldKind): PlanDraftField {
  if (!holdsOptions(kind)) return { name: field.name, kind };
  const options = field.options?.length ? field.options : ['Option 1'];
  return { name: field.name, kind, options };
}

/** A new card type for Add Type: named apart from the others, the next colour, the star. */
export function newDraftType(draft: PlanDraft): PlanDraft['cardTypes'][number] {
  return {
    name: freshName(
      'New Type',
      draft.cardTypes.map((t) => t.name),
    ),
    color: PLAN_DRAFT_COLOURS[draft.cardTypes.length % PLAN_DRAFT_COLOURS.length]!,
    glyph: 'star',
    builtInFields: ['description', 'assignee'],
    fields: [],
  };
}

/** The problems by their place, for each control to read its own. */
export function problemsByPath(problems: readonly PlanDraftProblem[]): ReadonlyMap<string, string> {
  return new Map(problems.map((p) => [p.path, p.message]));
}
