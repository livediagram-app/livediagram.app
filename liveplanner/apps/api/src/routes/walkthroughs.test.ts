import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import { makeTestRouteContext } from './test-route-context';

// liveplanner's walkthrough door with Pro (liveworkspace/docs/specs/006-media/walkthroughs.md "With Pro on";
// docs/specs/012-collaboration/walkthroughs.md): the plan's owner, from the index's grant (its team for a team's
// plan), is named to the service whoever records, so a team plan's recorder gets the team's length and stored
// limits; a tier or an owner the request claims is never passed on; with Pro off nothing is named and the door holds
// the legacy length itself. The media service and the index's grant are stood in for.

const { resolvePlanGrant } = vi.hoisted(() => ({ resolvePlanGrant: vi.fn() }));
vi.mock('./plan-grant', () => ({ resolvePlanGrant }));

import { handleWalkthroughs } from './walkthroughs';

const MEDIA_URL = 'https://media.test/api/media';
const TEAM = {
  level: 'edit',
  tab: null,
  shareCode: null,
  trashed: false,
  team: 'team_garden',
  owner: 'user_host',
};
const PERSONAL = { ...TEAM, team: null };
const events = (durationMs: number) => ({
  v: 1,
  durationMs,
  camera: false,
  corner: 'bottom-left',
  startTab: 't1',
  hidden: [],
  fingerprints: { t1: 'f' },
  events: [{ t: 10, k: 'point', id: 'e1' }],
});

let calls: { method: string; itemOwner: string | null; claimed: string | null }[];
const world = (pro: boolean) =>
  ({ MEDIA_URL, MEDIA_KEY: 'k', PRO_ENABLED: pro ? 'true' : 'false' }) as unknown as Env;

beforeEach(() => {
  calls = [];
  resolvePlanGrant.mockReset();
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    calls.push({
      method: req.method,
      itemOwner: req.headers.get('X-Media-Item-Owner'),
      claimed: req.headers.get('X-Subscription-Tier'),
    });
    return req.method === 'POST'
      ? Response.json({ walkthrough: { id: 'w1' } }, { status: 201 })
      : Response.json({ walkthroughs: [] });
  });
});
afterEach(() => vi.unstubAllGlobals());

const list = (env: Env, owner: string) =>
  handleWalkthroughs(makeTestRouteContext('GET', '/api/walkthroughs?d=plan', { owner, env }));

const start = (
  env: Env,
  owner: string,
  durationMs: number,
  headers: Record<string, string> = {},
) => {
  const ctx = makeTestRouteContext('POST', '/api/walkthroughs?d=plan', { owner, env });
  return handleWalkthroughs({
    ...ctx,
    request: new Request('https://api.test/api/walkthroughs?d=plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({
        title: 'Tour',
        author: 'Ada',
        mediaType: 'audio/webm',
        mediaBytes: 16,
        events: events(durationMs),
      }),
    }),
  });
};

const MINUTE = 60_000;

describe('with Pro off', () => {
  it('names no plan owner, and holds the legacy 10 minutes itself', async () => {
    resolvePlanGrant.mockResolvedValue(TEAM);
    const env = world(false);
    expect((await list(env, 'user_ada')).status).toBe(200);
    expect((await start(env, 'user_ada', 2000)).status).toBe(201);
    expect(calls.map((c) => c.itemOwner)).toEqual([null, null]);
    // Past 10 minutes never reaches the service.
    expect((await start(env, 'user_ada', 11 * MINUTE)).status).toBeGreaterThanOrEqual(400);
    expect(calls).toHaveLength(2);
  });
});

describe('with Pro on', () => {
  it('names a team plan’s team to the service, whoever records or lists', async () => {
    resolvePlanGrant.mockResolvedValue(TEAM);
    const env = world(true);
    for (const recorder of ['user_ada', 'user_bo']) {
      calls = [];
      expect((await list(env, recorder)).status).toBe(200);
      expect((await start(env, recorder, 2000)).status).toBe(201);
      expect(calls.map((c) => c.itemOwner)).toEqual(['t:team_garden', 't:team_garden']);
    }
  });

  it('names a person’s plan’s owner, and lets a tier’s longer recording through for the service to judge', async () => {
    resolvePlanGrant.mockResolvedValue(PERSONAL);
    const env = world(true);
    expect((await start(env, 'user_ada', 11 * MINUTE)).status).toBe(201);
    expect(calls).toEqual([{ method: 'POST', itemOwner: 'p:user_host', claimed: null }]);
  });

  it('never passes on an owner or a tier the request claims', async () => {
    resolvePlanGrant.mockResolvedValue({ ...PERSONAL, owner: 'guest_1' });
    const env = world(true);
    const claimed = { 'X-Media-Item-Owner': 't:team_garden', 'X-Subscription-Tier': 'team' };
    expect((await start(env, 'user_ada', 2000, claimed)).status).toBe(201);
    // A guest's plan names no owner: the recorder's own tier applies.
    expect(calls).toEqual([{ method: 'POST', itemOwner: null, claimed: null }]);
  });

  it('tells a Viewer nothing of what may be recorded', async () => {
    resolvePlanGrant.mockResolvedValue({ ...TEAM, level: 'view' });
    expect((await list(world(true), 'user_vic')).status).toBe(200);
    expect(calls.map((c) => c.itemOwner)).toEqual([null]);
  });
});
