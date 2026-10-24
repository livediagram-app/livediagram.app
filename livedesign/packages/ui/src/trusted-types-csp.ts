// The Trusted Types header every livedesign page sends (docs/specs/016-platform/trusted-types.md), from the one set of
// policies every app shares (@liveworkspace/trusted-types). A file of its own, so the e2e stack (scripts/e2e-stack.mjs)
// can import it under Node and send the pages' header exactly.
import { MARKUP_POLICY, NEXTJS_POLICY, trustedTypesCsp } from '@liveworkspace/trusted-types/csp';

export { MARKUP_POLICY } from '@liveworkspace/trusted-types/csp';

// Every policy a page may create: ours, then the third parties' own (Next.js's script helper), then `default`.
export const TRUSTED_TYPES_CSP = trustedTypesCsp([MARKUP_POLICY, NEXTJS_POLICY]);
