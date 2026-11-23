// What several owners hold, for the subscription service (liveworkspace/docs/specs/006-media/media.md "With Pro on",
// "What Subscription shows"): each one's pictures' bytes and how many walkthroughs they keep, counted here, live, from
// the same rows the caps are enforced on. The subscription service keeps no copy, so what a person is shown can never
// drift from what an upload meets, whatever changed the rows (an upload, a delete, a release, the sweeps, a copy, a
// guest's merge, an account's deletion).

import { timingSafeEqual } from '@liveworkspace/index-app/timing-safe';
import { MEDIA_APP_HEADER } from '@liveworkspace/media';
import {
  isOwnerScope,
  MEDIA_USAGE_CALLER,
  MEDIA_USAGE_OWNERS_MAX,
  parseOwnerScope,
  proEnabled,
  type MediaUsageResponse,
  type OwnerScope,
} from '@liveworkspace/subscription';
import type { Env } from './env';
import { badRequest, json, notFound } from './http';

/**
 * Whether a request is the subscription service's: it names itself (X-Media-App: subscription) and carries the key
 * the two Workers already share, this Worker's SUBSCRIPTION_KEY. Never with Pro off, or without the key.
 */
export async function isSubscriptionCaller(request: Request, env: Env): Promise<boolean> {
  if (request.headers.get(MEDIA_APP_HEADER) !== MEDIA_USAGE_CALLER) return false;
  const expected = env.SUBSCRIPTION_KEY?.trim();
  const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!proEnabled(env.PRO_ENABLED) || !expected || !token) return false;
  return timingSafeEqual(token, expected);
}

/** The media owner a subscription scope's pictures and walkthroughs are kept under: an account's own id, or a
 *  team's gallery (`team:<id>`, libraries.md "Pictures"). */
function mediaOwnerOf(scope: OwnerScope): string | null {
  const parsed = parseOwnerScope(scope);
  if (!parsed) return null;
  return parsed.kind === 'team' ? `team:${parsed.id}` : parsed.id;
}

/** `POST /app/usage/owners` `{ owners }`: one batch of two indexed reads for all of them. Anything else is missing. */
export async function handleOwnersUsage(
  request: Request,
  env: Env,
  path: string,
  body: unknown,
): Promise<Response> {
  if (request.method !== 'POST' || path !== '/usage/owners') return notFound();
  const owners = (body as { owners?: unknown } | undefined)?.owners;
  if (
    !Array.isArray(owners) ||
    owners.length === 0 ||
    owners.length > MEDIA_USAGE_OWNERS_MAX ||
    !owners.every(isOwnerScope)
  ) {
    return badRequest('invalid_owners');
  }
  const scopeOf = new Map<string, OwnerScope>();
  for (const scope of owners as OwnerScope[]) {
    const owner = mediaOwnerOf(scope);
    if (owner) scopeOf.set(owner, scope);
  }
  const ids = [...scopeOf.keys()];
  const marks = ids.map(() => '?').join(', ');
  const [images, walkthroughs] = await env.MEDIA_DB.batch<{ owner: string; held: number }>([
    env.MEDIA_DB.prepare(
      `SELECT owner, COALESCE(SUM(byte_size), 0) AS held FROM images WHERE owner IN (${marks}) GROUP BY owner`,
    ).bind(...ids),
    env.MEDIA_DB.prepare(
      `SELECT owner, COUNT(*) AS held FROM walkthroughs WHERE owner IN (${marks}) GROUP BY owner`,
    ).bind(...ids),
  ]);
  const usage: MediaUsageResponse['usage'] = {};
  const entry = (owner: string) => {
    const scope = scopeOf.get(owner)!;
    return (usage[scope] ??= { imageStorageBytes: 0, walkthroughsStored: 0 });
  };
  for (const row of images!.results) entry(row.owner).imageStorageBytes = row.held;
  for (const row of walkthroughs!.results) entry(row.owner).walkthroughsStored = row.held;
  const answer: MediaUsageResponse = { usage };
  return json(answer);
}
