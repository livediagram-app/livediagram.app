// Send to Knowledge Base on the index (liveworkspace/docs/specs/004-index/send-to-knowledge.md): a section written on a
// knowledgebase page from a selection, only on the person's read of the source and their own Editor access to the whole
// knowledgebase, through liveknowledge's door on their grant; the sends read for both sides' chips, each filtered by
// the reader's own access; a page's headings for an Editor; an agent's send recorded only with read on the source.
import type { KnowledgeReceived, KnowledgeSend } from '@liveworkspace/index-client';
import { decodeJwt } from 'jose';
import { describe, expect, it } from 'vitest';
import { appSiteOrigin } from './connection-rows';
import { body, call, h, makeItem, person, useHarness } from './test-support';

useHarness({
  INDEX_KEY_LIVEKNOWLEDGE: 'lk-key',
  APP_ORIGIN_LIVEKNOWLEDGE: 'https://www.liveknowledge.app',
});

async function world() {
  const ada = await person('user_ada');
  const ben = await person('user_ben');
  const diagram = await makeItem(ada.auth, { app: 'livediagram', title: 'Payments' });
  const kb = await makeItem(ada.auth, { app: 'liveknowledge', title: 'Team Wiki' });
  h.appCalls = [];
  h.appAnswer = () => Response.json({ ok: true, page: { id: 'page-1', title: 'Checkout' } });
  return { ada, ben, diagram, kb };
}

const ask = (kbId: string, sourceId: string, over: Record<string, unknown> = {}) => ({
  knowledgebase: kbId,
  place: { page: 'page-1', after: 'h-2' },
  heading: 'Checkout',
  markdown: 'The cart sends the order to payment.',
  picture: { png: 'iVBORw0KGgo=', width: 40, height: 20 },
  source: { app: 'livediagram', itemId: sourceId, tabId: 't1', elementIds: ['e1', 'e2'] },
  ...over,
});

const send = (auth: string | null, payload: unknown) =>
  call('/knowledge-sends/sections', { method: 'POST', auth, body: payload });

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

const doorCalls = () => h.appCalls.filter((c) => c.url.includes('/knowledge-send'));

