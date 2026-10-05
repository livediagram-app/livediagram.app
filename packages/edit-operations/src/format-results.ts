// The text of a changeset's answer (docs/specs/024-agents/blueprints/edit-operations.md "Result
// lines"): the same for a dry run and a write. Strings are JSON-quoted and cut on a word boundary
// (labels at 60, other text at 48), tokens and numbers print bare, objects and arrays as
// `(changed)`, and an absent value as nothing (EO43).

import type { FieldChange, JsonValue, ResultLine } from '@livediagram/api-schema';
import { quoteCut } from './element-text';
import type { ResultFooter } from './types';
import { LABEL_CUT_CHARS, VALUE_CUT_CHARS } from './vocabulary';

// Fields whose strings are prose, always quoted.
const TEXT_KEYS: ReadonlySet<string> = new Set([
  'label',
  'note',
  'alt',
  'code',
  'pageTitle',
  'pageSubtitle',
]);
// A string printed bare: a kind, a colour, a ref, a size word.
const TOKEN = /^[#A-Za-z0-9][\w#.:-]*$/;

const signed = (n: number) => (n < 0 ? `${n}` : `+${n}`);
const at = ([x, y]: readonly [number, number] | readonly number[]) => `@${x},${y}`;

// A scalar value: structured ones print as `(changed)` before they reach here.
export function formatValue(key: string, v: JsonValue | undefined): string {
  if (v === undefined) return '';
  if (typeof v !== 'string') return String(v);
  return TOKEN.test(v) && !TEXT_KEYS.has(key)
    ? v
    : quoteCut(v, key === 'label' ? LABEL_CUT_CHARS : VALUE_CUT_CHARS);
}

const isPoint = (v: JsonValue | undefined): v is [number, number] =>
  Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number');

function formatChange({ key, from, to }: FieldChange): string {
  // Where `order` put it: `order front`, `order above n5`.
  if (key === 'order') return `order ${String(to)}`;
  if (key === 'at' && isPoint(from) && isPoint(to)) return `${at(from)}→${at(to)}`;
  if ((key === 'from' || key === 'to') && (isPoint(from) || isPoint(to))) {
    const end = (v: JsonValue | undefined) => (isPoint(v) ? at(v) : formatValue(key, v));
    return `${key} ${end(from)}→${end(to)}`;
  }
  const isStructured = (v: JsonValue | undefined) => typeof v === 'object' && v !== null;
  if (isStructured(from) || isStructured(to)) return `${key} (changed)`;
  return `${key} ${formatValue(key, from)}→${formatValue(key, to)}`;
}

const labelText = (label: string | undefined) =>
  label ? ` ${quoteCut(label, LABEL_CUT_CHARS)}` : '';

function formatLine(line: ResultLine): string {
  switch (line.mark) {
    case '+': {
      if (line.ends) {
        const style = line.styleOf ? ` (style of ${line.styleOf})` : '';
        return `+ ${line.ref}  ${line.ends[0]}→${line.ends[1]}${labelText(line.label)}${style}`;
      }
      const placed = `${line.at ? ` ${at(line.at)}` : ''}${line.size ? ` ${line.size[0]}×${line.size[1]}` : ''}`;
      return `+ ${line.ref}  ${line.kind}${labelText(line.label)}${placed}`;
    }
    case '~':
      return `~ ${line.ref}  ${line.changes.map(formatChange).join(' · ')}`;
    case '-': {
      const ends = line.ends ? ` ${line.ends[0]}→${line.ends[1]}` : '';
      const reason =
        line.reason === 'pinned'
          ? ` (pinned to ${line.pinnedTo})`
          : line.reason === 'unwrapped'
            ? ' (unwrapped)'
            : '';
      return `- ${line.ref}  ${line.kind}${ends}${labelText(line.label)}${reason}`;
    }
    case '»': {
      const layout = line.layout
        ? ` (${[line.layout.style, line.layout.direction].filter(Boolean).join(', ')})`
        : '';
      const how = line.delta
        ? `${signed(line.delta[0])},${signed(line.delta[1])} (${line.reason})`
        : `${line.reason}${layout}`;
      return `» ${line.refs.join(' ')}  ${how}`;
    }
    case 'container':
      return `${line.ref}  ${[...line.joined.map((r) => `+${r}`), ...line.left.map((r) => `-${r}`)].join(' ')}`;
    case '!':
      return `! ${line.warning.code}  ${line.warning.message}`;
  }
}

export function formatResultLines(results: readonly ResultLine[]): string[] {
  return results.map(formatLine);
}

// The last line: what was written and how to take it back, or that a dry run wrote nothing (EO44).
export function formatResultFooter(footer: ResultFooter): string {
  if (footer.dryRun) return `dry run · rev ${footer.rev} · ${footer.lint} · nothing written`;
  const rebased =
    footer.rebasedOver > 0
      ? ` · rebased over ${footer.rebasedOver} write${footer.rebasedOver === 1 ? '' : 's'}`
      : '';
  return [
    `rev ${footer.previousRev}→${footer.rev}${rebased}`,
    footer.changesetId,
    footer.lint,
    `revert: livediagram changeset revert ${footer.documentId} ${footer.changesetId}`,
  ].join(' · ');
}
