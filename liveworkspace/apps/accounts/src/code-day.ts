// An address's day of email codes (liveworkspace/docs/specs/003-accounts/sign-in.md "A day's codes per address"). The
// per-minute limiters (rate-limit.ts) bound bursts, but a new code resets its three tries, so on their own they let
// someone guess at one address all day. Here each address gets a 24 hour window in D1, from its first send or check:
// CODE_CHECKS_PER_DAY checks that never succeeded lock signing in with a code for the rest of it, and
// CODE_SENDS_PER_DAY codes are all it is mailed. Google still signs the person in.

export const CODE_DAY_MS = 24 * 60 * 60 * 1000;
export const CODE_CHECKS_PER_DAY = 10;
export const CODE_SENDS_PER_DAY = 20;
// Ended windows deleted per cron run, the oldest first.
export const CODE_DAY_SWEEP_LIMIT = 5_000;

/** The 429 the sign-in page tells apart from the per-minute one (apps/site SignInFlow). */
export const CODE_SIGN_IN_LOCKED = 'CODE_SIGN_IN_LOCKED';
export const TOO_MANY_CODES = 'TOO_MANY_CODES';

export type CodeRefusal = typeof CODE_SIGN_IN_LOCKED | typeof TOO_MANY_CODES;

const encoder = new TextEncoder();

/** The key an address is counted under: the SHA-256 of its trimmed, lower-case form, so an address nobody signed up
 *  with is never stored. */
export async function addressKey(email: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(email.trim().toLowerCase()));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** The email a code request names, or null (left to Better Auth's own validation). Reads a clone. */
export async function emailOfRequest(request: Request): Promise<string | null> {
  try {
    const body = (await request.clone().json()) as { email?: unknown };
    return typeof body.email === 'string' && body.email.trim() ? body.email : null;
  } catch {
    return null;
  }
}

/** Before a send: one read. Locked, or the day's sends used up, refuses it. */
export async function refuseSend(
  db: D1Database,
  key: string,
  now = Date.now(),
): Promise<CodeRefusal | null> {
  const row = await db
    .prepare(
      'SELECT sends, failures FROM sign_in_code_limit WHERE emailHash = ? AND windowStart > ?',
    )
    .bind(key, now - CODE_DAY_MS)
    .first<{ sends: number; failures: number }>();
  if (!row) return null;
  if (row.failures >= CODE_CHECKS_PER_DAY) return CODE_SIGN_IN_LOCKED;
  if (row.sends >= CODE_SENDS_PER_DAY) return TOO_MANY_CODES;
  return null;
}

// One upsert: a window that ended starts again at `now` with this event alone; otherwise the column goes up by one.
// SQLite evaluates every SET expression against the old row, so the three CASEs agree.
const BUMP = (column: 'sends' | 'failures') =>
  `INSERT INTO sign_in_code_limit (emailHash, windowStart, sends, failures)
   VALUES (?1, ?2, ${column === 'sends' ? '1, 0' : '0, 1'})
   ON CONFLICT (emailHash) DO UPDATE SET
     windowStart = CASE WHEN windowStart <= ?3 THEN ?2 ELSE windowStart END,
     sends = CASE WHEN windowStart <= ?3 THEN ${column === 'sends' ? 1 : 0} ELSE sends ${column === 'sends' ? '+ 1' : ''} END,
     failures = CASE WHEN windowStart <= ?3 THEN ${column === 'failures' ? 1 : 0} ELSE failures ${column === 'failures' ? '+ 1' : ''} END
   RETURNING failures`;

/** After Better Auth accepted a send (Turnstile passed, the code mailed): one upsert. */
export async function countSend(db: D1Database, key: string, now = Date.now()): Promise<void> {
  await db
    .prepare(BUMP('sends'))
    .bind(key, now, now - CODE_DAY_MS)
    .first();
}

/** Before a check reaches Better Auth: counted in one atomic upsert, so checks sent at once each take their own
 *  place. Over the day's checks, the address is locked (a correct code too) until its window ends. */
export async function takeCheck(
  db: D1Database,
  key: string,
  now = Date.now(),
): Promise<CodeRefusal | null> {
  const failures = await db
    .prepare(BUMP('failures'))
    .bind(key, now, now - CODE_DAY_MS)
    .first<number>('failures');
  return (failures ?? 0) > CODE_CHECKS_PER_DAY ? CODE_SIGN_IN_LOCKED : null;
}

/** A check that signed in: its count, and any before it, never were failures. */
export async function clearChecks(db: D1Database, key: string): Promise<void> {
  await db
    .prepare('UPDATE sign_in_code_limit SET failures = 0 WHERE emailHash = ? AND failures > 0')
    .bind(key)
    .run();
}

/** The hourly cron: windows that ended go, up to CODE_DAY_SWEEP_LIMIT, the oldest first. */
export async function sweepCodeDays(db: D1Database, now = Date.now()): Promise<number> {
  const result = await db
    .prepare(
      `DELETE FROM sign_in_code_limit WHERE emailHash IN (
         SELECT emailHash FROM sign_in_code_limit WHERE windowStart <= ? ORDER BY windowStart LIMIT ?)`,
    )
    .bind(now - CODE_DAY_MS, CODE_DAY_SWEEP_LIMIT)
    .run();
  return result.meta.changes ?? 0;
}

/** A code route's answer (`answer`, Better Auth's), held to the address's day. A send is refused when the address is
 *  locked or has had its codes, and counts once Better Auth accepted it; a check counts before Better Auth sees it and
 *  is cleared when it signs in. A body with no email is left to Better Auth. A count that fails after the answer is
 *  only logged: the code went, or the sign-in happened, either way. */
export async function withCodeDay(
  request: Request,
  db: D1Database,
  sending: boolean,
  answer: () => Promise<Response>,
): Promise<Response> {
  const email = await emailOfRequest(request);
  if (!email) return answer();
  const key = await addressKey(email);
  const refusal = sending ? await refuseSend(db, key) : await takeCheck(db, key);
  if (refusal) return codeRefusal(refusal);
  const response = await answer();
  if (response.ok) {
    await (sending ? countSend(db, key) : clearChecks(db, key)).catch((error: unknown) =>
      console.error('[code-day] count failed', error),
    );
  }
  return response;
}

/** The refusal's answer: a 429 the sign-in page names by its `code`. */
export function codeRefusal(code: CodeRefusal): Response {
  return Response.json(
    {
      code,
      message:
        code === CODE_SIGN_IN_LOCKED
          ? 'Too many wrong codes for this address today'
          : 'Too many codes sent to this address today',
    },
    { status: 429, headers: { 'cache-control': 'no-store' } },
  );
}
