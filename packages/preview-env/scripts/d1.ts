// Ensures a Full preview's D1 exists and prints `d1_id=<uuid>` for $GITHUB_OUTPUT
// (docs/specs/016-platform/blueprints/pr-previews.md "Workflow: deploy-reusable.yml changes").
//
//   node scripts/d1.ts --pr 123

import { logLine } from '../src/log.ts';
import { d1Name, parsePrNumber } from '../src/names.ts';
import { flags, required } from './args.ts';
import { ensureD1 } from './cloudflare.ts';

try {
  const pr = parsePrNumber(required(flags(process.argv.slice(2)), 'pr'));
  const name = d1Name(pr);
  const { id, created } = await ensureD1(name);
  console.error(logLine('d1', { pr, name, result: created ? 'created' : 'existing' }));
  console.log(`d1_id=${id}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
