// Write It Up on the index (liveworkspace/docs/specs/004-index/write-up.md): the default knowledgebase (connected, the
// team's, the person's own) the person can edit; the page written through the knowledgebase's door as the person; an
// Editor of the item alone, in person, with an account; a refusal is 422 with its reason.
import type { WriteUpTarget } from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { body, call, h, makeItem, person, token, useHarness } from './test-support';

useHarness({
  INDEX_KEY_LIVEKNOWLEDGE: 'lk-key',
  APP_ORIGIN_LIVEKNOWLEDGE: 'https://www.liveknowledge.app',
});

const target = async (auth: string, itemId: string) =>
  body<WriteUpTarget>(await call(`/items/${itemId}/write-up`, { auth }));

const write = (
  auth: string | null,
  itemId: string,
  payload: unknown,
  headers?: Record<string, string>,
) => call(`/items/${itemId}/write-up`, { method: 'POST', auth, body: payload, headers });

async function visit(owner: string, itemId: string, visitor: string, level: string) {
  const res = await call(`/items/${itemId}/share`, {
    method: 'POST',
    auth: owner,
    body: { level },
  });
  const { link } = await body<{ link: { code: string } }>(res);
  expect((await call(`/share/${link.code}`, { auth: visitor })).status).toBe(200);
  return link.code;
}

describe('where a write-up goes', () => {
  it("is the team's newest knowledgebase the person can edit", async () => {
    const ada = await person('user_ada', { teams: [{ id: 'team_1' }] });
    const plan = await makeItem(ada.auth, {
      app: 'liveplanner',
      title: 'Launch',
      teamId: 'team_1',
    });
    const kb = await makeItem(ada.auth, { app: 'liveknowledge', title: 'Wiki', teamId: 'team_1' });
    expect(await target(ada.auth, plan.id)).toEqual({
      knowledgebase: { id: kb.id, title: 'Wiki' },
    });
  });

  it("is the person's own newest for an item of their own, and none without one", async () => {
    const ada = await person('user_ada');
    const plan = await makeItem(ada.auth, { app: 'liveplanner', title: 'Launch' });
    expect(await target(ada.auth, plan.id)).toEqual({ knowledgebase: null });
    const kb = await makeItem(ada.auth, { app: 'liveknowledge', title: 'Notes' });
    expect(await target(ada.auth, plan.id)).toEqual({
      knowledgebase: { id: kb.id, title: 'Notes' },
    });
    // A knowledgebase writes nothing up into itself.
    expect(await target(ada.auth, kb.id)).toEqual({ knowledgebase: null });
  });

  it('needs an account and Edit on the item', async () => {
    const ada = await person('user_ada');
    const ben = await person('user_ben');
    const plan = await makeItem(ada.auth, { app: 'liveplanner', title: 'Launch' });
    expect((await call(`/items/${plan.id}/write-up`, { auth: null })).status).toBe(401);
    const guest = await token('guest_x', { guest: true });
    expect((await call(`/items/${plan.id}/write-up`, { auth: guest })).status).toBe(403);
    expect((await call(`/items/${plan.id}/write-up`, { auth: ben.auth })).status).toBe(404);
    const code = await visit(ada.auth, plan.id, ben.auth, 'view');
    const asViewer = await call(`/items/${plan.id}/write-up`, {
      auth: ben.auth,
      headers: { 'X-Share-Code': code },
    });
    expect(asViewer.status).toBe(403);
  });
});

