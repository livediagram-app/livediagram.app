import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  installStep,
  rootInstallStep,
  parseNameStatus,
  prePushSteps,
  pushedShas,
  testSteps,
} from './pre-push.mjs';
import { hooksPathAction } from './install.mjs';

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
const help = { dir: 'liveplanner/apps/help', name: '@liveplanner/help', vitest: true };
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
  helpApps: () => [help],
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
        'liveplanner: every telemetry event has a chart',
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

test('a deletion or rename runs every help app repo-paths test', () => {
  for (const status of ['D', 'R100']) {
    const steps = testSteps([{ status, path: 'docs/old.md' }], ctx);
    assert.deepEqual(
      steps.map((s) => [s.label, s.args.slice(-1)]),
      [['@liveplanner/help: repo paths in help articles', ['lib/repo-paths-in-docs.test.ts']]],
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
