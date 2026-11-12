// After `next build` and scripts/asset-prefix.mjs: fails the build when a watched page's first-load JavaScript is over
// its budget (lib/first-load/budget.ts). Reads out/, or the export folder given.
import { fileURLToPath } from 'node:url';
import { checkFirstLoad } from '../lib/first-load/budget.ts';

const out = fileURLToPath(new URL(`../${process.argv[2] ?? 'out'}/`, import.meta.url));
const { ok, lines } = checkFirstLoad(out);
for (const line of lines) (ok ? console.log : console.error)(line);
if (!ok) {
  console.error(
    '[first-load] a page grew past its budget: find the import that pulled code into it (liveworkspace/docs/specs/010-site/blueprints/site.md "Performance and limits")',
  );
  process.exit(1);
}
