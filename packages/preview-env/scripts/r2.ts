// Ensures a Full preview's R2 bucket exists
// (docs/specs/016-platform/blueprints/pr-previews.md "Workflow: deploy-reusable.yml changes").
//
//   node scripts/r2.ts --pr 123

import { logLine } from '../src/log.ts';
import { parsePrNumber, r2Name } from '../src/names.ts';
import { flags, required } from './args.ts';
import { ensureR2 } from './cloudflare.ts';

try {
  const pr = parsePrNumber(required(flags(process.argv.slice(2)), 'pr'));
  const name = r2Name(pr);
  const created = await ensureR2(name);
  console.log(logLine('r2', { pr, name, result: created ? 'created' : 'existing' }));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
