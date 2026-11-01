// A closed account's webhooks (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Closing an account",
// webhooks.md "Security"): those for its own items, and those of a team that closed with it, are deleted (their
// deliveries with them); those it made for a team that outlives it are paused, their creator `deleted`, for another
// admin to resume. One batch: a person has at most a few dozen.

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
        `DELETE FROM webhooks WHERE scope = 'p:' || ?1
           OR scope IN (SELECT 't:' || value FROM json_each(?2))`,
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
