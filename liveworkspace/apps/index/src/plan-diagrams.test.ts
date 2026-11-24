// Diagrams and Plans on the index (liveworkspace/docs/specs/004-index/diagrams-and-plans.md): Make Plan Cards needs
// Edit on the whole plan and a read of the diagram, records each made card as the shape's send and updates it the next
// time; View As Diagram needs only a read of the plan; a drawn diagram's changes need Edit; and liveplanner's redraws
// go out as the maker only while the maker may still read the plan and edit the diagram.
import type { PlanSend } from '@liveworkspace/index-client';
import { decodeJwt } from 'jose';
import { describe, expect, it } from 'vitest';
import { appSiteOrigin } from './connection-rows';
import { planCaption } from './plan-diagrams';
import { body, call, h, makeItem, person, useHarness, type AppCall } from './test-support';

useHarness();

async function world() {
  const ada = await person('user_ada');
  const ben = await person('user_ben');
  const plan = await makeItem(ada.auth, { title: 'Launch' });
  const doc = await makeItem(ada.auth, { app: 'livediagram', title: 'Roadmap' });
  h.appCalls = [];
  return { ada, ben, plan, doc };
}

async function visit(
  owner: string,
  itemId: string,
  visitor: string,
  level: string,
  tabId?: string,
) {
  const res = await call(`/items/${itemId}/share`, {
    method: 'POST',
    auth: owner,
    body: { level, ...(tabId ? { tabId } : {}) },
  });
  const { link } = await body<{ link: { code: string } }>(res);
  expect((await call(`/share/${link.code}`, { auth: visitor })).status).toBe(200);
}

const site = (app: 'livediagram' | 'liveplanner') => appSiteOrigin(h.db.env, app);
const isDoor = (c: AppCall) => c.url.includes('liveplanner') && c.url.endsWith('/plan-diagram');
const drawCalls = () => h.appCalls.filter((c) => c.url.endsWith('/items/plan-diagram'));

const makeAsk = (docId: string, over: Record<string, unknown> = {}) => ({
  board: 'b1',
  column: 'To Do',
  source: { itemId: docId, tabId: 't1', label: 'Q1' },
  cards: [
    { element: 'e1', title: 'Design', text: 'Design 1 Dec to 5 Dec' },
    { element: 'e2', title: 'Build', text: 'Build', blockedBy: ['e1'] },
  ],
  ...over,
});

const madeAnswer =
  (cards: { element: string; id: string; made: boolean }[], extra: Record<string, unknown> = {}) =>
  () =>
    Response.json({
      ok: true,
      cards: cards.map((c) => ({ ...c, title: c.element, column: 'To Do', done: false })),
      trashed: 0,
      skipped: 0,
      ...extra,
    });

const make = (auth: string, planId: string, payload: unknown) =>
  call(`/items/${planId}/plan-makes`, { method: 'POST', auth, body: payload });

const graph = (over: Record<string, unknown> = {}) => ({
  title: 'Board',
  lanes: [{ id: 'c0', label: 'To Do' }],
  nodes: [
    {
      card: 'k1',
      label: '#1 Design',
      lane: 'c0',
      done: false,
      critical: true,
      link: 'https://x.test/1',
    },
    {
      card: 'k2',
      label: '#2 Build',
      lane: 'c0',
      done: false,
      critical: true,
      link: 'https://x.test/2',
    },
  ],
  edges: [{ from: 'k1', to: 'k2', critical: true }],
  total: 2,
  ...over,
});

