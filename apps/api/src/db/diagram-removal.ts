// Removing diagrams without taking shared tabs with them
// (docs/specs/006-diagram/tab-diagram-many-to-many.md, "Delete a diagram").
//
// A tab can sit in several diagrams, so deleting a container is the
// diagram-scoped form of deleteTabRow: the doomed diagrams' links go, a tab
// with no link left goes with its history and index rows (their FKs cascade
// from `tabs`), and a tab still linked elsewhere stays exactly as it is there.

import type { Env } from '../types';

// Which diagrams are being removed: one by id, or every diagram an owner holds.
export type DiagramSelector = { column: 'id' | 'owner_id'; value: string };

// The statements, in order, for one D1 batch so it lands whole or not at all.
// The diagrams DELETE is last; its `meta.changes` is the diagram count.
export function diagramRemovalStatements(
  env: Env,
  { column, value }: DiagramSelector,
): D1PreparedStatement[] {
  const doomed = `SELECT id FROM diagrams WHERE ${column} = ?`;
  const linkedElsewhere = `EXISTS (SELECT 1 FROM diagram_tabs o WHERE o.tab_id = tabs.id AND o.diagram_id NOT IN (${doomed}))`;
  return [
    // Re-home a survivor's legacy pointer onto a diagram that keeps it, so the
    // tabs.diagram_id cascade below can't reach it.
    env.DB.prepare(
      `UPDATE tabs
          SET diagram_id = (SELECT o.diagram_id FROM diagram_tabs o
                             WHERE o.tab_id = tabs.id AND o.diagram_id NOT IN (${doomed})
                             ORDER BY o.added_at, o.diagram_id LIMIT 1)
        WHERE diagram_id IN (${doomed}) AND ${linkedElsewhere}`,
    ).bind(value, value, value),
    env.DB.prepare(
      `DELETE FROM tabs
        WHERE (id IN (SELECT tab_id FROM diagram_tabs WHERE diagram_id IN (${doomed}))
               OR diagram_id IN (${doomed}))
          AND NOT ${linkedElsewhere}`,
    ).bind(value, value, value),
    env.DB.prepare(`DELETE FROM diagrams WHERE ${column} = ?`).bind(value),
  ];
}
