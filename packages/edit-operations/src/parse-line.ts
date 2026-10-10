// One line form line into its JSON form (docs/specs/024-agents/blueprints/edit-operations.md "Line
// form"): fields are `key=value`, placements `key:value`, flags the operation's keywords, and every
// other word a selector term. The object it builds is checked by `validateEditOperation`, so both
// forms share one validation.

import type { FieldValue } from './types';
import { arrowParts, hasQuotes, tokeniseLine, unquotedPrefix, type Word } from './tokenise';
import { isSingleWord } from './selectors';
import {
  EDIT_OPERATION_NAMES,
  FLAG_MEMBERS,
  PLACEMENT_RELATIONS,
  type EditOperationName,
  type FlagWord,
} from './vocabulary';

export type LineError = { column: number; expected: string };
export type LineResult = { raw: Record<string, unknown> } | { error: LineError };

// Keys an operation reads itself rather than as a field (blueprint "Word classes").
const SPECIAL_KEYS: Readonly<Partial<Record<EditOperationName, readonly string[]>>> = {
  add: ['id'],
  move: ['by'],
  connect: ['id'],
  rewire: ['from', 'to'],
  insert: ['id'],
  wrap: ['id'],
  order: ['above', 'below'],
  layout: ['style', 'direction'],
};

// The flags each operation takes.
const FLAGS: Readonly<Partial<Record<EditOperationName, readonly FlagWord[]>>> = {
  set: ['all'],
  rm: ['all', 'keep-arrows'],
  move: ['all'],
  connect: ['again'],
  wrap: ['tidy', 'absorb', 'make-room'],
};

// The special keys whose value is a selector, kept as written.
const SELECTOR_KEYS_OF: ReadonlySet<string> = new Set(['from', 'to', 'above', 'below']);
const PLACEMENT_WORDS: ReadonlySet<string> = new Set([...PLACEMENT_RELATIONS, 'at']);
const FIELD_KEY = /^([a-zA-Z][a-zA-Z-]*)=/;
const KEYED = /^([a-zA-Z][a-zA-Z-]*):/;
// A whole JSON number, `true` or `false`; `2FA`, `3D` or `1st` are strings (EO19).
const JSON_LITERAL = /^(-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?|true|false)$/;

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

// `key:value` with a placement key (read case-insensitively, EO11), or null.
function placementOf(word: Word): { key: string; text: string } | null {
  const match = KEYED.exec(unquotedPrefix(word));
  if (!match) return null;
  const key = match[1]!.toLowerCase();
  if (!PLACEMENT_WORDS.has(key) && key !== 'gap') return null;
  // A reference is a selector, kept as written; an offset or a gap is a plain value.
  return { key, text: word.raw.slice(match[1]!.length + 1) };
}

const numbers = (text: string): [number, number] | null => {
  const parts = text.split(',');
  if (parts.length !== 2 || parts.some((p) => p.trim() === '')) return null;
  const pair = parts.map(Number);
  return pair.every(Number.isFinite) ? [pair[0]!, pair[1]!] : null;
};

type Collected = {
  fields: Record<string, FieldValue>;
  special: Record<string, string>;
  flags: Record<string, true>;
  place?: Record<string, unknown>;
  gap?: Word;
  terms: Word[];
};

