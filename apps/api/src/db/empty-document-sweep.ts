// Empty document clean-up (docs/specs/013-workspace/empty-document-cleanup.md):
// the daily cron moves every live document with no element on any of its tabs,
// unsaved for 30 days, to the Trash. It stamps the sweep's own time, so the
// Trash's purge still gives it the full 30 days there.

import { EMPTY_DOCUMENT_STALE_MS } from '@livediagram/api-schema';
import type { Runtime } from '../types';

// Documents per statement: one bounded UPDATE over a scan measured at ~10 ms on
// production (docs/specs/013-workspace/blueprints/empty-document-cleanup.md).
export const EMPTY_SWEEP_BATCH = 500;
// Statements per cron run: 4 x 500 = 2,000 moves a day, the Trash purge's
// order. A larger backlog drains over the following days, oldest save first.
export const EMPTY_SWEEP_MAX_BATCHES = 4;

// Select and move in one statement, so a document saved a moment before it runs
// is judged on that save. A tab whose data is not valid JSON counts as content:
// the sweep fails safe. So does a tab with any article: an article's writing
// lives in `articles`, not in `elements`. A tab shared with another document
// counts in both.
const MOVE_EMPTY_STALE = `
  UPDATE documents SET trashed_at = ?1, trash_reason = 'empty'
   WHERE id IN (
     SELECT d.id FROM documents d
      WHERE d.trashed_at IS NULL AND d.saved_at <= ?2
        AND NOT EXISTS (
          SELECT 1 FROM document_tabs dt JOIN tabs t ON t.id = dt.tab_id
           WHERE dt.document_id = d.id
             AND (NOT json_valid(t.data)
                  OR COALESCE(json_array_length(t.data, '$.elements'), 0) > 0
                  OR EXISTS (SELECT 1 FROM json_each(t.data, '$.articles'))))
      ORDER BY d.saved_at ASC, d.id ASC
      LIMIT ?3)`;

// Move what is empty and stale at `now` to the Trash, at most
// maxBatches x batch per run. Returns how many moved.
export async function trashEmptyDocuments(
  env: Runtime,
  now: number,
  opts: { batch?: number; maxBatches?: number } = {},
): Promise<number> {
  const batch = opts.batch ?? EMPTY_SWEEP_BATCH;
  const maxBatches = opts.maxBatches ?? EMPTY_SWEEP_MAX_BATCHES;
  const cutoff = now - EMPTY_DOCUMENT_STALE_MS;
  let moved = 0;
  for (let round = 0; round < maxBatches; round++) {
    const res = await env.db.prepare(MOVE_EMPTY_STALE).bind(now, cutoff, batch).run();
    const changes = res.meta.changes ?? 0;
    moved += changes;
    if (changes < batch) break;
  }
  return moved;
}
