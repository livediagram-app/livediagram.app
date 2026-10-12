// Tears down every preview whose PR is no longer open: the safety net for a teardown that
// failed or never ran (docs/specs/016-platform/pr-previews.md "Lifecycle").
//
//   node scripts/sweep.ts   (needs GH_TOKEN for `gh pr list`)

import { execFileSync } from 'node:child_process';

import { logLine } from '../src/log.ts';
import { sweepTargets } from '../src/sweep.ts';
import { listD1, listR2, listWorkers } from './cloudflare.ts';
import { teardown } from './teardown.ts';

try {
  const names = [
    ...(await listWorkers()),
    ...(await listD1()).map((db) => db.name),
    ...(await listR2()),
  ];
  const open = (
    JSON.parse(
      execFileSync('gh', ['pr', 'list', '--state', 'open', '--limit', '1000', '--json', 'number'], {
        encoding: 'utf8',
      }),
    ) as { number: number }[]
  ).map((p) => p.number);
  const targets = sweepTargets(names, open);
  console.log(logLine('sweep', { targets: targets.join(',') || '-', open: open.length }));
  for (const pr of targets) await teardown(pr, 'all');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
