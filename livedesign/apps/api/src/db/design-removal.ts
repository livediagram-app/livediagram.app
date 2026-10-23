// Removing designs without taking shared tabs with them
// (docs/specs/006-design/tab-design-many-to-many.md "Tab lifecycle").
//
// A tab can sit in several designs, so deleting a container is the
// design-scoped form of deleteTabRow: the doomed designs' links go, a tab
// with no link left goes with its history and index rows (their FKs cascade
// from `tabs`; `image_refs` has none, so it is pruned first), and a tab still linked elsewhere stays exactly as it is there.
// Nothing cascades from `designs` into `tabs` (the baseline migration), so a tab this
// doesn't drop would be stranded with no design to reach it from.

import type { Env } from '../types';
import { imageGrantRemovalStatement } from './image-grants';

// Which designs are being removed: one by id, every design an owner holds,
// or a set of ids (the Trash purge, docs/specs/013-workspace/trash.md).
type DesignSelector = { column: 'id' | 'owner_id'; value: string } | { ids: string[] };

// The WHERE clause over `designs` and its one bound value.
function selectorWhere(selector: DesignSelector): { where: string; value: string } {
  if ('ids' in selector) {
    return { where: 'id IN (SELECT value FROM json_each(?))', value: JSON.stringify(selector.ids) };
  }
  return { where: `${selector.column} = ?`, value: selector.value };
}

// The statements, in order, for one D1 batch so it lands whole or not at all.
// The designs DELETE is last; its `meta.changes` is the design count.
export function designRemovalStatements(
  env: Env,
  selector: DesignSelector,
): D1PreparedStatement[] {
  const { where, value } = selectorWhere(selector);
  const doomed = `SELECT id FROM designs WHERE ${where}`;
  // The tabs that go: linked into a doomed design and into nothing else.
  const doomedTabs = `SELECT dt.tab_id FROM design_tabs dt
                       WHERE dt.design_id IN (${doomed})
                         AND NOT EXISTS (SELECT 1 FROM design_tabs o
                                          WHERE o.tab_id = dt.tab_id AND o.design_id NOT IN (${doomed}))`;
  return [
    // image_refs has no FK (docs/specs/009-elements/images.md, "Reference index"), so the doomed
    // tabs' references go explicitly, first, while the links that name them still exist.
    env.DB.prepare(`DELETE FROM image_refs WHERE tab_id IN (${doomedTabs})`).bind(value, value),
    // Placement grants are keyed by design, also without an FK
    // (docs/specs/009-elements/images.md, "Placement grants").
    imageGrantRemovalStatement(env, doomed, [value]),
    // Before the designs DELETE: its cascade takes the links this reads.
    env.DB.prepare(
      `DELETE FROM tabs
        WHERE id IN (SELECT tab_id FROM design_tabs WHERE design_id IN (${doomed}))
          AND NOT EXISTS (SELECT 1 FROM design_tabs o
                           WHERE o.tab_id = tabs.id AND o.design_id NOT IN (${doomed}))`,
    ).bind(value, value),
    env.DB.prepare(`DELETE FROM designs WHERE ${where}`).bind(value),
  ];
}
