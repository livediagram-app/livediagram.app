// The client an app's Worker holds (subscription.md "Entitlement", "Meters"): nothing asked with Pro off, a
// minute's cache, the last answer for a day when the service is out of reach, and never a thrown error or a hung
// request.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createSubscriptionClient,
  ENTITLEMENT_CACHE_MAX,
  ENTITLEMENT_FRESH_MS,
  ENTITLEMENT_STALE_MS,
  freeEntitlement,
  refusedByService,
  limitOf,
  SUBSCRIPTION_CALL_TIMEOUT_MS,
  SUBSCRIPTION_RETRY_MS,
  subscriptionClientOf,
  type EntitlementCache,
  type SubscriptionClientConfig,
  type SubscriptionHealth,
} from './client';
import type { OwnerScope } from './owner';
import { limitsFor } from './tiers';
import type { Entitlement } from './wire';

const ADA: OwnerScope = 'p:user_ada';
const pro = (owner: OwnerScope = ADA): Entitlement => ({
  owner,
  tier: 'pro',
  seats: 1,
  limits: limitsFor('pro'),
});

type Call = { url: string; init: RequestInit; body: Record<string, unknown> };

/** A client over a stand-in service: `answer` is what it says to each call, in turn or always. */
function setup(
  answer: (call: Call) => Response | Promise<Response>,
  patch: Partial<SubscriptionClientConfig> = {},
) {
  const calls: Call[] = [];
  const clock = { now: 1_000_000 };
  const cache: EntitlementCache = new Map();
  const health: SubscriptionHealth = { downUntil: 0 };
  const client = createSubscriptionClient({
    enabled: true,
    app: 'liveplanner.app',
    key: 'lp-key',
    fetcher: {
      fetch: async (url, init = {}) => {
        const call = {
          url,
          init,
          body: JSON.parse(init.body as string) as Record<string, unknown>,
        };
        calls.push(call);
        return answer(call);
      },
    },
    now: () => clock.now,
    cache,
    health,
    ...patch,
  });
  return { client, calls, clock, cache, health };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('with Pro off', () => {
  it('asks nothing: no entitlement, and every spend and gauge allowed', async () => {
    const { client, calls } = setup(() => Response.json(pro()), { enabled: false });
    expect(client.enabled).toBe(false);
    expect(await client.entitlement(ADA)).toBeNull();
    expect(await client.spend(ADA, 'aiCredits')).toEqual({
      ok: true,
      used: 0,
      limit: 50,
      tier: 'free',
    });
    expect(await client.addToGauge(ADA, 'publicRoadmaps', 'b1')).toEqual({
      ok: true,
      used: 0,
      limit: 1,
      tier: 'free',
    });
    await client.removeFromGauge(ADA, 'publicRoadmaps', 'b1');
    expect(
      await client.countItem({ owner: ADA, meter: 'rules', item: 'plan-1', used: 3, adding: true }),
    ).toEqual({ ok: true, used: 0, limit: 25, tier: 'free' });
    expect(calls).toEqual([]);
  });

  it('enforces the legacy cap, where there was one', () => {
    expect(limitOf(null, 'automationRules', 50)).toBe(50);
    expect(limitOf(null, 'formResponsesPerMonth', null)).toBeNull();
    expect(limitOf(pro(), 'automationRules', 50)).toBe(500);
    expect(limitOf(freeEntitlement(ADA), 'historyDays', 30)).toBe(7);
  });
});

describe('without a key', () => {
  it('everyone is Free and nothing is asked', async () => {
    for (const key of [undefined, '']) {
      const { client, calls } = setup(() => Response.json(pro()), { key });
      expect(await client.entitlement(ADA)).toEqual(freeEntitlement(ADA));
      expect(await client.countItem({ owner: ADA, meter: 'pages', item: 'kb-1', used: 3 })).toEqual(
        {
          ok: true,
          used: 0,
          limit: 500,
          tier: 'free',
          unmetered: 'no_key',
        },
      );
      expect(calls).toEqual([]);
    }
  });

  it('allows everything against Free’s numbers, uncounted', async () => {
    const { client, calls } = setup(() => Response.json(pro()), { key: '' });
    expect(await client.spend(ADA, 'automationRuns')).toEqual({
      ok: true,
      used: 0,
      limit: 500,
      tier: 'free',
      unmetered: 'no_key',
    });
    expect(await client.spend(ADA, 'aiCredits', 3)).toEqual({
      ok: true,
      used: 0,
      limit: 50,
      tier: 'free',
      unmetered: 'no_key',
    });
    expect(await client.addToGauge(ADA, 'publicRoadmaps', 'b1')).toEqual({
      ok: true,
      used: 0,
      limit: 1,
      tier: 'free',
      unmetered: 'no_key',
    });
    expect(calls).toEqual([]);
  });
});

describe('an entitlement', () => {
  it("is asked of the service with the app's key and name", async () => {
    const { client, calls } = setup(() => Response.json(pro()), {
      url: 'https://sub.test/api/subscription//',
    });
    expect(await client.entitlement(ADA)).toEqual(pro());
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://sub.test/api/subscription/internal/entitlement');
    expect(calls[0]!.init.method).toBe('POST');
    expect(calls[0]!.init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer lp-key',
      'X-Subscription-App': 'liveplanner.app',
    });
    expect(calls[0]!.body).toEqual({ owner: ADA });
  });

  it('goes to liveworkspace.app when no address is given', async () => {
    const { client, calls } = setup(() => Response.json(pro()));
    await client.entitlement(ADA);
    expect(calls[0]!.url).toBe(
      'https://www.liveworkspace.app/api/subscription/internal/entitlement',
    );
  });

  it('is kept for a minute, then asked for again', async () => {
    const { client, calls, clock } = setup(() => Response.json(pro()));
    await client.entitlement(ADA);
    clock.now += ENTITLEMENT_FRESH_MS - 1;
    await client.entitlement(ADA);
    expect(calls).toHaveLength(1);
    clock.now += 1;
    await client.entitlement(ADA);
    expect(calls).toHaveLength(2);
  });

  it('is asked for again at once after forget', async () => {
    const { client, calls } = setup(() => Response.json(pro()));
    await client.entitlement(ADA);
    client.forget(ADA);
    await client.entitlement(ADA);
    expect(calls).toHaveLength(2);
  });

  it('is the last answer for up to a day when the service cannot be reached, then Free', async () => {
    let up = true;
    const { client, clock } = setup(() => {
      if (!up) throw new Error('network');
      return Response.json(pro());
    });
    await client.entitlement(ADA);
    up = false;
    clock.now += ENTITLEMENT_STALE_MS - 1;
    expect((await client.entitlement(ADA))?.tier).toBe('pro');
    clock.now += SUBSCRIPTION_RETRY_MS;
    expect(await client.entitlement(ADA)).toEqual(freeEntitlement(ADA));
  });

  it('is Free for an owner never asked about while the service is out of reach', async () => {
    const { client } = setup(() => new Response('down', { status: 503 }));
    expect(await client.entitlement(ADA)).toEqual(freeEntitlement(ADA));
  });

  it('is Free when the answer is not one, another owner’s included', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const answers: unknown[] = [
      null,
      'pro',
      { owner: ADA, tier: 'gold', seats: 1, limits: {} },
      { owner: ADA, tier: 'pro', limits: {} },
      { owner: ADA, tier: 'pro', seats: 1 },
      { owner: ADA, tier: 'pro', seats: 0, limits: {} },
      { owner: ADA, tier: 'pro', seats: 1.5, limits: {} },
      { tier: 'pro', seats: 1, limits: {} },
      // Somebody else's entitlement, however well formed, is never this owner's.
      pro('p:user_bea'),
      { ...pro(), owner: 'nobody' },
    ];
    for (const answer of answers) {
      const { client, cache } = setup(() => Response.json(answer));
      expect(await client.entitlement(ADA)).toEqual(freeEntitlement(ADA));
      expect(cache.size).toBe(0);
    }
    const refused = setup(() => Response.json({ error: 'unauthorised' }, { status: 401 }));
    expect(await refused.client.entitlement(ADA)).toEqual(freeEntitlement(ADA));
    const garbled = setup(() => new Response('<html>', { status: 200 }));
    expect(await garbled.client.entitlement(ADA)).toEqual(freeEntitlement(ADA));
    error.mockRestore();
  });

  it('fills a limit the service did not send, or sent wrong, from this build’s own: never unlimited', async () => {
    const own = limitsFor('team', 4);
    const sent = {
      ...own,
      // A key this build knows and an older service does not: absent.
      automationRules: undefined,
      // Not numbers.
      aiCreditsPerMonth: '2000',
      imageMaxBytes: Number.NaN,
      callMinutesPerMonth: -1,
      // `null` is unlimited only where some tier has no limit.
      automationRunsPerMonth: null,
      walkthroughsStored: null,
      ownAiKey: 'yes',
      // What the service did say is kept, a number where this build has none included.
      publicRoadmaps: 7,
      imageStorageBytes: 123,
      somethingNew: 9,
    };
    const { client } = setup(() =>
      Response.json({ owner: 't:team_1', tier: 'team', seats: 4, limits: sent }),
    );
    const entitlement = await client.entitlement('t:team_1');
    expect(entitlement).toEqual({
      owner: 't:team_1',
      tier: 'team',
      seats: 4,
      limits: {
        ...own,
        walkthroughsStored: null,
        publicRoadmaps: 7,
        imageStorageBytes: 123,
      },
    });
    // The pooled limits filled in are the team's seats' worth.
    expect(entitlement?.limits.aiCreditsPerMonth).toBe(2000);
    expect(Object.keys(entitlement!.limits).sort()).toEqual(Object.keys(own).sort());
    const flagged = setup(() =>
      Response.json({ ...pro(), limits: { ...limitsFor('pro'), ownAiKey: false } }),
    );
    expect((await flagged.client.entitlement(ADA))?.limits.ownAiKey).toBe(false);
  });

  it('is remembered for no more owners than the cache holds: the oldest goes first', async () => {
    const { client, cache } = setup(({ body }) => Response.json(pro(body.owner as OwnerScope)));
    for (let i = 0; i <= ENTITLEMENT_CACHE_MAX; i++) await client.entitlement(`p:user_${i}`);
    expect(cache.size).toBe(ENTITLEMENT_CACHE_MAX);
    expect(cache.has('p:user_0')).toBe(false);
    expect(cache.has('p:user_1')).toBe(true);
    expect(cache.has(`p:user_${ENTITLEMENT_CACHE_MAX}`)).toBe(true);
  });

  it('shares one cache across the clients of an isolate unless given its own', async () => {
    const fetcher = { fetch: vi.fn(async () => Response.json(pro('p:shared'))) };
    const config = { enabled: true, app: 'livehuddle.app', key: 'k', fetcher } as const;
    await createSubscriptionClient(config).entitlement('p:shared');
    await createSubscriptionClient(config).entitlement('p:shared');
    expect(fetcher.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('a confirmed entitlement', () => {
  it('is the service’s answer, fresh or remembered, and null with Pro off', async () => {
    const { client, calls } = setup(() => Response.json(pro()));
    expect(await client.confirmedEntitlement(ADA)).toEqual(pro());
    expect(await client.confirmedEntitlement(ADA)).toEqual(pro());
    expect(calls).toHaveLength(1);
    expect(
      await setup(() => Response.json(pro()), { enabled: false }).client.confirmedEntitlement(ADA),
    ).toBeNull();
  });

  it('is unknown, never Free, where the service could not say and nothing is remembered', async () => {
    let up = true;
    const { client, clock } = setup(() => {
      if (!up) throw new Error('network');
      return Response.json(pro());
    });
    await client.confirmedEntitlement(ADA);
    up = false;
    clock.now += ENTITLEMENT_STALE_MS - 1;
    // Remembered within the day: still what the service last said.
    expect(await client.confirmedEntitlement(ADA)).toEqual(pro());
    clock.now += SUBSCRIPTION_RETRY_MS;
    expect(await client.confirmedEntitlement(ADA)).toBe('unknown');
    // Where `entitlement` answers Free.
    expect(await client.entitlement(ADA)).toEqual(freeEntitlement(ADA));
    const never = setup(() => new Response('down', { status: 503 }));
    expect(await never.client.confirmedEntitlement(ADA)).toBe('unknown');
  });

  it('is unknown, and Free to enforce, once the service refuses: the last answer is an outage’s, not a refusal’s', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    let status = 200;
    const { client, clock } = setup(() =>
      status === 200 ? Response.json(pro()) : Response.json({ error: 'x' }, { status }),
    );
    expect((await client.entitlement(ADA))?.tier).toBe('pro');
    // Fresh: the answer in hand is used, and nothing is asked.
    status = 401;
    expect((await client.entitlement(ADA))?.tier).toBe('pro');
    clock.now += ENTITLEMENT_FRESH_MS;
    for (status of [401, 400, 404]) {
      expect(await client.confirmedEntitlement(ADA)).toBe('unknown');
      expect(await client.entitlement(ADA)).toEqual(freeEntitlement(ADA));
    }
    error.mockRestore();
  });

  it('is unknown without a key: nothing can be asked', async () => {
    const { client, calls } = setup(() => Response.json(pro()), { key: '' });
    expect(await client.confirmedEntitlement(ADA)).toBe('unknown');
    expect(calls).toEqual([]);
  });
});

describe('when the service is out of reach', () => {
  it('is left alone for a moment after a failure, so an outage costs one slow call, not one a request', async () => {
    const { client, calls, clock, health } = setup(() => {
      throw new Error('network');
    });
    await client.entitlement(ADA);
    await client.entitlement(ADA);
    await client.spend(ADA, 'aiCredits');
    await client.addToGauge(ADA, 'publicRoadmaps', 'b1');
    expect(calls).toHaveLength(1);
    expect(health.downUntil).toBe(clock.now + SUBSCRIPTION_RETRY_MS);
    clock.now += SUBSCRIPTION_RETRY_MS;
    await client.entitlement(ADA);
    expect(calls).toHaveLength(2);
  });

  it('is asked again once it answers, and a refusal is not an outage', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const answers = [
      new Response(null, { status: 500 }),
      Response.json({ error: 'bad_request' }, { status: 400 }),
    ];
    const { client, calls, clock, health } = setup(() => answers.shift() ?? Response.json(pro()));
    await client.entitlement(ADA);
    expect(health.downUntil).toBeGreaterThan(clock.now);
    clock.now += SUBSCRIPTION_RETRY_MS;
    await client.entitlement(ADA);
    expect(health.downUntil).toBe(0);
    expect((await client.entitlement(ADA))?.tier).toBe('pro');
    expect(calls).toHaveLength(3);
  });

  it('gives up on a call that gets no answer in time', async () => {
    vi.useFakeTimers();
    const { client, health } = setup(
      ({ init }) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const asked = client.entitlement(ADA);
    await vi.advanceTimersByTimeAsync(SUBSCRIPTION_CALL_TIMEOUT_MS);
    expect(await asked).toEqual(freeEntitlement(ADA));
    expect(health.downUntil).toBeGreaterThan(0);
  });

  it('keeps one view of each service address across the clients of an isolate', async () => {
    const fetcher = {
      fetch: vi.fn(async () => {
        throw new Error('network');
      }),
    };
    const config = {
      enabled: true,
      app: 'livedesign.app',
      key: 'k',
      fetcher,
      url: 'https://down.test/api',
    } as const;
    await createSubscriptionClient(config).entitlement('p:one');
    await createSubscriptionClient(config).entitlement('p:two');
    expect(fetcher.fetch).toHaveBeenCalledTimes(1);
    await createSubscriptionClient({ ...config, url: 'https://other.test/api' }).entitlement(
      'p:one',
    );
    expect(fetcher.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('a spend', () => {
  it("is the service's answer, one credit unless told more", async () => {
    const { client, calls } = setup(() =>
      Response.json({ ok: false, used: 50, limit: 50, tier: 'free' }),
    );
    expect(await client.spend(ADA, 'aiCredits')).toEqual({
      ok: false,
      used: 50,
      limit: 50,
      tier: 'free',
    });
    await client.spend(ADA, 'callMinutes', 12);
    expect(calls.map((call) => [call.url.split('/').pop(), call.body])).toEqual([
      ['spend', { owner: ADA, meter: 'aiCredits', amount: 1 }],
      ['spend', { owner: ADA, meter: 'callMinutes', amount: 12 }],
    ]);
  });

  it('is allowed while the service is out of reach, against what is known of the owner, and says so', async () => {
    let up = true;
    const { client, clock } = setup(({ url }) => {
      if (!up) return new Response('down', { status: 503 });
      return url.endsWith('/entitlement') ? Response.json(pro()) : Response.error();
    });
    up = false;
    expect(await client.spend(ADA, 'aiCredits')).toEqual({
      ok: true,
      used: 0,
      limit: 50,
      tier: 'free',
      unmetered: 'unreachable',
    });
    clock.now += SUBSCRIPTION_RETRY_MS;
    up = true;
    await client.entitlement(ADA);
    up = false;
    expect(await client.spend(ADA, 'aiCredits')).toEqual({
      ok: true,
      used: 0,
      limit: 1000,
      tier: 'pro',
      unmetered: 'unreachable',
    });
    // Left alone for a moment: still allowed, with nothing asked.
    expect(await client.spend(ADA, 'aiCredits')).toMatchObject({ ok: true });
  });

  for (const status of [400, 401, 403, 404, 429]) {
    it(`is refused when the service answers ${status}: a rotated key or a bad request never spends silently`, async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { client, health } = setup(() => Response.json({ error: 'x' }, { status }));
      const spent = await client.spend(ADA, 'aiCredits');
      expect(spent).toEqual({ ok: false, used: 0, limit: 50, tier: 'free', unmetered: 'refused' });
      expect(refusedByService(spent)).toBe(true);
      // The service is there: it is not left alone, and the next call asks it again.
      expect(health.downUntil).toBe(0);
      error.mockRestore();
    });
  }

  it('tells a refusal by the service from a limit reached, and from an outage', async () => {
    expect(refusedByService({ ok: false, unmetered: 'refused' })).toBe(true);
    expect(refusedByService({ ok: false })).toBe(false);
    expect(refusedByService({ ok: false, unmetered: 'no_key' })).toBe(false);
    expect(refusedByService({ ok: true, unmetered: 'unreachable' })).toBe(false);
  });

  it('logs a refusal once per skip window, with the status and never the key', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { client, clock, calls } = setup(() => Response.json({ error: 'x' }, { status: 401 }));
    await client.spend(ADA, 'aiCredits');
    await client.spend(ADA, 'automationRuns');
    await client.addToGauge(ADA, 'publicRoadmaps', 'b1');
    expect(calls).toHaveLength(3);
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0]![0])).toContain('401');
    expect(String(error.mock.calls[0]![0])).toContain('liveplanner.app');
    expect(String(error.mock.calls[0]![0])).not.toContain('lp-key');
    clock.now += SUBSCRIPTION_RETRY_MS;
    await client.spend(ADA, 'aiCredits');
    expect(error).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  it('is refused when the answer is not a spend’s: half an answer allows nothing', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const body of [
      { ok: true },
      { ok: true, used: 1 },
      { ok: true, used: 1, limit: 'many', tier: 'pro' },
      { ok: true, used: 1, limit: 5, tier: 'gold' },
      { nonsense: true },
    ]) {
      const { client } = setup(() => Response.json(body));
      expect(await client.spend(ADA, 'automationRuns')).toEqual({
        ok: false,
        used: 0,
        limit: 500,
        tier: 'free',
        unmetered: 'refused',
      });
    }
    expect(String(error.mock.calls[0]![0])).toContain('200');
    error.mockRestore();
  });

  it('takes no limit as the service says it', async () => {
    const { client } = setup(() => Response.json({ ok: true, used: 9, limit: null, tier: 'pro' }));
    expect(await client.spend(ADA, 'aiCredits')).toEqual({
      ok: true,
      used: 9,
      limit: null,
      tier: 'pro',
    });
  });
});

describe('a gauge', () => {
  it('adds and removes through the one route', async () => {
    const { client, calls } = setup(() =>
      Response.json({ ok: true, used: 1, limit: 10, tier: 'pro' }),
    );
    expect(await client.addToGauge(ADA, 'publicRoadmaps', 'b1')).toEqual({
      ok: true,
      used: 1,
      limit: 10,
      tier: 'pro',
    });
    expect(await client.removeFromGauge(ADA, 'publicRoadmaps', 'b1')).toBeUndefined();
    expect(calls.map((call) => call.body)).toEqual([
      { owner: ADA, gauge: 'publicRoadmaps', op: 'add', key: 'b1' },
      { owner: ADA, gauge: 'publicRoadmaps', op: 'remove', key: 'b1' },
    ]);
    expect(calls.every((call) => call.url.endsWith('/internal/gauge'))).toBe(true);
  });

  it('is allowed while the service is out of reach, and refused when it refuses or answers nonsense', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const down = setup(() => new Response('down', { status: 502 }));
    expect(await down.client.addToGauge(ADA, 'publicRoadmaps', 'b1')).toEqual({
      ok: true,
      used: 0,
      limit: 1,
      tier: 'free',
      unmetered: 'unreachable',
    });
    const refused = setup(() => Response.json({ error: 'unauthorised' }, { status: 401 }));
    expect(await refused.client.addToGauge(ADA, 'publicRoadmaps', 'b1')).toEqual({
      ok: false,
      used: 0,
      limit: 1,
      tier: 'free',
      unmetered: 'refused',
    });
    const half = setup(() => Response.json({ ok: true, used: 'many' }));
    expect(await half.client.addToGauge(ADA, 'publicRoadmaps', 'b1')).toMatchObject({
      ok: false,
      unmetered: 'refused',
    });
    // A remove that is refused is dropped, as it always was: nothing to allow.
    await expect(
      refused.client.removeFromGauge(ADA, 'publicRoadmaps', 'b1'),
    ).resolves.toBeUndefined();
    error.mockRestore();
  });
});

describe("an item's count", () => {
  it('is told to the service, which answers the owner’s total', async () => {
    const answer = { ok: false, used: 24, limit: 25, tier: 'free' } as const;
    const { client, calls } = setup(() => Response.json(answer));
    const request = { owner: ADA, meter: 'rules', item: 'plan-1', used: 7, adding: true } as const;
    expect(await client.countItem(request)).toEqual(answer);
    expect(calls[0]!.url.endsWith('/internal/item-count')).toBe(true);
    expect(calls[0]!.body).toEqual(request);
  });

  it('is allowed, uncounted, with the service out of reach', async () => {
    const { client } = setup(() => new Response(null, { status: 500 }));
    expect(await client.countItem({ owner: ADA, meter: 'rules', item: 'plan-1', used: 7 })).toEqual(
      { ok: true, used: 0, limit: 25, tier: 'free', unmetered: 'unreachable' },
    );
  });
});

describe("an app's client from its env", () => {
  it('reads the flag, the key, the address and the binding', async () => {
    const binding = { fetch: vi.fn(async () => Response.json(pro())) };
    const env = {
      PRO_ENABLED: 'true',
      SUBSCRIPTION_KEY: 'lp-key',
      SUBSCRIPTION_URL: 'http://localhost:8794/api/subscription',
      SUBSCRIPTION: binding,
    };
    const client = subscriptionClientOf(env, 'liveplanner.app', { cache: new Map() });
    expect(client.enabled).toBe(true);
    expect((await client.entitlement(ADA))?.tier).toBe('pro');
    expect(binding.fetch).toHaveBeenCalledWith(
      'http://localhost:8794/api/subscription/internal/entitlement',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('is off, and asks nothing, when the flag is unset', async () => {
    const client = subscriptionClientOf({ SUBSCRIPTION_KEY: 'k' }, 'liveplanner.app');
    expect(client.enabled).toBe(false);
    expect(await client.entitlement(ADA)).toBeNull();
  });

  it('fetches the public route without a binding', async () => {
    const fetched = vi.fn(async () => Response.json(pro('p:public')));
    vi.stubGlobal('fetch', fetched);
    const client = subscriptionClientOf(
      { PRO_ENABLED: '1', SUBSCRIPTION_KEY: 'k' },
      'livediagram.app',
      {
        cache: new Map(),
      },
    );
    expect((await client.entitlement('p:public'))?.tier).toBe('pro');
    expect(fetched).toHaveBeenCalledWith(
      'https://www.liveworkspace.app/api/subscription/internal/entitlement',
      expect.anything(),
    );
  });
});
