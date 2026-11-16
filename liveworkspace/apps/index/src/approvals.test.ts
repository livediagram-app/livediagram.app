// Approvals (approvals.md): asking, deciding, cancelling and reading; who may do each (a Viewer may approve); who may
// be named; Changed Since Approval from a summary push; the replace, the cap and the day's limit; the notice, History,
// the team audit log and closing an account.
import type { Approval, ApprovalCandidate, ItemEvent } from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { purgePerson } from './account-purge';
import { body, call, h, makeItem, person, settle, useHarness, type AppCall } from './test-support';

useHarness();

const TEAM = 'team_1';
const NAMES: Record<string, string> = {
  user_a: 'Ada',
  user_b: 'Bo',
  user_c: 'Cy',
  user_d: 'Di',
};
// Accounts as the index reads it: names, and each person's teams (`teams` maps a person to theirs).
function accounts(teams: Record<string, string[]> = {}, down = false) {
  h.appAnswer = (c: AppCall) => {
    if (c.url.endsWith('/api/account/index/people')) {
      if (down) return new Response(null, { status: 503 });
      const ids = (c.body as { ids: string[] }).ids;
      return Response.json({
        people: ids.filter((id) => NAMES[id]).map((id) => ({ id, name: NAMES[id] })),
      });
    }
    if (c.url.endsWith('/api/account/index/teams')) {
      if (down) return new Response(null, { status: 503 });
      const userId = (c.body as { userId: string }).userId;
      return Response.json({
        teams: (teams[userId] ?? []).map((id) => ({ id, name: id, role: 'member' })),
      });
    }
    return new Response(null, { status: 200 });
  };
}

const approvalOf = async (res: Response) =>
  (await body<{ approval: Approval | null }>(res)).approval;
const read = (auth: string, id: string) => call(`/items/${id}/approval`, { auth });
const ask = (auth: string, id: string, input: Record<string, unknown>) =>
  call(`/items/${id}/approval`, { method: 'POST', auth, body: input });
const decide = (auth: string, id: string, decision: string, note?: string) =>
  call(`/items/${id}/approval/decision`, {
    method: 'POST',
    auth,
    body: { decision, ...(note !== undefined ? { note } : {}) },
  });
const cancel = (auth: string, id: string) =>
  call(`/items/${id}/approval`, { method: 'DELETE', auth });

// A share link at `level` (every tab, or one), opened by `visitor` so they hold it under Shared with me.
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
  return link.code;
}

const summary = (itemId: string, updatedAt: number) =>
  call(`/app/items/${itemId}/summary`, {
    method: 'PUT',
    auth: 'lp-key',
    headers: { 'X-Index-App': 'liveplanner' },
    body: { summary: {}, updatedAt },
  });

async function setup() {
  accounts();
  const ada = await person('user_a');
  const bo = await person('user_b');
  const cy = await person('user_c');
  const item = await makeItem(ada.auth, { title: 'Roadmap' });
  await visit(ada.auth, item.id, bo.auth, 'view');
  await visit(ada.auth, item.id, cy.auth, 'participate');
  return { ada, bo, cy, item };
}

