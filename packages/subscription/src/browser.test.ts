// The client a page holds (subscription.md "The subscription Worker"): public prices, signed-in reads that ask
// nothing when nobody is signed in, and the way into checkout, the portal and the mock provider's pages.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSubscriptionBrowserClient, SubscriptionRequestError } from './browser';

type Seen = { url: string; init: RequestInit };

function setup(answer: () => Response, options: { token?: string | null; origin?: string } = {}) {
  const seen: Seen[] = [];
  const client = createSubscriptionBrowserClient({
    origin: options.origin,
    getToken: async () => (options.token === undefined ? 'token-1' : options.token),
    fetch: (async (url: string, init: RequestInit = {}) => {
      seen.push({ url, init });
      return answer();
    }) as typeof fetch,
  });
  return { client, seen };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('a page', () => {
  it('reads the prices without a token, on its own origin when none is given', async () => {
    const prices = { prices: { currency: 'GBP', pro: 8, team: 6 } };
    const { client, seen } = setup(() => Response.json(prices));
    expect(await client.prices()).toEqual(prices);
    expect(seen).toEqual([
      { url: '/api/subscription/prices', init: { method: 'GET', headers: {}, body: undefined } },
    ]);
  });

  it("reads its own subscription and an owner with the account's token, across origins", async () => {
    const { client, seen } = setup(() => Response.json({ ok: true }), {
      origin: 'http://localhost:3000//',
    });
    await client.me();
    await client.ownerView('t:team_1');
    expect(seen.map((call) => call.url)).toEqual([
      'http://localhost:3000/api/subscription/me',
      'http://localhost:3000/api/subscription/owner?scope=t%3Ateam_1',
    ]);
    expect(seen[0]!.init.headers).toEqual({ Authorization: 'Bearer token-1' });
  });

  it('asks nothing when nobody is signed in: reads are null, writes are refused', async () => {
    const { client, seen } = setup(() => Response.json({}), { token: null });
    expect(await client.me()).toBeNull();
    expect(await client.ownerView('p:user_ada')).toBeNull();
    await expect(client.checkout('p:user_ada', 'https://x/')).rejects.toMatchObject({
      name: 'SubscriptionRequestError',
      status: 401,
      code: 'unauthorised',
    });
    await expect(client.portal('p:user_ada', 'https://x/')).rejects.toBeInstanceOf(
      SubscriptionRequestError,
    );
    expect(seen).toEqual([]);
  });

  it('starts a checkout and opens the portal with the owner and where to come back to', async () => {
    const { client, seen } = setup(() => Response.json({ url: 'https://pay.test/' }));
    expect(await client.checkout('p:user_ada', 'https://www.liveplanner.app/plan')).toEqual({
      url: 'https://pay.test/',
    });
    await client.portal('t:team_1', 'https://www.liveworkspace.app/settings');
    expect(seen.map((call) => [call.url, call.init.method, call.init.body])).toEqual([
      [
        '/api/subscription/checkout',
        'POST',
        '{"owner":"p:user_ada","returnTo":"https://www.liveplanner.app/plan"}',
      ],
      [
        '/api/subscription/portal',
        'POST',
        '{"owner":"t:team_1","returnTo":"https://www.liveworkspace.app/settings"}',
      ],
    ]);
    expect(seen[0]!.init.headers).toEqual({
      Authorization: 'Bearer token-1',
      'Content-Type': 'application/json',
    });
  });

  it('asks a team for Pro for Teams and dismisses the word that a tier ended, as the signed-in person', async () => {
    const { client, seen } = setup(() => Response.json({ sent: true, askedAt: 5 }));
    expect(await client.askTeam('t:team_1', 'automationRules', 'Please')).toEqual({
      sent: true,
      askedAt: 5,
    });
    await client.askTeam('t:team_1');
    expect(await client.dismissEnded('p:user_ada')).toBeUndefined();
    expect(seen.map((call) => [call.url, call.init.method, call.init.body])).toEqual([
      [
        '/api/subscription/team-request',
        'POST',
        '{"owner":"t:team_1","limit":"automationRules","note":"Please"}',
      ],
      ['/api/subscription/team-request', 'POST', '{"owner":"t:team_1","limit":null,"note":null}'],
      ['/api/subscription/ended/dismiss', 'POST', '{"owner":"p:user_ada"}'],
    ]);
    expect(seen[0]!.init.headers).toMatchObject({ Authorization: 'Bearer token-1' });
  });

  it("reads and acts on the mock provider's pages by their id, with no token", async () => {
    const { client, seen } = setup(() => Response.json({ id: 'a/b' }), { token: null });
    await client.mockCheckout('a/b');
    await client.actOnMockCheckout('a/b', 'pay');
    await client.mockPortal('s1');
    await client.actOnMockPortal('s1', { action: 'set_seats', seats: 5 });
    expect(seen.map((call) => [call.url, call.init.method, call.init.body])).toEqual([
      ['/api/subscription/mock/checkout/a%2Fb', 'GET', undefined],
      ['/api/subscription/mock/checkout/a%2Fb', 'POST', '{"action":"pay"}'],
      ['/api/subscription/mock/portal/s1', 'GET', undefined],
      ['/api/subscription/mock/portal/s1', 'POST', '{"action":"set_seats","seats":5}'],
    ]);
    expect(seen[1]!.init.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it("throws a refusal with the service's code", async () => {
    const { client } = setup(() => Response.json({ error: 'not_team_admin' }, { status: 403 }));
    const refusal = await client
      .checkout('t:team_1', 'https://x/')
      .catch((error: unknown) => error);
    expect(refusal).toBeInstanceOf(SubscriptionRequestError);
    expect(refusal).toMatchObject({ status: 403, code: 'not_team_admin' });
    expect((refusal as Error).message).toBe('Subscription request failed: 403 not_team_admin');
  });

  it('throws an unknown refusal when the answer says nothing it can read', async () => {
    for (const answer of [
      () => new Response('<html>', { status: 502 }),
      () => Response.json({ error: 7 }, { status: 500 }),
      () => Response.json(null, { status: 500 }),
      () => Response.json('no', { status: 404 }),
    ]) {
      const { client } = setup(answer);
      await expect(client.prices()).rejects.toMatchObject({ code: 'unknown' });
    }
  });

  it("uses the page's own fetch when given none", async () => {
    const fetched = vi.fn(async () => Response.json({ prices: {} }));
    vi.stubGlobal('fetch', fetched);
    const client = createSubscriptionBrowserClient({ getToken: async () => null });
    await client.prices();
    expect(fetched).toHaveBeenCalledWith('/api/subscription/prices', expect.anything());
  });
});
