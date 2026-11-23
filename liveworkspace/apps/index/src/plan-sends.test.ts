// Send to Plan on the index (liveworkspace/docs/specs/004-index/send-to-plan.md): a card made in a plan as the person,
// only on their Editor access to the whole plan and their read of the source; the source's chips shown only to those
// who can open the plan; the plan's changes told to the source's app, and never polled.
import type { PlanSend, SentFrom } from '@liveworkspace/index-client';
import { decodeJwt } from 'jose';
import { describe, expect, it } from 'vitest';
import { appSiteOrigin } from './connection-rows';
import { cardLink, placeLink } from './plan-sends';
import { body, call, h, makeItem, person, useHarness } from './test-support';

useHarness();

async function world() {
  const ada = await person('user_ada');
  const ben = await person('user_ben');
  const plan = await makeItem(ada.auth, { title: 'Sprint' });
  const doc = await makeItem(ada.auth, { app: 'livediagram', title: 'Retro' });
  h.appCalls = [];
  return { ada, ben, plan, doc };
}

// A share link at `level` (every tab, or one), opened by `visitor` so it is theirs.
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

const place = (itemId: string, over: Record<string, unknown> = {}) => ({
  app: 'livediagram',
  itemId,
  kind: 'element',
  tabId: 't1',
  elementId: 'e1',
  part: null,
  label: 'Board',
  text: 'Fix the login @Ben by Friday',
  ...over,
});

const ask = (itemId: string, over: Record<string, unknown> = {}) => ({
  board: 'b1',
  column: 'To Do',
  cards: [{ title: 'Fix the login', assignee: 'Ben', places: [place(itemId)] }],
  ...over,
});

const made = (ids: string[]) => () =>
  Response.json({
    ok: true,
    cards: ids.map((id) => ({ id, title: 'Fix the login', column: 'To Do', done: false })),
  });

const send = (auth: string, planId: string, payload: unknown) =>
  call(`/items/${planId}/plan-sends`, { method: 'POST', auth, body: payload });

const sends = async (auth: string, sourceId: string) =>
  (await body<{ sends: PlanSend[] }>(await call(`/items/${sourceId}/plan-sends`, { auth }))).sends;

const site = (app: 'livediagram' | 'liveplanner') => appSiteOrigin(h.db.env, app);

const doorCalls = () => h.appCalls.filter((c) => c.url.endsWith('/plan-send'));