describe('asking for approval', () => {
  it('reads null before anyone asks, then the request, its people named', async () => {
    const { ada, bo, item } = await setup();
    expect(await approvalOf(await read(ada.auth, item.id))).toBeNull();
    const res = await ask(ada.auth, item.id, {
      approverIds: ['user_b', 'user_c'],
      note: '  Check the dates  ',
      due: '2026-11-20',
      snapshotId: 'snap_1',
    });
    expect(res.status).toBe(201);
    const approval = await approvalOf(res);
    expect(approval).toMatchObject({
      itemId: item.id,
      state: 'open',
      status: 'awaiting',
      requestedBy: { id: 'user_a', name: 'Ada' },
      note: 'Check the dates',
      due: '2026-11-20',
      snapshotId: 'snap_1',
      closedAt: null,
      approved: 0,
      approvers: [
        { id: 'user_b', name: 'Bo', decision: 'pending', note: null, decidedAt: null },
        { id: 'user_c', name: 'Cy', decision: 'pending', note: null, decidedAt: null },
      ],
    });
    // A Viewer reads it too, so every collaborator sees the badge.
    expect(await approvalOf(await read(bo.auth, item.id))).toMatchObject({ id: approval!.id });
  });

  it('tells the item’s app, for the approvers’ email', async () => {
    const { ada, item } = await setup();
    await ask(ada.auth, item.id, { approverIds: ['user_b'], note: 'Please' });
    await settle();
    const notice = h.appCalls.find(
      (c) =>
        c.url.endsWith(`/items/${item.id}/notices`) &&
        (c.body as { type?: string }).type === 'approval_requested',
    );
    expect(notice?.body).toMatchObject({
      type: 'approval_requested',
      requesterId: 'user_a',
      requesterName: 'Ada',
      approverIds: ['user_b'],
      itemTitle: 'Roadmap',
      note: 'Please',
      due: null,
    });
  });

  it('refuses malformed requests', async () => {
    const { ada, item } = await setup();
    const bad = async (input: Record<string, unknown>, code: string) => {
      const res = await ask(ada.auth, item.id, input);
      expect(res.status).toBe(400);
      expect(await body(res)).toEqual({ error: code });
    };
    await bad({}, 'invalid_approvers');
    await bad({ approverIds: [] }, 'invalid_approvers');
    await bad({ approverIds: ['user_b', 'user_b'] }, 'invalid_approvers');
    await bad({ approverIds: ['guest_1'] }, 'invalid_approvers');
    await bad({ approverIds: ['user_a'] }, 'invalid_approvers');
    await bad(
      { approverIds: Array.from({ length: 11 }, (_, i) => `user_${i}x`) },
      'invalid_approvers',
    );
    await bad({ approverIds: ['user_b'], note: 'x'.repeat(501) }, 'invalid_body');
    await bad({ approverIds: ['user_b'], note: 5 }, 'invalid_body');
    await bad({ approverIds: ['user_b'], due: '2026-02-31' }, 'invalid_due');
    await bad({ approverIds: ['user_b'], snapshotId: 'a b' }, 'invalid_body');
    const notJson = await call(`/items/${item.id}/approval`, {
      method: 'POST',
      auth: ada.auth,
      headers: { 'Content-Type': 'application/json' },
    });
    expect(notJson.status).toBe(400);
  });

  it('names only people who reach the whole item', async () => {
    const { ada, bo, item } = await setup();
    // Di never came in; Bo's tab-only link would not count either.
    const di = await person('user_d');
    await visit(ada.auth, item.id, di.auth, 'view', 'tab-1');
    const res = await ask(ada.auth, item.id, { approverIds: ['user_b', 'user_d'] });
    expect(res.status).toBe(422);
    expect(await body(res)).toEqual({ error: 'approver_cannot_open' });
    expect(await approvalOf(await read(bo.auth, item.id))).toBeNull();
  });

  it('names a team item’s members as accounts says now, and refuses when it can’t say', async () => {
    const ada = await person('user_a', { teams: [{ id: TEAM }] });
    accounts({ user_b: [TEAM], user_c: [] });
    const item = await makeItem(ada.auth, { teamId: TEAM });
    expect((await ask(ada.auth, item.id, { approverIds: ['user_c'] })).status).toBe(422);
    expect((await ask(ada.auth, item.id, { approverIds: ['user_b'] })).status).toBe(201);
    accounts({}, true);
    const down = await ask(ada.auth, item.id, { approverIds: ['user_b'] });
    expect(down.status).toBe(503);
    expect(await body(down)).toEqual({ error: 'approvals_unavailable' });
  });

  it('names the owner of a personal item when an editor link asks', async () => {
    const { ada, item } = await setup();
    const di = await person('user_d');
    await visit(ada.auth, item.id, di.auth, 'edit');
    const res = await ask(di.auth, item.id, { approverIds: ['user_a', 'user_b'] });
    expect(res.status).toBe(201);
  });

  it('replaces an open request, keeps five, and limits a day to ten', async () => {
    const { ada, item } = await setup();
    const first = await approvalOf(await ask(ada.auth, item.id, { approverIds: ['user_b'] }));
    const second = await approvalOf(await ask(ada.auth, item.id, { approverIds: ['user_c'] }));
    expect(second!.id).not.toBe(first!.id);
    const states = h.db.sql
      .prepare('SELECT state FROM approvals WHERE item_id = ? ORDER BY created_at, rowid')
      .all(item.id) as { state: string }[];
    expect(states.map((s) => s.state)).toEqual(['cancelled', 'open']);
    for (let i = 0; i < 8; i++) await ask(ada.auth, item.id, { approverIds: ['user_b'] });
    const kept = h.db.sql
      .prepare('SELECT COUNT(*) AS n FROM approvals WHERE item_id = ?')
      .get(item.id) as { n: number };
    expect(kept.n).toBe(5);
    const limited = await ask(ada.auth, item.id, { approverIds: ['user_b'] });
    expect(limited.status).toBe(429);
    expect(await body(limited)).toEqual({ error: 'rate_limited' });
  });

  it('refuses a request on an item in the Trash', async () => {
    const { ada, item } = await setup();
    await call(`/items/${item.id}`, { method: 'DELETE', auth: ada.auth });
    expect((await ask(ada.auth, item.id, { approverIds: ['user_b'] })).status).toBe(404);
  });
});