describe('a send to a knowledgebase', () => {
  it("writes through liveknowledge's door on the person's grant, linked back to the exact place", async () => {
    const { ada, diagram, kb } = await world();
    const res = await send(ada.auth, ask(kb.id, diagram.id));
    expect(res.status).toBe(201);
    const answer = await body<{ send: KnowledgeSend; link: string }>(res);
    const pageLink = `${appSiteOrigin(h.db.env, 'liveknowledge')}/document/${kb.id}#t=page-1`;
    expect(answer.link).toBe(pageLink);
    expect(answer.send).toMatchObject({
      tabId: 't1',
      elementIds: ['e1', 'e2'],
      knowledgebase: { id: kb.id, title: 'Team Wiki' },
      page: { id: 'page-1', title: 'Checkout' },
    });
    const [door] = doorCalls();
    expect(new URL(door!.url).pathname).toBe(`/api/internal/items/${kb.id}/knowledge-send`);
    expect(decodeJwt(door!.headers.get('X-Index-Grant')!)).toMatchObject({
      sub: 'user_ada',
      item: kb.id,
      level: 'edit',
      tab: null,
    });
    expect(door!.body).toEqual({
      op: 'write',
      person: 'user_ada',
      place: { page: 'page-1', after: 'h-2' },
      heading: 'Checkout',
      markdown: 'The cart sends the order to payment.',
      picture: { png: 'iVBORw0KGgo=', width: 40, height: 20 },
      sentFrom: {
        app: 'livediagram',
        title: 'Payments',
        link: `${appSiteOrigin(h.db.env, 'livediagram')}/document/${diagram.id}#t=t1&el=e1`,
      },
    });
  });

  it("writes an Ask AI answer's words with no tab or element, linked back to the item", async () => {
    const { ada, diagram, kb } = await world();
    const res = await send(
      ada.auth,
      ask(kb.id, diagram.id, {
        picture: undefined,
        source: { app: 'livediagram', itemId: diagram.id, tabId: null, elementIds: [] },
      }),
    );
    expect(res.status).toBe(201);
    const answer = await body<{ send: KnowledgeSend }>(res);
    expect(answer.send).toMatchObject({ tabId: '', elementIds: [] });
    const [door] = doorCalls();
    expect((door!.body as { sentFrom: { link: string } }).sentFrom.link).toBe(
      `${appSiteOrigin(h.db.env, 'livediagram')}/document/${diagram.id}`,
    );
  });

  it('sends from an untitled item to the end of a page whose title the door leaves out', async () => {
    const { ada, kb } = await world();
    const bare = await makeItem(ada.auth, { app: 'livediagram', title: 'Bare' });
    h.db.sql.prepare("UPDATE items SET title = '' WHERE id = ?").run(bare.id);
    h.appAnswer = () => Response.json({ ok: true, page: { id: 'page-1', title: 7 } });
    const res = await send(
      ada.auth,
      ask(kb.id, bare.id, {
        place: { page: 'page-1' },
      }),
    );
    expect(res.status).toBe(201);
    const { send: made } = await body<{ send: KnowledgeSend }>(res);
    expect(made.page.title).toBe('');
  });

  it('writes to a new page', async () => {
    const { ada, diagram, kb } = await world();
    const res = await send(
      ada.auth,
      ask(kb.id, diagram.id, {
        place: { newPage: { title: 'Payments', parent: null } },
        picture: undefined,
      }),
    );
    expect(res.status).toBe(201);
    expect(doorCalls()[0]!.body).toMatchObject({
      place: { newPage: { title: 'Payments', parent: null } },
    });
  });

  it("passes on the door's refusal and its failure", async () => {
    const { ada, diagram, kb } = await world();
    h.appAnswer = () =>
      Response.json({ ok: false, code: 'page_locked', reason: 'The page is locked' });
    const refused = await send(ada.auth, ask(kb.id, diagram.id));
    expect(refused.status).toBe(422);
    expect(await body(refused)).toEqual({
      error: 'knowledge_refused',
      code: 'page_locked',
      reason: 'The page is locked',
    });
    h.appAnswer = () => new Response(null, { status: 500 });
    expect((await send(ada.auth, ask(kb.id, diagram.id))).status).toBe(503);
    h.appAnswer = () => new Response(null, { status: 403 });
    expect((await send(ada.auth, ask(kb.id, diagram.id))).status).toBe(403);
    h.appAnswer = () => Response.json({ ok: true, page: { id: 7 } });
    expect((await send(ada.auth, ask(kb.id, diagram.id))).status).toBe(422);
  });

  it('refuses a bad ask, a knowledgebase that is the source, and another app as the target', async () => {
    const { ada, diagram, kb } = await world();
    expect((await send(ada.auth, { knowledgebase: kb.id })).status).toBe(400);
    expect((await send(ada.auth, ask(diagram.id, diagram.id))).status).toBe(400);
    const plan = await makeItem(ada.auth, { app: 'liveplanner', title: 'Plan' });
    expect((await send(ada.auth, ask(plan.id, diagram.id))).status).toBe(400);
    expect(
      (
        await send(
          ada.auth,
          ask(kb.id, diagram.id, {
            source: { ...ask(kb.id, diagram.id).source, app: 'livedocuments' },
          }),
        )
      ).status,
    ).toBe(400);
    expect((await call('/knowledge-sends/sections', { auth: ada.auth })).status).toBe(404);
    expect(doorCalls()).toEqual([]);
  });

  it('needs a person with an account, under the run limit', async () => {
    const { ada, diagram, kb } = await world();
    expect((await send(null, ask(kb.id, diagram.id))).status).toBe(401);
    const guest = await person('guest_1', { guest: true });
    expect((await send(guest.auth, ask(kb.id, diagram.id))).status).toBe(403);
    const limited = await call('/knowledge-sends/sections', {
      method: 'POST',
      auth: ada.auth,
      body: ask(kb.id, diagram.id),
      env: { ...h.db.env, KIT_RUN_LIMITER: { limit: async () => ({ success: false }) } },
    });
    expect(limited.status).toBe(429);
    expect(doorCalls()).toEqual([]);
  });
});

