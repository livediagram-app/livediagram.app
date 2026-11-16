// A message's attachments as a card's (docs/specs/026-plan/email-to-board.md "What a message makes"): each picture of
// up to INTAKE_PICTURE_MAX uploaded to the media service as the plan owner's, for the plan, and granted to it; the
// rest listed and dropped. The bytes decide what a file is, not its declared type.
import type { InboundAttachment } from '@liveworkspace/email/inbound';
import { MAX_IMAGE_BYTES, imageDimensions, sniffImageType } from '@liveworkspace/media';
import { ITEM_ATTACHMENTS_MAX, attachmentName, type ItemAttachment } from '@liveplanner/items';
import { mediaClient, mediaOwner, rememberMediaOwner } from '../media';
import type { Env } from '../types';
import type { DroppedAttachment } from './intake-card';

export const INTAKE_PICTURE_MAX = MAX_IMAGE_BYTES;

export type AttachedPictures = { attached: ItemAttachment[]; dropped: DroppedAttachment[] };

/** The attachments uploaded and those left off, in the message's order. */
export async function attachPictures(
  env: Pick<Env, 'MEDIA_KEY' | 'MEDIA_URL'>,
  plan: { id: string; ownerId: string },
  attachments: readonly InboundAttachment[],
  grant: (imageId: string) => void,
): Promise<AttachedPictures> {
  const media = mediaClient(env);
  const out: AttachedPictures = { attached: [], dropped: [] };
  const owner = attachments.length > 0 ? await mediaOwner(plan.ownerId) : '';
  for (const a of attachments) {
    const name = attachmentName(a.name);
    const size = a.bytes.byteLength;
    const drop = (reason: DroppedAttachment['reason']) => out.dropped.push({ name, size, reason });
    const type = sniffImageType(a.bytes);
    if (!type) {
      drop('not_picture');
      continue;
    }
    if (size > INTAKE_PICTURE_MAX) {
      drop('too_big');
      continue;
    }
    if (out.attached.length >= ITEM_ATTACHMENTS_MAX) {
      drop('too_many');
      continue;
    }
    if (!media || size === 0) {
      drop('not_saved');
      continue;
    }
    const dims = imageDimensions(a.bytes, type);
    try {
      const uploaded = await media.upload({
        owner,
        // A copy the upload owns, as its own ArrayBuffer.
        bytes: a.bytes.slice().buffer,
        contentType: type,
        byteSize: size,
        width: dims?.width ?? 0,
        height: dims?.height ?? 0,
        originalName: name,
        sha256: null,
        source: null,
        document: plan.id,
      });
      if (!uploaded.ok) {
        console.info('[email-intake] picture.refused', { status: uploaded.status });
        drop('not_saved');
        continue;
      }
      const { image } = uploaded.value;
      rememberMediaOwner(image.id, owner);
      grant(image.id);
      out.attached.push({ id: image.id, name, size, type });
    } catch (error) {
      console.warn('[email-intake] picture.failed', { error: String(error) });
      drop('not_saved');
    }
  }
  return out;
}
