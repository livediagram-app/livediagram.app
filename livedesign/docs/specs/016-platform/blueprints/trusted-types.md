# Trusted Types blueprint

Derived from [Trusted Types](../trusted-types.md).

## Domain and naming

| Term             | Identifier                                        | Meaning                                                                                      |
| ---------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| The header value | `TRUSTED_TYPES_CSP`                               | `require-trusted-types-for 'script'; trusted-types liveworkspace-markup nextjs default`      |
| Markup policy    | `MARKUP_POLICY` (`'liveworkspace-markup'`)        | Makes `TrustedHTML` from livedesign's own builders' markup                                   |
| Default policy   | `'default'`                                       | The browser's fallback for a plain string at a sink                                          |
| Boot script      | `trustedTypesBootScript(assetPrefix, origins)`    | Inline, first in each layout's `<head>`: the default policy and the violation log            |
| Asset prefix     | `''`, `/live`, `/help`                            | Where an app's own build is served from (`assetPrefix` or `basePath`)                        |
| Markup helper    | `trustedHtml(markup)`                             | `TrustedHTML` in a browser with Trusted Types, else the string itself                        |
| Sanitiser        | `sanitizedHtml(markup, profile)`                  | DOMPurify over people's markup, minted through the markup policy                             |
| Profile          | `MarkupProfile`: `svg`, `svg-content`, `document` | Where the markup goes: into an HTML element, into an `<svg>`, an iframe                      |
| Builder markup   | `builderMarkup` (each product's sinks test)       | The files that may call `trustedHtml` besides a layout                                       |
| Allowed origin   | `origins` (default `[]`)                          | Third-party script origins the default policy lets through; none since sign-in left the page |

## Modules

| File                                                                               | Responsibility                                                                                                                                  |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ui/src/trusted-types-csp.ts`                                             | `TRUSTED_TYPES_CSP`, `MARKUP_POLICY`; import-free, so `scripts/e2e-stack.mjs` runs it as is                                                     |
| `packages/ui/src/trusted-types.ts`                                                 | `trustedHtml`, `isAllowedScriptUrl`, `trustedTypesBootScript`; exported from `@livedesign/ui` and `@livedesign/ui/trusted-types`                |
| `apps/*/app/layout.tsx` (all three)                                                | `TRUSTED_TYPES_BOOT` (the boot script for the app's prefix), first in `<head>`; help and telemetry gain a `<head>` for it                       |
| `apps/live/src/worker.ts`                                                          | `Content-Security-Policy: TRUSTED_TYPES_CSP` among its security headers                                                                         |
| `apps/{marketing,help}/public/_headers`                                            | The same header on `/*`                                                                                                                         |
| `scripts/e2e-stack.mjs`                                                            | Sends the header on every HTML response, as production does                                                                                     |
| `@liveworkspace/trusted-types/sanitize` (`packages/trusted-types/src/sanitize.ts`) | `sanitizedHtml`, `sanitizeMarkup`, the cache; DOMPurify in its own instance                                                                     |
| Every `dangerouslySetInnerHTML` site                                               | `__html: sanitizedHtml(markup, profile)` for a document's drawing; `__html: trustedHtml(markup)` in a layout and the builder-markup files alone |
| Every `innerHTML`, `outerHTML` or `insertAdjacentHTML` write                       | `el.innerHTML = trustedHtml(markup) as string` (`useFaceFinishPass.ts`, the Marker and Sketch face ink)                                         |

## Behaviour and state

### The default policy (boot script)

The script inlines `isAllowedScriptUrl`'s own source (its `toString()`), so the rule the tests prove is the rule the
page runs, minified or not:

```js
(function () {
  var PREFIX = '/help', ORIGINS = [];
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
        // Called by hand (no sink): make nothing, so a library falls back to its own policy.
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
2. `blob:` is allowed only when `sink === 'Worker constructor'` and its origin is the page's. Clerk's session timers
   needed it; since sign-in moved to the accounts Worker nothing on the page does, but the rule stays.
3. Anything but `http:` / `https:` is refused.
4. The page's origin with a path starting `<assetPrefix>/_next/` is allowed.
5. Otherwise allowed only when its origin is in `origins`.

No `createScript`, and `createHTML` passes one string alone: an HTML or script string from code without a policy is
refused. Called directly (`trustedTypes.defaultPolicy.createHTML(html)`, no sink argument), `createHTML` throws and
logs nothing: it is not a violation, and a library that probes the default policy first then makes its
own named policy. The boot script contains no `</script` anywhere (a test holds it), since it is written into one.

### `trustedHtml`

1. In a browser with `trustedTypes`, the first call creates the policy (`createHTML: (s) => s`) and keeps it.
2. It returns the policy's `TrustedHTML`.
3. Without `trustedTypes` (the prerender, jsdom, a worker scope without enforcement) the string passes through.

### `sanitizedHtml`

1. A cache hit (same markup, same profile) answers the result it made before, and moves it to the newest end.
2. Otherwise the instance is made on first use: `createDOMPurify(window)`, its `uponSanitizeAttribute` hook (an
   `href` or `xlink:href` is kept on `a`, `image` and `img` alone unless it starts `#`; `blob:` on `image` and
   `img` alone), and, under Trusted Types, `TRUSTED_TYPES_POLICY` set to the markup policy.
3. `svg`: `USE_PROFILES { svg, svgFilters }`, `ADD_ATTR [role, target]`, DOMPurify's URL rule plus `blob:`.
   `svg-content`: the same over `<svg xmlns>…</svg>`, as a fragment, answering the `<svg>`'s `innerHTML`.
   `document`: `USE_PROFILES { html, svg, svgFilters }`, `WHOLE_DOCUMENT`.
4. The text is minted through the markup policy (or answered as text without Trusted Types) and cached, unless it
   is empty or the markup and text together pass `SANITISE_CACHE_CHARS`; then the oldest results go until the cache
   is within `SANITISE_CACHE_ENTRIES` and `SANITISE_CACHE_CHARS`.
5. No `window` (or DOMPurify unsupported): `''`, never cached.

### Third-party origins

None. Every layout calls `trustedTypesBootScript(prefix)` with no origins, so `ORIGINS` is `[]`. Sign-in happens on the
accounts site (liveworkspace.app), a full-page redirect, so no sign-in script runs on our pages.
`origins` stays as a parameter for a third party that one day needs it.

## Interfaces and contracts

```ts
// @liveworkspace/trusted-types/sanitize
export type MarkupProfile = 'svg' | 'svg-content' | 'document';
export function sanitizedHtml(markup: string, profile?: MarkupProfile): TrustedHTML | string;
export function sanitizeMarkup(markup: string, profile?: MarkupProfile): string;

export const TRUSTED_TYPES_CSP: string;
export const MARKUP_POLICY: 'liveworkspace-markup';
export function trustedHtml(markup: string): TrustedHTML | string;
export function isAllowedScriptUrl(
  url: string,
  pageOrigin: string,
  assetPrefix: string,
  origins: readonly string[],
  sink?: string,
): boolean;
export function trustedTypesBootScript(assetPrefix: string, origins?: readonly string[]): string;
```

## Errors and edge cases

| Case                                         | Handling                                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| A sink given a plain string by our code      | Blocked and logged; the sinks test fails it before it ships                                  |
| A third-party script URL not allowed         | Blocked, `[trusted-types] script-url-refused`; fixed with that party                         |
| Another app's build (`/live/_next/` on help) | Refused: each app allows its own prefix alone                                                |
| A browser without Trusted Types              | The header is ignored; the helpers pass strings                                              |
| A prefix or origin that is not one           | `trustedTypesBootScript` throws, so the build fails; what it embeds is JSON with `<` escaped |

## Security and trust

- `trustedHtml` and `sanitizedHtml` are the only paths to `TrustedHTML` for markup. `trustedHtml`'s callers are the
  layouts and the escaping builders listed as builder markup; every other sink, and every sink of a document's
  drawing, goes through `sanitizedHtml`. The sinks test holds both: a new `trustedHtml` call outside the list fails it,
  and so does a listed file that no longer calls it. No file is parsed with `DOMParser`, which no policy lets through.
- The default policy allows script URLs only: this app's own `/_next/`, named origins, and same-origin `blob:` for a
  worker. `trusted-types` names every policy, so no other code can create one.

## Performance and limits

`createHTML` is an identity: one call per markup render, no parsing. `sanitizedHtml` parses: a 1 MB drawing (4,000
labelled boxes) takes about 0.9 s of CPU in jsdom, far less in a browser, and a repeat is a cache lookup; the
face-finish ink, the hot path, stays on `trustedHtml`.

## Observability

| Fingerprint                          | Level | When                                      |
| ------------------------------------ | ----- | ----------------------------------------- |
| `[trusted-types] violation`          | error | Any Trusted Types violation on the page   |
| `[trusted-types] script-url-refused` | error | The default policy refuses a URL          |
| `[trusted-types] html-refused`       | error | The default policy refuses an HTML string |

## Testing

| Rule                                                                                                  | Test                                                                       |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| The URL rule, prefixes and the blob worker                                                            | `packages/ui/src/trusted-types.test.ts`: `isAllowedScriptUrl` cases        |
| `trustedHtml`                                                                                         | `trusted-types.test.ts`                                                    |
| The boot script runs the rule and logs                                                                | `trusted-types.test.ts`: `trustedTypesBootScript`                          |
| Every sink uses a policy, direct DOM writes included                                                  | `packages/ui/src/trusted-types-sinks.test.ts` (every app and package)      |
| `trustedHtml` only in a layout or a builder-markup file                                               | `trusted-types-sinks.test.ts` (`builderMarkup`)                            |
| The sanitiser strips script, handlers, `javascript:`, `<foreignObject>`, `<use>`, `<style>` breakouts | `packages/trusted-types/src/sanitize.test.ts`                              |
| Every template's drawing parses the same through it                                                   | `apps/*/lib/sanitised-drawings.test.ts`                                    |
| A 1 MB drawing within its CPU budget; the cache bounded                                               | `sanitize.test.ts` (`cpuMsOf`)                                             |
| Every layout boots first, with its prefix                                                             | `trusted-types-sinks.test.ts` (prefix read from each `next.config.ts`)     |
| Every app sends the header                                                                            | `trusted-types-sinks.test.ts` (`_headers`); `apps/live/src/worker.test.ts` |
| No violation in the running editor                                                                    | The E2E suite against `scripts/e2e-stack.mjs`, which sends the header      |

## Constants and configuration

| Constant                 | Value                   | Provenance                           | Safe range |
| ------------------------ | ----------------------- | ------------------------------------ | ---------- |
| `TRUSTED_TYPES_CSP`      | as in Domain and naming | Spec                                 | Fixed      |
| `SANITISE_CACHE_ENTRIES` | 256                     | Spec ("Cost")                        | 64 to 1024 |
| `SANITISE_CACHE_CHARS`   | 4,000,000               | Spec ("Cost"): about 8 MB of strings | 1M to 8M   |

## Defaults ledger

D9 and D10 in [DEFAULTS.md](DEFAULTS.md).
