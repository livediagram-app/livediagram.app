// A product CLI's entry (each product's apps/cli/src/bin.ts runs it): the command, then the exit. Once the command
// is done, nothing it opened may keep the process alive: a room socket's close waits for the server's answer for up
// to ten seconds, and a process manager gives far less before it gives up on the process.

import { format } from 'node:util';
import { UPDATE_CHECK_ARG, type BinUpdate } from './update-check';

export const EXIT_GRACE_MS = 250;

type Run<Io> = (argv: string[], io: Io) => Promise<number>;

export type BinOptions = {
  // The update check (blueprint "Update check"): after each command, and the whole of a background copy's run.
  update?: BinUpdate;
  proc?: NodeJS.Process;
  cons?: Pick<Console, 'log' | 'info' | 'debug'>;
};

export async function runBin<Io>(run: Run<Io>, io: Io, options: BinOptions = {}): Promise<void> {
  const { proc = process, cons = console, update } = options;
  // stdout carries data only (each product's CLI blueprint I1): a shared module's console line would break --json.
  // Its log and info lines go to stderr; its debug lines are a developer's, never a CLI user's.
  cons.log = cons.info = (...args: unknown[]) => void proc.stderr.write(`${format(...args)}\n`);
  cons.debug = () => {};
  const argv = proc.argv.slice(2);
  if (update && argv[0] === UPDATE_CHECK_ARG && argv.length === 1) {
    // The background copy the update check started: it asks npm, stores the answer and runs no command.
    await update.refresh();
    proc.exitCode = 0;
  } else {
    const code = await run(argv, io);
    proc.exitCode = code;
    const notice = await update?.finish(code);
    if (notice) proc.stderr.write(`${notice}\n`);
  }
  // The grace starts once stdout and stderr have flushed: exiting sooner drops what a slow pipe reader has not
  // read yet.
  proc.stdout.write('', () =>
    proc.stderr.write('', () => setTimeout(() => proc.exit(), EXIT_GRACE_MS).unref()),
  );
}
