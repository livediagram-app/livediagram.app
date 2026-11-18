// Request Access (request-access.md): the same answer for every id; who may ask; the person's limit, the repeat window
// and the item's email limit; who is emailed; granting (a link, Shared with me, the requester opens it, the `shared`
// event, the notice), its levels, its race and its cap; declining; who may grant and decline; the Inbox's rows and
// their reach; closing an account.
import {
  ACCESS_REQUEST_EMAILS_PER_ITEM_DAY,
  ACCESS_REQUEST_REPEAT_MS,
  ACCESS_REQUESTS_PER_PERSON_DAY,
  SHARE_LINKS_PER_ITEM,
  type InboxAccessRequest,
  type ItemEvent,
  type ShareLink,
} from '@liveworkspace/index-client';
import { describe, expect, it, vi } from 'vitest';
import { purgePerson } from './account-purge';
import { body, call, h, makeItem, person, settle, useHarness, type AppCall } from './test-support';

useHarness();

const TEAM = 'team_1';
const NAMES: Record<string, string> = { user_a: 'Ada', user_b: 'Bo', user_c: 'Cy' };

// Accounts as the index reads it: names, and each person's teams.
function accounts(teams: Record<string, string[]> = {}) {
  h.appAnswer = (c: AppCall) => {
    if (c.url.endsWith('/api/account/index/people')) {
      const ids = (c.body as { ids: string[] }).ids;
      return Response.json({
        people: ids.filter((id) => NAMES[id]).map((id) => ({ id, name: NAMES[id] })),
      });
    }
    if (c.url.endsWith('/api/account/index/teams')) {
      const userId = (c.body as { userId: string }).userId;
      return Response.json({
        teams: (teams[userId] ?? []).map((id) => ({ id, name: id, role: 'member' })),
      });
    }
    return new Response(null, { status: 200 });
  };
}

const ask = async (auth: string, id: string, input: Record<string, unknown> = {}) => {
  const res = await call(`/items/${id}/access-requests`, { method: 'POST', auth, body: input });
  await settle();
  return res;
};
const grant = (auth: string, id: string, requestId: string, input: Record<string, unknown> = {}) =>
  call(`/items/${id}/access-requests/${requestId}/grant`, { method: 'POST', auth, body: input });
const decline = (auth: string, id: string, requestId: string) =>
  call(`/items/${id}/access-requests/${requestId}/decline`, { method: 'POST', auth });
const inboxOf = async (auth: string, app?: string) =>
  (
    await body<{ accessRequests: InboxAccessRequest[] }>(
      await call(`/inbox${app ? `?app=${app}` : ''}`, { auth }),
    )
  ).accessRequests;
const notices = (type: string) =>
  h.appCalls.filter(
    (c) => c.url.includes('/notices') && (c.body as { type?: string }).type === type,
  );
const rows = () =>
  h.db.sql.prepare('SELECT * FROM access_requests ORDER BY asked_at').all() as {
    id: string;
    item_id: string;
    requester_id: string;
    state: string;
    share_code: string | null;
    emailed_at: number | null;
  }[];

async function setup() {
  accounts();
  const ada = await person('user_a');
  const bo = await person('user_b');
  const item = await makeItem(ada.auth, { title: 'Roadmap' });
  return { ada, bo, item };
}

