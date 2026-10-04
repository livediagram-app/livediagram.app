// The one closing line naming what a view left out and how to see it, in the reading door's syntax
// (docs/specs/024-agents/blueprints/document-views.md "Elision line", VW39, VW54).
import type { Elision, ViewDoor } from '@livediagram/api-schema';
import { ELISION_CONTAINERS_NAMED } from './constants';
import { ELLIPSIS, plural } from './text';

// The named containers in reading order, then one total for the rest.
function collapsedParts(collapsed: NonNullable<Elision>['collapsed']): string[] {
  const named = new Set(
    [...collapsed].sort((a, b) => b.elements - a.elements).slice(0, ELISION_CONTAINERS_NAMED),
  );
  const rest = collapsed.filter((c) => !named.has(c));
  const restElements = rest.reduce((n, c) => n + c.elements, 0);
  const others = plural(rest.length, 'other container', 'other containers');
  return [
    ...collapsed
      .filter((c) => named.has(c))
      .map((c) => `${plural(c.elements, 'element', 'elements')} in ${c.kind} ${c.ref} hidden`),
    ...(rest.length === 0
      ? []
      : [`${plural(restElements, 'element', 'elements')} in ${others} hidden`]),
  ];
}

export type ElisionArguments = Record<string, string | number | boolean>;

// `view --only c991` for the CLI, `read_document {"only":"c991"}` for the MCP.
export function elisionCommand(args: ElisionArguments, door: ViewDoor): string {
  if (door === 'mcp') return `read_document ${JSON.stringify(args)}`;
  const flags = Object.entries(args).map(([key, value]) =>
    value === true ? ` --${key}` : ` --${key} ${value}`,
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
  const parts = [
    ...elision.dropped.map((what) => `${what} hidden`),
    ...collapsedParts(elision.collapsed),
    ...elision.omitted.map((o) => `${o.count} ${o.noun} hidden`),
  ];
  return `${ELLIPSIS} ${parts.join('; ')}: ${elision.command}`;
}
