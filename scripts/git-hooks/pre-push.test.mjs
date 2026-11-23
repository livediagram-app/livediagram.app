import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAP_MIN_FILES,
  CAP_SHARE,
  installStep,
  listedTests,
  pooled,
  rootInstallStep,
  parseNameStatus,
  prePushSteps,
  pushedShas,
  testPool,
  testSteps,
  testWorkers,
  touchedWorkspaces,
} from './pre-push.mjs';
import { hooksPathAction } from './install.mjs';
import { runSteps } from './pre-push-run.mjs';

const group = {
  group: 'liveplanner',
  filters: '--filter=a --filter=b',
  format: 'liveplanner',
  base: 'abc',
};

test('a group gets the fast checks only, after the repo-wide guards', () => {
  const labels = prePushSteps({ groups: [group] }).map((s) => s.label);
  assert.deepEqual(labels, [
    'no new copies across products',
    'no new files over 800 lines',
    'one path for markup',
    'liveplanner: lint and typecheck',
    'liveplanner: format',
    'liveplanner: speed budgets use CPU time',
  ]);
});

test('no group, no checks', () => {
  assert.deepEqual(prePushSteps({ groups: [] }), []);
});

test('lint and typecheck run through turbo with the group filters', () => {
  const lint = prePushSteps({ groups: [group] })[3];
  assert.deepEqual(lint?.args, [
    'exec',
    'turbo',
    'run',
    'lint',
    'typecheck',
    '--filter=a',
    '--filter=b',
    '--continue',
    '--concurrency=2',
  ]);
});

const editor = { dir: 'liveplanner/apps/editor', name: '@liveplanner/editor', vitest: true };
const help = { dir: 'liveworkspace/apps/help', name: '@liveworkspace/help', vitest: true };
const docs = { dir: 'docs', name: 'docs', vitest: false };
const site = { dir: 'liveworkspace/apps/site', name: '@liveworkspace/site', vitest: true };
const ctx = {
  /** @param {string} file */
  workspaceOf: (file) =>
    file.startsWith(editor.dir)
      ? editor
      : file.startsWith(help.dir)
        ? help
        : file.startsWith('docs')
          ? docs
          : null,
  /** @param {string} dir */
  guardTests: (dir) =>
    dir === editor.dir ? ['app/dark-palette.test.ts', 'lib/small-text-contrast.test.ts'] : [],
  helpApps: () => [
    {
      ws: help,
      tests: [
        'editions/livediagram/tests/repo-paths-in-docs.test.ts',
        'editions/liveplanner/tests/repo-paths-in-docs.test.ts',
      ],
    },
  ],
  /** @param {string} product */
  emitterTest: (product) =>
    product === 'liveplanner'
      ? { ws: site, file: 'app/telemetry/liveplanner/metric-emitters.test.ts' }
      : null,
};

test('changed code runs the tests that import it, then the guard tests', () => {
  const steps = testSteps(
    [
      { status: 'M', path: 'liveplanner/apps/editor/components/forms/a.tsx' },
      { status: 'A', path: 'liveplanner/apps/editor/components/forms/a.test.tsx' },
    ],
    ctx,
  );
  assert.deepEqual(
    steps.map((s) => [s.label, s.args]),
    [
      [
        '@liveplanner/editor: tests the change reaches',
        [
          '--filter',
          '@liveplanner/editor',
          'exec',
          'vitest',
          'related',
          'components/forms/a.test.tsx',
          'components/forms/a.tsx',
          '--run',
          '--passWithNoTests',
        ],
      ],
      [
        '@liveplanner/editor: guard tests',
        [
          '--filter',
          '@liveplanner/editor',
          'exec',
          'vitest',
          'run',
          'app/dark-palette.test.ts',
          'lib/small-text-contrast.test.ts',
        ],
      ],
      [
        'every telemetry event has a chart (liveplanner)',
        [
          '--filter',
          '@liveworkspace/site',
          'exec',
          'vitest',
          'run',
          'app/telemetry/liveplanner/metric-emitters.test.ts',
        ],
      ],
    ],
  );
});

