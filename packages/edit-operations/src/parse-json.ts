// The JSON form, one object an operation, checked member by member
// (docs/specs/024-agents/blueprints/edit-operations.md "Interfaces and contracts"). Unknown members
// are refused, booleans are `true` only (`false` reads as absent), and the operation count is
// capped before anything is read.

import { CHANGESET_MAX_OPERATIONS, type EditRejection } from '@livediagram/api-schema';
import { parseError, tooLarge, unknownOperation } from './rejections';
import type { EditOperation, ParseOutcome } from './types';
import {
  EDIT_MAX_ERRORS,
  EDIT_OPERATION_NAMES,
  LAYOUT_DIRECTIONS,
  LAYOUT_STYLES,
  OPERATION_MEMBERS,
  ORDER_ENDS,
  PLACEMENT_GAP_MAX,
  PLACEMENT_RELATIONS,
  WRAP_CONTAINERS,
  type EditOperationName,
} from './vocabulary';
import { isRecord } from '@livediagram/document';

type Raw = Record<string, unknown>;

const isOneOf = <T extends string>(names: readonly T[], word: unknown): word is T =>
  typeof word === 'string' && names.some((name) => name === word);

const isText = (v: unknown): v is string => typeof v === 'string' && v !== '';
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const expected = (member: string, what: string) => `member "${member}": expected ${what}`;

// The rule a placement breaks, or null.
export function placementIssue(value: unknown): string | null {
  const what = `{ "rel", "ref" } or { "rel": "at", "x", "y" }`;
  if (!isRecord(value)) return expected('place', what);
  if (value.rel === 'at') {
    const extra = Object.keys(value).find((key) => !['rel', 'x', 'y'].includes(key));
    if (extra !== undefined) return expected('place', `no "${extra}" with "at"`);
    return isFiniteNumber(value.x) && isFiniteNumber(value.y)
      ? null
      : expected('place', '"x" and "y" numbers with "at"');
  }
  if (!isOneOf(PLACEMENT_RELATIONS, value.rel))
    return expected('place', `"rel" one of ${[...PLACEMENT_RELATIONS, 'at'].join(', ')}`);
  const extra = Object.keys(value).find((key) => !['rel', 'ref', 'gap'].includes(key));
  if (extra !== undefined) return expected('place', `no "${extra}" with "${value.rel}"`);
  if (!isText(value.ref)) return expected('place', '"ref" a non-empty selector');
  const gap = value.gap;
  if (
    gap !== undefined &&
    !(Number.isInteger(gap) && Number(gap) >= 0 && Number(gap) <= PLACEMENT_GAP_MAX)
  )
    return expected('place', `"gap" a whole number from 0 to ${PLACEMENT_GAP_MAX}`);
  return null;
}

// The rule one member breaks, or null. `to` is an end in `order` and a selector elsewhere.
function memberIssue(name: EditOperationName, raw: Raw, member: string): string | null {
  const value = raw[member];
  switch (member) {
    case 'target':
    case 'from':
    case 'above':
    case 'below':
    case 'kind':
    case 'id':
      return isText(value) ? null : expected(member, 'a non-empty string');
    case 'to':
      if (name === 'order')
        return isOneOf(ORDER_ENDS, value) ? null : expected(member, ORDER_ENDS.join(' or '));
      return isText(value) ? null : expected(member, 'a non-empty string');
    case 'fields':
    case 'element':
      return isRecord(value) ? null : expected(member, 'an object');
    case 'place':
      return placementIssue(value);
    case 'by':
      return Array.isArray(value) && value.length === 2 && value.every(isFiniteNumber)
        ? null
        : expected(member, '[dx, dy] numbers');
    case 'between':
      return Array.isArray(value) && value.length === 2 && value.every(isText)
        ? null
        : expected(member, '[a, b] selectors');
    case 'targets':
      return Array.isArray(value) && value.length > 0 && value.every(isText)
        ? null
        : expected(member, 'a non-empty array of selectors');
    case 'in':
      return isOneOf(WRAP_CONTAINERS, value) ? null : expected(member, 'frame or lane');
    case 'style':
      return isOneOf(LAYOUT_STYLES, value) ? null : expected(member, LAYOUT_STYLES.join(', '));
    case 'direction':
      return isOneOf(LAYOUT_DIRECTIONS, value)
        ? null
        : expected(member, LAYOUT_DIRECTIONS.join(' or '));
    default:
      return typeof value === 'boolean' ? null : expected(member, 'true or false');
  }
}

const REQUIRED: Readonly<Record<EditOperationName, readonly string[]>> = {
  add: [],
  set: ['target', 'fields'],
  rm: ['target'],
  move: ['target'],
  connect: ['from', 'to'],
  rewire: ['target'],
  insert: ['kind', 'between'],
  wrap: ['targets', 'in'],
  unwrap: ['target'],
  order: ['target'],
  layout: ['target'],
  test: ['target', 'fields'],
};

// Members of which exactly one, at most one (`atMostOne`) or at least one (`atLeastOne`) is given,
// and how the line form says them.
const CHOICES: Readonly<
  Partial<
    Record<
      EditOperationName,
      { members: readonly string[]; atMostOne?: true; atLeastOne?: true; inLines: string }
    >
  >
> = {
  add: { members: ['kind', 'element'], inLines: 'add <kind> key=value…' },
  move: { members: ['place', 'by'], inLines: 'a placement such as below=n3, or by=dx,dy' },
  rewire: { members: ['from', 'to'], atLeastOne: true, inLines: 'from=<x>, to=<y> or both' },
  order: { members: ['to', 'above', 'below'], inLines: 'front, back, above=<x> or below=<x>' },
  wrap: { members: ['absorb', 'makeRoom'], atMostOne: true, inLines: 'absorb or make-room' },
};

function choiceIssue(name: EditOperationName, raw: Raw): string | null {
  const choice = CHOICES[name];
  if (!choice) return null;
  const given = choice.members.filter(
    (member) => raw[member] !== undefined && raw[member] !== false,
  );
  if (given.length === 1 || (given.length === 0 && choice.atMostOne)) return null;
  if (given.length > 1 && choice.atLeastOne) return null;
  const quoted = choice.members.map((member) => `"${member}"`).join(', ');
  const which = choice.atMostOne ? 'at most' : choice.atLeastOne ? 'at least' : 'exactly';
  return `${which} one of ${quoted} (in a line: ${choice.inLines})`;
}

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
    const issue = memberIssue(name, raw, member);
    if (issue) return parseError(operation, issue);
  }
  const choice = choiceIssue(name, raw);
  if (choice) return parseError(operation, `${name} takes ${choice}`);
  if (name === 'add' && raw.element !== undefined) {
    const extra = ['kind', 'id', 'fields', 'place'].find((member) => raw[member] !== undefined);
    if (extra !== undefined)
      return parseError(
        operation,
        `add with "element" takes no "${extra}": the element carries it`,
      );
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
