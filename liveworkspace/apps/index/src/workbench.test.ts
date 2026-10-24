// Accounts' workbench service (liveworkspace/docs/workbench.md): it acts for a token's account on one app's items
// with its merge key, and asks the index to tell an app to close a pairing's rooms.
import type { GrantResponse } from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { body, call, h, makeItem, person, useHarness } from './test-support';
import { WORKBENCH_CLOSE_CONCURRENCY } from './workbench-close';

useHarness();

const asAccounts = (path: string, method = 'POST', app = 'liveplanner', key = 'merge-key') =>
  call(path, {
    method,
    auth: key,
    headers: { 'X-Index-App': app, 'X-Index-Person': 'user_a' },
  });

const close = (payload: unknown, auth = 'merge-key') =>
  call('/internal/workbench-close', { method: 'POST', auth, body: payload });

describe('accounts acting for a workbench token’s account', () => {
  it('reaches that app’s items as the account, with the merge key', async () => {
    const ada = await person('user_a');
    const plan = await makeItem(ada.auth, { title: 'Roadmap' });
    const canvas = await makeItem(ada.auth, { app: 'livediagram' });
    const granted = await body<GrantResponse>(await asAccounts(`/items/${plan.id}/grant`));
    expect(granted.level).toBe('edit');
    expect((await asAccounts(`/items/${canvas.id}/grant`)).status).toBe(404);
  });

  it('is refused with any other key', async () => {
    const ada = await person('user_a');
    const plan = await makeItem(ada.auth);
    expect(
      (await asAccounts(`/items/${plan.id}/grant`, 'POST', 'liveplanner', 'nope')).status,
    ).toBe(401);
  });
});

describe('POST /internal/workbench-close', () => {
  it('tells the app to close each room once, and answers what it reached', async () => {
    h.appAnswer = (c) => new Response(null, { status: c.url.includes('/b/') ? 503 : 204 });
    const res = await close({ app: 'liveplanner', pairingId: 'p_1', itemIds: ['a', 'b', 'a'] });
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ closed: 1, unreached: ['b'] });
    expect(h.appCalls.map((c) => `${c.method} ${c.url}`).sort()).toEqual([
      'POST https://liveplanner.app/api/internal/items/a/workbench-close',
      'POST https://liveplanner.app/api/internal/items/b/workbench-close',
    ]);
    expect(h.appCalls[0]!.body).toEqual({ pairingId: 'p_1' });
    expect(h.appCalls[0]!.headers.get('Authorization')).toBe('Bearer lp-key');
  });

  it('keeps at most ten closes in flight', async () => {
    let inFlight = 0;
    let most = 0;
    h.appAnswer = async () => {
      inFlight++;
      most = Math.max(most, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight--;
      return new Response(null, { status: 204 });
    };
    const itemIds = Array.from({ length: 40 }, (_, i) => `item${i}`);
    const res = await close({ app: 'livediagram', pairingId: 'p_1', itemIds });
    expect(await body(res)).toEqual({ closed: 40, unreached: [] });
    expect(most).toBe(WORKBENCH_CLOSE_CONCURRENCY);
  });

  it('is accounts’ only, and refuses a malformed body', async () => {
    expect(
      (await close({ app: 'liveplanner', pairingId: 'p', itemIds: [] }, 'lp-key')).status,
    ).toBe(401);
    expect((await close({ app: 'nope', pairingId: 'p', itemIds: [] })).status).toBe(400);
    expect((await close({ app: 'liveplanner', pairingId: 'p', itemIds: 'a' })).status).toBe(400);
    const tooMany = Array.from({ length: 501 }, (_, i) => `i${i}`);
    expect((await close({ app: 'liveplanner', pairingId: 'p', itemIds: tooMany })).status).toBe(
      400,
    );
    expect(h.appCalls).toHaveLength(0);
  });
});
