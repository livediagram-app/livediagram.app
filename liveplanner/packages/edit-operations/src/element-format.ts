// The element format as an agent writes it (docs/specs/015-api/blueprints/cli.md CLI73): the kinds a Plan tab holds,
// and for one kind what it is and the stored fields `set` and `test` take by name. Read off the engine's own lists
// (./plan-elements), so it says what the engine accepts.

import { ELEMENT_FIELD_VALUES } from '@liveplanner/project';
import {
  PLAN_COMMON_FIELDS,
  PLAN_ELEMENT_ABOUT,
  PLAN_ELEMENT_KINDS,
  PLAN_KIND_FIELDS,
  isPlanElementKind,
} from './plan-elements';

export const SCHEMA_KIND_MAX_TOKENS = 300;

// Every kind `add` takes.
export function addableKinds(): string[] {
  return [...PLAN_ELEMENT_KINDS];
}

export function elementKindsText(): string {
  return [
    'Element kinds a tab holds: liveplanner schema <kind> shows its fields.',
    ...PLAN_ELEMENT_KINDS.map((kind) => `  ${kind}: ${PLAN_ELEMENT_ABOUT[kind]}`),
    'Each is { "type": "shape", "shape": <kind>, … }. Cards, cells and form questions have their own commands.',
  ].join('\n');
}

// A field with a closed list of values, with the list.
const fieldText = (field: string) =>
  ELEMENT_FIELD_VALUES[field] ? `${field} (${ELEMENT_FIELD_VALUES[field].join('|')})` : field;

// One kind's format, or null for a kind no tab holds.
export function elementFormatText(kind: string): string | null {
  if (!isPlanElementKind(kind)) return null;
  const chart = kind.endsWith('-chart');
  return [
    `${kind}: ${PLAN_ELEMENT_ABOUT[kind]}.`,
    `add: {"op":"add","element":{"type":"shape","shape":"${kind}",…}}`,
    'Its own fields:',
    `  ${PLAN_KIND_FIELDS[kind].map(fieldText).join(' ')}`,
    'And every element’s:',
    `  ${PLAN_COMMON_FIELDS.join(' ')}`,
    chart
      ? 'chartSource { "sheetId", "range" } names the cells it draws; a chart needs one.'
      : null,
    'set <selector> key=value… changes them; key= unsets one. view=show prints what it holds.',
  ]
    .filter((line) => line !== null)
    .join('\n');
}