describe('who may send (share roles)', () => {
  it('needs Editor on the whole knowledgebase: a Viewer, a Participant or one page’s Editor is refused', async () => {
    const { ada, ben, diagram } = await world();
    await visit(ada.auth, diagram.id, ben.auth, 'view');
    for (const [level, tab] of [
      ['view', undefined],
      ['participate', undefined],
      ['edit', 'page-1'],
    ] as const) {
      const kb = await makeItem(ada.auth, { app: 'liveknowledge', title: `KB ${level}` });
      await visit(ada.auth, kb.id, ben.auth, level, tab);
      expect((await send(ben.auth, ask(kb.id, diagram.id))).status).toBe(403);
    }
    expect(doorCalls()).toEqual([]);
  });

  it('needs only read on the source: a Viewer of the diagram with Editor on the knowledgebase sends', async () => {
    const { ada, ben, diagram, kb } = await world();
    await visit(ada.auth, kb.id, ben.auth, 'edit');
    // No read on the source: it answers as missing, and nothing is asked of the knowledgebase.
    expect((await send(ben.auth, ask(kb.id, diagram.id))).status).toBe(404);
    expect(doorCalls()).toEqual([]);
    await visit(ada.auth, diagram.id, ben.auth, 'view');
    expect((await send(ben.auth, ask(kb.id, diagram.id))).status).toBe(201);
    expect(decodeJwt(doorCalls()[0]!.headers.get('X-Index-Grant')!)).toMatchObject({
      sub: 'user_ben',
    });
  });

  it('refuses a knowledgebase in the Trash or archived', async () => {
    const { ada, diagram, kb } = await world();
    h.db.sql.prepare('UPDATE items SET archived_at = 1 WHERE id = ?').run(kb.id);
    expect((await send(ada.auth, ask(kb.id, diagram.id))).status).toBe(404);
    expect(doorCalls()).toEqual([]);
  });
});

const sendsOf = async (auth: string, sourceId: string) =>
  (
    await body<{ sends: KnowledgeSend[] }>(
      await call(`/items/${sourceId}/knowledge-sends`, { auth }),
    )
  ).sends;
const receivedOf = async (auth: string, kbId: string) =>
  (
    await body<{ received: KnowledgeReceived[] }>(
      await call(`/items/${kbId}/knowledge-sends?received=1`, { auth }),
    )
  ).received;

