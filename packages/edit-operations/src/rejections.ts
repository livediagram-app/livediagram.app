// Named refusals and their text (docs/specs/024-agents/blueprints/edit-operations.md "Errors and
// edge cases"). Each builder returns the wire `EditRejection`; `formatRejections` prints a block of
// them, ending `nothing was applied`.

import {
  CHANGESET_MAX_OPERATIONS,
  type EditRejection,
  type JsonValue,
} from '@livediagram/api-schema';
import type { Element } from '@livediagram/document';
import { describeElement, kindOf, labelOf, quoteCut } from './element-text';
import { nearestName } from './nearest';
import {
  APPLIED_OPERATION_NAMES,
  DID_YOU_MEAN_MAX_DISTANCE,
  EDIT_OPERATION_NAMES,
  LABEL_CUT_CHARS,
  VALUE_CUT_CHARS,
} from './vocabulary';

// Why an element may not change: its own lock, or the lock of the layer it sits on.
export type LockReason = { scope: 'element' } | { scope: 'layer'; layer: string };

const didYouMean = (word: string, names: readonly string[]) => {
  const near = nearestName(word, names, DID_YOU_MEAN_MAX_DISTANCE);
  return near ? { hint: `did you mean ${near}?` } : {};
};

function shownValue(value: JsonValue): string {
  if (typeof value === 'string') return quoteCut(value, VALUE_CUT_CHARS);
  const json = JSON.stringify(value);
  const points = [...json];
  return points.length <= VALUE_CUT_CHARS ? json : `${points.slice(0, VALUE_CUT_CHARS).join('')}…`;
}

export function tooLarge(count: number): EditRejection {
  return {
    code: 'too_large',
    details: [`${count} operations; the cap is ${CHANGESET_MAX_OPERATIONS}`],
    hint: 'split it into several changesets, or send a replace',
  };
}

export function unknownOperation(word: string, operation: number): EditRejection {
  return {
    code: 'unknown_operation',
    operation,
    details: [`"${word}" is not an operation`, `operations: ${EDIT_OPERATION_NAMES.join(' ')}`],
    ...didYouMean(word, EDIT_OPERATION_NAMES),
  };
}

// A name of the vocabulary this build does not apply yet.
export function notAppliedOperation(word: string, operation: number): EditRejection {
  return {
    code: 'unknown_operation',
    operation,
    details: [
      `"${word}" is not applied by this build: it applies ${APPLIED_OPERATION_NAMES.join(' ')}`,
      'the rest of the vocabulary arrives with the full engine',
    ],
    hint: 'use add, set and rm, or send a replace',
  };
}

export function parseError(operation: number, detail: string): EditRejection {
  return { code: 'parse_error', operation, details: [detail] };
}

// A line that does not parse: where, what was expected, and the line with a caret under the column.
export function lineParseError(
  operation: number,
  line: number,
  text: string,
  column: number,
  expected: string,
): EditRejection & { line: number } {
  const quoting = /key=value|closing|selector/.test(expected);
  return {
    code: 'parse_error',
    operation,
    line,
    column,
    details: [
      `line ${line}, column ${column}: expected ${expected}`,
      text,
      `${' '.repeat(column - 1)}^`,
    ],
    hint: quoting ? 'quote values with spaces: label="Sign in"' : `write ${expected}`,
  };
}

export function unknownField(
  operation: number,
  kind: string,
  key: string,
  fields: readonly string[],
): EditRejection {
  return {
    code: 'unknown_field',
    operation,
    details: [`${kind} has no field "${key}"`, `fields: ${fields.join(' ')}`],
    ...didYouMean(key, fields),
  };
}

export function invalidValue(
  operation: number,
  key: string,
  value: JsonValue,
  rule: string,
  hint?: string,
): EditRejection {
  return {
    code: 'invalid_value',
    operation,
    details: [`${key}=${shownValue(value)}: ${rule}`],
    ...(hint ? { hint } : {}),
  };
}

// The first `<id>-2`, `<id>-3`, … no element holds, the clash rule of slug ids.
function freeIdLike(id: string, taken: ReadonlySet<string>): string {
  let n = 2;
  while (taken.has(`${id}-${n}`)) n++;
  return `${id}-${n}`;
}

export function idTaken(
  operation: number,
  holder: Element,
  taken: ReadonlySet<string>,
): EditRejection {
  const label = labelOf(holder);
  return {
    code: 'id_taken',
    operation,
    details: [
      `id "${holder.id}" is taken by ${kindOf(holder)}${label ? ` ${quoteCut(label, LABEL_CUT_CHARS)}` : ''}`,
    ],
    hint: `use id ${freeIdLike(holder.id, taken)}`,
  };
}

const UNLOCK_HINT = 'unlock it in the editor, or leave it out of the changeset';

export function tabLocked(): EditRejection {
  return { code: 'element_locked', details: ['the tab is locked'], hint: UNLOCK_HINT };
}

export function elementLocked(operation: number, el: Element, lock: LockReason): EditRejection {
  const why = lock.scope === 'element' ? '(element)' : `(layer ${JSON.stringify(lock.layer)})`;
  return {
    code: 'element_locked',
    operation,
    details: ['locked:', `  ${describeElement(el)} ${why}`],
    hint: UNLOCK_HINT,
  };
}

export function invalidResult(
  subject: string,
  kind: string | undefined,
  issue: { field: string; rule: string },
): EditRejection {
  return {
    code: 'invalid_result',
    details: [`${subject} ${issue.field}: ${issue.rule}`],
    hint: kind
      ? `see the format: livediagram schema ${kind}`
      : 'see the format: livediagram schema',
  };
}

function header(rejection: EditRejection): string {
  const parts = [`error ${rejection.code}`];
  if (rejection.line !== undefined) parts.push(`line ${rejection.line}`);
  else if (rejection.operation !== undefined) parts.push(`op ${rejection.operation}`);
  if (rejection.op) parts.push(rejection.op);
  return parts.join(' · ');
}

// The refusal block: each rejection's header, its detail lines and hint indented, then
// `nothing was applied`.
export function formatRejections(errors: readonly EditRejection[]): string[] {
  const lines = errors.flatMap((rejection) => [
    header(rejection),
    ...rejection.details.map((detail) => `  ${detail}`),
    ...(rejection.hint ? [`  hint: ${rejection.hint}`] : []),
  ]);
  return [...lines, 'nothing was applied'];
}
