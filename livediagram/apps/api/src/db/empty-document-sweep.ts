// Empty document clean-up (docs/specs/013-workspace/empty-document-cleanup.md):
// the daily cron moves every live document with no element on any of its tabs,
// unsaved for 30 days, to the Trash. It stamps the sweep's own time, so the
// Trash's purge still gives it the full 30 days there.

import { EMPTY_DOCUMENT_STALE_MS } from '@livediagram/api-schema';
import type { Env } from '../types';

// Documents per statement: one bounded UPDATE over a scan measured at ~10 ms on
// production (docs/specs/013-workspace/blueprints/empty-document-cleanup.md).
const EMPTY_SWEEP_BATCH = 500;
// Statements per cron run: 4 x 500 = 2,000 moves a day, the Trash purge's
// order. A larger backlog drains over the following days, oldest save first.
const EMPTY_SWEEP_MAX_BATCHES = 4;

// Judged on the content summary each document pushes (document-room/document-outbox.ts `readContentSummary`): no
// tab with an element or an article, and none whose body is not JSON. A document whose summary has not arrived
// (NULL) counts as content: the sweep fails safe. Select and move in one statement, so a document saved a moment
// before it runs is judged on that save (its summary follows within a minute; a document unsaved for 30 days has
// long had it).
const MOVE_EMPTY_STALE = `
  UPDATE documents SET trashed_at = ?1, trash_reason = 'empty'
   WHERE id IN (
     SELECT d.id FROM documents d
      WHERE d.trashed_at IS NULL AND d.saved_at <= ?2
        AND COALESCE(json_extract(d.content_summary, '$.hasContent'), 1) = 0
      ORDER BY d.saved_at ASC, d.id ASC
      LIMIT ?3)`;

// Move what is empty and stale at `now` to the Trash, at most
// maxBatches x batch per run. Returns how many moved.
export async function trashEmptyDocuments(
  env: Env,
  now: number,
  opts: { batch?: number; maxBatches?: number } = {},
): Promise<number> {
  const batch = opts.batch ?? EMPTY_SWEEP_BATCH;
  const maxBatches = opts.maxBatches ?? EMPTY_SWEEP_MAX_BATCHES;
  const cutoff = now - EMPTY_DOCUMENT_STALE_MS;
  let moved = 0;
  for (let round = 0; round < maxBatches; round++) {
    const res = await env.DB.prepare(MOVE_EMPTY_STALE).bind(now, cutoff, batch).run();
    const changes = res.meta.changes ?? 0;
    moved += changes;
    if (changes < batch) break;
  }
  return moved;
}
