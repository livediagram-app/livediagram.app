// The Trusted Types header and the names of our policies (docs/specs/016-platform/trusted-types.md). Import-free, so
// the e2e stack (scripts/e2e-stack.mjs) can run it as is and send the editor's header exactly.

export const MARKUP_POLICY = 'liveplanner-markup';
export const INERT_PARSE_POLICY = 'liveplanner-inert-parse';

// Every policy a page may create: ours, then the third parties' own (Next.js's script helper, ProseMirror's paste
// parser), then `default`.
export const TRUSTED_TYPES_CSP = [
  "require-trusted-types-for 'script'",
  `trusted-types ${MARKUP_POLICY} ${INERT_PARSE_POLICY} nextjs ProseMirrorClipboard default`,
].join('; ');
