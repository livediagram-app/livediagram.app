// What the chips, the pills and the live region show and announce (docs/specs/013-workspace/
// explorer-filters.md "The field", "Accessibility"). The copy lives here, once.

import {
  DIMENSION_LABELS,
  LENS_DIMENSIONS,
  LENS_MAX_INPUT_LENGTH,
  type LensDimension,
} from './dimensions';
import { valueLabel, valueOptions } from './labels';
import type { LensContext, LensIssue, ParsedLens, TokenState } from './types';

const ANY = 'Any';

export type LensChipOption = { value: string | null; label: string; selected: boolean };

/** One chip. A `multiple` chip lists its values after "Any", each toggled on its own; Made by AI,
 *  a dimension of one value, is a `toggle`. */
export type LensChip = {
  dimension: LensDimension;
  label: string;
  control: 'multiple' | 'toggle';
  values: readonly string[];
  valueLabels: readonly string[];
  name: string;
  options: LensChipOption[];
};

/** One token in the field, applied or muted, with its accessible names. */
export type LensPill = {
  start: number;
  end: number;
  dimension: LensDimension;
  values: readonly string[];
  state: TokenState;
  label: string;
  name: string;
  removeName: string;
  note: string | null;
};

function valueLabels(
  dimension: LensDimension,
  values: readonly string[],
  context: LensContext,
): string[] {
  return values.map((value) => valueLabel(dimension, value, context.teams));
}

/** "Template: Retrospective, Kanban"; Made by AI names itself. */
function tokenLabel(
  dimension: LensDimension,
  values: readonly string[],
  context: LensContext,
): string {
  if (dimension === 'made-by') return DIMENSION_LABELS['made-by'];
  return `${DIMENSION_LABELS[dimension]}: ${valueLabels(dimension, values, context).join(', ')}`;
}

function lensChip(dimension: LensDimension, parsed: ParsedLens, context: LensContext): LensChip {
  const values: readonly string[] = parsed.lens.filters[dimension];
  const label = DIMENSION_LABELS[dimension];
  const toggle = dimension === 'made-by';
  const unsetName = toggle ? label : `${label}, any`;
  return {
    dimension,
    label,
    control: toggle ? 'toggle' : 'multiple',
    values,
    valueLabels: valueLabels(dimension, values, context),
    name: values.length === 0 ? unsetName : tokenLabel(dimension, values, context),
    options: [
      { value: null, label: ANY, selected: values.length === 0 },
      ...valueOptions(dimension, context.teams).map((option) => ({
        ...option,
        selected: values.includes(option.value),
      })),
    ],
  };
}

/** The chips of the current view, each lit by every value its dimension's applied tokens hold. */
export function lensChips(parsed: ParsedLens, context: LensContext): LensChip[] {
  return LENS_DIMENSIONS.filter(
    (dimension) => dimension !== 'space' || context.view === 'aggregate',
  ).map((dimension) => lensChip(dimension, parsed, context));
}

/** The pills of the field: every token, in the string's order. Text and the word being typed are none. */
export function lensPills(parsed: ParsedLens, context: LensContext): LensPill[] {
  return parsed.terms.flatMap((term) => {
    if (term.kind !== 'token') return [];
    const label = tokenLabel(term.dimension, term.values, context);
    const issue = parsed.issues.find((candidate) => candidate.start === term.start);
    const note = issue ? issueMessage(issue) : null;
    return [
      {
        start: term.start,
        end: term.end,
        dimension: term.dimension,
        values: term.values,
        state: term.state,
        label,
        name: note ? `Filter ${label}, not applied: ${note}` : `Filter ${label}`,
        removeName: `Remove filter ${label}`,
        note,
      },
    ];
  });
}

/** The sentence that explains an issue to the reader. */
export function issueMessage(issue: LensIssue): string {
  switch (issue.reason) {
    case 'unknown_dimension':
      return `“${issue.raw}” isn’t a filter, so it’s searched as text.`;
    case 'too_long':
      return `The search is cut to ${LENS_MAX_INPUT_LENGTH} characters.`;
    case 'missing_value':
      return `“${issue.raw}” needs a value, so it’s searched as text.`;
    case 'unknown_value':
      return `“${issue.value}” isn’t a ${DIMENSION_LABELS[issue.dimension]} option, so it’s searched as text.`;
    case 'unknown_team':
      return 'That team isn’t one of yours, so it’s searched as text.';
    case 'space_not_here':
      return 'The breadcrumb sets the space here, so Space filters don’t apply.';
  }
}

/** What the live region says once typing settles. */
export function announceResults(shown: number, total: number): string {
  if (shown === 0) return 'No documents match';
  const noun = total === 1 ? 'document' : 'documents';
  return shown === total ? `${total} ${noun}` : `${shown} of ${total} ${noun}`;
}
