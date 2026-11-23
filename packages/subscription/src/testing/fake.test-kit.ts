// The subscription service as tier tests stand it in (liveworkspace/docs/specs/019-subscription/subscription.md "The
// subscription Worker"): a fetcher that answers its internal routes as the service does (an owner's entitlement by
// their tier, spends, gauges and items' standing counts counted against that tier's limits). Every app's tier tests use it.
// Named `.test-kit.ts`: vitest does not collect it and coverage leaves it out.
import { limitsFor, type Tier } from '../tiers';
import {
  GAUGE_LIMIT,
  ITEM_METER_LIMIT,
  SPEND_METER_LIMIT,
  type Gauge,
  type ItemMeter,
  type SpendMeter,
} from '../wire';
import type { SubscriptionFetcher } from '../client';

export type FakeSubscription = {
  fetcher: SubscriptionFetcher;
  /** Each owner's tier (`p:<account>` or `t:<team>`); an owner not named is Free. */
  tiers: Map<string, Tier>;
  /** What each owner has spent of a meter this month, by `<owner>:<meter>`. */
  spent: Map<string, number>;
  /** Each owner's gauge keys, by `<owner>:<gauge>`. */
  gauges: Map<string, Set<string>>;
  /** Each item's standing count, by `<owner>:<meter>:<item>`. */
  items: Map<string, number>;
  /** Every call made: the route and its body. */
  calls: { path: string; body: Record<string, unknown>; headers: Headers }[];
  /** An owner's tier changed, as a subscription starting or ending does: nothing cached keeps the old one. */
  set: (owner: string, tier: Tier) => void;
  /** The calls made to one route. */
  to: (path: string) => Record<string, unknown>[];
};

export function fakeSubscription(
  tiers: Record<string, Tier> = {},
  // What a tier change drops: the isolate's cache of entitlements the client under test reads.
  forget: () => void = () => {},
): FakeSubscription {
  const fake: FakeSubscription = {
    tiers: new Map(Object.entries(tiers)),
    spent: new Map(),
    gauges: new Map(),
    items: new Map(),
    calls: [],
    set: (owner, tier) => {
      fake.tiers.set(owner, tier);
      forget();
    },
    to: (path) => fake.calls.filter((c) => c.path === path).map((c) => c.body),
    fetcher: {
      fetch: async (input, init) => {
        const path = new URL(input).pathname.split('/internal/')[1] ?? '';
        const sent = typeof init?.body === 'string' ? init.body : '{}';
        const body = JSON.parse(sent) as Record<string, unknown>;
        fake.calls.push({ path, body, headers: new Headers(init?.headers) });
        const owner = String(body['owner']);
        const tier = fake.tiers.get(owner) ?? 'free';
        const limits = limitsFor(tier);
        if (path === 'entitlement') return Response.json({ owner, tier, seats: 3, limits });
        if (path === 'spend') {
          const meter = body['meter'] as SpendMeter;
          const key = `${owner}:${meter}`;
          const limit = limits[SPEND_METER_LIMIT[meter]];
          const used = fake.spent.get(key) ?? 0;
          const amount = Number(body['amount']);
          // All or nothing, as the service spends.
          if (used + amount > limit) return Response.json({ ok: false, used, limit, tier });
          fake.spent.set(key, used + amount);
          return Response.json({ ok: true, used: used + amount, limit, tier });
        }
        if (path === 'gauge') {
          const gauge = body['gauge'] as Gauge;
          const key = `${owner}:${gauge}`;
          const held = fake.gauges.get(key) ?? new Set<string>();
          fake.gauges.set(key, held);
          const limit = limits[GAUGE_LIMIT[gauge]];
          const entry = String(body['key']);
          if (body['op'] === 'remove') held.delete(entry);
          else if (!held.has(entry)) {
            if (limit !== null && held.size >= limit)
              return Response.json({ ok: false, used: held.size, limit, tier });
            held.add(entry);
          }
          return Response.json({ ok: true, used: held.size, limit, tier });
        }
        if (path === 'item-count') {
          const meter = body['meter'] as ItemMeter;
          const limit = limits[ITEM_METER_LIMIT[meter]];
          const key = `${owner}:${meter}:${String(body['item'])}`;
          const others = [...fake.items]
            .filter(([k]) => k.startsWith(`${owner}:${meter}:`) && k !== key)
            .reduce((sum, [, n]) => sum + n, 0);
          const used = Number(body['used']);
          const grows = body['adding'] === true && used > (fake.items.get(key) ?? 0);
          if (grows && others + used > limit)
            return Response.json({
              ok: false,
              used: others + (fake.items.get(key) ?? 0),
              limit,
              tier,
            });
          if (used === 0) fake.items.delete(key);
          else fake.items.set(key, used);
          return Response.json({ ok: true, used: others + used, limit, tier });
        }
        return Response.json({});
      },
    },
  };
  return fake;
}
