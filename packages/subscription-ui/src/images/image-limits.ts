// An image upload's tier limits as a page reads them (liveworkspace/docs/specs/006-media/media.md "With Pro on"). The
// numbers are the server's: a refusal's `limit`, the gallery's `storage`. Nothing here decides what a person may
// send; the one number of its own is the ceiling, the most any tier takes, which only stops a file no tier would.
import {
  formatBytes,
  IMAGE_MAX_BYTES_ANY_TIER,
  isOwnerScope,
  type OwnerScope,
} from '@liveworkspace/subscription';
import { proOn } from '../flag';

/** What the server said when it refused an upload for a tier's limit. */
export type ImageLimitRefusal = {
  /** `too_large`: the file is over Largest Image. `storage_full`: Image Storage has no room for it. */
  kind: 'too_large' | 'storage_full';
  limit: number;
  /** The file's size, or what the gallery holds; null where the server could not say. */
  current: number | null;
  /** The scope whose tier set the limit, for the offer; null for a guest. */
  owner: OwnerScope | null;
};

/** What a gallery uses of its owner's Image Storage, as the list route answers it with Pro on. */
export type ImageStorage = {
  used: number;
  limit: number;
  maxImageBytes: number;
  owner: OwnerScope | null;
};

const record = (value: unknown): Record<string, unknown> | null => {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
};

/**
 * The tier limit a refused upload met, from the refusal's body (an object, or its JSON text), or null when it is not
 * one: any other refusal, a refusal from a server with Pro off (which names no `owner`), or Pro off in this build.
 */
export function imageLimitRefusalOf(body: unknown): ImageLimitRefusal | null {
  if (!proOn()) return null;
  const refusal = record(body);
  if (!refusal || typeof refusal.limit !== 'number' || !('owner' in refusal)) return null;
  const kind =
    refusal.error === 'file_too_large'
      ? 'too_large'
      : refusal.error === 'gallery_full' && refusal.reason === 'bytes'
        ? 'storage_full'
        : null;
  if (kind === null) return null;
  return {
    kind,
    limit: refusal.limit,
    current: typeof refusal.current === 'number' ? refusal.current : null,
    owner: isOwnerScope(refusal.owner) ? refusal.owner : null,
  };
}

/** The gallery's storage from a list answer's `storage`, or null: Pro off, or not the shape. */
export function imageStorageOf(value: unknown): ImageStorage | null {
  if (!proOn()) return null;
  const storage = record(value);
  if (
    !storage ||
    typeof storage.used !== 'number' ||
    typeof storage.limit !== 'number' ||
    typeof storage.maxImageBytes !== 'number'
  ) {
    return null;
  }
  return {
    used: storage.used,
    limit: storage.limit,
    maxImageBytes: storage.maxImageBytes,
    owner: isOwnerScope(storage.owner) ? storage.owner : null,
  };
}

/** The largest image any tier takes: its own small module, so the Explorer's first load carries no limits table. */
export const IMAGE_UPLOAD_CEILING_BYTES = IMAGE_MAX_BYTES_ANY_TIER;

/**
 * The size a page stops a picked file at before sending it. With Pro off it is the app's own cap, as it always was.
 * With Pro on it is the ceiling: what this person may send is the server's to say, from their entitlement.
 */
export function imageUploadCeiling(legacyBytes: number): number {
  return proOn() ? Math.max(legacyBytes, IMAGE_UPLOAD_CEILING_BYTES) : legacyBytes;
}

/**
 * The drop zone's line about what it takes. With Pro off: "PNG, JPEG, WebP or GIF up to 10 MB". With Pro on the size
 * is the server's (`maxImageBytes`, from the gallery's storage) or, until it is known, left out.
 */
export function imageSizeHint(
  typesLabel: string,
  legacyMb: number,
  maxImageBytes?: number | null,
): string {
  if (!proOn()) return `${typesLabel} up to ${legacyMb} MB`;
  return typeof maxImageBytes === 'number'
    ? `${typesLabel} up to ${formatBytes(maxImageBytes)}`
    : typesLabel;
}

/** The cap a "too large" line names for a file stopped before it is sent: the app's own with Pro off ("10 MB"), the
 *  ceiling with Pro on ("25 MB"). */
export function imageCeilingLabel(legacyMb: number): string {
  return proOn() ? formatBytes(IMAGE_UPLOAD_CEILING_BYTES) : `${legacyMb} MB`;
}

/** A file stopped before it is sent for being over the cap: the app's own words with Pro off ("Too large. Limit is
 *  10 MB."), and with Pro on the ceiling every tier shares, said so no upgrade is hinted at ("That image is over
 *  25 MB, the largest that can be uploaded."). */
export function imageTooLargeSentence(legacyMb: number): string {
  return proOn()
    ? `That image is over ${formatBytes(IMAGE_UPLOAD_CEILING_BYTES)}, the largest that can be uploaded.`
    : `Too large. Limit is ${legacyMb} MB.`;
}

/** A tier's refusal in one plain sentence, for a toast or a line where the notice is not drawn (a paste or a drop on
 *  the canvas): the limit the server said, and no offer. */
export function imageLimitSentence(refusal: ImageLimitRefusal): string {
  return refusal.kind === 'too_large'
    ? `This image is over ${formatBytes(refusal.limit)}, the largest that can be uploaded here.`
    : 'Image storage is full. Delete some images to upload more.';
}

/**
 * The query an editor's upload carries: the item the picture is for, so the app's api can read its owner's tier
 * beside the uploader's (media.md "Who pays"). Only with Pro on; with it off the upload's address is as it was.
 */
export function imageUploadQuery(itemId: string | null | undefined): string {
  return proOn() && itemId ? `?d=${encodeURIComponent(itemId)}` : '';
}