describe('a send to a plan', () => {
  it("asks liveplanner's door with the person's own grant, the words and a link to the exact place", async () => {
    const { ada, plan, doc } = await world();
    h.appAnswer = made(['card1']);
    const res = await send(ada.auth, plan.id, ask(doc.id));
    expect(res.status).toBe(201);
    const [door] = doorCalls();
    expect(door!.url).toBe(`https://liveplanner.app/api/internal/items/${plan.id}/plan-send`);
    expect(door!.headers.get('Authorization')).toBe('Bearer lp-key');
    expect(decodeJwt(door!.headers.get('X-Index-Grant')!)).toMatchObject({
      sub: 'user_ada',
      aud: 'liveplanner',
      item: plan.id,
      level: 'edit',
      tab: null,
    });
    const link = `${site('livediagram')}/document/${doc.id}#t=t1&el=e1`;
    const sentFrom: SentFrom = {
      app: 'livediagram',
      itemId: doc.id,
      title: 'Retro',
      kind: 'element',
      label: 'Board',
      text: 'Fix the login @Ben by Friday',
      link,
    };
    expect(door!.body).toMatchObject({
      person: 'user_ada',
      board: 'b1',
      column: 'To Do',
      cards: [{ title: 'Fix the login', assignee: 'Ben', sentFrom }],
    });
    const description = (door!.body as { cards: { description: string }[] }).cards[0]!.description;
    expect(description).toContain('Fix the login @Ben by Friday');
    expect(description).toContain(`From Retro, Board (livediagram): ${link}`);
    const { sends: answered } = await body<{ sends: PlanSend[] }>(res);
    expect(answered).toEqual([
      expect.objectContaining({
        kind: 'element',
        plan: { id: plan.id, title: 'Sprint' },
        card: { id: 'card1', title: 'Fix the login', column: 'To Do', done: false },
        link: `${site('liveplanner')}/project/${plan.id}#item=card1`,
      }),
    ]);
    expect(await sends(ada.auth, doc.id)).toEqual(answered);
  });

  it('offers the card already made for the same place, and makes another only when asked again', async () => {
    const { ada, plan, doc } = await world();
    h.appAnswer = made(['card1']);
    await send(ada.auth, plan.id, ask(doc.id));
    const again = await send(ada.auth, plan.id, ask(doc.id));
    expect(again.status).toBe(409);
    expect(await body(again)).toMatchObject({
      error: 'already_sent',
      send: { card: { id: 'card1' } },
    });
    expect(doorCalls()).toHaveLength(1);
    h.appAnswer = made(['card2']);
    expect((await send(ada.auth, plan.id, ask(doc.id, { again: true }))).status).toBe(201);
    expect((await sends(ada.auth, doc.id)).map((s) => s.card.id).sort()).toEqual([
      'card1',
      'card2',
    ]);
  });

  it('one card with a checklist records each place, so each sticky offers its card', async () => {
    const { ada, plan, doc } = await world();
    h.appAnswer = made(['card1']);
    const cards = [
      {
        title: 'Retro actions',
        checklist: ['One', 'Two'],
        places: [place(doc.id, { elementId: 'e1' }), place(doc.id, { elementId: 'e2' })],
      },
    ];
    expect((await send(ada.auth, plan.id, ask(doc.id, { cards }))).status).toBe(201);
    expect((door() as { cards: { checklist: string[] }[] }).cards[0]!.checklist).toEqual([
      'One',
      'Two',
    ]);
    expect((await sends(ada.auth, doc.id)).map((s) => s.ref).sort()).toEqual([
      'element:t1:e1:',
      'element:t1:e2:',
    ]);
  });

  it('answers what the plan refused, and a plan that could not be reached', async () => {
    const { ada, plan, doc } = await world();
    h.appAnswer = () => Response.json({ ok: false, code: 'target_gone', reason: 'No board' });
    const res = await send(ada.auth, plan.id, ask(doc.id));
    expect(res.status).toBe(422);
    expect(await body(res)).toEqual({
      error: 'plan_refused',
      code: 'target_gone',
      reason: 'No board',
    });
    h.appAnswer = () => new Response(null, { status: 500 });
    expect((await send(ada.auth, plan.id, ask(doc.id))).status).toBe(503);
    h.appAnswer = () => new Response(null, { status: 403 });
    expect((await send(ada.auth, plan.id, ask(doc.id))).status).toBe(403);
    expect(await sends(ada.auth, doc.id)).toEqual([]);
  });

  it('reads only a whole ask, of one source, in that source’s own app', async () => {
    const { ada, plan, doc } = await world();
    const other = await makeItem(ada.auth, { app: 'livediagram', title: 'Other' });
    for (const bad of [
      {},
      ask(doc.id, { cards: [] }),
      ask(doc.id, { cards: [{ title: 'x', places: [place(doc.id), place(other.id)] }] }),
      ask(doc.id, { cards: [{ title: 'x', places: [place(doc.id, { app: 'livedocuments' })] }] }),
    ])
      expect((await send(ada.auth, plan.id, bad)).status).toBe(400);
    expect(doorCalls()).toEqual([]);
  });
});

describe('who may send (share roles)', () => {
  it('needs Editor on the whole plan: a Viewer, a Participant or one tab’s Editor is refused', async () => {
    const { ada, ben, doc } = await world();
    await visit(ada.auth, doc.id, ben.id === 'user_ben' ? ben.auth : '', 'view');
    for (const [level, tab] of [
      ['view', undefined],
      ['participate', undefined],
      ['edit', 'tab1'],
    ] as const) {
      const plan = await makeItem(ada.auth, { title: `Plan ${level}` });
      await visit(ada.auth, plan.id, ben.auth, level, tab);
      expect((await send(ben.auth, plan.id, ask(doc.id))).status).toBe(403);
    }
    expect(doorCalls()).toEqual([]);
  });

  it('needs only read on the source: a Viewer of it with Editor on the plan sends', async () => {
    const { ada, ben, plan, doc } = await world();
    await visit(ada.auth, plan.id, ben.auth, 'edit');
    // No read on the source: it answers as missing, and nothing is asked of the plan.
    expect((await send(ben.auth, plan.id, ask(doc.id))).status).toBe(404);
    await visit(ada.auth, doc.id, ben.auth, 'view');
    h.appAnswer = made(['card1']);
    expect((await send(ben.auth, plan.id, ask(doc.id))).status).toBe(201);
    expect(decodeJwt(doorCalls()[0]!.headers.get('X-Index-Grant')!)).toMatchObject({
      sub: 'user_ben',
    });
  });

  it('refuses a guest, an item that is no plan, and a plan in the Trash', async () => {
    const { ada, plan, doc } = await world();
    const guest = await person('guest_1', { guest: true });
    expect((await send(guest.auth, plan.id, ask(doc.id))).status).toBe(403);
    expect((await send(ada.auth, doc.id, ask(doc.id))).status).toBe(403);
    h.db.sql.prepare('UPDATE items SET trashed_at = 1 WHERE id = ?').run(plan.id);
    expect((await send(ada.auth, plan.id, ask(doc.id))).status).not.toBe(201);
    expect(
      (await call(`/items/${plan.id}/plan-sends`, { method: 'PUT', auth: ada.auth })).status,
    ).toBe(404);
  });
});

