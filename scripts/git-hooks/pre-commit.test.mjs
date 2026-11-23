import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatGroups } from './pre-commit.mjs';

test('staged files group by the folder Prettier runs from, relative to it', () => {
  const groups = formatGroups([
    'liveplanner/apps/editor/a.tsx',
    'liveplanner/docs/specs/b.md',
    'livediagram/apps/api/c.ts',
    'packages/ui/d.tsx',
    'liveworkspace/apps/site/e.ts',
    '.github/workflows/ci.yml',
  ]);
  assert.deepEqual(Object.fromEntries(groups), {
    liveplanner: ['apps/editor/a.tsx', 'docs/specs/b.md'],
    livediagram: ['apps/api/c.ts'],
    '.': ['packages/ui/d.tsx', 'liveworkspace/apps/site/e.ts', '.github/workflows/ci.yml'],
  });
});

test('files Prettier does not format, and the lockfile, are left out', () => {
  const groups = formatGroups(['pnpm-lock.yaml', 'a.png', 'livedesign/x.sh', 'scripts/y.css']);
  assert.equal(groups.size, 0);
});