describe('Make Plan Cards', () => {
  it("asks liveplanner's door as the person, with each shape's line back, and records each made card", async () => {
    const { ada, plan, doc } = await world();
    h.appAnswer = madeAnswer([
      { element: 'e1', id: 'card1', made: true },
      { element: 'e2', id: 'card2', made: true },
    ]);
    const res = await make(ada.auth, plan.id, makeAsk(doc.id));
    expect(res.status).toBe(201);
    const [door] = h.appCalls.filter(isDoor);
    expect(door!.url).toBe(`https://liveplanner.app/api/internal/items/${plan.id}/plan-diagram`);
    expect(decodeJwt(door!.headers.get('X-Index-Grant')!)).toMatchObject({
      sub: 'user_ada',
      aud: 'liveplanner',
      level: 'edit',
      tab: null,
    });
    const link = `${site('livediagram')}/document/${doc.id}#t=t1&el=e1`;
    expect(door!.body).toMatchObject({
      op: 'make',
      person: 'user_ada',
      board: 'b1',
      column: 'To Do',
      trash: [],
      cards: [
        { element: 'e1', title: 'Design', sentFrom: { kind: 'element', label: 'Q1', link } },
        { element: 'e2', blockedBy: ['e1'] },
      ],
    });
    expect((door!.body as { cards: { description: string }[] }).cards[0]!.description).toContain(
      link,
    );
    const answer = await body<{ sends: PlanSend[]; made: number; updated: number }>(res);
    expect(answer).toMatchObject({ made: 2, updated: 0, trashed: 0, skipped: 0 });
    expect(answer.sends.map((s) => s.card.id).sort()).toEqual(['card1', 'card2']);
    expect(answer.sends[0]!.link).toContain(`${site('liveplanner')}/project/${plan.id}#item=`);
  });

  it('making again updates the same cards, and only this diagram’s cards may go to the Trash', async () => {
    const { ada, plan, doc } = await world();
    h.appAnswer = madeAnswer([
      { element: 'e1', id: 'card1', made: true },
      { element: 'e2', id: 'card2', made: true },
    ]);
    await make(ada.auth, plan.id, makeAsk(doc.id));
    h.appCalls = [];
    h.appAnswer = madeAnswer(
      [
        { element: 'e1', id: 'card1', made: false },
        { element: 'e3', id: 'card3', made: true },
      ],
      { trashed: 1 },
    );
    const res = await make(
      ada.auth,
      plan.id,
      makeAsk(doc.id, {
        cards: [
          { element: 'e1', title: 'Design', text: 'Design' },
          { element: 'e3', title: 'Ship', text: 'Ship' },
        ],
        trash: ['card2'],
      }),
    );
    expect(res.status).toBe(201);
    const [door] = h.appCalls.filter(isDoor);
    const cards = (door!.body as { cards: { element: string; cardId?: string }[] }).cards;
    expect(cards.find((c) => c.element === 'e1')!.cardId).toBe('card1');
    expect(cards.find((c) => c.element === 'e3')!.cardId).toBeUndefined();
    expect((door!.body as { trash: string[] }).trash).toEqual(['card2']);
    expect(await body(res)).toMatchObject({ made: 1, updated: 1, trashed: 1 });

    // A card this diagram never made is not its to trash.
    h.appCalls = [];
    const stranger = await make(ada.auth, plan.id, makeAsk(doc.id, { trash: ['someone-else'] }));
    expect(stranger.status).toBe(400);
    expect(h.appCalls.filter(isDoor)).toEqual([]);
  });

  it('needs Edit on the whole plan: a Viewer, a tab link or no access never reaches liveplanner', async () => {
    const { ada, ben, plan, doc } = await world();
    await visit(ada.auth, doc.id, ben.auth, 'view');
    expect((await make(ben.auth, plan.id, makeAsk(doc.id))).status).toBe(404);
    await visit(ada.auth, plan.id, ben.auth, 'view');
    expect((await make(ben.auth, plan.id, makeAsk(doc.id))).status).toBe(403);
    const cara = await person('user_cara');
    await visit(ada.auth, doc.id, cara.auth, 'view');
    await visit(ada.auth, plan.id, cara.auth, 'edit', 'tab1');
    expect((await make(cara.auth, plan.id, makeAsk(doc.id))).status).toBe(403);
    expect(h.appCalls.filter(isDoor)).toEqual([]);
  });

  it('needs a read of the diagram, and a diagram at that', async () => {
    const { ada, ben, plan, doc } = await world();
    const bens = await makeItem(ben.auth, { app: 'livediagram', title: 'Private' });
    expect((await make(ada.auth, plan.id, makeAsk(bens.id))).status).toBe(404);
    const other = await makeItem(ada.auth, { title: 'Another plan' });
    expect((await make(ada.auth, plan.id, makeAsk(other.id))).status).toBe(400);
    expect((await make(ada.auth, plan.id, { ...makeAsk(doc.id), cards: 'no' })).status).toBe(400);
    expect(h.appCalls.filter(isDoor)).toEqual([]);
  });

  it("says why the plan refused, and when liveplanner can't be reached", async () => {
    const { ada, plan, doc } = await world();
    h.appAnswer = () =>
      Response.json({ ok: false, code: 'board_gone', reason: 'That board is gone' });
    const refused = await make(ada.auth, plan.id, makeAsk(doc.id));
    expect(refused.status).toBe(422);
    expect(await body(refused)).toEqual({
      error: 'plan_refused',
      code: 'board_gone',
      reason: 'That board is gone',
    });
    h.appAnswer = () => new Response(null, { status: 403 });
    expect((await make(ada.auth, plan.id, makeAsk(doc.id))).status).toBe(403);
    h.appAnswer = () => new Response(null, { status: 500 });
    expect((await make(ada.auth, plan.id, makeAsk(doc.id))).status).toBe(503);
  });
});

