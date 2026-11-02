// Trusted Types (docs/specs/016-platform/trusted-types.md): the policies, the `default` policy's rule for script URLs
// and the boot script are built once for every app (@liveworkspace/trusted-types); this adds the header livedocuments's
// pages send. Nothing else of ours creates a policy.

export {
  isAllowedScriptUrl,
  parseInert,
  resetTrustedTypesForTests,
  trustedHtml,
  trustedTypesBootScript,
} from '@liveworkspace/trusted-types';
export { INERT_PARSE_POLICY, MARKUP_POLICY, TRUSTED_TYPES_CSP } from './trusted-types-csp';
