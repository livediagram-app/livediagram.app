// The subscription service as an app's Worker calls it (subscription.md "Entitlement", "Meters"). With Pro off the
// client makes no request: an entitlement is null, and every spend and gauge is allowed.
//
// With Pro on, an answer that could not be HAD (no answer in time, a failure on the way, a 5xx) and an answer that
// was a REFUSAL (a 4xx: a rotated key, a body the service will not take) are never confused. Out of reach allows
// (the spec's rule for an outage); refused allows nothing, and says so in the log.

import { proEnabled } from './flag';
import { isOwnerScope, type OwnerScope } from './owner';
import {
  isTier,
  limitsFor,
  TIER_LIMITS,
  TIERS,
  type LimitKey,
  type Limits,
  type Tier,
} from './tiers';
import {
  SUBSCRIPTION_API_URL,
  SUBSCRIPTION_APP_HEADER,
  type Entitlement,
  type Gauge,
  type GaugeRequest,
  type GaugeResult,
  type ItemCountRequest,
  type ItemCountResult,
  type SpendMeter,
  type SpendRequest,
  type SpendResult,
  type SubscriptionApp,
  type UnmeteredReason,
  SPEND_METER_LIMIT,
  GAUGE_LIMIT,
  ITEM_METER_LIMIT,
} from './wire';

/** A service binding, or anything else with its `fetch`. */
export type SubscriptionFetcher = {
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
};

export type SubscriptionClientConfig = {
  /** `proEnabled(env.PRO_ENABLED)`. */
  enabled: boolean;
  app: SubscriptionApp;
  /** This app's key. Without it nothing can be asked, and every owner is Free. */
  key?: string;
  /** The service's API, without a trailing slash. */
  url?: string;
  /** The service binding. Without it the public route is fetched. */
  fetcher?: SubscriptionFetcher;
  now?: () => number;
  cache?: EntitlementCache;
  /** Whether the service was lately out of reach. One per service address in an isolate unless given. */
  health?: SubscriptionHealth;
};

type CacheEntry = { entitlement: Entitlement; at: number };
export type EntitlementCache = Map<string, CacheEntry>;

/** An entitlement is asked for again after this long. */
export const ENTITLEMENT_FRESH_MS = 60 * 1000;
/** With the service unreachable, the last answer is used for this long, then Free. */
export const ENTITLEMENT_STALE_MS = 24 * 60 * 60 * 1000;
/** The cache never holds more owners than this: the oldest goes first. */
export const ENTITLEMENT_CACHE_MAX = 500;

/** A call to the service is given up on after this long: an app's request never hangs on it. */
export const SUBSCRIPTION_CALL_TIMEOUT_MS = 3000;
/** After the service could not be reached it is not asked again for this long, so an outage costs an app one slow
 *  call every few seconds rather than one a request. */
export const SUBSCRIPTION_RETRY_MS = 10 * 1000;

/** Until when the service is left alone, in ms (0 when it was last reached), and until when a refusal it answered
 *  is not logged again. */
export type SubscriptionHealth = { downUntil: number; refusalLoggedUntil?: number };

/** One isolate's view of each service address, shared by every client made without its own. */
const SHARED_HEALTH = new Map<string, SubscriptionHealth>();

function sharedHealth(base: string): SubscriptionHealth {
  let health = SHARED_HEALTH.get(base);
  if (!health) SHARED_HEALTH.set(base, (health = { downUntil: 0 }));
  return health;
}

/** One isolate's entitlements, shared by every client made without its own cache. */
const SHARED_CACHE: EntitlementCache = new Map();

/** The reads of the service under way for a cache, by owner: the callers of one miss share one request. */
type EntitlementReads = Map<string, Promise<Entitlement | 'unknown'>>;
const READS = new WeakMap<EntitlementCache, EntitlementReads>();

function readsOf(cache: EntitlementCache): EntitlementReads {
  let reads = READS.get(cache);
  if (!reads) READS.set(cache, (reads = new Map()));
  return reads;
}

/** Tests only: what the isolate remembers of every owner, dropped, so one test's tier never reaches the next. */
export function forgetEntitlementsForTests(): void {
  SHARED_CACHE.clear();
  readsOf(SHARED_CACHE).clear();
}

export function freeEntitlement(owner: OwnerScope): Entitlement {
  return { owner, tier: 'free', seats: 1, limits: limitsFor('free') };
}

