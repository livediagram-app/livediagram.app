// Opened by a Visitor and Copied by a Visitor (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Timeline"): who came in
// to an item through one of its share links, on its owner's Timeline (theirs alone: who an item is shared with is
// the owner's business). An open is one event per visitor, item and UTC day, its time moving on, so a visitor
// reloading all day is one card; a copy is one per visitor and item. A visitor with no identity is known by the link
// they came in through. Recorded off the response path, and an open at most once a day per isolate.

import type { Person } from './auth';
import { OPEN_MEMORY_MAX } from './config';
import type { Env } from './env';
import { useDayOf } from './items';
import type { Access, ItemRow } from './rows';
import { eventStatements } from './timeline';

// The open events this isolate has written today, so a visitor's grant renewals never reach D1. Oldest out first.
const written = new Set<string>();

export const visitorOpenedId = (itemId: string, visitor: string, at: number) =>
  `vo:${itemId}:${visitor}:${useDayOf(at)}`;
export const visitorCopiedId = (itemId: string, visitor: string) => `vc:${itemId}:${visitor}`;

// Who a link visitor is: their account or guest id, or the link for someone with no identity.
const visitorOf = (person: Person | null, access: Access) =>
  person ? person.id : `link:${access.code}`;

/** A link visitor's open (a grant through a share link), or nothing for the owner, a teammate, or one already
 *  written today here. */
export function recordVisitorOpen(
  env: Env,
  waitUntil: (promise: Promise<unknown>) => void,
  row: ItemRow,
  person: Person | null,
  access: Access,
  at = Date.now(),
): void {
  // A public link's (a Community post's) visits are not recorded: the post's copy count stands in for them.
  if (access.via !== 'link' || !access.code || access.public) return;
  const id = visitorOpenedId(row.id, visitorOf(person, access), at);
  if (written.has(id)) return;
  written.add(id);
  if (written.size > OPEN_MEMORY_MAX) {
    const oldest = written.values().next().value;
    if (oldest !== undefined) written.delete(oldest);
  }
  const db = env.INDEX_DB;
  waitUntil(
    db
      .batch(
        eventStatements(db, {
          id,
          itemId: row.id,
          type: 'opened_by_visitor',
          actorId: person?.id ?? null,
          at,
          scope: `p:${row.owner_id}`,
        }),
      )
      .catch((err: unknown) => {
        written.delete(id);
        console.warn('[index] visitor open not recorded', { error: String(err) });
      }),
  );
}

/** A copy made through a share link, on the source item's owner's Timeline. */
export function recordVisitorCopy(
  env: Env,
  waitUntil: (promise: Promise<unknown>) => void,
  from: ItemRow,
  person: Person,
  access: Access,
  at = Date.now(),
): void {
  if (access.via !== 'link') return;
  const db = env.INDEX_DB;
  waitUntil(
    db
      .batch(
        eventStatements(db, {
          id: visitorCopiedId(from.id, person.id),
          itemId: from.id,
          type: 'copied_by_visitor',
          actorId: person.id,
          at,
          scope: `p:${from.owner_id}`,
        }),
      )
      .catch((err: unknown) => {
        console.warn('[index] visitor copy not recorded', { error: String(err) });
      }),
  );
}

/** Tests: forget what this isolate wrote. */
export function clearVisitorMemoryForTests(): void {
  written.clear();
}
