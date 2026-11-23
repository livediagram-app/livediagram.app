// A knowledgebase's tier as liveknowledge reads it (docs/specs/030-knowledgebase/tiers.md, blueprint tiers.md "Where
// the tier is read"): in the room, its ItemTier; on the Worker, `workerTier` over the document's owner and team. Both
// answer the same synchronous `limit`, so each figure below is worked out one way. With Pro off, every figure is the
// legacy one and nothing is asked.
import { MAX_KNOWLEDGEBASE_PAGES, type PageTreeRefusal } from '@liveknowledge/document';
import {
  GAUGE_LIMIT,
  GUEST_LIMITS,
  itemPayer,
  limitOf,
  refusedByService,
  tierRefusal,
  type Entitlement,
  type Gauge,
  type GaugeResult,
  type ItemCountResult,
  type ItemMeter,
  type ItemTier,
  type Limits,
  type LimitKey,
  type OwnerScope,
  type SpendMeter,
  type SpendResult,
  type SubscriptionClient,
  type SubscriptionEnv,
} from '@liveworkspace/subscription';
import type { KnowledgeTierInfo } from '@liveknowledge/api-schema';
import { json } from '../responses';
import { subscriptionOf } from '../subscription';
import { READS_KEPT_DAYS } from '@liveknowledge/knowledge';

/** What the figures here read of a tier. */
export type KnowledgeTier = Pick<ItemTier, 'on' | 'guest' | 'limit'> & {
  // The payer, for an offer: null for a guest's knowledgebase and for one that is nobody's.
  readonly owner: OwnerScope | null;
};

/** What tells the subscription service a knowledgebase's page count: the room's ItemTier or the Worker's tier. */
export type PagesCounter = KnowledgeTier & {
  count(
    meter: ItemMeter,
    item: string,
    used: number,
    adding?: boolean,
  ): Promise<ItemCountResult | null>;
  recount(meter: ItemMeter, item: string, used: number): void;
};

/** The most pages one knowledgebase holds: a fixed bound on every tier (MAX_KNOWLEDGEBASE_PAGES, 500). The owner's
 *  Knowledgebase Pages, over every knowledgebase they own, are the service's to count (`countPages`). */
export const knowledgePagesMax = (_tier?: KnowledgeTier | null): number => MAX_KNOWLEDGEBASE_PAGES;

/**
 * A knowledgebase that grows to `pages`, told to the service (tiers.md "Knowledgebase Pages"): null when it is let
 * through (Pro off, a guest's or nobody's, the service out of reach, or within the owner's limit), else the refusal:
 * `page_limit` at the owner's limit, with their total and limit, or `unavailable` when the service refused the request.
 */
export async function countPages(
  tier: PagesCounter | null,
  documentId: string,
  pages: number,
): Promise<{ used: number; max: number } | 'unavailable' | null> {
  const result = tier ? await tier.count('pages', documentId, pages, true) : null;
  if (!result || result.ok) return null;
  if (refusedByService(result)) return 'unavailable';
  return { used: result.used, max: result.limit ?? 0 };
}

/** The knowledgebase is going for good: its pages and rules leave its owner's counts (019 "Meters": item counts),
 *  told while its head still names the owner, in the background. Nothing with Pro off; a refresh never throws. */
export async function leaveItemCounts(
  tier: Pick<ItemTier, 'on' | 'fresh' | 'refresh' | 'recount'>,
  documentId: string,
): Promise<void> {
  if (!tier.on) return;
  if (!tier.fresh()) await tier.refresh();
  tier.recount('pages', documentId, 0);
  tier.recount('rules', documentId, 0);
}

/** The answer to a page add the owner's Knowledgebase Pages refused (`countPages`). */
export function pagesRefused(
  tier: KnowledgeTier | null,
  refused: { used: number; max: number } | 'unavailable',
): Response {
  if (refused === 'unavailable') return json({ error: 'unavailable' }, { status: 503 });
  return json(
    { error: 'page_limit', ...tierRefusal(tier, 'knowledgebasePages', refused.used, refused.max) },
    { status: 409 },
  );
}

/** The days of page reads and agents seen kept: the tier's AI Knowledge History, 90 with Pro off. */
export const knowledgeHistoryDays = (tier: KnowledgeTier | null): number =>
  tier ? tier.limit('aiKnowledgeHistoryDays', READS_KEPT_DAYS) : READS_KEPT_DAYS;

/** The document read's `knowledgeTier` (tiers.md): the most pages one knowledgebase holds, the owner's Knowledgebase
 *  Pages over all of theirs (absent for a guest's and nobody's, which keep to the bound alone), and the days of history
 *  kept, with who to offer an upgrade for. Null with Pro off. */
export function knowledgeTierInfo(tier: KnowledgeTier | null): KnowledgeTierInfo | null {
  const head = tierHead(tier);
  if (!head) return null;
  const pagesLimit = tier!.owner ? tier!.limit('knowledgebasePages', null) : null;
  return {
    pagesMax: knowledgePagesMax(tier),
    ...(pagesLimit !== null ? { pagesLimit } : {}),
    historyDays: knowledgeHistoryDays(tier),
    ...head,
  };
}

/** What the editor is told of a tier-held figure: absent with Pro off; the owner only for an offer. */
export function tierHead(tier: KnowledgeTier | null): { owner?: OwnerScope; guest?: true } | null {
  if (!tier?.on) return null;
  return {
    ...(tier.owner ? { owner: tier.owner } : {}),
    ...(tier.guest ? { guest: true as const } : {}),
  };
}

