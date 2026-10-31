import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  globToRegExp,
  parseTurboJson,
  readersOf,
  readersReached,
  repoReaders,
} from './ci-readers.mjs';

test('globs match as turbo reads them', () => {
  assert.ok(globToRegExp('liveplanner/apps/**').test('liveplanner/apps/editor/x.ts'));
  assert.ok(!globToRegExp('liveplanner/apps/**').test('liveplanner/docs/x.md'));
  assert.ok(globToRegExp('**/node_modules/**').test('a/node_modules/b/c.js'));
  assert.ok(globToRegExp('**/node_modules/**').test('node_modules/b.js'));
  assert.ok(globToRegExp('**/.next*/**').test('x/.next-dev/y'));
  assert.ok(!globToRegExp('a/*.ts').test('a/b/c.ts'));
});

test('comments go, a URL in a string stays', () => {
  const parsed = parseTurboJson('{\n  // note\n  "$schema": "https://x.dev/s.json"\n}');
  assert.equal(parsed.$schema, 'https://x.dev/s.json');
});

test('only test tasks with root inputs are readers, and exclusions hold', () => {
  const readers = readersOf({
    tasks: {
      'a#test': { inputs: ['$TURBO_DEFAULT$', '$TURBO_ROOT$/p/**', '!$TURBO_ROOT$/**/dist/**'] },
      'b#build': { inputs: ['$TURBO_ROOT$/p/**'] },
      'c#test:coverage': { inputs: ['$TURBO_DEFAULT$'] },
    },
  });
  assert.deepEqual(
    readers.map((r) => r.name),
    ['a'],
  );
  assert.deepEqual(readersReached(readers, ['p/src/x.ts']), ['a']);
  assert.deepEqual(readersReached(readers, ['p/dist/x.js']), []);
  assert.deepEqual(readersReached(readers, ['q/x.ts']), []);
});

// The two suites that turned main red after a green pull request (2026-10-30 and 31).
test("the repository's readers catch the changes that broke main", () => {
  const readers = repoReaders(new URL('../../turbo.json', import.meta.url));
  assert.ok(
    readersReached(readers, ['liveplanner/apps/editor/lib/x.ts']).includes('@liveworkspace/site'),
  );
  assert.ok(
    readersReached(readers, ['livedesign/apps/live/components/panels/SearchPanel.tsx']).includes(
      '@livedesign/design',
    ),
  );
  assert.ok(readersReached(readers, ['livediagram/docs/specs/x.md']).includes('@livediagram/help'));
});
