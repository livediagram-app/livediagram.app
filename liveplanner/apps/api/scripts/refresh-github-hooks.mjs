// Reads GitHub's webhook ranges again (docs/specs/026-plan/github-pull-requests.md "Deliveries"; blueprint "Part 6"):
// fetches https://api.github.com/meta and rewrites `src/github/github-meta-hooks.json` with its `hooks` list and
// today's date. Run it by hand, `pnpm --filter @liveplanner/api github:hooks`; it is never part of a PR's checks, as
// a call to GitHub can fail for reasons of its own. When the list changed, `github-hook-ranges.test.ts` fails until
// `GITHUB_HOOK_RANGES` in `src/github/refused-signatures.ts` takes the same ranges.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const META_URL = 'https://api.github.com/meta';
const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, '../src/github/github-meta-hooks.json');

const response = await fetch(META_URL, {
  headers: { accept: 'application/vnd.github+json', 'user-agent': 'liveplanner-hook-ranges' },
});
if (!response.ok) {
  console.error(
    `[github-hooks] ${META_URL} answered ${response.status}; the saved copy is unchanged.`,
  );
  process.exit(1);
}
const meta = await response.json();
const hooks = Array.isArray(meta?.hooks) ? meta.hooks.filter((h) => typeof h === 'string') : [];
if (hooks.length === 0) {
  console.error('[github-hooks] /meta answered no hooks list; the saved copy is unchanged.');
  process.exit(1);
}

const before = JSON.parse(readFileSync(target, 'utf8')).hooks;
const saved = { source: META_URL, readOn: new Date().toISOString().slice(0, 10), hooks };
writeFileSync(target, `${JSON.stringify(saved, null, 2)}\n`);

const added = hooks.filter((h) => !before.includes(h));
const gone = before.filter((h) => !hooks.includes(h));
if (added.length === 0 && gone.length === 0) {
  console.log(`[github-hooks] unchanged: ${hooks.length} ranges.`);
} else {
  console.log(
    `[github-hooks] added: ${added.join(', ') || 'none'}; gone: ${gone.join(', ') || 'none'}.`,
  );
  console.log(
    '[github-hooks] update GITHUB_HOOK_RANGES in src/github/refused-signatures.ts to match.',
  );
}
