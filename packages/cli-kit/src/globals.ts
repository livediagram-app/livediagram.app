// The flags every product CLI's command takes, wherever they stand (each product's
// docs/specs/015-api/blueprints/cli.md "Global flags"); every other word is the command's.

import { CliError } from './cli-error';
import { EXIT } from './exit-codes';

/** How a command prints: JSON (optionally only some fields), quiet, or text. Each CLI's output/print.ts reads it. */
export type PrintMode = { json: boolean; fields?: string[]; quiet: boolean };

export type Globals = {
  host?: string;
  profile?: string;
  help: boolean;
  version: boolean;
  mode: PrintMode;
};

const VALUED = ['--host', '--profile'] as const;

// Every flag a command takes beside its own, as the spec's command table may name them.
export const GLOBAL_FLAGS: readonly string[] = [
  ...VALUED,
  '--json',
  '--quiet',
  '--help',
  '--version',
];

export function splitGlobals(argv: readonly string[]): { globals: Globals; words: string[] } {
  const globals: Globals = { help: false, version: false, mode: { json: false, quiet: false } };
  const words: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const word = argv[i]!;
    const valued = VALUED.find((name) => word === name || word.startsWith(`${name}=`));
    if (valued) {
      const value = word === valued ? argv[++i] : word.slice(valued.length + 1);
      if (!value)
        throw new CliError({ exit: EXIT.usage, code: 'usage', message: `${valued} needs a value` });
      globals[valued === '--host' ? 'host' : 'profile'] = value;
    } else if (word === '--json') globals.mode.json = true;
    else if (word.startsWith('--json=')) {
      globals.mode.json = true;
      globals.mode.fields = word.slice('--json='.length).split(',').filter(Boolean);
    } else if (word === '-q' || word === '--quiet') globals.mode.quiet = true;
    else if (word === '-h' || word === '--help') globals.help = true;
    else if (word === '--version') globals.version = true;
    else words.push(word);
  }
  return { globals, words };
}
