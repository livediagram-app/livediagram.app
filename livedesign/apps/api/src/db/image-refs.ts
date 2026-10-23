// image_refs: the image reference index (docs/specs/009-elements/images.md, "Reference index"), in the design's own
// SQLite. A projection of the image elements (and image page backgrounds) inside `tabs.data`, so the media
// service's references, the usage map and share-visitor reads never read a tab body.
//
// Writes are STATEMENTS appended to the batch that writes the body, so the index lands in the same transaction as
// the body it mirrors. There are no foreign keys: a dangling row (its tab gone) is ignored by every reader, which is
// what makes every gap here fail towards keeping bytes. A change to a design's set queues it for the media service
// through the outbox triggers (design-room/design-schema.ts).

import type { DesignEnv } from '../types';

// A body replace: drop the tab's references the new body no longer has, then add the ones it does. A save that
// changes no image writes no row.
export function imageRefReplaceStatements(
  env: DesignEnv,
  tabId: string,
  ids: string[],
): D1PreparedStatement[] {
  return [
    env.DESIGN_DB.prepare(
      'DELETE FROM image_refs WHERE tab_id = ?1 AND image_id NOT IN (SELECT value FROM json_each(?2))',
    ).bind(tabId, JSON.stringify(ids)),
    ...imageRefAddStatements(env, tabId, ids),
  ];
}

// Add only: for a write that may have lost a race (a participant swap), where deleting could remove a reference
// the winner wrote.
export function imageRefAddStatements(
  env: DesignEnv,
  tabId: string,
  ids: string[],
): D1PreparedStatement[] {
  if (ids.length === 0) return [];
  return [
    env.DESIGN_DB.prepare(
      'INSERT OR IGNORE INTO image_refs (tab_id, image_id) SELECT ?1, value FROM json_each(?2)',
    ).bind(tabId, JSON.stringify(ids)),
  ];
}

export function imageRefPruneTabStatement(env: DesignEnv, tabId: string): D1PreparedStatement {
  return env.DESIGN_DB.prepare('DELETE FROM image_refs WHERE tab_id = ?').bind(tabId);
}
