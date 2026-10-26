// Where this Worker's cookies live (liveworkspace/docs/specs/003-accounts/accounts.md "The move to www."). In production every cookie it
// sets (Better Auth's session and dont_remember, the lw_guest guest cookie, the hand-off nonce) is on
// `Domain=liveworkspace.app`, so one session is valid on www.liveworkspace.app and on the bare domain alike. Staging
// and local development have one host each and keep host-only cookies.

import type { Env } from './env.ts';

/** The domain production's cookies are scoped to. */
export const PRODUCTION_COOKIE_DOMAIN = 'liveworkspace.app';

/** This deployment's cookie domain, or undefined for host-only cookies. */
export function cookieDomain(environment: Env['ENVIRONMENT']): string | undefined {
  return environment === 'production' ? PRODUCTION_COOKIE_DOMAIN : undefined;
}

/** The `; Domain=…` attribute for a Set-Cookie written by hand, or nothing. */
export function domainAttribute(domain: string | undefined): string {
  return domain ? `; Domain=${domain}` : '';
}

/** A cleared cookie, written by hand: on the domain, and also host-only, so a copy made before the move goes as well.
 *  `attributes` starts with `; ` (Path, HttpOnly and the like). */
export function clearedCookies(
  name: string,
  attributes: string,
  domain: string | undefined,
): string[] {
  const hostOnly = `${name}=; Max-Age=0${attributes}`;
  return domain ? [`${hostOnly}${domainAttribute(domain)}`, hostOnly] : [hostOnly];
}
