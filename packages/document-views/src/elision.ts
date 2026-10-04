// The one closing line naming what a view left out and how to see it, in the reading door's syntax
// (docs/specs/024-agents/blueprints/document-views.md "Elision line", VW39, VW54).
import type { Elision, ViewDoor } from '@livediagram/api-schema';
import { CHARS_PER_TOKEN } from './constants';
import { ELLIPSIS, plural } from './text';

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
    omitted?: { noun: string; count: number }[];
  },
  args: ElisionArguments,
  door: ViewDoor,
): NonNullable<Elision> {
  return {
    dropped: parts.dropped ?? [],
    collapsed: parts.collapsed ?? [],
    omitted: parts.omitted ?? [],
    arguments: args,
    command: elisionCommand(args, door),
  };
}

// `… notes hidden; 12 elements in frame c991 hidden: view --only c991`
export function elisionLine(elision: NonNullable<Elision>): string {
  const parts = [
    ...elision.dropped.map((what) => `${what} hidden`),
    ...elision.collapsed.map(
      (c) => `${plural(c.elements, 'element', 'elements')} in ${c.kind} ${c.ref} hidden`,
    ),
    ...elision.omitted.map((o) => `${o.count} ${o.noun} hidden`),
  ];
  return `${ELLIPSIS} ${parts.join('; ')}: ${elision.command}`;
}

// Tokens are UTF-16 length over CHARS_PER_TOKEN, rounded up (VW38).
export function estimateTokens(text: string | number): number {
  const length = typeof text === 'number' ? text : text.length;
  return Math.ceil(length / CHARS_PER_TOKEN);
}
