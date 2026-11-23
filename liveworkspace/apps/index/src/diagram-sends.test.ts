// Send to Diagram on the index (liveworkspace/docs/specs/004-index/send-to-diagram.md): a new livediagram diagram of the
// person's own, drawn from a graph, only on their read of the source, made by livediagram's door and checked against
// the index's own row.
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
    expect(door!.url).toContain('/api/internal/items/from-graph');
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

describe('the caption', () => {
  it('names the source, and the place when it differs, cut to its cap', () => {
    expect(diagramCaption('Handbook', 'Onboarding')).toBe('From Handbook, Onboarding');
    expect(diagramCaption('Handbook', 'Handbook')).toBe('From Handbook');
    expect(diagramCaption('Handbook', '')).toBe('From Handbook');
    expect(diagramCaption('x'.repeat(300), '')).toHaveLength(240);
  });
});
