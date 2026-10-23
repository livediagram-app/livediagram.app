// The once-only rules of a design's notification emails, kept in the design's own SQLite (design-schema.ts V2), so
// no email about this design goes twice however its triggers race: someone joined (at most one email per
// JOIN_NOTIFY_THROTTLE_MS), and an action assigned or a mention (once per sender, recipient and wording for
// NOTIFY_EMAIL_DEDUPE_MS, at most NOTIFY_EMAILS_PER_SENDER_PER_HOUR per sender). The rules themselves are
// @liveworkspace/auth-client's, shared by every app.

import { NOTIFY_EMAIL_DEDUPE_MS } from '@liveworkspace/auth-client';
import type { DesignEnv } from '../types';

export type NoticeClaim = {
  // What names the email: a fixed word ('join'), or a notifyClaimKey hash.
  key: string;
  // Whose email it is, for the hourly cap.
  sender: string;
  now: number;
  // A claim with the same key at or after this time is a duplicate.
  dedupeSince: number;
  // When set, the sender's claims at or after `rateSince` count against `rateMax`.
  rate?: { since: number; max: number };
};

// True when the email may go: no claim with its key inside the window, and the sender under the cap. The row is
// written (or a lapsed one renewed) by the same statement, so a refused claim writes nothing. Rows past the
// longest window go first, in the same batch: the table holds a day of claims at most.
export async function claimNotice(env: DesignEnv, claim: NoticeClaim): Promise<boolean> {
  const db = env.DESIGN_DB;
  const [, res] = await db.batch([
    db.prepare('DELETE FROM notify_claims WHERE at < ?').bind(claim.now - NOTIFY_EMAIL_DEDUPE_MS),
    db
      .prepare(
        `INSERT INTO notify_claims (key, sender, at)
         SELECT ?1, ?2, ?3
         WHERE ?4 IS NULL OR (SELECT COUNT(*) FROM notify_claims WHERE sender = ?2 AND at >= ?5) < ?4
         ON CONFLICT (key) DO UPDATE SET sender = excluded.sender, at = excluded.at
         WHERE notify_claims.at < ?6`,
      )
      .bind(
        claim.key,
        claim.sender,
        claim.now,
        claim.rate?.max ?? null,
        claim.rate?.since ?? 0,
        claim.dedupeSince,
      ),
  ]);
  return (res?.meta.changes ?? 0) === 1;
}
