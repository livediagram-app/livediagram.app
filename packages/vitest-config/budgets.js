#!/usr/bin/env node
/**
 * `vitest-budgets`: run a workspace's speed budgets without coverage (docs/ci.md "Speed budgets").
 *
 * A coverage run makes `cpuBudgetMs` unbounded (cpu-time.js), because instrumentation sets the pace there, so
 * this reruns every test file that imports `@liveworkspace/vitest-config/cpu-time`, plain, where each budget
 * holds. Arguments pass through to `vitest run` (a CI editor shard adds `--shard=n/3`). A workspace with no such
 * file runs nothing.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Folders that never hold a workspace's own tests. */
const SKIP = new Set([
  'node_modules',
  'coverage',
  'dist',
  'build',
  'out',
  '.next',
  '.next-dev',
  '.turbo',
  '.wrangler',
]);

/** A test file name, as the shared config includes them. */
const TEST_FILE = /\.(test|spec)\.(ts|tsx|js|mjs)$/;

/** The import every speed budget makes. */
const BUDGET_IMPORT = '@liveworkspace/vitest-config/cpu-time';

/**
 * The test files under `root` that import the CPU-time helpers, relative to `root` and sorted, so a shard
 * always gets the same share. The import is a plain text check: a file that names it holds a budget.
 *
 * @param {string} root
 * @returns {string[]}
 */
export function budgetFiles(root) {
  /** @type {string[]} */
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP.has(entry.name) && !entry.name.startsWith('.')) walk(join(dir, entry.name));
      } else if (TEST_FILE.test(entry.name)) {
        const path = join(dir, entry.name);
        if (readFileSync(path, 'utf8').includes(BUDGET_IMPORT)) found.push(relative(root, path));
      }
    }
  };
  walk(root);
  return found.sort();
}

/* c8 ignore start -- the command itself: spawns vitest, exercised by every workspace's test:coverage. */
// pnpm's bin shim calls this file through node_modules' symlinks, so compare real paths.
if (
  process.argv[1] &&
  realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])
) {
  const files = budgetFiles(process.cwd());
  if (files.length === 0) {
    console.log('[vitest-budgets] no speed budgets here');
    process.exit(0);
  }
  console.log(`[vitest-budgets] ${files.length} file(s) with speed budgets, without coverage`);
  const run = spawnSync(
    'vitest',
    ['run', '--passWithNoTests', ...process.argv.slice(2), ...files],
    { stdio: 'inherit' },
  );
  process.exit(run.status ?? 1);
}
/* c8 ignore stop */
