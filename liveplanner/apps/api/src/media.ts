// liveplanner's side of liveworkspace's media service (liveworkspace/docs/specs/006-media/media.md), which serves every app's
// previews (liveworkspace/docs/specs/006-media/previews.md) and keeps the images people upload. A plan's previews are
// drawn by the service through the export door (routes/internal-items.ts), and this api tells it when a purged plan's
// previews can go. The pictures of Image fields (docs/specs/026-plan/item-types.md "Image fields") live there too:
// routes/images.ts uploads them and keeps who may read them, each plan recording which it may serve in its own
// Durable Object (plan-room/image-grants.ts). Every call carries MEDIA_KEY as a bearer token and names this app.

import {
  createMediaClient,
  mediaGuestOwner,
  type MediaClient,
  type MediaImage,
} from '@liveworkspace/media';
import type { Env } from './types';

export const MEDIA_APP = 'liveplanner.app';

// The service, or null when this deploy has none (no MEDIA_KEY): previews and Image fields are then off.
export function mediaClient(env: Pick<Env, 'MEDIA_KEY' | 'MEDIA_URL'>): MediaClient | null {
  if (!env.MEDIA_KEY) return null;
  return createMediaClient({ app: MEDIA_APP, key: env.MEDIA_KEY, url: env.MEDIA_URL });
}

// The owner as the service knows them. An account id is the same in every app; a guest id is this app's
// credential and never leaves it, so the service gets a one-way hash of it instead. Account ids start
// `user_`, which request-auth refuses as a guest id.
export async function mediaOwner(owner: string): Promise<string> {
  return owner.startsWith('user_') ? owner : mediaGuestOwner(MEDIA_APP, owner);
}

// An uploaded image as this api answers it: the service's row without its `app`.
export type ImageSummary = Omit<MediaImage, 'app'>;

export function imageSummary({ app: _app, ...image }: MediaImage): ImageSummary {
  return image;
}

// Whose image `id` is, as the service names owners ('' for an id it does not know). Remembered per isolate
// (an image's owner changes only when a guest signs up, and then to the account their own id already maps to), at
// most OWNERS_MAX images, oldest dropped first: a board of pictures asks the service once per picture.
export const OWNERS_MAX = 2_000;
const owners = new Map<string, string>();

export function clearMediaOwnersForTests(): void {
  owners.clear();
}

export async function mediaImageOwner(client: MediaClient, id: string): Promise<string> {
  const known = owners.get(id);
  if (known !== undefined) return known;
  const owner = (await client.get(id))?.owner ?? '';
  rememberMediaOwner(id, owner);
  return owner;
}

// An image the service just answered for: remembered as the service now has it.
export function rememberMediaOwner(id: string, owner: string): void {
  owners.delete(id);
  owners.set(id, owner);
  while (owners.size > OWNERS_MAX) owners.delete(owners.keys().next().value!);
}
