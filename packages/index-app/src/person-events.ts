// Timeline events about a person rather than an item (docs/one-explorer-contracts.md "Timeline"): images
// uploaded, one entry per person, app and day whose count grows with each upload. Sent once per upload request,
// after the response (`waitUntil`), so an upload never waits on the index. Never throws: a report the index
// didn't take is only a smaller count.

import type { IndexAppClient } from '@liveworkspace/index-client';

/**
 * Reports `count` images uploaded by `actorId` now. Pass `indexService.appClient(env)`; null (no index
 * configured) or a count under one reports nothing. A deduped upload (the same bytes again) is not news:
 * leave it out of `count`.
 */
export async function reportImagesUploaded(
  client: Pick<IndexAppClient, 'pushPersonEvents'> | null,
  actorId: string,
  count = 1,
  at = Date.now(),
): Promise<void> {
  if (!client || !actorId || !(count >= 1)) return;
  try {
    await client.pushPersonEvents([
      { type: 'image_uploaded', actorId, at, count: Math.floor(count) },
    ]);
  } catch (error) {
    console.warn('[index-app] images_report_failed', { error: String(error) });
  }
}
