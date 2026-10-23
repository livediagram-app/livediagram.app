// Empty design clean-up (docs/specs/013-workspace/empty-design-cleanup.md):
// the daily cron moves every live design with no element on any of its tabs,
// unsaved for 30 days, to the Trash. It stamps the sweep's own time, so the
// Trash's purge still gives it the full 30 days there.

import { EMPTY_DESIGN_STALE_MS } from '@livedesign/api-schema';
import type { Env } from '../types';

// Designs per statement: one bounded UPDATE over a scan measured at ~10 ms on
// production (docs/specs/013-workspace/blueprints/empty-design-cleanup.md).
const EMPTY_SWEEP_BATCH = 500;
// Statements per cron run: 4 x 500 = 2,000 moves a day, the Trash purge's
// order. A larger backlog drains over the following days, oldest save first.
const EMPTY_SWEEP_MAX_BATCHES = 4;

// The checks are a CASE, not an OR chain: SQLite stops a CASE at its first match (an OR it may evaluate whole), so a
// tab with elements is parsed once and a body that is not JSON is never parsed.
// Select and move in one statement, so a design saved a moment before it runs
// is judged on that save. A tab whose data is not valid JSON counts as content:
// the sweep fails safe. A tab shared with another design counts in
// both.
const MOVE_EMPTY_STALE = `
  UPDATE designs SET trashed_at = ?1, trash_reason = 'empty'
   WHERE id IN (
     SELECT d.id FROM designs d
      WHERE d.trashed_at IS NULL AND d.saved_at <= ?2
        AND NOT EXISTS (
          SELECT 1 FROM design_tabs dt JOIN tabs t ON t.id = dt.tab_id
           WHERE dt.design_id = d.id
             AND CASE
                   WHEN NOT json_valid(t.data) THEN 1
                   WHEN COALESCE(json_array_length(t.data, '$.elements'), 0) > 0 THEN 1
                   ELSE 0
                 END = 1)
      ORDER BY d.saved_at ASC, d.id ASC
      LIMIT ?3)`;

// Move what is empty and stale at `now` to the Trash, at most
// maxBatches x batch per run. Returns how many moved.
export async function trashEmptyDesigns(
  env: Env,
  now: number,
  opts: { batch?: number; maxBatches?: number } = {},
): Promise<number> {
  const batch = opts.batch ?? EMPTY_SWEEP_BATCH;
  const maxBatches = opts.maxBatches ?? EMPTY_SWEEP_MAX_BATCHES;
  const cutoff = now - EMPTY_DESIGN_STALE_MS;
  let moved = 0;
  for (let round = 0; round < maxBatches; round++) {
    const res = await env.DB.prepare(MOVE_EMPTY_STALE).bind(now, cutoff, batch).run();
    const changes = res.meta.changes ?? 0;
    moved += changes;
    if (changes < batch) break;
  }
  return moved;
}
