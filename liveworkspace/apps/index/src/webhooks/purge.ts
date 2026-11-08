// A closed account's webhooks (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Closing an account",
// webhooks.md "Security"): those on its own documents, and on a team's that closed with it, are deleted (their
// deliveries with them); those it added to a document that outlives it are paused, their creator `deleted`, for
// another of the document's editors to resume. One batch: a person has at most a few dozen.

export function webhookPurgeStatements(
  db: D1Database,
  person: string,
  teams: string,
  anonymised: string,
  now: number,
): D1PreparedStatement[] {
  return [
    db
      .prepare(
        `DELETE FROM webhooks WHERE item_id IN (
           SELECT id FROM items WHERE (owner_id = ?1 AND team_id IS NULL)
             OR team_id IN (SELECT value FROM json_each(?2)))`,
      )
      .bind(person, teams),
    db
      .prepare(
        `UPDATE webhook_deliveries SET state = 'failed', error = 'paused', next_at = ?2
         WHERE state = 'pending' AND webhook_id IN (SELECT id FROM webhooks WHERE created_by = ?1)`,
      )
      .bind(person, now),
    db
      .prepare(
        `UPDATE webhooks SET created_by = ?2, paused_at = COALESCE(paused_at, ?3),
           paused_reason = COALESCE(paused_reason, 'creator_left')
         WHERE created_by = ?1`,
      )
      .bind(person, anonymised, now),
  ];
}
