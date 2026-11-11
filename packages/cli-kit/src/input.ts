// What a command reads besides its arguments (`-f <file>`, `--body <file>`): a file, relative to the working
// directory, or stdin for `-`, which is never read from a terminal (the CLI never waits on a person).

import type { CliIo } from './io';
import { CliError } from './cli-error';
import { EXIT } from './exit-codes';

// An absolute path on any system the CLI runs on: POSIX `/x`, Windows `C:\x` or `C:/x`, and a UNC `\\host\x`.
const ABSOLUTE_PATH = /^(?:\/|[A-Za-z]:[\\/]|\\\\)/;

const resolved = (io: CliIo, path: string) =>
  ABSOLUTE_PATH.test(path) ? path : `${io.cwd}/${path}`;

// A file's bytes (`image add`'s picture), relative to the working directory. Never stdin: a picture is a file.
export function bytesReader(io: CliIo): (path: string) => Promise<Uint8Array> {
  return async (path) => {
    const bytes = await io.files.readBytes(resolved(io, path));
    if (bytes === null)
      throw new CliError({ exit: EXIT.usage, code: 'usage', message: `no file ${path}` });
    return bytes;
  };
}

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
    const text = await io.files.read(resolved(io, path));
    if (text === null)
      throw new CliError({ exit: EXIT.usage, code: 'usage', message: `no file ${path}` });
    return text;
  };
}
