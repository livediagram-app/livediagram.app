// What a value is called: the catalogue's labels, a template's from the host, and a team's name in place of its
// id. One place, so chips, pills and suggestions agree.

import {
  FIXED_VALUES,
  SPACE_FIXED_VALUES,
  SPACE_TEAM_PREFIX,
  VALUE_LABELS,
  type LensDimension,
} from './dimensions';
import type { LensContext, LensOption } from './types';

const UNKNOWN_TEAM_LABEL = 'Unknown team';
const TEAM_NAME_ORDER = new Intl.Collator('en-GB');

/** The label of a value; a team reads by its name and never by its id. */
export function valueLabel(
  dimension: LensDimension,
  value: string,
  context: Pick<LensContext, 'teams' | 'templates'>,
): string {
  if (dimension === 'space' && value.startsWith(SPACE_TEAM_PREFIX)) {
    const id = value.slice(SPACE_TEAM_PREFIX.length);
    return context.teams.find((team) => team.id === id)?.name ?? UNKNOWN_TEAM_LABEL;
  }
  if (dimension === 'template') {
    return context.templates.find((t) => t.value === value)?.label ?? value;
  }
  const labels: Readonly<Record<string, string>> = VALUE_LABELS[dimension];
  return labels[value] ?? value;
}

/** Every value a dimension offers, in catalogue order; teams follow the fixed spaces, by name A to Z. */
export function valueOptions(
  dimension: LensDimension,
  context: Pick<LensContext, 'teams' | 'templates'>,
): LensOption[] {
  if (dimension === 'template') return [...context.templates];
  if (dimension !== 'space') {
    return FIXED_VALUES[dimension].map((value) => ({
      value,
      label: valueLabel(dimension, value, context),
    }));
  }
  const byName = context.teams.toSorted((a, b) => TEAM_NAME_ORDER.compare(a.name, b.name));
  return [
    ...SPACE_FIXED_VALUES.map((value) => ({ value, label: valueLabel('space', value, context) })),
    ...byName.map((team) => ({ value: `${SPACE_TEAM_PREFIX}${team.id}`, label: team.name })),
  ];
}
