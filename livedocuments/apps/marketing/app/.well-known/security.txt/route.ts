import { SITE_URL } from '@livedocuments/ui';
import { appSecurityPolicy, securityTxtResponse } from '@liveworkspace/sites/security';

// The RFC 9116 file every liveworkspace site serves, from the one shared builder
// (docs/specs/002-project-scope/vulnerability-disclosure.md "security.txt").
// Required for `output: 'export'` (see app/robots.ts): resolved once at build
// time into out/.well-known/security.txt, so Expires rolls forward on every deploy.
export const dynamic = 'force-static';

export function GET(): Response {
  return securityTxtResponse({ origin: SITE_URL, policy: appSecurityPolicy(SITE_URL) });
}