describe('the write-up', () => {
  it("writes a page through the knowledgebase's door as the person", async () => {
    const ada = await person('user_ada');
    const plan = await makeItem(ada.auth, { app: 'liveplanner', title: 'Launch' });
    const kb = await makeItem(ada.auth, { app: 'liveknowledge', title: 'Wiki' });
    h.appAnswer = (c) =>
      c.url.endsWith('/automation-step')
        ? Response.json({ ok: true, text: 'Wrote it', link: 'https://www.liveknowledge.app/k/p1' })
        : new Response(null, { status: 200 });
    h.appCalls = [];
    const res = await write(ada.auth, plan.id, {
      knowledgebase: kb.id,
      title: 'Ship on Fridays',
      body: 'We decided to ship on Fridays.',
    });
    expect(res.status).toBe(201);
    expect(await body(res)).toEqual({
      page: { title: 'Ship on Fridays', link: 'https://www.liveknowledge.app/k/p1' },
    });
    const door = h.appCalls.find((c) => c.url.endsWith('/automation-step'))!;
    expect(door.url).toBe(
      `https://www.liveknowledge.app/api/internal/items/${kb.id}/automation-step`,
    );
    expect(door.body).toMatchObject({
      author: 'user_ada',
      rule: { id: 'write-up', name: 'Write It Up', app: 'liveplanner', item: plan.id },
      from: { title: 'Launch' },
      step: { kind: 'kb_page', title: 'Ship on Fridays', body: 'We decided to ship on Fridays.' },
    });
  });

  it('refuses a bad body, a non-knowledgebase, a Viewer, and says why a door refused', async () => {
    const ada = await person('user_ada');
    const ben = await person('user_ben');
    const plan = await makeItem(ada.auth, { app: 'liveplanner', title: 'Launch' });
    const kb = await makeItem(ada.auth, { app: 'liveknowledge', title: 'Wiki' });
    const ask = { knowledgebase: kb.id, title: 'T', body: 'B' };
    expect((await write(ada.auth, plan.id, { title: 'x' })).status).toBe(400);
    expect((await write(ada.auth, plan.id, { ...ask, knowledgebase: plan.id })).status).toBe(400);
    expect((await write(ada.auth, plan.id, { ...ask, knowledgebase: 'nope' })).status).toBe(400);
    expect((await write(null, plan.id, ask)).status).toBe(401);
    const code = await visit(ada.auth, plan.id, ben.auth, 'participate');
    expect((await write(ben.auth, plan.id, ask, { 'X-Share-Code': code })).status).toBe(403);
    h.appAnswer = () => Response.json({ ok: false, code: 'no_access', reason: 'Read only' });
    const res = await write(ada.auth, plan.id, ask);
    expect(res.status).toBe(422);
    expect(await body(res)).toMatchObject({ error: 'write_up_refused', reason: 'Read only' });
  });

  it('refuses when the door answers without writing a page', async () => {
    const ada = await person('user_ada');
    const plan = await makeItem(ada.auth, { app: 'liveplanner', title: 'Launch' });
    const kb = await makeItem(ada.auth, { app: 'liveknowledge', title: 'Wiki' });
    h.appAnswer = (c) =>
      c.url.endsWith('/automation-step')
        ? Response.json({ ok: true, text: 'Nothing written' })
        : new Response(null, { status: 200 });
    const res = await write(ada.auth, plan.id, { knowledgebase: kb.id, title: 'T', body: 'B' });
    expect(res.status).toBe(422);
    expect(await body(res)).toEqual({ error: 'write_up_refused', code: 'failed', reason: '' });
  });

  it('writes nothing up from an item in the Trash', async () => {
    const ada = await person('user_ada');
    const plan = await makeItem(ada.auth, { app: 'liveplanner', title: 'Launch' });
    const kb = await makeItem(ada.auth, { app: 'liveknowledge', title: 'Wiki' });
    h.db.sql
      .prepare('UPDATE items SET trashed_at = ?, trash_reason = ? WHERE id = ?')
      .run(Date.now(), 'deleted', plan.id);
    const res = await write(ada.auth, plan.id, { knowledgebase: kb.id, title: 'T', body: 'B' });
    expect(res.status).toBe(404);
  });

  it('answers only GET and POST', async () => {
    const ada = await person('user_ada');
    const plan = await makeItem(ada.auth, { app: 'liveplanner', title: 'Launch' });
    expect(
      (await call(`/items/${plan.id}/write-up`, { method: 'PUT', auth: ada.auth })).status,
    ).toBe(404);
  });
});
