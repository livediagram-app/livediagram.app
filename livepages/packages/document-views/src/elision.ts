// The one closing line naming what a view left out and how to see it, in the reading door's syntax
// (docs/specs/024-agents/blueprints/document-views.md "Elision line", VW39, VW54).
import type { Elision, ViewDoor } from '@livediagram/api-schema';
import { ELISION_CONTAINERS_NAMED } from './constants';
import { ELLIPSIS, plural } from './text';

type Collapsed = NonNullable<Elision>['collapsed'][number];

// The named containers' parts in the order given, then one total for the rest.
export function collapsedPartsOf(
  named: readonly Collapsed[],
  rest: { count: number; elements: number },
): string[] {
  const others = plural(rest.count, 'other container', 'other containers');
  return [
    ...named.map(
      (c) => `${plural(c.elements, 'element', 'elements')} in ${c.kind} ${c.ref} hidden`,
    ),
    ...(rest.count === 0
      ? []
      : [`${plural(rest.elements, 'element', 'elements')} in ${others} hidden`]),
  ];
}

// The named containers in reading order, then one total for the rest.
function collapsedParts(collapsed: NonNullable<Elision>['collapsed']): string[] {
  const named = new Set(
    [...collapsed].sort((a, b) => b.elements - a.elements).slice(0, ELISION_CONTAINERS_NAMED),
  );
  const rest = collapsed.filter((c) => !named.has(c));
  return collapsedPartsOf(
    collapsed.filter((c) => named.has(c)),
    { count: rest.length, elements: rest.reduce((n, c) => n + c.elements, 0) },
  );
}

export type ElisionArguments = Record<string, string | number | boolean>;

// A flag value as a shell reads it: bare when it holds only safe characters, else single-quoted, so an
// `id:"Node A"` ref pastes as one argument with its quotes kept.
const SHELL_SAFE = /^[A-Za-z0-9_.,:/@%+=-]+$/;
const shellWord = (value: string | number | boolean) => {
  const text = String(value);
  return SHELL_SAFE.test(text) ? text : `'${text.replace(/'/g, `'\\''`)}'`;
};

// `view --only c991` for the CLI, `read_document {"only":"c991"}` for the MCP.
export function elisionCommand(args: ElisionArguments, door: ViewDoor): string {
  if (door === 'mcp') return `read_document ${JSON.stringify(args)}`;
  const flags = Object.entries(args).map(([key, value]) =>
    value === true ? ` --${key}` : ` --${key} ${shellWord(value)}`,
  );
  return `view${flags.join('')}`;
}

export function buildElision(
  parts: {
    dropped?: ('notes' | 'attributes')[];
    collapsed?: { ref: string; kind: string; elements: number }[];
    omitted: { noun: string; count: number }[];
  },
  args: ElisionArguments,
  door: ViewDoor,
): NonNullable<Elision> {
  return {
    dropped: parts.dropped ?? [],
    collapsed: parts.collapsed ?? [],
    omitted: parts.omitted,
    arguments: args,
    command: elisionCommand(args, door),
  };
}

// `… notes hidden; 12 elements in frame c991 hidden: view --only c991`
// The largest collapsed containers are named; the rest are one total, so the line stays short however
// many containers a budget folds (VW39).
export function elisionLine(elision: NonNullable<Elision>): string {
  return elisionText(
    elision.dropped,
    collapsedParts(elision.collapsed),
    elision.omitted,
    elision.command,
  );
}

// The line from its parts, so a caller fitting many collapses can measure it without the whole list.
export function elisionText(
  dropped: readonly string[],
  collapsed: readonly string[],
  omitted: readonly { noun: string; count: number }[],
  command: string,
): string {
  const parts = [
    ...dropped.map((what) => `${what} hidden`),
    ...collapsed,
    ...omitted.map((o) => `${o.count} ${o.noun} hidden`),
  ];
  return `${ELLIPSIS} ${parts.join('; ')}: ${command}`;
}
