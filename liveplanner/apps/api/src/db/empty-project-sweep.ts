// Empty project clean-up (docs/specs/013-workspace/empty-project-cleanup.md):
// the daily cron moves every live project with no element on any of its tabs,
// unsaved for 30 days, to the Trash. It stamps the sweep's own time, so the
// Trash's purge still gives it the full 30 days there.

import { EMPTY_PROJECT_STALE_MS } from '@liveplanner/api-schema';
import type { Env } from '../types';

// Projects per statement: one bounded UPDATE over a scan measured at ~10 ms on
// production (docs/specs/013-workspace/blueprints/empty-project-cleanup.md).
const EMPTY_SWEEP_BATCH = 500;
// Statements per cron run: 4 x 500 = 2,000 moves a day, the Trash purge's
// order. A larger backlog drains over the following days, oldest save first.
const EMPTY_SWEEP_MAX_BATCHES = 4;

// The checks are a CASE, not an OR chain: SQLite stops a CASE at its first match (an OR it may evaluate whole), so a
// tab with elements is parsed twice at most and a body that is not JSON never reaches json_type. Measured on 5,000
// tabs of 6.7 KiB: 8.9 ms CPU, as the three-check OR before the form check (8.7 ms); that OR with it was 11.0 ms.
// Select and move in one statement, so a project saved a moment before it runs
// is judged on that save. A tab whose data is not valid JSON counts as content:
// the sweep fails safe. So does a tab holding a form (a Form tab's form is
// `form`, not an element). A tab shared with another project counts in
// both.
const MOVE_EMPTY_STALE = `
  UPDATE projects SET trashed_at = ?1, trash_reason = 'empty'
   WHERE id IN (
     SELECT d.id FROM projects d
      WHERE d.trashed_at IS NULL AND d.saved_at <= ?2
        AND NOT EXISTS (
          SELECT 1 FROM project_tabs dt JOIN tabs t ON t.id = dt.tab_id
           WHERE dt.project_id = d.id
             AND CASE
                   WHEN NOT json_valid(t.data) THEN 1
                   WHEN COALESCE(json_array_length(t.data, '$.elements'), 0) > 0 THEN 1
                   WHEN json_type(t.data, '$.form') = 'object' THEN 1
                   ELSE 0
                 END = 1)
      ORDER BY d.saved_at ASC, d.id ASC
      LIMIT ?3)`;

// Move what is empty and stale at `now` to the Trash, at most
// maxBatches x batch per run. Returns how many moved.
export async function trashEmptyProjects(
  env: Env,
  now: number,
  opts: { batch?: number; maxBatches?: number } = {},
): Promise<number> {
  const batch = opts.batch ?? EMPTY_SWEEP_BATCH;
  const maxBatches = opts.maxBatches ?? EMPTY_SWEEP_MAX_BATCHES;
  const cutoff = now - EMPTY_PROJECT_STALE_MS;
  let moved = 0;
  for (let round = 0; round < maxBatches; round++) {
    const res = await env.DB.prepare(MOVE_EMPTY_STALE).bind(now, cutoff, batch).run();
    const changes = res.meta.changes ?? 0;
    moved += changes;
    if (changes < batch) break;
  }
  return moved;
}
