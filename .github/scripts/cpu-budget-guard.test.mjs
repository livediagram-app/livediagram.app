import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wallClockAdditions } from './cpu-budget-guard.mjs';

const diff = (file, lines) =>
  [
    `diff --git a/${file} b/${file}`,
    `--- a/${file}`,
    `+++ b/${file}`,
    '@@ -1,0 +10,3 @@',
    ...lines,
  ].join('\n');

test('an added performance.now() in a test file is found, with its line', () => {
  assert.deepEqual(
    wallClockAdditions(diff('a/x.test.ts', ['+const a = 1;', '+const t = performance.now();'])),
    ['a/x.test.ts:11: const t = performance.now();'],
  );
});

test('source files, e2e specs, removed lines and marked lines pass', () => {
  assert.deepEqual(wallClockAdditions(diff('a/x.ts', ['+performance.now();'])), []);
  assert.deepEqual(wallClockAdditions(diff('a/e2e/x.spec.ts', ['+performance.now();'])), []);
  assert.deepEqual(wallClockAdditions(diff('a/x.test.ts', ['-performance.now();'])), []);
  assert.deepEqual(
    wallClockAdditions(diff('a/x.test.ts', ['+performance.now(); // wall-clock: a real timer'])),
    [],
  );
});