describe('asking reveals nothing', () => {
  it('answers every id the same, and records only a real, live item the person can’t reach', async () => {
    const { ada, bo, item } = await setup();
    const own = await makeItem(bo.auth, { title: 'Mine' });
    const trashed = await makeItem(ada.auth, { title: 'Gone' });
    expect((await call(`/items/${trashed.id}`, { method: 'DELETE', auth: ada.auth })).status).toBe(
      204,
    );
    const reached = await makeItem(ada.auth, { title: 'Shared' });
    const share = await call(`/items/${reached.id}/share`, {
      method: 'POST',
      auth: ada.auth,
      body: { level: 'view' },
    });
    const { link } = await body<{ link: ShareLink }>(share);
    expect((await call(`/share/${link.code}`, { auth: bo.auth })).status).toBe(200);

    const answers = [];
    for (const id of ['nothing_here', own.id, trashed.id, reached.id, item.id]) {
      const res = await ask(bo.auth, id, { note: 'Please' });
      answers.push({ status: res.status, body: await body(res) });
    }
    for (const answer of answers)
      expect(answer).toEqual({ status: 202, body: { requested: true } });
    expect(rows().map((r) => r.item_id)).toEqual([item.id]);
  });

  it('refuses a malformed note or id, and anyone not an account in person', async () => {
    const { bo, item } = await setup();
    expect((await ask(bo.auth, item.id, { note: 7 })).status).toBe(400);
    expect((await ask(bo.auth, item.id, { note: 'x'.repeat(301) })).status).toBe(400);
    expect((await ask(bo.auth, 'bad id!')).status).toBe(400);
    const bad = await call(`/items/${item.id}/access-requests`, {
      method: 'POST',
      auth: bo.auth,
      headers: { 'Content-Length': '1' },
      body: '[',
    });
    expect(bad.status).toBe(400);
    expect((await call(`/items/${item.id}/access-requests`, { method: 'POST' })).status).toBe(401);
    const agent = await call(`/items/${item.id}/access-requests`, {
      method: 'POST',
      auth: 'lp-key',
      headers: { 'X-Index-App': 'liveplanner', 'X-Index-Person': 'user_b' },
      body: {},
    });
    expect(agent.status).toBe(403);
    expect(await body(agent)).toEqual({ error: 'access_requests_need_a_person' });
    const guest = await person('guest_g', { guest: true });
    expect((await ask(guest.auth, item.id)).status).toBe(403);
    expect(
      (await call(`/items/${item.id}/access-requests`, { method: 'GET', auth: bo.auth })).status,
    ).toBe(404);
    expect(
      (
        await call(`/items/${item.id}/access-requests/ar_1/other`, {
          method: 'POST',
          auth: bo.auth,
        })
      ).status,
    ).toBe(404);
    expect(rows()).toEqual([]);
  });

  it('limits a person’s asks in a day across every id, real or not', async () => {
    const { bo, item } = await setup();
    for (let i = 0; i < ACCESS_REQUESTS_PER_PERSON_DAY; i++) {
      expect((await ask(bo.auth, `made_up_${i}`)).status).toBe(202);
    }
    const over = await ask(bo.auth, item.id);
    expect(over.status).toBe(429);
    expect(over.headers.get('Retry-After')).toBe('3600');
    expect(await body(over)).toEqual({ error: 'rate_limited' });
    expect(rows()).toEqual([]);
    // A day on, the old tries no longer count, and the ask clears them.
    h.db.sql.prepare('UPDATE access_request_tries SET at = at - ?').run(24 * 60 * 60 * 1000);
    expect((await ask(bo.auth, item.id)).status).toBe(202);
    const left = h.db.sql
      .prepare("SELECT COUNT(*) AS n FROM access_request_tries WHERE person_id = 'user_b'")
      .get() as { n: number };
    expect(left.n).toBe(1);
  });
});

