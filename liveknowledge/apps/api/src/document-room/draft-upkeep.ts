// The daily upkeep's share for drafts (docs/specs/030-knowledgebase/editing.md "A draft that is left"): a page's
// draft nobody has changed for DRAFT_KEEP_MS goes, both halves, at the next revision. Only tabs holding a draft
// record older than the cutoff are read, so a knowledgebase with no old drafts costs one scan of the
// `draft.at` field and no parse.
import type { ItemSql } from '@liveworkspace/index-app';
import { DRAFT_FLOW, DRAFT_KEEP_MS } from '@liveknowledge/document';

/** Drop every draft untouched since `now - DRAFT_KEEP_MS`; answers how many pages lost one. Never throws. */
export function dropStaleDrafts(sql: ItemSql, now: number): number {
  try {
    const cutoff = now - DRAFT_KEEP_MS;
    const stale = sql
      .exec(
        `SELECT id FROM tabs WHERE json_type(data, '$.draft.at') IN ('integer', 'real')
           AND json_extract(data, '$.draft.at') <= ?`,
        cutoff,
      )
      .toArray();
    for (const { id } of stale as { id: string }[]) {
      sql.exec(
        `UPDATE tabs SET data = json_remove(data, '$.draft', '$.articles.${DRAFT_FLOW}'), rev = rev + 1 WHERE id = ?`,
        id,
      );
    }
    if (stale.length > 0) console.info('[page-edit] stale drafts dropped', { pages: stale.length });
    return stale.length;
  } catch (error) {
    console.warn('[page-edit] draft upkeep failed', { error: String(error) });
    return 0;
  }
}
