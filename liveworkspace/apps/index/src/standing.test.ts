// Where an item stands, told to its app (one-explorer-contracts.md "Where an item stands"): on archive, move out,
// trash and restore, once each, with the flags as they stand after the change, and a call the app can't take dropped
// with a log after one retry (the app runs the item as before).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STANDING_RETRY_MS } from './standing';
import { call, h, makeItem, person, settle, useHarness, type AppCall } from './test-support';

useHarness();

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const standings = (id: string) =>
  h.appCalls
    .filter((c) => c.url.endsWith(`/api/internal/items/${id}/standing`))
    .map((c) => {
      expect(c.method).toBe('POST');
      const { at, ...flags } = c.body as { archived: boolean; trashed: boolean; at: number };
      expect(at).toEqual(expect.any(Number));
      return flags;
    });

const post = (auth: string, path: string) => call(path, { method: 'POST', auth });

describe("telling an item's app where it stands", () => {
  it('tells it on archive and on the move out, with the app’s key', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    expect((await post(ada.auth, `/items/${item.id}/archive`)).status).toBe(200);
    await settle();
    const told = h.appCalls.find((c) => c.url.endsWith(`/items/${item.id}/standing`)) as AppCall;
    expect(told.headers.get('Authorization')).toMatch(/^Bearer /);
    expect(told.headers.get('X-Index-App')).toBe('liveplanner');
    // Archived again: nothing new written, nothing told.
    expect((await post(ada.auth, `/items/${item.id}/archive`)).status).toBe(200);
    // A rename keeps it in Archived: nothing told.
    await call(`/items/${item.id}`, { method: 'PATCH', auth: ada.auth, body: { title: 'New' } });
    // Moved out to My Work.
    await call(`/items/${item.id}`, { method: 'PATCH', auth: ada.auth, body: { folderId: null } });
    await settle();
    expect(standings(item.id)).toEqual([
      { archived: true, trashed: false },
      { archived: false, trashed: false },
    ]);
  });

  it('tells it on trash and restore, once each', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    // A move between folders of a live item tells nothing.
    await call(`/items/${item.id}`, { method: 'PATCH', auth: ada.auth, body: { folderId: null } });
    expect((await call(`/items/${item.id}`, { method: 'DELETE', auth: ada.auth })).status).toBe(
      204,
    );
    // Already in the Trash: not told twice.
    await call(`/items/${item.id}`, { method: 'DELETE', auth: ada.auth });
    expect((await post(ada.auth, `/items/${item.id}/restore`)).status).toBe(200);
    // Restoring a live item tells nothing.
    await post(ada.auth, `/items/${item.id}/restore`);
    await settle();
    expect(standings(item.id)).toEqual([
      { archived: false, trashed: true },
      { archived: false, trashed: false },
    ]);
  });

  it('keeps an archived item archived through the Trash', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    await post(ada.auth, `/items/${item.id}/archive`);
    await call(`/items/${item.id}`, { method: 'DELETE', auth: ada.auth });
    await post(ada.auth, `/items/${item.id}/restore`);
    await settle();
    expect(standings(item.id)).toEqual([
      { archived: true, trashed: false },
      { archived: true, trashed: true },
      { archived: true, trashed: false },
    ]);
  });

  it('retries a call the app cannot take once, then logs and drops it, and answers the person as before', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    h.appAnswer = (c) =>
      c.url.endsWith('/standing') ? new Response(null, { status: 503 }) : new Response(null);
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    expect((await call(`/items/${item.id}`, { method: 'DELETE', auth: ada.auth })).status).toBe(
      204,
    );
    // The retry waits its second, so nothing is dropped before it.
    await vi.advanceTimersByTimeAsync(STANDING_RETRY_MS - 1);
    expect(standings(item.id)).toHaveLength(1);
    expect(warn).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await settle();
    expect(warn).toHaveBeenCalledWith('[index] standing not delivered', {
      app: 'liveplanner',
      error: 'status_503',
    });
    // Asked twice, never a third time.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(standings(item.id)).toEqual([
      { archived: false, trashed: true },
      { archived: false, trashed: true },
    ]);
  });

  it('resumes the plan: a restore whose first call is lost is told again a second later', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    await call(`/items/${item.id}`, { method: 'DELETE', auth: ada.auth });
    await vi.advanceTimersByTimeAsync(0);
    await settle();
    // The restore's first call is refused; the second goes through.
    let restoreCalls = 0;
    h.appAnswer = (c) => {
      if (!c.url.endsWith('/standing') || (c.body as { trashed: boolean }).trashed)
        return new Response(null);
      restoreCalls += 1;
      return new Response(null, { status: restoreCalls === 1 ? 504 : 200 });
    };
    expect((await post(ada.auth, `/items/${item.id}/restore`)).status).toBe(200);
    await vi.advanceTimersByTimeAsync(STANDING_RETRY_MS);
    await settle();
    expect(restoreCalls).toBe(2);
    expect(standings(item.id).slice(1)).toEqual([
      { archived: false, trashed: false },
      { archived: false, trashed: false },
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('tells nobody when a purge takes the item for good', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    await call(`/items/${item.id}?permanent=true`, { method: 'DELETE', auth: ada.auth });
    await settle();
    expect(standings(item.id)).toEqual([]);
  });
});