/** The number a feature enforces: the entitlement's, or the legacy cap when Pro is off (a null entitlement). */
export function limitOf<K extends LimitKey, L>(
  entitlement: Entitlement | null,
  key: K,
  legacy: L,
): Limits[K] | L {
  return entitlement === null ? legacy : entitlement.limits[key];
}

export type SubscriptionClient = {
  enabled: boolean;
  /** The owner's entitlement, or null with Pro off. Never throws. */
  entitlement: (owner: OwnerScope) => Promise<Entitlement | null>;
  /**
   * The owner's entitlement only where the service said it (now, or within the last day): `'unknown'` where it could
   * not be asked and nothing is remembered, which `entitlement` answers as Free. For anything that deletes what a tier
   * no longer keeps: an outage must never read as Free there. Null with Pro off.
   */
  confirmedEntitlement: (owner: OwnerScope) => Promise<Entitlement | null | 'unknown'>;
  /**
   * Spends from a monthly meter before the work is done. Allowed with Pro off or the service out of reach
   * (`unmetered: 'unreachable'`). `ok: false` at the limit, and when the service refused the request
   * (`unmetered: 'refused'`) or this Worker has no key and Free has none of the meter (`unmetered: 'no_key'`).
   */
  spend: (owner: OwnerScope, meter: SpendMeter, amount?: number) => Promise<SpendResult>;
  /** Adds one entry to a counted gauge, refused at the limit and wherever a spend would be. */
  addToGauge: (owner: OwnerScope, gauge: Gauge, key: string) => Promise<GaugeResult>;
  removeFromGauge: (owner: OwnerScope, gauge: Gauge, key: string) => Promise<void>;
  /** Tells the service an item's standing count. A growing count (`adding`) is refused past the owner's limit and
   *  wherever a gauge add would be; any other is recorded whatever the total. */
  countItem: (request: ItemCountRequest) => Promise<ItemCountResult>;
  /** Drops what is cached for an owner, so the next read asks again. */
  forget: (owner: OwnerScope) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** The limits that may be unlimited (`null`) on some tier: for every other key a `null` is not an answer. */
const MAY_BE_UNLIMITED = new Set<LimitKey>(
  (Object.keys(TIER_LIMITS.free) as LimitKey[]).filter((key) =>
    TIERS.some((tier) => TIER_LIMITS[tier][key] === null),
  ),
);

/** One limit as the service sent it, or this build's own number for the tier where it sent none it can use (a key
 *  this build knows and the service does not yet, a string, a negative): a gap never reads as unlimited. */
function limitFrom(key: LimitKey, sent: unknown, own: Limits[LimitKey]): Limits[LimitKey] {
  if (typeof own === 'boolean') return typeof sent === 'boolean' ? sent : own;
  if (typeof sent === 'number' && Number.isFinite(sent) && sent >= 0) return sent;
  return sent === null && MAY_BE_UNLIMITED.has(key) ? null : own;
}

/**
 * The service's answer for `owner` as an entitlement, or null when it is not one: another owner's, no tier, no
 * seats, no limits. Each limit is checked on its own (`limitFrom`).
 */
function entitlementFrom(owner: OwnerScope, value: unknown): Entitlement | null {
  if (!isRecord(value) || value.owner !== owner || !isOwnerScope(value.owner)) return null;
  if (!isTier(value.tier) || !isRecord(value.limits)) return null;
  const { seats, limits: sent } = value;
  if (typeof seats !== 'number' || !Number.isInteger(seats) || seats < 1) return null;
  const tier: Tier = value.tier;
  const own = limitsFor(tier, seats);
  const limits = Object.fromEntries(
    (Object.keys(own) as LimitKey[]).map((key) => [key, limitFrom(key, sent[key], own[key])]),
  ) as Limits;
  return { owner, tier, seats, limits };
}

const isLimit = (value: unknown): value is number | null =>
  value === null || (typeof value === 'number' && Number.isFinite(value));

function isSpendResult(value: unknown): value is SpendResult {
  return (
    isRecord(value) &&
    typeof value.ok === 'boolean' &&
    typeof value.used === 'number' &&
    isLimit(value.limit) &&
    isTier(value.tier)
  );
}

// The two answers have one shape.
const isGaugeResult: (value: unknown) => value is GaugeResult = isSpendResult;
const isCountResult: (value: unknown) => value is ItemCountResult = isSpendResult;

/** What a call to the service came to: its answer, no answer at all, or a refusal with its status. */
type Answer =
  | { kind: 'answered'; body: unknown }
  | { kind: 'unreachable' }
  | { kind: 'refused'; status: number };

const UNREACHABLE: Answer = { kind: 'unreachable' };

export function createSubscriptionClient(config: SubscriptionClientConfig): SubscriptionClient {
  // The clock read at each call, so a test's clock moves it.
  const now = config.now ?? (() => Date.now());
  const cache = config.cache ?? SHARED_CACHE;
  const reads = readsOf(cache);
  const base = (config.url ?? SUBSCRIPTION_API_URL).replace(/\/+$/, '');
  const fetcher: SubscriptionFetcher = config.fetcher ?? {
    fetch: (input, init) => fetch(input, init),
  };
  const ready = config.enabled && typeof config.key === 'string' && config.key !== '';

  const health = config.health ?? sharedHealth(base);

  /** A refusal is logged once per skip window, with its status and never the key: a rotated key refuses every call. */
  function sayRefused(path: string, status: number): void {
    if (now() < (health.refusalLoggedUntil ?? 0)) return;
    health.refusalLoggedUntil = now() + SUBSCRIPTION_RETRY_MS;
    console.error(
      `[subscription] the service refused ${config.app}'s ${path} with ${status}: nothing it gates is allowed until it answers`,
    );
  }

  /**
   * A call to an internal route. No answer in time, a failure on the way, a 5xx or a body that is not JSON marks the
   * service out of reach, and it is left alone for a moment. A 4xx is an answer: the service is there and said no.
   */
  async function post(path: string, body: unknown): Promise<Answer> {
    if (now() < health.downUntil) return UNREACHABLE;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SUBSCRIPTION_CALL_TIMEOUT_MS);
    try {
      const response = await fetcher.fetch(`${base}/internal/${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.key}`,
          [SUBSCRIPTION_APP_HEADER]: config.app,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (response.status >= 500)
        throw new Error(`subscription service answered ${response.status}`);
      health.downUntil = 0;
      if (!response.ok) {
        sayRefused(path, response.status);
        return { kind: 'refused', status: response.status };
      }
      return { kind: 'answered', body: await response.json() };
    } catch {
      health.downUntil = now() + SUBSCRIPTION_RETRY_MS;
      return UNREACHABLE;
    } finally {
      clearTimeout(timer);
    }
  }

  /** An answer that is not the shape its route gives is a refusal too: the service is there, and nothing it said
   *  can be acted on. */
  function misshapen(path: string): 'refused' {
    sayRefused(path, 200);
    return 'refused';
  }

  function remember(owner: OwnerScope, entitlement: Entitlement): void {
    cache.delete(owner);
    cache.set(owner, { entitlement, at: now() });
    for (const oldest of cache.keys()) {
      if (cache.size <= ENTITLEMENT_CACHE_MAX) break;
      cache.delete(oldest);
    }
  }

  async function confirmedEntitlement(owner: OwnerScope): Promise<Entitlement | null | 'unknown'> {
    if (!config.enabled) return null;
    if (!ready) return 'unknown';
    const cached = cache.get(owner);
    if (cached && now() - cached.at < ENTITLEMENT_FRESH_MS) return cached.entitlement;
    // A miss asks once however many requests stand on it: the rest wait on the one under way.
    const pending = reads.get(owner);
    if (pending) return pending;
    const read = askEntitlement(owner, cached).finally(() => {
      // A read `forget` dropped has been replaced by now: only its own place is cleared.
      if (reads.get(owner) === read) reads.delete(owner);
    });
    reads.set(owner, read);
    return read;
  }

  async function askEntitlement(
    owner: OwnerScope,
    cached: CacheEntry | undefined,
  ): Promise<Entitlement | 'unknown'> {
    const answer = await post('entitlement', { owner });
    if (answer.kind === 'answered') {
      const entitlement = entitlementFrom(owner, answer.body);
      if (entitlement) {
        remember(owner, entitlement);
        return entitlement;
      }
      misshapen('entitlement');
      return 'unknown';
    }
    // Refused: what was remembered was this key's to read once and is not now. Only an outage uses the last answer.
    if (answer.kind === 'refused') return 'unknown';
    if (cached && now() - cached.at < ENTITLEMENT_STALE_MS) return cached.entitlement;
    return 'unknown';
  }

  async function entitlement(owner: OwnerScope): Promise<Entitlement | null> {
    const confirmed = await confirmedEntitlement(owner);
    return confirmed === 'unknown' ? freeEntitlement(owner) : confirmed;
  }

  /** What is known of an owner when a spend or gauge was not asked or could not be: its last entitlement, or Free. */
  function known(owner: OwnerScope): Pick<Entitlement, 'limits' | 'tier'> {
    const held = ready ? cache.get(owner)?.entitlement : undefined;
    return { limits: held?.limits ?? limitsFor('free'), tier: held?.tier ?? 'free' };
  }

  /**
   * The client's own answer where the service gave none it can use. Out of reach allows. Refused allows nothing.
   * No key allows against Free's numbers (nothing is counted).
   */
  function unmetered(
    owner: OwnerScope,
    key: LimitKey,
    reason: UnmeteredReason,
  ): SpendResult & GaugeResult {
    const { limits, tier } = known(owner);
    const limit = limits[key] as number | null;
    const ok = reason !== 'refused';
    return { ok, used: 0, limit, tier, unmetered: reason };
  }

  /** With Pro off everything is allowed and nothing is asked: the answer it always was. */
  function off(key: LimitKey): SpendResult & GaugeResult {
    return { ok: true, used: 0, limit: limitsFor('free')[key] as number | null, tier: 'free' };
  }

  /** One metered call: the service's own answer when it gave one of the right shape, else the client's. */
  async function metered<R extends SpendResult | GaugeResult | ItemCountResult>(
    path: string,
    body: SpendRequest | GaugeRequest | ItemCountRequest,
    key: LimitKey,
    isResult: (value: unknown) => value is R,
  ): Promise<R | (SpendResult & GaugeResult)> {
    if (!ready) return unmetered(body.owner, key, 'no_key');
    const answer = await post(path, body);
    if (answer.kind === 'answered') {
      if (isResult(answer.body)) return answer.body;
      return unmetered(body.owner, key, misshapen(path));
    }
    return unmetered(body.owner, key, answer.kind);
  }

  async function spend(owner: OwnerScope, meter: SpendMeter, amount = 1): Promise<SpendResult> {
    if (!config.enabled) return off(SPEND_METER_LIMIT[meter]);
    return metered('spend', { owner, meter, amount }, SPEND_METER_LIMIT[meter], isSpendResult);
  }

  async function gauge(request: GaugeRequest): Promise<GaugeResult> {
    if (!config.enabled) return off(GAUGE_LIMIT[request.gauge]);
    return metered('gauge', request, GAUGE_LIMIT[request.gauge], isGaugeResult);
  }

  return {
    enabled: config.enabled,
    entitlement,
    confirmedEntitlement,
    spend,
    addToGauge: (owner, name, key) => gauge({ owner, gauge: name, op: 'add', key }),
    removeFromGauge: async (owner, name, key) => {
      await gauge({ owner, gauge: name, op: 'remove', key });
    },
    countItem: async (request) => {
      if (!config.enabled) return off(ITEM_METER_LIMIT[request.meter]);
      return metered('item-count', request, ITEM_METER_LIMIT[request.meter], isCountResult);
    },
    forget: (owner) => {
      cache.delete(owner);
      // A read under way was asked before whatever is being forgotten: the next read asks again.
      reads.delete(owner);
    },
  };
}

/**
 * Whether a spend or a gauge add was refused because the service refused the REQUEST (a wrong key, a body it will
 * not take), not because the owner's limit was reached. The work must not go ahead either way; what the person is
 * told differs: "could not be checked", never "the limit is reached" with an offer to upgrade.
 */
export function refusedByService(result: Pick<SpendResult, 'ok' | 'unmetered'>): boolean {
  return !result.ok && result.unmetered === 'refused';
}

/** The env an app's Worker reads its subscription client from. */
export type SubscriptionEnv = {
  /** `true`, `1` or `on` turns Pro on. Unset is off. */
  PRO_ENABLED?: string;
  /** This app's key for the subscription service (wrangler secret put). */
  SUBSCRIPTION_KEY?: string;
  /** The service's API, for a deployment that is not on liveworkspace.app. */
  SUBSCRIPTION_URL?: string;
  /** The service binding to the subscription Worker. */
  SUBSCRIPTION?: SubscriptionFetcher;
};

/** An app's client from its env. Every Worker makes its client this way, so the flag is read in one place. */
export function subscriptionClientOf(
  env: SubscriptionEnv,
  app: SubscriptionApp,
  options: Pick<SubscriptionClientConfig, 'now' | 'cache'> = {},
): SubscriptionClient {
  return createSubscriptionClient({
    enabled: proEnabled(env.PRO_ENABLED),
    app,
    key: env.SUBSCRIPTION_KEY,
    url: env.SUBSCRIPTION_URL,
    fetcher: env.SUBSCRIPTION,
    ...options,
  });
}
