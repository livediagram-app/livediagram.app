// The flags every command takes, wherever they stand (docs/specs/015-api/blueprints/cli.md "Global flags");
// every other word is the command's.

import { CliError } from '../output/cli-error';
import { EXIT } from '../output/exit-codes';
import type { PrintMode } from '../output/print';

export type Globals = {
  host?: string;
  profile?: string;
  help: boolean;
  version: boolean;
  mode: PrintMode;
};

const VALUED = ['--host', '--profile'] as const;

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
