// Removing documents' D1 rows (the Trash purge, account deletion, a delete for good). Everything keyed by a
// document cascades from its row (share links, the Inbox's index rows) or goes in the same batch (its image
// index and grants, which have no foreign key). The content is each document's own Durable Object's, which the
// caller purges after (room-purge-client.ts `purgeRooms`).

import type { Env } from '../types';
import { imageGrantRemovalStatement } from './image-grants';
import { mediaRefQueueDocumentsStatement } from '../media';

// Which documents are being removed: one by id, every document an owner holds,
// or a set of ids (the Trash purge, docs/specs/013-workspace/trash.md).
type DocumentSelector = { column: 'id' | 'owner_id'; value: string } | { ids: string[] };

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
  return [
    // The media service hears that these documents place nothing any more (src/media.ts), before the
    // references below go.
    mediaRefQueueDocumentsStatement(env, `d.id IN (${doomed.replace('?', '?2')})`, [value]),
    // document_images and the placement grants are keyed by document without an FK
    // (docs/specs/009-elements/images.md, "Reference index", "Placement grants").
    env.DB.prepare(`DELETE FROM document_images WHERE document_id IN (${doomed})`).bind(value),
    imageGrantRemovalStatement(env, doomed, [value]),
    env.DB.prepare(`DELETE FROM documents WHERE ${where}`).bind(value),
  ];
}
