// What a verb prints on stdout (docs/specs/015-api/cli.md "Output"): its compact text by default, JSON with
// --json (fields picked with --json=a,b, of each list item for a list verb), refs or ids with -q.

import type { Verb } from '@livediagram/agent-verbs';
import { CliError } from './cli-error';
import { EXIT } from './exit-codes';

export type PrintMode = { json: boolean; fields?: string[]; quiet: boolean };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function pick(value: unknown, fields: readonly string[]): unknown {
  if (!isRecord(value)) return value;
  const unknown = fields.filter((f) => !(f in value));
  if (unknown.length)
    throw new CliError({
      exit: EXIT.usage,
      code: 'usage',
      message: `unknown field ${unknown[0]} for --json`,
      lines: [`fields: ${Object.keys(value).join(', ')}`],
    });
  return Object.fromEntries(fields.map((f) => [f, value[f]]));
}

export function render(verb: Verb, output: unknown, mode: PrintMode): string {
  if (mode.quiet && verb.quiet) return lines(verb.quiet(output));
  if (mode.json || !verb.text) {
    const value = verb.json ? verb.json(output) : output;
    // A verb that streamed its JSON as it ran (`watch`) has nothing left to print.
    if (value === undefined) return '';
    if (!mode.fields) return `${JSON.stringify(value)}\n`;
    const list = verb.listKey && isRecord(value) ? value[verb.listKey] : undefined;
    const picked = Array.isArray(list)
      ? {
          ...(value as Record<string, unknown>),
          [verb.listKey!]: list.map((item) => pick(item, mode.fields!)),
        }
      : pick(value, mode.fields);
    return `${JSON.stringify(picked)}\n`;
  }
  return lines(verb.text(output));
}

const lines = (text: readonly string[]) =>
  text.map((line) => (line.endsWith('\n') ? line : `${line}\n`)).join('');
