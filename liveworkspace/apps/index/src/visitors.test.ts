// Opened by a Visitor and Copied by a Visitor: who came in through a share link, in the owner's History alone.
import type { HistoryPage, ItemEvent, ShareLink } from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { body, call, makeItem, person, settle, useHarness } from './test-support';

useHarness();

// The visits in an item's History as `auth` reads it; null when they can't read it (404).
async function feed(auth: string, itemId: string): Promise<ItemEvent[] | null> {
  const res = await call(`/items/${itemId}/history`, { auth });
  if (res.status === 404) return null;
  return (await body<HistoryPage>(res)).events.filter((e) => e.type.endsWith('_by_visitor'));
}

async function link(auth: string, itemId: string, extra: Record<string, unknown> = {}) {
  const res = await call(`/items/${itemId}/share`, {
    method: 'POST',
    auth,
    body: { level: 'view', ...extra },
  });
  return (await body<{ link: ShareLink }>(res)).link;
}

describe('visitors in History', () => {
  it("records no visit through a public link (a Community post's)", async () => {
    const ada = await person('user_p1');
    const eve = await person('user_p2');
    const item = await makeItem(ada.auth, { title: 'Post' });
    const { code } = await link(ada.auth, item.id, { public: true });
    const res = await call(`/items/${item.id}/grant`, {
      method: 'POST',
      auth: eve.auth,
      headers: { 'X-Share-Code': code },
    });
    expect(res.status).toBe(200);
    await settle();
    expect(await feed(ada.auth, item.id)).toEqual([]);
  });

  it("records a link visitor's open once a day, and their copy once, for the owner only", async () => {
    const team = [{ id: 'team_v' }];
    const ada = await person('user_v1', { teams: team });
    const bo = await person('user_v2', { teams: team });
    const eve = await person('user_v3');
    const item = await makeItem(ada.auth, { title: 'Plan', teamId: 'team_v' });
    const { code } = await link(ada.auth, item.id);
    const grant = (auth: string | null, share = true) =>
      call(`/items/${item.id}/grant`, {
        method: 'POST',
        auth,
        headers: share ? { 'X-Share-Code': code } : {},
      });
    expect((await grant(eve.auth)).status).toBe(200);
    expect((await grant(eve.auth)).status).toBe(200);
    // Someone with no identity, through the link.
    expect((await grant(null)).status).toBe(200);
    // The owner and a teammate are not visitors.
    await grant(ada.auth, false);
    await grant(bo.auth, false);
    await settle();
    const opened = (await feed(ada.auth, item.id))!;
    expect(opened.map((e) => [e.type, e.actorId, e.title])).toEqual(
      expect.arrayContaining([
        ['opened_by_visitor', 'user_v3', 'Plan'],
        ['opened_by_visitor', null, 'Plan'],
      ]),
    );
    expect(opened).toHaveLength(2);
    // A teammate reads the History, but not who came in through the owner's links.
    expect(await feed(bo.auth, item.id)).toEqual([]);

    const copy = await call(`/items/${item.id}/copy`, {
      method: 'POST',
      auth: eve.auth,
      headers: { 'X-Share-Code': code },
      body: {},
    });
    expect(copy.status).toBe(201);
    await call(`/items/${item.id}/copy`, {
      method: 'POST',
      auth: eve.auth,
      headers: { 'X-Share-Code': code },
      body: {},
    });
    // The owner's own copy is no visitor's.
    await call(`/items/${item.id}/copy`, { method: 'POST', auth: ada.auth, body: {} });
    await settle();
    const copied = (await feed(ada.auth, item.id))!.filter((e) => e.type === 'copied_by_visitor');
    expect(copied.map((e) => e.actorId)).toEqual(['user_v3']);
    // The visitor reaches it only through the link: no History.
    expect(await feed(eve.auth, item.id)).toBeNull();
  });
});
