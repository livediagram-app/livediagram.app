// A product CLI's entry (each product's apps/cli/src/bin.ts runs it): the command, then the exit. Once the command
// is done, nothing it opened may keep the process alive: a room socket's close waits for the server's answer for up
// to ten seconds, and a process manager gives far less before it gives up on the process.

export const EXIT_GRACE_MS = 250;

type Run<Io> = (argv: string[], io: Io) => Promise<number>;

export async function runBin<Io>(
  run: Run<Io>,
  io: Io,
  proc: NodeJS.Process = process,
): Promise<void> {
  proc.exitCode = await run(proc.argv.slice(2), io);
  // The grace starts once stdout and stderr have flushed: exiting sooner drops what a slow pipe reader has not
  // read yet.
  proc.stdout.write('', () =>
    proc.stderr.write('', () => setTimeout(() => proc.exit(), EXIT_GRACE_MS).unref()),
  );
}
