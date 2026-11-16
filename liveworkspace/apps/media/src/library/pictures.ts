// A library item's pictures, copied under the team's grant (liveworkspace/docs/specs/006-media/libraries.md
// "Pictures"): saved to a team, the saver's own pictures are copied into the team's gallery (`team:<id>`); placed from
// a team, the team's pictures are copied into the placer's. A copy is an ordinary image row of the new owner, deduped on
// the bytes' hash like any upload, under the same caps.

import type { MediaApp } from '@liveworkspace/media';
import { parsePositiveCap, type Env } from '../env';
import { findBySha, getImage, insertImage, type Caps, type ImageRow } from '../images';

export type CopyOutcome = { copies: Map<string, string> } | { full: true };

// Copies each of `ids` that `from` owns into `to`'s gallery; an id `from` doesn't own, or that is gone, is left as it
// is. Answers each copied id's copy, or `full` when `to`'s gallery can't take one.
export async function copyPictures(
  env: Env,
  bucket: R2Bucket,
  app: MediaApp,
  ids: readonly string[],
  from: string,
  to: string,
): Promise<CopyOutcome> {
  const copies = new Map<string, string>();
  const caps: Caps = {
    maxImages: parsePositiveCap(env.IMAGE_MAX_PER_OWNER),
    maxBytes: parsePositiveCap(env.IMAGE_MAX_BYTES_PER_OWNER),
  };
  for (const id of ids) {
    const row = await getImage(env, id);
    if (!row || row.owner !== from) continue;
    const copy = await copyOne(env, bucket, app, row, to, caps);
    if (copy === 'full') return { full: true };
    if (copy) copies.set(id, copy);
  }
  return { copies };
}

async function copyOne(
  env: Env,
  bucket: R2Bucket,
  app: MediaApp,
  row: ImageRow,
  to: string,
  caps: Caps,
): Promise<string | null | 'full'> {
  const held = await findBySha(env, to, row.sha256);
  if (held) return held.id;
  const object = await bucket.get(row.id);
  if (!object) {
    console.warn('[library] picture bytes missing', { id: row.id });
    return null;
  }
  const bytes = await object.arrayBuffer();
  const id = crypto.randomUUID();
  await bucket.put(id, bytes, {
    httpMetadata: { contentType: row.content_type },
    customMetadata: { owner: to, app },
  });
  const image = await insertImage(
    env,
    { ...row, id, owner: to, app, document: null, source: row.source },
    caps,
  ).catch(async (err: unknown) => {
    await bucket.delete(id);
    throw err;
  });
  if (image) return image.id;
  await bucket.delete(id);
  // The same bytes landed for `to` at the same moment: theirs is the copy. Else the gallery is full.
  const raced = await findBySha(env, to, row.sha256);
  return raced ? raced.id : 'full';
}
