import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  areaOf,
  comparable,
  compareTrees,
  isText,
  normaliseNames,
  renderReport,
} from './drift-report.mjs';

test('either product name reads as one word, keeping its case shape', () => {
  assert.equal(normaliseNames('@livediagram/ui'), normaliseNames('@livehuddle/ui'));
  assert.equal(normaliseNames('LiveDiagram'), normaliseNames('LiveHuddle'));
  assert.equal(normaliseNames('LIVEDIAGRAM_URL'), normaliseNames('LIVEHUDDLE_URL'));
  assert.equal(normaliseNames('Livediagram'), normaliseNames('Livehuddle'));
  assert.equal(normaliseNames('liveDiagram'), normaliseNames('liveHuddle'));
  // Different case shapes stay different, so a real change in casing still counts.
  assert.notEqual(normaliseNames('livediagram'), normaliseNames('LiveHuddle'));
  assert.notEqual(normaliseNames('LiveDiagram'), normaliseNames('Livehuddle'));
  // Other products and words are left alone.
  assert.equal(normaliseNames('liveplanner diagram huddle'), 'liveplanner diagram huddle');
});

test('text is compared with names normalised, binary byte for byte', () => {
  assert.ok(isText(Buffer.from('hello')));
  assert.ok(!isText(Buffer.from([0x89, 0x50, 0x00, 0x47])));
  assert.equal(
    comparable(Buffer.from('livediagram.app')),
    comparable(Buffer.from('livehuddle.app')),
  );
  const png = (byte) => Buffer.from([0x89, 0x00, byte]);
  assert.equal(comparable(png(1)), comparable(png(1)));
  assert.notEqual(comparable(png(1)), comparable(png(2)));
});

test('each app and package is its own row; specs, docs and the rest group', () => {
  assert.equal(areaOf('apps/editor/components/Canvas.tsx'), 'apps/editor');
  assert.equal(areaOf('packages/ui/src/index.ts'), 'packages/ui');
  assert.equal(areaOf('docs/specs/007-editor/x.md'), 'docs/specs');
  assert.equal(areaOf('docs/specs/README.md'), 'docs/specs');
  assert.equal(areaOf('docs/README.md'), 'docs');
  assert.equal(areaOf('docs/development/architecture.md'), 'docs');
  assert.equal(areaOf('AGENTS.md'), '(other)');
  assert.equal(areaOf('apps/README.md'), '(other)');
});

test('files count as identical, changed or one-only, and one-only files are never read', () => {
  const unread = () => {
    throw new Error('read a file in one product only');
  };
  const left = new Map([
    ['apps/editor/a.ts', 'same'],
    ['apps/editor/b.ts', () => 'old'],
    ['apps/editor/c.ts', unread],
    ['packages/gone/x.ts', unread],
  ]);
  const right = new Map([
    ['apps/editor/a.ts', () => 'same'],
    ['apps/editor/b.ts', 'new'],
    ['apps/editor/d.ts', unread],
    ['packages/fresh/y.ts', unread],
  ]);
  const rows = compareTrees(left, right);
  assert.deepEqual(rows.get('apps/editor'), {
    identical: 1,
    changed: 1,
    leftOnly: 1,
    rightOnly: 1,
  });
  assert.deepEqual(rows.get('packages/gone'), {
    identical: 0,
    changed: 0,
    leftOnly: 1,
    rightOnly: 0,
  });
  assert.deepEqual(rows.get('packages/fresh'), {
    identical: 0,
    changed: 0,
    leftOnly: 0,
    rightOnly: 1,
  });
});

test('the report sorts by changes, folds one-product areas and totals', () => {
  const rows = new Map([
    ['apps/api', { identical: 5, changed: 1, leftOnly: 0, rightOnly: 0 }],
    ['apps/editor', { identical: 1200, changed: 30, leftOnly: 2, rightOnly: 1 }],
    ['packages/sticky-vision', { identical: 0, changed: 0, leftOnly: 7, rightOnly: 0 }],
    ['packages/tailwind-config', { identical: 0, changed: 0, leftOnly: 0, rightOnly: 2 }],
    ['packages/odd', { identical: 0, changed: 0, leftOnly: 1, rightOnly: 1 }],
  ]);
  const report = renderReport(rows, { forkedFrom: 'abc123' });
  const lines = report.trim().split('\n');
  assert.match(lines[0], /^## Drift report: livediagram and livehuddle$/);
  assert.match(lines[2], /forked from abc123/);
  assert.match(lines[2], /never fails a build/);
  const body = lines.slice(6);
  assert.deepEqual(body, [
    '| `apps/editor` | 1,200 | 30 | 2 | 1 |',
    '| `apps/api` | 5 | 1 | 0 | 0 |',
    '| `packages/odd` | 0 | 0 | 1 | 1 |',
    '| livediagram only: `packages/sticky-vision` | 0 | 0 | 7 | 0 |',
    '| livehuddle only: `packages/tailwind-config` | 0 | 0 | 0 | 2 |',
    '| **Total** | **1,205** | **31** | **10** | **4** |',
  ]);
  assert.doesNotMatch(renderReport(new Map()), /forked from/);
});

test('the script runs on this repository and exits 0', () => {
  const out = execFileSync('node', [new URL('./drift-report.mjs', import.meta.url).pathname], {
    env: { ...process.env, GITHUB_STEP_SUMMARY: '' },
  }).toString();
  assert.match(out, /## Drift report/);
  assert.match(out, /\*\*Total\*\*/);
});

test('outside a repository it says it could not compare, and still exits 0', () => {
  const out = execFileSync('node', [new URL('./drift-report.mjs', import.meta.url).pathname], {
    cwd: '/',
    env: { ...process.env, GITHUB_STEP_SUMMARY: '' },
    stdio: ['ignore', 'pipe', 'ignore'],
  }).toString();
  assert.match(out, /\[drift-report\] could not compare/);
});
