// Our named HTML policies, made once per page (livediagram/docs/specs/016-platform/trusted-types.md "Our policies").
// Shared by the one path for markup (html.ts) and the sanitiser (sanitize.ts), so DOMPurify parses through the same
// policy html.ts's sinks mint with.

export type HtmlPolicy = {
  createHTML(input: string): TrustedHTML;
  createScriptURL(input: string): unknown;
};
type TrustedTypesFactory = {
  createPolicy(name: string, rules: { createHTML: (input: string) => string }): HtmlPolicy;
};

// One policy per name per page (a second createPolicy with the same name throws); null where the browser has no
// Trusted Types. One module for every app's UI, so a page that renders two apps' components still creates each once.
const policies = new Map<string, HtmlPolicy | null>();

/** The named pass-through policy, created on first use; null without Trusted Types (the prerender, jsdom). */
export function htmlPolicy(name: string): HtmlPolicy | null {
  if (!policies.has(name)) {
    const factory = (globalThis as { trustedTypes?: TrustedTypesFactory }).trustedTypes;
    policies.set(
      name,
      factory ? factory.createPolicy(name, { createHTML: (input) => input }) : null,
    );
  }
  return policies.get(name)!;
}

/** Forgets the policies made so far, so each test starts from a fresh page. */
export function resetPolicies(): void {
  policies.clear();
}
