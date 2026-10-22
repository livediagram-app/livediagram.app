// The text of a changeset's answer (docs/specs/024-agents/blueprints/edit-operations.md "Result
// lines"): the same for a dry run and a write. Strings are JSON-quoted and cut on a word boundary
// (labels at 60, other text at 48), tokens and numbers print bare, objects and arrays as
// `(changed)`, and an absent value as nothing (EO43).

import type { FieldChange, JsonValue, ResultLine } from '@liveplanner/api-schema';
import { quoteCut } from './element-text';
import type { ResultFooter } from './types';
import { LABEL_CUT_CHARS, VALUE_CUT_CHARS } from './vocabulary';

// Fields whose strings are prose, always quoted.
const TEXT_KEYS: ReadonlySet<string> = new Set(['label']);
// A string printed bare: a kind, a colour, a ref, a size word.
const TOKEN = /^[#A-Za-z0-9][\w#.:-]*$/;

const at = ([x, y]: readonly [number, number] | readonly number[]) => `@${x},${y}`;

type JsonStructure = JsonValue[] | { [key: string]: JsonValue };
type JsonScalar = Exclude<JsonValue, JsonStructure>;

const isStructured = (v: JsonValue | undefined): v is JsonStructure =>
  typeof v === 'object' && v !== null;

// A scalar value: a structured one prints as `(changed)` instead.
export function formatValue(key: string, v: JsonScalar | undefined): string {
  if (v === undefined) return '';
  if (typeof v !== 'string') return String(v);
  return TOKEN.test(v) && !TEXT_KEYS.has(key)
    ? v
    : quoteCut(v, key === 'label' ? LABEL_CUT_CHARS : VALUE_CUT_CHARS);
}

const isPoint = (v: JsonValue | undefined): v is [number, number] =>
  Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number');

function formatChange({ key, from, to }: FieldChange): string {
  if (key === 'at' && isPoint(from) && isPoint(to)) return `${at(from)}→${at(to)}`;
  if (isStructured(from) || isStructured(to)) return `${key} (changed)`;
  return `${key} ${formatValue(key, from)}→${formatValue(key, to)}`;
}

const labelText = (label: string | undefined) =>
  label ? ` ${quoteCut(label, LABEL_CUT_CHARS)}` : '';

function formatLine(line: ResultLine): string {
  switch (line.mark) {
    case '+': {
      const placed = `${line.at ? ` ${at(line.at)}` : ''}${line.size ? ` ${line.size[0]}×${line.size[1]}` : ''}`;
      return `+ ${line.ref}  ${line.kind}${labelText(line.label)}${placed}`;
    }
    case '~':
      return `~ ${line.ref}  ${line.changes.map(formatChange).join(' · ')}`;
    case '-':
      return `- ${line.ref}  ${line.kind}${labelText(line.label)}`;
    case '!':
      return `! ${line.warning.code}  ${line.warning.message}`;
  }
}

export function formatResultLines(results: readonly ResultLine[]): string[] {
  return results.map(formatLine);
}

// The last line: what was written and how to take it back, or that a dry run wrote nothing (EO44).
export function formatResultFooter(footer: ResultFooter): string {
  if (footer.dryRun) return `dry run · rev ${footer.rev} · nothing written`;
  const rebased =
    footer.rebasedOver > 0
      ? ` · rebased over ${footer.rebasedOver} write${footer.rebasedOver === 1 ? '' : 's'}`
      : '';
  return [
    `rev ${footer.previousRev}→${footer.rev}${rebased}`,
    footer.changesetId,
    `revert: liveplanner changeset revert ${footer.projectId} ${footer.changesetId}`,
  ].join(' · ');
}
