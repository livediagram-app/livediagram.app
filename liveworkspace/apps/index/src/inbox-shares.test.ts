// The Inbox read's `shares` (inbox-notices.md "shares in the Inbox read"): the reader's own requests granted lately,
// with who granted them; not someone else's, not an old one, not one in the Trash or no longer reached.
import { INBOX_SHARES_MS, type InboxShare } from '@liveworkspace/index-client';
import { describe, expect, it, vi } from 'vitest';
import { body, call, h, makeItem, person, settle, useHarness, type AppCall } from './test-support';

useHarness();

const NAMES: Record<string, string> = { user_a: 'Ada', user_b: 'Bo' };

function accounts(names: Record<string, string> = NAMES) {
  h.appAnswer = (c: AppCall) => {
    if (c.url.endsWith('/api/account/index/people')) {
      const ids = (c.body as { ids: string[] }).ids;
      return Response.json({
        people: ids.filter((id) => names[id]).map((id) => ({ id, name: names[id] })),
      });
    }
    if (c.url.endsWith('/api/account/index/teams')) return Response.json({ teams: [] });
    return new Response(null, { status: 200 });
  };
}

const sharesOf = async (auth: string, app?: string) =>
  (await body<{ shares: InboxShare[] }>(await call(`/inbox${app ? `?app=${app}` : ''}`, { auth })))
    .shares;

async function granted(names?: Record<string, string>) {
  accounts(names);
  const ada = await person('user_a');
  const bo = await person('user_b');
  const item = await makeItem(ada.auth, { title: 'Budget', app: 'liveplanner' });
  await call(`/items/${item.id}/access-requests`, { method: 'POST', auth: bo.auth, body: {} });
  await settle();
  const [request] = h.db.sql.prepare('SELECT id FROM access_requests').all() as { id: string }[];
  const res = await call(`/items/${item.id}/access-requests/${request!.id}/grant`, {
    method: 'POST',
    auth: ada.auth,
    body: {},
  });
  expect(res.status).toBe(200);
  await settle();
  return { ada, bo, item, requestId: request!.id };
}

describe('shares in the Inbox read', () => {
  it('lists a grant for the requester, with who granted it, and never for the manager', async () => {
    const { ada, bo, item, requestId } = await granted();
    const shares = await sharesOf(bo.auth);
    expect(shares).toEqual([
      {
        id: requestId,
        app: 'liveplanner',
        itemId: item.id,
        itemTitle: 'Budget',
        itemTeamId: null,
        sharedById: 'user_a',
        sharedByName: 'Ada',
        sharedAt: expect.any(Number),
      },
    ]);
    expect(await sharesOf(ada.auth)).toEqual([]);
    // The app filter narrows it as every other row.
    expect(await sharesOf(bo.auth, 'liveplanner')).toHaveLength(1);
    expect(await sharesOf(bo.auth, 'livediagram')).toEqual([]);
  });

  it('says no name when accounts gave none', async () => {
    const { bo } = await granted({});
    expect((await sharesOf(bo.auth))[0]).toMatchObject({
      sharedById: 'user_a',
      sharedByName: null,
    });
  });

  it('leaves out a grant older than the window, an item in the Trash, and one no live link reaches', async () => {
    const { ada, bo, item } = await granted();
    h.db.sql
      .prepare('UPDATE access_requests SET closed_at = ?')
      .run(Date.now() - INBOX_SHARES_MS - 1);
    expect(await sharesOf(bo.auth)).toEqual([]);
    h.db.sql.prepare('UPDATE access_requests SET closed_at = ?').run(Date.now());
    h.db.sql.prepare('UPDATE share_links SET expires_at = ?').run(Date.now() - 1);
    expect(await sharesOf(bo.auth)).toEqual([]);
    h.db.sql.prepare('UPDATE share_links SET expires_at = NULL').run();
    expect(await sharesOf(bo.auth)).toHaveLength(1);
    expect((await call(`/items/${item.id}`, { method: 'DELETE', auth: ada.auth })).status).toBe(
      204,
    );
    expect(await sharesOf(bo.auth)).toEqual([]);
  });

  it('reads with the Inbox in one batch, whatever the window holds', async () => {
    const { bo } = await granted();
    const spy = vi.spyOn(h.db.env.INDEX_DB, 'batch');
    await sharesOf(bo.auth);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0]).toHaveLength(6);
  });
});