test('a non-code change still runs the guard tests, but no related run', () => {
  const steps = testSteps([{ status: 'M', path: 'liveplanner/apps/editor/app/globals.css' }], ctx);
  assert.deepEqual(
    steps.map((s) => s.label),
    ['@liveplanner/editor: guard tests'],
  );
});

test('a workspace without vitest, or a file outside any workspace, runs nothing', () => {
  assert.deepEqual(
    testSteps(
      [
        { status: 'M', path: 'docs/ci.md' },
        { status: 'M', path: 'README.md' },
      ],
      ctx,
    ),
    [],
  );
});

test("a deletion or rename runs every edition's repo-paths test in the help centre", () => {
  for (const status of ['D', 'R100']) {
    const steps = testSteps([{ status, path: 'docs/old.md' }], ctx);
    assert.deepEqual(
      steps.map((s) => [s.label, s.args.slice(-2)]),
      [
        [
          '@liveworkspace/help: repo paths in help articles',
          [
            'editions/livediagram/tests/repo-paths-in-docs.test.ts',
            'editions/liveplanner/tests/repo-paths-in-docs.test.ts',
          ],
        ],
      ],
    );
  }
});

test('a deleted code file is not passed to vitest related', () => {
  const steps = testSteps([{ status: 'D', path: 'liveplanner/apps/editor/lib/gone.ts' }], ctx);
  assert.equal(
    steps.some((s) => s.args.includes('lib/gone.ts')),
    false,
  );
});

test('a busy machine caps every test run', () => {
  const steps = testSteps(
    [
      { status: 'M', path: 'liveplanner/apps/editor/lib/a.ts' },
      { status: 'D', path: 'docs/x.md' },
    ],
    { ...ctx, maxWorkers: 2 },
  );
  assert.equal(steps.length, 4);
  for (const s of steps) assert.equal(s.args.at(-1), '--maxWorkers=2');
});

test('every test step runs in the pool, and the checks before them in order', () => {
  const tests = testSteps([{ status: 'M', path: 'liveplanner/apps/editor/lib/a.ts' }], ctx);
  assert.equal(tests.length, 3);
  assert.equal(
    tests.every((s) => s.parallel === true),
    true,
  );
  assert.equal(
    prePushSteps({ groups: [group] }).some((s) => s.parallel),
    false,
  );
});

test('the pool is one on a busy machine, else one run per four cores, three at most', () => {
  assert.equal(testPool(10, 5), 1);
  assert.equal(testPool(10, 0.5), 2);
  assert.equal(testPool(16, 1), 3);
  assert.equal(testPool(2, 0), 1);
  // Busy: two workers a run. Side by side: an even share of the cores. Alone on a quiet machine: vitest's own.
  assert.equal(testWorkers(10, 5), 2);
  assert.equal(testWorkers(10, 0.5), 5);
  assert.equal(testWorkers(16, 1), 5);
  assert.equal(testWorkers(2, 0), undefined);
});

test('pooled runs every task, never more than the limit at once, and keeps their order', async () => {
  let running = 0;
  let most = 0;
  const task = (/** @type {number} */ n) => async () => {
    most = Math.max(most, ++running);
    await new Promise((resolve) => setTimeout(resolve, 5));
    running--;
    return n;
  };
  assert.deepEqual(await pooled([1, 2, 3, 4, 5].map(task), 2), [1, 2, 3, 4, 5]);
  assert.equal(most, 2);
  assert.deepEqual(await pooled([], 3), []);
});

