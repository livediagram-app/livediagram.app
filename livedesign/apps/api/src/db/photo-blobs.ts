// The photo blob store (docs/specs/031-photo/photo-store.md "What is stored where"): a photo page's tiles,
// sources and previews, stored once by content in PHOTO_BLOBS under `photo/<id>`, and the tabs that may read
// each, in the design's own SQLite (photo_blob_refs, design-room/design-schema.ts). A tab reads a blob only
// through a ref, and a ref always means the bytes were sent and checked (or carried from a tab that held them).
//
// Bytes are shared between designs, so which designs still hold a blob is kept beside the bytes: an empty
// marker object `photo-refs/<blobId>/<designId>` for each design with a ref to it. A design writes its marker
// before its first ref, and removes it once its last ref goes (its daily upkeep, or its purge); the bytes go
// when no marker is left (releaseBlobs).
import { photoBlobIdsOf, PHOTO_SWEEP_GRACE_MS } from '@livedesign/photo-engine';
import type { DesignEnv, Env } from '../types';

export const photoBlobKey = (id: string): string => `photo/${id}`;
export const photoBlobMarkerKey = (blobId: string, designId: string): string =>
  `photo-refs/${blobId}/${designId}`;

export type PhotoBlobMeta = { id: string; type: string; size: number };

const idsJson = (ids: readonly string[]) => JSON.stringify(ids);

/** Of `ids`, those the tab holds a ref to. */
export async function tabHoldsBlobs(
  env: DesignEnv,
  tabId: string,
  ids: readonly string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await env.DESIGN_DB.prepare(
    'SELECT blob_id FROM photo_blob_refs WHERE tab_id = ? AND blob_id IN (SELECT value FROM json_each(?))',
  )
    .bind(tabId, idsJson(ids))
    .all<{ blob_id: string }>();
  return new Set(rows.results.map((r) => r.blob_id));
}

/** Of `ids`, the ones the tab holds, with what they are: the source side of an adoption. */
export async function heldBlobs(
  env: DesignEnv,
  tabId: string,
  ids: readonly string[],
): Promise<PhotoBlobMeta[]> {
  if (ids.length === 0) return [];
  const rows = await env.DESIGN_DB.prepare(
    `SELECT blob_id, content_type, byte_size FROM photo_blob_refs
      WHERE tab_id = ? AND blob_id IN (SELECT value FROM json_each(?))`,
  )
    .bind(tabId, idsJson(ids))
    .all<{ blob_id: string; content_type: string; byte_size: number }>();
  return rows.results.map((r) => ({ id: r.blob_id, type: r.content_type, size: r.byte_size }));
}

/** The bytes the tab's refs name, for its cap. */
export async function tabPhotoBytes(env: DesignEnv, tabId: string): Promise<number> {
  const row = await env.DESIGN_DB.prepare(
    'SELECT COALESCE(SUM(byte_size), 0) AS bytes FROM photo_blob_refs WHERE tab_id = ?',
  )
    .bind(tabId)
    .first<{ bytes: number }>();
  return row?.bytes ?? 0;
}

// Of `ids`, the blobs no tab of the design holds yet: the ones it needs a marker for.
async function newToDesign(env: DesignEnv, ids: readonly string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await env.DESIGN_DB.prepare(
    'SELECT DISTINCT blob_id FROM photo_blob_refs WHERE blob_id IN (SELECT value FROM json_each(?))',
  )
    .bind(idsJson(ids))
    .all<{ blob_id: string }>();
  const held = new Set(rows.results.map((r) => r.blob_id));
  return ids.filter((id) => !held.has(id));
}

// The design's markers for blobs it is about to hold, before the refs: a blob with a ref always has a marker.
async function markHeld(env: DesignEnv, designId: string, ids: readonly string[]): Promise<void> {
  const bucket = env.PHOTO_BLOBS;
  if (!bucket) return;
  const fresh = await newToDesign(env, ids);
  await Promise.all(fresh.map((id) => bucket.put(photoBlobMarkerKey(id, designId), new Uint8Array())));
}

/**
 * The tab's refs to `blobs`, after the design's markers. A ref made again is renewed: the blob was just named,
 * so the sweep's grace starts over.
 */
export async function recordBlobs(
  env: DesignEnv,
  designId: string,
  tabId: string,
  blobs: readonly PhotoBlobMeta[],
  now = Date.now(),
): Promise<void> {
  if (blobs.length === 0) return;
  await markHeld(
    env,
    designId,
    blobs.map((b) => b.id),
  );
  await env.DESIGN_DB.prepare(
    `INSERT INTO photo_blob_refs (tab_id, blob_id, created_at, content_type, byte_size)
     SELECT ?1, value ->> '$.id', ?2, value ->> '$.type', value ->> '$.size' FROM json_each(?3) WHERE true
     ON CONFLICT (tab_id, blob_id) DO UPDATE SET created_at = excluded.created_at`,
  )
    .bind(tabId, now, JSON.stringify(blobs))
    .run();
}

