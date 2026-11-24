import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// E2E builds must never call production's Community (Work Tracker 1405): an unset NEXT_PUBLIC_COMMUNITY_API
// means www.liveworkspace.app, and each E2E run's template pickers fetched `/api/community/start` there.
const workflow = readFileSync(new URL('../workflows/e2e-product.yml', import.meta.url), 'utf8');

test('e2e-product.yml builds with a Community that is not production', () => {
  const topEnv = workflow.match(/^env:\n((?: {2}.*\n|\s*\n)+)/m)?.[1] ?? '';
  const value = topEnv.match(/^ {2}NEXT_PUBLIC_COMMUNITY_API:\s*(\S+)/m)?.[1];
  assert.ok(value, 'set NEXT_PUBLIC_COMMUNITY_API in the workflow env for every build step');
  assert.ok(
    value.startsWith('/') || /^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(value),
    `NEXT_PUBLIC_COMMUNITY_API is ${value}: use a same-origin path or a local service`,
  );
});

test('no e2e build step overrides it to production', () => {
  assert.doesNotMatch(workflow, /NEXT_PUBLIC_COMMUNITY_API:\s*\S*liveworkspace\.app/);
});
