// Which pictures a plan's cards hold, told to liveworkspace's media service (docs/specs/026-plan/items.md "Images in
// use"; liveworkspace/docs/specs/006-media/media.md "References"), so its daily sweep never takes a picture in use and
// can take one no card holds any more. The set is every picture in a card's Attachments, and every Image field value
// the plan holds a grant for (image-grants.ts).
//
// The plan's triggers (IMAGE_REFS_SCHEMA) queue one `images` key in the outbox on a card write that could change the
// set: a card made, changed or deleted while the plan holds a grant or the card holds attachments. The outbox's drain
// (plan-outbox.ts) works the set out and sends it only when it differs from the last one sent (`media_refs`), so a
// busy board costs one read a minute at most and a send only when its pictures change.

import { MEDIA_REFS_SYNC_MAX } from '@liveworkspace/media';
import { mediaClient } from '../media';
import type { PlanEnv } from '../types';

// The outbox kind, beside the index's (tab, summary, edit).
export const IMAGES_OUTBOX_KIND = 'images';

// Its own schema step (plan-schema.ts V11). Every statement is IF NOT EXISTS, so it runs again harmlessly. Its last
// statement queues a report for a plan that already holds a grant (Image fields uploaded before this step), so their
// pictures are counted on the plan's first wake.
//
// The trigger's LIKE is a prefilter on the JSON text (a description naming "attachments" queues a drain that finds
// nothing new); the grant check is a key lookup.
export const IMAGE_REFS_SCHEMA = `
CREATE TABLE IF NOT EXISTS media_refs (
  plan_id TEXT NOT NULL PRIMARY KEY,
  images  TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS outbox_images_insert AFTER INSERT ON items
WHEN NEW.fields LIKE '%"attachments"%'
  OR EXISTS (SELECT 1 FROM card_image_grants WHERE plan_id = NEW.plan_id)
BEGIN
  DELETE FROM outbox WHERE plan_id = NEW.plan_id AND kind = 'images' AND key = '';
  INSERT INTO outbox (plan_id, kind, key) VALUES (NEW.plan_id, 'images', '');
END;
CREATE TRIGGER IF NOT EXISTS outbox_images_update AFTER UPDATE OF fields ON items
WHEN NEW.fields LIKE '%"attachments"%' OR OLD.fields LIKE '%"attachments"%'
  OR EXISTS (SELECT 1 FROM card_image_grants WHERE plan_id = NEW.plan_id)
BEGIN
  DELETE FROM outbox WHERE plan_id = NEW.plan_id AND kind = 'images' AND key = '';
  INSERT INTO outbox (plan_id, kind, key) VALUES (NEW.plan_id, 'images', '');
END;
CREATE TRIGGER IF NOT EXISTS outbox_images_delete AFTER DELETE ON items
WHEN OLD.fields LIKE '%"attachments"%'
  OR EXISTS (SELECT 1 FROM card_image_grants WHERE plan_id = OLD.plan_id)
BEGIN
  DELETE FROM outbox WHERE plan_id = OLD.plan_id AND kind = 'images' AND key = '';
  INSERT INTO outbox (plan_id, kind, key) VALUES (OLD.plan_id, 'images', '');
END;
INSERT OR IGNORE INTO outbox (plan_id, kind, key)
  SELECT plan_id, 'images', '' FROM card_image_grants LIMIT 1;
`;

// The query: ?1 the plan.
export const PLACED_IMAGES_SQL = `SELECT id FROM (
       SELECT json_extract(a.value, '$.id') AS id
         FROM items, json_each(items.fields, '$.attachments') AS a
        WHERE items.plan_id = ?1 AND items.fields LIKE '%"attachments"%'
       UNION
       SELECT f.value AS id
         FROM items, json_each(items.fields) AS f
        WHERE items.plan_id = ?1
          AND EXISTS (SELECT 1 FROM card_image_grants WHERE plan_id = ?1)
          AND f.type = 'text'
          AND f.value IN (SELECT image_id FROM card_image_grants WHERE plan_id = ?1)
     ) WHERE typeof(id) = 'text' ORDER BY id`;

// The pictures the plan's cards hold now, sorted: each Attachments entry's id (only cards whose JSON names the field
// are parsed), and each text field value the plan holds a grant for (read only when it holds any).
export async function placedImageIds(env: PlanEnv, planId: string): Promise<string[]> {
  const rows = await env.PLAN_DB.prepare(PLACED_IMAGES_SQL).bind(planId).all<{ id: string }>();
  return rows.results.map((r) => r.id);
}

async function lastSent(env: PlanEnv, planId: string): Promise<string | null> {
  const row = await env.PLAN_DB.prepare('SELECT images FROM media_refs WHERE plan_id = ?')
    .bind(planId)
    .first<{ images: string }>();
  return row?.images ?? null;
}

// Report the plan's set when it changed since the last report. Answers whether it sent one. Without the media
// service there is nobody to tell (the key is done). Throws when the service refuses, so the drain keeps the key and
// retries.
export async function pushImageRefs(env: PlanEnv, planId: string): Promise<boolean> {
  const media = mediaClient(env);
  if (!media) return false;
  const images = await placedImageIds(env, planId);
  const set = JSON.stringify(images);
  const before = await lastSent(env, planId);
  // Never sent and nothing to say: a plan that never held a picture tells the service nothing.
  if (set === (before ?? '[]')) return false;
  if (images.length > MEDIA_REFS_SYNC_MAX) {
    // Past what one sync carries for a plan. Sending part of the set would drop the rest's references, so it
    // sends nothing: the service keeps what it last had for the plan, and each upload's own claim, and the sweep
    // takes nothing of this plan's until it is back under the cap.
    console.error('[media] a plan holds more pictures than one sync carries; not reported', {
      planId,
      images: images.length,
    });
    return false;
  }
  // Never `complete`: plans report one by one as they wake, so liveplanner never knows it has sent every plan. Each
  // picture is claimed for its plan at upload instead, so a plan that has not reported keeps all of its pictures
  // (liveworkspace/docs/specs/006-media/media.md "References").
  const sent = await media.syncRefs({ documents: [{ document: planId, images }] });
  if (!sent.ok) throw new Error(`media refs sync failed: ${sent.status}`);
  await env.PLAN_DB.prepare(
    `INSERT INTO media_refs (plan_id, images) VALUES (?, ?)
       ON CONFLICT (plan_id) DO UPDATE SET images = excluded.images`,
  )
    .bind(planId, set)
    .run();
  return true;
}

// A purged plan holds nothing: the service is told so, when it was ever told the plan held something. `images` is
// what was last sent (read before the purge drops the table). Without the service there is nobody to tell.
export async function forgetImageRefs(
  env: Pick<PlanEnv, 'MEDIA_KEY' | 'MEDIA_URL'>,
  planId: string,
  images: string | null,
): Promise<void> {
  const media = mediaClient(env);
  if (!media || images === null || images === '[]') return;
  const sent = await media.syncRefs({ documents: [{ document: planId, images: [] }] });
  if (!sent.ok) throw new Error(`media refs sync failed: ${sent.status}`);
}
