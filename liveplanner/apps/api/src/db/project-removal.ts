// Removing projects without taking shared tabs with them
// (docs/specs/006-project/tab-project-many-to-many.md, "Delete a diagram").
//
// A tab can sit in several projects, so deleting a container is the
// project-scoped form of deleteTabRow: the doomed projects' links go, a tab
// with no link left goes with its history and index rows (their FKs cascade
// from `tabs`), and a tab still linked elsewhere stays exactly as it is there.
// Nothing cascades from `projects` into `tabs`, so a tab this
// doesn't drop would be stranded with no project to reach it from.

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
  const doomed = `SELECT id FROM projects WHERE ${where}`;
  return [
    // Before the projects DELETE: its cascade takes the links this reads.
    env.DB.prepare(
      `DELETE FROM tabs
        WHERE id IN (SELECT tab_id FROM project_tabs WHERE project_id IN (${doomed}))
          AND NOT EXISTS (SELECT 1 FROM project_tabs o
                           WHERE o.tab_id = tabs.id AND o.project_id NOT IN (${doomed}))`,
    ).bind(value, value),
    env.DB.prepare(`DELETE FROM projects WHERE ${where}`).bind(value),
  ];
}
