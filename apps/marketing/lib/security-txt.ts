import { REPO_URL, SITE_URL } from '@livediagram/ui';

// RFC 9116 security.txt, served at /.well-known/security.txt by
// app/.well-known/security.txt/route.ts. Built at deploy time so `Expires`
// rolls forward on every deploy and can never go stale.
// See docs/specs/002-project-scope/vulnerability-disclosure.md.

// RFC 9116 §2.5.5 recommends an Expires under a year ahead; a year from each
// build is the longest that still honours it.
export const SECURITY_TXT_VALIDITY_DAYS = 365;

const DAY_MS = 24 * 60 * 60 * 1000;

export const SECURITY_ADVISORY_URL = `${REPO_URL}/security/advisories/new`;
export const SECURITY_POLICY_URL = `${SITE_URL}/help/policies/report-a-vulnerability/`;

export function securityTxt(now: Date): string {
  const expires = new Date(now.getTime() + SECURITY_TXT_VALIDITY_DAYS * DAY_MS);
  return [
    `Contact: ${SECURITY_ADVISORY_URL}`,
    // RFC 3339 without milliseconds, e.g. 2027-10-06T12:00:00Z.
    `Expires: ${expires.toISOString().replace(/\.\d{3}Z$/, 'Z')}`,
    `Policy: ${SECURITY_POLICY_URL}`,
    'Preferred-Languages: en',
    `Canonical: ${SITE_URL}/.well-known/security.txt`,
    '',
  ].join('\n');
}
