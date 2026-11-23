// The tier's retention of a document's automatic versions (docs/specs/006-document/version-history.md "With Pro on";
// blueprint VH25): read from the owner's entitlement and written to the row the prune trigger reads
// (version-retention-schema.ts). With PRO_ENABLED off none of this asks or writes anything on a request, and the row
// holds the bounds every document always had. A save never comes here: the room learns the tier at most once an hour,
// off the request's path, and whenever Version History lists a tab.

import {
  VERSION_AUTO_MAX,
  VERSION_AUTO_MAX_BYTES,
  VERSION_AUTO_MAX_BYTES_PAID,
  VERSION_AUTO_MAX_PAID,
  type VersionRetentionInfo,
} from '@livedocuments/api-schema';
import { knownItemOwnerScope } from '@liveworkspace/media';
import {
  limitsFor,
  proEnabled,
  subscriptionClientOf,
  type OwnerScope,
} from '@liveworkspace/subscription';
import type { DocumentRouteContext } from '../routes/context';
import type { DocumentEnv } from '../types';
import { VERSION_RETENTION_LEGACY, type VersionRetention } from './version-retention-schema';

const DAY_MS = 24 * 60 * 60 * 1000;
/** How often a room asks again what its owner's tier keeps, as requests arrive. */
export const VERSION_RETENTION_CHECK_MS = 60 * 60 * 1000;

/** A tier's row from its History limit: a tier that keeps history for a time keeps the bounds every tab had, for
 *  that long; one with no age limit keeps far more, behind safety caps. */
export function versionRetentionOf(historyDays: number | null): VersionRetention {
  return historyDays === null
    ? { maxAgeMs: null, maxCount: VERSION_AUTO_MAX_PAID, maxBytes: VERSION_AUTO_MAX_BYTES_PAID }
    : {
        maxAgeMs: historyDays * DAY_MS,
        maxCount: VERSION_AUTO_MAX,
        maxBytes: VERSION_AUTO_MAX_BYTES,
      };
}

export async function writeVersionRetention(
  env: DocumentEnv,
  retention: VersionRetention,
): Promise<void> {
  await env.DOCUMENT_DB.prepare(
    `INSERT INTO version_retention (id, max_age_ms, max_count, max_bytes) VALUES (1, ?1, ?2, ?3)
       ON CONFLICT (id) DO UPDATE SET max_age_ms = ?1, max_count = ?2, max_bytes = ?3
       WHERE max_age_ms IS NOT ?1 OR max_count IS NOT ?2 OR max_bytes IS NOT ?3`,
  )
    .bind(retention.maxAgeMs, retention.maxCount, retention.maxBytes)
    .run();
}

/** How old an automatic version may be, as the document's row now holds it: null is no age limit. */
export async function versionMaxAgeMs(env: DocumentEnv): Promise<number | null> {
  const held = await env.DOCUMENT_DB.prepare(
    'SELECT max_age_ms FROM version_retention WHERE id = 1',
  ).first<{
    max_age_ms: number | null;
  }>();
  return held ? held.max_age_ms : VERSION_RETENTION_LEGACY.maxAgeMs;
}

/**
 * The owner's tier's retention, written to the document's row, and what the rail is told of it. Null, with nothing
 * written, where there is no tier to apply: Pro off, an owner the grant does not name, or a subscription service that
 * cannot say with nothing remembered. Pruning cannot be undone, so only a tier the service confirmed is written. A
 * guest's document (`owner` null) is Free.
 */
export async function applyVersionRetention(
  env: DocumentEnv,
  owner: OwnerScope | null | undefined,
): Promise<VersionRetentionInfo | null> {
  const client = subscriptionClientOf(env, 'livedocuments.app');
  if (!client.enabled || owner === undefined) return null;
  const entitlement = owner === null ? null : await client.confirmedEntitlement(owner);
  if (entitlement === 'unknown') return null;
  const days = (entitlement?.limits ?? limitsFor('free')).historyDays;
  await writeVersionRetention(env, versionRetentionOf(days));
  return { days, owner };
}

/** With Pro off the row is the bounds every document had: the daily upkeep's first step, so a deployment that turns
 *  Pro off again goes back to them without a request ever paying for it. */
export async function settleVersionRetention(env: DocumentEnv): Promise<void> {
  if (!proEnabled(env.PRO_ENABLED)) await writeVersionRetention(env, VERSION_RETENTION_LEGACY);
}

// When each room last asked, by its database handle (a room keeps one for its life).
const askedAt = new WeakMap<object, number>();

/** The document's owner as the request's grant names them; undefined where it names nobody, or is not this
 *  document's. */
export function documentOwnerScope(ctx: DocumentRouteContext): OwnerScope | null | undefined {
  const documentId = ctx.segments[1] === 'documents' ? ctx.segments[2] : undefined;
  return knownItemOwnerScope(documentId && ctx.grant?.item === documentId ? ctx.grant : null);
}

/**
 * As a request reaches the room: the owner's tier's retention, learnt again when an hour has passed, after the
 * answer has gone. Nothing with Pro off; nothing for a request whose grant does not name this document's owner.
 */
export function learnVersionRetention(ctx: DocumentRouteContext, now = Date.now()): void {
  if (!proEnabled(ctx.env.PRO_ENABLED)) return;
  const owner = documentOwnerScope(ctx);
  if (owner === undefined) return;
  const last = askedAt.get(ctx.env.DOCUMENT_DB);
  if (last !== undefined && now - last < VERSION_RETENTION_CHECK_MS) return;
  askedAt.set(ctx.env.DOCUMENT_DB, now);
  const work = applyVersionRetention(ctx.env, owner).catch((error: unknown) => {
    // A document not made yet has no row to write; the next hour's request tries again.
    console.warn('[versions] retention not learnt', { error: String(error) });
  });
  if (ctx.waitUntil) ctx.waitUntil(work);
}
