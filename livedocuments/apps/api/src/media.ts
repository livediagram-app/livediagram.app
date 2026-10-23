// livedocuments' side of liveworkspace's media service (liveworkspace/docs/media.md). The images people upload
// live there, with their gallery, dedupe and caps; this api keeps its own access rules (who may read a
// document, which documents may serve whose image) and serves the bytes to the people they let in. Every call
// carries MEDIA_KEY as a bearer token and names this app.
//
// Each document keeps which images it places, whose they are and which it may serve in its own Durable Object
// (db/image-refs.ts, db/image-grants.ts), and tells the service its set as it changes
// (document-room/document-outbox.ts pushImageRefs).

import {
  createMediaClient,
  mediaGuestOwner,
  type MediaClient,
  type MediaImage,
} from '@liveworkspace/media';
import type { Env, ImageSummary } from './types';

export const MEDIA_APP = 'livedocuments.app';

// The service, or null when this deploy has none (a self-host without the key): images are then off.
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

// Whose image `id` is, as the service names owners ('' for an id it does not know). Remembered per isolate
// (an image's owner changes only when a guest signs up, and then to the account their own id already maps to), at
// most OWNERS_MAX images, oldest dropped first: a gallery's owner reading their own images asks the service once
// each.
const OWNERS_MAX = 2_000;
const owners = new Map<string, string>();

export function clearMediaOwnersForTests(): void {
  owners.clear();
}

export async function mediaImageOwner(client: MediaClient, id: string): Promise<string> {
  const known = owners.get(id);
  if (known !== undefined) return known;
  const owner = (await client.get(id))?.owner ?? '';
  owners.set(id, owner);
  while (owners.size > OWNERS_MAX) {
    const oldest = owners.keys().next().value;
    if (oldest === undefined) break;
    owners.delete(oldest);
  }
  return owner;
}

// An image the service just answered for, or one its owner deleted: remembered as the service now has it.
export function rememberMediaOwner(id: string, owner: string | null): void {
  if (owner === null) owners.delete(id);
  else owners.set(id, owner);
}
