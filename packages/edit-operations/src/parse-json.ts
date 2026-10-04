// The JSON form, one object an operation, checked member by member
// (docs/specs/024-agents/blueprints/edit-operations.md "Interfaces and contracts"). Unknown members
// are refused, booleans are `true` only (`false` reads as absent), and the operation count is
// capped before anything is read.

import { CHANGESET_MAX_OPERATIONS, type EditRejection } from '@livediagram/api-schema';
import { notAppliedOperation, parseError, tooLarge, unknownOperation } from './rejections';
import type { EditOperation, FieldValue, ParseOutcome } from './types';
import {
  APPLIED_OPERATION_NAMES,
  EDIT_MAX_ERRORS,
  EDIT_OPERATION_NAMES,
  OPERATION_MEMBERS,
  type AppliedOperationName,
} from './vocabulary';

type Raw = Record<string, unknown>;

const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);

const isOneOf = <T extends string>(names: readonly T[], word: string): word is T =>
  (names as readonly string[]).includes(word);

const expected = (member: string, what: string) => `member "${member}": expected ${what}`;

// The rule a member breaks, or null.
function memberIssue(raw: Raw, member: string): string | null {
  const value = raw[member];
  switch (member) {
    case 'target':
      return typeof value === 'string' && value !== ''
        ? null
        : expected(member, 'a non-empty string');
    case 'fields':
    case 'element':
      return isObject(value) ? null : expected(member, 'an object');
    default:
      return typeof value === 'boolean' ? null : expected(member, 'true or false');
  }
}

const REQUIRED: Readonly<Record<AppliedOperationName, readonly string[]>> = {
  add: ['element'],
  set: ['target', 'fields'],
  rm: ['target'],
};

function flags(raw: Raw, names: readonly ('all' | 'keepArrows')[]) {
  return Object.fromEntries(names.filter((name) => raw[name] === true).map((name) => [name, true]));
}

function build(name: AppliedOperationName, raw: Raw): EditOperation {
  switch (name) {
    case 'add':
      return { op: 'add', element: raw.element as Raw };
    case 'set':
      return {
        op: 'set',
        target: raw.target as string,
        fields: raw.fields as Record<string, FieldValue>,
        ...flags(raw, ['all']),
      };
    case 'rm':
      return { op: 'rm', target: raw.target as string, ...flags(raw, ['all', 'keepArrows']) };
  }
}

// One JSON form operation, or its refusal. `operation` is its 1-based position.
export function validateEditOperation(
  raw: unknown,
  operation: number,
): EditOperation | EditRejection {
  if (!isObject(raw)) return parseError(operation, 'expected an object with an "op" member');
  if (typeof raw.op !== 'string') return parseError(operation, expected('op', 'a string'));
  if (!isOneOf(EDIT_OPERATION_NAMES, raw.op)) return unknownOperation(raw.op, operation);
  if (!isOneOf(APPLIED_OPERATION_NAMES, raw.op)) return notAppliedOperation(raw.op, operation);
  const name = raw.op;
  const members = OPERATION_MEMBERS[name];
  for (const member of Object.keys(raw)) {
    if (members.includes(member)) continue;
    if (name === 'add' && member === 'kind')
      return parseError(
        operation,
        'add with a kind arrives with the full engine; this build takes add with an element',
      );
    return parseError(
      operation,
      `unknown member "${member}"; ${name} takes ${members.filter((m) => m !== 'op').join(', ')}`,
    );
  }
  for (const member of members.slice(1)) {
    const required = REQUIRED[name].includes(member);
    if (!required && raw[member] === undefined) continue;
    const issue = memberIssue(raw, member);
    if (issue) return parseError(operation, issue);
  }
  return build(name, raw);
}

// The JSON form of a changeset's operations: every operation, or up to EDIT_MAX_ERRORS refusals.
export function validateEditOperations(input: readonly unknown[]): ParseOutcome {
  if (input.length > CHANGESET_MAX_OPERATIONS) return { errors: [tooLarge(input.length)] };
  const operations: EditOperation[] = [];
  const errors: EditRejection[] = [];
  for (const [index, raw] of input.entries()) {
    const result = validateEditOperation(raw, index + 1);
    if ('code' in result) errors.push(result);
    else operations.push(result);
    if (errors.length === EDIT_MAX_ERRORS) break;
  }
  return errors.length ? { errors } : { operations };
}
