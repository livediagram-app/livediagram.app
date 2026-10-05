// Which verb a command line names (docs/specs/015-api/blueprints/cli.md "One command, start to end" step 1):
// a resource and a verb, or a top-level verb; aliases resolved; unknown words refused with a suggestion.

import {
  RESOURCE_ALIASES,
  RESOURCES,
  TOP_LEVEL,
  verbById,
  verbsOf,
  type Verb,
} from '@livediagram/agent-verbs';
import { CliError } from '../output/cli-error';
import { EXIT } from '../output/exit-codes';
import { didYouMean } from './did-you-mean';

export type Routed =
  | { kind: 'top' }
  | { kind: 'resource'; resource: string }
  | { kind: 'verb'; verb: Verb; rest: string[] };

const RESOURCE_NAMES = RESOURCES.map((r) => r.name);

export function route(words: readonly string[]): Routed {
  const [first, second, ...rest] = words;
  if (first === undefined) return { kind: 'top' };
  const top = TOP_LEVEL.find((t) => t === first);
  if (top) return { kind: 'verb', verb: verbById(top)!, rest: words.slice(1) };
  const resource = RESOURCE_ALIASES[first] ?? first;
  if (!RESOURCE_NAMES.includes(resource)) {
    const near = didYouMean(first, [...RESOURCE_NAMES, ...TOP_LEVEL]);
    throw new CliError({
      exit: EXIT.usage,
      code: 'usage',
      message: `unknown command "${first}"`,
      ...(near ? { lines: [`did you mean: ${near}`] } : {}),
      hint: 'livediagram --help',
    });
  }
  if (second === undefined) return { kind: 'resource', resource };
  const verb = verbById(`${resource}.${second}`);
  if (verb) return { kind: 'verb', verb, rest };
  const near = didYouMean(
    second,
    verbsOf(resource).map((v) => v.id.slice(resource.length + 1)),
  );
  throw new CliError({
    exit: EXIT.usage,
    code: 'usage',
    message: `unknown verb "${second}" for "${resource}"`,
    ...(near ? { lines: [`did you mean: ${near}`] } : {}),
    hint: `livediagram ${resource} --help`,
  });
}
