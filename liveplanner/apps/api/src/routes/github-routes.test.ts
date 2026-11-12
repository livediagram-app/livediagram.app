import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Caller } from '../plan-room/automations/test-automation-world';
import { endRepeatWorld } from '../plan-room/test-repeat-world';
import { readConnection } from '../plan-room/github/github-store';
import { connection, githubWorld, type GithubWorld } from '../github/test-github-world';

// Who may connect a plan to GitHub (docs/specs/026-plan/github-pull-requests.md "Who may do what"; share-roles.md):
// a signed-in Editor of the whole plan, in person. A Participant, a Viewer, a link to one tab, an API token (read-only
// or not), a workbench session, a guest and a link visitor with no account are all refused, on every route, and
// nothing changes.
vi.mock(
  '../auth/accounts',
  async () => (await import('../plan-room/test-accounts-mock')).accountsMock,
);

let w: GithubWorld;
beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  w = await githubWorld(['A']);
  await w.seed('A', connection(7, [{ id: 11 }, { id: 12, chosen: false }]));
});
afterEach(() => {
  vi.restoreAllMocks();
  endRepeatWorld();
});

const ROUTES: [string, string, unknown?][] = [
  ['GET', '/github'],
  ['POST', '/github/connect'],
  ['PUT', '/github/repositories', { ids: [12] }],
  ['DELETE', '/github'],
];

const ALLOWED: Caller[] = ['owner', 'team', 'editor_link'];
const REFUSED: Caller[] = [
  'participant',
  'viewer',
  'tab_editor_link',
  'token',
  'token_read_only',
  'token_participant',
  'token_tab',
  'workbench',
  'guest',
  'link_visitor',
];

describe('an Editor of the whole plan, signed in', () => {
  it.each(ALLOWED)('%s may read, start, choose and disconnect', async (who) => {
    const answers = [];
    for (const [method, path, body] of ROUTES)
      answers.push((await w.as(who, method, path, body)).status);
    expect(answers).toEqual([200, 201, 200, 204]);
    expect(await readConnection(w.planEnv('A').PLAN_DB, 'A')).toBeNull();
  });
});

describe('anyone else', () => {
  it.each(REFUSED)('%s is refused on every route, and nothing changes', async (who) => {
    for (const [method, path, body] of ROUTES) {
      const res = await w.as(who, method, path, body);
      // A link visitor with no identity is refused for it (missing auth); everyone else as not an Editor in person.
      expect(res.status, `${who} ${method} ${path}`).toBe(who === 'link_visitor' ? 400 : 403);
      if (res.status === 403) expect(await res.json()).toEqual({ error: 'github_needs_editor' });
    }
    const c = await readConnection(w.planEnv('A').PLAN_DB, 'A');
    expect(c!.repositories.map((r) => [r.id, r.chosen])).toEqual([
      [11, true],
      [12, false],
    ]);
    expect(w.kv.keys()).toEqual(['installation:7:A', 'repo:11:A']);
    expect(w.ghCalls).toEqual([]);
  });
});
