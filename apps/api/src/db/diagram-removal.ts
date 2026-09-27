// Removing diagrams without taking shared tabs with them
// (docs/specs/006-diagram/tab-diagram-many-to-many.md, "Delete a diagram").
//
// A tab can sit in several diagrams, so deleting a container is the
// diagram-scoped form of deleteTabRow: the doomed diagrams' links go, a tab
// with no link left goes with its history and index rows (their FKs cascade
// from `tabs`; `image_refs` has none, so it is pruned first), and a tab still linked elsewhere stays exactly as it is there.
// Nothing cascades from `diagrams` into `tabs` (migration 0049), so a tab this
// doesn't drop would be stranded with no diagram to reach it from.

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
  // The tabs that go: linked into a doomed diagram and into nothing else.
  const doomedTabs = `SELECT dt.tab_id FROM diagram_tabs dt
                       WHERE dt.diagram_id IN (${doomed})
                         AND NOT EXISTS (SELECT 1 FROM diagram_tabs o
                                          WHERE o.tab_id = dt.tab_id AND o.diagram_id NOT IN (${doomed}))`;
  return [
    // image_refs has no FK (docs/specs/009-elements/images.md, "Reference index"), so the doomed
    // tabs' references go explicitly, first, while the links that name them still exist.
    env.DB.prepare(`DELETE FROM image_refs WHERE tab_id IN (${doomedTabs})`).bind(value, value),
    // Before the diagrams DELETE: its cascade takes the links this reads.
    env.DB.prepare(
      `DELETE FROM tabs
        WHERE id IN (SELECT tab_id FROM diagram_tabs WHERE diagram_id IN (${doomed}))
          AND NOT EXISTS (SELECT 1 FROM diagram_tabs o
                           WHERE o.tab_id = tabs.id AND o.diagram_id NOT IN (${doomed}))`,
    ).bind(value, value),
    env.DB.prepare(`DELETE FROM diagrams WHERE ${column} = ?`).bind(value),
  ];
}
