// Opened by a Visitor and Copied by a Visitor: who came in through a share link, on the owner's Timeline alone.
import type { ShareLink, TimelineEvent, TimelinePage } from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { body, call, makeItem, person, settle, useHarness } from './test-support';

useHarness();

const feed = async (auth: string) =>
  (await body<TimelinePage>(await call('/timeline', { auth }))).events.filter((e: TimelineEvent) =>
    e.type.endsWith('_by_visitor'),
  );

async function link(auth: string, itemId: string) {
  const res = await call(`/items/${itemId}/share`, {
    method: 'POST',
    auth,
    body: { level: 'view' },
  });
  return (await body<{ link: ShareLink }>(res)).link;
}

describe('visitors on the Timeline', () => {
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
    const opened = await feed(ada.auth);
    expect(opened.map((e) => [e.type, e.actorId, e.title])).toEqual(
      expect.arrayContaining([
        ['opened_by_visitor', 'user_v3', 'Plan'],
        ['opened_by_visitor', null, 'Plan'],
      ]),
    );
    expect(opened).toHaveLength(2);
    expect(await feed(bo.auth)).toEqual([]);

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
    const copied = (await feed(ada.auth)).filter((e) => e.type === 'copied_by_visitor');
    expect(copied.map((e) => e.actorId)).toEqual(['user_v3']);
    expect(await feed(eve.auth)).toEqual([]);
  });
});
