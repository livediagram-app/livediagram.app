import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  BASELINE,
  LIMIT,
  compare,
  countLines,
  findOversized,
  formatBaseline,
  isCandidate,
  parseBaseline,
  report,
} from './file-size-guard.mjs';

const linesOf = (/** @type {number} */ n) => 'x\n'.repeat(n);

test('a candidate is a hand-written, non-test source file anywhere in the repository', () => {
  assert.equal(isCandidate('livediagram/apps/editor/lib/a.ts'), true);
  assert.equal(isCandidate('packages/ui/src/B.tsx'), true);
  assert.equal(isCandidate('liveworkspace/apps/site/a.ts'), true);
  assert.equal(isCandidate('.github/scripts/ci-plan.mjs'), true);
  assert.equal(isCandidate('livediagram/scripts/e2e-stack.mjs'), true);
  assert.equal(isCandidate('livediagram/apps/editor/lib/a.test.ts'), false);
  assert.equal(isCandidate('livediagram/apps/editor/lib/a.spec.tsx'), false);
  assert.equal(isCandidate('livediagram/apps/editor/__tests__/a.ts'), false);
  assert.equal(isCandidate('livediagram/apps/editor/next-env.d.ts'), false);
  assert.equal(isCandidate('livediagram/apps/api/worker-configuration.d.ts'), false);
  assert.equal(isCandidate('livediagram/packages/icons/src/generated/a.ts'), false);
  assert.equal(isCandidate('liveplanner/apps/api/src/openapi/schemas.generated.ts'), false);
  assert.equal(isCandidate('docs/ci.md'), false);
  assert.equal(isCandidate('livediagram/apps/editor/app/globals.css'), false);
});

test('lines count like wc -l, plus a last line with no newline', () => {
  assert.equal(countLines(''), 0);
  assert.equal(countLines('a'), 1);
  assert.equal(countLines('a\n'), 1);
  assert.equal(countLines('a\nb'), 2);
  assert.equal(countLines('a\n\nb\n'), 3);
});

test('only candidates over the limit are found, sorted; non-candidates are never read', () => {
  /** @type {Record<string, string | null>} */
  const tree = {
    'b/big.ts': linesOf(LIMIT + 1),
    'a/big.tsx': linesOf(LIMIT + 50),
    'a/edge.ts': linesOf(LIMIT),
    'a/long-lines.ts': `${'y'.repeat(5000)}\n`,
    'a/big.test.ts': linesOf(LIMIT + 1),
    'a/big.md': linesOf(LIMIT + 1),
    'a/gone.ts': null,
  };
  /** @type {string[]} */
  const read = [];
  const found = findOversized(Object.keys(tree), (f) => {
    read.push(f);
    return tree[f] ?? null;
  });
  assert.deepEqual(found, [
    { file: 'a/big.tsx', lines: LIMIT + 50 },
    { file: 'b/big.ts', lines: LIMIT + 1 },
  ]);
  assert.ok(!read.includes('a/big.md') && !read.includes('a/big.test.ts'));
});

test('the baseline round-trips, comments and blank lines aside', () => {
  const text = formatBaseline(['b/x.ts', 'a/y.ts']);
  assert.match(text, /^# /);
  assert.deepEqual(parseBaseline(text), ['a/y.ts', 'b/x.ts']);
  assert.deepEqual(parseBaseline('\n# note\n  a.ts  \n\n'), ['a.ts']);
});

test('a file over the limit that the baseline does not list fails, named with its size', () => {
  const diff = compare([{ file: 'a/new.ts', lines: 900 }], []);
  assert.deepEqual(diff, { added: [{ file: 'a/new.ts', lines: 900 }], stale: [] });
  assert.match(report(diff) ?? '', /a\/new\.ts \(900 lines\)/);
});

test('a listed file may stay over the limit, and may grow', () => {
  const diff = compare([{ file: 'a/data.ts', lines: 5000 }], ['a/data.ts']);
  assert.deepEqual(diff, { added: [], stale: [] });
  assert.equal(report(diff), null);
});

test('a listed file now under the limit, or gone, makes the baseline stale', () => {
  const diff = compare([], ['a/split.ts', 'a/deleted.ts']);
  assert.deepEqual(diff.stale, ['a/split.ts', 'a/deleted.ts']);
  assert.match(report(diff) ?? '', /--update/);
});

test('the stale list is cut at twenty names', () => {
  const many = Array.from({ length: 25 }, (_, i) => `f${i}.ts`);
  assert.match(report({ added: [], stale: many }) ?? '', /… and 5 more/);
});

test('the repository matches its committed baseline', () => {
  const out = execFileSync('node', ['.github/scripts/file-size-guard.mjs'], { encoding: 'utf8' });
  assert.match(out, /no new ones/);
  assert.ok(parseBaseline(readFileSync(BASELINE, 'utf8')).length > 0);
});