const view = (auth: string, planId: string, payload: unknown) =>
  call(`/items/${planId}/plan-views`, { method: 'POST', auth, body: payload });

// liveplanner answers the graph and the watch; livediagram the drawing.
function viewWorld(
  drawn: Response | (() => Response) = () =>
    Response.json({ id: 'd1', tabId: 'dt1' }, { status: 201 }),
) {
  h.appAnswer = (c) => {
    if (c.url.endsWith('/items/plan-diagram')) return typeof drawn === 'function' ? drawn() : drawn;
    const op = (c.body as { op: string }).op;
    if (op === 'graph') return Response.json({ ok: true, graph: graph() });
    return Response.json({ ok: true });
  };
}

describe('View As Diagram', () => {
  it('draws the board as a new diagram of the person’s own and asks the plan to keep it live', async () => {
    const { ada, ben, plan } = await world();
    await visit(ada.auth, plan.id, ben.auth, 'view');
    viewWorld();
    const res = await view(ben.auth, plan.id, { board: 'b1', name: 'Launch diagram' });
    expect(res.status).toBe(201);
    const ops = h.appCalls.filter(isDoor).map((c) => (c.body as { op: string }).op);
    expect(ops).toEqual(['graph', 'watch']);
    expect(drawCalls()[0]!.body).toMatchObject({
      owner: 'user_ben',
      name: 'Launch diagram',
      caption: planCaption('Launch', graph() as never),
      link: `${site('liveplanner')}/project/${plan.id}`,
    });
    const watch = h.appCalls.filter(isDoor).find((c) => (c.body as { op: string }).op === 'watch');
    expect(watch!.body).toMatchObject({
      board: 'b1',
      filtered: false,
      diagramId: 'd1',
      tabId: 'dt1',
    });
    expect(await body(res)).toEqual({
      diagram: {
        id: 'd1',
        title: 'Launch diagram',
        tabId: 'dt1',
        link: `${site('livediagram')}/document/d1#t=dt1`,
      },
      cards: 2,
      links: 1,
      critical: 2,
    });
  });

  it('needs a read of the plan, and says when the board or livediagram is out of reach', async () => {
    const { ada, ben, plan } = await world();
    viewWorld();
    expect((await view(ben.auth, plan.id, { board: 'b1', name: 'x' })).status).toBe(404);
    expect((await view(ada.auth, plan.id, { board: 'b:1', name: 'x' })).status).toBe(400);
    h.appAnswer = () => Response.json({ ok: false, code: 'target_gone' });
    expect((await view(ada.auth, plan.id, { board: 'b1', name: 'x' })).status).toBe(404);
    h.appAnswer = () => Response.json({ ok: true, graph: { nope: true } });
    expect((await view(ada.auth, plan.id, { board: 'b1', name: 'x' })).status).toBe(503);
    viewWorld(() => new Response(null, { status: 500 }));
    const down = await view(ada.auth, plan.id, { board: 'b1', name: 'x' });
    expect(down.status).toBe(503);
    expect(await body(down)).toMatchObject({ error: 'plan_diagram_unavailable' });
  });

  it('keeps the drawing when the plan could not remember it', async () => {
    const { ada, plan } = await world();
    h.appAnswer = (c) => {
      if (c.url.endsWith('/items/plan-diagram')) return Response.json({ id: 'd1', tabId: 'dt1' });
      return (c.body as { op: string }).op === 'graph'
        ? Response.json({ ok: true, graph: graph() })
        : new Response(null, { status: 500 });
    };
    expect((await view(ada.auth, plan.id, { board: 'b1', name: 'x', filtered: true })).status).toBe(
      201,
    );
  });
});

