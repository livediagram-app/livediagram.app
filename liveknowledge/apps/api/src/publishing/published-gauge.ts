// The owner's published knowledgebases as the subscription service counts them (docs/specs/030-knowledgebase/
// publishing.md "Tiers"; blueprint publishing.md P28 to P32): its `publicKnowledgebases` gauge holds one key per
// published knowledgebase, its document id. Publish claims one first and is refused at the owner's tier's limit;
// Unpublish, the knowledgebase's purge and a move to another owner give it back.
//
// A site answers the public only while it HOLDS a counted place: `published_site.counted` (published-snapshot.ts) is
// set when the count takes it and cleared when its place is refused. A site never counted (published before Pro, or
// while the service was out of reach) answers until its first count. A knowledgebase holds one site at most, so a
// guest's is counted here alone, against Free's 1, which it always fits (019 "A guest's item"). With Pro off nothing
// here makes a call and no mark is read.
import {
  refusedByService,
  type Gauge,
  type GaugeResult,
  type ItemTier,
  type OwnerScope,
} from '@liveworkspace/subscription';
import type { DocumentEnv } from '../types';
import { readSite, setSiteCounted } from './published-snapshot';

export const SITE_GAUGE = 'publicKnowledgebases' satisfies Gauge;

/** What the count reads of a tier: the route's WorkerTier and the room's ItemTier both answer it. */
export type SiteTier = Pick<ItemTier, 'on' | 'guest' | 'claim' | 'release'>;

/** Whether a site answers the public: always with Pro off; with it on, unless its place was refused. */
export function siteServes(
  tier: Pick<SiteTier, 'on'> | null | undefined,
  counted: boolean | null,
): boolean {
  return !tier?.on || counted !== false;
}

/** One more public knowledgebase for its owner, asked before anything is published. Null where nothing is counted. */
export function claimSite(tier: SiteTier, documentId: string): Promise<GaugeResult | null> {
  return tier.claim(SITE_GAUGE, documentId, 0);
}

/** The knowledgebase's place given back: its owner's, or `of`'s (the owner it has just left). */
export function releaseSite(tier: SiteTier, documentId: string, of?: OwnerScope): Promise<void> {
  return tier.release(SITE_GAUGE, documentId, of);
}

/**
 * What a claim's answer makes of the mark: true (it holds a place), false (refused at the limit), or null to leave
 * the mark as it is (nothing counted it: Pro off, the service out of reach or refusing the request).
 */
export function markOfClaim(claim: GaugeResult | null): boolean | null {
  if (!claim || claim.unmetered) return null;
  return claim.ok;
}

/**
 * The site counted again, where one exists (the dialog's first read, the daily upkeep): one from before takes its
 * place, one refused takes it when the owner has room. Answers the claim (null: nothing published or counted) and
 * the mark as it now stands. The service refusing the request itself changes nothing.
 */
export async function countSite(
  env: DocumentEnv,
  tier: SiteTier,
  documentId: string,
): Promise<{ claim: GaugeResult | null; counted: boolean | null } | null> {
  const site = await readSite(env);
  if (!site) return null;
  const claim = await claimSite(tier, documentId);
  if (claim && refusedByService(claim)) return { claim: null, counted: site.counted };
  const next = markOfClaim(claim);
  if (next === null || next === site.counted) return { claim, counted: site.counted };
  await setSiteCounted(env, next);
  return { claim, counted: next };
}

/** The room's tier with its limits current, or null with Pro off: nothing is counted. */
async function roomTierOn(tier: ItemTier): Promise<ItemTier | null> {
  if (!tier.on) return null;
  if (!tier.fresh()) await tier.refresh();
  return tier;
}

/** The knowledgebase's daily upkeep: its site counted again. Never throws. */
export async function syncSiteGauge(
  env: DocumentEnv,
  tier: ItemTier,
  documentId: string,
): Promise<void> {
  try {
    const on = await roomTierOn(tier);
    if (on) await countSite(env, on, documentId);
  } catch (error) {
    console.warn('[publishing] gauge.sync.failed', { error: String(error) });
  }
}

type Sql = { exec(query: string, ...binds: unknown[]): { toArray(): Record<string, unknown>[] } };

// The site's mark, read straight from the room's SQLite (its own paths, which hold no env): undefined with no site.
function storedMark(sql: Sql): boolean | null | undefined {
  const row = sql.exec('SELECT counted FROM published_site WHERE id = 1').toArray()[0];
  if (!row) return undefined;
  return row.counted === null ? null : Number(row.counted) === 1;
}

/** The knowledgebase is going for good: its place given back before its storage is dropped. Never throws. */
export async function leaveSiteGauge(tier: ItemTier, sql: Sql, documentId: string): Promise<void> {
  if (!tier.on) return;
  try {
    if (storedMark(sql) === undefined) return;
    if (!tier.fresh()) await tier.refresh();
    await releaseSite(tier, documentId);
  } catch (error) {
    console.warn('[publishing] gauge.leave.failed', { error: String(error) });
  }
}

/**
 * The knowledgebase moved to another owner (or team, or from a guest to the account they signed in to): its site
 * leaves `from`'s count (null: a guest's, which the service never held) and asks the new owner for a place. A site
 * the new owner has no place for holds none, so it answers nobody until it is published within their limit: a move
 * is never a way past it. One that held no place before stays as it was. Never throws.
 */
export async function moveSiteGauge(
  tier: ItemTier,
  sql: Sql,
  documentId: string,
  from: OwnerScope | null,
): Promise<void> {
  if (!tier.on) return;
  try {
    const mark = storedMark(sql);
    if (mark === undefined) return;
    if (from !== null) await releaseSite(tier, documentId, from);
    await tier.refresh();
    if (mark === false) return;
    const claim = await claimSite(tier, documentId);
    if (claim && refusedByService(claim)) return;
    const next = markOfClaim(claim);
    if (next !== null && next !== mark)
      sql.exec('UPDATE published_site SET counted = ? WHERE id = 1', next ? 1 : 0);
  } catch (error) {
    console.warn('[publishing] gauge.move.failed', { error: String(error) });
  }
}
