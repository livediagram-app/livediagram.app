// livediagram's side of liveworkspace's media service (liveworkspace/docs/media.md). The images people upload
// live there, with their gallery, dedupe and caps; this api keeps its own access rules (who may read a
// document, which documents may serve whose image) and serves the bytes to the people they let in. Every call
// carries MEDIA_KEY as a bearer token and names this app.
//
// Each canvas keeps which images it places, whose they are and which it may serve in its own Durable Object
// (db/image-grants.ts), and tells the service its set as it changes (document-room/document-outbox.ts
// pushImageRefs).

import {
  createMediaClient,
  isGuestOwner,
  mediaGuestOwner,
  type MediaClient,
  type MediaImage,
} from '@liveworkspace/media';
import type { Env, ImageSummary } from './types';

export const MEDIA_APP = 'livediagram.app';

// The service, or null when this deploy has none (a deployment without the key): images are then off.
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

// The gallery row as this api has always answered it: the service's `app` stays out.
export function imageSummary({ app: _app, ...image }: MediaImage): ImageSummary {
  return image;
}

// Whose image `id` is, as this api names owners, or null when the service has no such image. `caller` is the
// person asking: a guest's own image comes back under their guest id, and anyone else's guest image under a name no
// owner here has, so it serves nowhere but through a canvas. The service's answer is remembered per isolate (an
// image's owner changes only when a guest signs up, and then to the account their own id already maps to), at most
// OWNERS_MAX images, oldest dropped first.
const OWNERS_MAX = 2_000;
const owners = new Map<string, string>();

export function clearMediaOwnersForTests(): void {
  owners.clear();
}

export async function mediaImageOwner(
  client: MediaClient,
  id: string,
  caller: string | null,
): Promise<string | null> {
  let owner = owners.get(id);
  if (owner === undefined) {
    owner = (await client.get(id))?.owner ?? '';
    rememberMediaOwner(id, owner);
  }
  if (isGuestOwner(owner) && caller !== null && owner === (await mediaOwner(caller))) return caller;
  return owner || null;
}

// An image the service just answered for, or one its owner deleted: remembered as the service now has it.
export function rememberMediaOwner(id: string, owner: string | null): void {
  if (owner === null) {
    owners.delete(id);
    return;
  }
  owners.set(id, owner);
  while (owners.size > OWNERS_MAX) {
    const oldest = owners.keys().next().value;
    if (oldest === undefined) break;
    owners.delete(oldest);
  }
}