test('a change that reaches most of a suite runs its changed tests and leaves the suite to CI', () => {
  const related = Array.from({ length: CAP_MIN_FILES }, (_, i) => `lib/t${i}.test.ts`);
  const reach = () => ({ related, total: Math.floor(CAP_MIN_FILES / CAP_SHARE) });
  const withTest = testSteps(
    [
      { status: 'M', path: 'liveplanner/apps/editor/lib/a.ts' },
      { status: 'M', path: 'liveplanner/apps/editor/lib/a.test.ts' },
    ],
    { ...ctx, reach },
  );
  assert.deepEqual(withTest[0]?.args, [
    '--filter',
    '@liveplanner/editor',
    'exec',
    'vitest',
    'run',
    'lib/a.test.ts',
  ]);
  assert.match(
    String(withTest[0]?.label),
    /its changed tests \(the change reaches 20 of 25 test files/,
  );
  // No changed test: nothing to run, and it says so. The guard tests still run.
  const without = testSteps([{ status: 'M', path: 'liveplanner/apps/editor/lib/a.ts' }], {
    ...ctx,
    reach,
  });
  assert.equal(without[0]?.skip, true);
  assert.match(String(without[0]?.label), /20 of 25 test files, CI runs the suite/);
  assert.equal(without[1]?.label, '@liveplanner/editor: guard tests');
});

test('a small suite, a narrow reach, or no answer from vitest runs what the change reaches', () => {
  const run = (/** @type {import('./pre-push.mjs').Reach | null} */ reached) =>
    testSteps([{ status: 'M', path: 'liveplanner/apps/editor/lib/a.ts' }], {
      ...ctx,
      reach: () => reached,
    })[0]?.label;
  const all = (/** @type {number} */ n) => Array.from({ length: n }, (_, i) => `t${i}.test.ts`);
  const reaches = '@liveplanner/editor: tests the change reaches';
  assert.equal(run({ related: all(CAP_MIN_FILES - 1), total: CAP_MIN_FILES - 1 }), reaches);
  assert.equal(run({ related: all(10), total: 100 }), reaches);
  assert.equal(run(null), reaches);
});

test("the site's own change leaves the emitters tests to their one run, which adds those it reaches", () => {
  const steps = testSteps(
    [
      { status: 'M', path: 'liveplanner/apps/editor/lib/a.ts' },
      { status: 'M', path: 'liveworkspace/apps/site/app/telemetry/lib.ts' },
    ],
    {
      ...ctx,
      workspaceOf: (file) =>
        file.startsWith('liveworkspace/apps/site/')
          ? { dir: 'liveworkspace/apps/site', name: '@liveworkspace/site', vitest: true }
          : ctx.workspaceOf(file),
      reach: (ws) =>
        ws.name === '@liveworkspace/site'
          ? {
              related: [
                'app/telemetry/livediagram/metric-emitters.test.ts',
                'app/telemetry/liveplanner/metric-emitters.test.ts',
                'lib/x.test.ts',
              ],
              total: 100,
            }
          : null,
    },
  );
  const site = steps.find((s) => s.label === '@liveworkspace/site: tests the change reaches');
  assert.deepEqual(site?.args.slice(-2), ['--exclude', 'app/telemetry/*/metric-emitters.test.ts']);
  const emitters = steps.filter((s) => s.label.includes('telemetry event'));
  assert.equal(emitters.length, 1);
  assert.equal(emitters[0]?.label, 'every telemetry event has a chart (livediagram, liveplanner)');
  assert.deepEqual(emitters[0]?.args.slice(5), [
    'app/telemetry/livediagram/metric-emitters.test.ts',
    'app/telemetry/liveplanner/metric-emitters.test.ts',
  ]);
});

test('several products share one emitters run', () => {
  const steps = testSteps(
    [
      { status: 'M', path: 'liveplanner/apps/editor/lib/a.ts' },
      { status: 'M', path: 'livedesign/apps/live/lib/a.ts' },
    ],
    {
      ...ctx,
      emitterTest: (product) => ({
        ws: { dir: 'liveworkspace/apps/site', name: '@liveworkspace/site', vitest: true },
        file: `app/telemetry/${product}/metric-emitters.test.ts`,
      }),
    },
  );
  const emitters = steps.filter((s) => s.label.includes('telemetry event'));
  assert.equal(emitters.length, 1);
  assert.equal(emitters[0]?.label, 'every telemetry event has a chart (livedesign, liveplanner)');
});

test('touched workspaces carry their changed code files, deletions left out', () => {
  const touched = touchedWorkspaces(
    [
      { status: 'M', path: 'liveplanner/apps/editor/lib/a.ts' },
      { status: 'M', path: 'liveplanner/apps/editor/README.md' },
      { status: 'D', path: 'liveplanner/apps/editor/lib/gone.ts' },
    ],
    ctx.workspaceOf,
  );
  assert.deepEqual(
    touched.map((t) => [t.ws.name, [...t.files]]),
    [['@liveplanner/editor', ['lib/a.ts']]],
  );
});

test('vitest list output keeps the test file lines only', () => {
  assert.deepEqual(
    listedTests(
      'lib/a.test.ts\n  src/b.test.tsx  \n\nNo test files found\n[warn] lib/c.test.ts skipped\n',
    ),
    ['lib/a.test.ts', 'src/b.test.tsx'],
  );
});

test('an install ends the run when it fails; nothing else does', () => {
  assert.equal(rootInstallStep(false)?.stop, true);
  assert.equal(
    prePushSteps({ groups: [group] }).some((s) => s.stop),
    false,
  );
});

test('a product with no emitters test, or a deleted file, runs no emitters check', () => {
  const labels = (/** @type {{ status: string, path: string }[]} */ changes) =>
    testSteps(changes, ctx).map((s) => s.label);
  assert.equal(
    labels([{ status: 'M', path: 'livediagram/apps/editor/a.ts' }]).some((l) =>
      l.includes('telemetry'),
    ),
    false,
  );
  assert.equal(
    labels([{ status: 'D', path: 'liveplanner/apps/editor/lib/gone.ts' }]).some((l) =>
      l.includes('telemetry'),
    ),
    false,
  );
});

test('name-status lines keep a rename new path', () => {
  assert.deepEqual(parseNameStatus('M\ta.ts\nR087\told.ts\tnew.ts\nD\tgone.ts\n'), [
    { status: 'M', path: 'a.ts' },
    { status: 'R087', path: 'new.ts' },
    { status: 'D', path: 'gone.ts' },
  ]);
});

test('pushed shas skip deletions and tags', () => {
  const sha = 'a'.repeat(40);
  assert.deepEqual(
    pushedShas(
      [
        `refs/heads/x ${sha} refs/heads/x ${'0'.repeat(40)}`,
        `refs/heads/y ${'0'.repeat(40)} refs/heads/y ${sha}`,
        `refs/tags/v1 ${sha} refs/tags/v1 ${'0'.repeat(40)}`,
      ].join('\n'),
    ),
    [sha],
  );
});

test('a HEAD:<branch> push is checked like any branch push', () => {
  const sha = 'b'.repeat(40);
  assert.deepEqual(pushedShas(`HEAD ${sha} refs/heads/work/x ${'0'.repeat(40)}`), [sha]);
});

const ws = { dir: 'liveplanner/apps/editor', name: 'e', vitest: true };
const installCtx = (/** @type {(dir: string) => boolean} */ hasModules) => ({
  workspaceOf: () => ws,
  hasModules,
});
const changes = [{ status: 'M', path: 'liveplanner/apps/editor/a.ts' }];

test('a worktree missing node_modules gets a frozen, filtered install without scripts first', () => {
  const step = installStep(
    { groups: [group] },
    changes,
    installCtx((dir) => dir === '.'),
  );
  assert.equal(step?.cmd, 'pnpm');
  assert.deepEqual(step?.args, [
    'install',
    '--frozen-lockfile',
    '--ignore-scripts',
    '--filter=a...',
    '--filter=b...',
  ]);
});

test('a missing root node_modules also installs', () => {
  assert.ok(
    installStep(
      { groups: [group] },
      changes,
      installCtx((dir) => dir !== '.'),
    ),
  );
});

test('a fully installed worktree, no groups, or only deletions install nothing', () => {
  assert.equal(
    installStep(
      { groups: [group] },
      changes,
      installCtx(() => true),
    ),
    null,
  );
  assert.equal(
    installStep(
      { groups: [] },
      changes,
      installCtx(() => false),
    ),
    null,
  );
  const gone = [{ status: 'D', path: 'x/y.ts' }];
  assert.equal(
    installStep(
      { groups: [group] },
      gone,
      installCtx((dir) => dir !== 'x'),
    ),
    null,
  );
});

test('filters already ending in ... are not doubled', () => {
  const step = installStep(
    { groups: [{ ...group, filters: '--filter=a... --filter=a...' }] },
    changes,
    installCtx(() => false),
  );
  assert.deepEqual(step?.args.slice(3), ['--filter=a...']);
});

test('install never rewrites a core.hooksPath that is already set, to any value', () => {
  const base = { ci: false, insideWorkTree: true };
  assert.equal(hooksPathAction({ ...base, current: '' }), 'set');
  assert.equal(hooksPathAction({ ...base, current: '.githooks' }), 'unchanged');
  assert.equal(
    hooksPathAction({ ...base, current: '/Users/me/liveworkspace/.githooks' }),
    'unchanged',
  );
  assert.equal(hooksPathAction({ ...base, current: '.husky' }), 'unchanged');
  assert.equal(hooksPathAction({ ci: true, insideWorkTree: true, current: '' }), 'skip-ci');
  assert.equal(hooksPathAction({ ci: false, insideWorkTree: false, current: '' }), 'skip-no-git');
});

test('a root without node_modules installs itself alone before planning', () => {
  assert.deepEqual(rootInstallStep(false)?.args, [
    'install',
    '--frozen-lockfile',
    '--ignore-scripts',
    '--filter=.',
  ]);
  assert.equal(rootInstallStep(true), null);
});

// The runner itself, on real processes: `node -e` stands in for a check or a test run.
const node = (/** @type {string} */ label, /** @type {number} */ code, extra = {}) => ({
  label,
  cmd: process.execPath,
  args: ['-e', `console.log(${JSON.stringify(label)} + ' ran'); process.exit(${code})`],
  ...extra,
});

/** Runs the steps, what they say collected. @param {import('./pre-push.mjs').Step[]} steps */
async function ran(steps, pool = 2) {
  /** @type {string[]} */
  const lines = [];
  const say = (/** @type {string} */ line) => void lines.push(line);
  const status = await runSteps(process.cwd(), steps, process.env, pool, {
    log: say,
    error: say,
    write: say,
  });
  return { status, text: lines.join('\n') };
}

test('every failing step is reported in one run, checks and test runs alike', async () => {
  const { status, text } = await ran([
    { ...node('lint', 1), args: ['-e', 'process.exit(1)'] },
    { ...node('format', 0), args: ['-e', ''] },
    node('tests a', 1, { parallel: true }),
    node('tests b', 0, { parallel: true }),
    node('tests c', 2, { parallel: true }),
  ]);
  assert.equal(status, 1);
  assert.match(text, /failed: lint \(exit 1\)/);
  assert.match(text, /3 test runs, 2 at a time/);
  assert.match(text, /passed in \d+ s: tests b/);
  // A failing run's own output is printed; a passing one's is not.
  assert.match(text, /tests a ran/);
  assert.doesNotMatch(text, /tests b ran/);
  assert.match(
    text,
    /3 failed in \d+ s:\n\[pre-push\] {3}lint\n\[pre-push\] {3}tests a\n\[pre-push\] {3}tests c/,
  );
});

test('all passing says so, and a skipped step runs nothing', async () => {
  const { status, text } = await ran([
    {
      label: 'the change reaches 20 of 20 test files, CI runs the suite',
      cmd: '',
      args: [],
      skip: true,
    },
    node('tests a', 0, { parallel: true }),
  ]);
  assert.equal(status, 0);
  assert.match(text, /skipped: the change reaches 20 of 20/);
  assert.match(text, /\[pre-push\] passed in \d+ s$/);
});

test('a failed install ends the run: nothing after it is tried', async () => {
  const { status, text } = await ran([
    { ...node('install', 1, { stop: true }), args: ['-e', 'process.exit(1)'] },
    { ...node('lint', 0), args: ['-e', 'require("fs").writeFileSync("/dev/null", "")'] },
    node('tests a', 0, { parallel: true }),
  ]);
  assert.equal(status, 1);
  assert.match(text, /1 failed/);
  assert.doesNotMatch(text, /lint|tests a/);
});

test('a command that cannot start is a failure, not a crash', async () => {
  const { status, text } = await ran([
    { label: 'tests gone', cmd: 'no-such-command-here', args: [], parallel: true },
  ]);
  assert.equal(status, 1);
  assert.match(text, /failed: tests gone/);
});