describe('the chips on both sides', () => {
  it("shows a source's sends only to readers who can open the knowledgebase, and the page's only to readers of the source", async () => {
    const { ada, ben, diagram, kb } = await world();
    await send(ada.auth, ask(kb.id, diagram.id));
    expect((await sendsOf(ada.auth, diagram.id)).map((s) => s.knowledgebase.title)).toEqual([
      'Team Wiki',
    ]);
    const received = await receivedOf(ada.auth, kb.id);
    expect(received).toEqual([
      {
        id: expect.any(String),
        page: 'page-1',
        place: `${appSiteOrigin(h.db.env, 'livediagram')}/document/${diagram.id}#t=t1&el=e1`,
        source: { app: 'livediagram', id: diagram.id, title: 'Payments' },
      },
    ]);
    // Ben reads the diagram but not the knowledgebase: no chip names it.
    await visit(ada.auth, diagram.id, ben.auth, 'view');
    expect(await sendsOf(ben.auth, diagram.id)).toEqual([]);
    // Ben reads both now: the page's chip shows the source's current name.
    await visit(ada.auth, kb.id, ben.auth, 'view');
    h.db.sql.prepare('UPDATE items SET title = ? WHERE id = ?').run('Payments v2', diagram.id);
    expect((await receivedOf(ben.auth, kb.id))[0]!.source.title).toBe('Payments v2');
    expect(await sendsOf(ben.auth, diagram.id)).toHaveLength(1);
    // A knowledgebase put away shows no chip.
    h.db.sql.prepare('UPDATE items SET trashed_at = 1 WHERE id = ?').run(kb.id);
    expect(await sendsOf(ada.auth, diagram.id)).toEqual([]);
  });

  it("hides the page's chip from a reader who cannot open the source", async () => {
    const { ada, ben, diagram, kb } = await world();
    await send(ada.auth, ask(kb.id, diagram.id));
    await visit(ada.auth, kb.id, ben.auth, 'view');
    expect(await receivedOf(ben.auth, kb.id)).toEqual([]);
  });

  it("is refused to someone who can't read the item, and answers nothing to an anonymous link visitor", async () => {
    const { ben, diagram } = await world();
    expect((await call(`/items/${diagram.id}/knowledge-sends`, { auth: ben.auth })).status).toBe(
      404,
    );
    expect(
      (await call(`/items/${diagram.id}/knowledge-sends`, { method: 'POST', auth: ben.auth }))
        .status,
    ).toBe(404);
    expect(
      (await call(`/items/${diagram.id}/knowledge-sends/other`, { auth: ben.auth })).status,
    ).toBe(404);
  });

  it('cascades away with the source', async () => {
    const { ada, diagram, kb } = await world();
    await send(ada.auth, ask(kb.id, diagram.id));
    h.db.sql.prepare('DELETE FROM items WHERE id = ?').run(diagram.id);
    expect(h.db.sql.prepare('SELECT COUNT(*) AS n FROM knowledge_sends').get()).toEqual({ n: 0 });
  });

  it('refuses a send past the source’s cap', async () => {
    const { ada, diagram, kb } = await world();
    const insert = h.db.sql.prepare(
      `INSERT INTO knowledge_sends (id, source_id, source_tab_id, elements, kb_id, page_id, page_title, place_link, at)
       VALUES (?, ?, '', '[]', ?, 'p', '', '', 1)`,
    );
    for (let i = 0; i < 1000; i++) insert.run(`ks_${i}`, diagram.id, kb.id);
    expect((await send(ada.auth, ask(kb.id, diagram.id))).status).toBe(409);
  });
});

describe("a page's headings", () => {
  const outline = (auth: string, kbId: string, page = 'page-1') =>
    call(`/items/${kbId}/knowledge-sends/outline?page=${page}`, { auth });

  it("reads them through liveknowledge's door for an Editor, kept to their shape", async () => {
    const { ada, kb } = await world();
    h.appAnswer = () =>
      Response.json({
        ok: true,
        headings: [
          { id: 'h1', level: 2, text: 'Overview' },
          { id: 'h2', level: 4, text: 'Too deep' },
          { id: 5, level: 1, text: 'No id' },
          null,
        ],
      });
    const res = await outline(ada.auth, kb.id);
    expect(await body(res)).toEqual({ headings: [{ id: 'h1', level: 2, text: 'Overview' }] });
    expect(doorCalls()[0]!.body).toEqual({ op: 'outline', person: 'user_ada', page: 'page-1' });
  });

  it('answers no headings when the door sends none it can read', async () => {
    const { ada, kb } = await world();
    h.appAnswer = () => Response.json({ ok: true, headings: 'none' });
    expect(await body(await outline(ada.auth, kb.id))).toEqual({ headings: [] });
  });

  it("is refused to a Viewer, without a page, and passes on the door's failure", async () => {
    const { ada, ben, kb } = await world();
    await visit(ada.auth, kb.id, ben.auth, 'view');
    expect((await outline(ben.auth, kb.id)).status).toBe(403);
    expect((await outline(ada.auth, kb.id, '')).status).toBe(400);
    h.appAnswer = () => new Response(null, { status: 404 });
    expect((await outline(ada.auth, kb.id)).status).toBe(403);
    h.appAnswer = () => new Response(null, { status: 500 });
    expect((await outline(ada.auth, kb.id)).status).toBe(503);
  });
});

