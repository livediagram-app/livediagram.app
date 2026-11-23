// An app api's side of an image upload with Pro on (liveworkspace/docs/specs/006-media/media.md "With Pro on"): what
// the gate before the routes lets through unread, the largest image this caller may send, and a read of the body
// that never holds more than that. With PRO_ENABLED off each answers as the api always did: the 10 MB cap, nothing
// asked of the subscription service, and the body read whole.

import {
  imageAllowance,
  IMAGE_UPLOAD_CEILING_BYTES,
  itemOwnerScope,
  MAX_IMAGE_BYTES,
  type ImageAllowance,
  type MediaListResponse,
} from '@liveworkspace/media';
import {
  proEnabled,
  subscriptionClientOf,
  type SubscriptionApp,
  type SubscriptionEnv,
} from '@liveworkspace/subscription';
import { readCappedBody } from './request-body';

/** The outer bound on an image route's body, before the routes: the legacy cap, or with Pro on the most any tier
 *  takes (the route then holds the upload to the caller's own limit). */
export function imageGateBytes(env: Pick<SubscriptionEnv, 'PRO_ENABLED'>): number {
  return proEnabled(env.PRO_ENABLED) ? IMAGE_UPLOAD_CEILING_BYTES : MAX_IMAGE_BYTES;
}

/**
 * Whether the gate leaves this request's body unread: with Pro on, an upload (`POST /api/images`). Its route checks
 * the declared length against the caller's entitlement before a byte is read, and then reads no more than that, so
 * someone on Free never has 25 MB buffered for them. Everything else, and every request with Pro off, is read
 * through the gate's byte counter as before.
 */
export function leavesImageUploadUnread(
  env: Pick<SubscriptionEnv, 'PRO_ENABLED'>,
  method: string,
  segments: readonly string[],
): boolean {
  return (
    proEnabled(env.PRO_ENABLED) &&
    method === 'POST' &&
    segments[1] === 'images' &&
    segments.length === 2
  );
}

/** The index's grant on the item an upload is for, as far as this needs it. */
export type UploadItemGrant = {
  level: 'view' | 'participate' | 'edit';
  team: string | null;
  owner?: string | null;
  trashed?: boolean;
};

/**
 * The largest image `uploader` (a media owner) may send through `app`. `itemGrant` reads the caller's grant on the
 * item the upload is for (null when it is for none, or they hold none); it is only called with Pro on. An item the
 * caller can only view, or one in the Trash, lends them nothing: they cannot place a picture there.
 */
export function imageUploadAllowance(
  env: SubscriptionEnv,
  app: SubscriptionApp,
  uploader: string,
  itemGrant: () => Promise<UploadItemGrant | null>,
): Promise<ImageAllowance> {
  return imageAllowance(subscriptionClientOf(env, app), uploader, async () => {
    const grant = await itemGrant();
    if (!grant || grant.level === 'view' || grant.trashed) return null;
    return itemOwnerScope(grant);
  });
}

/**
 * An upload's body, or null when it is over what the caller may send. With Pro on it is read through a byte counter
 * that stops at the limit; with it off it is read whole, as the gate before the routes has already capped it.
 */
export async function readImageUpload(
  request: Request,
  allowance: Pick<ImageAllowance, 'pro' | 'maxBytes'>,
): Promise<ArrayBuffer | null> {
  if (!allowance.pro) {
    const bytes = await request.arrayBuffer();
    return bytes.byteLength > allowance.maxBytes ? null : bytes;
  }
  if (request.body === null) return new ArrayBuffer(0);
  const read = await readCappedBody(request.body as ReadableStream<Uint8Array>, allowance.maxBytes);
  if (read === null) return null;
  // A view over part of a larger buffer is copied out; one that is its whole buffer is handed on as it is.
  const whole = read.byteOffset === 0 && read.byteLength === read.buffer.byteLength;
  return (whole ? read.buffer : read.slice().buffer) as ArrayBuffer;
}

/** The gallery's storage as the service counted it, to pass on with an app's own list of images: with Pro on, what
 *  the owner's pictures use of their Image Storage, for the library's meter. Nothing with Pro off. */
export function galleryStorageOf(listed: MediaListResponse): Pick<MediaListResponse, 'storage'> {
  return listed.storage ? { storage: listed.storage } : {};
}
