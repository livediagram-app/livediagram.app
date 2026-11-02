// The code that confirms closing an account (liveworkspace/docs/specs/003-accounts/sign-in.md "Closing an account"). Being
// signed in is not enough to close one: a session left open on a shared machine would let anyone do it. So an app's
// server asks for a code to be emailed to the account's own address, checks the one the person types before deleting
// its own data, and closes the account with it (delete-account.ts), which checks it again and spends it.
//
// The code keeps the sign-in code's rules: 6 digits, 10 minutes, 3 tries, stored hashed, in Better Auth's own
// `verification` table under an identifier of its own, so nothing new is stored. Unlike the email-otp plugin's check
// (a read, then a separate write), each try is counted in one atomic write, so guesses sent at once each take a try.
import { clientApp } from './clients.ts';
import { introspectCaller, type CallerConfig } from './app-caller.ts';

export const DELETION_CODE_PATH = '/delete-account/code';
export const DELETION_CHECK_PATH = '/delete-account/check';
export const DELETION_CODE_TTL_SECONDS = 600;
export const DELETION_CODE_TRIES = 3;

const CODE_DIGITS = 6;
const CODE_SPACE = 10 ** CODE_DIGITS;
// The largest multiple of a million a Uint32 holds: a draw at or above it is drawn again, so every code is as likely.
const UNBIASED_CEILING = Math.floor(2 ** 32 / CODE_SPACE) * CODE_SPACE;

export type CodeCheck = 'ok' | 'invalid_code' | 'too_many_attempts';

const identifierOf = (userId: string) => `delete-account-otp-${userId}`;

export const isCodeShape = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9]{6}$/.test(value);

/** A fresh 6-digit code, every value equally likely. */
export function newDeletionCode(
  draw: (into: Uint32Array) => Uint32Array = (into) => crypto.getRandomValues(into),
): string {
  const one = new Uint32Array(1);
  for (;;) {
    const value = draw(one)[0]!;
    if (value < UNBIASED_CEILING) return String(value % CODE_SPACE).padStart(CODE_DIGITS, '0');
  }
}

// Bound to the account, so the same code for two accounts never stores the same value.
async function hashOf(userId: string, code: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${userId}:${code}`),
  );
  let binary = '';
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Compares two hashes in time that doesn't depend on where they differ.
function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Stores `code` for the account, replacing any code it had, for the next 10 minutes. */
export async function storeDeletionCode(
  db: D1Database,
  userId: string,
  code: string,
  now = Date.now(),
): Promise<void> {
  const identifier = identifierOf(userId);
  const at = new Date(now).toISOString();
  const expiresAt = new Date(now + DELETION_CODE_TTL_SECONDS * 1000).toISOString();
  await db.batch([
    db.prepare('DELETE FROM verification WHERE identifier = ?').bind(identifier),
    db
      .prepare(
        'INSERT INTO verification (id, identifier, value, expiresAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .bind(crypto.randomUUID(), identifier, `${await hashOf(userId, code)}:0`, expiresAt, at, at),
  ]);
}

/**
 * Checks `code` against the account's, taking one try. `spend` deletes it when right (closing the account); otherwise a
 * right code is kept with its tries given back, so the close that follows the check can use it.
 */
export async function checkDeletionCode(
  db: D1Database,
  userId: string,
  code: string,
  { spend, now = Date.now() }: { spend: boolean; now?: number },
): Promise<CodeCheck> {
  // The try is counted first, in one write: the value is `<hash>:<tries>`, and the hash never holds a colon.
  const row = await db
    .prepare(
      `UPDATE verification
         SET value = substr(value, 1, instr(value, ':')) || (CAST(substr(value, instr(value, ':') + 1) AS INTEGER) + 1),
             updatedAt = ?
       WHERE identifier = ?
       RETURNING id, value, expiresAt`,
    )
    .bind(new Date(now).toISOString(), identifierOf(userId))
    .first<{ id: string; value: string; expiresAt: string }>();
  if (!row) return 'invalid_code';
  const remove = () => db.prepare('DELETE FROM verification WHERE id = ?').bind(row.id).run();
  if (new Date(row.expiresAt).getTime() <= now) {
    await remove();
    return 'invalid_code';
  }
  const colon = row.value.lastIndexOf(':');
  const stored = row.value.slice(0, colon);
  const tries = Number(row.value.slice(colon + 1));
  if (tries > DELETION_CODE_TRIES) {
    await remove();
    return 'too_many_attempts';
  }
  if (!isCodeShape(code) || !sameHash(stored, await hashOf(userId, code))) {
    if (tries < DELETION_CODE_TRIES) return 'invalid_code';
    await remove();
    return 'too_many_attempts';
  }
  // Only while the row still holds what this check wrote: of two closes sent at once, one spends it.
  const settled = spend
    ? await db
        .prepare('DELETE FROM verification WHERE id = ? AND value = ?')
        .bind(row.id, row.value)
        .run()
    : await db
        .prepare('UPDATE verification SET value = ? WHERE id = ? AND value = ?')
        .bind(`${stored}:0`, row.id, row.value)
        .run();
  return settled.meta.changes === 1 ? 'ok' : 'invalid_code';
}

export interface DeletionCodeConfig extends CallerConfig {
  // Sending: the sign-in send's own per-address bucket (rate-limit.ts), so the two together can't flood an inbox.
  emailLimiter?: RateLimit;
  // Checking and closing: per account, since the caller is always an app's server.
  checkLimiter?: RateLimit;
  send: (to: string, code: string, app: Awaited<ReturnType<typeof clientApp>>) => Promise<void>;
}

const answer = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

/** Whether this account may try a code now (checking or closing). */
export async function underCheckLimit(limiter: RateLimit | undefined, userId: string) {
  return !limiter || (await limiter.limit({ key: `account:${userId}` })).success;
}

/** `POST /api/auth/delete-account/code`: emails the account a new code. */
export async function sendDeletionCode(
  request: Request,
  db: D1Database,
  config: DeletionCodeConfig,
): Promise<Response> {
  const caller = await introspectCaller(request, config);
  if (!caller.ok) return caller.response;
  const email = await db
    .prepare('SELECT email FROM "user" WHERE id = ?')
    .bind(caller.userId)
    .first<string>('email');
  if (!email) return answer({ error: 'unknown_account' }, 404);
  if (
    config.emailLimiter &&
    !(await config.emailLimiter.limit({ key: `email:${email.trim().toLowerCase()}` })).success
  ) {
    return answer({ error: 'rate_limited' }, 429);
  }
  const code = newDeletionCode();
  await storeDeletionCode(db, caller.userId, code);
  await config.send(email, code, await clientApp(db, caller.clientId));
  return answer({ sent: true });
}

/** `POST /api/auth/delete-account/check`: whether the code is right, keeping it for the close. */
export async function checkDeletionCodeRoute(
  request: Request,
  db: D1Database,
  config: DeletionCodeConfig,
): Promise<Response> {
  const caller = await introspectCaller(request, config);
  if (!caller.ok) return caller.response;
  if (!(await underCheckLimit(config.checkLimiter, caller.userId))) {
    return answer({ error: 'rate_limited' }, 429);
  }
  const checked = await checkDeletionCode(db, caller.userId, String(caller.body.code ?? ''), {
    spend: false,
  });
  return checked === 'ok' ? answer({ ok: true }) : answer({ error: checked }, 403);
}
