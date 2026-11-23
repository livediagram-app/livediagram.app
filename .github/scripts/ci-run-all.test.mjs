import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { GUARD_DATA_HOST, forcesAll, forcesE2e, needsPlatformChecks } from './ci-run-all.mjs';

test('shared config and what every CI job runs check everything', () => {
  for (const file of [
    '.github/workflows/ci.yml',
    '.github/actions/setup/action.yml',
    '.github/actions/turbo-cache/action.yml',
    '.github/scripts/ci-plan.mjs',
    '.github/scripts/format-check.sh',
    '.github/scripts/coverage-floors.json',
    'package.json',
    'turbo.json',
    'pnpm-workspace.yaml',
    'liveplanner/package.json',
    '.prettierignore',
  ])
    assert.equal(forcesAll(file), true, file);
});

test('what only the e2e jobs run checks every E2E and the platform Checks, not everything', () => {
  for (const file of [
    '.github/workflows/e2e.yml',
    '.github/workflows/e2e-product.yml',
    '.github/actions/e2e-setup/action.yml',
    '.github/actions/next-cache-restore/action.yml',
    '.github/scripts/next-build-cold-retry.sh',
  ]) {
    assert.equal(forcesAll(file), false, file);
    assert.equal(forcesE2e(file), true, file);
    assert.equal(needsPlatformChecks(file), true, file);
  }
});

test('the rest of .github/ gets the platform Checks alone', () => {
  for (const file of [
    '.github/scripts/duplicate-guard.mjs',
    '.github/scripts/duplicate-baseline.txt',
    '.github/scripts/file-size-baseline.txt',
    '.github/scripts/deploy-group.mjs',
    '.github/scripts/cache-prune.test.mjs',
    '.github/workflows/deploy-staging.yml',
    '.github/workflows/codeql.yml',
    '.github/dependabot.yml',
  ]) {
    assert.equal(forcesAll(file), false, file);
    assert.equal(forcesE2e(file), false, file);
    assert.equal(needsPlatformChecks(file), true, file);
  }
});

test('ordinary files force nothing', () => {
  for (const file of ['packages/ui/src/Button.tsx', 'docs/ci.md', 'liveplanner/apps/editor/a.ts']) {
    assert.equal(forcesAll(file), false, file);
    assert.equal(forcesE2e(file), false, file);
    assert.equal(needsPlatformChecks(file), false, file);
  }
});

/** The local actions and `.github/scripts` files a workflow or action runs, as repository paths. */
function usedBy(path) {
  const text = readFileSync(path, 'utf8');
  const actions = [...text.matchAll(/uses:\s*\.\/(\.github\/actions\/[\w-]+)/g)].map(
    (m) => `${m[1]}/action.yml`,
  );
  const scripts = [...text.matchAll(/\.github\/scripts\/([\w.-]+\.(?:mjs|sh|json))/g)].map(
    (m) => `.github/scripts/${m[1]}`,
  );
  return [...new Set([...actions, ...scripts])];
}

/** Everything a workflow reaches, following local actions into the files they use. */
function reachedFrom(path) {
  const seen = new Set();
  const walk = (file) => {
    for (const used of usedBy(file)) {
      if (seen.has(used)) continue;
      seen.add(used);
      if (used.endsWith('action.yml') && existsSync(used)) walk(used);
    }
  };
  walk(path);
  return [...seen];
}

// Run by a workflow, yet the platform's Checks alone shows a change to them works: the repo guards scan
// the whole repository from that job as from any other; main-base runs only on a push to main; the drift
// and coverage reports are information, never a failure. Each has its own tests.
const PLATFORM_ENOUGH = new Set(
  ['duplicate-guard', 'file-size-guard', 'raw-html-guard', 'main-base', 'drift-report']
    .concat(['coverage-report'])
    .map((s) => `.github/scripts/${s}.mjs`),
);

test('every file ci.yml runs checks everything, but those the platform Checks shows', () => {
  const reached = reachedFrom('.github/workflows/ci.yml');
  assert.ok(reached.length >= 8);
  for (const file of reached)
    assert.ok(forcesAll(file) || PLATFORM_ENOUGH.has(file), `ci.yml runs ${file}`);
});

test('every file the E2E workflows run checks every E2E, or everything', () => {
  for (const workflow of ['.github/workflows/e2e.yml', '.github/workflows/e2e-product.yml'])
    for (const file of reachedFrom(workflow))
      assert.ok(
        forcesAll(file) || forcesE2e(file) || PLATFORM_ENOUGH.has(file),
        `${workflow} runs ${file}`,
      );
});

test('every file the platform Checks is enough for exists', () => {
  for (const file of PLATFORM_ENOUGH) assert.ok(existsSync(file), file);
});

test('every listed file exists, so a rename cannot leave a rule pointing nowhere', () => {
  const listed = [
    '.github/workflows/ci.yml',
    '.github/workflows/e2e.yml',
    '.github/workflows/e2e-product.yml',
    ...['setup', 'turbo-cache', 'turbo-cache-save', 'cancel-on-failure', 'e2e-setup']
      .concat(['next-cache-restore', 'next-cache-save'])
      .map((a) => `.github/actions/${a}/action.yml`),
    '.github/scripts/format-check.sh',
    '.github/scripts/coverage-floors.json',
    ...['ci-plan', 'ci-run-all', 'ci-readers', 'cpu-budget-guard', 'cancel-on-failure']
      .concat(['coverage-floors', 'lcov'])
      .map((s) => `.github/scripts/${s}.mjs`),
  ];
  for (const file of listed) assert.ok(existsSync(file), file);
});

test('the host workspace exists', () => {
  assert.ok(readdirSync('.github/scripts').some((name) => name.endsWith('-baseline.txt')));
  const host = 'packages/vitest-config/package.json';
  assert.ok(existsSync(host));
  assert.equal(JSON.parse(readFileSync(host, 'utf8')).name, GUARD_DATA_HOST);
});
