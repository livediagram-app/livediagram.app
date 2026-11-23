// An item's tier, as its room holds it (liveworkspace/docs/specs/019-subscription/subscription.md "Who pays for an
// item"), in every app: a plan's, a document's, a Space's, a knowledgebase's. The limits are the item OWNER's (its
// team's for a team's item), never the person's acting: read from the subscription service at most once a minute, and
// only where an await already stands (a wake, a request), so a hot path reads a number and never waits. With Pro off
// it asks nothing and every limit is the legacy one its caller names.
//
// A guest's item (its owner has no account) gets Free's limits here and is never sent to the service: no entitlement,
// spend, gauge or report (019 "A guest's item", the one rule of `itemPayer`). An item that is nobody's yet is not
// counted at all: every limit is the legacy one, as with Pro off.
//
// An item's standing counts (its rules, its pages) are told to the service, which sums them over everything the
// owner holds: a count that grows is asked first and refused past the owner's limit, one that shrinks is told in the
// background. When the item changes owner the counts it told move with it.
import { ENTITLEMENT_FRESH_MS, limitOf, type SubscriptionClient } from './client';
import { GUEST_LIMITS, itemPayer } from './item-payer';
import type { OwnerScope } from './owner';
import type { LimitKey, Limits } from './tiers';
import {
  GAUGE_LIMIT,
  type Entitlement,
  type Gauge,
  type GaugeResult,
  type ItemCountResult,
  type ItemMeter,
  type SpendMeter,
  type SpendResult,
} from './wire';

/** The item's head as the tier reads it: who owns it, and its name for the owner's Subscription page. */
export type TierHead = { ownerId: string; teamId: string | null; name: string };

/** A refusal at a tier's limit asks the service for the owner's limits again at most this often (per room), so a
 *  retry straight after paying works and a burst of refusals costs one call. */
export const RECHECK_EVERY_MS = 5_000;

export type ItemTierDeps = {
  /** The subscription client, or null for a room with no env (a unit test's). */
  client: () => SubscriptionClient | null;
  /** The item's head now: one synchronous read. Null for an item not stored, or not yet anyone's. */
  head: () => TierHead | null;
  /** The room's background work. */
  defer: (work: Promise<unknown>) => void;
  now?: () => number;
};

export class ItemTier {
  /** The owner the entitlement was last read for. Null for a guest's item and nobody's: nobody an offer is for. */
  owner: OwnerScope | null = null;
  /** The item is a guest's, as last read: Free's limits, kept here, and nothing sent to the service. */
  guest = false;
  /** The gauge keys this room has told the service of, each with what it was asked to be (counted or not) and
   *  when (roadmap-gauge.ts), so a key is told again at most once a minute, whatever the service answered. */
  readonly gauged = new Map<string, { counted: boolean; at: number }>();
  /** What the service last said the owner holds of each gauge. */
  readonly gaugeUsed = new Map<Gauge, number>();

  private entitlement: Entitlement | null = null;
  private readAt = 0;
  private recheckedAt: number | null = null;
  // The gauge keys the service holds for this owner, as it last answered here.
  private readonly accepted = new Set<string>();
  private held: SubscriptionClient | null | undefined;
  // The standing counts this room has told the service for its owner, by `<meter>:<item>`: what moves with the item
  // when its owner changes.
  private readonly counted = new Map<string, { meter: ItemMeter; item: string; used: number }>();
  private readonly deps: ItemTierDeps;

  constructor(deps: ItemTierDeps) {
    this.deps = deps;
  }

  private get client(): SubscriptionClient | null {
    if (this.held === undefined) this.held = this.deps.client();
    return this.held;
  }

  private now(): number {
    return (this.deps.now ?? Date.now)();
  }

  /** Whether Pro is on here: off, nothing is asked, counted or refused beyond the legacy limits. */
  get on(): boolean {
    return this.client?.enabled === true;
  }

  // Who pays for the item, as its head names its owner and team now (the one rule, `itemPayer`).
  private payer() {
    const head = this.deps.head();
    return itemPayer({ owner: head?.ownerId ?? null, team: head?.teamId ?? null });
  }

