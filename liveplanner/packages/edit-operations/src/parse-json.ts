// The JSON form, one object an operation, checked member by member
// (docs/specs/024-agents/blueprints/edit-operations.md "Interfaces and contracts"). Unknown members
// are refused, booleans are `true` only (`false` reads as absent), and the operation count is
// capped before anything is read.

import { CHANGESET_MAX_OPERATIONS, type EditRejection } from '@liveplanner/api-schema';
import { parseError, tooLarge, unknownOperation } from './rejections';
import type { EditOperation, ParseOutcome } from './types';
import {
  EDIT_MAX_ERRORS,
  EDIT_OPERATION_NAMES,
  OPERATION_MEMBERS,
  type EditOperationName,
} from './vocabulary';
import { isRecord } from '@liveplanner/project';

type Raw = Record<string, unknown>;

const isOneOf = <T extends string>(names: readonly T[], word: unknown): word is T =>
  typeof word === 'string' && names.some((name) => name === word);

const isText = (v: unknown): v is string => typeof v === 'string' && v !== '';
const expected = (member: string, what: string) => `member "${member}": expected ${what}`;

// The rule one member breaks, or null.
function memberIssue(raw: Raw, member: string): string | null {
  const value = raw[member];
  switch (member) {
    case 'target':
      return isText(value) ? null : expected(member, 'a non-empty string');
    case 'fields':
    case 'element':
      return isRecord(value) ? null : expected(member, 'an object');
    default:
      return typeof value === 'boolean' ? null : expected(member, 'true or false');
  }
}

const REQUIRED: Readonly<Record<EditOperationName, readonly string[]>> = {
  add: ['element'],
  set: ['target', 'fields'],
  rm: ['target'],
  test: ['target', 'fields'],
};

// Booleans present only when `true`, so `false` reads as absent.
function withoutFalse(raw: Raw): Raw {
  return Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== false));
}

// One JSON form operation, or its refusal. `operation` is its 1-based position.
export function validateEditOperation(
  raw: unknown,
  operation: number,
): EditOperation | EditRejection {
  if (!isRecord(raw)) return parseError(operation, 'expected an object with an "op" member');
  if (typeof raw.op !== 'string') return parseError(operation, expected('op', 'a string'));
  if (!isOneOf(EDIT_OPERATION_NAMES, raw.op)) return unknownOperation(raw.op, operation);
  const name = raw.op;
  const members = OPERATION_MEMBERS[name];
  const unknown = Object.keys(raw).find((member) => !members.includes(member));
  if (unknown !== undefined)
    return parseError(
      operation,
      `unknown member "${unknown}"; ${name} takes ${members.filter((m) => m !== 'op').join(', ')}`,
    );
  for (const member of members.slice(1)) {
    if (!REQUIRED[name].includes(member) && raw[member] === undefined) continue;
    const issue = memberIssue(raw, member);
    if (issue) return parseError(operation, issue);
  }
  // Every member was checked against its operation's shape above.
  return withoutFalse(raw) as EditOperation;
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
