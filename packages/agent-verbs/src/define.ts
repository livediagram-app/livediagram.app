// What a verb is (each product's docs/specs/015-api/blueprints/cli.md "The verb"): one capability, with its input
// and output schemas, a factual description, its behaviour, a handler over the api, and how the CLI and the MCP
// project it. Each product binds `VerbContext` and `Verb` to its own read copies (its `define.ts`).

import type { z } from 'zod';
import type { ApiClient } from '@liveworkspace/api-client';

export type VerbBehaviour = 'read' | 'write' | 'destructive';

// `Copies` is the product's read-copy store (`ReadCopies<Tab>`, ./copies); verbs that never read it leave it
// unknown, so they run under every product's context.
export type VerbContext<Copies = unknown> = {
  api: ApiClient;
  // The host the profile talks to, for links and messages.
  host: string;
  // A share link's code, sent with every request of the command once a pasted link resolved.
  useShareCode: (code: string) => void;
  // A debug line; the CLI prints it under its `<PRODUCT>_DEBUG=1`.
  log: (line: string) => void;
  // A line for the person or agent running the command, beside the output (stderr in the CLI).
  notice: (line: string) => void;
  now: () => number;
  // A new file or tab id (crypto.randomUUID in the CLI).
  newId: () => string;
  sleep: (ms: number) => Promise<void>;
  // A file's text, or stdin's for `-`.
  readInput: (path: string) => Promise<string>;
  // The read copies; null where the front door keeps none.
  copies: Copies | null;
};

// A refusal a verb words itself, with the context the api lacks (which tab, what to run next). The front door
// maps `status` to its exit as it maps the api's.
export class VerbRefusal extends Error {
  readonly status: number;
  readonly code: string;
  readonly lines: string[];
  readonly hint: string;
  constructor(refusal: {
    status: number;
    code: string;
    message: string;
    lines?: string[];
    hint: string;
  }) {
    super(refusal.message);
    this.name = 'VerbRefusal';
    this.status = refusal.status;
    this.code = refusal.code;
    this.lines = refusal.lines ?? [];
    this.hint = refusal.hint;
  }
}

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
export type Verb<
  I extends z.ZodObject = z.ZodObject,
  O extends z.ZodType = z.ZodType,
  Ctx = VerbContext,
> = {
  // A bare word at the top (`guide`), a dotted path below it (`tab.ls`).
  id: string;
  summary: string;
  description: string;
  behaviour: VerbBehaviour;
  input: I;
  output: O;
  // A handler the CLI supplies, needing Node (CLI55).
  local?: true;
  // Needs no host: no profile, credential or api (guides, the skill); never counted.
  offline?: true;
  // Reads or writes the product's files on disk, in its bundled format: refused against a host that stores a
  // newer one (blueprint "One command" step 6).
  files?: true;
  run?: (ctx: Ctx, input: z.infer<I>) => Promise<z.infer<O>>;
  // Compact lines; absent prints JSON.
  text?: (output: z.infer<O>) => string[];
  // What `--json` prints, when it is not the output object itself; undefined prints nothing.
  json?: (output: z.infer<O>) => unknown;
  // `-q`: refs or ids.
  quiet?: (output: z.infer<O>) => string[];
  // A non-zero exit for an output that is not an error (a lint's error findings exit 1).
  exitCode?: (output: z.infer<O>) => number;
  // The array a list verb returns, for `--json` fields and the footer.
  listKey?: string;
  cli?: CliProjection;
  mcp?: { tool: string };
  // The `Cli·Used` type when it is not the verb's own (a `sync --watch` counts as SyncWatch, RL24).
  telemetryType?: (input: z.infer<I>) => string;
};

// Keeps the schemas' types flowing into the handler and the renderers. The shared verbs run under any product's
// context; a product's own `defineVerb` binds its context.
export function defineVerb<I extends z.ZodObject, O extends z.ZodType>(
  verb: Verb<I, O>,
): Verb<I, O> {
  return verb;
}