describe('who is told', () => {
  it('lists the request in the owner’s Inbox and tells the app to email them', async () => {
    const { ada, bo, item } = await setup();
    await ask(bo.auth, item.id, { note: '  On the launch team  ' });
    expect(await inboxOf(ada.auth)).toEqual([
      {
        id: expect.stringMatching(/^ar_/),
        app: 'liveplanner',
        itemId: item.id,
        itemTitle: 'Roadmap',
        itemTeamId: null,
        requesterId: 'user_b',
        requesterName: 'Bo',
        note: 'On the launch team',
        askedAt: expect.any(Number),
      },
    ]);
    expect(await inboxOf(ada.auth, 'livediagram')).toEqual([]);
    // The requester's own Inbox says nothing of it.
    expect(await inboxOf(bo.auth)).toEqual([]);
    const [notice] = notices('access_requested');
    expect(notice!.url).toContain(`/items/${item.id}/notices`);
    expect(notice!.body).toEqual({
      type: 'access_requested',
      requestId: rows()[0]!.id,
      requesterId: 'user_b',
      requesterName: 'Bo',
      recipientIds: ['user_a'],
      itemTitle: 'Roadmap',
      note: 'On the launch team',
    });
  });

  it('asks once a week: again while open or too soon changes nothing', async () => {
    const { ada, bo, item } = await setup();
    await ask(bo.auth, item.id, { note: 'First' });
    await ask(bo.auth, item.id, { note: 'Second' });
    expect((await inboxOf(ada.auth)).map((r) => r.note)).toEqual(['First']);
    const [request] = rows();
    expect((await decline(ada.auth, item.id, request!.id)).status).toBe(204);
    await ask(bo.auth, item.id, { note: 'Third' });
    expect(await inboxOf(ada.auth)).toEqual([]);
    expect(notices('access_requested')).toHaveLength(1);
    // A week on, they may ask again: the same request, reopened.
    h.db.sql
      .prepare('UPDATE access_requests SET asked_at = asked_at - ?')
      .run(ACCESS_REQUEST_REPEAT_MS);
    await ask(bo.auth, item.id, { note: 'Fourth' });
    expect((await inboxOf(ada.auth)).map((r) => [r.id, r.note])).toEqual([[request!.id, 'Fourth']]);
    expect(notices('access_requested')).toHaveLength(2);
  });

  it('emails an item’s managers at most ten times a day, and still lists every request', async () => {
    const { ada, item } = await setup();
    const many = ACCESS_REQUEST_EMAILS_PER_ITEM_DAY + 2;
    for (let i = 0; i < many; i++) await ask((await person(`user_x${i}`)).auth, item.id);
    expect(notices('access_requested')).toHaveLength(ACCESS_REQUEST_EMAILS_PER_ITEM_DAY);
    expect(await inboxOf(ada.auth)).toHaveLength(many);
  });

  it('on a team item, lists it for every member and emails its maker only while they are in the team', async () => {
    const ada = await person('user_a', { teams: [{ id: TEAM }] });
    const cy = await person('user_c', { teams: [{ id: TEAM }] });
    const bo = await person('user_b');
    accounts({ user_a: [TEAM] });
    const item = await makeItem(ada.auth, { teamId: TEAM, title: 'Plan' });
    await ask(bo.auth, item.id);
    expect((await inboxOf(cy.auth)).map((r) => r.itemTeamId)).toEqual([TEAM]);
    expect(
      (notices('access_requested')[0]!.body as { recipientIds: string[] }).recipientIds,
    ).toEqual(['user_a']);
    // Ada has left: Cy's ask reaches the Inbox alone.
    accounts({});
    const di = await person('user_d');
    await ask(di.auth, item.id);
    expect(notices('access_requested')).toHaveLength(1);
    expect(await inboxOf(cy.auth)).toHaveLength(2);
    expect(rows().find((r) => r.requester_id === 'user_d')!.emailed_at).toBeNull();
  });

  it('lists nothing for a request on an item in the Trash or Archived, or from someone who now reaches it', async () => {
    const { ada, bo, item } = await setup();
    const cy = await person('user_c');
    const other = await makeItem(ada.auth, { title: 'Other' });
    await ask(bo.auth, item.id);
    await ask(cy.auth, other.id);
    expect(await inboxOf(ada.auth)).toHaveLength(2);
    await call(`/items/${item.id}`, { method: 'DELETE', auth: ada.auth });
    expect((await inboxOf(ada.auth)).map((r) => r.itemId)).toEqual([other.id]);
    // Cy is sent a link and opens it: their request stops asking.
    const share = await call(`/items/${other.id}/share`, {
      method: 'POST',
      auth: ada.auth,
      body: { level: 'view' },
    });
    const { link } = await body<{ link: ShareLink }>(share);
    await call(`/share/${link.code}`, { auth: cy.auth });
    expect(await inboxOf(ada.auth)).toEqual([]);
    const archived = await makeItem(ada.auth, { title: 'Old' });
    await ask(bo.auth, archived.id);
    expect(await inboxOf(ada.auth)).toHaveLength(1);
    expect(
      (await call(`/items/${archived.id}/archive`, { method: 'POST', auth: ada.auth })).status,
    ).toBe(200);
    expect(await inboxOf(ada.auth)).toEqual([]);
  });
});