describe("a source's chips", () => {
  it('show only to a reader who can open the plan', async () => {
    const { ada, ben, plan, doc } = await world();
    h.appAnswer = made(['card1']);
    await send(ada.auth, plan.id, ask(doc.id));
    await visit(ada.auth, doc.id, ben.auth, 'view');
    expect(await sends(ben.auth, doc.id)).toEqual([]);
    await visit(ada.auth, plan.id, ben.auth, 'view');
    expect(await sends(ben.auth, doc.id)).toHaveLength(1);
    // No read on the source: nothing at all.
    const cara = await person('user_cara');
    expect((await call(`/items/${doc.id}/plan-sends`, { auth: cara.auth })).status).toBe(404);
  });
});

const changed = (planId: string, cards: unknown[], app = 'liveplanner', key = 'lp-key') =>
  call(`/app/items/${planId}/plan-cards`, {
    method: 'POST',
    auth: key,
    headers: { 'X-Index-App': app },
    body: { cards },
  });

describe("a plan's sent cards changing", () => {
  it("updates the sends and tells the source's app, once, only when something changed", async () => {
    const { ada, plan, doc } = await world();
    h.appAnswer = made(['card1']);
    await send(ada.auth, plan.id, ask(doc.id));
    h.appCalls = [];
    h.appAnswer = () => new Response(null, { status: 200 });
    const moved = { id: 'card1', title: 'Fix the login', column: 'Done', done: true, gone: false };
    const res = await changed(plan.id, [moved, { ...moved, id: 'unknown' }]);
    expect(await body(res)).toEqual({ told: 1 });
    expect(h.appCalls).toEqual([
      expect.objectContaining({
        url: `https://www.livediagram.app/api/internal/items/${doc.id}/source-changed`,
        body: { app: 'liveplanner', itemId: plan.id, sheetIds: [], cards: ['card1'] },
      }),
    ]);
    expect((await sends(ada.auth, doc.id))[0]!.card).toEqual({
      id: 'card1',
      title: 'Fix the login',
      column: 'Done',
      done: true,
    });
    h.appCalls = [];
    expect(await body(await changed(plan.id, [moved]))).toEqual({ told: 0 });
    expect(h.appCalls).toEqual([]);
    // A card in the Trash: its chip goes.
    await changed(plan.id, [{ ...moved, gone: true }]);
    expect(await sends(ada.auth, doc.id)).toEqual([]);
  });

  it("takes only the plan's own app's word, and a whole call", async () => {
    const { plan, doc } = await world();
    const card = { id: 'c', title: 't', column: 'c', done: false, gone: false };
    expect((await changed(plan.id, [card], 'livediagram', 'ld-key')).status).toBe(403);
    expect((await changed(doc.id, [card], 'livediagram', 'ld-key')).status).toBe(403);
    expect((await changed(plan.id, [])).status).toBe(400);
    expect((await changed('missing', [card])).status).toBe(404);
  });
});

const agentSends = (planId: string, payload: unknown) =>
  call(`/app/items/${planId}/plan-sends`, {
    method: 'POST',
    auth: 'lp-key',
    headers: { 'X-Index-App': 'liveplanner' },
    body: payload,
  });

describe("an agent's cards with a source", () => {
  it("fills in and records each source the person can read, and nothing for one they can't", async () => {
    const { ada, ben, plan, doc } = await world();
    const bens = await makeItem(ben.auth, { app: 'livediagram', title: 'Private' });
    const card = (id: string, itemId: string, elementId?: string) => ({
      id,
      title: 'T',
      column: 'To Do',
      done: false,
      sentFrom: {
        app: 'livediagram',
        itemId,
        ...(elementId ? { elementId, tabId: 't1' } : {}),
        text: 'Words',
      },
    });
    const res = await agentSends(plan.id, {
      person: 'user_ada',
      cards: [card('c1', doc.id, 'e1'), card('c2', bens.id), card('c3', doc.id)],
    });
    const { sentFrom } = await body<{ sentFrom: (SentFrom | null)[] }>(res);
    expect(sentFrom).toEqual([
      {
        app: 'livediagram',
        itemId: doc.id,
        title: 'Retro',
        kind: 'element',
        label: '',
        text: 'Words',
        link: `${site('livediagram')}/document/${doc.id}#t=t1&el=e1`,
      },
      null,
      expect.objectContaining({ kind: 'text', link: `${site('livediagram')}/document/${doc.id}` }),
    ]);
    expect((await sends(ada.auth, doc.id)).map((s) => s.card.id).sort()).toEqual(['c1', 'c3']);
    expect((await agentSends(plan.id, { person: 'user_ada', cards: [] })).status).toBe(400);
    expect(
      (await agentSends(plan.id, { person: 'guest_x', cards: [card('c', doc.id)] })).status,
    ).toBe(400);
  });
});

