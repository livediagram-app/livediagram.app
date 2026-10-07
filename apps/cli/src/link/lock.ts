// The lock (docs/specs/027-repositories/repository-link.md "Commands"; blueprint "The lock"): one pass at a time per
// link, an O_EXCL file in the local sync state naming its holder. A holder on this machine that is no longer alive is
// stale and taken over (RL34); otherwise a second pass polls every SYNC_LOCK_POLL_MS and gives up after
// SYNC_LOCK_WAIT_MS, exit 5, naming the holder's process (RL18).

import { posix } from 'node:path';
import type { DebugLog } from '../debug';
import type { CliIo } from '../io';
import { CliError } from '../output/cli-error';
import { EXIT } from '../output/exit-codes';
import { SYNC_LOCK_POLL_MS, SYNC_LOCK_WAIT_MS } from './constants';

export type LinkLock = { release(): Promise<void> };

type Holder = { pid: number; hostname: string };

async function holderOf(io: CliIo, path: string): Promise<Holder | null> {
  try {
    const holder = JSON.parse((await io.files.read(path)) ?? '') as Holder;
    return typeof holder.pid === 'number' ? holder : null;
  } catch {
    return null;
  }
}

export async function acquireLinkLock(
  io: CliIo,
  stateDir: string,
  linkPath: string,
  command: string,
  log: DebugLog,
): Promise<LinkLock> {
  const path = posix.join(stateDir, 'lock');
  const take = () =>
    io.files.createExclusive(
      path,
      JSON.stringify({ pid: io.pid, hostname: io.hostname, startedAt: io.now(), command }),
    );
  const started = io.now();
  let taken = await take();
  if (!taken) {
    let holder = await holderOf(io, path);
    if (holder && holder.hostname === io.hostname && !io.processAlive(holder.pid)) {
      log(`lock stale ${holder.pid}`);
      await io.files.remove(path);
      taken = await take();
      // Another pass took it first.
      if (!taken) holder = await holderOf(io, path);
    }
    const pid = holder?.pid ?? '?';
    if (!taken) log(`lock-wait ${pid}`);
    while (!taken) {
      if (io.now() - started >= SYNC_LOCK_WAIT_MS)
        throw new CliError({
          exit: EXIT.conflict,
          code: 'lock_held',
          message: `another sync of ${linkPath} is running (process ${pid})`,
          hint: `wait for it, or stop process ${pid}`,
        });
      await io.sleep(SYNC_LOCK_POLL_MS);
      taken = await take();
    }
  }
  log('lock taken');
  return {
    release: async () => {
      await io.files.remove(path);
      log('lock released');
    },
  };
}