describe('who may do what (share roles)', () => {
  it('lets only an Editor of the whole item ask, cancel and list people', async () => {
    const { ada, bo, cy, item } = await setup();
    const di = await person('user_d');
    await visit(ada.auth, item.id, di.auth, 'edit', 'tab-1');
    // A Viewer (Bo), a Participant (Cy) and a one-tab Editor (Di) may not ask.
    for (const who of [bo, cy, di]) {
      expect((await ask(who.auth, item.id, { approverIds: ['user_a'] })).status).toBe(403);
      expect((await call(`/items/${item.id}/approval/people`, { auth: who.auth })).status).toBe(
        403,
      );
    }
    await ask(ada.auth, item.id, { approverIds: ['user_b'] });
    for (const who of [bo, cy, di]) expect((await cancel(who.auth, item.id)).status).toBe(403);
    // The one-tab Editor still reads the badge.
    expect(await approvalOf(await read(di.auth, item.id))).not.toBeNull();
  });

  it('refuses an app acting for a person, the signed-out and someone who can’t reach it', async () => {
    const { ada, item } = await setup();
    const agent = await call(`/items/${item.id}/approval`, {
      auth: 'lp-key',
      headers: { 'X-Index-App': 'liveplanner', 'X-Index-Person': 'user_a' },
    });
    expect(agent.status).toBe(403);
    expect(await body(agent)).toEqual({ error: 'approvals_need_a_person' });
    expect((await call(`/items/${item.id}/approval`)).status).toBe(401);
    const di = await person('user_d');
    expect((await read(di.auth, item.id)).status).toBe(404);
    expect((await call(`/items/${item.id}/approval/nope`, { auth: ada.auth })).status).toBe(404);
    expect(
      (await call(`/items/${item.id}/approval`, { method: 'PUT', auth: ada.auth })).status,
    ).toBe(404);
  });

  it('shows a Community visitor nothing', async () => {
    const { ada, item } = await setup();
    await ask(ada.auth, item.id, { approverIds: ['user_b'] });
    const res = await call(`/items/${item.id}/share`, {
      method: 'POST',
      auth: ada.auth,
      body: { public: true },
    });
    const { link } = await body<{ link: { code: string } }>(res);
    const di = await person('user_d');
    const seen = await call(`/items/${item.id}/approval`, {
      auth: di.auth,
      headers: { 'X-Share-Code': link.code },
    });
    expect(await approvalOf(seen)).toBeNull();
    const decided = await call(`/items/${item.id}/approval/decision`, {
      method: 'POST',
      auth: di.auth,
      headers: { 'X-Share-Code': link.code },
      body: { decision: 'approve' },
    });
    expect(decided.status).toBe(404);
  });
});

