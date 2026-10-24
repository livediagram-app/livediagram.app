// liveplanner's side of liveworkspace's media service (liveworkspace/docs/media.md), which serves every app's
// previews (liveworkspace/docs/previews.md). liveplanner keeps no images there: the service draws a plan's
// preview through the export door (routes/internal-items.ts), and this api only tells it when a purged plan's
// previews can go. Every call carries MEDIA_KEY as a bearer token and names this app.

import { createMediaClient, type MediaClient } from '@liveworkspace/media';
import type { Env } from './types';

export const MEDIA_APP = 'liveplanner.app';

// The service, or null when this deploy has none (no MEDIA_KEY): previews are then off.
export function mediaClient(env: Pick<Env, 'MEDIA_KEY' | 'MEDIA_URL'>): MediaClient | null {
  if (!env.MEDIA_KEY) return null;
  return createMediaClient({ app: MEDIA_APP, key: env.MEDIA_KEY, url: env.MEDIA_URL });
}
