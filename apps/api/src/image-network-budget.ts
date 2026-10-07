// The per-network daily image budget on POST /api/images
// (docs/specs/009-elements/images.md "Per-network daily budget"; blueprint step 7a, 15, I6).
//
// The per-owner gallery caps bound one identity, and identities are cheap: a
// guest id costs one mint, and before guest signature enforcement any made-up
// id works. So uploads are also counted per caller network per UTC day, which
// no amount of identity rotation changes.

import { clientRateKey } from './client-ip';
import {
  networkUploadKey,
  networkUploadUsage,
  recordNetworkUpload,
  secondsToNextUtcDay,
  utcDay,
} from './db';
import { json } from './responses';
import type { Env } from './types';

export type NetworkBudget = { maxImages: number | null; maxBytes: number | null };

// The budget a stored upload is checked against, and how to record it after.
export type NetworkBudgetCheck = {
  refused: Response | null;
  record: (storedBytes: number) => Promise<void>;
};

const NOTHING_TO_RECORD = async () => {};

export async function checkNetworkBudget(
  env: Env,
  request: Request,
  budget: NetworkBudget,
  incomingBytes: number,
  now = Date.now(),
): Promise<NetworkBudgetCheck> {
  if (budget.maxImages === null && budget.maxBytes === null) {
    return { refused: null, record: NOTHING_TO_RECORD };
  }
  const day = utcDay(now);
  let key: string;
  try {
    key = await networkUploadKey(env, clientRateKey(request));
    const usage = await networkUploadUsage(env, key, day);
    const reason =
      budget.maxImages !== null && usage.images >= budget.maxImages
        ? 'count'
        : budget.maxBytes !== null && usage.bytes + incomingBytes > budget.maxBytes
          ? 'bytes'
          : null;
    if (reason) {
      console.warn('[images] network budget reached', { reason });
      const retryAfter = secondsToNextUtcDay(now);
      return {
        refused: json(
          {
            error: 'upload_limit_reached',
            reason,
            limit: reason === 'count' ? budget.maxImages : budget.maxBytes,
            current: reason === 'count' ? usage.images : usage.bytes,
            retryAfter,
          },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } },
        ),
        record: NOTHING_TO_RECORD,
      };
    }
  } catch (error) {
    // Best effort: a budget that can't be read never blocks a real upload.
    console.warn('[images] network budget unavailable', { error: String(error) });
    return { refused: null, record: NOTHING_TO_RECORD };
  }
  return {
    refused: null,
    record: (storedBytes) =>
      recordNetworkUpload(env, key, day, storedBytes).catch((error: unknown) => {
        console.warn('[images] network budget unavailable', { error: String(error) });
      }),
  };
}
