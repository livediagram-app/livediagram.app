// A document's release of a picture it no longer places (liveworkspace/docs/specs/006-media/media.md "Releases"):
// `POST /app/images/<id>/release?document=`. The caller's word that nothing else uses it is never enough: one
// statement deletes the row only while the image is claimed by that document in the calling app and no reference in
// any app names it (the document's own included, so its report must have dropped it first) and no unconfirmed
// reference does (a copy whose own report hasn't landed, "Unconfirmed references"), then the bytes go. Anything else is
// kept, with why, and the daily sweep stays the backstop.

import type { MediaApp, MediaReleaseKept, MediaReleaseResponse } from '@liveworkspace/media';
import type { Env } from './env';
import { getImage } from './images';

export async function releaseImage(
  env: Env,
  bucket: R2Bucket,
  app: MediaApp,
  id: string,
  document: string,
): Promise<MediaReleaseResponse> {
  const gone = await env.MEDIA_DB.prepare(
    `DELETE FROM images
      WHERE id = ?1 AND app = ?2 AND document = ?3
        AND NOT EXISTS (SELECT 1 FROM refs WHERE refs.image_id = ?1)
        AND NOT EXISTS (SELECT 1 FROM pending_refs WHERE pending_refs.image_id = ?1)
      RETURNING id`,
  )
    .bind(id, app, document)
    .all<{ id: string }>();
  if (gone.results.length === 0) {
    const reason = await keptBecause(env, app, id, document);
    console.info('[media] release kept', { app, id, reason });
    return { released: false, reason };
  }
  // The row first, as every delete here: a row must never outlive its bytes. A failed R2 delete leaves bytes no row
  // names (storage kept, never a broken picture).
  try {
    await bucket.delete(id);
  } catch (err) {
    console.error('[media] R2 delete failed after a release', { id }, err);
  }
  console.info('[media] released', { app, id });
  return { released: true };
}

// Why the delete above found nothing: read after it, so a row taken meanwhile reads as missing.
async function keptBecause(
  env: Env,
  app: MediaApp,
  id: string,
  document: string,
): Promise<MediaReleaseKept> {
  const row = await getImage(env, id);
  if (!row) return 'missing';
  if (row.app !== app || row.document !== document) return 'not_claimed';
  const confirmed = await env.MEDIA_DB.prepare(
    'SELECT 1 AS present FROM refs WHERE image_id = ? LIMIT 1',
  )
    .bind(id)
    .first<{ present: number }>();
  return confirmed ? 'referenced' : 'unconfirmed';
}