const agentSend = (kbId: string, payload: unknown, key = 'lk-key', app = 'liveknowledge') =>
  call(`/app/items/${kbId}/knowledge-sends`, {
    method: 'POST',
    auth: key,
    headers: { 'X-Index-App': app },
    body: payload,
  });

describe("an agent's write with a source", () => {
  it('answers the Sent From line, and records the send only when asked and the person reads the source', async () => {
    const { ada, ben, diagram, kb } = await world();
    const payload = {
      person: 'user_ada',
      source: { app: 'livediagram', itemId: diagram.id, tabId: 't1', elementIds: ['e1'] },
      page: { id: 'page-9', title: 'Flows' },
    };
    const first = await body<{ sentFrom: unknown }>(await agentSend(kb.id, payload));
    expect(first.sentFrom).toEqual({
      app: 'livediagram',
      title: 'Payments',
      link: `${appSiteOrigin(h.db.env, 'livediagram')}/document/${diagram.id}#t=t1&el=e1`,
    });
    expect(await sendsOf(ada.auth, diagram.id)).toEqual([]);
    await agentSend(kb.id, { ...payload, record: true });
    expect((await sendsOf(ada.auth, diagram.id)).map((s) => s.page.id)).toEqual(['page-9']);
    // Ben cannot read the source: nothing is answered or recorded for him.
    const bens = await body<{ sentFrom: unknown }>(
      await agentSend(kb.id, { ...payload, person: ben.id, record: true }),
    );
    expect(bens.sentFrom).toBeNull();
    expect(await sendsOf(ada.auth, diagram.id)).toHaveLength(1);
  });

  it('names an untitled source plainly, links to its item alone without a tab, and keeps to the cap', async () => {
    const { ada, kb } = await world();
    const bare = await makeItem(ada.auth, { app: 'livediagram', title: 'Bare' });
    h.db.sql.prepare("UPDATE items SET title = '' WHERE id = ?").run(bare.id);
    const payload = {
      person: 'user_ada',
      source: { app: 'livediagram', itemId: bare.id },
      page: { id: 'page-9', title: 'Flows' },
      record: true,
    };
    const out = await body<{ sentFrom: { title: string; link: string } }>(
      await agentSend(kb.id, payload),
    );
    expect(out.sentFrom.title).toBe('Untitled');
    expect(out.sentFrom.link).not.toContain('el=');
    expect(
      (
        await call(`/app/items/${kb.id}/knowledge-sends`, {
          auth: 'lk-key',
          headers: { 'X-Index-App': 'liveknowledge' },
        })
      ).status,
    ).toBe(404);
    const insert = h.db.sql.prepare(
      `INSERT INTO knowledge_sends (id, source_id, source_tab_id, elements, kb_id, page_id, page_title, place_link, at)
       VALUES (?, ?, '', '[]', ?, 'p', '', '', 1)`,
    );
    for (let i = 0; i < 1000; i++) insert.run(`ks_cap_${i}`, bare.id, kb.id);
    expect((await agentSend(kb.id, payload)).status).toBe(409);
  });

  it("is liveknowledge's alone, for its own item, with a body that reads", async () => {
    const { diagram, kb } = await world();
    const payload = {
      person: 'user_ada',
      source: { app: 'livediagram', itemId: diagram.id },
      page: { id: 'p' },
    };
    expect((await agentSend(diagram.id, payload, 'ld-key', 'livediagram')).status).toBe(403);
    expect((await agentSend('missing', payload)).status).toBe(404);
    expect((await agentSend(kb.id, { person: 'user_ada' })).status).toBe(400);
    expect(
      (await agentSend(kb.id, { ...payload, source: { app: 'liveplanner', itemId: diagram.id } }))
        .status,
    ).toBe(200);
    expect(
      await body(
        await agentSend(kb.id, { ...payload, source: { app: 'liveplanner', itemId: diagram.id } }),
      ),
    ).toEqual({ sentFrom: null });
  });
});