describe('deciding', () => {
  it('lets a named Viewer approve: the one write a Viewer has', async () => {
    const { ada, bo, cy, item } = await setup();
    await ask(ada.auth, item.id, { approverIds: ['user_b', 'user_c'] });
    const first = await approvalOf(await decide(bo.auth, item.id, 'approve', 'Looks right'));
    expect(first).toMatchObject({ state: 'open', status: 'awaiting', approved: 1 });
    expect(first!.approvers[0]).toMatchObject({ decision: 'approved', note: 'Looks right' });
    // Cy asks for changes, then approves once fixed: the request closes.
    const changes = await approvalOf(await decide(cy.auth, item.id, 'request_changes', 'Q3?'));
    expect(changes).toMatchObject({ status: 'changes_requested' });
    const done = await approvalOf(await decide(cy.auth, item.id, 'approve'));
    expect(done).toMatchObject({ state: 'approved', status: 'approved', approved: 2 });
    expect(done!.closedAt).toEqual(expect.any(Number));
    // Closed: no more decisions.
    expect((await decide(bo.auth, item.id, 'request_changes')).status).toBe(404);
  });

  it('changes nothing for the same decision again', async () => {
    const { ada, bo, item } = await setup();
    await ask(ada.auth, item.id, { approverIds: ['user_b', 'user_c'] });
    await decide(bo.auth, item.id, 'approve');
    const events = () =>
      (
        h.db.sql
          .prepare("SELECT COUNT(*) AS n FROM events WHERE type = 'approval_approved'")
          .get() as {
          n: number;
        }
      ).n;
    expect(events()).toBe(1);
    expect((await decide(bo.auth, item.id, 'approve')).status).toBe(200);
    expect(events()).toBe(1);
  });

  it('refuses someone not named, a bad decision and no open request', async () => {
    const { ada, bo, cy, item } = await setup();
    expect((await decide(bo.auth, item.id, 'approve')).status).toBe(404);
    await ask(ada.auth, item.id, { approverIds: ['user_b'] });
    const stranger = await decide(cy.auth, item.id, 'approve');
    expect(stranger.status).toBe(403);
    expect(await body(stranger)).toEqual({ error: 'not_an_approver' });
    expect((await decide(bo.auth, item.id, 'maybe')).status).toBe(400);
    expect((await decide(bo.auth, item.id, 'approve', 'x'.repeat(501))).status).toBe(400);
    // The requester is no approver of their own request.
    expect((await decide(ada.auth, item.id, 'approve')).status).toBe(403);
  });

  it('turns to Changed Since Approval when the content is saved after the last approval', async () => {
    const { ada, bo, item } = await setup();
    await ask(ada.auth, item.id, { approverIds: ['user_b'] });
    const done = await approvalOf(await decide(bo.auth, item.id, 'approve'));
    // A save from before the approval, pushed late, is no change.
    expect((await summary(item.id, done!.closedAt! - 1000)).status).toBe(204);
    expect((await approvalOf(await read(ada.auth, item.id)))!.status).toBe('approved');
    await summary(item.id, done!.closedAt! + 1000);
    expect((await approvalOf(await read(ada.auth, item.id)))!.status).toBe('changed');
    // The revision never moves back.
    await summary(item.id, done!.closedAt! - 5000);
    expect((await approvalOf(await read(bo.auth, item.id)))!.status).toBe('changed');
  });
});

describe('cancelling', () => {
  it('cancels the open request, and then there is no badge', async () => {
    const { ada, bo, item } = await setup();
    expect((await cancel(ada.auth, item.id)).status).toBe(404);
    await ask(ada.auth, item.id, { approverIds: ['user_b'] });
    expect((await cancel(ada.auth, item.id)).status).toBe(204);
    expect(await approvalOf(await read(bo.auth, item.id))).toBeNull();
    expect((await decide(bo.auth, item.id, 'approve')).status).toBe(404);
  });
});