describe('granting', () => {
  it('makes a Viewer link, puts the item in their Shared with me, and tells the app', async () => {
    const { ada, bo, item } = await setup();
    await ask(bo.auth, item.id);
    const [request] = rows();
    const res = await grant(ada.auth, item.id, request!.id);
    expect(res.status).toBe(200);
    const { link } = await body<{ link: ShareLink }>(res);
    expect(link).toMatchObject({ itemId: item.id, level: 'view', tabId: null, expiry: 'never' });
    expect(rows()[0]).toMatchObject({ state: 'granted', share_code: link.code });
    // Bo opens it with no code, at the link's level, and finds it in his Shared with me.
    const read = await call(`/items/${item.id}`, { auth: bo.auth });
    expect(read.status).toBe(200);
    expect(await body(read)).toMatchObject({ item: { id: item.id, access: 'view' } });
    const shared = await body<{ shared: { item: { id: string }; level: string }[] }>(
      await call('/shared', { auth: bo.auth }),
    );
    expect(shared.shared.map((s) => [s.item.id, s.level])).toEqual([[item.id, 'view']]);
    expect(await inboxOf(ada.auth)).toEqual([]);
    await settle();
    expect(notices('access_granted')[0]!.body).toEqual({
      type: 'access_granted',
      requestId: request!.id,
      requesterId: 'user_b',
      granterId: 'user_a',
      granterName: 'Ada',
      level: 'view',
      itemTitle: 'Roadmap',
    });
    const history = await body<{ events: ItemEvent[] }>(
      await call(`/items/${item.id}/history`, { auth: ada.auth }),
    );
    expect(history.events.find((e) => e.type === 'shared')).toMatchObject({
      actorId: 'user_a',
      detail: { level: 'view' },
    });
    // Answered: again is not found.
    expect((await grant(ada.auth, item.id, request!.id)).status).toBe(404);
    expect((await decline(ada.auth, item.id, request!.id)).status).toBe(404);
  });

  it('grants at the level picked, refusing one the app does not offer', async () => {
    const { ada, bo, item } = await setup();
    await ask(bo.auth, item.id);
    const [request] = rows();
    expect((await grant(ada.auth, item.id, request!.id, { level: 'owner' })).status).toBe(400);
    const res = await grant(ada.auth, item.id, request!.id, { level: 'edit' });
    expect((await body<{ link: ShareLink }>(res)).link.level).toBe('edit');
    // livehuddle offers no Viewer: its own default, and Viewer is refused.
    const space = await makeItem(ada.auth, { app: 'livehuddle', title: 'Space' });
    await ask(bo.auth, space.id);
    const second = rows().find((r) => r.item_id === space.id)!;
    const refused = await grant(ada.auth, space.id, second.id, { level: 'view' });
    expect(await body(refused)).toEqual({ error: 'level_not_offered' });
    const made = await grant(ada.auth, space.id, second.id);
    expect((await body<{ link: ShareLink }>(made)).link.level).toBe('participate');
  });

  it('leaves the request open at the item’s link cap', async () => {
    const { ada, bo, item } = await setup();
    await ask(bo.auth, item.id);
    const [request] = rows();
    const insert = h.db.sql.prepare(
      `INSERT INTO share_links (code, item_id, level, created_at) VALUES (?, ?, 'view', 1)`,
    );
    for (let i = 0; i < SHARE_LINKS_PER_ITEM; i++) insert.run(`code_${i}`, item.id);
    const res = await grant(ada.auth, item.id, request!.id);
    expect(res.status).toBe(409);
    expect(await body(res)).toEqual({ error: 'share_link_limit' });
    expect(rows()[0]!.state).toBe('open');
  });

  it('makes one link when two managers answer at once', async () => {
    const ada = await person('user_a', { teams: [{ id: TEAM }] });
    const cy = await person('user_c', { teams: [{ id: TEAM }] });
    const bo = await person('user_b');
    accounts({ user_a: [TEAM] });
    const item = await makeItem(ada.auth, { teamId: TEAM });
    await ask(bo.auth, item.id);
    const [request] = rows();
    const answers = await Promise.all([
      grant(ada.auth, item.id, request!.id),
      grant(cy.auth, item.id, request!.id),
    ]);
    expect(answers.map((r) => r.status).sort()).toEqual([200, 404]);
    const links = h.db.sql
      .prepare('SELECT COUNT(*) AS n FROM share_links WHERE item_id = ?')
      .get(item.id) as { n: number };
    expect(links.n).toBe(1);
  });
});

