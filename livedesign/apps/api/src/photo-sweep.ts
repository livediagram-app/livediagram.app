// The daily photo blob sweep (docs/specs/031-photo/photo-store.md "Retention"): for each tab with refs
// older than a day, the refs its saved body no longer names go (and every ref of a tab that is gone);
// then every blob no ref names is deleted, D1 first, then R2. Bounded per run; resumes the next day.
import { photoBlobIdsOf, PHOTO_SWEEP_GRACE_MS } from '@livedesign/photo-engine';
import { photoBlobKey } from './db/photo-blobs';
import type { Env } from './types';

export const PHOTO_SWEEP_TABS = 200;
export const PHOTO_SWEEP_BLOBS = 5000;
// D1's bound parameters a statement, less room for the others.
const PAGE = 90;

export type PhotoSweepResult = { refs: number; blobs: number };

export async function sweepPhotoBlobs(env: Env, now: number): Promise<PhotoSweepResult> {
  const cutoff = now - PHOTO_SWEEP_GRACE_MS;
  let refs = 0;
  const tabs = await env.DB.prepare(
    'SELECT DISTINCT tab_id FROM photo_blob_refs WHERE created_at < ? LIMIT ?',
  )
    .bind(cutoff, PHOTO_SWEEP_TABS)
    .all<{ tab_id: string }>();
  for (const { tab_id: tabId } of tabs.results ?? []) {
    const row = await env.DB.prepare('SELECT data FROM tabs WHERE id = ?')
      .bind(tabId)
      .first<{ data: string }>();
    if (!row) {
      const gone = await env.DB.prepare(
        'DELETE FROM photo_blob_refs WHERE tab_id = ? AND created_at < ?',
      )
        .bind(tabId, cutoff)
        .run();
      refs += gone.meta.changes ?? 0;
      continue;
    }
    let live: Set<string>;
    try {
      live = photoBlobIdsOf(JSON.parse(row.data) as { photos?: unknown });
    } catch {
      // A body that does not parse keeps every blob: bytes kept, never a broken photo.
      console.error('photo sweep: tab body unreadable', { tabId });
      continue;
    }
    const old = await env.DB.prepare(
      'SELECT blob_id FROM photo_blob_refs WHERE tab_id = ? AND created_at < ?',
    )
      .bind(tabId, cutoff)
      .all<{ blob_id: string }>();
    const drop = (old.results ?? []).map((r) => r.blob_id).filter((id) => !live.has(id));
    for (let i = 0; i < drop.length; i += PAGE) {
      const page = drop.slice(i, i + PAGE);
      const res = await env.DB.prepare(
        `DELETE FROM photo_blob_refs WHERE tab_id = ? AND created_at < ? AND blob_id IN (${page.map(() => '?').join(', ')})`,
      )
        .bind(tabId, cutoff, ...page)
        .run();
      refs += res.meta.changes ?? 0;
    }
  }
  // Blobs nothing names, oldest first; the delete re-checks, so a blob named meanwhile stays.
  const orphans = await env.DB.prepare(
    `SELECT id FROM photo_blobs b WHERE created_at < ? AND NOT EXISTS (SELECT 1 FROM photo_blob_refs r WHERE r.blob_id = b.id)
      ORDER BY created_at LIMIT ?`,
  )
    .bind(cutoff, PHOTO_SWEEP_BLOBS)
    .all<{ id: string }>();
  const deleted: string[] = [];
  const ids = (orphans.results ?? []).map((r) => r.id);
  for (let i = 0; i < ids.length; i += PAGE) {
    const page = ids.slice(i, i + PAGE);
    const res = await env.DB.prepare(
      `DELETE FROM photo_blobs WHERE id IN (${page.map(() => '?').join(', ')})
         AND NOT EXISTS (SELECT 1 FROM photo_blob_refs r WHERE r.blob_id = photo_blobs.id) RETURNING id`,
    )
      .bind(...page)
      .all<{ id: string }>();
    for (const r of res.results ?? []) deleted.push(r.id);
  }
  if (deleted.length > 0 && env.PHOTO_BLOBS) {
    try {
      for (let i = 0; i < deleted.length; i += 1000)
        await env.PHOTO_BLOBS.delete(deleted.slice(i, i + 1000).map(photoBlobKey));
    } catch (err) {
      console.error('photo sweep: R2 delete failed', {
        count: deleted.length,
        ids: deleted.slice(0, 20),
        err,
      });
    }
  }
  return { refs, blobs: deleted.length };
}

/** The sweep as the cron runs it: its outcome logged, a failure logged and swallowed. */
export async function runPhotoSweep(env: Env, now: number): Promise<void> {
  try {
    const { refs, blobs } = await sweepPhotoBlobs(env, now);
    console.log(`photo sweep: removed ${refs} refs, deleted ${blobs} blobs`);
  } catch (err) {
    console.error('photo sweep failed', err);
  }
}
