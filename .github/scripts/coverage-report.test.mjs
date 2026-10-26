// node --test .github/scripts  (run by CI's platform Checks)
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  REPORT_END,
  REPORT_START,
  addedLines,
  mergeLcov,
  parseArtifact,
  patchLine,
  renderReport,
  totalsOf,
  withReport,
} from './coverage-report.mjs';

const lcov = (/** @type {string} */ file, /** @type {string[]} */ rows) =>
  [`SF:${file}`, ...rows, 'end_of_record'].join('\n');

test('names: group and kind, nothing else', () => {
  assert.deepEqual(parseArtifact('coverage-livediagram-tests'), {
    group: 'livediagram',
    kind: 'tests',
  });
  assert.deepEqual(parseArtifact('coverage-platform-editor-2'), {
    group: 'platform',
    kind: 'editor-2',
  });
  assert.equal(parseArtifact('coverage-other-tests'), null);
  assert.equal(parseArtifact('playwright-report'), null);
});

test('shards merge: a line any shard hit is hit, a branch any shard took is taken', () => {
  const coverage = new Map();
  mergeLcov(lcov('a.ts', ['DA:1,0', 'DA:2,3', 'BRDA:2,0,0,1', 'BRDA:2,0,1,0']), coverage);
  mergeLcov(lcov('a.ts', ['DA:1,5', 'DA:2,0', 'BRDA:2,0,0,0', 'BRDA:2,0,1,-']), coverage);
  // Line 2's second branch was never taken by either shard: partly covered.
  assert.deepEqual(totalsOf(coverage), { files: 1, lines: 2, hits: 1, misses: 0, partials: 1 });
  mergeLcov(lcov('a.ts', ['DA:2,1', 'BRDA:2,0,1,2']), coverage);
  assert.deepEqual(totalsOf(coverage), { files: 1, lines: 2, hits: 2, misses: 0, partials: 0 });
});

test('totals over some files, and over only the changed lines', () => {
  const coverage = new Map();
  mergeLcov(lcov('livediagram/x.ts', ['DA:1,1', 'DA:2,0', 'DA:3,1']), coverage);
  mergeLcov(lcov('packages/y.ts', ['DA:1,0']), coverage);
  assert.equal(totalsOf(coverage, (f) => f.startsWith('livediagram/')).lines, 3);
  const changed = new Map([
    ['livediagram/x.ts', new Set([2, 3, 9])],
    ['README.md', new Set([1])],
  ]);
  assert.deepEqual(
    totalsOf(coverage, () => true, changed),
    {
      files: 1,
      lines: 2,
      hits: 1,
      misses: 1,
      partials: 0,
    },
  );
});

test('a -U0 diff gives each file its added lines, deletions and removed files none', () => {
  const diff = [
    'diff --git a/x.ts b/x.ts',
    '--- a/x.ts',
    '+++ b/x.ts',
    '@@ -3 +3,2 @@ ctx',
    '-old',
    '+new',
    '+newer',
    '@@ -10,2 +11,0 @@',
    '-gone',
    '-gone',
    '@@ -20 +19 @@',
    '+one',
    'diff --git a/y.ts b/y.ts',
    '--- a/y.ts',
    '+++ /dev/null',
    '@@ -1 +0,0 @@',
    '-y',
  ].join('\n');
  assert.deepEqual(addedLines(diff), new Map([['x.ts', new Set([3, 4, 19])]]));
});

test('patch line', () => {
  assert.match(patchLine({ files: 0, lines: 0, hits: 0, misses: 0, partials: 0 }), /No coverable/);
  assert.match(
    patchLine({ files: 1, lines: 2, hits: 2, misses: 0, partials: 0 }),
    /100.00%: every/,
  );
  assert.match(
    patchLine({ files: 1, lines: 4, hits: 2, misses: 1, partials: 1 }),
    /50.00%, with 2 changed lines/,
  );
});

test('report: one row per product, base n/a when main has none yet', () => {
  const t = (hits, lines) => ({ files: 1, lines, hits, misses: lines - hits, partials: 0 });
  const text = renderReport({
    pr: 7,
    headSha: 'abcdef1234',
    patch: t(1, 1),
    groups: [
      {
        name: 'livediagram',
        kinds: ['tests'],
        base: t(9, 10),
        baseSha: '1234567aaa',
        head: t(10, 10),
      },
      { name: 'Platform', kinds: ['tests'], base: null, baseSha: null, head: t(1, 2) },
    ],
  });
  assert.match(text, /\| livediagram \| 90.00% \(`1234567`\) \| 100.00% \| \+10.00% \| 0 \|/);
  assert.match(text, /\| Platform \| n\/a \| 50.00% \|  \| 1 \|/);
  assert.match(text, /at `abcdef1`/);
});

test('the description keeps everything outside its section', () => {
  const first = withReport('Summary.\n', 'R1');
  assert.equal(first, `Summary.\n\n${REPORT_START}\n\n---\n\nR1\n\n${REPORT_END}`);
  const second = withReport(`${first}\n\nAfter.`, 'R2');
  assert.equal(second, `Summary.\n\n${REPORT_START}\n\n---\n\nR2\n\n${REPORT_END}\n\nAfter.`);
  assert.equal(withReport(null, 'R'), `${REPORT_START}\n\n---\n\nR\n\n${REPORT_END}`);
  // Closing marker edited away: the section runs to the end.
  assert.equal(
    withReport(`A ${REPORT_START} old`, 'R'),
    `A ${REPORT_START}\n\n---\n\nR\n\n${REPORT_END}`,
  );
});
