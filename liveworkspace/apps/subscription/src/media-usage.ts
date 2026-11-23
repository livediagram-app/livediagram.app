// What media holds for an owner (subscription.md "Meters"): Image Storage and Walkthroughs Stored. Media counts both
// live, in the same tables it enforces them from, so this Worker keeps no copy that could drift: it asks media, in
// one call for every owner, when a person reads their usage. Media knows the caller by the key the two already
// share (this Worker's SUBSCRIPTION_KEY_LIVEWORKSPACE is media's SUBSCRIPTION_KEY).

import {
  MEDIA_COUNTS,
  MEDIA_USAGE_CALLER,
  MEDIA_USAGE_CALLER_HEADER,
  MEDIA_USAGE_OWNERS_MAX,
  type MediaCount,
  type OwnerScope,
  type Usage,
} from '@liveworkspace/subscription';
import { SERVICE_CALL_TIMEOUT_MS } from './config';
import { appKey, mediaUrl, type Env } from './env';

export type MediaUsage = Map<OwnerScope, Record<MediaCount, number>>;

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

type Fetcher = { fetch: (input: string, init?: RequestInit) => Promise<Response> };
const PUBLIC: Fetcher = { fetch: (input, init) => fetch(input, init) };

/** Media's answer through one door, or a throw: no answer in time, a failure on the way, or a status that is not OK. */
async function ask(door: Fetcher, env: Env, key: string, owners: OwnerScope[]): Promise<unknown> {
  const response = await door.fetch(`${mediaUrl(env)}/app/usage/owners`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      [MEDIA_USAGE_CALLER_HEADER]: MEDIA_USAGE_CALLER,
    },
    body: JSON.stringify({ owners }),
    signal: AbortSignal.timeout(SERVICE_CALL_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`media answered ${response.status}`);
  return ((await response.json()) as { usage?: unknown }).usage;
}

/**
 * What media holds for each of `owners` (the first 60), or null when it could not say: no shared key, media out of
 * reach or slow, or an answer that is not one. Asked through the service binding, and through the public route when
 * there is none or it fails (a local run, where the binding names a Worker that is not there). An owner media holds
 * nothing for reads 0. Never throws.
 */
export async function mediaUsage(
  env: Env,
  owners: readonly OwnerScope[],
): Promise<MediaUsage | null> {
  const key = appKey(env, 'liveworkspace.app');
  if (!key) return null;
  const asked = [...new Set(owners)].slice(0, MEDIA_USAGE_OWNERS_MAX);
  try {
    const usage = env.MEDIA
      ? await ask(env.MEDIA, env, key, asked).catch(() => ask(PUBLIC, env, key, asked))
      : await ask(PUBLIC, env, key, asked);
    if (typeof usage !== 'object' || usage === null) throw new Error('media answered no usage');
    const held: MediaUsage = new Map();
    for (const owner of asked) {
      const counts = (usage as Record<string, Partial<Record<MediaCount, unknown>> | undefined>)[
        owner
      ];
      const imageStorageBytes = counts?.imageStorageBytes;
      const walkthroughsStored = counts?.walkthroughsStored;
      held.set(owner, {
        imageStorageBytes: isCount(imageStorageBytes) ? imageStorageBytes : 0,
        walkthroughsStored: isCount(walkthroughsStored) ? walkthroughsStored : 0,
      });
    }
    return held;
  } catch (error) {
    console.warn('[subscription] media usage not read', { error: String(error) });
    return null;
  }
}

/** An owner's usage with what media holds for them. Left as it is when media could not say. */
export function withMediaUsage(usage: Usage, owner: OwnerScope, held: MediaUsage | null): Usage {
  const counts = held?.get(owner);
  if (!counts) return usage;
  return {
    ...usage,
    ...Object.fromEntries(MEDIA_COUNTS.map((count) => [count, { used: counts[count] }])),
  };
}