/** A blob's content type, when the tab holds a ref to it. */
export async function blobForTab(
  env: DesignEnv,
  tabId: string,
  id: string,
): Promise<{ contentType: string } | null> {
  const row = await env.DESIGN_DB.prepare(
    'SELECT content_type FROM photo_blob_refs WHERE tab_id = ? AND blob_id = ?',
  )
    .bind(tabId, id)
    .first<{ content_type: string }>();
  return row ? { contentType: row.content_type } : null;
}

/** Every blob each of `tabIds` holds, for a copy: carried under the copy's tab ids. */
export async function blobRefsOfTabs(
  env: DesignEnv,
  tabIds: readonly string[],
): Promise<(PhotoBlobMeta & { tabId: string })[]> {
  if (tabIds.length === 0) return [];
  const rows = await env.DESIGN_DB.prepare(
    `SELECT tab_id, blob_id, content_type, byte_size FROM photo_blob_refs
      WHERE tab_id IN (SELECT value FROM json_each(?))`,
  )
    .bind(idsJson(tabIds))
    .all<{ tab_id: string; blob_id: string; content_type: string; byte_size: number }>();
  return rows.results.map((r) => ({
    tabId: r.tab_id,
    id: r.blob_id,
    type: r.content_type,
    size: r.byte_size,
  }));
}

// ---------- Letting go --------------------------------------------------------------------------------------

// Blobs a design no longer holds: its markers go, then each blob no design marks any more is deleted. A failure
// is logged and leaves bytes behind, never a ref without bytes.
export async function releaseBlobs(env: Env, designId: string, ids: readonly string[]): Promise<number> {
  const bucket = env.PHOTO_BLOBS;
  if (!bucket || ids.length === 0) return 0;
  let deleted = 0;
  try {
    await bucket.delete(ids.map((id) => photoBlobMarkerKey(id, designId)));
    for (const id of ids) {
      const others = await bucket.list({ prefix: `photo-refs/${id}/`, limit: 1 });
      if (others.objects.length > 0) continue;
      await bucket.delete(photoBlobKey(id));
      deleted++;
    }
  } catch (err) {
    console.error('[photo-blobs] release failed', { designId, count: ids.length, err: String(err) });
  }
  return deleted;
}

// The design's part of the photo sweep (docs/specs/031-photo/photo-store.md "Retention"), in its daily upkeep:
// each tab's refs older than a day that its saved body no longer names go (every ref of a tab that is gone),
// then the blobs the design no longer holds at all are released. Bounded per run; resumes the next day.
export const PHOTO_SWEEP_TABS = 200;

export type PhotoSweepResult = { refs: number; blobs: number };

export async function sweepDesignPhotoBlobs(
  env: DesignEnv,
  designId: string,
  now: number,
): Promise<PhotoSweepResult> {
  const cutoff = now - PHOTO_SWEEP_GRACE_MS;
  const db = env.DESIGN_DB;
  const tabs = await db
    .prepare('SELECT DISTINCT tab_id FROM photo_blob_refs WHERE created_at < ? LIMIT ?')
    .bind(cutoff, PHOTO_SWEEP_TABS)
    .all<{ tab_id: string }>();
  const dropped = new Set<string>();
  let refs = 0;
  for (const { tab_id: tabId } of tabs.results) {
    const row = await db
      .prepare('SELECT t.data FROM tabs t JOIN design_tabs dt ON dt.tab_id = t.id WHERE t.id = ?')
      .bind(tabId)
      .first<{ data: string }>();
    let live: Set<string>;
    if (!row) {
      live = new Set();
    } else {
      try {
        live = photoBlobIdsOf(JSON.parse(row.data) as { photos?: unknown });
      } catch {
        // A body that does not parse keeps every blob: bytes kept, never a broken photo.
        console.error('[photo-blobs] sweep: tab body unreadable', { designId, tabId });
        continue;
      }
    }
    const gone = await db
      .prepare(
        `DELETE FROM photo_blob_refs WHERE tab_id = ? AND created_at < ?
           AND blob_id NOT IN (SELECT value FROM json_each(?)) RETURNING blob_id`,
      )
      .bind(tabId, cutoff, JSON.stringify([...live]))
      .all<{ blob_id: string }>();
    refs += gone.results.length;
    for (const r of gone.results) dropped.add(r.blob_id);
  }
  const unheld = await letGo(env, [...dropped]);
  return { refs, blobs: await releaseBlobs(env, designId, unheld) };
}

// Of `ids`, the ones no tab of the design holds any more.
async function letGo(env: DesignEnv, ids: readonly string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const still = await env.DESIGN_DB.prepare(
    'SELECT DISTINCT blob_id FROM photo_blob_refs WHERE blob_id IN (SELECT value FROM json_each(?))',
  )
    .bind(idsJson(ids))
    .all<{ blob_id: string }>();
  const held = new Set(still.results.map((r) => r.blob_id));
  return ids.filter((id) => !held.has(id));
}

/** Every blob the design holds, for its purge (released after its storage is gone). */
export async function designBlobIds(env: DesignEnv): Promise<string[]> {
  const rows = await env.DESIGN_DB.prepare('SELECT DISTINCT blob_id FROM photo_blob_refs').all<{
    blob_id: string;
  }>();
  return rows.results.map((r) => r.blob_id);
}

export { markHeld as markBlobsHeld };
