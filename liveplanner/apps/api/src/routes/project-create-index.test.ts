import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IndexError, type GrantClaims, type IndexClient } from '@liveworkspace/index-client';
import { indexService, setGrantVerifierForTests } from '../index-service';
import type { Env } from '../types';
import { makeTestRouteContext } from './test-route-context';
import { handleProjects } from './projects';

// An API client's create (POST /api/projects with no grant, docs/specs/015-api/api.md "Index"): the worker makes
// the index's item first (@liveworkspace/index-app createItemGrant), then the plan opens with the grant that comes
// back, and the answer names where the index filed it.

const NOW = Math.floor(Date.now() / 1000);
const grantFor = (item: string): string =>
  `G.${btoa(JSON.stringify({ iss: 'index', aud: 'liveplanner', item, sub: 'user_a', owner: 'user_a', level: 'edit', tab: null, team: null, iat: NOW, exp: NOW + 600, jti: 'j' } satisfies GrantClaims))}`;

function setUp(createItem: IndexClient['createItem']) {
  const routed: Request[] = [];
  const env = {
    PLAN_ROOM: {
      idFromName: (name: string) => name,
      get: () => ({
        route: async (_planId: string, request: Request) => {
          routed.push(request);
          const body = (await request.json()) as { id: string; name: string };
          return Response.json(
            { project: { id: body.id, name: body.name, folderId: null, teamId: null } },
            { status: 201 },
          );
        },
      }),
    },
  } as unknown as Env;
  const created = vi.fn(createItem);
  vi.spyOn(indexService, 'clientFor').mockReturnValue({
    createItem: created,
  } as unknown as IndexClient);
  const create = (body: Record<string, unknown>) => {
    const ctx = makeTestRouteContext('POST', '/api/projects', {
      owner: 'user_a',
      verifiedUserId: 'user_a',
      token: { id: 'tok_1' },
      body: { id: 'P1', name: 'Roadmap', ...body },
      grant: null,
    });
    return handleProjects({ ...ctx, env });
  };
  return { create, created, routed };
}

const filedItem = (input: { id?: string }, folderId: string | null, teamId: string | null) =>
  ({ id: input.id, folderId, teamId }) as never;

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  setGrantVerifierForTests(async (token: string) =>
    token.startsWith('G.') ? (JSON.parse(atob(token.slice(2))) as GrantClaims) : null,
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  setGrantVerifierForTests(null);
});

describe("an API client's create", () => {
  it('leaves the folder to the index when none is named, sends the intent, and answers where it was filed', async () => {
    const { create, created, routed } = setUp(async (input) => ({
      item: filedItem(input, 'f-default', null),
      grant: { grant: grantFor('P1') } as never,
    }));
    const res = await create({ source: 'mcp', intent: { mode: 'plan', templateFamily: 'kanban' } });
    expect(res.status).toBe(201);
    const sent = created.mock.calls[0]![0];
    expect(sent).toMatchObject({ id: 'P1', app: 'liveplanner', title: 'Roadmap', source: 'ai' });
    expect(sent.intent).toBe('plan:empty:kanban');
    expect('folderId' in sent).toBe(false);
    expect('teamId' in sent).toBe(false);
    expect(routed).toHaveLength(1);
    expect(await res.json()).toMatchObject({
      project: { id: 'P1', folderId: 'f-default', teamId: null },
    });
  });

  it('files where a folder or team is named, and the top of the space for folderId null', async () => {
    const { create, created } = setUp(async (input) => ({
      item: filedItem(input, input.folderId ?? null, input.teamId ?? null),
      grant: { grant: grantFor('P1') } as never,
    }));
    await create({ folderId: 'f-1', teamId: 'team_t' });
    expect(created.mock.calls[0]![0]).toMatchObject({ folderId: 'f-1', teamId: 'team_t' });
    await create({ folderId: null });
    expect(created.mock.calls[1]![0]).toMatchObject({ folderId: null });
  });

  it('takes the intent from the first seeded tab when the body names none', async () => {
    const { create, created } = setUp(async (input) => ({
      item: filedItem(input, null, null),
      grant: { grant: grantFor('P1') } as never,
    }));
    await create({ tabs: [{ id: 't1', name: 'Board', template: 'kanban' }] });
    expect(created.mock.calls[0]![0].intent).toMatch(/^plan:.*:kanban$/);
  });

  it('refuses a malformed intent before the index makes anything', async () => {
    const { create, created } = setUp(async () => {
      throw new Error('unreached');
    });
    const res = await create({ intent: { mode: 42 } });
    expect(res.status).toBe(400);
    expect(created).not.toHaveBeenCalled();
  });

  it("re-commits the client's own plan by the grant it holds, answering as the plan does", async () => {
    vi.spyOn(indexService, 'requestGrant').mockResolvedValue({
      ok: true,
      grant: { grant: grantFor('P1') },
    } as never);
    const { create, routed } = setUp(async () => {
      throw new IndexError(409, 'item_exists');
    });
    const res = await create({});
    expect(res.status).toBe(201);
    expect(routed).toHaveLength(1);
    expect(await res.json()).toMatchObject({ project: { folderId: null } });
  });

  it("answers the index's refusal", async () => {
    const { create, routed } = setUp(async () => {
      throw new IndexError(403, 'team_forbidden');
    });
    const res = await create({ teamId: 'team_x' });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'team_forbidden' });
    expect(routed).toHaveLength(0);
  });
});
