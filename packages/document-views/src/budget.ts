// Fitting a view to a token budget (docs/specs/024-agents/blueprints/document-views.md "Budgets"):
// the outline steps down its own ladder (outline.ts); every other view keeps whole lines in order, then
// says what it left out (VW40).
import type { Elision, ViewDoor } from '@livediagram/api-schema';
import { CHARS_PER_TOKEN } from './constants';
import { buildElision, elisionLine, type ElisionArguments } from './elision';

// Tokens are UTF-16 length over CHARS_PER_TOKEN, rounded up (VW38).
export function estimateTokens(text: string | number): number {
  const length = typeof text === 'string' ? text.length : text;
  return Math.ceil(length / CHARS_PER_TOKEN);
}

export type Noun = { one: string; many: string };
// A line and what it shows; a separator has no noun and is never counted.
export type ViewLine = { text: string; noun?: Noun };
export type Omission = { noun: string; count: number };
// What a view leaves out whatever the budget, and the arguments that show it.
export type FixedOmission = { omitted: Omission[]; args: ElisionArguments };

export type FittedLines = { text: string; elision: Elision; kept: number; fullTokens: number };

function omissionsOf(counts: ReadonlyMap<Noun, number>): Omission[] {
  return [...counts].flatMap(([noun, count]) =>
    count > 0 ? [{ noun: count === 1 ? noun.one : noun.many, count }] : [],
  );
}

// The header, as many whole lines as fit, then one elision line when anything is left out.
export function fitLines(input: {
  header: string;
  lines: readonly ViewLine[];
  budget?: number;
  door: ViewDoor;
  fixed?: FixedOmission | null;
}): FittedLines {
  const { header, lines, budget, door, fixed = null } = input;
  const elisionFor = (left: ReadonlyMap<Noun, number>, fullTokens: number): Elision => {
    const dropped = omissionsOf(left);
    const omitted = [...dropped, ...(fixed?.omitted ?? [])];
    if (omitted.length === 0) return null;
    const args = dropped.length > 0 || fixed === null ? { budget: fullTokens } : fixed.args;
    return buildElision({ omitted }, args, door);
  };
  const elisionLength = (elision: Elision) =>
    elision === null ? 0 : elisionLine(elision).length + 1;
  const compose = (kept: number, elision: Elision) =>
    [
      header,
      ...lines.slice(0, kept).map((l) => l.text),
      ...(elision ? [elisionLine(elision)] : []),
    ].join('\n');

  const none = new Map<Noun, number>();
  const allLines = lines.reduce((n, line) => n + 1 + line.text.length, header.length);
  const fullTokens = estimateTokens(allLines + elisionLength(elisionFor(none, 0)));
  const whole = elisionFor(none, fullTokens);
  if (budget === undefined || fullTokens <= budget) {
    return { text: compose(lines.length, whole), elision: whole, kept: lines.length, fullTokens };
  }

  const left = new Map<Noun, number>();
  const count = (counts: Map<Noun, number>, noun: Noun | undefined, by: number) => {
    if (noun !== undefined) counts.set(noun, (counts.get(noun) ?? 0) + by);
    return counts;
  };
  for (const line of lines) count(left, line.noun, 1);
  let length = header.length;
  let kept = 0;
  for (const line of lines) {
    const after = count(new Map(left), line.noun, -1);
    const elision = elisionFor(after, fullTokens);
    const next = length + 1 + line.text.length;
    if (estimateTokens(next + elisionLength(elision)) > budget) break;
    count(left, line.noun, -1);
    length = next;
    kept++;
  }
  const elision = elisionFor(left, fullTokens);
  return { text: compose(kept, elision), elision, kept, fullTokens };
}