// Sorts the words after an operation's head into fields, its special keys, flags, a placement and
// selector terms.
function collect(name: EditOperationName, words: readonly Word[]): Collected | LineError {
  const out: Collected = { fields: {}, special: {}, flags: {}, terms: [] };
  const specials = SPECIAL_KEYS[name] ?? [];
  const flags = FLAGS[name] ?? [];
  for (const word of words) {
    const flag = flagOf(word, flags);
    if (flag) {
      out.flags[FLAG_MEMBERS[flag]] = true;
      continue;
    }
    const field = fieldOf(word);
    if (field) {
      const special = specials.find((key) => key === field.key.toLowerCase());
      if (special) {
        // Selectors keep their quotes; ids, styles and offsets are plain values.
        out.special[special] = SELECTOR_KEYS_OF.has(special) ? field.raw : field.text;
        continue;
      }
      const value = fieldValue(field);
      if (!value) return { column: word.column, expected: `a JSON value after ${field.key}=` };
      out.fields[field.key] = value.value;
      continue;
    }
    const placement = name === 'add' || name === 'move' ? placementOf(word) : null;
    if (placement) {
      if (placement.key === 'gap') {
        out.gap = word;
        continue;
      }
      if (out.place) return { column: word.column, expected: 'one placement' };
      if (placement.key === 'at') {
        const at = numbers(placement.text);
        if (!at) return { column: word.column, expected: 'at:x,y with two numbers' };
        out.place = { rel: 'at', x: at[0], y: at[1] };
      } else out.place = { rel: placement.key, ref: placement.text };
      continue;
    }
    out.terms.push(word);
  }
  if (out.gap !== undefined) {
    if (!out.place || out.place.rel === 'at')
      return { column: out.gap.column, expected: 'gap: with a side, after or align placement' };
    const gap = out.gap.raw.slice('gap:'.length);
    // `gap:` alone is not 0: a missing number is refused, as is anything Number reads as not finite.
    if (gap.trim() === '' || !Number.isFinite(Number(gap)))
      return { column: out.gap.column, expected: 'a number after gap:' };
    out.place.gap = Number(gap);
  }
  return out;
}

const selectorOf = (terms: readonly Word[]) => terms.map((w) => w.raw).join(' ');