  /** The item's owner as its head names it now: null while it has none, and for a guest's item. */
  scope(): OwnerScope | null {
    const payer = this.payer();
    return payer.kind === 'owner' ? payer.scope : null;
  }

  /** Whether the limits held are current: always with Pro off; with it on, read for this owner within the minute. */
  fresh(): boolean {
    if (!this.on) return true;
    const payer = this.payer();
    if (payer.kind !== 'owner')
      return this.owner === null && this.guest === (payer.kind === 'guest');
    return payer.scope === this.owner && this.now() - this.readAt < ENTITLEMENT_FRESH_MS;
  }

  /** The owner's entitlement read again. Never throws: the client answers its last, or Free. A guest's item and
   *  nobody's ask nothing. */
  async refresh(): Promise<void> {
    const client = this.client;
    if (!client?.enabled) return;
    const payer = this.payer();
    const owner = payer.kind === 'owner' ? payer.scope : null;
    const before = this.entitlement;
    const entitlement = owner === null ? null : await client.entitlement(owner);
    // A new owner starts from nothing, and so does an owner whose limits moved (an upgrade): a place refused a
    // moment ago is asked for again.
    if (owner !== this.owner) this.moveCounts(client, this.owner, owner);
    if (
      owner !== this.owner ||
      JSON.stringify(before?.limits) !== JSON.stringify(entitlement?.limits)
    ) {
      this.gauged.clear();
      if (owner !== this.owner) {
        this.gaugeUsed.clear();
        this.accepted.clear();
      }
    }
    this.entitlement = entitlement;
    this.owner = owner;
    this.guest = payer.kind === 'guest';
    this.readAt = this.now();
  }

  /**
   * A refusal at one of the tier's limits is about to be answered: the owner's limits are asked for once more, past
   * the minute's memory (the room's and the client's), so a retry straight after an upgrade is not refused on the
   * old tier. At most once every RECHECK_EVERY_MS a room. True when the limits changed: the caller checks again.
   */
  async recheck(): Promise<boolean> {
    const client = this.client;
    const owner = client?.enabled ? this.scope() : null;
    if (!client || owner === null) return false;
    const now = this.now();
    if (this.recheckedAt !== null && now - this.recheckedAt < RECHECK_EVERY_MS) return false;
    this.recheckedAt = now;
    const before = JSON.stringify(this.entitlement?.limits);
    client.forget(owner);
    await this.refresh();
    return JSON.stringify(this.entitlement?.limits) !== before;
  }

  /** The number a feature enforces: the owner's tier's, Free's for a guest's item, or `legacy` with Pro off and for
   *  an item that is nobody's. A synchronous read. */
  limit<K extends LimitKey, L>(key: K, legacy: L): Limits[K] | L {
    if (this.on && this.guest) return GUEST_LIMITS[key];
    return limitOf(this.on ? this.entitlement : null, key, legacy);
  }

  /**
   * Spends from one of the owner's monthly meters before the work. Null with Pro off, for a guest's item and for
   * one that is nobody's: not metered (a guest's item asks the service nothing, and the per-item bounds from
   * before Pro are all it has).
   */
  async spend(meter: SpendMeter, amount = 1): Promise<SpendResult | null> {
    const client = this.client;
    if (!client?.enabled) return null;
    const payer = this.payer();
    if (payer.kind !== 'owner') return null;
    return this.heard(payer.scope, await client.spend(payer.scope, meter, amount));
  }

  // The service's own answer names the owner's tier now: where that is not the tier the limits here were read for
  // (the owner upgraded, or their subscription ended, inside the minute), they are read again at the next ask.
  private heard<R extends SpendResult | GaugeResult | ItemCountResult>(
    owner: OwnerScope,
    result: R,
  ): R {
    if (!result.unmetered && this.entitlement && result.tier !== this.entitlement.tier) {
      this.client?.forget(owner);
      this.readAt = 0;
    }
    return result;
  }

