// What a verb is (docs/specs/015-api/blueprints/cli.md "The verb"): one capability, with its input and
// output schemas, a factual description, its behaviour, a handler over the api, and how the CLI and the
// MCP project it.

import type { z } from 'zod';
import type { ApiClient } from '@livediagram/api-client';

export type VerbBehaviour = 'read' | 'write' | 'destructive';

export type VerbContext = {
  api: ApiClient;
  // The host the profile talks to, for links and messages.
  host: string;
  // A share link's code, sent with every request of the command once a pasted link resolved.
  useShareCode: (code: string) => void;
  // A debug line; the CLI prints it under LIVEDIAGRAM_DEBUG=1.
  log: (line: string) => void;
};

export type CliProjection = {
  // Input keys in order; a trailing `...name` takes the rest of the words.
  positionals: string[];
  // Input key to flag, when the flag is not the key in kebab case.
  flags?: Record<string, { name?: string; short?: string }>;
  examples: [string, string];
  // One line: what stdout holds.
  prints: string;
};

// Inputs are objects: their keys become positionals and flags.
export type Verb<I extends z.ZodObject = z.ZodObject, O extends z.ZodType = z.ZodType> = {
  id: `${string}.${string}` | string;
  summary: string;
  description: string;
  behaviour: VerbBehaviour;
  input: I;
  output: O;
  // A handler the CLI supplies, needing Node (CLI55).
  local?: true;
  run?: (ctx: VerbContext, input: z.infer<I>) => Promise<z.infer<O>>;
  // Compact lines; absent prints JSON.
  text?: (output: z.infer<O>) => string[];
  // What `--json` prints, when it is not the output object itself.
  json?: (output: z.infer<O>) => unknown;
  // `-q`: refs or ids.
  quiet?: (output: z.infer<O>) => string[];
  // A non-zero exit for an output that is not an error (the lint's error findings exit 1).
  exitCode?: (output: z.infer<O>) => number;
  // The array a list verb returns, for `--json` fields and the footer.
  listKey?: string;
  cli?: CliProjection;
  mcp?: { tool: string };
};

// Keeps the schemas' types flowing into the handler and the renderers.
export function defineVerb<I extends z.ZodObject, O extends z.ZodType>(
  verb: Verb<I, O>,
): Verb<I, O> {
  return verb;
}
