import { test } from 'node:test';
import assert from 'node:assert/strict';
import { superseded } from './cache-prune.mjs';

const sha = (n) => String(n).repeat(40).slice(0, 40);
const cache = (id, key, created_at, ref = 'refs/heads/main') => ({ id, key, created_at, ref });

test('only the newest copy of each family is kept', () => {
  const caches = [
    cache(1, `next-v2-liveplanner-sites-abc-${sha(1)}`, '2026-11-05T10:00:00Z'),
    cache(2, `next-v2-liveplanner-sites-abc-${sha(2)}`, '2026-11-06T10:00:00Z'),
    cache(3, `next-v2-liveplanner-sites-abc-${sha(3)}`, '2026-11-04T10:00:00Z'),
    cache(4, `turbo-v1-checks-platform-abc-${sha(4)}`, '2026-11-01T10:00:00Z'),
  ];
  assert.deepEqual(superseded(caches).sort(), [1, 3]);
});

test('a new lockfile is a new family, so its first cache never deletes the old lockfile one', () => {
  const caches = [
    cache(1, `turbo-v1-tests-livediagram-old-${sha(1)}`, '2026-11-05T10:00:00Z'),
    cache(2, `turbo-v1-tests-livediagram-new-${sha(2)}`, '2026-11-06T10:00:00Z'),
  ];
  assert.deepEqual(superseded(caches), []);
});

test('keys without a commit and caches on other refs are left alone', () => {
  const caches = [
    cache(1, 'node-cache-Linux-x64-pnpm-78d4', '2026-11-05T10:00:00Z'),
    cache(2, 'node-cache-Linux-x64-pnpm-78d4', '2026-11-06T10:00:00Z'),
    cache(3, `next-v2-livedesign-live-abc-${sha(3)}`, '2026-11-05T10:00:00Z', 'refs/pull/1/merge'),
    cache(4, `next-v2-livedesign-live-abc-${sha(4)}`, '2026-11-06T10:00:00Z'),
  ];
  assert.deepEqual(superseded(caches), []);
});
