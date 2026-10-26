// Throwaway accounts for the apps' local evaluation benches (each app's apps/mcp/eval/bench): an account and one
// API token each, so every bench run gets its own empty library on a local stack. Development only, behind
// ADMIN_TOKEN as client registration is: anywhere else the path does not exist.
//
//   POST /api/auth/internal/bench-accounts  {count, name?}  →  201 {accounts: [{userId, token}]}

import { AUTH_BASE_PATH } from './auth-options.ts';
import type { Env } from './env.ts';
import { newUserId } from './ids.ts';
import { sameSecret } from './secrets.ts';
import { cleanTokenName, mintApiToken } from './tokens.ts';

export const BENCH_ACCOUNTS_PATH = `${AUTH_BASE_PATH}/internal/bench-accounts`;
// Accounts one call makes: a round's runs.
export const BENCH_ACCOUNTS_MAX = 200;

const json = (body: unknown, status: number) => Response.json(body, { status });

export async function benchAccounts(
  request: Request,
  env: Env,
  now = Date.now(),
): Promise<Response> {
  if (env.ENVIRONMENT !== 'development') return new Response('Not found', { status: 404 });
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  if (!env.ADMIN_TOKEN || !(await sameSecret(token, env.ADMIN_TOKEN))) {
    return new Response('Unauthorized', { status: 401 });
  }
  // `null` parses, and has no fields: read as an empty body, so a 400, never a TypeError.
  const body = ((await request.json().catch(() => null)) ?? {}) as {
    count?: unknown;
    name?: unknown;
  };
  const count = body.count;
  if (
    typeof count !== 'number' ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > BENCH_ACCOUNTS_MAX
  ) {
    return json({ error: 'bad_request', message: `count must be 1 to ${BENCH_ACCOUNTS_MAX}` }, 400);
  }
  const name = cleanTokenName(body.name, 'bench');
  const at = new Date(now).toISOString();
  const db = env.AUTH_DB;
  const ids = Array.from({ length: count }, () => newUserId());
  await db.batch(
    ids.map((id, i) =>
      db
        .prepare(
          `INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, 1, ?, ?)`,
        )
        .bind(id, `${name} ${i + 1}`, `${id}@bench.invalid`, at, at),
    ),
  );
  const accounts: { userId: string; token: string }[] = [];
  for (const userId of ids) {
    const minted = await mintApiToken(db, userId, { name, readOnly: false }, now);
    if (!minted) return json({ error: 'token_limit_reached' }, 409);
    accounts.push({ userId, token: minted.secret });
  }
  return json({ accounts }, 201);
}
