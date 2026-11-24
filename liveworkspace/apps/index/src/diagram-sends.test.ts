// Send to Diagram on the index (liveworkspace/docs/specs/004-index/send-to-diagram.md): a new livediagram diagram of the
// person's own, drawn from a graph, only on their read of the source, made by livediagram's door and checked against
// the index's own row.
import type { DiagramSend } from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { appSiteOrigin } from './connection-rows';
import { diagramCaption } from './diagram-sends';
import { body, call, h, makeItem, person, useHarness } from './test-support';

useHarness();

const graph = {
  nodes: [
    { id: 'a', label: 'Offer signed' },
    { id: 'b', label: 'First day' },
  ],
  edges: [{ from: 'a', to: 'b' }],
};

async function world() {
  const ada = await person('user_ada');
  const ben = await person('user_ben');
  const kb = await makeItem(ada.auth, { app: 'liveknowledge', title: 'Handbook' });
  h.appCalls = [];
  return { ada, ben, kb };
}

const ask = (itemId: string, over: Record<string, unknown> = {}) => ({
  name: 'Onboarding diagram',
  graph,
  source: { app: 'liveknowledge', itemId, tabId: 't1', elementId: 'b1', label: 'Onboarding' },
  ...over,
});

const send = (auth: string, payload: unknown, method = 'POST') =>
  call('/diagram-sends/diagrams', {
    method,
    auth,
    ...(method === 'POST' ? { body: payload } : {}),
  });

describe('a send to a diagram', () => {
  it("asks livediagram's door for the person's own diagram, its caption linked to the exact place", async () => {
    const { ada, kb } = await world();
    const made = await makeItem(ada.auth, { app: 'livediagram', title: 'Onboarding diagram' });
    h.appCalls = [];
    h.appAnswer = () => Response.json({ id: made.id });
    const res = await send(ada.auth, ask(kb.id));
    expect(res.status).toBe(201);
    expect(await body(res)).toMatchObject({
      item: { id: made.id, app: 'livediagram', access: 'edit' },
      link: `${appSiteOrigin(h.db.env, 'livediagram')}/document/${made.id}`,
    });
    const [door] = h.appCalls;
    expect(new URL(door!.url).pathname).toBe('/api/internal/items/from-graph');
    expect(door!.body).toEqual({
      owner: 'user_ada',
      name: 'Onboarding diagram',
      graph,
      caption: 'From Handbook, Onboarding',
      link: `${appSiteOrigin(h.db.env, 'liveknowledge')}/document/${kb.id}#t=t1&el=b1`,
    });
  });

  it("refuses a source the person can't read, an app that isn't the source's, and a bad ask", async () => {
    const { ada, ben, kb } = await world();
    expect((await send(ben.auth, ask(kb.id))).status).toBe(404);
    expect(
      (
        await send(
          ada.auth,
          ask(kb.id, { source: { app: 'livediagram', itemId: kb.id, label: '' } }),
        )
      ).status,
    ).toBe(400);
    expect((await send(ada.auth, ask(kb.id, { graph: { nodes: [] } }))).status).toBe(400);
    expect((await send(ada.auth, {}, 'GET')).status).toBe(404);
    expect(h.appCalls).toEqual([]);
  });

  it("answers livediagram's refusal, its failure, and an answer that names no item of the person's", async () => {
    const { ada, ben, kb } = await world();
    h.appAnswer = () => new Response(null, { status: 422 });
    expect(await body(await send(ada.auth, ask(kb.id)))).toMatchObject({ error: 'invalid_graph' });
    h.appAnswer = () => new Response(null, { status: 500 });
    expect((await send(ada.auth, ask(kb.id))).status).toBe(503);
    const bens = await makeItem(ben.auth, { app: 'livediagram', title: 'Not hers' });
    h.appAnswer = () => Response.json({ id: bens.id });
    expect((await send(ada.auth, ask(kb.id))).status).toBe(503);
  });

  it('needs a person with an account, under the run limit', async () => {
    const { ada, kb } = await world();
    expect(
      (await call('/diagram-sends/diagrams', { method: 'POST', body: ask(kb.id) })).status,
    ).toBe(401);
    const guest = await person('guest_1', { guest: true });
    expect((await send(guest.auth, ask(kb.id))).status).toBe(403);
    const env = {
      ...h.db.env,
      KIT_RUN_LIMITER: { limit: async () => ({ success: false }) },
    };
    const limited = await call('/diagram-sends/diagrams', {
      method: 'POST',
      auth: ada.auth,
      body: ask(kb.id),
      env,
    });
    expect(limited.status).toBe(429);
    expect(h.appCalls).toEqual([]);
  });

  it('answers a source that is gone, and a door answer that names no id', async () => {
    const { ada, kb } = await world();
    expect((await send(ada.auth, ask('missing-item'))).status).toBe(404);
    h.appAnswer = () => Response.json({ id: 5 });
    expect((await send(ada.auth, ask(kb.id))).status).toBe(503);
  });
});

// A share link at `level`, opened by `visitor` so it is theirs.
async function visit(owner: string, itemId: string, visitor: string, level: string) {
  const res = await call(`/items/${itemId}/share`, {
    method: 'POST',
    auth: owner,
    body: { level },
  });
  const { link } = await body<{ link: { code: string } }>(res);
  expect((await call(`/share/${link.code}`, { auth: visitor })).status).toBe(200);
}

const sendsOf = async (auth: string, sourceId: string) =>
  (await body<{ sends: DiagramSend[] }>(await call(`/items/${sourceId}/diagram-sends`, { auth })))
    .sends;

