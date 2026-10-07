// Removing documents without taking shared tabs with them
// (docs/specs/006-document/tab-document-many-to-many.md, "Delete a diagram").
//
// A tab can sit in several documents, so deleting a container is the
// document-scoped form of deleteTabRow: the doomed documents' links go, a tab
// with no link left goes with its history and index rows (their FKs cascade
// from `tabs`; `image_refs` has none, so it is pruned first), and a tab still linked elsewhere stays exactly as it is there.
// Nothing cascades from `diagrams` into `tabs` (migration 0049), so a tab this
// doesn't drop would be stranded with no document to reach it from.

import type { Env } from '../types';
import { imageGrantRemovalStatement } from './image-grants';

// Which documents are being removed: one by id, every document an owner holds,
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
// The documents DELETE is last; its `meta.changes` is the document count.
export function documentRemovalStatements(
  env: Env,
  selector: DocumentSelector,
): D1PreparedStatement[] {
  const { where, value } = selectorWhere(selector);
  const doomed = `SELECT id FROM documents WHERE ${where}`;
  // The tabs that go: linked into a doomed document and into nothing else.
  const doomedTabs = `SELECT dt.tab_id FROM document_tabs dt
                       WHERE dt.document_id IN (${doomed})
                         AND NOT EXISTS (SELECT 1 FROM document_tabs o
                                          WHERE o.tab_id = dt.tab_id AND o.document_id NOT IN (${doomed}))`;
  return [
    // image_refs has no FK (docs/specs/009-elements/images.md, "Reference index"), so the doomed
    // tabs' references go explicitly, first, while the links that name them still exist.
    env.DB.prepare(`DELETE FROM image_refs WHERE tab_id IN (${doomedTabs})`).bind(value, value),
    // Placement grants are keyed by document, also without an FK
    // (docs/specs/009-elements/images.md, "Placement grants").
    imageGrantRemovalStatement(env, doomed, [value]),
    // The Google Drive mirror's rows (docs/specs/022-drive-mirror/drive-mirror.md, "Data"):
    // a removed document is no longer mirrored. The browser finishes the Drive
    // side from its own memory of the rows it saw.
    env.DB.prepare(
      `DELETE FROM drive_items WHERE item_kind = 'document' AND ld_id IN (${doomed})`,
    ).bind(value),
    // Before the documents DELETE: its cascade takes the links this reads.
    env.DB.prepare(
      `DELETE FROM tabs
        WHERE id IN (SELECT tab_id FROM document_tabs WHERE document_id IN (${doomed}))
          AND NOT EXISTS (SELECT 1 FROM document_tabs o
                           WHERE o.tab_id = tabs.id AND o.document_id NOT IN (${doomed}))`,
    ).bind(value, value),
    env.DB.prepare(`DELETE FROM documents WHERE ${where}`).bind(value),
  ];
}
