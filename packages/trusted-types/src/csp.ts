// The Trusted Types header and the names of our own policies, the same in every app and on liveworkspace.app
// (livediagram/docs/specs/016-platform/trusted-types.md). Import-free and erasable-only TypeScript, so each app's
// e2e stack (scripts/e2e-stack.mjs) can run it under Node as it is and send the pages' header exactly.
//
// One set of names for every app: a page that renders another app's UI (liveworkspace.app's telemetry dashboard,
// the Explorer served under every app's address) creates the same policies its header already names, so a page
// can never crash because its header named another app's policy.

/** Markup our own builders produced (each escapes what it places), made `TrustedHTML`. Not a sanitiser. */
export const MARKUP_POLICY = 'liveworkspace-markup';
/** A file a person opened, read through `DOMParser` into an inert document. */
export const INERT_PARSE_POLICY = 'liveworkspace-inert-parse';

/** Third parties' own policies a page may let in: Next.js's script helper, ProseMirror's paste parser. */
export const NEXTJS_POLICY = 'nextjs';
export const PROSEMIRROR_CLIPBOARD_POLICY = 'ProseMirrorClipboard';

const POLICY_NAME = /^[A-Za-z0-9-]+$/;

/**
 * The enforced header: Trusted Types for every script sink, and only the named policies (then `default`, which
 * every page's boot script creates). Each page names just the policies it may create.
 */
export function trustedTypesCsp(policies: readonly string[]): string {
  for (const name of policies)
    if (!POLICY_NAME.test(name) || name === 'default')
      throw new Error(`[trusted-types] not a policy name: ${name}`);
  return [
    "require-trusted-types-for 'script'",
    `trusted-types ${[...policies, 'default'].join(' ')}`,
  ].join('; ');
}
