// Trusted Types (docs/specs/016-platform/trusted-types.md): the policies, the `default` policy's rule for script URLs
// and the boot script are built once for every app (@liveworkspace/trusted-types); this adds the header livediagram's
// pages send. Nothing else of ours creates a policy.

export {
  isAllowedScriptUrl,
  parseInert,
  resetTrustedTypesForTests,
  trustedHtml,
  trustedTypesBootScript,
} from '@liveworkspace/trusted-types';
export { INERT_PARSE_POLICY, MARKUP_POLICY, TRUSTED_TYPES_CSP } from './trusted-types-csp';

/**
 * Google's browser libraries for the Drive mirror (docs/specs/022-drive-mirror/drive-mirror.md): Identity Services
 * (`accounts.google.com/gsi/client`) for its tokens, and the API loader (`apis.google.com/js/api.js`), which loads the
 * Picker for Show Folder from the same origin. Refused, Show Folder failed silently ("adopt-failed").
 */
const GOOGLE_SCRIPT_ORIGINS = ['https://accounts.google.com', 'https://apis.google.com'];

/**
 * Google's two script origins, for a build that offers the Drive mirror (a Google client id), and only then.
 */
export function trustedScriptOrigins(env: { NEXT_PUBLIC_GOOGLE_CLIENT_ID?: string }): string[] {
  return env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? [...GOOGLE_SCRIPT_ORIGINS] : [];
}
