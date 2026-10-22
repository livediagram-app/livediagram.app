// One line form line into its JSON form (docs/specs/024-agents/blueprints/edit-operations.md "Line
// form"): fields are `key=value`, `all` a flag, and every other word a selector term. An `add` takes a whole
// element, which has no line form: it is a JSON line. The object it builds is checked by `validateEditOperation`,
// so both forms share one validation.

import type { FieldValue } from './types';
import { hasQuotes, unquotedPrefix, type Word } from './tokenise';
import {
  EDIT_OPERATION_NAMES,
  FLAG_MEMBERS,
  type EditOperationName,
  type FlagWord,
} from './vocabulary';

type LineError = { column: number; expected: string };
type LineResult = { raw: Record<string, unknown> } | { error: LineError };

// The flags each operation takes.
const FLAGS: Readonly<Partial<Record<EditOperationName, readonly FlagWord[]>>> = {
  set: ['all'],
  rm: ['all'],
};

const FIELD_KEY = /^([a-zA-Z][a-zA-Z-]*)=/;
// A whole JSON number, `true` or `false`; `2FA`, `3D` or `1st` are strings (EO19).
const JSON_LITERAL = /^(-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?|true|false)$/;
// What an `add` line must be.
export const ADD_LINE_EXPECTED =
  'a whole element as a JSON line: {"op":"add","element":{"type":"shape","shape":"plan-view",…}}';

const fail = (word: Word | undefined, fallback: number, expected: string): LineResult => ({
  error: { column: word?.column ?? fallback, expected },
});

const flagOf = (word: Word, flags: readonly FlagWord[]): FlagWord | undefined =>
  hasQuotes(word) ? undefined : flags.find((flag) => flag === word.value);

// `key=value`: the key, the value with quotes read, and the value as written.
type FieldWord = { key: string; text: string; raw: string; quoted: boolean };

function fieldOf(word: Word): FieldWord | null {
  const match = FIELD_KEY.exec(unquotedPrefix(word));
  if (!match) return null;
  const key = match[1]!;
  return {
    key,
    text: word.value.slice(key.length + 1),
    raw: word.raw.slice(key.length + 1),
    quoted: hasQuotes(word),
  };
}

// A value starting with `[` or `{` is JSON as written; otherwise a quoted value is a string, an empty one
// unsets, and a number, true or false reads as JSON (EO19).
function fieldValue({ text, raw, quoted }: FieldWord): { value: FieldValue } | null {
  const json = /^[[{]/.test(raw) ? raw : !quoted && JSON_LITERAL.test(text) ? text : null;
  if (json === null) return { value: quoted || text !== '' ? text : null };
  try {
    return { value: JSON.parse(json) as FieldValue };
  } catch {
    return null;
  }
}

// The JSON form of one line's words, `head` the operation's name, or where it stops reading.
// `lineEnd` is the column just past the last word, where something missing at the end belongs.
export function parseOperationWords(
  name: EditOperationName,
  head: Word,
  rest: readonly Word[],
  lineEnd: number,
): LineResult {
  const end = head.column + head.raw.length;
  if (name === 'add') return fail(head, end, ADD_LINE_EXPECTED);
  const fields: Record<string, FieldValue> = {};
  const flags: Record<string, true> = {};
  const terms: Word[] = [];
  for (const word of rest) {
    const flag = flagOf(word, FLAGS[name] ?? []);
    if (flag) {
      flags[FLAG_MEMBERS[flag]] = true;
      continue;
    }
    const field = fieldOf(word);
    if (!field) {
      terms.push(word);
      continue;
    }
    if (name === 'rm') return fail(word, end, 'no key=value on rm');
    const value = fieldValue(field);
    if (!value) return fail(word, end, `a JSON value after ${field.key}=`);
    fields[field.key] = value.value;
  }
  if (!terms.length) return fail(rest[0], end, 'a selector: a ref, a "label" or key:value terms');
  if (name !== 'rm' && !Object.keys(fields).length) return fail(undefined, lineEnd, 'key=value');
  const raw: Record<string, unknown> = {
    op: name,
    target: terms.map((w) => w.raw).join(' '),
    ...(name === 'rm' ? {} : { fields }),
  };
  return { raw: { ...raw, ...flags } };
}

export function isOperationName(word: string): word is EditOperationName {
  return EDIT_OPERATION_NAMES.some((name) => name === word);
}
