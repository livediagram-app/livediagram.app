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
        // This guard's own tests spell the pattern out.
        !file.endsWith('cpu-budget-guard.test.mjs') &&
        /performance\.now\(\)/.test(added) &&
        !/wall-clock:/.test(added)
      )
        found.push(`${file}:${line}: ${added.trim()}`);
      line++;
    }
  }
  return found;
}

// The product folders: a forked product's file at the same path as another's is a copy of it.
const PRODUCTS = ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle'];

/**
 * The finds that aren't copies: a line another product already has, at the same path under its folder, in the
 * base (a fork's copy of an older budget) is left for the same pass as the original.
 * @param {string[]} found `file:line: text`
 * @param {(path: string) => string | null} readBase the file's text at the base, or null when it has none
 * @returns {string[]}
 */
export function notCopied(found, readBase) {
  return found.filter((entry) => {
    const match = entry.match(/^([^/]+)\/(.+?):\d+: (.*)$/);
    if (!match || !PRODUCTS.includes(match[1])) return true;
    const [, product, rest, text] = match;
    return !PRODUCTS.some((other) => {
      if (other === product) return false;
      const base = readBase(`${other}/${rest}`);
      return base !== null && base.split('\n').some((line) => line.trim() === text);
    });
  });
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
  const readBase = (path) => {
    try {
      return execFileSync('git', ['show', `${base}:${path}`], {
        encoding: 'utf8',
        maxBuffer: 1 << 26,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      return null;
    }
  };
  const found = notCopied(wallClockAdditions(diff), readBase);
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
