// notify_email_claims (migration 0082): the dedupe and per-sender cap on the team notification emails whose
// text comes from the request body, action-assigned (docs/specs/012-collaboration/assigned-actions.md §4) and
// mentioned (docs/specs/012-collaboration/comment-mentions.md "The email"). One atomic statement decides both, so
// two concurrent requests can neither send the same email twice nor slip past the cap together.

import type { Env } from '../types';

export type NotifyEmailClaim = {
  // A hash naming the email: its kind, sender, document, recipient and text.
  key: string;
  senderId: string;
  now: number;
  // A claim with the same key at or after this time is a duplicate.
  dedupeSince: number;
  // The sender's claims at or after this time count against `rateMax`.
  rateSince: number;
  rateMax: number;
};

// True when this email may be sent: no claim with its key inside the dedupe window, and the sender is under
// the cap. The row is written (or an expired one renewed) in the same statement; false writes nothing.
export async function claimNotifyEmail(env: Env, claim: NotifyEmailClaim): Promise<boolean> {
  const res = await env.DB.prepare(
    `INSERT INTO notify_email_claims (claim_key, sender_id, created_at)
     SELECT ?, ?, ?
     WHERE (SELECT COUNT(*) FROM notify_email_claims WHERE sender_id = ? AND created_at >= ?) < ?
     ON CONFLICT (claim_key) DO UPDATE SET sender_id = excluded.sender_id, created_at = excluded.created_at
     WHERE notify_email_claims.created_at < ?`,
  )
    .bind(
      claim.key,
      claim.senderId,
      claim.now,
      claim.senderId,
      claim.rateSince,
      claim.rateMax,
      claim.dedupeSince,
    )
    .run();
  return res.meta.changes === 1;
}

// Daily retention: a claim past the dedupe window decides nothing any more.
export async function deleteOldNotifyEmailClaims(env: Env, cutoffMs: number): Promise<number> {
  const res = await env.DB.prepare('DELETE FROM notify_email_claims WHERE created_at < ?')
    .bind(cutoffMs)
    .run();
  return res.meta.changes ?? 0;
}
