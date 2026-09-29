// Removing diagrams without taking shared tabs with them
// (docs/specs/006-document/tab-document-many-to-many.md, "Delete a diagram").
//
// A tab can sit in several diagrams, so deleting a container is the
// diagram-scoped form of deleteTabRow: the doomed diagrams' links go, a tab
// with no link left goes with its history and index rows (their FKs cascade
// from `tabs`; `image_refs` has none, so it is pruned first), and a tab still linked elsewhere stays exactly as it is there.
// Nothing cascades from `diagrams` into `tabs` (migration 0049), so a tab this
// doesn't drop would be stranded with no diagram to reach it from.

import type { Env } from '../types';

// Which diagrams are being removed: one by id, every diagram an owner holds,
// or a set of ids (the Trash purge, docs/specs/013-workspace/trash.md).
export type DocumentSelector = { column: 'id' | 'owner_id'; value: string } | { ids: string[] };

// The WHERE clause over `documents` and its one bound value.
function selectorWhere(selector: DocumentSelector): { where: string; value: string } {
  if ('ids' in selector) {
    return { where: 'id IN (SELECT value FROM json_each(?))', value: JSON.stringify(selector.ids) };
  }
  return { where: `${selector.column} = ?`, value: selector.value };
}

// The statements, in order, for one D1 batch so it lands whole or not at all.
// The diagrams DELETE is last; its `meta.changes` is the diagram count.
export function documentRemovalStatements(
  env: Env,
  selector: DocumentSelector,
): D1PreparedStatement[] {
  const { where, value } = selectorWhere(selector);
  const doomed = `SELECT id FROM documents WHERE ${where}`;
  // The tabs that go: linked into a doomed diagram and into nothing else.
  const doomedTabs = `SELECT dt.tab_id FROM document_tabs dt
                       WHERE dt.document_id IN (${doomed})
                         AND NOT EXISTS (SELECT 1 FROM document_tabs o
                                          WHERE o.tab_id = dt.tab_id AND o.document_id NOT IN (${doomed}))`;
  return [
    // image_refs has no FK (docs/specs/009-elements/images.md, "Reference index"), so the doomed
    // tabs' references go explicitly, first, while the links that name them still exist.
    env.DB.prepare(`DELETE FROM image_refs WHERE tab_id IN (${doomedTabs})`).bind(value, value),
    // Before the diagrams DELETE: its cascade takes the links this reads.
    env.DB.prepare(
      `DELETE FROM tabs
        WHERE id IN (SELECT tab_id FROM document_tabs WHERE document_id IN (${doomed}))
          AND NOT EXISTS (SELECT 1 FROM document_tabs o
                           WHERE o.tab_id = tabs.id AND o.document_id NOT IN (${doomed}))`,
    ).bind(value, value),
    env.DB.prepare(`DELETE FROM documents WHERE ${where}`).bind(value),
  ];
}
