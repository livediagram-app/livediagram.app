// `migrate rekey-guests --env staging|production [--dry-run]` (docs/migration.md step 6, "Re-keying the guests from
// before signing"): asks the accounts Worker to re-key the old site's unclaimed guests from before signing, in
// batches, until none are left. Accounts does the moving (liveworkspace/apps/accounts/src/legacy-guest-rekey.ts): it
// holds the derivation secret and the index's merge key, holds each row as a claim would while the index moves the
// guest's work and the apps hear of it, then renames the row, so accounts and the index never disagree for long.
// Nothing here touches a database. `--dry-run` prints the counts and a sample and changes nothing.
import type { Env } from './targets.ts';

/** The accounts Worker's own address in each environment (liveworkspace/apps/accounts/wrangler.toml BASE_URL). */
export const ACCOUNTS_ORIGIN: Record<Env, string> = {
  production: 'https://www.liveworkspace.app',
  staging: 'https://staging.liveworkspace.app',
};
export const REKEY_ROUTE = '/api/auth/internal/legacy-guests/rekey';
/** The accounts Worker's ADMIN_TOKEN for that environment. */
export const ADMIN_TOKEN_VAR = 'MIGRATE_ADMIN_TOKEN';
const BATCH = 25;
// More batches than 1,000 guests need: a stop, never a loop without end.
const MAX_BATCHES = 60;

export type Post = (request: {
  url: string;
  headers: Record<string, string>;
  body: string;
}) => Promise<{ status: number; body: string }>;

export type RekeyBatch = { rekeyed: number; skipped: number; failed: number; remaining: number };

export type RekeyGuestsOptions = {
  env: Env;
  dryRun: boolean;
  vars: Record<string, string | undefined>;
  post: Post;
  log: (line: string) => void;
};

/** Runs it; resolves to the guests still left (0 when finished, and always 0 for a dry run). */
export async function rekeyGuests(o: RekeyGuestsOptions): Promise<number> {
  const token = o.vars[ADMIN_TOKEN_VAR];
  if (!token)
    throw new Error(`${ADMIN_TOKEN_VAR} is not set (see liveworkspace/apps/migrate/README.md)`);
  const url = `${ACCOUNTS_ORIGIN[o.env]}${REKEY_ROUTE}`;
  const call = async (body: unknown): Promise<unknown> => {
    const answer = await o.post({
      url,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (answer.status !== 200) {
      // 404: LEGACY_GUEST_REKEY_SECRET is not set on that Worker; 401: the wrong ADMIN_TOKEN.
      throw new Error(`rekey-guests ${o.env}: ${answer.status} ${answer.body.trim()}`);
    }
    return JSON.parse(answer.body) as unknown;
  };

  if (o.dryRun) {
    o.log(JSON.stringify(await call({ dryRun: true }), null, 2));
    return 0;
  }
  const total: RekeyBatch = { rekeyed: 0, skipped: 0, failed: 0, remaining: 0 };
  for (let i = 0; i < MAX_BATCHES; i++) {
    const batch = (await call({ limit: BATCH })) as RekeyBatch;
    total.rekeyed += batch.rekeyed;
    total.skipped += batch.skipped;
    total.failed += batch.failed;
    total.remaining = batch.remaining;
    o.log(
      `batch ${i + 1}: ${batch.rekeyed} re-keyed, ${batch.skipped} skipped, ${batch.failed} failed, ${batch.remaining} left`,
    );
    // Done, or the rest are held by claims under way or failing: a later run picks them up.
    if (batch.remaining === 0 || batch.rekeyed === 0) break;
  }
  o.log(JSON.stringify(total));
  if (total.remaining > 0) {
    o.log(
      `${total.remaining} left: run it again in a minute (a claim or a failed merge held them)`,
    );
  }
  return total.remaining;
}