describe('granting, at the edges', () => {
  it('refuses a malformed body, and names nobody when accounts can’t say', async () => {
    const { ada, bo, item } = await setup();
    h.appAnswer = (c: AppCall) =>
      c.url.endsWith('/api/account/index/people')
        ? new Response(null, { status: 503 })
        : new Response(null, { status: 200 });
    await ask(bo.auth, item.id);
    expect((await inboxOf(ada.auth))[0]!.requesterName).toBeNull();
    const [request] = rows();
    const bad = await call(`/items/${item.id}/access-requests/${request!.id}/grant`, {
      method: 'POST',
      auth: ada.auth,
      headers: { 'Content-Length': '1' },
      body: '[',
    });
    expect(bad.status).toBe(400);
    expect((await grant(ada.auth, item.id, request!.id)).status).toBe(200);
    await settle();
    expect((notices('access_granted')[0]!.body as { granterName: unknown }).granterName).toBeNull();
  });

  it('answers not found when another manager closed it between the read and the write', async () => {
    const { ada, bo, item } = await setup();
    await ask(bo.auth, item.id);
    const [request] = rows();
    const db = h.db.env.INDEX_DB;
    const batch = db.batch.bind(db);
    const spy = vi.spyOn(db, 'batch').mockImplementationOnce(async (statements) => {
      h.db.sql.prepare("UPDATE access_requests SET state = 'declined'").run();
      return batch(statements);
    });
    const res = await grant(ada.auth, item.id, request!.id);
    spy.mockRestore();
    expect(res.status).toBe(404);
    expect(await body(res)).toEqual({ error: 'access_request_not_found' });
    const links = h.db.sql
      .prepare('SELECT COUNT(*) AS n FROM share_links WHERE item_id = ?')
      .get(item.id) as { n: number };
    expect(links.n).toBe(0);
  });
});

describe('who may answer', () => {
  it('lets only the owner or the team grant or decline, never a link visitor or a stranger', async () => {
    const { ada, bo, item } = await setup();
    const cy = await person('user_c');
    const share = await call(`/items/${item.id}/share`, {
      method: 'POST',
      auth: ada.auth,
      body: { level: 'edit' },
    });
    const { link } = await body<{ link: ShareLink }>(share);
    await call(`/share/${link.code}`, { auth: cy.auth });
    await ask(bo.auth, item.id);
    const [request] = rows();
    expect((await grant(cy.auth, item.id, request!.id)).status).toBe(403);
    expect((await decline(cy.auth, item.id, request!.id)).status).toBe(403);
    expect((await grant(bo.auth, item.id, request!.id)).status).toBe(404);
    expect((await decline(ada.auth, 'nothing_here', request!.id)).status).toBe(404);
    expect((await decline(ada.auth, item.id, 'ar_none')).status).toBe(404);
    expect((await body(await decline(ada.auth, item.id, 'ar_none'))).error).toBe(
      'access_request_not_found',
    );
    // An agent acting for the owner is no manager in person.
    const agent = await call(`/items/${item.id}/access-requests/${request!.id}/grant`, {
      method: 'POST',
      auth: 'lp-key',
      headers: { 'X-Index-App': 'liveplanner', 'X-Index-Person': 'user_a' },
      body: {},
    });
    expect(agent.status).toBe(403);
    expect(rows()[0]!.state).toBe('open');
  });

  it('refuses an Archived item’s requests and a trashed one’s', async () => {
    const { ada, bo, item } = await setup();
    const other = await makeItem(ada.auth);
    await ask(bo.auth, item.id);
    await ask(bo.auth, other.id);
    const [first, second] = rows();
    await call(`/items/${item.id}/archive`, { method: 'POST', auth: ada.auth });
    const archived = await grant(ada.auth, item.id, first!.id);
    expect(archived.status).toBe(409);
    expect(await body(archived)).toEqual({ error: 'archived' });
    await call(`/items/${other.id}`, { method: 'DELETE', auth: ada.auth });
    expect((await decline(ada.auth, other.id, second!.id)).status).toBe(404);
    expect((await grant(ada.auth, other.id, second!.id)).status).toBe(404);
  });
});

describe('closing an account', () => {
  it('deletes the person’s requests and tries', async () => {
    const { ada, bo, item } = await setup();
    await ask(bo.auth, item.id);
    expect(await inboxOf(ada.auth)).toHaveLength(1);
    await purgePerson(h.db.env, 'user_b', [], { deadline: Date.now() + 60_000, calls: 100 });
    expect(await inboxOf(ada.auth)).toEqual([]);
    expect(rows()).toEqual([]);
    const tries = h.db.sql.prepare('SELECT COUNT(*) AS n FROM access_request_tries').get() as {
      n: number;
    };
    expect(tries.n).toBe(0);
  });
});

describe('when recording fails', () => {
  it('logs it and still answers the same', async () => {
    const { bo, item } = await setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    h.db.sql.exec('DROP TABLE access_requests');
    const res = await ask(bo.auth, item.id);
    expect(res.status).toBe(202);
    expect(warn).toHaveBeenCalledWith('[access-requests] record failed', {
      error: expect.stringContaining('access_requests'),
    });
    warn.mockRestore();
  });
});
