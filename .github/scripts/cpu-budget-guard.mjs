// Speed budgets in tests use CPU time (docs/ci.md "Speed budgets"): `cpuMsOf` / `cpuMsOfAsync` and
// `cpuBudgetMs` from @liveworkspace/vitest-config/cpu-time. A `performance.now()` budget also counts the
// time a test waits for a core on CI's shared runners, and turned main red at random. This fails when a
// change ADDS `performance.now()` to a test file in the group's folders, so the old ones are left for a
// pass of their own while no new one comes in. A line that truly needs the wall clock (it measures a
// timer, say) says so with a `wall-clock:` comment on the same line.
//
//   BASE=<sha or empty> PRODUCT=<livediagram|…, or empty for the platform> node .github/scripts/cpu-budget-guard.mjs

import { execFileSync } from 'node:child_process';

const TEST_FILE = /\.(test|spec|perf\.test)\.(m?[jt]sx?)$/;

/**
 * The added lines of a unified diff (`git diff -U0`) that start a wall-clock timing in a test file.
 * @param {string} diff
 * @returns {string[]} `file:line: text`
 */
export function wallClockAdditions(diff) {
  const found = [];
  let file = '';
  let line = 0;
  for (const text of diff.split('\n')) {
    if (text.startsWith('+++ ')) {
      file = text.replace(/^\+\+\+ (b\/)?/, '');
      continue;
    }
    const hunk = text.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (hunk) {
      line = Number(hunk[1]);
      continue;
    }
    if (text.startsWith('+')) {
      const added = text.slice(1);
      if (
        TEST_FILE.test(file) &&
        !/\/e2e\//.test(file) &&
        /performance\.now\(\)/.test(added) &&
        !/wall-clock:/.test(added)
      )
        found.push(`${file}:${line}: ${added.trim()}`);
      line++;
    }
  }
  return found;
}

function main() {
  const base = (process.env.BASE ?? '').trim();
  if (!base) {
    console.log('[cpu-budget-guard] no base: nothing to compare');
    return;
  }
  const product = (process.env.PRODUCT ?? '').trim();
  const paths = product ? [product] : ['packages', 'liveworkspace', 'scripts', '.github'];
  const diff = execFileSync(
    'git',
    ['diff', '-U0', '--diff-filter=ACMR', `${base}...HEAD`, '--', ...paths],
    {
      encoding: 'utf8',
      maxBuffer: 1 << 28,
    },
  );
  const found = wallClockAdditions(diff);
  if (found.length === 0) {
    console.log('[cpu-budget-guard] no new wall-clock timings in tests');
    return;
  }
  console.error(
    '[cpu-budget-guard] tests time with performance.now(); use cpuMsOf/cpuMsOfAsync and cpuBudgetMs from\n' +
      '@liveworkspace/vitest-config/cpu-time (docs/ci.md "Speed budgets"), or mark a real wall-clock\n' +
      'need with a `wall-clock:` comment on the line:',
  );
  for (const f of found) console.error(`  ${f}`);
  process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
