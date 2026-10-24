// Share Link Expiring: one future-dated warning per item on its owner's Timeline, at the soonest expiry of the links
// lapsing within the week; worked out again when a link is made, extended or deleted, and by the daily pass.
import {
  SHARE_EXPIRY_WARNING_MS,
  type ShareLink,
  type TimelineEvent,
  type TimelinePage,
} from '@liveworkspace/index-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './index';
import { EXPIRY_SWEEP_MAX, sweepExpiringLinks } from './share-expiry';
import { body, call, h, makeItem, person, useHarness } from './test-support';

useHarness();

const DAY = 86_400_000;
const START = 20_400 * DAY;

afterEach(() => vi.useRealTimers());

const at = (now: number) => vi.useFakeTimers({ toFake: ['Date'], now });
const warnings = async (auth: string) =>
  (await body<TimelinePage>(await call('/timeline', { auth }))).events.filter(
    (e: TimelineEvent) => e.type === 'share_link_expiring',
  );
async function share(auth: string, itemId: string, expiry: string) {
  const res = await call(`/items/${itemId}/share`, { method: 'POST', auth, body: { expiry } });
  expect(res.status).toBe(201);
  return (await body<{ link: ShareLink }>(res)).link;
}

describe('share link expiring', () => {
  it('warns the owner at once of a link lapsing within the week, dated at its expiry', async () => {
    at(START);
    const ada = await person('user_sx1');
    const item = await makeItem(ada.auth, { title: 'Roadmap' });
    const link = await share(ada.auth, item.id, 'week');
    const [warning, ...rest] = await warnings(ada.auth);
    expect(rest).toEqual([]);
    expect(warning).toMatchObject({
      id: `sx:${item.id}`,
      itemId: item.id,
      actorId: null,
      title: 'Roadmap',
      occurredAt: link.expiresAt,
      detail: { expiresAt: String(link.expiresAt), links: '1' },
    });
  });

  it('says nothing of a link lapsing later, until the daily pass finds it inside the week', async () => {
    at(START);
    const ada = await person('user_sx2');
    const item = await makeItem(ada.auth);
    const link = await share(ada.auth, item.id, 'month');
    expect(await warnings(ada.auth)).toEqual([]);
    // The daily pass on a day the month's end is still weeks away: nothing.
    await worker.scheduled({ cron: '23 4 * * *' } as ScheduledController, h.db.env);
    expect(await warnings(ada.auth)).toEqual([]);
    at(link.expiresAt! - SHARE_EXPIRY_WARNING_MS + DAY);
    await worker.scheduled({ cron: '23 4 * * *' } as ScheduledController, h.db.env);
    // A token minted on the day (one from the start would have lapsed).
    const later = await person('user_sx2');
    expect((await warnings(later.auth)).map((w) => w.occurredAt)).toEqual([link.expiresAt]);
  });

  it('dates the warning at the soonest of several links, and counts them', async () => {
    at(START);
    const ada = await person('user_sx3');
    const item = await makeItem(ada.auth);
    const first = await share(ada.auth, item.id, 'week');
    at(START + DAY);
    const later = await person('user_sx3');
    await share(later.auth, item.id, 'week');
    const [warning] = await warnings(later.auth);
    expect(warning).toMatchObject({ occurredAt: first.expiresAt, detail: { links: '2' } });
  });

  it('drops the warning when its link is extended or deleted, and keeps it for a link still lapsing', async () => {
    at(START);
    const ada = await person('user_sx4');
    const item = await makeItem(ada.auth);
    const one = await share(ada.auth, item.id, 'week');
    const two = await share(ada.auth, item.id, 'sixMonths');
    // Extending the week's link moves its warning to the new expiry (a week's link always lapses within the week).
    at(START + 3 * DAY);
    const { auth } = await person('user_sx4');
    const res = await call(`/share/${one.code}/extend`, { method: 'POST', auth });
    expect(res.status).toBe(200);
    const extended = (await body<{ link: ShareLink }>(res)).link;
    expect((await warnings(auth)).map((w) => w.occurredAt)).toEqual([extended.expiresAt]);
    // Deleting it takes the warning with it, while the six months' link says nothing.
    expect((await call(`/share/${one.code}`, { method: 'DELETE', auth })).status).toBe(204);
    expect(await warnings(auth)).toEqual([]);
    // A new week's link warns again; deleting it drops it again.
    const three = await share(auth, item.id, 'week');
    expect(await warnings(auth)).toHaveLength(1);
    expect((await call(`/share/${three.code}`, { method: 'DELETE', auth: auth })).status).toBe(204);
    expect(await warnings(auth)).toEqual([]);
    expect(two.expiry).toBe('sixMonths');
    // Stopping all sharing drops it too.
    await share(auth, item.id, 'week');
    await call(`/items/${item.id}/share`, { method: 'DELETE', auth: auth });
    expect(await warnings(auth)).toEqual([]);
  });

  it("is the owner's alone: a teammate on a team item never sees it", async () => {
    at(START);
    const team = [{ id: 'team_sx' }];
    const ada = await person('user_sx5', { teams: team });
    const bo = await person('user_sx6', { teams: team });
    const item = await makeItem(ada.auth, { teamId: 'team_sx' });
    await share(ada.auth, item.id, 'week');
    expect(await warnings(ada.auth)).toHaveLength(1);
    expect(await warnings(bo.auth)).toEqual([]);
  });

  it('keeps a warning the owner removed off their Timeline through the daily pass', async () => {
    at(START);
    const ada = await person('user_sx7');
    const item = await makeItem(ada.auth);
    await share(ada.auth, item.id, 'week');
    const removed = await call('/timeline/dismiss', {
      method: 'POST',
      auth: ada.auth,
      body: { ids: [`sx:${item.id}`] },
    });
    expect(removed.status).toBe(204);
    await worker.scheduled({ cron: '23 4 * * *' } as ScheduledController, h.db.env);
    expect(await warnings(ada.auth)).toEqual([]);
  });

  it('warns about at most EXPIRY_SWEEP_MAX items a day, soonest first, in a bounded time', async () => {
    const now = START;
    const db = h.db.sql;
    const items = 3_000;
    db.exec('BEGIN');
    const insertItem = db.prepare(
      `INSERT INTO items (id, app, kind, owner_id, scope, title, created_at, updated_at)
       VALUES (?, 'liveplanner', 'plan', 'user_sx8', 'p:user_sx8', ?, ?, ?)`,
    );
    const insertLink = db.prepare(
      `INSERT INTO share_links (code, item_id, level, tab_id, expiry, expires_at, created_at)
       VALUES (?, ?, 'view', NULL, 'week', ?, ?)`,
    );
    for (let i = 0; i < items; i++) {
      const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      insertItem.run(id, `Item ${i}`, now, now);
      insertLink.run(`CODE${String(i).padStart(10, '0')}`, id, now + 1000 + i, now);
    }
    db.exec('COMMIT');
    const started = performance.now();
    const warned = await sweepExpiringLinks(h.db.env, now);
    const ms = performance.now() - started;
    expect(warned).toBe(EXPIRY_SWEEP_MAX);
    const count = db
      .prepare(
        `SELECT COUNT(*) AS n, MAX(occurred_at) AS last FROM timeline_events WHERE type = 'share_link_expiring'`,
      )
      .get() as { n: number; last: number };
    expect(count.n).toBe(EXPIRY_SWEEP_MAX);
    expect(count.last).toBe(now + 1000 + EXPIRY_SWEEP_MAX - 1);
    expect(ms).toBeLessThan(2_000);
  });
});
