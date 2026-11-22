// A share's sign-in rule (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Sharing and access", Work
// Tracker 1330 and 1331): who may open an item's links, one rule over every link as its password is. Require Sign
// In admits signed-in accounts only, never a guest; email domains admit only accounts whose verified email is at one
// of them. The rule is the index's to check, on every door a link opens (access.ts `linkAccess`, lookup.ts), from the
// access token it verified itself (auth.ts `personOf`), never from anything the client says.

import {
  emailDomainOf,
  parseShareDomains,
  suggestedShareDomain,
  type ShareSignInRule,
} from '@liveworkspace/index-client';
import type { Person } from './auth';
import type { RouteContext } from './context';
import type { Env } from './env';
import { badRequest, json } from './http';
import type { ItemRow } from './rows';

// A rule as a link query reads it beside the link (LEFT JOIN share_sign_in): both null when the item has none.
export type SignInColumns = { require_account: number | null; domains: string | null };

// The join every link query adds, as `ss`, and the two columns it reads.
export const SIGN_IN_JOIN = (link: string) =>
  `LEFT JOIN share_sign_in ss ON ss.item_id = ${link}.item_id`;
export const SIGN_IN_COLUMNS = 'ss.require_account, ss.domains';

const domainsOf = (stored: string | null): string[] =>
  stored ? stored.split(' ').filter(Boolean) : [];

/** The stored rule as the wire has it. */
export function ruleOf(columns: Partial<SignInColumns> | null | undefined): ShareSignInRule {
  const domains = domainsOf(columns?.domains ?? null);
  return { requireAccount: columns?.require_account === 1 || domains.length > 0, domains };
}

/** Whether a rule holds anyone back at all. */
export const ruleIsOn = (columns: Partial<SignInColumns> | null | undefined): boolean =>
  ruleOf(columns).requireAccount;

// How the rule refuses: a guest or nobody is asked to sign in, an account at another domain is told it can't open
// it. Both name the domains (and nothing else of the item), so the visitor's page can say who it is for.
const signInRequired = (domains: string[]) =>
  json({ error: 'sign_in_required', domains }, { status: 401 });
const domainNotAllowed = (domains: string[]) =>
  json({ error: 'domain_not_allowed', domains }, { status: 403 });

/** Whether this person passes the rule: null when they do (or there is none), else the refusal to send. */
export function signInRefusal(
  columns: Partial<SignInColumns> | null | undefined,
  person: Person | null,
): Response | null {
  const rule = ruleOf(columns);
  if (!rule.requireAccount) return null;
  if (!person || person.kind !== 'account') return signInRequired(rule.domains);
  if (rule.domains.length === 0) return null;
  const domain = emailDomainOf(person.email);
  return domain && rule.domains.includes(domain) ? null : domainNotAllowed(rule.domains);
}

/** Whether this person passes the rule, for a read that leaves out what it can't open (lookup.ts). */
export const passesSignIn = (
  columns: Partial<SignInColumns> | null | undefined,
  person: Person | null,
) => signInRefusal(columns, person) === null;

/** The domain a team item's domain box starts with: the asker's own, unless a public mail provider's. */
export function suggestedDomainOf(row: ItemRow, person: Person | null): string | null {
  return row.team_id ? suggestedShareDomain(person?.email) : null;
}

/** The item's rule, for its share list. */
export async function readSignIn(env: Env, itemId: string): Promise<SignInColumns | null> {
  return env.INDEX_DB.prepare(
    'SELECT require_account, domains FROM share_sign_in WHERE item_id = ?',
  )
    .bind(itemId)
    .first<SignInColumns>();
}

/** `PUT /items/:id/share-sign-in { requireAccount, domains }`: the item's rule (the caller manages its links).
 *  `tellRescoped` reloads every link's sessions, for a rule that changed to anything but off. */
export async function putSignIn(
  ctx: RouteContext,
  row: ItemRow,
  body: Record<string, unknown>,
  tellRescoped: () => Promise<void>,
): Promise<Response> {
  const db = ctx.env.INDEX_DB;
  if (typeof body.requireAccount !== 'boolean') return badRequest('invalid_sign_in');
  const given = body.domains ?? [];
  const asText = typeof given === 'string';
  if (!asText && !(Array.isArray(given) && given.every((d) => typeof d === 'string'))) {
    return badRequest('invalid_sign_in');
  }
  const parsed = parseShareDomains(given as string | string[]);
  if (!parsed.ok) {
    return parsed.tooMany
      ? badRequest('too_many_domains')
      : json({ error: 'invalid_domain', domain: parsed.invalid.slice(0, 260) }, { status: 400 });
  }
  const domains = parsed.domains;
  const next: SignInColumns = {
    // Domains imply Require Sign In.
    require_account: body.requireAccount || domains.length > 0 ? 1 : 0,
    domains: domains.length > 0 ? domains.join(' ') : null,
  };
  const stored = await readSignIn(ctx.env, row.id);
  const same =
    (stored?.require_account ?? 0) === next.require_account &&
    (stored?.domains ?? null) === next.domains;
  const signIn = ruleOf(next);
  if (same) return json({ signIn });
  if (!signIn.requireAccount) {
    // Off: the row goes, and nobody is sent away.
    await db.prepare('DELETE FROM share_sign_in WHERE item_id = ?').bind(row.id).run();
    return json({ signIn });
  }
  // A changed rule holds for everyone already in: their Shared with me rows go, and every link's sessions reload
  // into the check, so a guest inside meets the restricted page. Whoever still passes is recorded again on entry.
  await db.batch([
    db
      .prepare(
        `INSERT INTO share_sign_in (item_id, require_account, domains, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (item_id) DO UPDATE SET require_account = excluded.require_account,
           domains = excluded.domains, updated_at = excluded.updated_at`,
      )
      .bind(row.id, next.require_account, next.domains, Date.now()),
    db.prepare('DELETE FROM shared_with WHERE item_id = ?').bind(row.id),
  ]);
  await tellRescoped();
  return json({ signIn });
}
