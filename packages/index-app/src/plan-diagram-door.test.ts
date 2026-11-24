// Diagrams and Plans' doors (liveworkspace/docs/specs/004-index/diagrams-and-plans.md "The doors"): liveplanner's takes a
// make or an edit only on the person's Editor grant for the whole plan and a graph or a watch on any read of it;
// livediagram's draws a new diagram (201) or redraws a tab (200), and says why it would not.
import type { GrantClaims } from '@liveworkspace/index-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AutomationDoorGrants } from './automation-step-door';
import { handleInternalItems, type InternalItemHandlers } from './internal';
import { grantReads } from './plan-diagram-door';

afterEach(() => vi.restoreAllMocks());

const claims = (over: Partial<GrantClaims> = {}) =>
  ({
    iss: 'https://liveworkspace.app/api/index',
    aud: 'liveplanner',
    sub: 'user_ada',
    item: 'P',
    level: 'edit',
    tab: null,
    team: null,
    iat: 1,
    exp: 2,
    ...over,
  }) as GrantClaims;

const grants =
  (c: GrantClaims | null): AutomationDoorGrants =>
  async (grant, itemId) =>
    grant === 'g' && itemId === 'P' ? c : null;

const request = (path: string, body: unknown, grant = 'g') =>
  new Request(`https://app.test/api/internal/items/${path}`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer k',
      'Content-Type': 'application/json',
      'X-Index-Grant': grant,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const door = (
  body: unknown,
  handlers: Partial<InternalItemHandlers>,
  verifyGrant: AutomationDoorGrants | null = grants(claims()),
) =>
  handleInternalItems(request('P/plan-diagram', body), {
    key: 'k',
    handlers: { purge: async () => {}, ...handlers },
    ...(verifyGrant ? { verifyGrant } : {}),
  });

const GRAPH = { op: 'graph', person: 'user_ada', board: 'b1', filtered: false };
const EDIT = {
  op: 'edit',
  person: 'user_ada',
  edits: [{ kind: 'move', card: 'k1', column: 'Done' }],
};

describe("liveplanner's plan-diagram door", () => {
  it('runs a graph on any read of the plan, a View grant too', async () => {
    const planDiagram = vi.fn(async () => ({ ok: true, graph: {} }));
    const res = await door(GRAPH, { planDiagram }, grants(claims({ level: 'view' })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, graph: {} });
    expect(planDiagram).toHaveBeenCalledWith(
      'P',
      GRAPH,
      expect.objectContaining({ sub: 'user_ada' }),
    );
  });

  it('runs a make or an edit only on an Editor grant for the whole plan', async () => {
    const planDiagram = vi.fn(async () => ({ ok: true, results: [] }));
    expect((await door(EDIT, { planDiagram })).status).toBe(200);
    for (const c of [
      claims({ level: 'view' }),
      claims({ tab: 't1' }),
      claims({ sub: 'user_ben' }),
      null,
    ])
      expect((await door(EDIT, { planDiagram }, grants(c))).status).toBe(403);
    expect(planDiagram).toHaveBeenCalledTimes(1);
  });

  it("refuses another person's grant, a trashed plan, a bad call and a missing handler", async () => {
    const planDiagram = vi.fn(async () => ({ ok: true }));
    expect((await door(GRAPH, { planDiagram }, grants(claims({ sub: 'user_ben' })))).status).toBe(
      403,
    );
    expect(
      (await door(GRAPH, { planDiagram }, grants(claims({ trashed: true } as never)))).status,
    ).toBe(403);
    expect((await door({ op: 'graph' }, { planDiagram })).status).toBe(400);
    expect((await door(GRAPH, {})).status).toBe(404);
    expect((await door(GRAPH, { planDiagram }, null)).status).toBe(404);
    expect(planDiagram).not.toHaveBeenCalled();
  });

  it('answers a throw as a failure, never a 500', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await door(GRAPH, {
      planDiagram: async () => {
        throw new Error('boom');
      },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false, code: 'failed', reason: '' });
  });

  it('grantReads holds the grant to its person and item, out of the Trash', () => {
    expect(grantReads(claims({ level: 'view' }), 'user_ada', 'P')).toBe(true);
    expect(grantReads(null, 'user_ada', 'P')).toBe(false);
    expect(grantReads(claims(), 'user_ada', 'Q')).toBe(false);
  });
});

const GRAPH_BODY = {
  title: 'Board',
  lanes: [{ id: 'c0', label: 'To Do' }],
  nodes: [
    {
      card: 'k1',
      label: '#1 A',
      lane: 'c0',
      done: false,
      critical: false,
      link: 'https://x.test/1',
    },
  ],
  edges: [],
  total: 1,
};
const DRAW = {
  owner: 'user_ada',
  name: 'Plan',
  graph: GRAPH_BODY,
  caption: 'Drawn',
  link: 'https://p.test/x',
};

const draw = (body: unknown, drawPlanDiagram?: InternalItemHandlers['drawPlanDiagram']) =>
  handleInternalItems(request('plan-diagram', body), {
    key: 'k',
    handlers: { purge: async () => {}, ...(drawPlanDiagram ? { drawPlanDiagram } : {}) },
  });

describe("livediagram's plan-diagram door", () => {
  it('answers a new diagram 201 and a redrawn tab 200', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const run = vi.fn(async () => ({ status: 'ok' as const, id: 'd1', tabId: 't1' }));
    const made = await draw(DRAW, run);
    expect(made.status).toBe(201);
    expect(await made.json()).toEqual({ id: 'd1', tabId: 't1' });
    expect((await draw({ ...DRAW, itemId: 'd1', tabId: 't1' }, run)).status).toBe(200);
  });

  it('says why it would not draw', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const [status, code] of [
      ['not_found', 404],
      ['too_large', 413],
      ['invalid_graph', 422],
    ] as const)
      expect((await draw(DRAW, async () => ({ status }))).status).toBe(code);
    expect(
      (
        await draw(DRAW, async () => {
          throw new Error('down');
        })
      ).status,
    ).toBe(503);
    expect(
      (await draw({ ...DRAW, owner: 'guest_1' }, async () => ({ status: 'not_found' }))).status,
    ).toBe(400);
    expect(
      (await draw({ ...DRAW, graph: null }, async () => ({ status: 'not_found' }))).status,
    ).toBe(400);
    expect((await draw(DRAW)).status).toBe(404);
  });
});
