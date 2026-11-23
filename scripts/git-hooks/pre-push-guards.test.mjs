import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readersOf, repoReaders } from '../../.github/scripts/ci-readers.mjs';
import { mergedTests, mergedTree } from './merged-guards.mjs';
import {
  ciScriptSteps,
  ciScriptTests,
  enforcesCoverage,
  mergedSteps,
  readerSteps,
  scanTests,
  siteBuildStep,
  workspaceDirs,
} from './pre-push-guards.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** A repository in the temp directory holding `files` (path to text), committed. */
function repo(/** @type {Record<string, string>} */ files) {
  const dir = mkdtempSync(path.join(tmpdir(), 'pre-push-guards-'));
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), text);
  }
  const git = (/** @type {string[]} */ ...args) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir });
  git('init', '--quiet');
  git('add', '.');
  git('commit', '--quiet', '--no-verify', '-m', 'files');
  return dir;
}

test('scan tests are the tests that read files or are named a guard, never e2e or the chart tests', () => {
  const dir = repo({
    'apps/site/package.json': '{"name":"site"}',
    'apps/site/dark-pair-guard.test.ts': 'check(root);',
    'apps/site/lib/reads.test.ts': "readFileSync('x');",
    'apps/site/lib/lists.test.tsx': 'readdirSync(dir);',
    'apps/site/lib/greps.test.js': "execFileSync('git', ['grep']);",
    'apps/site/lib/plain.test.ts': 'expect(1).toBe(1);',
    'apps/site/lib/reads.ts': "readFileSync('x');",
    'apps/site/e2e/reads.test.ts': "readFileSync('x');",
    'apps/site/app/telemetry/liveplanner/metric-emitters.test.ts': "readFileSync('x');",
    'apps/other/reads.test.ts': "readFileSync('x');",
  });
  try {
    assert.deepEqual(scanTests(dir, 'apps/site'), [
      'dark-pair-guard.test.ts',
      'lib/greps.test.js',
      'lib/lists.test.tsx',
      'lib/reads.test.ts',
    ]);
    assert.deepEqual(scanTests(dir, 'apps/none'), []);
    assert.deepEqual([...workspaceDirs(dir)], [['site', 'apps/site']]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a workspace enforces coverage when its test:coverage runs vitest and its config sets thresholds', () => {
  const dir = repo({
    'gated/vitest.config.ts':
      'export default { test: { coverage: { thresholds: { lines: 100 } } } };',
    'open/vitest.config.ts': 'export default {};',
    'bare/readme.md': 'no config',
  });
  const scripts = { 'test:coverage': 'vitest run --coverage && vitest-budgets' };
  try {
    assert.equal(enforcesCoverage(dir, 'gated', scripts), true);
    assert.equal(enforcesCoverage(dir, 'gated', { test: 'vitest run' }), false);
    assert.equal(enforcesCoverage(dir, 'open', scripts), false);
    assert.equal(enforcesCoverage(dir, 'bare', scripts), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const ui = { dir: 'packages/ui', name: '@liveworkspace/ui', vitest: true };
const site = { dir: 'liveworkspace/apps/site', name: '@liveworkspace/site', vitest: true };
const readers = readersOf({
  tasks: {
    '@liveworkspace/ui#test': {
      inputs: [
        '$TURBO_DEFAULT$',
        '$TURBO_ROOT$/liveplanner/apps/**/*.tsx',
        '!$TURBO_ROOT$/**/out/**',
      ],
    },
    '@liveworkspace/site#test': { inputs: ['$TURBO_ROOT$/packages/**'] },
    '@liveworkspace/gone#test': { inputs: ['$TURBO_ROOT$/**'] },
  },
});
const readerCtx = {
  readers,
  /** @param {string} name */
  workspaceNamed: (name) => [ui, site].find((ws) => ws.name === name) ?? null,
  /** @param {string} dir */
  scanTests: (dir) =>
    dir === ui.dir ? ['src/callout/callout-guard.test.ts'] : ['a-guard.test.ts'],
  touched: new Set(/** @type {string[]} */ ([])),
};

test('a suite that reads what the push changes runs its scan tests, though the push never touches it', () => {
  const steps = readerSteps(
    [{ status: 'M', path: 'liveplanner/apps/editor/components/Note.tsx' }],
    { ...readerCtx, maxWorkers: 2 },
  );
  assert.deepEqual(steps, [
    {
      label: '@liveworkspace/ui: guard tests (it reads what the push changes)',
      cmd: 'pnpm',
      args: [
        '--filter',
        '@liveworkspace/ui',
        'exec',
        'vitest',
        'run',
        'src/callout/callout-guard.test.ts',
        '--testTimeout=60000',
        '--maxWorkers=2',
      ],
      parallel: true,
    },
  ]);
});

test('a reader the push changes itself, one out of reach, or one with no scan tests adds nothing', () => {
  const labels = (/** @type {string} */ file, /** @type {object} */ extra = {}) =>
    readerSteps([{ status: 'M', path: file }], { ...readerCtx, ...extra }).map((s) => s.label);
  // Its own guard step runs them.
  assert.deepEqual(
    labels('packages/ui/src/Button.tsx', { touched: new Set([ui.dir, site.dir]) }),
    [],
  );
  assert.deepEqual(labels('liveplanner/apps/editor/lib/a.ts'), []);
  assert.deepEqual(labels('liveplanner/apps/editor/out/Note.tsx'), []);
  assert.deepEqual(labels('packages/explorer/src/a.ts', { scanTests: () => [] }), []);
  assert.deepEqual(labels('packages/explorer/src/a.ts'), [
    '@liveworkspace/site: guard tests (it reads what the push changes)',
  ]);
});

test('the CI script tests run when the push changes a script they test', () => {
  const tests = ['.github/scripts/a.test.mjs', 'scripts/git-hooks/b.test.mjs'];
  const steps = (/** @type {string} */ file) => ciScriptSteps([{ status: 'M', path: file }], tests);
  assert.deepEqual(steps('.github/scripts/duplicate-guard.mjs'), [
    { label: 'CI script tests', cmd: 'node', args: ['--test', ...tests] },
  ]);
  assert.equal(steps('scripts/git-hooks/pre-push.mjs').length, 1);
  assert.deepEqual(steps('.github/workflows/ci.yml'), []);
  assert.deepEqual(steps('packages/ui/src/a.ts'), []);
  assert.deepEqual(ciScriptSteps([{ status: 'M', path: '.github/scripts/a.mjs' }], []), []);
});

test('the merged guards run only where main has moved on, and say what they did', () => {
  assert.deepEqual(mergedSteps(false), []);
  const [step] = mergedSteps(true);
  assert.deepEqual(step?.args, ['scripts/git-hooks/merged-guards.mjs']);
  assert.equal(step?.parallel, true);
  assert.equal(step?.show, true);
});

test('a merge is checked when git wrote its tree, and skipped with the reason otherwise', () => {
  const tree = 'a'.repeat(40);
  assert.deepEqual(mergedTree({ status: 0, stdout: `${tree}\n` }), { tree });
  assert.match(
    /** @type {{ skip: string }} */ (mergedTree({ status: 1, stdout: `${tree}\nCONFLICT\n` })).skip,
    /conflicts with origin\/main/,
  );
  assert.match(
    /** @type {{ skip: string }} */ (mergedTree({ status: 129, stdout: '' })).skip,
    /this git cannot merge/,
  );
});

test('the merged tree runs a small suite whole and a large one by its named guards, never a test that renders', () => {
  assert.deepEqual(
    mergedTests([
      'a-guard.test.ts',
      'src/art-rules.test.tsx',
      'history-state.test.js',
      'b.test.jsx',
    ]),
    ['a-guard.test.ts', 'history-state.test.js'],
  );
  const large = [
    'a-guard.test.ts',
    'b.guard.test.mjs',
    ...[1, 2, 3, 4, 5].map((n) => `lib/reads-${n}.test.ts`),
  ];
  assert.deepEqual(mergedTests(large), ['a-guard.test.ts', 'b.guard.test.mjs']);
  assert.equal(mergedTests(large.slice(0, 5)).length, 5);
});

test("the site's build is one step, off unless asked for", () => {
  assert.deepEqual(siteBuildStep().args, ['--filter', '@liveworkspace/site', 'build']);
  assert.notEqual(siteBuildStep().parallel, true);
});

// The repository itself: what the steps above lean on must stay true.
test("every suite turbo.json declares as a reader is a workspace with scan tests, the Callout guard's among them", () => {
  const dirs = workspaceDirs(ROOT);
  const all = repoReaders(path.join(ROOT, 'turbo.json'));
  for (const reader of all) {
    const dir = dirs.get(reader.name);
    assert.ok(dir, `${reader.name} names no workspace`);
    assert.ok(scanTests(ROOT, dir).length > 0, `${reader.name} has no scan tests`);
  }
  const scans = (/** @type {string} */ name) => scanTests(ROOT, dirs.get(name) ?? '');
  assert.ok(scans('@liveworkspace/ui').includes('src/callout/callout-guard.test.ts'));
  assert.ok(scans('@liveworkspace/next-config').includes('history-state.test.js'));
  assert.ok(scans('@liveworkspace/next-config').includes('apps-use-shared.test.js'));
  assert.ok(scans('@liveworkspace/site').includes('dark-pair-guard.test.ts'));
  assert.ok(scans('@liveworkspace/site').includes('hover-tie-guard.test.ts'));
  // A change to any app's or package's .tsx reaches the Callout guard, and any script the history guard.
  const reached = (/** @type {string} */ file) =>
    all
      .filter(
        (r) => r.include.some((re) => re.test(file)) && !r.exclude.some((re) => re.test(file)),
      )
      .map((r) => r.name);
  assert.ok(reached('packages/workbench/src/components/A.tsx').includes('@liveworkspace/ui'));
  assert.ok(reached('livehuddle/apps/editor/components/A.tsx').includes('@liveworkspace/ui'));
  assert.ok(reached('packages/help-site/src/a.ts').includes('@liveworkspace/next-config'));
  assert.ok(reached('packages/explorer/src/a.tsx').includes('@liveworkspace/site'));
});

test('the CI script tests on disk include this file and the planner readers', () => {
  const tests = ciScriptTests(ROOT);
  assert.ok(tests.includes('scripts/git-hooks/pre-push-guards.test.mjs'));
  assert.ok(tests.includes('.github/scripts/ci-readers.test.mjs'));
  assert.ok(tests.every((file) => existsSync(path.join(ROOT, file))));
});