function withOptional(raw: Record<string, unknown>, c: Collected, members: readonly string[]) {
  if (members.includes('fields') && Object.keys(c.fields).length) raw.fields = c.fields;
  if (members.includes('place') && c.place) raw.place = c.place;
  return { ...raw, ...c.flags };
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
  const needSelector = (terms: readonly Word[]) =>
    terms.length ? null : fail(rest[0], end, 'a selector: a ref, a "label" or key:value terms');

  if (name === 'add' || name === 'insert') {
    const [kindWord, ...more] = rest;
    if (!kindWord || hasQuotes(kindWord) || /[:=~]/.test(kindWord.value))
      return fail(kindWord, end, 'a kind: square, text, sticky, …');
    let between: string[] | null = null;
    let tail = more;
    if (name === 'insert') {
      const at = more.findIndex((w) => !hasQuotes(w) && w.value === 'between');
      if (at < 0 || !more[at + 1] || !more[at + 2])
        return fail(undefined, lineEnd, 'between <a> <b>');
      between = [more[at + 1]!.raw, more[at + 2]!.raw];
      tail = [...more.slice(0, at), ...more.slice(at + 3)];
    }
    const c = collect(name, tail);
    if ('column' in c) return { error: c };
    if (c.terms.length) return fail(c.terms[0], end, 'key=value or a placement');
    const raw: Record<string, unknown> = { op: name, kind: kindWord.value };
    if (c.special.id !== undefined) raw.id = c.special.id;
    if (between) raw.between = between;
    return { raw: withOptional(raw, c, name === 'add' ? ['fields', 'place'] : ['fields']) };
  }

  if (name === 'connect') {
    const isArrow = (w: Word) => !hasQuotes(w) && w.value === '->';
    const arrows = rest.filter(isArrow);
    const joined = rest.filter((w) => !isArrow(w) && !fieldOf(w) && arrowParts(w) !== null);
    // One arrow has two ends: `a -> b -> c` or `a->b->c` is refused, never read as `a -> b` (EO24a).
    const extra = arrows[1] ?? joined.find((w) => arrows.length > 0 || arrowParts(w)!.length > 2);
    if (extra ?? joined[1]) return fail(extra ?? joined[1], end, 'one -> in connect: <a> -> <b>');
    const arrow = rest.findIndex(isArrow);
    let fromTerms: Word[];
    let tail: Word[];
    if (arrow >= 0) {
      fromTerms = rest.slice(0, arrow);
      tail = rest.slice(arrow + 1);
    } else {
      // `a->b` as one word, either end may be quoted: `"Sign in"->"Pay"`.
      const at = joined[0] ? rest.indexOf(joined[0]) : -1;
      if (at < 0) return fail(rest[0], end, 'connect <a> -> <b>');
      const [a, b] = arrowParts(rest[at]!) as [string, string];
      const column = rest[at]!.column;
      // Each part is cut from a word that already tokenised, at a -> outside quotes, so it tokenises too.
      const part = (text: string, offset: number): Word[] =>
        (tokeniseLine(text) as { words: Word[] }).words.map((w) => ({
          ...w,
          column: column + offset,
        }));
      fromTerms = [...rest.slice(0, at), ...part(a, 0)];
      tail = [...part(b, a.length + 2), ...rest.slice(at + 1)];
    }
    const c = collect(name, tail);
    if ('column' in c) return { error: c };
    if (!fromTerms.length) return fail(rest[0], end, 'connect <a> -> <b>');
    if (!c.terms.length) return fail(rest[arrow], end, 'a selector after ->');
    const raw: Record<string, unknown> = {
      op: name,
      from: selectorOf(fromTerms),
      to: selectorOf(c.terms),
    };
    if (c.special.id !== undefined) raw.id = c.special.id;
    return { raw: withOptional(raw, c, ['fields']) };
  }

  if (name === 'wrap') {
    const at = rest.findIndex((w) => !hasQuotes(w) && w.value === 'in');
    const container = at >= 0 ? rest[at + 1] : undefined;
    if (!container) return fail(rest[at] ?? rest.at(-1), end, 'in frame or in lane');
    const members = rest.slice(0, at);
    if (!members.length) return fail(rest[0], end, 'the members to wrap');
    const c = collect(name, rest.slice(at + 2));
    if ('column' in c) return { error: c };
    if (c.terms.length) return fail(c.terms[0], end, 'key=value or tidy, absorb, make-room');
    const single = members.filter(isSingleWord);
    const together = members.filter((w) => !isSingleWord(w));
    const raw: Record<string, unknown> = {
      op: name,
      targets: [...single.map((w) => w.raw), ...(together.length ? [selectorOf(together)] : [])],
      in: container.value,
    };
    if (c.special.id !== undefined) raw.id = c.special.id;
    return { raw: withOptional(raw, c, ['fields']) };
  }

  const c = collect(name, rest);
  if ('column' in c) return { error: c };
  let terms = c.terms;
  const raw: Record<string, unknown> = { op: name };
  if (name === 'order') {
    const ends = terms.filter((w) => !hasQuotes(w) && (w.value === 'front' || w.value === 'back'));
    if (ends.length) raw.to = ends.at(-1)!.value;
    terms = terms.filter((w) => !ends.includes(w));
  }
  const missing = needSelector(terms);
  if (missing) return missing;
  raw.target = selectorOf(terms);
  for (const [key, text] of Object.entries(c.special)) {
    if (key === 'by') {
      const by = numbers(text);
      if (!by)
        return fail(
          rest.find((w) => w.value.startsWith('by=')),
          end,
          'by=dx,dy with two numbers',
        );
      raw.by = by;
    } else raw[key] = text;
  }
  if ((name === 'set' || name === 'test') && !Object.keys(c.fields).length)
    return fail(undefined, lineEnd, 'key=value');
  if (name !== 'set' && name !== 'test' && Object.keys(c.fields).length) {
    const field = rest.find(
      (w) => fieldOf(w) && !(SPECIAL_KEYS[name] ?? []).includes(fieldOf(w)!.key),
    );
    return fail(field, end, `no key=value on ${name}`);
  }
  return { raw: withOptional(raw, c, ['fields', 'place']) };
}

export function isOperationName(word: string): word is EditOperationName {
  return EDIT_OPERATION_NAMES.some((name) => name === word);
}
