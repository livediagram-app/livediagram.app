// Deletes what a PR's preview owns, in `teardownPlan` order; a missing resource counts as done,
// so a rerun finishes what a failed run started
// (docs/specs/016-platform/blueprints/pr-previews.md "Teardown").
//
//   node scripts/teardown.ts --pr 123 --scope all|full

import { logLine } from '../src/log.ts';
import { parsePrNumber, type PrNumber } from '../src/names.ts';
import { parseScope, teardownPlan, type TeardownScope } from '../src/teardown.ts';
import { flags, required } from './args.ts';
import { deleteD1, deleteWorker, emptyAndDeleteR2 } from './cloudflare.ts';

export async function teardown(pr: PrNumber, scope: TeardownScope): Promise<void> {
  for (const step of teardownPlan(pr, scope)) {
    const result =
      step.kind === 'worker'
        ? await deleteWorker(step.name)
        : step.kind === 'r2'
          ? await emptyAndDeleteR2(step.name)
          : await deleteD1(step.name);
    console.log(logLine('teardown', { pr, kind: step.kind, name: step.name, result }));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = flags(process.argv.slice(2));
    await teardown(parsePrNumber(required(args, 'pr')), parseScope(required(args, 'scope')));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