describe('New Plan', () => {
  it("makes an empty Kanban plan of the person's own through liveplanner's template door", async () => {
    const { ada } = await world();
    const made = await makeItem(ada.auth, { title: 'Launch' });
    h.appCalls = [];
    h.appAnswer = () => Response.json({ id: made.id });
    const res = await call('/plan-sends/plans', {
      method: 'POST',
      auth: ada.auth,
      body: { name: 'Launch' },
    });
    expect(res.status).toBe(201);
    expect(await body(res)).toMatchObject({
      item: { id: made.id, app: 'liveplanner', access: 'edit' },
    });
    expect(h.appCalls[0]!.body).toEqual({
      owner: 'user_ada',
      folderId: null,
      name: 'Launch',
      template: 'kanban',
      // An empty Kanban: the Board tab alone, no example cards or sample people.
      bare: true,
    });
    h.appAnswer = () => new Response(null, { status: 500 });
    expect(
      (await call('/plan-sends/plans', { method: 'POST', auth: ada.auth, body: { name: 'X' } }))
        .status,
    ).toBe(503);
    expect(
      (await call('/plan-sends/plans', { method: 'POST', auth: ada.auth, body: { name: '' } }))
        .status,
    ).toBe(400);
    expect((await call('/plan-sends/plans', { method: 'GET', auth: ada.auth })).status).toBe(404);
  });
});

describe('the links', () => {
  it("open the exact place: a thread's comments, an action, a plan's card", () => {
    const env = { ENVIRONMENT: 'production' };
    const at = (over: Record<string, unknown>) =>
      placeLink(env, {
        app: 'livediagram',
        itemId: 'D',
        kind: 'element',
        tabId: null,
        elementId: null,
        ...over,
      } as never);
    expect(at({})).toBe('https://www.livediagram.app/document/D');
    expect(at({ kind: 'thread', elementId: 'e' })).toBe(
      'https://www.livediagram.app/document/D#el=e&open=comments',
    );
    expect(at({ kind: 'action', tabId: 't', elementId: 'e' })).toBe(
      'https://www.livediagram.app/document/D#t=t&el=e&open=action',
    );
    expect(at({ app: 'liveplanner', kind: 'thread', elementId: 'c' })).toBe(
      'https://www.liveplanner.app/project/D#item=c',
    );
    expect(at({ app: 'liveplanner', kind: 'thread', elementId: 'c', part: 'th 1' })).toBe(
      'https://www.liveplanner.app/project/D#item=c&thread=th%201',
    );
    expect(cardLink(env, 'P', 'c 1')).toBe('https://www.liveplanner.app/project/P#item=c%201');
  });
});

function door() {
  return doorCalls()[0]!.body;
}

describe('the bounds', () => {
  it('a source holds at most its sends, a failed tell is only logged, a bad agent card is refused', async () => {
    const { ada, plan, doc } = await world();
    const insert = h.db.sql.prepare(
      `INSERT INTO plan_sends (id, source_id, ref, kind, plan_id, card_id, card_title, column_name, at, updated_at)
       VALUES (?, ?, ?, 'element', ?, ?, 'T', 'To Do', 1, 1)`,
    );
    for (let i = 0; i < 499; i++)
      insert.run(`ps_${i}`, doc.id, `element:t:e${i}:`, plan.id, `c${i}`);
    h.appAnswer = made(['c1']);
    const two = { title: 'x', places: [place(doc.id), place(doc.id, { elementId: 'e2' })] };
    const full = await send(ada.auth, plan.id, ask(doc.id, { cards: [two] }));
    expect(full.status).toBe(409);
    expect(await body(full)).toEqual({ error: 'source_full' });
    const card = {
      id: 'c',
      title: 't',
      column: 'c',
      done: false,
      sentFrom: { app: 'livediagram', itemId: doc.id, text: 'w' },
    };
    const pair = { person: 'user_ada', cards: [card, { ...card, id: 'd' }] };
    expect((await agentSends(plan.id, pair)).status).toBe(409);
    for (const bad of [
      { ...card, done: 'no' },
      { ...card, title: 3 },
      { ...card, sentFrom: null },
    ])
      expect((await agentSends(plan.id, { person: 'user_ada', cards: [bad] })).status).toBe(400);
    h.appAnswer = () => new Response(null, { status: 500 });
    const moved = { id: 'c3', title: 'New', column: 'Done', done: true, gone: false };
    expect(await body(await changed(plan.id, [moved]))).toEqual({ told: 1 });
  });
});
