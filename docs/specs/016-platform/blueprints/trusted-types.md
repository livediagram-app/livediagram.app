# Trusted Types blueprint

Derived from [Trusted Types](../trusted-types.md).

## Domain and naming

| Term               | Identifier                                         | Meaning                                                                                                                            |
| ------------------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| The header value   | `TRUSTED_TYPES_CSP`                                | `require-trusted-types-for 'script'; trusted-types liveplanner-markup liveplanner-inert-parse nextjs ProseMirrorClipboard default` |
| Markup policy      | `MARKUP_POLICY` (`'liveplanner-markup'`)           | Makes `TrustedHTML` from liveplanner's own builders' markup                                                                        |
| Inert-parse policy | `INERT_PARSE_POLICY` (`'liveplanner-inert-parse'`) | Lets `DOMParser` read a file a person opened                                                                                       |
| Default policy     | `'default'`                                        | The browser's fallback for a plain string at a sink                                                                                |
| Boot script        | `trustedTypesBootScript(assetPrefix, origins)`     | Inline, first in each layout's `<head>`: the default policy and the violation log                                                  |
| Asset prefix       | `''`, `/live`, `/help`, `/telemetry`               | Where an app's own build is served from (`assetPrefix` or `basePath`)                                                              |
| Markup helper      | `trustedHtml(markup)`                              | `TrustedHTML` in a browser with Trusted Types, else the string itself                                                              |
| Inert parse        | `parseInert(source, type)`                         | `DOMParser` through the inert-parse policy                                                                                         |
| Allowed origin     | `trustedScriptOrigins(env)`                        | Third-party script origins the default policy lets through (Clerk's)                                                               |

## Modules

| File                                                         | Responsibility                                                                                                                                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/ui/src/trusted-types-csp.ts`                       | `TRUSTED_TYPES_CSP`, `MARKUP_POLICY`, `INERT_PARSE_POLICY`; import-free, so `scripts/e2e-stack.mjs` runs it as is                                                        |
| `packages/ui/src/trusted-types.ts`                           | `trustedHtml`, `parseInert`, `isAllowedScriptUrl`, `trustedScriptOrigins`, `trustedTypesBootScript`; exported from `@liveplanner/ui` and `@liveplanner/ui/trusted-types` |
| `apps/*/app/layout.tsx` (all four)                           | `TRUSTED_TYPES_BOOT` (the boot script for the app's prefix and key), first in `<head>`; help and telemetry gain a `<head>` for it                                        |
| `apps/live/src/worker.ts`                                    | `Content-Security-Policy: TRUSTED_TYPES_CSP` among its security headers                                                                                                  |
| `apps/{marketing,help,telemetry}/public/_headers`            | The same header on `/*`                                                                                                                                                  |
| `scripts/e2e-stack.mjs`                                      | Sends the header on every HTML response, as production does                                                                                                              |
| Every `dangerouslySetInnerHTML` site                         | `__html: trustedHtml(markup)`                                                                                                                                            |
| Every `innerHTML`, `outerHTML` or `insertAdjacentHTML` write | `el.innerHTML = trustedHtml(markup) as string` (`useFaceFinishPass.ts`, the Marker and Sketch face ink)                                                                  |
| `apps/live/lib/drawio/{envelope,label,library}.ts`           | `parseInert` in place of `new DOMParser().parseFromString`                                                                                                               |

## Behaviour and state

### The default policy (boot script)

The script inlines `isAllowedScriptUrl`'s own source (its `toString()`), so the rule the tests prove is the rule the
page runs, minified or not:

```js
(function () {
  var PREFIX = '/help', ORIGINS = ['https://clerk.example'];
  var allowed = /* isAllowedScriptUrl's source */;
  if (window.trustedTypes && window.trustedTypes.createPolicy) {
    window.trustedTypes.createPolicy('default', {
      createScriptURL: function (url, type, sink) {
        if (allowed(String(url), location.origin, PREFIX, ORIGINS, sink)) return String(url);
        console.error('[trusted-types] script-url-refused ' + url);
        return null; // the browser blocks the sink
      },
      // React DOM's scratch <script> (inert); written <\/script> so the HTML parser never ends this script early.
      createHTML: function (html, type, sink) {
        if (html === '<script><\/script>') return html;
        // Called by hand (no sink): make nothing, so ProseMirror falls back to its own policy.
        if (sink === undefined) throw new TypeError('[trusted-types] the default policy makes no HTML on request');
        console.error('[trusted-types] html-refused ' + html);
        return null;
      },
    });
  }
  addEventListener('securitypolicyviolation', function (e) {
    if (String(e.violatedDirective).indexOf('trusted-types') >= 0)
      console.error('[trusted-types] violation ' + e.violatedDirective + ' ' + (e.sample || ''));
  });
})();
```

`isAllowedScriptUrl(url, pageOrigin, assetPrefix, origins, sink?)`:

1. Parse against the page; unparseable is refused.
2. `blob:` is allowed only when `sink === 'Worker constructor'` and its origin is the page's (Clerk's timers).
3. Anything but `http:` / `https:` is refused.
4. The page's origin with a path starting `<assetPrefix>/_next/` is allowed.
5. Otherwise allowed only when its origin is in `origins`.

No `createScript`, and `createHTML` passes one string alone: an HTML or script string from code without a policy is
refused. Called directly (`trustedTypes.defaultPolicy.createHTML(html)`, no sink argument), `createHTML` throws and
logs nothing: it is not a violation, and a library that probes the default policy first (ProseMirror) then makes its
own named policy. The boot script contains no `</script` anywhere (a test holds it), since it is written into one.

### `trustedHtml` and `parseInert`

1. In a browser with `trustedTypes`, the first call creates the policy (`createHTML: (s) => s`) and keeps it.
2. They return the policy's `TrustedHTML` (`parseInert` hands it to `DOMParser`).
3. Without `trustedTypes` (the prerender, jsdom, a worker scope without enforcement) the string passes through.

### Third-party origins

`trustedScriptOrigins(env)` returns the Clerk frontend API origin decoded from `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
(`pk_<env>_<base64 of "<host>$">`, shape checked by `clerkPublishableKeyOrNull`) and `CLERK_CAPTCHA_ORIGIN`
(`https://challenges.cloudflare.com`, where Clerk's sign-up bot protection loads Cloudflare Turnstile) when it is
set, else `[]`. The sign-up form holds `<div id="clerk-captcha">` (hidden while empty) for the widget to draw into.

## Interfaces and contracts

```ts
export const TRUSTED_TYPES_CSP: string;
export const MARKUP_POLICY: 'liveplanner-markup';
export const INERT_PARSE_POLICY: 'liveplanner-inert-parse';
export function trustedHtml(markup: string): TrustedHTML | string;
export function parseInert(source: string, type: DOMParserSupportedType): Document;
export function isAllowedScriptUrl(
  url: string,
  pageOrigin: string,
  assetPrefix: string,
  origins: readonly string[],
  sink?: string,
): boolean;
export function trustedScriptOrigins(env: { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string }): string[];
export function trustedTypesBootScript(assetPrefix: string, origins: readonly string[]): string;
```

## Errors and edge cases

| Case                                         | Handling                                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| A sink given a plain string by our code      | Blocked and logged; the sinks test fails it before it ships                                  |
| A third-party script URL not allowed         | Blocked, `[trusted-types] script-url-refused`; fixed with that party                         |
| Another app's build (`/live/_next/` on help) | Refused: each app allows its own prefix alone                                                |
| A browser without Trusted Types              | The header is ignored; the helpers pass strings                                              |
| A malformed publishable key                  | No Clerk origin; Clerk's script is refused and logged                                        |
| A prefix or origin that is not one           | `trustedTypesBootScript` throws, so the build fails; what it embeds is JSON with `<` escaped |
| Clerk's timer worker refused (older rule)    | Clerk falls back to page timers and warns; the blob rule prevents it                         |
| Clerk's sign-up CAPTCHA refused (older rule) | Sign-up stops at "The CAPTCHA failed to load"; `CLERK_CAPTCHA_ORIGIN` prevents it            |

## Security and trust

- `trustedHtml` is the only path to `TrustedHTML` for markup, and its callers are the escaping builders; the sinks
  test lists every call site. `parseInert` only parses: nothing from the document is inserted as markup.
- The default policy allows script URLs only: this app's own `/_next/`, named origins, and same-origin `blob:` for a
  worker. `trusted-types` names every policy, so no other code can create one.

## Performance and limits

`createHTML` is an identity: one call per markup render, no parsing.

## Observability

| Fingerprint                          | Level | When                                      |
| ------------------------------------ | ----- | ----------------------------------------- |
| `[trusted-types] violation`          | error | Any Trusted Types violation on the page   |
| `[trusted-types] script-url-refused` | error | The default policy refuses a URL          |
| `[trusted-types] html-refused`       | error | The default policy refuses an HTML string |

## Testing

| Rule                                                 | Test                                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------------- |
| The URL rule, prefixes and the blob worker           | `packages/ui/src/trusted-types.test.ts`: `isAllowedScriptUrl` cases        |
| Clerk origin from the key, and its CAPTCHA           | `trusted-types.test.ts`: `trustedScriptOrigins`                            |
| `trustedHtml` and `parseInert`                       | `trusted-types.test.ts`                                                    |
| The boot script runs the rule and logs               | `trusted-types.test.ts`: `trustedTypesBootScript`                          |
| Every sink uses a policy, direct DOM writes included | `packages/ui/src/trusted-types-sinks.test.ts` (every app and package)      |
| Every layout boots first, with its prefix            | `trusted-types-sinks.test.ts` (prefix read from each `next.config.ts`)     |
| Every app sends the header                           | `trusted-types-sinks.test.ts` (`_headers`); `apps/live/src/worker.test.ts` |
| No violation in the running editor                   | The E2E suite against `scripts/e2e-stack.mjs`, which sends the header      |

## Constants and configuration

| Constant            | Value                   | Provenance | Safe range |
| ------------------- | ----------------------- | ---------- | ---------- |
| `TRUSTED_TYPES_CSP` | as in Domain and naming | Spec       | Fixed      |

## Defaults ledger

D9 and D10 in [DEFAULTS.md](DEFAULTS.md).
