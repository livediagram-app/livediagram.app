import { SECURITY_POLICY_URL, securityTxtResponse } from '@liveworkspace/sites/security';
import { PRODUCTION_WORKSPACE_ORIGIN } from '@liveworkspace/sites/workspace-proxy';

// liveworkspace.app's RFC 9116 file (liveworkspace/docs/specs/010-site/site.md "Security reporting"), from the
// builder every app's site uses. Its policy is the repository's SECURITY.md on GitHub, which covers every site.
// Required for `output: 'export'`: resolved once at build time, so Expires rolls forward on every deploy.
export const dynamic = 'force-static';

export function GET(): Response {
  return securityTxtResponse({ origin: PRODUCTION_WORKSPACE_ORIGIN, policy: SECURITY_POLICY_URL });
}
