// `sync [--watch] [--relocate] [--dry-run] [--all]` (docs/specs/027-repositories/repository-link.md "Commands";
// blueprint "One sync pass", "`sync --watch`"): one pass of each link, its lines and the highest exit; `--watch`
// keeps syncing until Ctrl-C.

import { posix } from 'node:path';
import type { VerbContext } from '@livediagram/agent-verbs';
import { debugLog } from '../debug';
import type { CliIo } from '../io';
import { CliError } from '../output/cli-error';
import { EXIT, type ExitCode } from '../output/exit-codes';
import type { LinkFile } from '../link/link-file';
import { runSyncPass } from '../link/sync-run';
import { watchLink } from '../link/sync-watch';

export type SyncInput = { watch?: boolean; relocate?: boolean; dryRun?: boolean; all?: boolean };

export async function syncLinks(
  io: CliIo,
  ctx: VerbContext,
  apiBase: string,
  links: readonly LinkFile[],
  input: SyncInput,
): Promise<{ lines: string[]; exit: number }> {
  if (input.watch && input.dryRun)
    throw new CliError({
      exit: EXIT.usage,
      code: 'usage',
      message: '--dry-run writes nothing, so there is nothing to watch',
      hint: 'livediagram sync --dry-run',
    });
  const sync: VerbContext = { ...ctx, log: debugLog(io, 'sync') };
  const options = {
    io,
    ctx: sync,
    host: ctx.host,
    dryRun: Boolean(input.dryRun),
    relocate: Boolean(input.relocate),
  };
  if (input.watch) {
    const exits = await Promise.all(
      links.map((link) => watchLink({ ...options, link, apiBase, command: 'sync --watch' })),
    );
    return { lines: [], exit: Math.max(...exits) };
  }
  const lines: string[] = [];
  let exit: ExitCode = EXIT.done;
  for (const [i, link] of links.entries()) {
    if (input.all) lines.push(...(i > 0 ? [''] : []), posix.relative(io.cwd, link.path));
    const result = await runSyncPass({ ...options, link, command: 'sync' });
    lines.push(...result.lines);
    if (result.exit > exit) exit = result.exit;
  }
  return { lines, exit };
}
