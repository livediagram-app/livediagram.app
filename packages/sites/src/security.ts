// Where every site sends security researchers (liveworkspace/docs/specs/001-platform-scope/vulnerability-disclosure.md):
// GitHub private vulnerability reporting on the one public repository, the same for liveworkspace.app and every app.
// The repository's address lives here and nowhere else in code, so renaming it is this one line; security.test.ts
// holds every copy in prose (SECURITY.md files, READMEs, help articles, specs) to it.

/** The public repository, the monorepo every product lives in (it keeps its livediagram name for now). */
export const PUBLIC_REPO_URL = 'https://github.com/livediagram-app/livediagram.app';

/** The private report form: a new security advisory only the reporter and the maintainers can see. */
export const SECURITY_ADVISORY_URL = `${PUBLIC_REPO_URL}/security/advisories/new`;

/** GitHub's page for the repository root's SECURITY.md, which covers every site. */
export const SECURITY_POLICY_URL = `${PUBLIC_REPO_URL}/security/policy`;

// RFC 9116 §2.5.5 recommends an Expires under a year ahead; a year from each build is the longest that honours it.
export const SECURITY_TXT_VALIDITY_DAYS = 365;

const DAY_MS = 24 * 60 * 60 * 1000;

export type SecurityTxtSite = {
  /** The site's canonical origin, its `www.` host (no trailing slash). */
  origin: string;
  /** The page holding the site's vulnerability disclosure policy. */
  policy: string;
};

/** The RFC 9116 file every site serves at /.well-known/security.txt, built at build time so `Expires` rolls
 *  forward on every deploy. */
export function securityTxt(site: SecurityTxtSite, now: Date): string {
  const expires = new Date(now.getTime() + SECURITY_TXT_VALIDITY_DAYS * DAY_MS);
  return [
    `Contact: ${SECURITY_ADVISORY_URL}`,
    // RFC 3339 without milliseconds, e.g. 2027-10-06T12:00:00Z.
    `Expires: ${expires.toISOString().replace(/\.\d{3}Z$/, 'Z')}`,
    `Policy: ${site.policy}`,
    'Preferred-Languages: en',
    `Canonical: ${site.origin}/.well-known/security.txt`,
    '',
  ].join('\n');
}

/** An app's own policy: the help centre's Reporting a Vulnerability article. */
export function appSecurityPolicy(origin: string): string {
  return `${origin}/help/policies/report-a-vulnerability/`;
}

/** The response each site's static route answers with. */
export function securityTxtResponse(site: SecurityTxtSite, now = new Date()): Response {
  return new Response(securityTxt(site, now), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
