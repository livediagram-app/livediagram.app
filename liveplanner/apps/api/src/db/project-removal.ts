// Removing projects' D1 rows (the Trash purge, account deletion, a delete for good). Everything keyed by a
// project cascades from its row: share and form links, the Inbox's index rows. The content is each plan's own
// Durable Object's, which the caller purges after (room-purge-client.ts `purgeRooms`).

import type { Env } from '../types';

// Which projects are being removed: one by id, every project an owner holds,
// or a set of ids (the Trash purge, docs/specs/013-workspace/trash.md).
type ProjectSelector = { column: 'id' | 'owner_id'; value: string } | { ids: string[] };

// The WHERE clause over `projects` and its one bound value.
function selectorWhere(selector: ProjectSelector): { where: string; value: string } {
  if ('ids' in selector) {
    return { where: 'id IN (SELECT value FROM json_each(?))', value: JSON.stringify(selector.ids) };
  }
  return { where: `${selector.column} = ?`, value: selector.value };
}

// The statements, in order, for one D1 batch so it lands whole or not at all.
// The projects DELETE is last; its `meta.changes` is the project count.
export function projectRemovalStatements(
  env: Env,
  selector: ProjectSelector,
): D1PreparedStatement[] {
  const { where, value } = selectorWhere(selector);
  return [
    env.DB.prepare(`DELETE FROM projects WHERE ${where}`).bind(value),
  ];
}
