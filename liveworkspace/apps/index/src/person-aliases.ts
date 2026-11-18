// The guests merged into a person (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Becoming an
// account", blueprints/guest-merge.md; Work Tracker 678). A guest's dots, answers and reactions are recorded under
// the guest's collab key, which the merge can't change without rewriting other people's documents. Instead the index
// keeps the guest as an alias of the person it became, and every grant for that person names the aliases' keys, so
// each app's rooms read entries under them as the person's own. Nothing stored anywhere else is rewritten.

/** The most guests a person keeps as aliases: one per browser they signed in on. The oldest go first. */
export const PERSON_ALIASES_MAX = 32;

/**
 * The statements, in the merge's batch, that make `guest` an alias of `person`: the guests merged into `guest`
 * before (a legacy merge's) follow it, the guest itself is added (renewed when it is there), a person is never their
 * own alias, and past PERSON_ALIASES_MAX the oldest go. Idempotent: run again, it changes only `merged_at`.
 */
export function recordPersonAlias(
  db: D1Database,
  guest: string,
  person: string,
  now: number,
): D1PreparedStatement[] {
  return [
    db.prepare('UPDATE person_aliases SET person_id = ?2 WHERE person_id = ?1').bind(guest, person),
    db
      .prepare(
        `INSERT INTO person_aliases (guest_id, person_id, merged_at) VALUES (?1, ?2, ?3)
         ON CONFLICT (guest_id) DO UPDATE SET person_id = excluded.person_id, merged_at = excluded.merged_at`,
      )
      .bind(guest, person, now),
    // A legacy chain that comes back on itself (the person was once merged into this guest).
    db.prepare('DELETE FROM person_aliases WHERE guest_id = ?1 AND person_id = ?1').bind(person),
    db
      .prepare(
        `DELETE FROM person_aliases WHERE person_id = ?1 AND guest_id IN (
           SELECT guest_id FROM person_aliases WHERE person_id = ?1
            ORDER BY merged_at DESC, guest_id LIMIT -1 OFFSET ?2)`,
      )
      .bind(person, PERSON_ALIASES_MAX),
  ];
}