describe("a drawn diagram's changes to the plan", () => {
  const edits = { edits: [{ kind: 'block', card: 'k2', blocker: 'k1' }] };
  const apply = (auth: string, planId: string, payload: unknown = edits) =>
    call(`/items/${planId}/plan-edits`, { method: 'POST', auth, body: payload });

  it("are liveplanner's to make, as the person, with Edit on the whole plan", async () => {
    const { ada, ben, plan } = await world();
    h.appAnswer = () =>
      Response.json({ ok: true, results: [{ status: 'applied' }, { status: 'x' }] });
    const res = await apply(ada.auth, plan.id);
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ results: [{ status: 'applied' }] });
    expect(h.appCalls.filter(isDoor)[0]!.body).toEqual({
      op: 'edit',
      person: 'user_ada',
      ...edits,
    });
    h.appCalls = [];
    await visit(ada.auth, plan.id, ben.auth, 'view');
    expect((await apply(ben.auth, plan.id)).status).toBe(403);
    expect((await apply(ada.auth, plan.id, { edits: [] })).status).toBe(400);
    expect(h.appCalls.filter(isDoor)).toEqual([]);
    h.appAnswer = () => Response.json({ ok: true });
    expect(await body(await apply(ada.auth, plan.id))).toEqual({ results: [] });
  });
});

const redraw = (planId: string, views: unknown[], app = 'liveplanner', key = 'lp-key') =>
  call(`/app/items/${planId}/plan-diagrams`, {
    method: 'POST',
    auth: key,
    headers: { 'X-Index-App': app },
    body: { views },
  });

describe("liveplanner's redraws", () => {
  const v = (diagramId: string, person = 'user_ada') => ({
    diagramId,
    tabId: 'dt1',
    person,
    graph: graph(),
  });

  it('draws each as its maker while they may, and says which are gone', async () => {
    const { ben, plan, doc } = await world();
    const bens = await makeItem(ben.auth, { app: 'livediagram', title: 'Ben’s' });
    h.appAnswer = (c) =>
      (c.body as { itemId: string }).itemId === 'gone-tab'
        ? new Response(null, { status: 404 })
        : Response.json({ id: (c.body as { itemId: string }).itemId, tabId: 'dt1' });
    const res = await redraw(plan.id, [v(doc.id), v(bens.id), v(bens.id, 'user_ben')]);
    expect(res.status).toBe(200);
    const { views } = await body<{ views: { diagramId: string; status: string }[] }>(res);
    expect(views).toHaveLength(3);
    // Ada made hers and may edit it; Ben cannot read the plan; Ada cannot edit Ben's diagram.
    expect(views.filter((x) => x.status === 'ok').map((x) => x.diagramId)).toEqual([doc.id]);
    expect(views.filter((x) => x.status === 'gone')).toHaveLength(2);
    expect(drawCalls()).toHaveLength(1);
    expect(drawCalls()[0]!.body).toMatchObject({ owner: 'user_ada', itemId: doc.id, tabId: 'dt1' });
  });

  it('is gone when livediagram has no such tab, failed when it is out of reach', async () => {
    const { plan, doc } = await world();
    h.appAnswer = () => new Response(null, { status: 404 });
    expect(await body(await redraw(plan.id, [v(doc.id)]))).toEqual({
      views: [{ diagramId: doc.id, status: 'gone' }],
    });
    h.appAnswer = () => new Response(null, { status: 500 });
    expect(await body(await redraw(plan.id, [v(doc.id)]))).toEqual({
      views: [{ diagramId: doc.id, status: 'failed' }],
    });
  });

  it('only from liveplanner, about its own plan, with views it can read', async () => {
    const { plan, doc } = await world();
    expect((await redraw(plan.id, [v(doc.id)], 'livediagram', 'ld-key')).status).toBe(403);
    expect((await redraw(doc.id, [v(doc.id)])).status).toBe(403);
    expect((await redraw('nope', [v(doc.id)])).status).toBe(404);
    expect((await redraw(plan.id, [])).status).toBe(400);
  });
});

describe('the caption', () => {
  it('names the plan, and how much of the board is drawn when it is cut', () => {
    expect(planCaption('Launch', graph() as never)).toBe('Drawn live from Launch');
    expect(planCaption('', { ...graph(), total: 900 } as never)).toBe(
      'Drawn live from Untitled plan: 2 of 900 cards',
    );
  });
});
