// The once-only rules of an item's notification emails (@liveworkspace/auth-client notify.ts holds the numbers),
// for every app:
//
// - Once per key: someone joined (one email per JOIN_NOTIFY_THROTTLE_MS), and an action assigned or a mention (the
//   same sender, recipient and wording once per NOTIFY_EMAIL_DEDUPE_MS). Claimed in the item's own SQLite, in its
//   `notify_claims` table (`key TEXT PRIMARY KEY, sender TEXT NOT NULL, at INTEGER NOT NULL`, indexed on `at`), so
//   two triggers racing send one email. The table holds a day of claims at most.
// - Per sender, across every item: at most NOTIFY_EMAILS_PER_SENDER_PER_HOUR. Taken from the sender's own
//   allowance at liveworkspace (`accountsAllowance`: the sender's per-person store in the accounts Worker, kept per
//   app), so someone who mentions people in fifty items in an hour is capped the same as in one.
//
// A claim the allowance refuses is released again, so the same email may go once the hour allows. An allowance that
// can't be reached sends nothing: the email is the sender's words, and the cap is what keeps them from becoming spam.

import {
  NOTIFY_EMAIL_DEDUPE_MS,
  takeAllowance,
  type ClientCredentials,
} from '@liveworkspace/auth-client';

// The allowance kind the notification emails count against.
export const NOTIFY_QUOTA_KIND = 'notify-email';

export type NoticeClaim = {
  // What names the email: a fixed word ('join'), or a notifyClaimKey hash.
  key: string;
  // Whose email it is.
  sender: string;
  now: number;
  // A claim with the same key at or after this time is a duplicate.
  dedupeSince: number;
  // When set, the email also counts against the sender's allowance: at most `max` in any `windowMs`.
  rate?: { max: number; windowMs: number };
};

// The sender's allowance (accountsAllowance: their store at liveworkspace, kept per app): takes up to
// `count` uses and answers how many it took.
export type SenderAllowance = (input: {
  personId: string;
  kind: string;
  max: number;
  windowMs: number;
  now: number;
  count: number;
}) => Promise<number>;

type ClaimsDb = Pick<D1Database, 'prepare' | 'batch'>;

/** Which of these emails may go, in order: each claimed once per key in the item, then those with a rate taken from
 *  their sender's allowance in one call per sender (earliest first). A refused claim leaves nothing behind. */
export async function claimNotices(
  db: ClaimsDb,
  claims: readonly NoticeClaim[],
  allowance?: SenderAllowance,
): Promise<boolean[]> {
  if (claims.length === 0) return [];
  const now = Math.max(...claims.map((c) => c.now));
  const results = await db.batch([
    db.prepare('DELETE FROM notify_claims WHERE at < ?').bind(now - NOTIFY_EMAIL_DEDUPE_MS),
    ...claims.map((claim) =>
      db
        .prepare(
          `INSERT INTO notify_claims (key, sender, at) VALUES (?1, ?2, ?3)
           ON CONFLICT (key) DO UPDATE SET sender = excluded.sender, at = excluded.at
           WHERE notify_claims.at < ?4`,
        )
        .bind(claim.key, claim.sender, claim.now, claim.dedupeSince),
    ),
  ]);
  const allowed = claims.map((_, i) => (results[i + 1]?.meta.changes ?? 0) === 1);
  // The claims that won and count against an allowance, by sender and rule.
  const groups = new Map<string, number[]>();
  claims.forEach((claim, i) => {
    if (!allowed[i] || !claim.rate) return;
    const group = `${claim.sender}\n${claim.rate.max}\n${claim.rate.windowMs}`;
    groups.set(group, [...(groups.get(group) ?? []), i]);
  });
  const released: number[] = [];
  for (const indexes of groups.values()) {
    const first = claims[indexes[0]!]!;
    let taken = 0;
    try {
      taken = allowance
        ? await allowance({
            personId: first.sender,
            kind: NOTIFY_QUOTA_KIND,
            max: first.rate!.max,
            windowMs: first.rate!.windowMs,
            now: first.now,
            count: indexes.length,
          })
        : 0;
    } catch (err) {
      console.warn('[notify-email] the sender allowance could not be reached', {
        error: String(err),
      });
    }
    for (const i of indexes.slice(taken)) {
      allowed[i] = false;
      released.push(i);
    }
  }
  if (released.length > 0) {
    await db.batch(
      released.map((i) =>
        db
          .prepare('DELETE FROM notify_claims WHERE key = ? AND at = ?')
          .bind(claims[i]!.key, claims[i]!.now),
      ),
    );
  }
  return allowed;
}

/** One email's claim (claimNotices for one). */
export async function claimNotice(
  db: ClaimsDb,
  claim: NoticeClaim,
  allowance?: SenderAllowance,
): Promise<boolean> {
  const [allowed] = await claimNotices(db, [claim], allowance);
  return allowed === true;
}

// The allowance in each sender's own store at liveworkspace, with the app's client credentials. No credentials
// (a deployment not yet on liveworkspace accounts): nothing is taken, so nothing is sent.
export const accountsAllowance =
  (credentials: ClientCredentials | null, fetcher?: typeof fetch): SenderAllowance =>
  async ({ personId, kind, max, windowMs, count }) => {
    if (!credentials) return 0;
    return takeAllowance(credentials, { personId, kind, max, windowMs, count }, fetcher);
  };