describe('the people an Editor may name', () => {
  it('lists the owner and whole-item link visitors, never the asker', async () => {
    const { ada, item } = await setup();
    const di = await person('user_d');
    await visit(ada.auth, item.id, di.auth, 'edit');
    const own = await body<{ people: ApprovalCandidate[] }>(
      await call(`/items/${item.id}/approval/people`, { auth: ada.auth }),
    );
    expect(own.people.map((p) => p.id).sort()).toEqual(['user_b', 'user_c', 'user_d']);
    expect(own.people.find((p) => p.id === 'user_b')).toEqual({
      id: 'user_b',
      name: 'Bo',
      via: 'link',
    });
    const dis = await body<{ people: ApprovalCandidate[] }>(
      await call(`/items/${item.id}/approval/people`, { auth: di.auth }),
    );
    expect(dis.people[0]).toEqual({ id: 'user_a', name: 'Ada', via: 'owner' });
    expect(dis.people.map((p) => p.id)).not.toContain('user_d');
  });
});

describe('History and the team audit log', () => {
  it('records each step in History, the actor named', async () => {
    const { ada, bo, item } = await setup();
    await ask(ada.auth, item.id, { approverIds: ['user_b'], due: '2026-12-01' });
    await ask(ada.auth, item.id, { approverIds: ['user_b'] });
    await decide(bo.auth, item.id, 'approve', 'Fine');
    const { events } = await body<{ events: ItemEvent[] }>(
      await call(`/items/${item.id}/history`, { auth: ada.auth }),
    );
    const steps = events
      .filter((e) => e.type.startsWith('approval_'))
      .map((e) => [e.type, e.actorName, e.detail]);
    expect(steps).toEqual([
      ['approval_approved', 'Bo', { note: 'Fine', complete: 'true' }],
      ['approval_requested', 'Ada', { approvers: '1', due: null }],
      ['approval_cancelled', 'Ada', { replaced: 'true' }],
      ['approval_requested', 'Ada', { approvers: '1', due: '2026-12-01' }],
    ]);
  });

  it('copies a team item’s steps into the team’s audit log', async () => {
    const ada = await person('user_a', { teams: [{ id: TEAM }] });
    const bo = await person('user_b', { teams: [{ id: TEAM }] });
    accounts({ user_b: [TEAM] });
    const item = await makeItem(ada.auth, { teamId: TEAM });
    await ask(ada.auth, item.id, { approverIds: ['user_b'] });
    await decide(bo.auth, item.id, 'request_changes', 'Fix it');
    await cancel(ada.auth, item.id);
    const rows = h.db.sql
      .prepare(
        'SELECT type, actor_id FROM team_audit_events WHERE team_id = ? ORDER BY occurred_at, rowid',
      )
      .all(TEAM) as { type: string; actor_id: string }[];
    expect(rows.filter((r) => r.type.startsWith('approval_'))).toEqual([
      { type: 'approval_requested', actor_id: 'user_a' },
      { type: 'approval_changes_requested', actor_id: 'user_b' },
      { type: 'approval_cancelled', actor_id: 'user_a' },
    ]);
  });
});

describe('closing an account', () => {
  it('anonymises the requests they made and the decisions they hold', async () => {
    const { ada, bo, item } = await setup();
    await ask(ada.auth, item.id, { approverIds: ['user_b', 'user_c'] });
    await decide(bo.auth, item.id, 'request_changes', 'No');
    await purgePerson(h.db.env, 'user_b', [], { deadline: Date.now() + 60_000, calls: 100 });
    const approval = await approvalOf(await read(ada.auth, item.id));
    expect(approval!.approvers[0]).toEqual({
      id: 'deleted',
      name: null,
      decision: 'changes_requested',
      note: null,
      decidedAt: expect.any(Number),
    });
  });
});
