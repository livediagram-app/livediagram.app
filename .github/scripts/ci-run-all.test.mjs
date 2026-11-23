import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { GUARD_DATA_HOST, forcesAll, isGuardData } from './ci-run-all.mjs';

test('shared config and CI itself check everything', () => {
  for (const file of [
    '.github/workflows/ci.yml',
    '.github/scripts/ci-plan.mjs',
    '.github/scripts/duplicate-guard.mjs',
    'package.json',
    'turbo.json',
    'pnpm-workspace.yaml',
    'liveplanner/tsconfig.base.json',
    '.prettierignore',
  ])
    assert.equal(forcesAll(file), true, file);
});

test('a guard baseline list is data: it checks only what else the change reaches', () => {
  for (const file of [
    '.github/scripts/duplicate-baseline.txt',
    '.github/scripts/file-size-baseline.txt',
  ]) {
    assert.equal(isGuardData(file), true, file);
    assert.equal(forcesAll(file), false, file);
  }
  // Nothing but a baseline list at that folder's top level: a guard's code, or a list elsewhere, is not data.
  assert.equal(isGuardData('.github/scripts/duplicate-guard.mjs'), false);
  assert.equal(isGuardData('.github/scripts/nested/x-baseline.txt'), false);
  assert.equal(isGuardData('packages/ui/some-baseline.txt'), false);
});

test('ordinary files force nothing', () => {
  for (const file of ['packages/ui/src/Button.tsx', 'docs/ci.md', 'liveplanner/apps/editor/a.ts'])
    assert.equal(forcesAll(file), false, file);
});

test('every baseline list in the scripts folder is covered, and the host workspace exists', () => {
  const lists = readdirSync('.github/scripts').filter((name) => name.endsWith('-baseline.txt'));
  assert.ok(lists.length >= 2);
  for (const name of lists) assert.equal(isGuardData(`.github/scripts/${name}`), true, name);
  const host = 'packages/vitest-config/package.json';
  assert.ok(existsSync(host));
  assert.equal(JSON.parse(readFileSync(host, 'utf8')).name, GUARD_DATA_HOST);
});
