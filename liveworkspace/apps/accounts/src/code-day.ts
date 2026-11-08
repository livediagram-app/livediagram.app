// An address's day of email codes (liveworkspace/docs/specs/003-accounts/sign-in.md "A day's codes per address"). The
// per-minute limiters (rate-limit.ts) bound bursts, but a new code resets its three tries, so on their own they let
// someone guess at one address all day. Here each address gets a 24 hour window in D1, from its first code:
// CODE_SENDS_PER_DAY codes are all it is mailed, so at most CODE_SENDS_PER_DAY * 3 guesses a day. Checks are not
// counted: they need no Turnstile, so a lock on them would let anyone shut an address out for free.

export const CODE_DAY_MS = 24 * 60 * 60 * 1000;
export const CODE_SENDS_PER_DAY = 20;
// Ended windows deleted per cron run, the oldest first.
export const CODE_DAY_SWEEP_LIMIT = 5_000;

/** The 429 the sign-in page tells apart from the per-minute one (apps/site SignInFlow). */
export const TOO_MANY_CODES = 'TOO_MANY_CODES';

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

/** Before a send: one read. True when the address has had its day's codes. */
export async function overSends(db: D1Database, key: string, now = Date.now()): Promise<boolean> {
  const sends = await db
    .prepare('SELECT sends FROM sign_in_code_limit WHERE emailHash = ? AND windowStart > ?')
    .bind(key, now - CODE_DAY_MS)
    .first<number>('sends');
  return (sends ?? 0) >= CODE_SENDS_PER_DAY;
}

/** After Better Auth accepted a send (Turnstile passed, the code mailed): one upsert. A window that ended starts
 *  again at `now` with this send alone. */
export async function countSend(db: D1Database, key: string, now = Date.now()): Promise<void> {
  await db
    .prepare(
      `INSERT INTO sign_in_code_limit (emailHash, windowStart, sends) VALUES (?1, ?2, 1)
       ON CONFLICT (emailHash) DO UPDATE SET
         sends = CASE WHEN windowStart <= ?3 THEN 1 ELSE sends + 1 END,
         windowStart = CASE WHEN windowStart <= ?3 THEN ?2 ELSE windowStart END`,
    )
    .bind(key, now, now - CODE_DAY_MS)
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

/** A send (`answer`, Better Auth's) held to the address's day: refused once it has had its codes, counted once
 *  Better Auth accepted it. A body with no email is left to Better Auth. A count that fails after the answer is only
 *  logged: the code went either way. */
export async function withCodeDay(
  request: Request,
  db: D1Database,
  answer: () => Promise<Response>,
): Promise<Response> {
  const email = await emailOfRequest(request);
  if (!email) return answer();
  const key = await addressKey(email);
  if (await overSends(db, key)) return tooManyCodes();
  const response = await answer();
  if (response.ok) {
    await countSend(db, key).catch((error: unknown) =>
      console.error('[code-day] count failed', error),
    );
  }
  return response;
}

/** The refusal: a 429 the sign-in page names by its code. */
export function tooManyCodes(): Response {
  return Response.json(
    { code: TOO_MANY_CODES, message: 'Too many codes sent to this address today' },
    { status: 429, headers: { 'cache-control': 'no-store' } },
  );
}
