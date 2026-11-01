import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { handlePreferences, PREFERENCES_PATCH_MAX } from './preferences';
import { makeTestRouteContext } from './test-route-context';

// /api/preferences (docs/specs/015-api/api.md "Preferences"): the refusals that never reach liveworkspace, and the
// spec's row kept to the cap the route holds. The row said 4 KB, "an upsert" and "an empty object when no row
// exists" long after the route became an 8 KB patch answering { prefs: null }.

const put = (body: string, owner: string | null = 'guest_1') =>
  handlePreferences(makeTestRouteContext('PUT', '/api/preferences', { owner, rawBody: body }));

describe('PUT /api/preferences', () => {
  it('asks for an identity first', async () => {
    expect((await put('{"prefs":{}}', null)).status).toBe(400);
  });

  it('refuses a body over the cap, and one that is not an object of prefs', async () => {
    const big = JSON.stringify({ prefs: { k: 'x'.repeat(PREFERENCES_PATCH_MAX) } });
    expect((await put(big)).status).toBe(400);
    for (const body of ['not json', 'null', '{"prefs":null}', '{"prefs":[1]}', '{"prefs":"a"}']) {
      expect((await put(body)).status, body).toBe(400);
    }
  });
});

describe('the spec', () => {
  it('states the cap the route holds, and the patch it is', () => {
    const spec = readFileSync(
      fileURLToPath(new URL('../../../../docs/specs/015-api/api.md', import.meta.url).href),
      'utf8',
    );
    const row = spec.split('\n').find((line) => line.startsWith('| PUT    | `/api/preferences`'));
    expect(row).toContain(`${PREFERENCES_PATCH_MAX / 1024} KB`);
    expect(row).toContain('patch');
  });
});
