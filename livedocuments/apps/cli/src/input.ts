// What a command reads besides its arguments (`-f <file>`, `--body <file>`): a file, relative to the working
// directory, or stdin for `-`, which is never read from a terminal (the CLI never waits on a person).

import type { CliIo } from './io';
import { CliError } from './output/cli-error';
import { EXIT } from './output/exit-codes';

export function inputReader(io: CliIo): (path: string) => Promise<string> {
  return async (path) => {
    if (path === '-') {
      if (io.stdinIsTTY)
        throw new CliError({
          exit: EXIT.usage,
          code: 'usage',
          message: '- reads stdin, which is a terminal here',
          hint: 'pipe the input in, or give a file',
        });
      return io.readStdin();
    }
    const text = await io.files.read(path.startsWith('/') ? path : `${io.cwd}/${path}`);
    if (text === null)
      throw new CliError({ exit: EXIT.usage, code: 'usage', message: `no file ${path}` });
    return text;
  };
}