  /**
   * One entry added to the owner's gauge, refused at its limit. Null with Pro off or no owner. A guest's item is
   * counted here, against Free's limit: `held` is how many of the item's own entries hold a place now.
   */
  async claim(gauge: Gauge, key: string, held = 0): Promise<GaugeResult | null> {
    const client = this.client;
    if (!client?.enabled) return null;
    const payer = this.payer();
    if (payer.kind === 'guest') {
      const limit = GUEST_LIMITS[GAUGE_LIMIT[gauge]];
      const ok = limit === null || held < limit;
      return { ok, used: held + (ok ? 1 : 0), limit, tier: 'free' };
    }
    if (payer.kind !== 'owner') return null;
    const result = this.heard(payer.scope, await client.addToGauge(payer.scope, gauge, key));
    this.gaugeUsed.set(gauge, result.used);
    this.gauged.set(key, { counted: true, at: this.now() });
    if (result.ok) this.accepted.add(key);
    else this.accepted.delete(key);
    return result;
  }

  /** Whether the service was asked to count `key` (or not to) within the minute, whatever it answered: nothing to
   *  tell again, so an item over its limit asks once a minute a key, never once a list. */
  told(key: string, counted: boolean): boolean {
    const last = this.gauged.get(key);
    return !!last && last.counted === counted && this.now() - last.at < ENTITLEMENT_FRESH_MS;
  }

  /** One entry taken off a gauge: the item's owner's, or `of`'s (the owner an item has just left). */
  async release(gauge: Gauge, key: string, of?: OwnerScope): Promise<void> {
    const client = this.client;
    const owner = of ?? this.scope() ?? this.owner;
    if (!client?.enabled || owner === null) return;
    await client.removeFromGauge(owner, gauge, key);
    if (of !== undefined && of !== this.owner) return;
    const used = this.gaugeUsed.get(gauge);
    if (this.accepted.delete(key) && used !== undefined)
      this.gaugeUsed.set(gauge, Math.max(0, used - 1));
    this.gauged.set(key, { counted: false, at: this.now() });
  }

  /**
   * The item's standing count told to the service, which sums it with the owner's other items. `adding`: it grows
   * because someone adds (a rule, a page), so the answer may refuse it, and nothing is recorded then; otherwise it is
   * recorded whatever the total. Null with Pro off, for a guest's item and for one that is nobody's: those keep to
   * their own per-item bound.
   */
  async count(
    meter: ItemMeter,
    item: string,
    used: number,
    adding = false,
  ): Promise<ItemCountResult | null> {
    const client = this.client;
    if (!client?.enabled || this.payer().kind !== 'owner') return null;
    if (!this.fresh()) await this.refresh();
    // Fresh, for an owner's item, is read for that owner.
    const owner = this.owner!;
    const result = this.heard(
      owner,
      await client.countItem({ owner, meter, item, used, ...(adding ? { adding: true } : {}) }),
    );
    if (result.ok) this.remember(meter, item, used);
    return result;
  }

  /** A count that did not grow (a delete), told in the background. */
  recount(meter: ItemMeter, item: string, used: number): void {
    const client = this.client;
    const owner = this.owner;
    if (!client?.enabled || owner === null || this.guest) return;
    this.remember(meter, item, used);
    this.deps.defer(client.countItem({ owner, meter, item, used }));
  }

  private remember(meter: ItemMeter, item: string, used: number): void {
    const key = `${meter}:${item}`;
    if (used === 0) this.counted.delete(key);
    else this.counted.set(key, { meter, item, used });
  }

  // The item changed owner: the old owner holds none of its counts now, and the new one holds them all, as the
  // item already does (recorded whatever the total, as anything an item already holds is).
  private moveCounts(
    client: SubscriptionClient,
    from: OwnerScope | null,
    to: OwnerScope | null,
  ): void {
    if (from === null) return;
    for (const { meter, item, used } of this.counted.values()) {
      this.deps.defer(client.countItem({ owner: from, meter, item, used: 0 }));
      if (to !== null) this.deps.defer(client.countItem({ owner: to, meter, item, used }));
    }
    if (to === null) this.counted.clear();
  }
}

/** The item's tier with its limits current, or null with Pro off (or outside a room): nothing is metered. */
export async function tierOn(env: { TIER?: ItemTier }): Promise<ItemTier | null> {
  const tier = env.TIER;
  if (!tier?.on) return null;
  if (!tier.fresh()) await tier.refresh();
  return tier;
}