describe('a send into an existing diagram', () => {
  it('adds a tab to a diagram the person may edit, and records the send for the chip', async () => {
    const { ada, kb } = await world();
    const diagram = await makeItem(ada.auth, { app: 'livediagram', title: 'Flows' });
    h.appCalls = [];
    h.appAnswer = () => Response.json({ id: diagram.id, tabId: 'tab-9' });
    const res = await send(ada.auth, ask(kb.id, { target: { itemId: diagram.id } }));
    expect(res.status).toBe(201);
    const answer = await body<{ link: string; send: DiagramSend }>(res);
    expect(answer.link).toBe(
      `${appSiteOrigin(h.db.env, 'livediagram')}/document/${diagram.id}#t=tab-9`,
    );
    expect(answer.send).toMatchObject({
      ref: 't1:b1',
      diagram: { id: diagram.id, title: 'Flows' },
      tabId: 'tab-9',
    });
    expect(h.appCalls[0]!.body).toMatchObject({ itemId: diagram.id });
    expect((h.appCalls[0]!.body as Record<string, unknown>).tabId).toBeUndefined();
    expect(await sendsOf(ada.auth, kb.id)).toEqual([answer.send]);
  });

  it('redraws a tab, keeping one row a place and tab', async () => {
    const { ada, kb } = await world();
    const diagram = await makeItem(ada.auth, { app: 'livediagram', title: 'Flows' });
    h.appAnswer = () => Response.json({ id: diagram.id, tabId: 'tab-9' });
    await send(ada.auth, ask(kb.id, { target: { itemId: diagram.id } }));
    h.appCalls = [];
    const again = await send(
      ada.auth,
      ask(kb.id, { target: { itemId: diagram.id, tabId: 'tab-9' } }),
    );
    expect(again.status).toBe(201);
    expect(h.appCalls[0]!.body).toMatchObject({ itemId: diagram.id, tabId: 'tab-9' });
    expect(await sendsOf(ada.auth, kb.id)).toHaveLength(1);
  });

  it("refuses a diagram the person can only view, another app's item, one put away or gone", async () => {
    const { ada, ben, kb } = await world();
    await visit(ada.auth, kb.id, ben.auth, 'view');
    const bens = await makeItem(ben.auth, { app: 'livediagram', title: 'Ben' });
    const viewOnly = await makeItem(ada.auth, { app: 'livediagram', title: 'Ada' });
    await visit(ada.auth, viewOnly.id, ben.auth, 'view');
    h.appCalls = [];
    expect((await send(ben.auth, ask(kb.id, { target: { itemId: viewOnly.id } }))).status).toBe(
      403,
    );
    expect((await send(ada.auth, ask(kb.id, { target: { itemId: bens.id } }))).status).toBe(404);
    expect((await send(ada.auth, ask(kb.id, { target: { itemId: kb.id } }))).status).toBe(400);
    h.db.sql.prepare('UPDATE items SET archived_at = 1 WHERE id = ?').run(viewOnly.id);
    expect((await send(ada.auth, ask(kb.id, { target: { itemId: viewOnly.id } }))).status).toBe(
      404,
    );
    expect(h.appCalls).toEqual([]);
    const live = await makeItem(ada.auth, { app: 'livediagram', title: 'Live' });
    h.appAnswer = () => new Response(null, { status: 404 });
    expect(
      await body(await send(ada.auth, ask(kb.id, { target: { itemId: live.id } }))),
    ).toMatchObject({ error: 'diagram_gone' });
  });
});

describe("a source's diagram sends", () => {
  it('shows each reader only the diagrams they can open, newest first', async () => {
    const { ada, ben, kb } = await world();
    await visit(ada.auth, kb.id, ben.auth, 'view');
    const first = await makeItem(ada.auth, { app: 'livediagram', title: 'First' });
    const second = await makeItem(ada.auth, { app: 'livediagram', title: 'Second' });
    h.appAnswer = () => Response.json({ id: first.id });
    await send(ada.auth, ask(kb.id));
    // Two sends in one millisecond: the first made earlier, so the order is the test's, not the clock's.
    h.db.sql.prepare('UPDATE diagram_sends SET at = at - 1000').run();
    h.appAnswer = () => Response.json({ id: second.id });
    await send(ada.auth, ask(kb.id, { source: { ...ask(kb.id).source, elementId: 'b2' } }));
    const adas = await sendsOf(ada.auth, kb.id);
    expect(adas.map((s) => [s.diagram.title, s.ref])).toEqual([
      ['Second', 't1:b2'],
      ['First', 't1:b1'],
    ]);
    expect(await sendsOf(ben.auth, kb.id)).toEqual([]);
    await visit(ada.auth, first.id, ben.auth, 'view');
    expect((await sendsOf(ben.auth, kb.id)).map((s) => s.diagram.title)).toEqual(['First']);
    h.db.sql.prepare('UPDATE items SET trashed_at = 1 WHERE id = ?').run(second.id);
    expect((await sendsOf(ada.auth, kb.id)).map((s) => s.diagram.title)).toEqual(['First']);
  });

  it("is refused to someone who can't read the source", async () => {
    const { ben, kb } = await world();
    expect((await call(`/items/${kb.id}/diagram-sends`, { auth: ben.auth })).status).toBe(404);
  });
});

describe('the caption', () => {
  it('names the source, and the place when it differs, cut to its cap', () => {
    expect(diagramCaption('Handbook', 'Onboarding')).toBe('From Handbook, Onboarding');
    expect(diagramCaption('Handbook', 'Handbook')).toBe('From Handbook');
    expect(diagramCaption('Handbook', '')).toBe('From Handbook');
    expect(diagramCaption('x'.repeat(300), '')).toHaveLength(240);
  });
});