/** The Worker's read of a knowledgebase's tier: its payer's entitlement, asked once (the client's cache holds it a
 *  minute for the isolate). Spends go to the payer too. */
export class WorkerTier implements KnowledgeTier {
  readonly owner: OwnerScope | null;
  readonly guest: boolean;
  private readonly client: SubscriptionClient;
  private readonly entitlement: Entitlement | null;
  private constructor(
    client: SubscriptionClient,
    owner: OwnerScope | null,
    guest: boolean,
    entitlement: Entitlement | null,
  ) {
    this.client = client;
    this.owner = owner;
    this.guest = guest;
    this.entitlement = entitlement;
  }

  static async of(
    client: SubscriptionClient,
    head: { ownerId?: string | null; teamId?: string | null },
  ): Promise<WorkerTier> {
    const payer = itemPayer({ owner: head.ownerId ?? null, team: head.teamId ?? null });
    const owner = payer.kind === 'owner' ? payer.scope : null;
    const entitlement = client.enabled && owner ? await client.entitlement(owner) : null;
    return new WorkerTier(client, owner, payer.kind === 'guest', entitlement);
  }

  get on(): boolean {
    return this.client.enabled;
  }

  limit<K extends LimitKey, L>(key: K, legacy: L): Limits[K] | L {
    if (this.on && this.guest) return GUEST_LIMITS[key];
    return limitOf(this.on ? this.entitlement : null, key, legacy);
  }

  /** One spend from the payer's month. Null with Pro off, for a guest's and for nobody's: not metered. */
  async spend(meter: SpendMeter, amount = 1): Promise<SpendResult | null> {
    if (!this.on || !this.owner) return null;
    return this.client.spend(this.owner, meter, amount);
  }

  /** The knowledgebase's standing count told to the service (ItemTier's `count`): null with Pro off, for a guest's
   *  and for nobody's. */
  async count(
    meter: ItemMeter,
    item: string,
    used: number,
    adding = false,
  ): Promise<ItemCountResult | null> {
    if (!this.on || !this.owner) return null;
    return this.client.countItem({
      owner: this.owner,
      meter,
      item,
      used,
      ...(adding ? { adding: true } : {}),
    });
  }

  /** A count that did not grow (a delete): recorded whatever the total, never refused. */
  async recount(meter: ItemMeter, item: string, used: number): Promise<void> {
    if (!this.on || !this.owner) return;
    await this.client.countItem({ owner: this.owner, meter, item, used }).catch(() => undefined);
  }

  /**
   * One entry added to the payer's gauge, refused at its limit: ItemTier's `claim`, for a route. Null with Pro off and
   * for nobody's. A guest's is counted here alone, against Free's limit: `held` is how many of the knowledgebase's
   * own entries hold a place now.
   */
  async claim(gauge: Gauge, key: string, held = 0): Promise<GaugeResult | null> {
    if (!this.on) return null;
    if (this.guest) {
      const limit = GUEST_LIMITS[GAUGE_LIMIT[gauge]];
      const ok = limit === null || held < limit;
      return { ok, used: held + (ok ? 1 : 0), limit, tier: 'free' };
    }
    if (!this.owner) return null;
    return this.client.addToGauge(this.owner, gauge, key);
  }

  /** One entry taken off the payer's gauge, or `of`'s. Nothing with Pro off, for a guest's and for nobody's. */
  async release(gauge: Gauge, key: string, of?: OwnerScope): Promise<void> {
    const owner = of ?? this.owner;
    if (!this.on || owner === null) return;
    await this.client.removeFromGauge(owner, gauge, key);
  }
}

/**
 * The days of history the daily prune keeps, from a tier the service CONFIRMED (dropping reads cannot be undone): 90
 * with Pro off and for nobody's knowledgebase, Free's for a guest's, and null while the owner's tier cannot be learnt,
 * so nothing is dropped for its age on a guess.
 */
export async function confirmedHistoryDays(
  client: SubscriptionClient,
  head: { ownerId?: string | null; teamId?: string | null },
): Promise<number | null> {
  if (!client.enabled) return READS_KEPT_DAYS;
  const payer = itemPayer({ owner: head.ownerId ?? null, team: head.teamId ?? null });
  if (payer.kind === 'guest') return GUEST_LIMITS.aiKnowledgeHistoryDays;
  if (payer.kind === 'nobody') return READS_KEPT_DAYS;
  const entitlement = await client.confirmedEntitlement(payer.scope);
  if (entitlement === 'unknown') return null;
  return limitOf(entitlement, 'aiKnowledgeHistoryDays', READS_KEPT_DAYS);
}

/** The Worker's tier for a knowledgebase: null with Pro off, so nothing is asked. */
export async function workerTierOf(
  env: SubscriptionEnv,
  head: { ownerId?: string | null; teamId?: string | null },
): Promise<WorkerTier | null> {
  const client = subscriptionOf(env);
  return client.enabled ? WorkerTier.of(client, head) : null;
}

/** A page-tree refusal as the api answers it: 409 with the reason. `page_limit` here is the one knowledgebase's fixed
 *  bound; the owner's limit over all of theirs is `pagesRefused`'s. */
export function pageTreeConflict(reason: PageTreeRefusal): Response {
  return json({ error: reason }, { status: 409 });
}
