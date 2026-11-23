// The subscription service as the api's tests stand it in (liveworkspace/docs/specs/019-subscription/subscription.md
// "The subscription Worker"): each owner's limit of one meter and what they have spent of it, behind the same
// internal routes, with every request kept. Spends are all-or-nothing, as the service's are.
import {
  createSubscriptionClient,
  limitsFor,
  type SpendMeter,
  type SubscriptionClient,
  type SubscriptionFetcher,
} from '@liveworkspace/subscription';

export type FakeSubscription = {
  fetcher: SubscriptionFetcher;
  /** A client over the fake, with its own cache and health, on `now`. */
  client: (now?: () => number) => SubscriptionClient;
  /** Every request the service took: the route, and its body. */
  asked: { route: string; body: Record<string, unknown> }[];
  /** What each owner has spent. */
  used: Map<string, number>;
  /** Each owner's limit; `fallback` for anyone else. */
  limits: Map<string, number>;
  fallback: number;
  /** The service answers 503 to everything. */
  down: boolean;
  /** The service refuses everything with this status (a rotated key is 401); null when it answers. */
  refuse: number | null;
  spends: () => { owner: string; amount: number }[];
};

export function fakeSubscription(
  meter: SpendMeter = 'callMinutes',
  fallback = 1000,
): FakeSubscription {
  const key = meter === 'callMinutes' ? 'callMinutesPerMonth' : 'aiCreditsPerMonth';
  const fake: FakeSubscription = {
    asked: [],
    used: new Map(),
    limits: new Map(),
    fallback,
    down: false,
    refuse: null,
    fetcher: {
      fetch: async (input, init) => {
        const route = input.split('/internal/')[1]!;
        const body = JSON.parse(init?.body as string) as Record<string, unknown>;
        fake.asked.push({ route, body });
        if (fake.down) return new Response('down', { status: 503 });
        if (fake.refuse !== null)
          return new Response(JSON.stringify({ error: 'unauthorised' }), { status: fake.refuse });
        const owner = String(body.owner);
        const limit = fake.limits.get(owner) ?? fake.fallback;
        const answer = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });
        if (route === 'entitlement') {
          return answer({
            owner,
            tier: 'free',
            seats: 1,
            limits: { ...limitsFor('free'), [key]: limit },
          });
        }
        const used = fake.used.get(owner) ?? 0;
        const amount = Number(body.amount);
        if (used + amount > limit) return answer({ ok: false, used, limit, tier: 'free' });
        fake.used.set(owner, used + amount);
        return answer({ ok: true, used: used + amount, limit, tier: 'free' });
      },
    },
    client: (now = Date.now) =>
      createSubscriptionClient({
        enabled: true,
        app: 'livehuddle.app',
        key: 'app-key',
        fetcher: fake.fetcher,
        now,
        cache: new Map(),
        health: { downUntil: 0 },
      }),
    spends: () =>
      fake.asked
        .filter((call) => call.route === 'spend')
        .map((call) => ({ owner: String(call.body.owner), amount: Number(call.body.amount) })),
  };
  return fake;
}
