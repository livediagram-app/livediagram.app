// Trusted Types (docs/specs/016-platform/trusted-types.md): the enforced header, our three policies, and the rule
// the `default` policy applies to script URLs. Nothing else of ours creates a policy.
import { clerkPublishableKeyOrNull } from './clerk-key';

import { INERT_PARSE_POLICY, MARKUP_POLICY } from './trusted-types-csp';

export { INERT_PARSE_POLICY, MARKUP_POLICY, TRUSTED_TYPES_CSP } from './trusted-types-csp';

type HtmlPolicy = { createHTML(input: string): TrustedHTML };
type TrustedTypesFactory = {
  createPolicy(name: string, rules: { createHTML: (input: string) => string }): HtmlPolicy;
};

// One policy per name per page; null where the browser has no Trusted Types.
const policies = new Map<string, HtmlPolicy | null>();
function htmlPolicy(name: string): HtmlPolicy | null {
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
export function resetTrustedTypesForTests(): void {
  policies.clear();
}

/**
 * Markup one of livepages's own builders produced (each escapes what it places), as `TrustedHTML` for
 * `dangerouslySetInnerHTML`. Only those builders' output may come through here; it is not a sanitiser.
 */
export function trustedHtml(markup: string): TrustedHTML | string {
  return htmlPolicy(MARKUP_POLICY)?.createHTML(markup) ?? markup;
}

/** A file a person opened, read through `DOMParser`. The document is inert: nothing in it runs or is inserted. */
export function parseInert(source: string, type: DOMParserSupportedType): Document {
  const policy = htmlPolicy(INERT_PARSE_POLICY);
  return new DOMParser().parseFromString((policy?.createHTML(source) ?? source) as string, type);
}

/**
 * Whether a script URL may load: this app's own build, under its asset prefix (`/_next/` for marketing, `/live/_next/`,
 * `/help/_next/` and so on) on the page's origin, one on a named third-party origin, or (for a worker alone) one of
 * the page's own blob: URLs. Self-contained, because the boot script inlines its source.
 */
export function isAllowedScriptUrl(
  url: string,
  pageOrigin: string,
  assetPrefix: string,
  origins: readonly string[],
  sink?: string,
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url, pageOrigin + '/');
  } catch {
    return false;
  }
  // A worker may start from the page's own blob: URL (Clerk's session timers): only script already running on this
  // origin can mint one, and a worker has no DOM. No other sink takes a blob: URL.
  if (parsed.protocol === 'blob:')
    return sink === 'Worker constructor' && parsed.origin === pageOrigin;
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
  if (parsed.origin === pageOrigin && parsed.pathname.indexOf(assetPrefix + '/_next/') === 0)
    return true;
  return origins.indexOf(parsed.origin) >= 0;
}

/**
 * Where Clerk's bot protection loads Cloudflare Turnstile from (`/turnstile/v0/api.js`) when the instance asks for a
 * CAPTCHA on sign-up; refused, sign-up stops at "The CAPTCHA failed to load".
 */
const CLERK_CAPTCHA_ORIGIN = 'https://challenges.cloudflare.com';

/**
 * Google's browser libraries for the Drive mirror (docs/specs/022-drive-mirror/drive-mirror.md): Identity Services
 * (`accounts.google.com/gsi/client`) for its tokens, and the API loader (`apis.google.com/js/api.js`), which loads the
 * Picker for Show Folder from the same origin. Refused, Show Folder failed silently ("adopt-failed").
 */
const GOOGLE_SCRIPT_ORIGINS = ['https://accounts.google.com', 'https://apis.google.com'];

/**
 * The Clerk frontend API's origin, read from the publishable key (`pk_<env>_<base64 of "<host>$">`), and the origin
 * of the CAPTCHA its sign-up loads; none without a key. Then Google's two script origins, for a build that offers the
 * Drive mirror (a Google client id), and only then.
 */
export function trustedScriptOrigins(env: {
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
  NEXT_PUBLIC_GOOGLE_CLIENT_ID?: string;
}): string[] {
  const google = env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? GOOGLE_SCRIPT_ORIGINS : [];
  return [...clerkScriptOrigins(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY), ...google];
}

function clerkScriptOrigins(publishableKey: string | undefined): string[] {
  // The key's shape is clerkPublishableKeyOrNull's; its body names the frontend API's host.
  const key = clerkPublishableKeyOrNull(publishableKey);
  const match = key ? /^pk_(?:test|live)_([A-Za-z0-9+/=]+)$/.exec(key) : null;
  if (!match) return [];
  try {
    const host = atob(match[1]!).replace(/\$$/, '');
    return /^[a-z0-9.-]+$/i.test(host) ? [`https://${host}`, CLERK_CAPTCHA_ORIGIN] : [];
  } catch {
    return [];
  }
}

/**
 * The inline script first in every layout's <head>: the `default` policy (script URLs by `isAllowedScriptUrl`, and
 * React DOM's empty `<script></script>` alone as HTML), and the log line for every Trusted Types violation. Asked
 * for HTML by hand rather than by a sink, the default policy throws, so it is never a pass-through for anyone.
 */
// What the boot script may embed: a path prefix (`''`, `/live`, `/help`) and plain https origins. Anything else is a
// caller's mistake, refused rather than written into a script.
const ASSET_PREFIX = /^(\/[A-Za-z0-9_-]+)*$/;
const SCRIPT_ORIGIN = /^https:\/\/[A-Za-z0-9.-]+(:[0-9]+)?$/;
// JSON for an inline script: no raw "<", so nothing in it can close the script element.
const inlineJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

export function trustedTypesBootScript(assetPrefix: string, origins: readonly string[]): string {
  if (!ASSET_PREFIX.test(assetPrefix))
    throw new Error(`[trusted-types] not an asset prefix: ${assetPrefix}`);
  for (const origin of origins)
    if (!SCRIPT_ORIGIN.test(origin))
      throw new Error(`[trusted-types] not a script origin: ${origin}`);
  return (
    '(function(){' +
    `var PREFIX=${inlineJson(assetPrefix)};var ORIGINS=${inlineJson(origins)};` +
    `var allowed=${isAllowedScriptUrl.toString()};` +
    "if(window.trustedTypes&&window.trustedTypes.createPolicy){window.trustedTypes.createPolicy('default',{" +
    'createScriptURL:function(url,type,sink){if(allowed(String(url),location.origin,PREFIX,ORIGINS,sink))return String(url);' +
    "console.error('[trusted-types] script-url-refused '+url);return null;}," +
    // React DOM parses an empty script to make a <script> element on a client render; inert, the one HTML let through.
    // Written <\\/script> so the HTML parser never sees a closing tag inside this inline script.
    "createHTML:function(html,type,sink){if(html==='<script><\\/script>')return html;" +
    // Called by hand (no sink: the browser always names one), it creates nothing and throws, so a library that
    // tries the default policy before its own (ProseMirror's clipboard) falls back to its own named policy.
    "if(sink===undefined)throw new TypeError('[trusted-types] the default policy makes no HTML on request');" +
    "console.error('[trusted-types] html-refused '+html);return null;}});}" +
    "addEventListener('securitypolicyviolation',function(e){" +
    "if(String(e.violatedDirective).indexOf('trusted-types')>=0)" +
    "console.error('[trusted-types] violation '+e.violatedDirective+' '+(e.sample||''));});" +
    '})();'
  );
}
