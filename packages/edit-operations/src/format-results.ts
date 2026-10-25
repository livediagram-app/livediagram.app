// The text of a changeset's answer (docs/specs/024-agents/blueprints/edit-operations.md "Result
// lines"): the same for a dry run and a write. Strings are JSON-quoted and cut on a word boundary
// (labels at 60, other text at 48), tokens and numbers print bare, objects and arrays as
// `(changed)`, and an absent value as nothing (EO43).
//
// The lines are each product's `ResultLine` (its `api-schema`); the types below are what printing
// reads of them, so a product whose lines are a subset (no arrows, no lanes) prints with the same
// code. Each product binds the footer with its CLI's revert command.

import { quoteCut } from './element-text';
import { LABEL_CUT_CHARS, VALUE_CUT_CHARS } from './limits';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type Point = readonly [number, number];

export type PrintedChange = { key: string; from?: JsonValue; to?: JsonValue };

export type PrintedLine =
  | {
      mark: '+';
      ref: string;
      kind: string;
      label?: string;
      at?: Point;
      size?: Point;
      ends?: readonly [string, string];
      styleOf?: string;
    }
  | { mark: '~'; ref: string; changes: readonly PrintedChange[] }
  | {
      mark: '-';
      ref: string;
      kind: string;
      label?: string;
      ends?: readonly [string, string];
      reason?: 'pinned' | 'unwrapped';
      pinnedTo?: string;
    }
  | {
      mark: '»';
      refs: readonly string[];
      delta?: Point;
      reason: string;
      layout?: { style: string; direction?: string };
    }
  | { mark: 'container'; ref: string; joined: readonly string[]; left: readonly string[] }
  | { mark: '!'; warning: { code: string; ref?: string; message: string } };

// The footer's facts: a dry run's, or a write's. A product's footer adds the id its revert names.
export type PrintedFooter =
  | { dryRun: true; rev: number; lint: string }
  | {
      dryRun: false;
      previousRev: number;
      rev: number;
      rebasedOver: number;
      changesetId: string;
      lint: string;
    };

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
const at = ([x, y]: Point | readonly number[]) => `@${x},${y}`;

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

function formatChange({ key, from, to }: PrintedChange): string {
  // Where `order` put it: `order front`, `order above n5`, printed bare.
  if (key === 'order') return `order ${typeof to === 'string' ? to : '(changed)'}`;
  if (key === 'at' && isPoint(from) && isPoint(to)) return `${at(from)}→${at(to)}`;
  if ((key === 'from' || key === 'to') && (isPoint(from) || isPoint(to))) {
    const end = (v: JsonValue | undefined) =>
      isPoint(v) ? at(v) : isStructured(v) ? '(changed)' : formatValue(key, v);
    return `${key} ${end(from)}→${end(to)}`;
  }
  if (isStructured(from) || isStructured(to)) return `${key} (changed)`;
  return `${key} ${formatValue(key, from)}→${formatValue(key, to)}`;
}

const labelText = (label: string | undefined) =>
  label ? ` ${quoteCut(label, LABEL_CUT_CHARS)}` : '';

function formatLine(line: PrintedLine): string {
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

export function formatResultLines(results: readonly PrintedLine[]): string[] {
  return results.map(formatLine);
}

// The last line: what was written and how to take it back, or that a dry run wrote nothing (EO44).
// `revert` is the product's command for a write, `<cli> changeset revert <id> <changeset>`.
export function createFormatResultFooter<F extends PrintedFooter>(
  revert: (footer: Extract<F, { dryRun: false }>) => string,
): (footer: F) => string {
  return (footer) => {
    if (footer.dryRun) return `dry run · rev ${footer.rev} · ${footer.lint} · nothing written`;
    const written = footer as Extract<F, { dryRun: false }>;
    const rebased =
      written.rebasedOver > 0
        ? ` · rebased over ${written.rebasedOver} write${written.rebasedOver === 1 ? '' : 's'}`
        : '';
    return [
      `rev ${written.previousRev}→${written.rev}${rebased}`,
      written.changesetId,
      written.lint,
      `revert: ${revert(written)}`,
    ].join(' · ');
  };
}
